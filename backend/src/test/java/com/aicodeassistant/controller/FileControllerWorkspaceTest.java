package com.aicodeassistant.controller;

import com.aicodeassistant.exception.SessionNotFoundException;
import com.aicodeassistant.model.Usage;
import com.aicodeassistant.service.FileSearchService;
import com.aicodeassistant.service.ProjectWorkspaceService;
import com.aicodeassistant.session.SessionData;
import com.aicodeassistant.session.SessionManager;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class FileControllerWorkspaceTest {

    @TempDir
    Path workspace;

    @Test
    void searchesOnlyTheWorkspaceSavedOnSession()
            throws Exception {
        Path project = Files.createDirectory(
                workspace.resolve("project")).toRealPath();
        Files.writeString(
                project.resolve("README.md"), "inside");
        Path outside = Files.createDirectory(
                workspace.resolve("outside-search"));
        Files.writeString(
                outside.resolve("README-secret.md"), "outside");
        Files.createSymbolicLink(
                project.resolve("README-link.md"),
                outside.resolve("README-secret.md"));
        SessionManager sessions = mock(SessionManager.class);
        when(sessions.loadSession("session-1"))
                .thenReturn(Optional.of(session(
                        "session-1", project.toString())));
        ProjectWorkspaceService projectWorkspaces =
                mock(ProjectWorkspaceService.class);
        when(projectWorkspaces.requireCurrentBinding(
                project.toString())).thenReturn(project);
        FileController controller = new FileController(
                new FileSearchService(), sessions,
                projectWorkspaces);

        var results = controller.searchFiles(
                "README", 20, "session-1").getBody();

        assertThat(results).isNotNull();
        assertThat(results)
                .extracting(FileSearchService.FileSearchResult::path)
                .contains("README.md")
                .doesNotContain(
                        "README-secret.md", "README-link.md");
    }

    @Test
    void rejectsUnknownSession() {
        SessionManager sessions = mock(SessionManager.class);
        when(sessions.loadSession("missing"))
                .thenReturn(Optional.empty());
        FileController controller = new FileController(
                new FileSearchService(), sessions,
                mock(ProjectWorkspaceService.class));

        assertThatThrownBy(() -> controller.searchFiles(
                "readme", 20, "missing"))
                .isInstanceOf(SessionNotFoundException.class);
    }

    private static SessionData session(
            String id, String workingDirectory) {
        Instant now = Instant.now();
        return new SessionData(
                id, "model", workingDirectory,
                null, "active", List.of(), Map.of(),
                Usage.zero(), 0.0, null, now, now);
    }
}
