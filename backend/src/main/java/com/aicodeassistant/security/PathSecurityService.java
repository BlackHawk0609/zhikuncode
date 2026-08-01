package com.aicodeassistant.security;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.InvalidPathException;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 统一路径安全验证服务
 * <p>
 * 供文件工具与统一 Authorization Gateway 共用，确保分析和执行前复检策略一致。
 * 硬编码敏感路径黑名单，不可通过配置修改（安全设计）。
 *
 * @see PathValidator
 */
@Service
public class PathSecurityService {

    private static final Logger log = LoggerFactory.getLogger(PathSecurityService.class);

    private final SystemScratchpadPathPolicy systemScratchpads;

    /** Standalone/test compatibility; Spring uses the injected constructor. */
    public PathSecurityService() {
        this(SystemScratchpadPathPolicy.defaultPolicy());
    }

    @Autowired
    public PathSecurityService(SystemScratchpadPathPolicy systemScratchpads) {
        this.systemScratchpads = Objects.requireNonNull(systemScratchpads);
    }

    // ===== Layer 1: 硬编码设备路径阻止 =====
    private static final Set<String> BLOCKED_DEVICE_PATHS = Set.of(
        "/dev/zero", "/dev/random", "/dev/urandom", "/dev/full",
        "/dev/stdin", "/dev/tty", "/dev/console",
        "/dev/stdout", "/dev/stderr",
        "/dev/fd/0", "/dev/fd/1", "/dev/fd/2",
        "/proc/self/fd/0", "/proc/self/fd/1", "/proc/self/fd/2"
    );

    // ===== Layer 2: 危险文件黑名单 =====
    private static final Set<String> DANGEROUS_FILES = Set.of(
        ".gitconfig", ".gitmodules",
        ".bashrc", ".bash_profile", ".bash_login", ".bash_logout",
        ".zshrc", ".zprofile", ".zshenv", ".zlogin",
        ".profile", ".login", ".ripgreprc",
        ".env", ".env.local", ".env.production",
        ".mcp.json", ".zhikun.json",
        ".npmrc", ".yarnrc",
        "id_rsa", "id_ed25519", "id_ecdsa",
        "known_hosts", "authorized_keys",
        ".pgpass", ".my.cnf",
        ".netrc", ".curlrc",
        "credentials", "token.json"
    );

    // ===== Layer 2: 危险目录黑名单 =====
    private static final Set<String> DANGEROUS_DIRECTORIES = Set.of(
        ".git", ".vscode", ".idea", ".zhikun", ".ai-code-assistant",
        ".ssh", ".gnupg", ".aws",
        ".config", ".local",
        ".kube", ".docker",
        "node_modules"
    );

    /**
     * Direct reads below these directories expose credentials or repository
     * control state and therefore always require a fresh approval. Keep this
     * narrower than {@link #DANGEROUS_DIRECTORIES}: dependency and IDE folders
     * are excluded from broad searches, but are not secrets by themselves.
     */
    private static final Set<String> SENSITIVE_READ_DIRECTORIES = Set.of(
        ".git", ".ssh", ".gnupg", ".aws", ".kube", ".docker",
        ".ai-code-assistant"
    );

    /** Direct writes to control/credential directories always require approval. */
    private static final Set<String> SENSITIVE_WRITE_DIRECTORIES = Set.of(
        ".git", ".vscode", ".idea", ".zhikun",
        ".ai-code-assistant", ".ssh", ".gnupg", ".aws",
        ".config", ".kube", ".docker"
    );

    /** Recursive traversal of these system roots is never a bounded file read. */
    private static final Set<String> BLOCKED_RECURSIVE_ROOTS = Set.of(
        "/", "/etc", "/private/etc", "/root", "/proc", "/sys", "/dev"
    );

    // ===== Layer 2.5: 系统关键目录 — 写入需确认（不硬拒绝） =====
    private static final List<String> SYSTEM_CRITICAL_DIRS = List.of(
        "/etc", "/private/etc", "/usr", "/bin", "/sbin", "/boot",
        "/var", "/private/var",
        "/lib", "/lib64", "/opt", "/root",
        "/sys", "/proc", "/System", "/Applications",
        "C:/Windows", "C:/Program Files", "C:/Program Files (x86)",
        "C:/ProgramData"
    );

