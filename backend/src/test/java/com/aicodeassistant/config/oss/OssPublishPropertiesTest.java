package com.aicodeassistant.config.oss;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class OssPublishPropertiesTest {

    @Test
    void disabledByDefault() {
        assertThatThrownBy(new OssPublishProperties()::requireReady)
                .isInstanceOf(OssPublishProperties.OssConfigurationException.class)
                .hasMessage("OSS_PUBLISHING_DISABLED");
    }

    @Test
    void validEcsRoleConfigurationIsAccepted() {
        assertThatCode(() -> valid().requireReady(Map.of())).doesNotThrowAnyException();
    }

    @Test
    void endpointMustMatchConfiguredRegionAndUseHttps() {
        OssPublishProperties properties = valid();
        properties.setEndpoint("http://oss-cn-beijing.aliyuncs.com");
        assertThatThrownBy(() -> properties.requireReady(Map.of())).hasMessage("OSS_ENDPOINT_INVALID");

        properties.setEndpoint("https://oss-cn-hangzhou.aliyuncs.com");
        assertThatThrownBy(() -> properties.requireReady(Map.of())).hasMessage("OSS_ENDPOINT_INVALID");
    }

    @Test
    void staticOssCredentialsAreAlwaysRejected() {
        assertThatThrownBy(() -> OssPublishProperties.rejectStaticCredentials(
                Map.of("OSS_ACCESS_KEY_ID", "forbidden")))
                .hasMessage("OSS_CREDENTIAL_SOURCE_FORBIDDEN");
    }

    static OssPublishProperties valid() {
        OssPublishProperties properties = new OssPublishProperties();
        properties.setEnabled(true);
        properties.setEndpoint("https://oss-cn-beijing.aliyuncs.com");
        properties.setRegion("cn-beijing");
        properties.setBucket("test-artifacts");
        properties.setPrefix("zhikuncode-artifacts");
        properties.setEcsRoleName("TestEcsRole");
        return properties;
    }
}
