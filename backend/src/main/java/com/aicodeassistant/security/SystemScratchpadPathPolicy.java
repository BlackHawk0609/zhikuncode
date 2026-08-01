package com.aicodeassistant.security;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

/**
 * Resolves the server-owned scratchpad root used by coordinator and swarm runs.
 *
 * <p>The configured path is resolved through its nearest existing ancestor once
 * at construction time. Every subsequent access repeats that resolution and
 * fails closed if a symlink rebound changes the effective root.</p>
 */
@Component
public class SystemScratchpadPathPolicy {

    private final Path configuredRoot;
    private final Path canonicalRoot;

    @Autowired
    public SystemScratchpadPathPolicy(
            @Value("${zhikuncode.scratchpad.system-root:${app.working-dir:${user.dir}}/.zhikun/scratchpad}")
            String configuredRoot) {
        this(pathFromConfig(configuredRoot));
    }

    /** Test and non-Spring construction with an explicit server-owned root. */
    public SystemScratchpadPathPolicy(Path configuredRoot) {
        if (configuredRoot == null) {
            throw new IllegalArgumentException("System scratchpad root is required");
        }
        this.configuredRoot = configuredRoot.toAbsolutePath().normalize();
        this.canonicalRoot = resolveThroughExistingAncestor(this.configuredRoot);
        if (Files.exists(this.configuredRoot)
                && !Files.isDirectory(this.configuredRoot)) {
            throw new IllegalArgumentException(
                    "System scratchpad root is not a directory: " + this.configuredRoot);
        }
    }

    /**
     * Backwards-compatible policy for direct unit construction outside Spring.
     */
    public static SystemScratchpadPathPolicy defaultPolicy() {
        String workingDirectory = System.getProperty("app.working-dir");
        if (workingDirectory == null || workingDirectory.isBlank()) {
            workingDirectory = System.getProperty("user.dir");
        }
        if (workingDirectory == null || workingDirectory.isBlank()) {
            workingDirectory = ".";
        }
        return new SystemScratchpadPathPolicy(
                Path.of(workingDirectory, ".zhikun", "scratchpad"));
    }

    /** Returns the fixed canonical root, provided its configured identity is stable. */
    public Path systemRoot() {
        requireStableRoot();
        return canonicalRoot;
    }

    /**
     * Returns whether the current target is the scratchpad root or one of its
     * descendants. Existing symlinks in the target are resolved before the
     * containment check.
     */
    public boolean contains(Path target) {
        if (target == null || !isRootStable()) {
            return false;
        }
        try {
            Path canonicalTarget = resolveThroughExistingAncestor(
                    target.toAbsolutePath().normalize());
            return canonicalTarget.startsWith(canonicalRoot) && isRootStable();
        } catch (RuntimeException invalidPath) {
            return false;
        }
    }

    /**
     * Resolves one direct child below the system scratchpad root.
     * Absolute paths, separators and traversal components are rejected.
     */
    public Path resolveChild(String child) {
        if (child == null || child.isBlank()
                || child.indexOf('/') >= 0 || child.indexOf('\\') >= 0) {
            throw new IllegalArgumentException("Scratchpad child must be one safe path segment");
        }
        Path relative;
        try {
            relative = Path.of(child);
        } catch (RuntimeException invalidPath) {
            throw new IllegalArgumentException("Invalid scratchpad child", invalidPath);
        }
        if (relative.isAbsolute() || relative.getNameCount() != 1
                || ".".equals(child) || "..".equals(child)) {
            throw new IllegalArgumentException("Scratchpad child must be one safe path segment");
        }

        Path root = systemRoot();
        Path candidate = root.resolve(relative).normalize();
        if (!candidate.startsWith(root)) {
            throw new SecurityException("Scratchpad child escapes the configured root");
        }
        Path canonicalCandidate = resolveThroughExistingAncestor(candidate);
        if (!canonicalCandidate.startsWith(root)) {
            throw new SecurityException("Scratchpad child resolves outside the configured root");
        }
        requireStableRoot();
        return canonicalCandidate;
    }

    private void requireStableRoot() {
        if (!isRootStable()) {
            throw new SecurityException("System scratchpad root changed after initialization");
        }
    }

    private boolean isRootStable() {
        try {
            return resolveThroughExistingAncestor(configuredRoot).equals(canonicalRoot);
        } catch (RuntimeException unresolved) {
            return false;
        }
    }

    private static Path pathFromConfig(String configuredRoot) {
        if (configuredRoot == null || configuredRoot.isBlank()) {
            throw new IllegalArgumentException("System scratchpad root is required");
        }
        return Path.of(configuredRoot);
    }

    private static Path resolveThroughExistingAncestor(Path candidate) {
        Path existing = candidate;
        List<Path> missing = new ArrayList<>();
        while (existing != null
                && !Files.exists(existing, LinkOption.NOFOLLOW_LINKS)) {
            Path name = existing.getFileName();
            if (name != null) {
                missing.add(name);
            }
            existing = existing.getParent();
        }
        if (existing == null) {
            throw new IllegalStateException(
                    "Cannot resolve an existing ancestor for system scratchpad root: "
                            + candidate);
        }
        try {
            Path resolved = existing.toRealPath();
            for (int index = missing.size() - 1; index >= 0; index--) {
                resolved = resolved.resolve(missing.get(index));
            }
            return resolved.toAbsolutePath().normalize();
        } catch (IOException unresolved) {
            throw new IllegalStateException(
                    "Cannot resolve system scratchpad path: " + candidate,
                    unresolved);
        }
    }
}
