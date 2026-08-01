package com.aicodeassistant.authorization;

import com.aicodeassistant.interaction.DurableInteractionService;
import com.aicodeassistant.model.PermissionMode;
import com.aicodeassistant.permission.PermissionModeManager;
import com.aicodeassistant.run.RunControlService;
import com.aicodeassistant.security.SystemScratchpadPathPolicy;
import com.aicodeassistant.service.ProjectWorkspaceService;
import com.aicodeassistant.tool.Tool;
import com.aicodeassistant.tool.ToolInput;
import com.aicodeassistant.tool.ToolUseContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AuthorizationServiceSystemScratchpadScopeTest {

    @TempDir
    Path tempDir;

    private Path workspace;
    private Path scratchpad;

    @BeforeEach
    void createRoots() throws Exception {
        workspace = Files.createDirectories(
                tempDir.resolve("project"));
        scratchpad = Files.createDirectories(
                tempDir.resolve("state/.zhikun/scratchpad"));
    }

    @Test
    void ordinaryFileOperationsUseExplicitSystemScratchpadPolicy() {
        for (ToolAction tool : List.of(
                new ToolAction("Read", TypedFileOperation.READ_FILE,
                        EffectClass.READ_RESOURCE),
                new ToolAction("Write", TypedFileOperation.REPLACE_FILE,
                        EffectClass.WRITE_RESOURCE),
                new ToolAction("Edit", TypedFileOperation.PATCH_FILE,
                        EffectClass.WRITE_RESOURCE),
                new ToolAction("NotebookEdit", TypedFileOperation.PATCH_FILE,
                        EffectClass.WRITE_RESOURCE))) {
            Fixture fixture = fixture(PermissionMode.DEFAULT, true);
            OperationDescriptor operation = descriptor(
                    tool.toolName(), tool.action(), tool.effect(),
                    RiskClass.GUARDED,
                    scratchpad.resolve("session/note.md"));

            AuthorizedOperation authorized = fixture.authorize(operation);

            assertThat(authorized.reasonCode())
                    .isEqualTo("SYSTEM_SCRATCHPAD_SCOPE");
            assertThat(authorized.source())
                    .isEqualTo(AuthorizationDiagnostic.Source.POLICY);
            verifyNoPrompt(fixture);
        }
    }

    @Test
    void planAllowsScratchpadReadButStillDeniesScratchpadWrite() {
        Fixture readFixture = fixture(PermissionMode.PLAN, true);
        AuthorizedOperation read = readFixture.authorize(descriptor(
                "Read", TypedFileOperation.READ_FILE,
                EffectClass.READ_RESOURCE, RiskClass.GUARDED,
                scratchpad.resolve("session/note.md")));
        assertThat(read.reasonCode())
                .isEqualTo("SYSTEM_SCRATCHPAD_SCOPE");
        verifyNoPrompt(readFixture);

        Fixture writeFixture = fixture(PermissionMode.PLAN, true);
        assertThatThrownBy(() -> writeFixture.authorize(descriptor(
                "Write", TypedFileOperation.REPLACE_FILE,
                EffectClass.WRITE_RESOURCE, RiskClass.GUARDED,
                scratchpad.resolve("session/note.md"))))
                .isInstanceOfSatisfying(
                        AuthorizationException.class,
                        denied -> assertThat(denied.code())
                                .isEqualTo("PLAN_MODE_EFFECT_DENIED"));
        verifyNoPrompt(writeFixture);
    }

    @Test
    void dontAskAllowsOrdinaryScratchpadWriteForTrustedProject() {
        Fixture fixture = fixture(PermissionMode.DONT_ASK, true);

        AuthorizedOperation authorized = fixture.authorize(descriptor(
                "Edit", TypedFileOperation.PATCH_FILE,
                EffectClass.WRITE_RESOURCE, RiskClass.GUARDED,
                scratchpad.resolve("session/note.md")));

        assertThat(authorized.reasonCode())
                .isEqualTo("SYSTEM_SCRATCHPAD_SCOPE");
        verifyNoPrompt(fixture);
    }

    @Test
    void dontAskDoesNotTrustScratchpadForUntrustedProjectSubject() {
        Fixture fixture = fixture(PermissionMode.DONT_ASK, false);

        assertThatThrownBy(() -> fixture.authorize(descriptor(
                "Write", TypedFileOperation.REPLACE_FILE,
                EffectClass.WRITE_RESOURCE, RiskClass.GUARDED,
                scratchpad.resolve("session/note.md"))))
                .isInstanceOfSatisfying(
                        AuthorizationException.class,
                        denied -> assertThat(denied.code())
                                .isEqualTo(
                                        "PERMISSION_INTERACTION_REQUIRED"));
        verifyNoPrompt(fixture);
    }

    @Test
    void highRiskScratchpadFilesStillRequireAOneTimeInteraction() {
        Fixture fixture = fixture(PermissionMode.DEFAULT, true);

        assertThatThrownBy(() -> fixture.authorize(descriptor(
                "Write", TypedFileOperation.REPLACE_FILE,
                EffectClass.WRITE_RESOURCE, RiskClass.HIGH,
                scratchpad.resolve("session/.env"))))
                .isInstanceOf(PermissionPromptExpected.class);
    }

    @Test
    void lookalikesAndNonOrdinaryFileToolsDoNotUseScratchpadPolicy() {
        for (OperationDescriptor operation : List.of(
                descriptor("Read", TypedFileOperation.READ_FILE,
                        EffectClass.READ_RESOURCE, RiskClass.GUARDED,
                        scratchpad.resolveSibling(
                                "scratchpad-evil/note.md")),
                descriptor("Glob", TypedFileOperation.LIST_DIRECTORY,
                        EffectClass.READ_RESOURCE, RiskClass.GUARDED,
                        scratchpad.resolve("session")),
                descriptor("Grep", TypedFileOperation.LIST_DIRECTORY,
                        EffectClass.READ_RESOURCE, RiskClass.GUARDED,
                        scratchpad.resolve("session")),
                nonFileDescriptor("Bash", "bash-v2",
                        List.of(EffectClass.PROCESS,
                                EffectClass.WRITE_RESOURCE)),
                nonFileDescriptor("Worktree", "generic-v1",
                        List.of(EffectClass.CONTROL_PLANE)))) {
            Fixture fixture = fixture(PermissionMode.DEFAULT, true);

            assertThatThrownBy(() -> fixture.authorize(operation))
                    .isInstanceOf(PermissionPromptExpected.class);
        }
    }

    @Test
    void everyResourceMustRemainInsideSystemScratchpad() {
        Fixture fixture = fixture(PermissionMode.DEFAULT, true);
        OperationDescriptor operation = descriptor(
                "Write", TypedFileOperation.REPLACE_FILE,
                EffectClass.WRITE_RESOURCE, RiskClass.GUARDED,
                List.of(scratchpad.resolve("session/note.md"),
                        tempDir.resolve("outside.txt")));

        assertThatThrownBy(() -> fixture.authorize(operation))
                .isInstanceOf(PermissionPromptExpected.class);
    }

    @Test
    void relativeProjectResourceCanStillMatchConfiguredSystemRoot() {
        scratchpad = workspace.resolve(".zhikun/scratchpad");
        Fixture fixture = fixture(PermissionMode.DEFAULT, true);

        AuthorizedOperation authorized = fixture.authorize(descriptor(
                "Write", TypedFileOperation.REPLACE_FILE,
                EffectClass.WRITE_RESOURCE, RiskClass.GUARDED,
                scratchpad.resolve("session/note.md")));

        assertThat(authorized.reasonCode())
                .isEqualTo("SYSTEM_SCRATCHPAD_SCOPE");
        verifyNoPrompt(fixture);
    }

    @Test
    void finalAdmissionRevalidatesSystemScratchpadPolicy() {
        Fixture fixture = fixture(PermissionMode.DEFAULT, true);
        when(fixture.projects().isTrustedFileScope(workspace))
                .thenReturn(true, false);
        AuthorizedOperation authorized = fixture.authorize(descriptor(
                "Write", TypedFileOperation.REPLACE_FILE,
                EffectClass.WRITE_RESOURCE, RiskClass.GUARDED,
                scratchpad.resolve("session/note.md")));

        assertThatThrownBy(() -> fixture.service()
                .finalGrantRecheckInCurrentTransaction(
                        authorized,
                        ToolUseContext.of(
                                workspace.toString(), "session")))
                .isInstanceOfSatisfying(
                        AuthorizationException.class,
                        denied -> assertThat(denied.code())
                                .isEqualTo(
                                        "AUTHORIZATION_FINAL_RECHECK_DENIED"));
    }

    private Fixture fixture(
            PermissionMode mode, boolean trusted) {
        AuthorizationSubjectResolver subjects =
                mock(AuthorizationSubjectResolver.class);
        OperationAnalyzerRegistry analyzers =
                mock(OperationAnalyzerRegistry.class);
        PermissionGrantRepository grants =
                mock(PermissionGrantRepository.class);
        DurableInteractionService interactions =
                mock(DurableInteractionService.class);
        PermissionModeManager modes =
                mock(PermissionModeManager.class);
        RunControlService runs = mock(RunControlService.class);
        ProjectWorkspaceService projects =
                mock(ProjectWorkspaceService.class);
        AuthorizationSubject subject = new AuthorizationSubject(
                "session", "run", "run", "workspace", workspace);
        when(modes.getMode("session")).thenReturn(mode);
        when(projects.isTrustedFileScope(workspace))
                .thenReturn(trusted);
        when(interactions.createAuthorization(
                anyString(), anyString(), nullable(String.class),
                any(), anyList(), anyList(), anyString(),
                any(AuthorizationInteractionContext.class)))
                .thenThrow(PermissionPromptExpected.class);

        AuthorizationService service = new AuthorizationService(
                subjects, analyzers, grants, interactions,
                modes, runs, new ObjectMapper(), projects,
                new SystemScratchpadPathPolicy(scratchpad));
        return new Fixture(
                service, interactions, projects, subject);
    }

    private OperationDescriptor descriptor(
            String toolName, TypedFileOperation action,
            EffectClass effect, RiskClass risk, Path resource) {
        return descriptor(toolName, action, effect, risk,
                List.of(resource));
    }

    private OperationDescriptor descriptor(
            String toolName, TypedFileOperation action,
            EffectClass effect, RiskClass risk,
            List<Path> resources) {
        List<ResourceRef> refs = resources.stream()
                .map(path -> {
                    Path normalized = path.toAbsolutePath().normalize();
                    boolean outside = !normalized.startsWith(workspace);
                    String value = outside
                            ? normalized.toString()
                            : workspace.relativize(normalized)
                                    .toString().replace('\\', '/');
                    return new ResourceRef("path", value, outside);
                })
                .toList();
        return new OperationDescriptor(
                1, toolName, action.name(), "input-hash",
                "file-v1", List.of(effect), refs,
                List.of(), List.of(), risk,
                "operation-hash", "summary");
    }

    private OperationDescriptor nonFileDescriptor(
            String toolName, String analyzer,
            List<EffectClass> effects) {
        return new OperationDescriptor(
                1, toolName, "invoke", "input-hash",
                analyzer, effects,
                List.of(new ResourceRef(
                        "path", scratchpad.resolve("session")
                                .toString(), true)),
                List.of(), List.of(), RiskClass.GUARDED,
                "operation-hash", "summary");
    }

    private static void verifyNoPrompt(Fixture fixture) {
        verify(fixture.interactions(), never())
                .createAuthorization(
                        anyString(), anyString(), nullable(String.class),
                        any(), anyList(), anyList(), anyString(),
                        any(AuthorizationInteractionContext.class));
    }

    private record ToolAction(
            String toolName, TypedFileOperation action,
            EffectClass effect) {
    }

    private record Fixture(
            AuthorizationService service,
            DurableInteractionService interactions,
            ProjectWorkspaceService projects,
            AuthorizationSubject subject) {

        AuthorizedOperation authorize(
                OperationDescriptor descriptor) {
            Tool tool = mock(Tool.class);
            when(tool.getName()).thenReturn(
                    descriptor.toolName());
            ToolInput input = ToolInput.from(Map.of());
            FrozenToolInputFactory factory =
                    new FrozenToolInputFactory(
                            new ObjectMapper(), 1024, 4096);
            try (FrozenToolInput frozen = factory.freeze(
                    descriptor.toolName(), input)) {
                return service.authorizePrepared(
                        tool, frozen, input,
                        ToolUseContext.of(
                                subject.authorizationRoot().toString(),
                                subject.rootSessionId()),
                        new PreparedOperation(
                                subject, descriptor, "attempt"));
            }
        }
    }

    private static final class PermissionPromptExpected
            extends RuntimeException {
    }
}
