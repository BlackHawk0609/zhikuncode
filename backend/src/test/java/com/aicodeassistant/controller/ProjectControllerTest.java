package com.aicodeassistant.controller;

import com.aicodeassistant.exception.WorkspaceException;
import com.aicodeassistant.model.Project;
import com.aicodeassistant.service.ProjectWorkspaceService;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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
                List.of(), true);
        when(workspaces.browseDirectories(
                "/workspace", "127.0.0.1"))
                .thenReturn(listing);

        var response = new ProjectController(workspaces)
                .browseDirectories("/workspace", request);

        assertThat(response.getBody()).isEqualTo(listing);
        verify(workspaces).browseDirectories(
                "/workspace", "127.0.0.1");
    }

    @Test
    void forwardedDirectoryBrowserUsesRemoteCallerIdentity() {
        ProjectWorkspaceService workspaces =
                mock(ProjectWorkspaceService.class);
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRemoteAddr()).thenReturn("127.0.0.1");
        when(request.getHeader("Forwarded"))
                .thenReturn("for=192.0.2.10");
        var listing = new ProjectWorkspaceService.DirectoryListing(
                List.of("/configured"), "/configured", null,
                List.of(), false);
        when(workspaces.browseDirectories(
                null, null)).thenReturn(listing);

        var response = new ProjectController(workspaces)
                .browseDirectories(null, request);

        assertThat(response.getBody()).isEqualTo(listing);
        verify(workspaces).browseDirectories(null, null);
    }

    @Test
    void evenEmptyForwardingHeaderUsesRemoteCallerIdentity() {
        ProjectWorkspaceService workspaces =
                mock(ProjectWorkspaceService.class);
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRemoteAddr()).thenReturn("127.0.0.1");
        when(request.getHeader("X-Forwarded-Proto")).thenReturn("");
        var listing = new ProjectWorkspaceService.DirectoryListing(
                List.of("/configured"), "/configured", null,
                List.of(), false);
        when(workspaces.browseDirectories(
                null, null)).thenReturn(listing);

        new ProjectController(workspaces)
                .browseDirectories(null, request);

        verify(workspaces).browseDirectories(null, null);
    }

    @Test
    void forwardedDirectoryBrowserPropagatesRemotePolicyRejection() {
        ProjectWorkspaceService workspaces =
                mock(ProjectWorkspaceService.class);
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRemoteAddr()).thenReturn("127.0.0.1");
        when(request.getHeader("X-Real-IP"))
                .thenReturn("192.0.2.10");
        WorkspaceException rejection = new WorkspaceException(
                HttpStatus.FORBIDDEN,
                "REMOTE_DIRECTORY_BROWSE_FORBIDDEN",
                "Remote directory browsing requires allowed roots");
        when(workspaces.browseDirectories(null, null))
                .thenThrow(rejection);

        assertThatThrownBy(() -> new ProjectController(workspaces)
                .browseDirectories(null, request))
                .isSameAs(rejection);
    }

    @Test
    void directProjectCreationUsesTheActualPeerAddress() {
        ProjectWorkspaceService workspaces =
                mock(ProjectWorkspaceService.class);
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRemoteAddr()).thenReturn("127.0.0.1");
        Project project = new Project(
                "p1", "workspace", "/workspace", Instant.EPOCH);
        when(workspaces.create(
                "workspace", "/workspace", "127.0.0.1"))
                .thenReturn(project);

        var response = new ProjectController(workspaces).create(
                new ProjectController.CreateProjectRequest(
                        "workspace", "/workspace"),
                request);

        assertThat(response.getStatusCode().value()).isEqualTo(201);
        assertThat(response.getBody()).isEqualTo(project);
        verify(workspaces).create(
                "workspace", "/workspace", "127.0.0.1");
    }

    @Test
    void forwardedProjectCreationUsesRemoteCallerIdentity() {
        ProjectWorkspaceService workspaces =
                mock(ProjectWorkspaceService.class);
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRemoteAddr()).thenReturn("127.0.0.1");
        when(request.getHeader("X-Forwarded-Host"))
                .thenReturn("example.test");
        Project project = new Project(
                "p1", "workspace", "/configured", Instant.EPOCH);
        when(workspaces.create(
                "workspace", "/configured", null))
                .thenReturn(project);

        var response = new ProjectController(workspaces).create(
                new ProjectController.CreateProjectRequest(
                        "workspace", "/configured"),
                request);

        assertThat(response.getStatusCode().value()).isEqualTo(201);
        assertThat(response.getBody()).isEqualTo(project);
        verify(workspaces).create("workspace", "/configured", null);
    }

    @Test
    void forwardedProjectCreationPropagatesRemotePolicyRejection() {
        ProjectWorkspaceService workspaces =
                mock(ProjectWorkspaceService.class);
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRemoteAddr()).thenReturn("127.0.0.1");
        when(request.getHeader("X-Forwarded-For"))
                .thenReturn("192.0.2.10");
        WorkspaceException rejection = new WorkspaceException(
                HttpStatus.FORBIDDEN,
                "REMOTE_PROJECT_CREATE_FORBIDDEN",
                "Remote Project creation requires allowed roots");
        when(workspaces.create("workspace", "/workspace", null))
                .thenThrow(rejection);

        assertThatThrownBy(() -> new ProjectController(workspaces).create(
                new ProjectController.CreateProjectRequest(
                        "workspace", "/workspace"),
                request))
                .isSameAs(rejection);
    }

    @Test
    void nativePickerReturnsSelectionOrNoContent() {
        ProjectWorkspaceService workspaces =
                mock(ProjectWorkspaceService.class);
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRemoteAddr()).thenReturn("127.0.0.1");
        var listing = new ProjectWorkspaceService.DirectoryListing(
                List.of("/"), "/workspace", "/", List.of(), true);
        when(workspaces.pickDirectory("127.0.0.1"))
                .thenReturn(Optional.of(listing), Optional.empty());
        ProjectController controller = new ProjectController(workspaces);

        var selected = controller.pickDirectory("1", request);
        var cancelled = controller.pickDirectory("1", request);

        assertThat(selected.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(selected.getBody()).isEqualTo(listing);
        assertThat(cancelled.getStatusCode())
                .isEqualTo(HttpStatus.NO_CONTENT);
    }

    @Test
    void nativePickerRequiresDedicatedHeader() {
        ProjectWorkspaceService workspaces =
                mock(ProjectWorkspaceService.class);
        HttpServletRequest request = mock(HttpServletRequest.class);

        assertThatThrownBy(() -> new ProjectController(workspaces)
                .pickDirectory(null, request))
                .isInstanceOfSatisfying(
                        WorkspaceException.class,
                        error -> {
                            assertThat(error.getStatus())
                                    .isEqualTo(HttpStatus.FORBIDDEN);
                            assertThat(error.getCode()).isEqualTo(
                                    "NATIVE_PICKER_HEADER_REQUIRED");
                        });
    }

    @Test
    void nativePickerRejectsForwardedRequests() {
        ProjectWorkspaceService workspaces =
                mock(ProjectWorkspaceService.class);
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getHeader("X-Forwarded-For"))
                .thenReturn("192.0.2.10");

        assertThatThrownBy(() -> new ProjectController(workspaces)
                .pickDirectory("1", request))
                .isInstanceOfSatisfying(
                        WorkspaceException.class,
                        error -> {
                            assertThat(error.getStatus())
                                    .isEqualTo(HttpStatus.FORBIDDEN);
                            assertThat(error.getCode()).isEqualTo(
                                    "NATIVE_PICKER_FORWARDED_REQUEST");
                        });
    }

    @Test
    void nativePickerEndpointOnlyConsumesJson() throws Exception {
        ProjectWorkspaceService workspaces =
                mock(ProjectWorkspaceService.class);
        when(workspaces.pickDirectory("127.0.0.1"))
                .thenReturn(Optional.empty());
        MockMvc mvc = MockMvcBuilders.standaloneSetup(
                new ProjectController(workspaces)).build();

        mvc.perform(post("/api/projects/directories/pick")
                        .header("X-Zhikun-Native-Picker", "1")
                        .contentType(MediaType.TEXT_PLAIN))
                .andExpect(status().isUnsupportedMediaType());
        mvc.perform(post("/api/projects/directories/pick")
                        .header("X-Zhikun-Native-Picker", "1")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isNoContent());
    }
}
