package com.aicodeassistant.command.impl;

import com.aicodeassistant.command.CommandContext;
import com.aicodeassistant.command.CommandResult;
import com.aicodeassistant.config.oss.OssPublishProperties;
import com.aicodeassistant.skill.SkillDefinition;
import com.aicodeassistant.skill.SkillRegistry;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class PublishOssCommandTest {

    @Test
    void directCommandInjectsSelectedPathAndRestrictsAvailableTools() {
        OssPublishProperties properties = new OssPublishProperties();
        properties.setEnabled(true);
        SkillRegistry skills = mock(SkillRegistry.class);
        SkillDefinition skill = SkillDefinition.fromMarkdown("publish-oss.md", """
                ---
                name: publish-oss
                description: explicit publish
                arguments: file_path
                ---
                Publish exactly `{{file_path}}`.
                """, SkillDefinition.SkillSource.BUNDLED, null);
        when(skills.resolve("publish-oss")).thenReturn(skill);
        PublishOssCommand command = new PublishOssCommand(skills, properties);

        CommandResult result = command.execute("reports/result.html", context());

        assertThat(result.isSuccess()).isTrue();
        assertThat(result.value()).contains("reports/result.html").doesNotContain("{{file_path}}");
        assertThat(command.getAllowedTools())
                .containsExactlyInAnyOrder("PublishArtifact", "AskUserQuestion");
    }

    @Test
    void disabledDeploymentRejectsCommandBeforeLoadingSkill() {
        PublishOssCommand command = new PublishOssCommand(
                mock(SkillRegistry.class), new OssPublishProperties());

        CommandResult result = command.execute("report.html", context());

        assertThat(result.type()).isEqualTo(CommandResult.ResultType.ERROR);
        assertThat(result.error()).contains("未在当前部署启用");
    }

    private static CommandContext context() {
        return CommandContext.of("session-1", "/app/workspace", null, null);
    }
}
