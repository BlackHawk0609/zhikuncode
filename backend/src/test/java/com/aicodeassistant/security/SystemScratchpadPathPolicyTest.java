package com.aicodeassistant.security;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SystemScratchpadPathPolicyTest {

    @TempDir
    Path tempDir;

    @Test
    void resolvesOnlyTheExactRootAndItsDescendants() throws IOException {
        Path root = tempDir.resolve(".zhikun").resolve("scratchpad");
        SystemScratchpadPathPolicy policy = new SystemScratchpadPathPolicy(root);

        Path child = policy.resolveChild("session-1");
        Files.createDirectories(child);

        assertEquals(root.toRealPath(), policy.systemRoot());
        assertTrue(policy.contains(root));
        assertTrue(policy.contains(child.resolve("result.txt")));
        assertFalse(policy.contains(tempDir.resolve(".zhikun").resolve("scratchpad-evil")));
        assertFalse(policy.contains(tempDir.resolve("other").resolve("scratchpad")));
    }

    @Test
    void resolveChildRejectsTraversalAndSeparators() {
        SystemScratchpadPathPolicy policy = new SystemScratchpadPathPolicy(
                tempDir.resolve("scratchpad"));

        assertThrows(IllegalArgumentException.class,
                () -> policy.resolveChild(".."));
        assertThrows(IllegalArgumentException.class,
                () -> policy.resolveChild("../outside"));
        assertThrows(IllegalArgumentException.class,
                () -> policy.resolveChild("nested/child"));
        assertThrows(IllegalArgumentException.class,
                () -> policy.resolveChild("nested\\child"));
    }

    @Test
    void targetSymlinkEscapeIsNotContained() throws IOException {
        Path root = tempDir.resolve("scratchpad");
        Path outside = tempDir.resolve("outside");
        Files.createDirectories(root);
        Files.createDirectories(outside);
        Files.createSymbolicLink(root.resolve("escape"), outside);
        SystemScratchpadPathPolicy policy = new SystemScratchpadPathPolicy(root);

        assertFalse(policy.contains(root.resolve("escape").resolve("secret.txt")));
        assertThrows(SecurityException.class,
                () -> policy.resolveChild("escape"));
    }

    @Test
    void configuredRootSymlinkReboundFailsClosed() throws IOException {
        Path first = tempDir.resolve("first");
        Path second = tempDir.resolve("second");
        Path link = tempDir.resolve("configured-root");
        Files.createDirectories(first);
        Files.createDirectories(second);
        Files.createSymbolicLink(link, first);
        SystemScratchpadPathPolicy policy = new SystemScratchpadPathPolicy(link);

        assertTrue(policy.contains(first.resolve("before.txt")));
        Files.delete(link);
        Files.createSymbolicLink(link, second);

        assertFalse(policy.contains(first.resolve("after.txt")));
        assertFalse(policy.contains(second.resolve("after.txt")));
        assertThrows(SecurityException.class, policy::systemRoot);
        assertThrows(SecurityException.class,
                () -> policy.resolveChild("session-1"));
    }

    @Test
    void configuredAncestorSymlinkReboundFailsClosed() throws IOException {
        Path first = tempDir.resolve("ancestor-first");
        Path second = tempDir.resolve("ancestor-second");
        Path link = tempDir.resolve("configured-parent");
        Files.createDirectories(first);
        Files.createDirectories(second);
        Files.createSymbolicLink(link, first);
        SystemScratchpadPathPolicy policy = new SystemScratchpadPathPolicy(
                link.resolve(".zhikun").resolve("scratchpad"));

        assertTrue(policy.contains(
                first.resolve(".zhikun").resolve("scratchpad").resolve("before.txt")));
        Files.delete(link);
        Files.createSymbolicLink(link, second);

        assertFalse(policy.contains(
                first.resolve(".zhikun").resolve("scratchpad").resolve("after.txt")));
        assertFalse(policy.contains(
                second.resolve(".zhikun").resolve("scratchpad").resolve("after.txt")));
        assertThrows(SecurityException.class, policy::systemRoot);
    }
}
