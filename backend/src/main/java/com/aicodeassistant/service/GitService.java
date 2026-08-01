package com.aicodeassistant.service;

import com.aicodeassistant.authorization.WorkspaceIdentityService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.util.Optional;
import java.util.concurrent.TimeUnit;

/**
 * Git 服务 — 获取 Git 仓库状态。
 * <p>
 * 用于系统提示词中注入当前 Git 状态信息。
 *
 */
@Service
public class GitService {

    private static final Logger log = LoggerFactory.getLogger(GitService.class);
    private final WorkspaceIdentityService workspaceIdentities;

    public GitService() {
        this(new WorkspaceIdentityService());
    }

    @Autowired
    public GitService(WorkspaceIdentityService workspaceIdentities) {
        this.workspaceIdentities = workspaceIdentities;
    }

    /**
     * 获取当前工作目录的 Git 状态摘要。
     *
     * @return Git 状态描述，如 "main (clean)" 或 "feature-branch (+3/-1)"
     */
    public String getGitStatus() {
        return getGitStatus(Path.of(System.getProperty("user.dir")));
    }

    /**
     * 获取指定目录的 Git 状态摘要。
     *
     * @param workingDir 工作目录
     * @return Git 状态描述
     */
    public String getGitStatus(Path workingDir) {
        try {
            String branch = execGit(workingDir, "rev-parse", "--abbrev-ref", "HEAD");
            if (branch == null || branch.isBlank()) {
                return "(not a git repository)";
            }

            String status = execGit(workingDir, "status", "--porcelain");
            if (status == null || status.isBlank()) {
                return branch + " (clean)";
            }

            int added = 0, modified = 0, deleted = 0;
            for (String line : status.split("\n")) {
                if (line.length() >= 2) {
                    char index = line.charAt(0);
                    char worktree = line.charAt(1);
                    if (index == 'A' || worktree == 'A') added++;
                    if (index == 'M' || worktree == 'M') modified++;
                    if (index == 'D' || worktree == 'D') deleted++;
                }
            }

            StringBuilder sb = new StringBuilder(branch);
            sb.append(" (");
            if (added > 0) sb.append("+").append(added);
            if (modified > 0) sb.append("~").append(modified);
            if (deleted > 0) sb.append("-").append(deleted);
            if (added == 0 && modified == 0 && deleted == 0) sb.append("staged");
            sb.append(")");
            return sb.toString();

        } catch (Exception e) {
            log.debug("Failed to get git status: {}", e.getMessage());
            return "(unknown)";
        }
    }

    /** 检查指定目录本身是否为 Git worktree 根。不会向父目录搜索。 */
    public boolean isGitRepository(Path dir) {
        return findRepositoryRoot(dir).isPresent();
    }

    /**
     * Returns {@code dir} only when it is itself a validated worktree root.
     * Deliberately never searches ancestors of the selected Project.
     */
    public Optional<Path> findRepositoryRoot(Path dir) {
        if (dir == null) return Optional.empty();
        try {
            Path canonicalDir = dir.toAbsolutePath().normalize().toRealPath();
            if (!Files.isDirectory(canonicalDir)) return Optional.empty();
            if (!Files.exists(canonicalDir.resolve(".git"),
                    LinkOption.NOFOLLOW_LINKS)) return Optional.empty();
            // The shared validator also requires Git's --show-toplevel to be
            // this exact canonical directory and validates worktree metadata.
            return workspaceIdentities.isValidatedGitRepositoryRoot(canonicalDir)
                    ? Optional.of(canonicalDir) : Optional.empty();
        } catch (Exception unavailable) {
            return Optional.empty();
        }
    }

    /** True only when the authorized directory is exactly a Git worktree root. */
    public boolean isGitRepositoryRoot(Path dir) {
        if (dir == null) return false;
        try {
            Path canonicalDir = dir.toAbsolutePath().normalize().toRealPath();
            return findRepositoryRoot(canonicalDir)
                    .filter(canonicalDir::equals)
                    .isPresent();
        } catch (Exception unavailable) {
            return false;
        }
    }

    /**
     * 执行 Git 命令并返回输出（公开方法，供 Command 调用）。
     *
     * @param workingDir 工作目录
     * @param args       Git 命令参数
     * @return 命令输出，失败返回 null
     */
    public String execGitPublic(Path workingDir, String... args) {
        return execGit(workingDir, args);
    }

    private String execGit(Path workingDir, String... args) {
        try {
            String[] command = new String[args.length + 1];
            command[0] = "git";
            System.arraycopy(args, 0, command, 1, args.length);

            ProcessBuilder pb = new ProcessBuilder(command);
            pb.directory(workingDir.toFile());
            pb.redirectErrorStream(true);

            Process process = pb.start();
            boolean finished = process.waitFor(5, TimeUnit.SECONDS);
            if (!finished) {
                process.destroyForcibly();
                return null;
            }

            if (process.exitValue() != 0) {
                return null;
            }

            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(process.getInputStream()))) {
                StringBuilder output = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    if (!output.isEmpty()) output.append("\n");
                    output.append(line);
                }
                return output.toString().trim();
            }
        } catch (Exception e) {
            return null;
        }
    }
}
