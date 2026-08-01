package com.aicodeassistant.controller;

import com.aicodeassistant.exception.WorkspaceException;
import com.aicodeassistant.model.Project;
import com.aicodeassistant.service.ProjectWorkspaceService.DirectoryListing;
import com.aicodeassistant.service.ProjectWorkspaceService.RevocationResult;
import com.aicodeassistant.service.ProjectWorkspaceService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/projects")
public class ProjectController {

    private final ProjectWorkspaceService workspaces;

    public ProjectController(ProjectWorkspaceService workspaces) {
        this.workspaces = workspaces;
    }

    @GetMapping
    public ResponseEntity<List<Project>> list() {
        return ResponseEntity.ok(workspaces.list());
    }

    @GetMapping("/directories")
    public ResponseEntity<DirectoryListing> browseDirectories(
            @RequestParam(required = false) String path,
            HttpServletRequest servletRequest) {
        return ResponseEntity.ok(workspaces.browseDirectories(
                path, servletRequest.getRemoteAddr()));
    }

    @PostMapping
    public ResponseEntity<Project> create(
            @RequestBody(required = false) CreateProjectRequest request,
            HttpServletRequest servletRequest) {
        if (request == null) {
            throw new WorkspaceException(
                    HttpStatus.BAD_REQUEST,
                    "WORKSPACE_REQUIRED",
                    "Request body is required");
        }
        Project project = workspaces.create(
                request.name(),
                request.workspaceRoot(),
                servletRequest.getRemoteAddr());
        return ResponseEntity.status(201).body(project);
    }

    @DeleteMapping("/{projectId}")
    public ResponseEntity<RevocationResult> revoke(
            @PathVariable String projectId) {
        return ResponseEntity.ok(workspaces.revoke(projectId));
    }

    public record CreateProjectRequest(
            String name,
            String workspaceRoot
    ) {}
}
