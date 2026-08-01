package com.aicodeassistant.tool.impl;

import com.aicodeassistant.engine.KeyFileTracker;
import com.aicodeassistant.security.PathSecurityService;
import com.aicodeassistant.tool.ToolInput;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class GrepToolProtectedGlobTest {

    @Test
    void ripgrepAndFallbackUseTheSameCaseInsensitiveProtectedGlobs() {
        GrepTool grep = new GrepTool(
                mock(KeyFileTracker.class), new PathSecurityService());
        ToolInput input = ToolInput.from(Map.of());
        String envGlob = GrepTool.caseInsensitiveGlobLiteral(".env");
        String sshGlob = GrepTool.caseInsensitiveGlobLiteral(".ssh");

        List<String> ripgrep = grep.buildRipgrepArgs(
                input, "MATCH", "/workspace", "content", true);
        List<String> fallback = grep.buildGrepFallbackArgs(
                input, "MATCH", "/workspace", "content", true);

        assertThat(envGlob).isEqualTo(".[eE][nN][vV]");
        assertThat(sshGlob).isEqualTo(".[sS][sS][hH]");
        assertThat(ripgrep).contains("!" + envGlob, "!" + sshGlob);
        assertThat(fallback).contains(
                "--exclude=" + envGlob,
                "--exclude-dir=" + sshGlob);
    }
}
