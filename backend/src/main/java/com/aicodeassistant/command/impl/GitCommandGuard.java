package com.aicodeassistant.command.impl;

import com.aicodeassistant.command.CommandContext;
import com.aicodeassistant.command.CommandResult;
import com.aicodeassistant.service.GitService;

import java.nio.file.Path;

/** Shared boundary check for slash commands that can invoke repository-wide Git behavior. */
final class GitCommandGuard {

    private GitCommandGuard() {}

    static CommandResult requireRepositoryRoot(
            GitService gitService,
            CommandContext context) {
        if (context == null || context.workingDir() == null
                || context.workingDir().isBlank()) {
            return CommandResult.error("工作目录未设置");
        }
        try {
            if (gitService.isGitRepositoryRoot(
                    Path.of(context.workingDir()))) {
                return null;
            }
        } catch (RuntimeException invalid) {
            // Malformed paths use the same fail-closed result.
        }
        return CommandResult.error(
                "仅允许在当前授权的 Git 仓库根目录执行 Git 命令");
    }
}
