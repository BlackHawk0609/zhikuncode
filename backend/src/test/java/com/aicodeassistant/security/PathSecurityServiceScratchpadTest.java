package com.aicodeassistant.security;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

class PathSecurityServiceScratchpadTest {

    @TempDir
    Path temp;

    @Test
    void projectScratchpadRelaxesOnlyItsExactControlMarker()
            throws Exception {
        Path project = Files.createDirectory(
                temp.resolve("project")).toRealPath();
        Path scratchpad = Files.createDirectories(
                project.resolve(".zhikun/scratchpad"));
        PathSecurityService security = securityWithSystemRoot(
                temp.resolve("system/.zhikun/scratchpad"));

        Path ordinary = Files.writeString(
                scratchpad.resolve("notes.txt"), "notes");
        assertOrdinaryWrite(security.checkWritePermission(
                ordinary.toString(), project.toString()));

        Path env = Files.writeString(
                scratchpad.resolve(".env"), "TOKEN=secret");
        assertThat(security.checkReadPermission(
                env.toString(), project.toString())
                .needsConfirmation()).isTrue();
        assertThat(security.checkWritePermission(
                env.toString(), project.toString())
                .needsConfirmation()).isTrue();

        Path sshFile = Files.writeString(
                Files.createDirectories(scratchpad.resolve(".ssh"))
                        .resolve("config"),
                "Host example");
        assertThat(security.checkReadPermission(
                sshFile.toString(), project.toString())
                .needsConfirmation()).isTrue();
        assertThat(security.checkWritePermission(
                sshFile.toString(), project.toString())
                .needsConfirmation()).isTrue();

        Path nestedControl = Files.writeString(
                Files.createDirectories(
                        scratchpad.resolve("nested/.zhikun"))
                        .resolve("control.txt"),
                "control");
        assertThat(security.checkWritePermission(
                nestedControl.toString(), project.toString())
                .needsConfirmation()).isTrue();
    }

    @Test
    void scratchpadLookalikesDoNotReceiveTheException()
            throws Exception {
        Path project = Files.createDirectory(
                temp.resolve("project-lookalike")).toRealPath();
        PathSecurityService security = securityWithSystemRoot(
                temp.resolve("system/.zhikun/scratchpad"));

        for (String lookalike : java.util.List.of(
                ".zhikun/scratchpad-evil/file.txt",
                ".zhikun/not-scratchpad/file.txt")) {
            Path target = project.resolve(lookalike);
            Files.createDirectories(target.getParent());
            Files.writeString(target, "data");
            assertThat(security.checkWritePermission(
                    target.toString(), project.toString())
                    .needsConfirmation()).as(lookalike).isTrue();
        }
    }

    @Test
    void projectRootNamedZhikunUsesTheSameExactScratchpadRule()
            throws Exception {
        Path project = Files.createDirectory(
                temp.resolve(".zhikun")).toRealPath();
        PathSecurityService security = securityWithSystemRoot(
                temp.resolve("system/.zhikun/scratchpad"));

        Path ordinary = project.resolve("scratchpad/notes.txt");
        Files.createDirectories(ordinary.getParent());
        Files.writeString(ordinary, "notes");
        assertOrdinaryWrite(security.checkWritePermission(
                ordinary.toString(), project.toString()));

        Path other = project.resolve("other/notes.txt");
        Files.createDirectories(other.getParent());
        Files.writeString(other, "notes");
        assertThat(security.checkWritePermission(
                other.toString(), project.toString())
                .needsConfirmation()).isTrue();

        Path sshFile = project.resolve("scratchpad/.ssh/config");
        Files.createDirectories(sshFile.getParent());
        Files.writeString(sshFile, "Host example");
        assertThat(security.checkWritePermission(
                sshFile.toString(), project.toString())
                .needsConfirmation()).isTrue();
    }

    @Test
    void systemScratchpadRelaxesOrdinaryFilesButNotSensitiveDescendants()
            throws Exception {
        Path project = Files.createDirectory(
                temp.resolve("system-project")).toRealPath();
        Path systemScratchpad = Files.createDirectories(
                temp.resolve("state/.zhikun/scratchpad")).toRealPath();
        PathSecurityService security = securityWithSystemRoot(
                systemScratchpad);

        Path ordinary = Files.writeString(
                systemScratchpad.resolve("notes.txt"), "notes");
        PathSecurityService.PathCheckResult read =
                security.checkAuthorizedReadPermission(
                        ordinary.toString(), project.toString());
        assertThat(read.isAllowed()).isTrue();
        assertThat(read.needsConfirmation()).isFalse();
        assertOrdinaryWrite(security.checkAuthorizedWritePermission(
                ordinary.toString(), project.toString()));

        Path env = Files.writeString(
                systemScratchpad.resolve(".env.local"),
                "TOKEN=secret");
        assertThat(security.checkAuthorizedReadPermission(
                env.toString(), project.toString())
                .needsConfirmation()).isTrue();
        assertThat(security.checkAuthorizedWritePermission(
                env.toString(), project.toString())
                .needsConfirmation()).isTrue();

        Path gitConfig = Files.writeString(
                Files.createDirectories(systemScratchpad.resolve(".git"))
                        .resolve("config"),
                "config");
        assertThat(security.checkAuthorizedReadPermission(
                gitConfig.toString(), project.toString())
                .needsConfirmation()).isTrue();
        assertThat(security.checkAuthorizedWritePermission(
                gitConfig.toString(), project.toString())
                .needsConfirmation()).isTrue();

        Path lookalike = temp.resolve(
                "state/.zhikun/scratchpad-evil/file.txt");
        Files.createDirectories(lookalike.getParent());
        Files.writeString(lookalike, "data");
        assertThat(security.checkAuthorizedWritePermission(
                lookalike.toString(), project.toString())
                .needsConfirmation()).isTrue();
    }

    @Test
    void scratchpadSymlinkEscapeIsNotTreatedAsTheTrustedTarget()
            throws Exception {
        Path project = Files.createDirectory(
                temp.resolve("symlink-project")).toRealPath();
        Path projectScratchpad = Files.createDirectories(
                project.resolve(".zhikun/scratchpad"));
        Path systemScratchpad = Files.createDirectories(
                temp.resolve("symlink-state/.zhikun/scratchpad"));
        Path external = Files.writeString(
                temp.resolve("external.txt"), "external").toRealPath();
        Path projectLink = Files.createSymbolicLink(
                projectScratchpad.resolve("project-link"), external);
        Path systemLink = Files.createSymbolicLink(
                systemScratchpad.resolve("system-link"), external);
        PathSecurityService security = securityWithSystemRoot(
                systemScratchpad);

        assertThat(security.checkWritePermission(
                projectLink.toString(), project.toString())
                .isAllowed()).isFalse();
        assertThat(security.inspectAuthorizedExecutionWritePermission(
                projectLink.toString(), project.toString())
                .permission().isAllowed()).isFalse();
        assertThat(security.inspectAuthorizedExecutionWritePermission(
                systemLink.toString(), project.toString())
                .permission().isAllowed()).isFalse();
    }

    private PathSecurityService securityWithSystemRoot(Path root) {
        return new PathSecurityService(
                new SystemScratchpadPathPolicy(root));
    }

    private static void assertOrdinaryWrite(
            PathSecurityService.PathCheckResult result) {
        assertThat(result.isAllowed()).isTrue();
        assertThat(result.needsConfirmation()).isFalse();
    }
}
