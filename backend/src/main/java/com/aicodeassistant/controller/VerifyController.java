package com.aicodeassistant.controller;

import com.aicodeassistant.model.RunChecksRequest;
import com.aicodeassistant.model.RunChecksResponse;
import com.aicodeassistant.model.dto.VerifyCheckRequest;
import com.aicodeassistant.model.dto.VerifyCheckResponse;
import com.aicodeassistant.exception.RequestValidationException;
import com.aicodeassistant.exception.SessionNotFoundException;
import com.aicodeassistant.security.PathSecurityService;
import com.aicodeassistant.service.ProjectWorkspaceService;
import com.aicodeassistant.service.VerifyCheckService;
import com.aicodeassistant.session.SessionData;
import com.aicodeassistant.session.SessionManager;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.concurrent.CompletableFuture;

/**
 * VerifyController — 确定性验证 API。
 * <p>
 * 端点:
 * <ul>
 *   <li>POST /api/verify/run-checks — 执行验证检查（Phase 2 增强版）</li>
 *   <li>POST /api/verify/legacy-checks — 旧版检查（向后兼容）</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/verify")
public class VerifyController {
    private static final Logger log = LoggerFactory.getLogger(VerifyController.class);

    private final VerifyCheckService verifyCheckService;
    private final SessionManager sessionManager;
    private final ProjectWorkspaceService projectWorkspaces;
    private final PathSecurityService pathSecurity;

    public VerifyController(
            VerifyCheckService verifyCheckService,
            SessionManager sessionManager,
            ProjectWorkspaceService projectWorkspaces,
            PathSecurityService pathSecurity) {
        this.verifyCheckService = verifyCheckService;
        this.sessionManager = sessionManager;
        this.projectWorkspaces = projectWorkspaces;
        this.pathSecurity = pathSecurity;
    }

    /**
     * Phase 2 增强版 — 每文件独立检查 + heuristic + Signal 计算。
     */
    @PostMapping("/run-checks")
    public ResponseEntity<VerifyCheckResponse> runChecks(
            @RequestBody VerifyCheckRequest request,
            Principal principal) {

        log.info("Received Phase 2 run-checks request for session {} from user {}",
            request.sessionId(), principal != null ? principal.getName() : "anonymous");

        // Validate request
        if (request.sessionId() == null || request.sessionId().isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        if (request.workingDirectory() != null
                && !request.workingDirectory().isBlank()) {
            throw new RequestValidationException(
                    "VERIFY_WORKING_DIRECTORY_UNSUPPORTED",
                    "Verify resolves its workspace from sessionId; "
                            + "workingDirectory is not accepted");
        }

        String workspacePath = requireSessionWorkspace(
                request.sessionId());
        requireWorkspaceFilePaths(
                request.filePaths(), workspacePath);

        try {
            VerifyCheckResponse response = verifyCheckService.executeChecks(request, workspacePath);

            // Push verification_result via WebSocket
            if (principal != null) {
                CompletableFuture.runAsync(() ->
                    verifyCheckService.pushVerificationResult(request.sessionId(), response)
                );
            }

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Failed to run Phase 2 checks for session {}", request.sessionId(), e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * 旧版检查 — 向后兼容。
     */
    @PostMapping("/legacy-checks")
    public ResponseEntity<RunChecksResponse> legacyChecks(
            @RequestBody RunChecksRequest request,
            Principal principal) {

        log.info("Received legacy run-checks request for operation {} from user {}",
            request.operationId(), principal != null ? principal.getName() : "anonymous");

        if (request.sessionId() == null || request.operationId() == null) {
            return ResponseEntity.badRequest().build();
        }
        if (request.checks() == null || request.checks().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        String workspacePath = requireSessionWorkspace(
                request.sessionId());
        requireWorkspaceFilePaths(
                request.filePaths(), workspacePath);

        try {
            RunChecksResponse response = verifyCheckService.runLegacyChecks(request, workspacePath);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Failed to run legacy checks for operation {}", request.operationId(), e);
            return ResponseEntity.internalServerError().build();
        }
    }

    private String requireSessionWorkspace(String sessionId) {
        SessionData session = sessionManager.loadSession(sessionId)
                .orElseThrow(() ->
                        new SessionNotFoundException(sessionId));
        return projectWorkspaces.requireCurrentBinding(
                session.workingDir()).toString();
    }

    private void requireWorkspaceFilePaths(
            java.util.List<String> filePaths,
            String workspacePath) {
        if (filePaths == null || filePaths.isEmpty()) {
            throw new RequestValidationException(
                    "VERIFY_FILE_PATHS_REQUIRED",
                    "Verify requires at least one file path");
        }
        for (String filePath : filePaths) {
            if (filePath == null || filePath.isBlank()
                    || filePath.startsWith("-")) {
                throw new RequestValidationException(
                        "VERIFY_FILE_PATH_INVALID",
                        "Verify file paths must be non-empty paths, "
                                + "not command options");
            }
            final PathSecurityService.PathCheckResult check;
            try {
                // Verification launches external tooling and has no
                // interactive confirmation flow. Use the stricter path
                // check so protected files and directories cannot be passed
                // through as command arguments.
                check = pathSecurity.checkWritePermission(
                        filePath, workspacePath);
            } catch (RuntimeException invalid) {
                throw new RequestValidationException(
                        "VERIFY_FILE_PATH_INVALID",
                        "Verify file path is invalid");
            }
            if (!check.isAllowed()) {
                throw new RequestValidationException(
                        "VERIFY_FILE_PATH_OUTSIDE_WORKSPACE",
                        "Verify file path must stay within the "
                                + "Session workspace");
            }
            if (check.needsConfirmation()) {
                throw new RequestValidationException(
                        "VERIFY_FILE_PATH_CONFIRMATION_REQUIRED",
                        "Verify cannot run checks on a protected file path "
                                + "that requires confirmation");
            }
        }
    }
}
