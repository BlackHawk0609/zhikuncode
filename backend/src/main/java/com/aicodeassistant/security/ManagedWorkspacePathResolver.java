package com.aicodeassistant.security;

import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.FileAlreadyExistsException;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/** Canonicalizes prospective workspace targets and safely materializes missing parent directories. */
@Component
public class ManagedWorkspacePathResolver {
    private static final LinkOption[] NO_FOLLOW = { LinkOption.NOFOLLOW_LINKS };

    public Path resolveProspective(Path raw, String workspaceRoot) throws IOException {
        return resolveProspective(raw, workspaceRoot, false, false);
    }

    /**
     * Resolves a target for a file tool that has already passed the
     * authorization gateway. The ordinary resolver remains Project-bound for
     * controllers and internal services that do not have an interaction grant.
     */
    public Path resolveAuthorizedProspective(
            Path raw, String workspaceRoot) throws IOException {
        return resolveProspective(raw, workspaceRoot, true, false);
    }

    /** Resolves the canonical path already bound by the authorization gateway. */
    public Path resolveAuthorizedExecutionProspective(
            Path raw, String workspaceRoot) throws IOException {
        return resolveProspective(raw, workspaceRoot, true, true);
    }

    private Path resolveProspective(
            Path raw, String workspaceRoot,
            boolean allowExternal,
            boolean requireBoundTarget) throws IOException {
        Path lexicalRoot = Path.of(workspaceRoot).toAbsolutePath().normalize();
        Path root = lexicalRoot.toRealPath();
        if (!root.equals(lexicalRoot))
            throw new IOException("workspace path changed");
        Path candidate;
        if (raw.isAbsolute()) {
            Path lexicalCandidate = raw.toAbsolutePath().normalize();
            candidate = lexicalCandidate.startsWith(lexicalRoot)
                    ? root.resolve(lexicalRoot.relativize(lexicalCandidate)).normalize()
                    : lexicalCandidate;
        } else candidate = root.resolve(raw).normalize();
        if (allowExternal) {
            Path authorizedTarget = candidate.toAbsolutePath().normalize();
            candidate = canonicalizeParent(candidate);
            if (requireBoundTarget && !candidate.equals(authorizedTarget)) {
                throw new IOException(
                        "authorized target path changed");
            }
        }
        if (candidate.equals(root))
            throw new IllegalArgumentException("target is the workspace root itself");
        if (!candidate.startsWith(root) && !allowExternal)
            throw new IllegalArgumentException("target escapes workspace");
        if (candidate.startsWith(root)) {
            validateExistingSegments(root, candidate);
        } else {
            validateExternalExistingSegments(candidate);
        }
        return candidate;
    }

    private Path canonicalizeParent(Path candidate) throws IOException {
        Path parent = candidate.getParent();
        Path name = candidate.getFileName();
        if (parent == null || name == null) return candidate;
        Path existing = parent;
        List<Path> missing = new ArrayList<>();
        while (existing != null
                && !Files.exists(existing, NO_FOLLOW)) {
            Path segment = existing.getFileName();
            if (segment != null) missing.add(segment);
            existing = existing.getParent();
        }
        if (existing == null) return candidate;
        Path canonicalParent = existing.toRealPath();
        for (int index = missing.size() - 1; index >= 0; index--) {
            canonicalParent = canonicalParent.resolve(missing.get(index));
        }
        return canonicalParent.resolve(name).toAbsolutePath().normalize();
    }

    public MaterializedTarget materializeParents(Path prospective, String workspaceRoot) throws IOException {
        return materializeParents(prospective, workspaceRoot, false, false);
    }

    public MaterializedTarget materializeAuthorizedParents(
            Path prospective, String workspaceRoot) throws IOException {
        return materializeParents(prospective, workspaceRoot, true, true);
    }

    private MaterializedTarget materializeParents(
            Path prospective, String workspaceRoot,
            boolean allowExternal,
            boolean requireBoundTarget) throws IOException {
        Path root = root(workspaceRoot);
        Path candidate = resolveProspective(
                prospective, workspaceRoot, allowExternal,
                requireBoundTarget);
        Path parent = candidate.getParent();
        if (parent == null) throw new IllegalArgumentException("target parent is required");
        List<Path> created = new ArrayList<>();
        if (candidate.startsWith(root)) {
            Path current = root;
            for (Path segment : root.relativize(parent)) {
                current = current.resolve(segment);
                if (!Files.exists(current, NO_FOLLOW)) {
                    try {
                        Files.createDirectory(current);
                        created.add(current);
                    } catch (FileAlreadyExistsException raced) {
                        // Validate the winner below.
                    }
                }
                assertRealDirectory(root, current);
            }
            validateExistingSegments(root, candidate);
        } else {
            materializeExternalParents(parent, created);
            validateExternalExistingSegments(candidate);
        }
        return new MaterializedTarget(candidate, List.copyOf(created));
    }

