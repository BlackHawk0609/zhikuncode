package com.aicodeassistant.controller;

import com.aicodeassistant.service.FileSearchService;
import com.aicodeassistant.service.FileSearchService.FileSearchResult;
import com.aicodeassistant.service.ProjectWorkspaceService;
import com.aicodeassistant.exception.SessionNotFoundException;
import com.aicodeassistant.session.SessionData;
import com.aicodeassistant.session.SessionManager;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 文件搜索 API — 支持 @文件附件功能的后端端点。
 *
 */
@RestController
public class FileController {

    private final FileSearchService fileSearchService;
    private final SessionManager sessionManager;
    private final ProjectWorkspaceService projectWorkspaces;

    public FileController(
            FileSearchService fileSearchService,
            SessionManager sessionManager,
            ProjectWorkspaceService projectWorkspaces) {
        this.fileSearchService = fileSearchService;
        this.sessionManager = sessionManager;
        this.projectWorkspaces = projectWorkspaces;
    }

    @GetMapping("/api/files/search")
    public ResponseEntity<List<FileSearchResult>> searchFiles(
            @RequestParam String query,
            @RequestParam(defaultValue = "20") int limit,
            @RequestParam String sessionId) {
        SessionData session = sessionManager.loadSession(sessionId)
                .orElseThrow(() -> new SessionNotFoundException(sessionId));
        String workspace = projectWorkspaces.requireCurrentBinding(
                session.workingDir()).toString();
        List<FileSearchResult> results = fileSearchService.fuzzySearch(
                query, workspace, limit);
        return ResponseEntity.ok(results);
    }
}
