package com.aicodeassistant.config.database;

import com.aicodeassistant.service.ProjectRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.sqlite.SQLiteDataSource;

import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class V020CreateProjectsTest {

    @TempDir
    Path temp;

    @Test
    void createsOnlyTheGlobalProjectRegistry() {
        SQLiteDataSource source = new SQLiteDataSource();
        source.setUrl("jdbc:sqlite:"
                + temp.resolve("global.db"));
        JdbcTemplate jdbc = new JdbcTemplate(source);
        V020_CreateProjects migration =
                new V020_CreateProjects(jdbc);

        assertThat(migration.scope())
                .isEqualTo(Migration.Scope.GLOBAL);
        migration.execute();
        migration.validate();

        jdbc.update("""
                INSERT INTO projects(
                    id, name, workspace_root, created_at)
                VALUES (?, ?, ?, ?)
                """, "p1", "Demo", "/workspace/demo",
                "2026-01-01T00:00:00Z");

        assertThat(jdbc.queryForObject(
                "SELECT name FROM projects WHERE id = ?",
                String.class, "p1")).isEqualTo("Demo");
        assertThatThrownBy(() -> jdbc.update("""
                INSERT INTO projects(
                    id, name, workspace_root, created_at)
                VALUES (?, ?, ?, ?)
                """, "p2", "Duplicate", "/workspace/demo",
                "2026-01-02T00:00:00Z"))
                .isInstanceOf(DataAccessException.class);
        assertThatThrownBy(() -> jdbc.update("""
                INSERT INTO projects(
                    id, name, workspace_root, created_at)
                VALUES (NULL, ?, ?, ?)
                """, "Missing ID", "/workspace/no-id",
                "2026-01-03T00:00:00Z"))
                .isInstanceOf(DataAccessException.class);

        ProjectRepository projects = new ProjectRepository(jdbc);
        assertThat(projects.deleteById("p1")).isTrue();
        assertThat(projects.deleteById("p1")).isFalse();
    }

    @Test
    void validationRejectsANameOnlySchemaMatch() {
        SQLiteDataSource source = new SQLiteDataSource();
        source.setUrl("jdbc:sqlite:"
                + temp.resolve("invalid-global.db"));
        JdbcTemplate jdbc = new JdbcTemplate(source);
        jdbc.execute("""
                CREATE TABLE projects (
                    id TEXT,
                    name TEXT,
                    workspace_root TEXT,
                    created_at TEXT
                )
                """);
        jdbc.execute("""
                CREATE INDEX idx_projects_created_at
                ON projects(name)
                """);

        assertThatThrownBy(() ->
                new V020_CreateProjects(jdbc).validate())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining(
                        "projects schema postcondition failed");
    }
}
