package com.aicodeassistant.authorization;

import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HexFormat;
import java.util.List;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.FutureTask;
import java.util.concurrent.TimeUnit;

/**
 * 规范授权根目录和稳定工作区身份的唯一解析权威。
 * 资源边界始终是当前 worktree 根目录；关联 Git worktree 只通过共同 Git 目录共享 workspaceKey。
 */
@Component
public final class WorkspaceIdentityService {
    private static final Duration GIT_TIMEOUT = Duration.ofSeconds(5);
    private static final int MAX_GIT_OUTPUT_BYTES = 1024 * 1024;

    public record Identity(Path authorizationRoot, String workspaceKey) { }

    public Identity resolve(Path configuredRoot) {
        if (configuredRoot == null) {
            throw invalid("Workspace root is missing", null);
        }
        try {
            Path absolute = configuredRoot.toAbsolutePath().normalize();
            if (!Files.isDirectory(absolute, LinkOption.NOFOLLOW_LINKS)) {
                throw invalid("Workspace root must be an existing directory", null);
            }
            Path root = absolute.toRealPath();
            Path identityPath;
            try {
                identityPath = gitCommonDirectory(root);
            } catch (IOException unsafeGitMetadata) {
                // A malformed or unregistered .git indirection must disable
                // repository-level capabilities, but it must not make an
                // otherwise valid selected folder unusable for ordinary file
                // operations. Falling back to the folder identity prevents
                // the external Git metadata from becoming an authorization
                // boundary or a shared grant scope.
                identityPath = root;
            }
            return new Identity(root, hash("workspace-v2\0" + identityPath));
        } catch (AuthorizationException denied) {
            throw denied;
        } catch (Exception failure) {
            throw invalid("Workspace root cannot be canonicalized", failure);
        }
    }

    /**
     * Verifies that {@code configuredRoot} is a real Git worktree root whose
     * metadata indirection is safe. External Git metadata is accepted only for
     * a worktree that Git itself lists at this exact canonical path.
     */
    public boolean isValidatedGitRepositoryRoot(Path configuredRoot) {
        if (configuredRoot == null) return false;
        try {
            Path root = configuredRoot.toAbsolutePath().normalize().toRealPath();
            if (!Files.isDirectory(root, LinkOption.NOFOLLOW_LINKS)
                    || !Files.exists(root.resolve(".git"), LinkOption.NOFOLLOW_LINKS)) {
                return false;
            }
            gitCommonDirectory(root);
            return root.equals(resolveGitPath(root,
                    runGit(root, "rev-parse", "--show-toplevel")));
        } catch (Exception invalid) {
            return false;
        }
    }

    private Path gitCommonDirectory(Path root) throws IOException {
        Path marker = root.resolve(".git");
        if (!Files.exists(marker, LinkOption.NOFOLLOW_LINKS)) return root;

        Path gitDirectory;
        if (Files.isDirectory(marker, LinkOption.NOFOLLOW_LINKS)) {
            gitDirectory = marker.toRealPath();
        } else if (Files.isRegularFile(marker, LinkOption.NOFOLLOW_LINKS)
                && !Files.isSymbolicLink(marker)) {
            String line = readMarker(marker);
            if (!line.startsWith("gitdir:")) {
                throw new IOException("Invalid .git indirection file");
            }
            String raw = line.substring("gitdir:".length()).strip();
            if (raw.isEmpty()) throw new IOException("Empty gitdir target");
            Path target = Path.of(raw);
            gitDirectory = (target.isAbsolute() ? target : root.resolve(target)).normalize().toRealPath();
        } else {
            throw new IOException("Unsafe .git marker");
        }
        if (!Files.isDirectory(gitDirectory, LinkOption.NOFOLLOW_LINKS)) {
            throw new IOException("Git directory is not a directory");
        }

        Path commonMarker = gitDirectory.resolve("commondir");
        Path commonDirectory = gitDirectory;
        if (Files.exists(commonMarker, LinkOption.NOFOLLOW_LINKS)) {
            if (!Files.isRegularFile(commonMarker, LinkOption.NOFOLLOW_LINKS)
                    || Files.isSymbolicLink(commonMarker)) {
                throw new IOException("Unsafe Git commondir marker");
            }
            String raw = readMarker(commonMarker);
            if (raw.isEmpty()) throw new IOException("Empty Git commondir");
            Path common = Path.of(raw);
            commonDirectory = (common.isAbsolute()
                    ? common : gitDirectory.resolve(common)).normalize().toRealPath();
        }
        if (!Files.isDirectory(commonDirectory, LinkOption.NOFOLLOW_LINKS)) {
            throw new IOException("Git common directory is not a directory");
        }

        boolean externalMetadata = !gitDirectory.startsWith(root)
                || !commonDirectory.startsWith(root);
        if (externalMetadata) {
            validateRegisteredWorktree(root, gitDirectory, commonDirectory);
        }
        return commonDirectory;
    }

