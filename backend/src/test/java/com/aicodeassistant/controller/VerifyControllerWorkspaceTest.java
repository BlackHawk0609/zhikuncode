package com.aicodeassistant.controller;

import com.aicodeassistant.exception.RequestValidationException;
import com.aicodeassistant.exception.SessionNotFoundException;
import com.aicodeassistant.model.RunChecksRequest;
import com.aicodeassistant.model.RunChecksResponse;
import com.aicodeassistant.model.Usage;
import com.aicodeassistant.model.dto.VerifyCheckRequest;
import com.aicodeassistant.model.dto.VerifyCheckResponse;
import com.aicodeassistant.security.PathSecurityService;
import com.aicodeassistant.service.ProjectWorkspaceService;
import com.aicodeassistant.service.VerifyCheckService;
import com.aicodeassistant.session.SessionData;
import com.aicodeassistant.session.SessionManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.nio.file.Files;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class VerifyControllerWorkspaceTest {

    @TempDir
    Path workspace;

    @BeforeEach
    void canonicalizeWorkspace() throws Exception {
        workspace = Files.createDirectory(
                workspace.resolve("workspace")).toRealPath();
    }

    @Test
    void enhancedChecksUseOnlyThePersistedSessionWorkspace() {
        Fixture fixture = fixtureWithSession("session-1");
        VerifyCheckRequest request = new VerifyCheckRequest(
                "session-1", List.of("src/App.ts"),
                List.of("typescript"), null, false);
        VerifyCheckResponse result =
                mock(VerifyCheckResponse.class);
        when(fixture.checks().executeChecks(
                request, workspace.toString()))
                .thenReturn(result);

        var response = fixture.controller()
                .runChecks(request, null);

        assertThat(response.getBody()).isSameAs(result);
        verify(fixture.projects()).requireCurrentBinding(
                workspace.toString());
        verify(fixture.checks()).executeChecks(
                request, workspace.toString());
    }

    @Test
    void rawWorkingDirectoryIsRejectedBeforeSessionLookup() {
        VerifyCheckService checks = mock(VerifyCheckService.class);
        SessionManager sessions = mock(SessionManager.class);
        ProjectWorkspaceService projects =
                mock(ProjectWorkspaceService.class);
        VerifyController controller = new VerifyController(
                checks, sessions, projects,
                new PathSecurityService());
        VerifyCheckRequest request = new VerifyCheckRequest(
                "session-1", List.of("src/App.ts"),
                List.of("typescript"), "/client-controlled",
                false);

        assertThatThrownBy(() ->
                controller.runChecks(request, null))
                .isInstanceOfSatisfying(
                        RequestValidationException.class,
                        error -> assertThat(error.getCode())
                                .isEqualTo(
                                        "VERIFY_WORKING_DIRECTORY_UNSUPPORTED"));
        verifyNoInteractions(checks, sessions, projects);
    }

    @Test
    void missingSessionIsRejectedInsteadOfUsingProcessCwd() {
        VerifyCheckService checks = mock(VerifyCheckService.class);
        SessionManager sessions = mock(SessionManager.class);
        ProjectWorkspaceService projects =
                mock(ProjectWorkspaceService.class);
        VerifyController controller = new VerifyController(
                checks, sessions, projects,
                new PathSecurityService());
        VerifyCheckRequest request = new VerifyCheckRequest(
                "missing", List.of("src/App.ts"),
                List.of("typescript"), null, false);

        assertThatThrownBy(() ->
                controller.runChecks(request, null))
                .isInstanceOf(SessionNotFoundException.class);
        verifyNoInteractions(checks, projects);
    }

    @Test
    void relativeAndSymlinkEscapesAreRejected() throws Exception {
        Fixture fixture = fixtureWithSession("session-escape");
        VerifyCheckRequest relativeEscape = new VerifyCheckRequest(
                "session-escape", List.of("../outside.ts"),
                List.of("typescript"), null, false);

        assertThatThrownBy(() -> fixture.controller()
                .runChecks(relativeEscape, null))
                .isInstanceOfSatisfying(
                        RequestValidationException.class,
                        error -> assertThat(error.getCode())
                                .isEqualTo(
                                        "VERIFY_FILE_PATH_OUTSIDE_WORKSPACE"));

        Path outside = Files.writeString(
                workspace.resolveSibling("outside.ts"), "secret");
        Files.createSymbolicLink(
                workspace.resolve("outside-link.ts"), outside);
        VerifyCheckRequest symlinkEscape = new VerifyCheckRequest(
                "session-escape", List.of("outside-link.ts"),
                List.of("typescript"), null, false);
        assertThatThrownBy(() -> fixture.controller()
                .runChecks(symlinkEscape, null))
                .isInstanceOfSatisfying(
                        RequestValidationException.class,
                        error -> assertThat(error.getCode())
                                .isEqualTo(
                                        "VERIFY_FILE_PATH_OUTSIDE_WORKSPACE"));
        verifyNoInteractions(fixture.checks());
    }

    @Test
    void legacyChecksUseTheSameSessionBinding() {
        Fixture fixture = fixtureWithSession("session-legacy");
        RunChecksRequest request = new RunChecksRequest(
                "session-legacy", "operation-1",
                List.of("eslint"), List.of("src/App.ts"),
                10_000);
        RunChecksResponse result = mock(RunChecksResponse.class);
        when(fixture.checks().runLegacyChecks(
                request, workspace.toString()))
                .thenReturn(result);

        var response = fixture.controller()
                .legacyChecks(request, null);

        assertThat(response.getBody()).isSameAs(result);
        verify(fixture.projects()).requireCurrentBinding(
                workspace.toString());
        verify(fixture.checks()).runLegacyChecks(
                request, workspace.toString());
    }

    @Test
    void legacyChecksRejectMissingFilePathsWithStructuredCode() {
        Fixture fixture = fixtureWithSession("session-no-files");
        RunChecksRequest request = new RunChecksRequest(
                "session-no-files", "operation-1",
                List.of("eslint"), null, 10_000);

        assertThatThrownBy(() -> fixture.controller()
                .legacyChecks(request, null))
                .isInstanceOfSatisfying(
                        RequestValidationException.class,
                        error -> assertThat(error.getCode())
                                .isEqualTo(
                                        "VERIFY_FILE_PATHS_REQUIRED"));
        verifyNoInteractions(fixture.checks());
    }

    @Test
    void enhancedChecksRejectEmptyFilePathsWithStructuredCode() {
        Fixture fixture = fixtureWithSession("session-empty-files");
        VerifyCheckRequest request = new VerifyCheckRequest(
                "session-empty-files", List.of(),
                List.of("typescript"), null, false);

        assertThatThrownBy(() -> fixture.controller()
                .runChecks(request, null))
                .isInstanceOfSatisfying(
                        RequestValidationException.class,
                        error -> assertThat(error.getCode())
                                .isEqualTo(
                                        "VERIFY_FILE_PATHS_REQUIRED"));
        verifyNoInteractions(fixture.checks());
    }

    @Test
    void enhancedChecksRejectSensitiveEnvironmentFiles()
            throws Exception {
        Fixture fixture = fixtureWithSession("session-env");
        Files.writeString(workspace.resolve(".env"),
                "TOKEN=secret");
        VerifyCheckRequest request = new VerifyCheckRequest(
                "session-env", List.of(".env"),
                List.of("eslint"), null, false);

        assertConfirmationRequired(() -> fixture.controller()
                .runChecks(request, null));
        verifyNoInteractions(fixture.checks());
    }

    @Test
    void legacyChecksRejectFilesInProtectedDirectories()
            throws Exception {
        Fixture fixture = fixtureWithSession("session-protected");
        Path gitDirectory = Files.createDirectory(
                workspace.resolve(".git"));
        Files.writeString(gitDirectory.resolve("config"),
                "[core]");
        RunChecksRequest request = new RunChecksRequest(
                "session-protected", "operation-1",
                List.of("eslint"), List.of(".git/config"),
                10_000);

        assertConfirmationRequired(() -> fixture.controller()
                .legacyChecks(request, null));
        verifyNoInteractions(fixture.checks());
    }

    private Fixture fixtureWithSession(String sessionId) {
        VerifyCheckService checks = mock(VerifyCheckService.class);
        SessionManager sessions = mock(SessionManager.class);
        ProjectWorkspaceService projects =
                mock(ProjectWorkspaceService.class);
        when(sessions.loadSession(sessionId))
                .thenReturn(Optional.of(session(
                        sessionId, workspace.toString())));
        when(projects.requireCurrentBinding(
                workspace.toString())).thenReturn(workspace);
        return new Fixture(
                new VerifyController(
                        checks, sessions, projects,
                        new PathSecurityService()),
                checks, projects);
    }

    private static SessionData session(
            String id, String workingDirectory) {
        Instant now = Instant.now();
        return new SessionData(
                id, "model", workingDirectory,
                null, "active", List.of(), Map.of(),
                Usage.zero(), 0.0, null, now, now);
    }

    private static void assertConfirmationRequired(
            org.assertj.core.api.ThrowableAssert.ThrowingCallable call) {
        assertThatThrownBy(call)
                .isInstanceOfSatisfying(
                        RequestValidationException.class,
                        error -> assertThat(error.getCode())
                                .isEqualTo(
                                        "VERIFY_FILE_PATH_CONFIRMATION_REQUIRED"));
    }

    private record Fixture(
            VerifyController controller,
            VerifyCheckService checks,
            ProjectWorkspaceService projects
    ) {}
}
