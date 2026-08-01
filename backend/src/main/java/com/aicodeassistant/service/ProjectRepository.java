package com.aicodeassistant.service;

import com.aicodeassistant.model.Project;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public class ProjectRepository {

    private static final RowMapper<Project> ROW_MAPPER = (rs, rowNum) ->
            new Project(
                    rs.getString("id"),
                    rs.getString("name"),
                    rs.getString("workspace_root"),
                    Instant.parse(rs.getString("created_at")));

    private final JdbcTemplate jdbc;

    public ProjectRepository(
            @Qualifier("globalJdbcTemplate") JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public void create(Project project) {
        jdbc.update("""
                INSERT INTO projects(id, name, workspace_root, created_at)
                VALUES (?, ?, ?, ?)
                """,
                project.id(), project.name(), project.workspaceRoot(),
                project.createdAt().toString());
    }

    /**
     * Removes the durable authorization represented by a Project.
     *
     * @return {@code true} when a row existed; {@code false} when it had
     *         already been revoked
     */
    public boolean deleteById(String id) {
        return jdbc.update("DELETE FROM projects WHERE id = ?", id) > 0;
    }

    public Optional<Project> findById(String id) {
        List<Project> rows = jdbc.query("""
                SELECT id, name, workspace_root, created_at
                FROM projects
                WHERE id = ?
                """, ROW_MAPPER, id);
        return rows.isEmpty() ? Optional.empty()
                : Optional.of(rows.getFirst());
    }

    public Optional<Project> findByWorkspaceRoot(String workspaceRoot) {
        List<Project> rows = jdbc.query("""
                SELECT id, name, workspace_root, created_at
                FROM projects
                WHERE workspace_root = ?
                """, ROW_MAPPER, workspaceRoot);
        return rows.isEmpty() ? Optional.empty()
                : Optional.of(rows.getFirst());
    }

    public List<Project> list() {
        return jdbc.query("""
                SELECT id, name, workspace_root, created_at
                FROM projects
                ORDER BY created_at DESC, id DESC
                """, ROW_MAPPER);
    }
}
