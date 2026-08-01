package com.aicodeassistant.context;

import com.aicodeassistant.service.GitService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

class ProjectContextServiceBoundaryTest {

    @TempDir
    Path temp;

    @Test
    void gitSubdirectoryDoesNotExposeParentRepositoryContext() throws Exception {
        Path repositoryRoot = Files.createDirectory(temp.resolve("repository")).toRealPath();
        runGit(repositoryRoot, "init");
        Files.writeString(repositoryRoot.resolve("parent-secret.txt"), "secret");
        Path selected = Files.createDirectory(repositoryRoot.resolve("selected")).toRealPath();
        Files.writeString(selected.resolve("package.json"), "{}");
        runGit(repositoryRoot, "config", "user.email", "test@example.com");
        runGit(repositoryRoot, "config", "user.name", "Test User");
        runGit(repositoryRoot, "add", ".");
        runGit(repositoryRoot, "commit", "-m", "parent repository context");

        ProjectContextRepository repository = mock(ProjectContextRepository.class);
        ProjectContextService service = new ProjectContextService(repository, new GitService());

        ProjectContextService.ProjectContextSnapshot context = service.getContext(selected);

        assertThat(context).isNotNull();
        assertThat(context.gitRoot()).isNull();
        assertThat(context.branch()).isNull();
        assertThat(context.fileTree()).isEmpty();
        assertThat(context.recentCommits()).isEmpty();
        assertThat(context.projectType()).isEqualTo("Node.js");
        verifyNoInteractions(repository);
    }

    @Test
    void invalidExternalGitIndirectionDoesNotRunRepositoryContext()
            throws Exception {
        Path externalRepository = Files.createDirectory(
                temp.resolve("external-repository")).toRealPath();
        runGit(externalRepository, "init");
        runGit(externalRepository, "config", "user.email", "test@example.com");
        runGit(externalRepository, "config", "user.name", "Test User");
        Files.writeString(
                externalRepository.resolve("external-secret.txt"),
                "secret");
        runGit(externalRepository, "add", ".");
        runGit(externalRepository, "commit", "-m", "external secret");

        Path selected = Files.createDirectory(
                temp.resolve("selected-with-invalid-gitdir")).toRealPath();
        Files.writeString(
                selected.resolve(".git"),
                "gitdir: " + externalRepository.resolve(".git"));
        Files.writeString(selected.resolve("package.json"), "{}");
        ProjectContextRepository repository =
                mock(ProjectContextRepository.class);
        ProjectContextService service = new ProjectContextService(
                repository, new GitService());

        ProjectContextService.ProjectContextSnapshot context =
                service.getContext(selected);

        assertThat(context).isNotNull();
        assertThat(context.gitRoot()).isNull();
        assertThat(context.branch()).isNull();
        assertThat(context.fileTree()).isEmpty();
        assertThat(context.recentCommits()).isEmpty();
        assertThat(context.projectType()).isEqualTo("Node.js");
        verifyNoInteractions(repository);
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
