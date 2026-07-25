package com.aicodeassistant.tool.agent;

import com.aicodeassistant.coordinator.TaskNotificationFormatter;
import com.aicodeassistant.engine.QueryEngine;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SubAgentExecutorStatusPropagationTest {

    @Test
    @DisplayName("max_turns 状态同时传播到返回值和 Coordinator 通知")
    void maxTurnsStatusIsPreservedInCoordinatorNotification() {
        QueryEngine.QueryResult queryResult =
                new QueryEngine.QueryResult(List.of(), null, "max_turns", null, 30);
        SubAgentExecutor.AgentRequest request = new SubAgentExecutor.AgentRequest(
                "agent-bank",
                "调查银行积存金",
                "worker",
                null,
                SubAgentExecutor.IsolationMode.NONE,
                false);

        SubAgentExecutor.AgentResult result = SubAgentExecutor.buildFinalResult(
                queryResult,
                "已完成部分银行数据收集",
                request,
                new TaskNotificationFormatter(),
                true,
                1234L);

        assertEquals(SubAgentExecutor.AgentResult.STATUS_MAX_TURNS, result.status());
        assertTrue(result.result().contains("<status>max_turns</status>"));
        assertTrue(result.result().contains("已完成部分银行数据收集"));
    }

    @Test
    @DisplayName("非 Coordinator 模式仍保留原始答案和真实状态")
    void nonCoordinatorResultKeepsRawAnswerAndStatus() {
        QueryEngine.QueryResult queryResult =
                new QueryEngine.QueryResult(List.of(), null, "end_turn", null, 2);
        SubAgentExecutor.AgentRequest request = new SubAgentExecutor.AgentRequest(
                "agent-research",
                "研究任务",
                "worker",
                null,
                SubAgentExecutor.IsolationMode.NONE,
                false);

        SubAgentExecutor.AgentResult result = SubAgentExecutor.buildFinalResult(
                queryResult,
                "研究完成",
                request,
                new TaskNotificationFormatter(),
                false,
                100L);

        assertEquals(SubAgentExecutor.AgentResult.STATUS_COMPLETED, result.status());
        assertEquals("研究完成", result.result());
    }
}