    // ===== Layer 4: 危险删除目标路径 =====
    private static final Set<String> DANGEROUS_REMOVAL_TARGETS;
    static {
        Set<String> targets = new HashSet<>(Set.of(
            "/", "/*", "/etc", "/usr", "/var", "/bin", "/sbin",
            "/boot", "/lib", "/lib64", "/opt", "/root",
            "/System", "/Applications",
            "C:\\", "C:\\Windows", "C:\\Program Files"
        ));
        String home = System.getProperty("user.home");
        if (home != null) { targets.add(home); targets.add(home + "/*"); }
        DANGEROUS_REMOVAL_TARGETS = Collections.unmodifiableSet(targets);
    }

    // ==================== 读取权限检查 ====================

    /**
     * 验证读取路径安全性
     */
    public PathCheckResult checkReadPermission(String filePath, String workingDirectory) {
        return checkReadPermission(filePath, workingDirectory, false);
    }

    /**
     * File tools call this only after entering the authorization gateway. An
     * ordinary external path may proceed to the interaction/grant policy, while
     * device paths and sensitive paths retain their hard/high-risk treatment.
     */
    public PathCheckResult checkAuthorizedReadPermission(
            String filePath, String workingDirectory) {
        return checkReadPermission(filePath, workingDirectory, true);
    }

    /**
     * Execution-time check for the canonical path bound by the authorization
     * gateway. Unlike the classification method above, this rejects any path
     * that now resolves to a different target.
     */
    public PathCheckResult checkAuthorizedExecutionReadPermission(
            String filePath, String workingDirectory) {
        return inspectAuthorizedExecutionReadPermission(
                filePath, workingDirectory).permission();
    }

    /** Returns the exact canonical target inspected by the execution check. */
    public AuthorizedPathCheck inspectAuthorizedExecutionReadPermission(
            String filePath, String workingDirectory) {
        AuthorizedPathCheck target = inspectAuthorizedTarget(
                filePath, workingDirectory);
        if (!target.permission().isAllowed()) return target;
        return new AuthorizedPathCheck(
                target.target(),
                checkReadPermission(target.target(), filePath,
                        workingDirectory, true));
    }

    private PathCheckResult checkReadPermission(
            String filePath, String workingDirectory,
            boolean allowExternal) {
        if (isUncPath(filePath)) {
            return PathCheckResult.denied(
                    "UNC path access denied (NTLM credential leak prevention): "
                            + filePath);
        }
        Path resolved = resolvePath(filePath, workingDirectory);
        return checkReadPermission(
                resolved, filePath, workingDirectory,
                allowExternal);
    }

