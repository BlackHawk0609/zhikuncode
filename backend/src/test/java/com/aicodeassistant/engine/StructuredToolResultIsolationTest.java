package com.aicodeassistant.engine;

import com.aicodeassistant.llm.MessageParam;
import com.aicodeassistant.llm.MessageParam.ContentPart;
import com.aicodeassistant.model.ContentBlock;
import com.aicodeassistant.model.Message;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class StructuredToolResultIsolationTest {

    private static final String PRIVATE_UI_URL =
            "https://example.oss-cn-beijing.aliyuncs.com/private-object";
    private static final String PRIVATE_OBJECT_KEY = "private/object-key.html";

    @Test
    void structuredResultUrlDoesNotEnterModelContext() {
        ContentBlock.ToolResultBlock resultBlock = toolResultBlock();
        Message.UserMessage message = new Message.UserMessage(
                UUID.randomUUID().toString(), Instant.now(),
                List.of(resultBlock), null, null);

        MessageParam normalized = MessageNormalizer.fromMessage(message);

        assertThat(normalized).isInstanceOf(MessageParam.UserParam.class);
        MessageParam.UserParam user = (MessageParam.UserParam) normalized;
        assertThat(user.content()).hasSize(1);
        assertThat(user.content().getFirst()).isInstanceOf(ContentPart.ToolResultPart.class);
        ContentPart.ToolResultPart toolResult =
                (ContentPart.ToolResultPart) user.content().getFirst();
        assertThat(toolResult.toolUseId()).isEqualTo("tool-use-1");
        assertThat(toolResult.content()).isEqualTo("model-safe content");
        assertThat(toolResult.isError()).isFalse();
        assertThat(normalized.toString())
                .doesNotContain(PRIVATE_UI_URL)
                .doesNotContain(PRIVATE_OBJECT_KEY)
                .doesNotContain("must-not-cross");
    }

    @Test
    void toolResultMetadataOnlyKeepsAllowlistedStructuredResult() {
        ContentBlock.ToolResultBlock resultBlock = toolResultBlock();

        assertThat(resultBlock.metadata()).containsOnlyKeys("structuredResult");
        assertThat(resultBlock.metadata().get("structuredResult"))
                .isInstanceOf(Map.class)
                .asString()
                .contains(PRIVATE_UI_URL, PRIVATE_OBJECT_KEY)
                .doesNotContain("must-not-cross");
    }

    private static ContentBlock.ToolResultBlock toolResultBlock() {
        return new ContentBlock.ToolResultBlock(
                "tool-use-1",
                "model-safe content",
                false,
                Map.of(
                        "structuredResult", Map.of(
                                "schema", "external-resource/v1",
                                "url", PRIVATE_UI_URL,
                                "objectKey", PRIVATE_OBJECT_KEY),
                        "internalSecret", "must-not-cross"));
    }
}
