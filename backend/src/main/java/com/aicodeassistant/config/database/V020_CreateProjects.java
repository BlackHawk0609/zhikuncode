package com.aicodeassistant.config.database;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Stores user-approved filesystem roots in the global database.
 */
@Component
@Order(20)
public final class V020_CreateProjects implements Migration {

    private static final String CHECKSUM =
            MigrationChecksums.sha256("v020-create-global-projects-v1");

    private final JdbcTemplate jdbc;

    public V020_CreateProjects(
            @Qualifier("globalJdbcTemplate") JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public Scope scope() {
        return Scope.GLOBAL;
    }

    @Override
    public String checksum() {
        return CHECKSUM;
    }

    @Override
    public void execute() {
        jdbc.execute("""
                CREATE TABLE projects (
                    id             TEXT NOT NULL PRIMARY KEY,
                    name           TEXT NOT NULL,
                    workspace_root TEXT NOT NULL UNIQUE,
                    created_at     TEXT NOT NULL
                )
                """);
        jdbc.execute("""
                CREATE INDEX idx_projects_created_at
                ON projects(created_at DESC, id DESC)
                """);
    }

    @Override
    public void validate() {
        Integer tableCount = jdbc.queryForObject("""
                SELECT COUNT(*) FROM sqlite_master
                WHERE type = 'table' AND name = 'projects'
                """, Integer.class);
        List<ColumnDefinition> columns = jdbc.query(
                "PRAGMA table_info('projects')",
                (rs, row) -> new ColumnDefinition(
                        rs.getString("name"),
                        rs.getString("type"),
                        rs.getInt("notnull") != 0,
                        rs.getInt("pk")));
        List<IndexDefinition> indexes = jdbc.query(
                "PRAGMA index_list('projects')",
                (rs, row) -> new IndexDefinition(
                        rs.getString("name"),
                        rs.getInt("unique") != 0,
                        rs.getInt("partial") != 0));

        boolean columnsValid = columns.size() == 4
                && column(columns, "id", "TEXT", true, 1)
                && column(columns, "name", "TEXT", true, 0)
                && column(columns, "workspace_root", "TEXT", true, 0)
                && column(columns, "created_at", "TEXT", true, 0);
        boolean workspaceUnique = indexes.stream()
                .filter(index -> index.unique && !index.partial)
                .anyMatch(index -> indexColumns(index.name)
                        .equals(List.of(new IndexColumn(
                                "workspace_root", false))));
        boolean createdAtIndex = indexes.stream()
                .filter(index -> "idx_projects_created_at"
                        .equals(index.name))
                .filter(index -> !index.unique && !index.partial)
                .anyMatch(index -> indexColumns(index.name)
                        .equals(List.of(
                                new IndexColumn("created_at", true),
                                new IndexColumn("id", true))));

        if (tableCount == null || tableCount != 1
                || !columnsValid || !workspaceUnique
                || !createdAtIndex) {
            throw new IllegalStateException(
                    "V020 projects schema postcondition failed");
        }
    }

    private boolean column(
            List<ColumnDefinition> columns,
            String name,
            String type,
            boolean notNull,
            int primaryKeyPosition) {
        return columns.stream().anyMatch(column ->
                name.equals(column.name)
                        && type.equalsIgnoreCase(column.type)
                        && column.notNull == notNull
                        && column.primaryKeyPosition
                                == primaryKeyPosition);
    }

    private List<IndexColumn> indexColumns(String indexName) {
        String quoted = indexName.replace("'", "''");
        return jdbc.query(
                        "PRAGMA index_xinfo('" + quoted + "')",
                        (rs, row) -> rs.getInt("key") == 0
                                ? null
                                : new IndexColumn(
                                        rs.getString("name"),
                                        rs.getInt("desc") != 0))
                .stream()
                // SQLite includes the rowid as a non-key auxiliary column.
                .filter(java.util.Objects::nonNull)
                .toList();
    }

    private record ColumnDefinition(
            String name,
            String type,
            boolean notNull,
            int primaryKeyPosition
    ) {}

    private record IndexDefinition(
            String name,
            boolean unique,
            boolean partial
    ) {}

    private record IndexColumn(
            String name,
            boolean descending
    ) {}
}