    private PathCheckResult checkReadPermission(
            Path resolved, String filePath,
            String workingDirectory,
            boolean allowExternal) {
        String resolvedStr = resolved.toString();
        Path lexicalPath;
        try {
            lexicalPath = absoluteNormalizedPath(
                    filePath, workingDirectory);
        } catch (RuntimeException invalidPath) {
            return PathCheckResult.denied(
                    "Invalid path: " + filePath);
        }

        // 1. 设备文件检查 — Layer 1
        if (BLOCKED_DEVICE_PATHS.contains(resolvedStr)) {
            return PathCheckResult.denied("Cannot read device file: " + resolved);
        }

        // 2. /proc 特殊文件检查
        if (resolvedStr.startsWith("/proc/") &&
            (resolvedStr.endsWith("/fd/0") || resolvedStr.endsWith("/fd/1") || resolvedStr.endsWith("/fd/2")
             || resolvedStr.endsWith("/environ"))) {
            return PathCheckResult.denied("Cannot read process special file: " + resolved);
        }

        if ((resolvedStr.equals("/proc")
                || resolvedStr.startsWith("/proc/"))
                && !SAFE_PROC_PATHS.contains(resolvedStr)) {
            return PathCheckResult.denied(
                    "Cannot read process special path: " + resolved);
        }
        if (resolvedStr.equals("/sys")
                || resolvedStr.startsWith("/sys/")
                || resolvedStr.equals("/dev")
                || resolvedStr.startsWith("/dev/")) {
            return PathCheckResult.denied(
                    "Cannot read device or kernel path: " + resolved);
        }

        // 3. 项目边界检查
        Path savedProjectRoot;
        Path projectRoot;
        try {
            savedProjectRoot = Path.of(workingDirectory)
                    .toAbsolutePath().normalize();
            projectRoot = savedProjectRoot.toRealPath();
        } catch (IOException | RuntimeException unavailable) {
            return PathCheckResult.denied(
                    "Access denied: project boundary is unavailable");
        }
        if (!projectRoot.equals(savedProjectRoot)) {
            return PathCheckResult.denied(
                    "Access denied: project boundary has changed");
        }
        boolean outsideProject = !resolved.startsWith(projectRoot);
        if (!allowExternal && outsideProject) {
            return PathCheckResult.denied(
                "Access denied: path '" + filePath + "' is outside project boundary. " +
                "Allowed: " + projectRoot);
        }

        // 4. 危险文件警告 — Layer 2
        String sensitiveFileName = protectedFileName(
                resolved, lexicalPath);
        if (sensitiveFileName != null) {
            return PathCheckResult.needsConfirmation(
                "Reading sensitive file: " + sensitiveFileName);
        }

        String sensitiveReadDirectory = matchingSensitiveDirectory(
                resolved, projectRoot, outsideProject,
                SENSITIVE_READ_DIRECTORIES);
        if (sensitiveReadDirectory == null
                && !lexicalPath.equals(resolved)) {
            sensitiveReadDirectory = matchingSensitiveDirectory(
                    lexicalPath, projectRoot,
                    !lexicalPath.startsWith(projectRoot),
                    SENSITIVE_READ_DIRECTORIES);
        }
        if (sensitiveReadDirectory != null) {
            return PathCheckResult.needsConfirmation(
                "Reading from sensitive directory: "
                        + sensitiveReadDirectory);
        }

        if (isSensitiveSystemOrUserPath(resolved)) {
            return PathCheckResult.needsConfirmation(
                    "Reading sensitive path: " + resolved);
        }

        return PathCheckResult.allowed();
    }

    /**
     * Checks the root of a recursive read operation such as Glob or Grep.
     * Protected descendants of an ordinary Project root are excluded by the
     * tools themselves; only choosing a protected directory (or a path inside
     * one) as the search root upgrades the operation to explicit confirmation.
     */
    public PathCheckResult checkRecursiveReadRootPermission(
            String rootPath, String workingDirectory) {
        return checkRecursiveReadRootPermission(
                rootPath, workingDirectory, false);
    }

    /** Authorization-gateway variant of recursive-root inspection. */
    public PathCheckResult checkAuthorizedRecursiveReadRootPermission(
            String rootPath, String workingDirectory) {
        return checkRecursiveReadRootPermission(
                rootPath, workingDirectory, true);
    }

    /** Execution-time recursive-read check for a gateway-bound canonical root. */
    public PathCheckResult checkAuthorizedExecutionRecursiveReadRootPermission(
            String rootPath, String workingDirectory) {
        return inspectAuthorizedExecutionRecursiveReadRootPermission(
                rootPath, workingDirectory).permission();
    }

    /** Returns the exact canonical root inspected by the execution check. */
    public AuthorizedPathCheck inspectAuthorizedExecutionRecursiveReadRootPermission(
            String rootPath, String workingDirectory) {
        AuthorizedPathCheck target = inspectAuthorizedTarget(
                rootPath, workingDirectory);
        if (!target.permission().isAllowed()) return target;
        return new AuthorizedPathCheck(
                target.target(),
                checkRecursiveReadRootPermission(
                        target.target(), rootPath,
                        workingDirectory, true));
    }

    private PathCheckResult checkRecursiveReadRootPermission(
            String rootPath, String workingDirectory,
            boolean allowExternal) {
        if (isUncPath(rootPath)) {
            return checkReadPermission(
                    rootPath, workingDirectory, allowExternal);
        }
        return checkRecursiveReadRootPermission(
                resolvePath(rootPath, workingDirectory), rootPath,
                workingDirectory, allowExternal);
    }

