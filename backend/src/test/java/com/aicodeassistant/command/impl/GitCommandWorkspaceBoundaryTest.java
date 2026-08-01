package com.aicodeassistant.command.impl;

import com.aicodeassistant.command.Command;
import com.aicodeassistant.command.CommandContext;
import com.aicodeassistant.command.CommandResult;
import com.aicodeassistant.service.GitService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class GitCommandWorkspaceBoundaryTest {

    @TempDir
    Path temp;

    @Test
    void slashGitCommandsRejectRepositorySubdirectoryAndPreserveIndex() throws Exception {
        Path repository = Files.createDirectory(temp.resolve("repository")).toRealPath();
        runGit(repository, "init");
        runGit(repository, "config", "user.email", "test@example.com");
        runGit(repository, "config", "user.name", "Test User");
        Path selected = Files.createDirectory(repository.resolve("selected")).toRealPath();
        Files.writeString(selected.resolve("code.txt"), "initial");
        Files.writeString(repository.resolve("root.txt"), "initial");
        runGit(repository, "add", ".");
        runGit(repository, "commit", "-m", "initial");

        Files.writeString(repository.resolve("root.txt"), "staged outside selected Project");
        runGit(repository, "add", "root.txt");
        String headBefore = gitOutput(repository, "rev-parse", "HEAD");

        GitService git = new GitService();
        CommandContext context = CommandContext.of("session", selected.toString(), null, null);
        GitCommands configured = new GitCommands(git);
        AiAnalysisCommands analysis = new AiAnalysisCommands(git);
        QuickCommands quick = new QuickCommands(git);
        List<Command> commands = List.of(
                new GitCommitCommand(git),
                new DiffCommand(git),
                new GitReviewCommand(git),
                configured.commitPushPrCommand(),
                configured.branchCommand(),
                analysis.prReviewCommand(),
                quick.blameCommand());
        List<String> arguments = List.of(
                "must-not-commit", "", "", "", "list", "", "file.txt");

        for (int index = 0; index < commands.size(); index++) {
            CommandResult result = commands.get(index).execute(arguments.get(index), context);
            assertThat(result.isSuccess())
                    .as("/%s must reject a Git subdirectory Project", commands.get(index).getName())
                    .isFalse();
            assertThat(result.error()).contains("Git 仓库根目录");
        }

        assertThat(gitOutput(repository, "rev-parse", "HEAD")).isEqualTo(headBefore);
        assertThat(gitOutput(repository, "diff", "--cached", "--name-only"))
                .contains("root.txt");
    }

    @Test
    void commandsWithoutLocalGitBehaviorAllowNonGitProjects()
            throws Exception {
        Path project = Files.createDirectory(
                temp.resolve("non-git-project")).toRealPath();
        GitCommands configured = new GitCommands(new GitService());
        CommandContext context = CommandContext.of(
                "session", project.toString(), null, null);

        assertThat(configured.securityReviewCommand()
                .execute("", context).isSuccess()).isTrue();
        assertThat(configured.prCommentsCommand()
                .execute("", context).isSuccess()).isTrue();
        assertThat(configured.rewindCommand()
                .execute("checkpoint", context).isSuccess()).isTrue();
    }

    @Test
    void repositoryRootIsAcceptedBySharedGuard() throws Exception {
        Path repository = Files.createDirectory(temp.resolve("root-repository")).toRealPath();
        runGit(repository, "init");

        GitService git = new GitService();

        assertThat(git.isGitRepositoryRoot(repository)).isTrue();
        Path child = Files.createDirectory(repository.resolve("child"));
        assertThat(git.isGitRepositoryRoot(child)).isFalse();
        assertThat(git.isGitRepository(child)).isFalse();
    }

    private static void runGit(Path directory, String... arguments) throws Exception {
        gitOutput(directory, arguments);
    }

    private static String gitOutput(Path directory, String... arguments) throws Exception {
        String[] command = new String[arguments.length + 1];
        command[0] = "git";
        System.arraycopy(arguments, 0, command, 1, arguments.length);
        Process process = new ProcessBuilder(command)
                .directory(directory.toFile())
                .redirectErrorStream(true)
                .start();
        String output = new String(process.getInputStream().readAllBytes()).trim();
        assertThat(process.waitFor())
                .as("git %s failed: %s", String.join(" ", arguments), output)
                .isZero();
        return output;
    }
}