    public void assertUnchanged(Path candidate, String workspaceRoot) throws IOException {
        assertUnchanged(candidate, workspaceRoot, false);
    }

    public void assertAuthorizedUnchanged(
            Path candidate, String workspaceRoot) throws IOException {
        assertUnchanged(candidate, workspaceRoot, true);
    }

    private void assertUnchanged(
            Path candidate, String workspaceRoot,
            boolean allowExternal) throws IOException {
        Path resolved = resolveProspective(
                candidate, workspaceRoot, allowExternal,
                allowExternal);
        if (!resolved.equals(candidate.toAbsolutePath().normalize()))
            throw new IOException("target path changed during write");
        Path parent = candidate.getParent();
        if (parent == null || !Files.isDirectory(parent, NO_FOLLOW))
            throw new IOException("target parent is not a real directory");
        Path root = root(workspaceRoot);
        if (candidate.startsWith(root)) {
            assertRealDirectory(root, parent);
        } else {
            validateExternalExistingSegments(candidate);
        }
    }

    public void cleanupEmptyDirectories(List<Path> createdDirectories) {
        List<Path> reversed = new ArrayList<>(createdDirectories);
        Collections.reverse(reversed);
        for (Path directory : reversed) {
            try { Files.delete(directory); }
            catch (IOException ignored) { break; }
        }
    }

    private void validateExistingSegments(Path root, Path candidate) throws IOException {
        Path current = root;
        Path parent = candidate.getParent();
        if (parent != null) {
            for (Path segment : root.relativize(parent)) {
                current = current.resolve(segment);
                if (!Files.exists(current, NO_FOLLOW)) break;
                assertRealDirectory(root, current);
            }
        }
        if (Files.exists(candidate, NO_FOLLOW) && Files.isSymbolicLink(candidate))
            throw new IllegalArgumentException("symbolic-link targets are not writable");
    }

    private void validateExternalExistingSegments(Path candidate)
            throws IOException {
        Path filesystemRoot = candidate.getRoot();
        if (filesystemRoot == null) {
            throw new IllegalArgumentException(
                    "external target must be absolute");
        }
        Path parent = candidate.getParent();
        Path current = filesystemRoot;
        if (parent != null) {
            for (Path segment : filesystemRoot.relativize(parent)) {
                current = current.resolve(segment);
                if (!Files.exists(current, NO_FOLLOW)) break;
                assertExternalDirectory(current);
            }
        }
        if (Files.exists(candidate, NO_FOLLOW)
                && Files.isSymbolicLink(candidate)) {
            throw new IllegalArgumentException(
                    "symbolic-link targets are not writable");
        }
    }

    private void materializeExternalParents(
            Path parent, List<Path> created) throws IOException {
        Path filesystemRoot = parent.getRoot();
        if (filesystemRoot == null) {
            throw new IllegalArgumentException(
                    "external target must be absolute");
        }
        Path current = filesystemRoot;
        for (Path segment : filesystemRoot.relativize(parent)) {
            current = current.resolve(segment);
            if (!Files.exists(current, NO_FOLLOW)) {
                try {
                    Files.createDirectory(current);
                    created.add(current);
                } catch (FileAlreadyExistsException raced) {
                    // Validate the winner below.
                }
            }
            assertExternalDirectory(current);
        }
    }

    private static void assertExternalDirectory(Path directory)
            throws IOException {
        if (Files.isSymbolicLink(directory)
                || !Files.isDirectory(directory, NO_FOLLOW)) {
            throw new IllegalArgumentException(
                    "path segment is not a real directory: " + directory);
        }
    }

    private static void assertRealDirectory(Path root, Path directory) throws IOException {
        if (Files.isSymbolicLink(directory) || !Files.isDirectory(directory, NO_FOLLOW))
            throw new IllegalArgumentException("path segment is not a real directory: " + directory);
        Path real = directory.toRealPath();
        if (!real.startsWith(root)) throw new IllegalArgumentException("path segment escapes workspace");
    }

    private static Path root(String workspaceRoot) throws IOException {
        if (workspaceRoot == null || workspaceRoot.isBlank())
            throw new IllegalArgumentException("working directory is required");
        Path saved = Path.of(workspaceRoot).toAbsolutePath().normalize();
        Path current = saved.toRealPath();
        if (!current.equals(saved))
            throw new IOException("workspace path changed");
        return current;
    }

    public record MaterializedTarget(Path path, List<Path> createdDirectories) { }
}