    private void validateRegisteredWorktree(
            Path root, Path gitDirectory, Path commonDirectory) throws IOException {
        Path reportedGitDirectory = resolveGitPath(root,
                runGit(root, "rev-parse", "--absolute-git-dir"));
        Path reportedCommonDirectory = resolveGitPath(root,
                runGit(root, "rev-parse", "--git-common-dir"));
        if (!reportedGitDirectory.equals(gitDirectory)
                || !reportedCommonDirectory.equals(commonDirectory)) {
            throw new IOException("Git metadata indirection does not match Git");
        }

        String listing = runGit(root, "worktree", "list", "--porcelain");
        boolean registered = listing.lines()
                .filter(line -> line.startsWith("worktree "))
                .map(line -> line.substring("worktree ".length()))
                .anyMatch(value -> isSameCanonicalPath(root, value));
        if (!registered) {
            throw new IOException("External Git metadata is not registered for this worktree");
        }
    }

    private static boolean isSameCanonicalPath(Path expected, String candidate) {
        try {
            return expected.equals(Path.of(candidate).toRealPath());
        } catch (Exception invalid) {
            return false;
        }
    }

    private static Path resolveGitPath(Path root, String value) throws IOException {
        if (value == null || value.isBlank()) {
            throw new IOException("Git returned an empty path");
        }
        Path path = Path.of(value.strip());
        return (path.isAbsolute() ? path : root.resolve(path)).normalize().toRealPath();
    }

    private static String readMarker(Path marker) throws IOException {
        long size = Files.size(marker);
        if (size <= 0 || size > 4096) {
            throw new IOException("Git marker has an invalid size");
        }
        return Files.readString(marker, StandardCharsets.UTF_8).strip();
    }

    private static String runGit(Path root, String... arguments) throws IOException {
        List<String> command = new ArrayList<>(arguments.length + 1);
        command.add("git");
        command.addAll(Arrays.asList(arguments));

        Process process = new ProcessBuilder(command)
                .directory(root.toFile())
                .redirectErrorStream(true)
                .start();
        FutureTask<byte[]> output = new FutureTask<>(() ->
                process.getInputStream().readNBytes(MAX_GIT_OUTPUT_BYTES + 1));
        Thread.ofVirtual().name("workspace-git-validation").start(output);
        try {
            if (!process.waitFor(GIT_TIMEOUT.toMillis(), TimeUnit.MILLISECONDS)) {
                process.destroyForcibly();
                throw new IOException("Git validation timed out");
            }
            byte[] bytes = output.get(1, TimeUnit.SECONDS);
            if (bytes.length > MAX_GIT_OUTPUT_BYTES) {
                throw new IOException("Git validation output is too large");
            }
            String result = new String(bytes, StandardCharsets.UTF_8).strip();
            if (process.exitValue() != 0) {
                throw new IOException("Git validation failed");
            }
            return result;
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            process.destroyForcibly();
            throw new IOException("Git validation was interrupted", interrupted);
        } catch (ExecutionException | java.util.concurrent.TimeoutException failure) {
            process.destroyForcibly();
            throw new IOException("Failed to read Git validation output", failure);
        } finally {
            if (process.isAlive()) process.destroyForcibly();
        }
    }

    private static AuthorizationException invalid(String message, Throwable cause) {
        return cause == null
                ? new AuthorizationException("AUTHORIZATION_WORKSPACE_INVALID", message)
                : new AuthorizationException("AUTHORIZATION_WORKSPACE_INVALID", message, cause);
    }

    private static String hash(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception impossible) {
            throw new IllegalStateException(impossible);
        }
    }
}
