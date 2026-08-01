package com.aicodeassistant.controller;

import com.aicodeassistant.service.ProjectWorkspaceService;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ProjectControllerTest {

    @Test
    void revokeReturnsAnExplicitIdempotentResult() {
        ProjectWorkspaceService workspaces =
                mock(ProjectWorkspaceService.class);
        var result = new ProjectWorkspaceService.RevocationResult(
                "p1", false);
        when(workspaces.revoke("p1")).thenReturn(result);

        var response = new ProjectController(workspaces)
                .revoke("p1");

        assertThat(response.getBody()).isEqualTo(result);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void directoryBrowserUsesTheActualPeerAddress() {
        ProjectWorkspaceService workspaces =
                mock(ProjectWorkspaceService.class);
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRemoteAddr()).thenReturn("127.0.0.1");
        var listing = new ProjectWorkspaceService.DirectoryListing(
                List.of("/workspace"), "/workspace", null,
                List.of());
        when(workspaces.browseDirectories(
                "/workspace", "127.0.0.1"))
                .thenReturn(listing);

        var response = new ProjectController(workspaces)
                .browseDirectories("/workspace", request);

        assertThat(response.getBody()).isEqualTo(listing);
        verify(workspaces).browseDirectories(
                "/workspace", "127.0.0.1");
    }
}
