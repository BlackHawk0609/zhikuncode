package com.aicodeassistant.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.ArrayList;
import java.util.List;

@Service
public class ProjectMemoryService {

    private static final Logger log = LoggerFactory.getLogger(ProjectMemoryService.class);
    private static final String[] MEMORY_FILES = { "zhikun.md", "zhikun.local.md" };
    private static final long MAX_MEMORY_SIZE = 100 * 1024;

    public String loadMemory(Path workingDir) {
        if (workingDir == null) {
            log.warn("loadMemory called with null workingDir");
            return "";
        }

        final Path projectRoot;
        try {
            Path savedRoot = workingDir.toAbsolutePath().normalize();
            projectRoot = savedRoot.toRealPath();
            if (!projectRoot.equals(savedRoot)
                    || !Files.isDirectory(projectRoot, LinkOption.NOFOLLOW_LINKS)) {
                log.warn("Project memory root is unavailable or resolves through an alias: {}", workingDir);
                return "";
            }
        } catch (IOException | RuntimeException unavailable) {
            log.warn("Project memory root is unavailable: {}", workingDir);
            return "";
        }

        List<String> memories = new ArrayList<>();
        for (String fileName : MEMORY_FILES) {
            Path memFile = projectRoot.resolve(fileName);
            if (Files.isSymbolicLink(memFile)
                    || !Files.isRegularFile(memFile, LinkOption.NOFOLLOW_LINKS)) {
                continue;
            }
            try {
                Path realFile = memFile.toRealPath();
                if (!realFile.startsWith(projectRoot)
                        || !realFile.equals(memFile.toAbsolutePath().normalize())) {
                    log.warn("Ignoring Project memory outside the authorized root: {}", memFile);
                    continue;
                }
                long size = Files.size(realFile);
                if (size > MAX_MEMORY_SIZE) {
                    log.warn("Memory file too large ({}KB), truncating: {}", size / 1024, realFile);
                }
                byte[] contentBytes;
                try (var input = Files.newInputStream(
                        realFile, LinkOption.NOFOLLOW_LINKS)) {
                    contentBytes = input.readNBytes((int) MAX_MEMORY_SIZE);
                }
                String content = new String(contentBytes, StandardCharsets.UTF_8);
                memories.add("<!-- " + realFile + " -->\n" + content);
                log.info("Loaded memory file: {} ({}B)", realFile, size);
            } catch (IOException e) {
                log.warn("Failed to read memory file: {}", memFile, e);
            }
        }

        if (memories.isEmpty()) return "";
        return String.join("\n\n---\n\n", memories);
    }

    public void writeMemory(Path workingDir, String content, boolean isLocal) throws IOException {
        String fileName = isLocal ? "zhikun.local.md" : "zhikun.md";
        Path savedWorkingDir = workingDir.toAbsolutePath().normalize();
        Path projectRoot = savedWorkingDir.toRealPath();
        if (!projectRoot.equals(savedWorkingDir)
                || !Files.isDirectory(
                        projectRoot, LinkOption.NOFOLLOW_LINKS)) {
            throw new IOException(
                    "Project memory root is unavailable or unsafe");
        }
        Path memFile = projectRoot.resolve(fileName).normalize();

        if (!memFile.startsWith(projectRoot)) {
            throw new IOException("Path traversal detected: " + memFile);
        }
        if (Files.isSymbolicLink(memFile)) {
            throw new IOException(
                    "Refusing to write Project memory through a symbolic link: "
                            + memFile);
        }
        if (Files.exists(memFile, LinkOption.NOFOLLOW_LINKS)
                && !Files.isRegularFile(
                        memFile, LinkOption.NOFOLLOW_LINKS)) {
            throw new IOException(
                    "Project memory path is not a regular file: " + memFile);
        }

        Files.writeString(
                memFile,
                content,
                StandardCharsets.UTF_8,
                StandardOpenOption.CREATE,
                StandardOpenOption.TRUNCATE_EXISTING,
                StandardOpenOption.WRITE,
                LinkOption.NOFOLLOW_LINKS);
        log.info("Written memory file: {} ({}B)", memFile, content.length());
    }

    public boolean hasMemory(Path workingDir) {
        for (String fileName : MEMORY_FILES) {
            Path memoryFile = workingDir.resolve(fileName);
            if (!Files.isSymbolicLink(memoryFile)
                    && Files.isRegularFile(
                            memoryFile, LinkOption.NOFOLLOW_LINKS)) {
                return true;
            }
        }
        return false;
    }
}