    private PathCheckResult checkRecursiveReadRootPermission(
            Path resolved, String rootPath,
            String workingDirectory,
            boolean allowExternal) {
        PathCheckResult readCheck = checkReadPermission(
                resolved, rootPath, workingDirectory,
                allowExternal);
        if (!readCheck.isAllowed() || readCheck.needsConfirmation()) {
            return readCheck;
        }

        String resolvedPath = resolved.toString();
        if (resolved.getParent() == null
                || isBlockedRecursiveRoot(resolvedPath)
                || resolvedPath.startsWith("/proc/")
                || resolvedPath.startsWith("/sys/")
                || resolvedPath.startsWith("/dev/")) {
            return PathCheckResult.denied(
                    "Recursive access to system root is denied: "
                            + resolved);
        }
        return readCheck;
    }

    // ==================== 写入权限检查 ====================

    /**
     * 验证写入路径安全性 — 比读取更严格。
     */
    public PathCheckResult checkWritePermission(String filePath, String workingDirectory) {
        return checkWritePermission(filePath, workingDirectory, false);
    }

    /** Authorization-gateway variant for a file write. */
    public PathCheckResult checkAuthorizedWritePermission(
            String filePath, String workingDirectory) {
        return checkWritePermission(filePath, workingDirectory, true);
    }

    /** Execution-time write check for a gateway-bound canonical target. */
    public PathCheckResult checkAuthorizedExecutionWritePermission(
            String filePath, String workingDirectory) {
        return inspectAuthorizedExecutionWritePermission(
                filePath, workingDirectory).permission();
    }

    /** Returns the exact canonical target inspected by the execution check. */
    public AuthorizedPathCheck inspectAuthorizedExecutionWritePermission(
            String filePath, String workingDirectory) {
        AuthorizedPathCheck target = inspectAuthorizedTarget(
                filePath, workingDirectory);
        if (!target.permission().isAllowed()) return target;
        return new AuthorizedPathCheck(
                target.target(),
                checkWritePermission(target.target(), filePath,
                        workingDirectory, true));
    }

    private PathCheckResult checkWritePermission(
            String filePath, String workingDirectory,
            boolean allowExternal) {
        if (isUncPath(filePath)) {
            return checkReadPermission(
                    filePath, workingDirectory, allowExternal);
        }
        Path resolved = resolvePath(filePath, workingDirectory);
        return checkWritePermission(
                resolved, filePath, workingDirectory,
                allowExternal);
    }

    private PathCheckResult checkWritePermission(
            Path resolved, String filePath,
            String workingDirectory,
            boolean allowExternal) {
        PathCheckResult readCheck = checkReadPermission(
                resolved, filePath, workingDirectory,
                allowExternal);
        if (!readCheck.isAllowed() && !readCheck.needsConfirmation()) {
            return readCheck;
        }

        // 5. 危险目录写入检查 — Layer 2
        Path projectRoot = Path.of(workingDirectory)
                .toAbsolutePath().normalize();
        boolean outsideProject = !resolved.startsWith(projectRoot);
        String sensitiveWriteDirectory = matchingSensitiveDirectory(
                resolved, projectRoot, outsideProject,
                SENSITIVE_WRITE_DIRECTORIES);
        Path lexicalPath = absoluteNormalizedPath(
                filePath, workingDirectory);
        if (sensitiveWriteDirectory == null
                && !lexicalPath.equals(resolved)) {
            sensitiveWriteDirectory = matchingSensitiveDirectory(
                    lexicalPath, projectRoot,
                    !lexicalPath.startsWith(projectRoot),
                    SENSITIVE_WRITE_DIRECTORIES);
        }
        if (sensitiveWriteDirectory != null) {
            return PathCheckResult.needsConfirmation(
                    "Writing to protected directory: "
                            + sensitiveWriteDirectory);
        }

        // 5.5 系统关键目录写入检查 — Layer 2.5
        String resolvedStr = resolved.toString();
        if (isSystemCriticalPath(resolvedStr)) {
            return PathCheckResult.needsConfirmation(
                    "Writing to system critical directory: " + resolved);
        }

        // 5.6 符号链接写入检查 — Layer 3
        try {
            if (Files.isSymbolicLink(resolved)) {
                Path realPath = resolved.toRealPath();
                String realStr = realPath.toString();
                if (BLOCKED_DEVICE_PATHS.contains(realStr)) {
                    return PathCheckResult.denied("Symlink targets device file: " + filePath + " -> " + realPath);
                }
                if (realPath.getFileName() != null
                        && isProtectedFileName(
                                realPath.getFileName().toString())) {
                    return PathCheckResult.needsConfirmation("Symlink targets sensitive file: " + filePath + " -> " + realPath);
                }
            }
        } catch (IOException e) {
            // 文件不存在，允许继续
        }

        // 5.7 Windows 路径绕过检测 — Layer 5
        PathCheckResult winCheck = checkWindowsBypass(filePath);
        if (winCheck != null) return winCheck;

        return readCheck;
    }

