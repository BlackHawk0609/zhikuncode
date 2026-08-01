package com.aicodeassistant.service;

import com.aicodeassistant.exception.WorkspaceException;
import com.aicodeassistant.model.Project;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.ArgumentCaptor;
import org.springframework.dao.DataIntegrityViolationException;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ProjectWorkspaceServiceTest {

    @TempDir
    Path temp;

    @Test
    void storesCanonicalRootAndRejectsDuplicates()
            throws Exception {
        Path workspace = Files.createDirectory(
                temp.resolve("workspace"));
        Path alias = temp.resolve("workspace-link");
        Files.createSymbolicLink(alias, workspace);
        ProjectRepository projects =
                mock(ProjectRepository.class);
        ProjectWorkspaceService service =
                service(projects, "", workspace);

        Project created = service.create(
                " Demo ", alias.toString(), "127.0.0.1");

        assertThat(created.name()).isEqualTo("Demo");
        assertThat(created.workspaceRoot()).isEqualTo(
                workspace.toRealPath().toString());
        ArgumentCaptor<Project> saved =
                ArgumentCaptor.forClass(Project.class);
        verify(projects).create(saved.capture());
        assertThat(saved.getValue()).isEqualTo(created);

        doThrow(new DataIntegrityViolationException(
                "duplicate"))
                .when(projects).create(any(Project.class));
        assertCode(() -> service.create(
                "Again", workspace.toString(), "::1"),
                "PROJECT_PATH_DUPLICATE");
    }

    @Test
    void enforcesAllowedRootsAndRemoteCreationPolicy()
            throws Exception {
        Path allowed = Files.createDirectory(
                temp.resolve("allowed"));
        Path workspace = Files.createDirectory(
                allowed.resolve("workspace"));
        Path outside = Files.createDirectory(
                temp.resolve("outside"));
        ProjectRepository projects =
                mock(ProjectRepository.class);
        ProjectWorkspaceService restricted =
                service(projects, allowed.toString(), workspace);

        assertThat(restricted.canonicalizeForCreate(
                workspace.toString()))
                .isEqualTo(workspace.toRealPath());
        assertCode(() -> restricted.canonicalizeForCreate(
                outside.toString()), "WORKSPACE_ACCESS_DENIED");
        assertCode(() -> restricted.canonicalizeForCreate(
                "relative"), "WORKSPACE_ABSOLUTE_REQUIRED");

        ProjectWorkspaceService localOnly =
                service(projects, "", workspace);
        assertCode(() -> localOnly.create(
                "Remote", workspace.toString(), "192.0.2.10"),
                "REMOTE_PROJECT_CREATE_FORBIDDEN");
    }

    @Test
    void resolvesDefaultOrRegisteredProjectAndTrustsOnlyExactRoots()
            throws Exception {
        Path defaultRoot = Files.createDirectory(
                temp.resolve("default")).toRealPath();
        Path projectRoot = Files.createDirectory(
                temp.resolve("project")).toRealPath();
        Path child = Files.createDirectory(
                projectRoot.resolve("child")).toRealPath();
        Path alias = temp.resolve("project-alias");
        Files.createSymbolicLink(alias, projectRoot);
        ProjectRepository projects =
                mock(ProjectRepository.class);
        Project project = new Project(
                "p1", "Project", projectRoot.toString(),
                Instant.now());
        when(projects.findById("p1"))
                .thenReturn(Optional.of(project));
        when(projects.findByWorkspaceRoot(
                projectRoot.toString()))
                .thenReturn(Optional.of(project));
        ProjectWorkspaceService service =
                service(projects, "", defaultRoot);

        assertThat(service.resolveWorkspace(null))
                .isEqualTo(defaultRoot);
        assertThat(service.resolveWorkspace("p1"))
                .isEqualTo(projectRoot);
        assertThat(service.isTrustedFileScope(defaultRoot))
                .isFalse();
        assertThat(service.isTrustedFileScope(projectRoot))
                .isTrue();
        assertThat(service.isTrustedFileScope(alias))
                .isFalse();
        assertThat(service.isTrustedFileScope(child))
                .isFalse();
        assertCode(() -> service.resolveWorkspace("missing"),
                "PROJECT_NOT_FOUND");
    }

    @Test
    void detectsDeletedAndReboundWorkspace()
            throws Exception {
        Path saved = Files.createDirectory(
                temp.resolve("saved")).toRealPath();
        Path replacement = Files.createDirectory(
                temp.resolve("replacement")).toRealPath();
        ProjectWorkspaceService service = service(
                mock(ProjectRepository.class), "", replacement);

        Files.delete(saved);
        assertCode(() -> service.requireCurrentBinding(
                saved.toString()), "WORKSPACE_UNAVAILABLE");

        Files.createSymbolicLink(saved, replacement);
        assertCode(() -> service.requireCurrentBinding(
                saved.toString()), "WORKSPACE_REBOUND");
    }

    @Test
    void trustLookupFailureIsFailClosed() throws Exception {
        Path defaultRoot = Files.createDirectory(
                temp.resolve("default-fail-closed")).toRealPath();
        Path candidate = Files.createDirectory(
                temp.resolve("candidate")).toRealPath();
        ProjectRepository projects =
                mock(ProjectRepository.class);
        when(projects.findByWorkspaceRoot(
                candidate.toString()))
                .thenThrow(new IllegalStateException(
                        "database unavailable"));
        ProjectWorkspaceService service =
                service(projects, "", defaultRoot);

        assertThat(service.isTrustedFileScope(candidate))
                .isFalse();
    }

    @Test
    void revokeIsIdempotentAndReportsWhetherTrustExisted() {
        ProjectRepository projects =
                mock(ProjectRepository.class);
        when(projects.deleteById("p1"))
                .thenReturn(true, false);
        ProjectWorkspaceService service = service(
                projects, "", temp);

        assertThat(service.revoke(" p1 "))
                .isEqualTo(new ProjectWorkspaceService.RevocationResult(
                        "p1", true));
        assertThat(service.revoke("p1"))
                .isEqualTo(new ProjectWorkspaceService.RevocationResult(
                        "p1", false));
        assertCode(() -> service.revoke("  "),
                "PROJECT_ID_REQUIRED");
    }

    @Test
    void localBrowserUsesOnlyDefaultRootAndSkipsSymlinks()
            throws Exception {
        Path root = Files.createDirectory(
                temp.resolve("browser-root")).toRealPath();
        Path alpha = Files.createDirectory(
                root.resolve("alpha")).toRealPath();
        Files.createDirectory(root.resolve("Beta"));
        Files.writeString(root.resolve("file.txt"), "not a directory");
        Path external = Files.createDirectory(
                temp.resolve("external-browser-root"))
                .toRealPath();
        Files.createSymbolicLink(
                root.resolve("external-link"), external);
        ProjectWorkspaceService service = service(
                mock(ProjectRepository.class), "", root);

        ProjectWorkspaceService.DirectoryListing listing =
                service.browseDirectories(null, "127.0.0.1");

        assertThat(listing.roots())
                .containsExactly(root.toString());
        assertThat(listing.current()).isEqualTo(root.toString());
        assertThat(listing.parent()).isNull();
        assertThat(listing.directories())
                .extracting(ProjectWorkspaceService
                        .DirectoryEntry::name)
                .containsExactly("alpha", "Beta");

        ProjectWorkspaceService.DirectoryListing child =
                service.browseDirectories(
                        alpha.toString(), "::1");
        assertThat(child.current()).isEqualTo(alpha.toString());
        assertThat(child.parent()).isEqualTo(root.toString());
        assertCode(() -> service.browseDirectories(
                        external.toString(), "127.0.0.1"),
                "DIRECTORY_BROWSE_OUTSIDE_ROOTS");
        assertCode(() -> service.browseDirectories(
                        root.resolve("external-link").toString(),
                        "127.0.0.1"),
                "WORKSPACE_REBOUND");
    }

    @Test
    void directoryBrowserRequiresLoopbackWithoutAllowedRoots()
            throws Exception {
        Path root = Files.createDirectory(
                temp.resolve("local-browser-root")).toRealPath();
        ProjectWorkspaceService localOnly = service(
                mock(ProjectRepository.class), "", root);

        assertCode(() -> localOnly.browseDirectories(
                        null, "192.0.2.10"),
                "REMOTE_DIRECTORY_BROWSE_FORBIDDEN");

        ProjectWorkspaceService restricted = service(
                mock(ProjectRepository.class),
                root.toString(), root);
        assertThat(restricted.browseDirectories(
                        null, "192.0.2.10").roots())
                .containsExactly(root.toString());
    }

    @Test
    void reverseProxyLoopbackPeerDoesNotEnableLocalPickerByDefault()
            throws Exception {
        Path root = Files.createDirectory(
                temp.resolve("explicit-local-picker-root")).toRealPath();
        ProjectRepository projects = mock(ProjectRepository.class);
        ProjectWorkspaceService defaultSafe = new ProjectWorkspaceService(
                projects, "", root.toString(), false);

        assertCode(() -> defaultSafe.browseDirectories(
                        null, "127.0.0.1"),
                "LOCAL_PICKER_DISABLED");
        assertCode(() -> defaultSafe.create(
                        "Proxy peer", root.toString(), "127.0.0.1"),
                "LOCAL_PICKER_DISABLED");

        ProjectWorkspaceService explicitlyLocal =
                new ProjectWorkspaceService(
                        projects, "", root.toString(), true);
        assertThat(explicitlyLocal.browseDirectories(
                        null, "127.0.0.1").roots())
                .containsExactly(root.toString());

        ProjectWorkspaceService configuredRoots =
                new ProjectWorkspaceService(
                        projects, root.toString(),
                        root.toString(), false);
        assertThat(configuredRoots.browseDirectories(
                        null, "192.0.2.10").roots())
                .containsExactly(root.toString());
    }

    private ProjectWorkspaceService service(
            ProjectRepository projects,
            String allowedRoots,
            Path defaultRoot) {
        return new ProjectWorkspaceService(
                projects, allowedRoots, defaultRoot.toString(), true);
    }

    private static void assertCode(
            org.assertj.core.api.ThrowableAssert.ThrowingCallable call,
            String expectedCode) {
        assertThatThrownBy(call)
                .isInstanceOfSatisfying(
                        WorkspaceException.class,
                        error -> assertThat(error.getCode())
                                .isEqualTo(expectedCode));
    }
}
