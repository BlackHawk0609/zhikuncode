package com.aicodeassistant.coordinator;

import com.aicodeassistant.mcp.McpClientManager;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class CoordinatorPromptBuilderTest {

    @Test
    @DisplayName("提示词要求接管部分结果并阻止同范围重复派发")
    void promptContainsBoundedFallbackForIncompleteWorkers() {
        CoordinatorService coordinatorService = mock(CoordinatorService.class);
        McpClientManager mcpClientManager = mock(McpClientManager.class);
        when(coordinatorService.getWorkerToolsContext("session-1"))
                .thenReturn(Map.of("workerToolsContext", "standard tools"));
        when(mcpClientManager.getConnectedServers()).thenReturn(List.of());

        CoordinatorPromptBuilder builder =
                new CoordinatorPromptBuilder(coordinatorService, mcpClientManager);
        String prompt = builder.buildCoordinatorPrompt(
                "session-1", Path.of("/tmp/zhikun-scratchpad"));

        assertTrue(prompt.contains("将结果视为部分结果"));
        assertTrue(prompt.contains("最多创建一个续作 worker"));
        assertTrue(prompt.contains("只覆盖尚未完成的部分"));
        assertTrue(prompt.contains("不要把原始任务完整重发"));
        assertTrue(prompt.contains("SendMessage 返回 Agent not found"));
        assertTrue(prompt.contains("只有仍处于活动状态的 worker 才能通过 SendMessage 继续"));
    }
}
