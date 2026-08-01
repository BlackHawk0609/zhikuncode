package com.aicodeassistant.model;

import java.time.Instant;

/**
 * A named, user-approved trust scope and default relative-path root.
 */
public record Project(
        String id,
        String name,
        String workspaceRoot,
        Instant createdAt
) {}