    // ==================== Layer 4: 危险删除检测 ====================

    /**
     * 检测 Bash 命令中的危险删除操作。
     *
     * @param command Bash 命令字符串
     * @return null=安全, 非 null=拒绝原因
     */
    public String checkDangerousRemoval(String command) {
        if (command == null) return null;
        Matcher m = Pattern.compile(
            "\\b(rm|rmdir)\\s+(?:-[a-zA-Z]{0,10}\\s+){0,5}(\\S+)").matcher(command);
        while (m.find()) {
            String target = m.group(2);
            if (target == null) continue;
            String resolved = resolvePathVariables(target);
            String normTarget = normalizePath(resolved);
            for (String dangerous : DANGEROUS_REMOVAL_TARGETS) {
                if (normTarget.equals(normalizePath(dangerous)))
                    return "Dangerous removal denied: " + command + " (target: " + normTarget + ")";
            }
            if ("*".equals(target) || ".".equals(target) || "..".equals(target))
                return "Wildcard removal denied: " + command;
        }
        return null;
    }

    // ==================== Layer 5: Windows 路径绕过检测 ====================

    private PathCheckResult checkWindowsBypass(String rawPath) {
        if (!isWindows()) return null;
        // NTFS Alternate Data Streams
        if (rawPath.matches(".*:[^/\\\\].*"))
            return PathCheckResult.denied("NTFS ADS path detected: " + rawPath);
        // 8.3 短文件名
        if (rawPath.matches(".*~\\d.*"))
            return PathCheckResult.denied("8.3 short filename detected: " + rawPath);
        // DOS 设备名
        Path p = Path.of(rawPath);
        if (p.getFileName() != null) {
            String upper = p.getFileName().toString().replaceAll("\\.[^.]*$", "").toUpperCase();
            if (Set.of("CON","PRN","AUX","NUL","COM1","COM2","COM3","COM4",
                    "COM5","COM6","COM7","COM8","COM9","LPT1","LPT2","LPT3",
                    "LPT4","LPT5","LPT6","LPT7","LPT8","LPT9").contains(upper))
                return PathCheckResult.denied("DOS device name detected: " + rawPath);
        }
        return null;
    }

    // ==================== 路径解析 ====================

    /**
     * 解析路径
     */
    public Path resolvePath(String filePath, String workingDirectory) {
        if (isUncPath(filePath)) {
            throw new IllegalArgumentException(
                    "UNC path access denied (NTLM credential leak prevention): "
                            + filePath);
        }
        Path resolved = absoluteNormalizedPath(filePath, workingDirectory);

        try {
            resolved = resolved.toRealPath();
        } catch (IOException e) {
            // Resolve an existing ancestor so a prospective target below a
            // directory symlink is classified by its actual destination.
            resolved = resolveThroughExistingAncestor(resolved);
        }
        return resolved;
    }

    private Path absoluteNormalizedPath(
            String filePath, String workingDirectory) {
        Path path = Path.of(filePath);
        return (path.isAbsolute()
                ? path
                : Path.of(workingDirectory).resolve(path))
                .toAbsolutePath().normalize();
    }

    private AuthorizedPathCheck inspectAuthorizedTarget(
            String filePath, String workingDirectory) {
        if (isUncPath(filePath)) {
            return new AuthorizedPathCheck(
                    null, PathCheckResult.denied(
                            "UNC path access denied (NTLM credential leak prevention): "
                                    + filePath));
        }
        Path authorizedTarget = absoluteNormalizedPath(
                filePath, workingDirectory);
        Path currentTarget = resolvePath(filePath, workingDirectory);
        if (!currentTarget.equals(authorizedTarget)) {
            return new AuthorizedPathCheck(
                    authorizedTarget, PathCheckResult.denied(
                            "Authorized file target changed before execution: "
                                    + authorizedTarget + " -> "
                                    + currentTarget));
        }
        return new AuthorizedPathCheck(
                currentTarget, PathCheckResult.allowed());
    }

