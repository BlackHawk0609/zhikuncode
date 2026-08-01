package com.aicodeassistant.authorization;

import com.aicodeassistant.service.GitService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

class WorkspaceIdentityServiceTest {

    @TempDir
    Path temp;

    private final WorkspaceIdentityService identities =
            new WorkspaceIdentityService();
    private final GitService git = new GitService(identities);

    @Test
    void ordinaryRepositoryIsAValidatedRoot() throws Exception {
        Path repository = Files.createDirectory(temp.resolve("repository")).toRealPath();
        runGit(repository, "init");

        WorkspaceIdentityService.Identity identity = identities.resolve(repository);

        assertThat(identity.authorizationRoot()).isEqualTo(repository);
        assertThat(git.isGitRepositoryRoot(repository)).isTrue();
        assertThat(git.isGitRepository(repository)).isTrue();
    }

    @Test
    void linkedWorktreeRemainsValidAndSharesWorkspaceIdentity() throws Exception {
        Path repository = Files.createDirectory(temp.resolve("main")).toRealPath();
        runGit(repository, "init");
        runGit(repository, "config", "user.email", "test@example.com");
        runGit(repository, "config", "user.name", "Test User");
        runGit(repository, "commit", "--allow-empty", "-m", "initial");
        Path linked = temp.resolve("linked");
        runGit(repository, "worktree", "add", "--detach", linked.toString());
        linked = linked.toRealPath();

        WorkspaceIdentityService.Identity mainIdentity = identities.resolve(repository);
        WorkspaceIdentityService.Identity linkedIdentity = identities.resolve(linked);

        assertThat(git.isGitRepositoryRoot(linked)).isTrue();
        assertThat(git.isGitRepository(linked)).isTrue();
        assertThat(linkedIdentity.authorizationRoot()).isEqualTo(linked);
        assertThat(linkedIdentity.workspaceKey()).isEqualTo(mainIdentity.workspaceKey());
    }

    @Test
    void gitDirectorySymlinkToExternalRepositoryIsRejected() throws Exception {
        Path external = Files.createDirectory(temp.resolve("external-symlink-target")).toRealPath();
        runGit(external, "init");
        Path project = Files.createDirectory(temp.resolve("symlink-project")).toRealPath();
        Files.createSymbolicLink(project.resolve(".git"), external.resolve(".git"));

        assertThat(git.isGitRepositoryRoot(project)).isFalse();
        assertThat(git.isGitRepository(project)).isFalse();
        WorkspaceIdentityService.Identity identity = identities.resolve(project);
        assertThat(identity.authorizationRoot()).isEqualTo(project);
        assertThat(identity.workspaceKey())
                .isNotEqualTo(identities.resolve(external).workspaceKey());
    }

    @Test
    void unregisteredExternalGitDirectoryFileIsRejected() throws Exception {
        Path external = Files.createDirectory(temp.resolve("external-gitfile-target")).toRealPath();
        runGit(external, "init");
        Path project = Files.createDirectory(temp.resolve("gitfile-project")).toRealPath();
        Files.writeString(project.resolve(".git"),
                "gitdir: " + external.resolve(".git") + "\n");

        assertThat(git.isGitRepositoryRoot(project)).isFalse();
        assertThat(git.isGitRepository(project)).isFalse();
        WorkspaceIdentityService.Identity identity = identities.resolve(project);
        assertThat(identity.authorizationRoot()).isEqualTo(project);
        assertThat(identity.workspaceKey())
                .isNotEqualTo(identities.resolve(external).workspaceKey());
    }

    private static void runGit(Path directory, String... arguments) throws Exception {
        String[] command = new String[arguments.length + 1];
        command[0] = "git";
        System.arraycopy(arguments, 0, command, 1, arguments.length);
        Process process = new ProcessBuilder(command)
                .directory(directory.toFile())
                .redirectErrorStream(true)
                .start();
        String output = new String(process.getInputStream().readAllBytes());
        assertThat(process.waitFor())
                .as("git %s failed: %s", String.join(" ", arguments), output)
                .isZero();
    }
}
