package com.aicodeassistant.authorization;

import com.aicodeassistant.interaction.DurableInteractionService;
import com.aicodeassistant.model.PermissionScope;
import com.aicodeassistant.permission.PermissionModeManager;
import com.aicodeassistant.run.RunControlService;
import com.aicodeassistant.tool.Tool;
import com.aicodeassistant.tool.ToolInput;
import com.aicodeassistant.tool.ToolUseContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AuthorizationServiceRememberScopeDescriptionTest {

    @Test
    void networkGrantScopesDescribeToolWideChangingInputs() {
        Map<String, Object> prompt = capturePrompt(
                "WebFetch", "network-v1", List.of(PermissionScope.RUN, PermissionScope.SESSION));

        assertThat(prompt.get("rememberScopeDescription"))
                .isEqualTo("Saved permission applies to WebFetch only; URL and input values may change. "
                        + "Other network tools remain separate. Run/session limits follow the selected option, "
                        + "and saved grants expire within 12 hours.");
    }

    @Test
    void mcpGrantScopesDescribeToolWideChangingInputs() {
        Map<String, Object> prompt = capturePrompt(
                "mcp__search__query", "mcp-v1", List.of(PermissionScope.RUN, PermissionScope.SESSION));

        assertThat(prompt.get("rememberScopeDescription"))
                .isEqualTo("Saved permission applies to MCP tool mcp__search__query only; input values may change. "
                        + "Other MCP tools remain separate. Run/session limits follow the selected option, "
                        + "and saved grants expire within 12 hours.");
    }

    @Test
    void nonRemoteAnalyzerDoesNotAddRememberScopeDescription() {
        Map<String, Object> prompt = capturePrompt(
                "Agent", "static-or-remote-v1", List.of(PermissionScope.RUN));

        assertThat(prompt).doesNotContainKey("rememberScopeDescription");
    }

    @Test
    void onceOnlyRemoteOperationDoesNotAddRememberScopeDescription() {
        Map<String, Object> prompt = capturePrompt("WebFetch", "network-v1", List.of());

        assertThat(prompt).doesNotContainKey("rememberScopeDescription");
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> capturePrompt(
            String toolName, String analyzerId, List<PermissionScope> scopes) {
        AuthorizationSubjectResolver subjects = mock(AuthorizationSubjectResolver.class);
        OperationAnalyzerRegistry analyzers = mock(OperationAnalyzerRegistry.class);
        PermissionGrantRepository grants = mock(PermissionGrantRepository.class);
        DurableInteractionService interactions = mock(DurableInteractionService.class);
        PermissionModeManager modes = mock(PermissionModeManager.class);
        RunControlService runs = mock(RunControlService.class);
        AuthorizationService service = new AuthorizationService(
                subjects, analyzers, grants, interactions, modes, runs, new ObjectMapper());

        AuthorizationSubject subject = new AuthorizationSubject(
                "session", "run", "run", "workspace", Path.of(".").toAbsolutePath().normalize());
        OperationDescriptor operation = new OperationDescriptor(
                1, toolName, "invoke", "input-hash", analyzerId,
                List.of(EffectClass.UNKNOWN), List.of(), List.of(), List.of(),
                RiskClass.GUARDED, "operation-hash", "redacted input");
        PreparedOperation prepared = new PreparedOperation(subject, operation, "attempt");
        Tool tool = mock(Tool.class);
        when(tool.getName()).thenReturn(toolName);
        when(grants.findMatch(subject, operation)).thenReturn(null);
        when(grants.supportedScopes(operation)).thenReturn(scopes);

        org.mockito.ArgumentCaptor<Object> prompt =
                org.mockito.ArgumentCaptor.forClass(Object.class);
        when(interactions.createAuthorization(
                anyString(), anyString(), anyString(), prompt.capture(),
                anyList(), anyList(), anyString(), any(AuthorizationInteractionContext.class)))
                .thenThrow(PromptCapturedException.class);

        byte[] canonicalInput = "{}".getBytes(StandardCharsets.UTF_8);
        try (FrozenToolInput frozen = new FrozenToolInput(
                toolName, 1, canonicalInput, canonicalInput.length, "input-hash", () -> { })) {
            assertThatThrownBy(() -> service.authorizePrepared(
                    tool, frozen, ToolInput.from(Map.of()),
                    ToolUseContext.of(".", "session")
                            .withCurrentRunId("run")
                            .withToolUseId("tool-use"),
                    prepared))
                    .isInstanceOf(PromptCapturedException.class);
        }
        return (Map<String, Object>) prompt.getValue();
    }

    private static final class PromptCapturedException extends RuntimeException {
    }
}
