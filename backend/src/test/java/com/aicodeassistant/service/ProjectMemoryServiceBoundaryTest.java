package com.aicodeassistant.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ProjectMemoryServiceBoundaryTest {

    @TempDir
    Path temp;

    private final ProjectMemoryService memory = new ProjectMemoryService();

    @Test
    void loadMemoryReadsOnlyFilesInSelectedProjectRoot() throws Exception {
        Path project = Files.createDirectory(temp.resolve("project")).toRealPath();
        Path selected = Files.createDirectory(project.resolve("selected")).toRealPath();
        Files.writeString(project.resolve("zhikun.md"), "parent-secret");
        Files.writeString(selected.resolve("zhikun.local.md"), "selected-memory");

        String loaded = memory.loadMemory(selected);

        assertThat(loaded).contains("selected-memory");
        assertThat(loaded).doesNotContain("parent-secret");
    }

    @Test
    void loadMemoryRejectsSymlinkEvenWhenTargetIsReadable() throws Exception {
        Path project = Files.createDirectory(temp.resolve("symlink-project")).toRealPath();
        Path outside = Files.writeString(temp.resolve("outside-memory.md"), "outside-secret")
                .toRealPath();
        Files.createSymbolicLink(project.resolve("zhikun.md"), outside);

        String loaded = memory.loadMemory(project);

        assertThat(loaded).isEmpty();
        assertThat(memory.hasMemory(project)).isFalse();
    }

    @Test
    void loadMemoryReadsAtMostOneHundredKiB() throws Exception {
        Path project = Files.createDirectory(temp.resolve("large-project")).toRealPath();
        String allowedPrefix = "A".repeat(100 * 1024);
        Files.writeString(project.resolve("zhikun.md"),
                allowedPrefix + "must-not-be-read", StandardCharsets.UTF_8);

        String loaded = memory.loadMemory(project);
        String content = loaded.substring(loaded.indexOf('\n') + 1);

        assertThat(content.getBytes(StandardCharsets.UTF_8)).hasSize(100 * 1024);
        assertThat(content).doesNotContain("must-not-be-read");
    }

    @Test
    void writeMemoryRejectsSymlinkToSensitiveProjectFile()
            throws Exception {
        Path project = Files.createDirectory(
                temp.resolve("write-symlink-project")).toRealPath();
        Path environment = Files.writeString(
                project.resolve(".env"), "TOKEN=keep-me");
        Files.createSymbolicLink(
                project.resolve("zhikun.md"), environment);

        assertThatThrownBy(() -> memory.writeMemory(
                project, "replacement", false))
                .isInstanceOf(java.io.IOException.class)
                .hasMessageContaining("symbolic link");
        assertThat(Files.readString(environment))
                .isEqualTo("TOKEN=keep-me");
        assertThat(memory.hasMemory(project)).isFalse();
    }

    @Test
    void writeMemoryRejectsDanglingSymlink() throws Exception {
        Path project = Files.createDirectory(
                temp.resolve("write-dangling-project")).toRealPath();
        Path missingTarget = project.resolve("missing-memory-target");
        Files.createSymbolicLink(
                project.resolve("zhikun.md"), missingTarget);

        assertThatThrownBy(() -> memory.writeMemory(
                project, "replacement", false))
                .isInstanceOf(java.io.IOException.class)
                .hasMessageContaining("symbolic link");
        assertThat(missingTarget).doesNotExist();
    }

    @Test
    void writeMemoryCreatesAndReplacesRegularMemoryFile()
            throws Exception {
        Path project = Files.createDirectory(
                temp.resolve("regular-write-project")).toRealPath();

        memory.writeMemory(project, "first", false);
        memory.writeMemory(project, "second", false);

        assertThat(Files.readString(project.resolve("zhikun.md")))
                .isEqualTo("second");
    }
}