    private Path resolveThroughExistingAncestor(Path candidate) {
        Path existing = candidate;
        List<Path> missing = new ArrayList<>();
        while (existing != null
                && !Files.exists(existing, LinkOption.NOFOLLOW_LINKS)) {
            Path name = existing.getFileName();
            if (name != null) missing.add(name);
            existing = existing.getParent();
        }
        if (existing == null) return candidate;
        try {
            Path resolved = existing.toRealPath();
            for (int index = missing.size() - 1; index >= 0; index--) {
                resolved = resolved.resolve(missing.get(index));
            }
            return resolved.toAbsolutePath().normalize();
        } catch (IOException unresolved) {
            return candidate;
        }
    }

    static boolean isSystemCriticalPath(String path) {
        String normalizedPath = normalizePolicyPath(path);
        // macOS maps /var to /private/var, but its per-user temporary and
        // cache trees are ordinary user storage rather than system state.
        if (normalizedPath.startsWith("/private/var/folders/")) {
            return false;
        }
        for (String directory : SYSTEM_CRITICAL_DIRS) {
            if (isSameOrDescendant(
                    normalizedPath, normalizePolicyPath(directory))) {
                return true;
            }
        }
        return false;
    }

    static boolean isBlockedRecursiveRoot(String path) {
        String normalizedPath = normalizePolicyPath(path);
        for (String root : BLOCKED_RECURSIVE_ROOTS) {
            if (pathsEqual(
                    normalizedPath, normalizePolicyPath(root))) {
                return true;
            }
        }
        return false;
    }

    private static boolean isSameOrDescendant(
            String path, String directory) {
        if (pathsEqual(path, directory)) return true;
        String prefix = directory.endsWith("/")
                ? directory : directory + "/";
        return isWindowsDrivePath(path) || isWindowsDrivePath(directory)
                ? path.toLowerCase(Locale.ROOT).startsWith(
                        prefix.toLowerCase(Locale.ROOT))
                : path.startsWith(prefix);
    }

    private static boolean pathsEqual(String first, String second) {
        return isWindowsDrivePath(first) || isWindowsDrivePath(second)
                ? first.equalsIgnoreCase(second)
                : first.equals(second);
    }

    private static boolean isWindowsDrivePath(String path) {
        return path.length() >= 3
                && Character.isLetter(path.charAt(0))
                && path.charAt(1) == ':'
                && path.charAt(2) == '/';
    }

    private static String normalizePolicyPath(String path) {
        if (path == null) return "";
        String normalized = path.replace('\\', '/');
        while (normalized.length() > 1 && normalized.endsWith("/")) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }
        return normalized;
    }

    private String matchingSensitiveDirectory(
            Path resolved, Path projectRoot,
            boolean outsideProject, Set<String> sensitiveDirectories) {
        Path pathToInspect = resolved;
        if (!outsideProject) {
            String rootName = projectRoot.getFileName() == null
                    ? "" : projectRoot.getFileName().toString();
            for (String directory : sensitiveDirectories) {
                if (!rootName.equalsIgnoreCase(directory)) {
                    continue;
                }
                if (directory.equalsIgnoreCase(".zhikun")
                        && isRelaxedScratchpadMarker(
                                resolved, projectRoot, false)) {
                    continue;
                }
                return directory;
            }
            pathToInspect = projectRoot.relativize(resolved);
        }
        for (String directory : sensitiveDirectories) {
            if (containsUnrelaxedSensitiveComponent(
                    pathToInspect, resolved, projectRoot,
                    outsideProject, directory)) {
                return directory;
            }
        }
        return null;
    }

    private boolean containsUnrelaxedSensitiveComponent(
            Path pathToInspect, Path resolved, Path projectRoot,
            boolean outsideProject, String sensitiveDirectory) {
        Path current = pathToInspect.isAbsolute()
                ? pathToInspect.getRoot() : projectRoot;
        for (Path component : pathToInspect) {
            current = current.resolve(component);
            if (!component.toString().equalsIgnoreCase(
                    sensitiveDirectory)) {
                continue;
            }
            if (sensitiveDirectory.equalsIgnoreCase(".zhikun")
                    && isRelaxedScratchpadMarker(
                            resolved, current, outsideProject)) {
                continue;
            }
            return true;
        }
        return false;
    }

    /**
     * Only the exact {@code .zhikun/scratchpad} marker is relaxed. Other
     * protected descendants (for example {@code .ssh}) are still inspected.
     */
    private boolean isRelaxedScratchpadMarker(
            Path resolved, Path marker, boolean outsideProject) {
        Path scratchpadRoot = marker.resolve("scratchpad");
        if (!outsideProject && resolved.startsWith(scratchpadRoot)) {
            return true;
        }
        if (!systemScratchpads.contains(resolved)) {
            return false;
        }
        Path configuredRoot = systemScratchpads.systemRoot();
        return configuredRoot.startsWith(
                resolveThroughExistingAncestor(scratchpadRoot));
    }

    private boolean isSensitiveSystemOrUserPath(Path path) {
        String resolved = path.toString();
        String systemPath = resolved.startsWith("/private/etc/")
                ? resolved.substring("/private".length()) : resolved;
        if (SENSITIVE_SYSTEM_FILES.contains(systemPath)
                || systemPath.startsWith("/etc/sudoers.d/")) {
            return true;
        }
        String home = System.getProperty("user.home", "/root");
        for (String userPath : SENSITIVE_USER_PATHS) {
            String expanded = userPath.replace("~", home);
            if (expanded.endsWith("/")) {
                if (resolved.startsWith(expanded)) return true;
            } else if (resolved.equals(expanded)) {
                return true;
            }
        }
        return false;
    }

    /** Exact basenames that recursive content readers must skip. */
    public Set<String> protectedFileNames() {
        return DANGEROUS_FILES;
    }

    /** Basename globs that recursive process-backed readers must exclude. */
    public Set<String> protectedFileGlobs() {
        Set<String> patterns = new TreeSet<>(DANGEROUS_FILES);
        patterns.add(".env*");
        return Collections.unmodifiableSet(patterns);
    }

    /** Case-insensitive exact/prefix policy shared by direct and recursive reads. */
    public boolean isProtectedFileName(String fileName) {
        if (fileName == null) return false;
        String normalized = fileName.toLowerCase(Locale.ROOT);
        return DANGEROUS_FILES.contains(normalized)
                || normalized.startsWith(".env");
    }

    private String protectedFileName(Path canonical, Path lexical) {
        for (Path candidate : List.of(canonical, lexical)) {
            if (candidate.getFileName() == null) continue;
            String fileName = candidate.getFileName().toString();
            if (isProtectedFileName(fileName)) {
                return fileName.toLowerCase(Locale.ROOT);
            }
        }
        return null;
    }

    /** Exact directory names that recursive content readers must skip. */
    public Set<String> protectedDirectoryNames() {
        return DANGEROUS_DIRECTORIES;
    }

    // ==================== 私有工具方法 ====================

    private String normalizePath(String path) {
        if (path == null) return "";
        try {
            return Path.of(path).normalize().toString().replace('\\', '/');
        } catch (InvalidPathException e) {
            return path.replace('\\', '/');
        }
    }

    private String resolvePathVariables(String path) {
        return path.replace("~", System.getProperty("user.home", "/root"))
                   .replace("$HOME", System.getProperty("user.home", "/root"));
    }

    private boolean isWindows() {
        return System.getProperty("os.name", "").toLowerCase().contains("win");
    }

    private boolean isUncPath(String path) {
        return path != null
                && (path.startsWith("//")
                || path.startsWith("\\\\"));
    }

    // ==================== Layer 8: 敏感系统文件读取检测 ====================

    /** 敏感系统文件黑名单 — 即使 BYPASS 模式也不允许通过 Bash 读取 */
    private static final Set<String> SENSITIVE_SYSTEM_FILES = Set.of(
        "/etc/shadow", "/etc/passwd", "/etc/sudoers", "/etc/sudoers.d",
        "/etc/master.passwd", "/etc/security/passwd"
    );

    /** 敏感用户文件前缀（~ 会在运行时展开） */
    private static final List<String> SENSITIVE_USER_PATHS = List.of(
        "~/.ssh/id_rsa", "~/.ssh/id_ed25519", "~/.ssh/id_ecdsa",
        "~/.ssh/id_dsa", "~/.ssh/config",
        "~/.aws/credentials", "~/.aws/config",
        "~/.gnupg/", "~/.kube/config",
        "~/.config/ai-code-assistant/keychain"
    );

    /** 敏感系统目录前缀 */
    private static final List<String> SENSITIVE_SYSTEM_DIRS = List.of(
        "/proc/", "/sys/"
    );

    /** 安全的 /proc 路径白名单 */
    private static final Set<String> SAFE_PROC_PATHS = Set.of(
        "/proc/self/cwd", "/proc/self/exe", "/proc/version",
        "/proc/cpuinfo", "/proc/meminfo", "/proc/loadavg",
        "/proc/uptime", "/proc/filesystems"
    );

    /** 读取类命令 */
    private static final Set<String> READ_COMMANDS = Set.of(
        "cat", "less", "more", "head", "tail", "grep", "egrep", "fgrep",
        "strings", "xxd", "od", "file", "stat", "wc", "awk", "sed",
        "tac", "nl", "sort", "uniq", "cut", "paste", "tr", "fold",
        "hexdump", "base64"
    );

    /**
     * 检测 Bash 命令中是否存在对敏感系统文件的读取操作。
     * <p>
     * 此检查应在 BYPASS 模式之前执行，确保不可绕过。
     *
     * @param command Bash 命令字符串
     * @return null=安全, 非 null=拒绝原因
     */
    public String checkSensitiveFileRead(String command) {
        if (command == null || command.isBlank()) return null;

        String home = System.getProperty("user.home", "/root");

        // 按管道和分号拆分子命令
        String[] subCommands = command.split("[|;&]");
        for (String sub : subCommands) {
            String trimmed = sub.trim();
            if (trimmed.isEmpty()) continue;

            String[] tokens = trimmed.split("\\s+");
            if (tokens.length == 0) continue;

            String cmd = tokens[0];
            // 去除路径前缀（如 /usr/bin/cat）
            int lastSlash = cmd.lastIndexOf('/');
            if (lastSlash >= 0) cmd = cmd.substring(lastSlash + 1);

            if (!READ_COMMANDS.contains(cmd)) continue;

            // 检查该子命令中的每个参数
            for (int i = 1; i < tokens.length; i++) {
                String arg = tokens[i];
                // 跳过选项参数
                if (arg.startsWith("-")) continue;

                // 展开 ~ 和 $HOME
                String expanded = arg.replace("~", home).replace("$HOME", home);

                // 检查敏感系统文件（精确匹配）
                for (String sensitive : SENSITIVE_SYSTEM_FILES) {
                    if (expanded.equals(sensitive)) {
                        return "Sensitive file access denied: " + arg + " (matches blocked path: " + sensitive + ")";
                    }
                }

                // 检查敏感用户文件（前缀匹配）
                for (String userPath : SENSITIVE_USER_PATHS) {
                    String expandedUserPath = userPath.replace("~", home);
                    if (expanded.equals(expandedUserPath) || expanded.startsWith(expandedUserPath)) {
                        return "Sensitive file access denied: " + arg + " (matches blocked path: " + userPath + ")";
                    }
                }

                // 检查敏感系统目录（前缀匹配，排除安全白名单）
                for (String dir : SENSITIVE_SYSTEM_DIRS) {
                    if (expanded.startsWith(dir) || expanded.equals(dir.substring(0, dir.length() - 1))) {
                        // 检查白名单
                        boolean isSafe = SAFE_PROC_PATHS.stream().anyMatch(expanded::equals);
                        if (!isSafe) {
                            return "Sensitive directory access denied: " + arg + " (within restricted area: " + dir + ")";
                        }
                    }
                }
            }
        }
        return null;
    }

    /** Execution check plus the exact target inspected by that check. */
    public record AuthorizedPathCheck(
            Path target, PathCheckResult permission) { }

    /** 路径检查结果 */
    public record PathCheckResult(boolean isAllowed, boolean needsConfirmation, String message) {
        public static PathCheckResult allowed() {
            return new PathCheckResult(true, false, null);
        }
        public static PathCheckResult denied(String msg) {
            return new PathCheckResult(false, false, msg);
        }
        public static PathCheckResult needsConfirmation(String msg) {
            return new PathCheckResult(true, true, msg);
        }
    }
}
