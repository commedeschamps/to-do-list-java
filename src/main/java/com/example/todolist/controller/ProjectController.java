package com.example.todolist.controller;

import com.example.todolist.dto.ProjectRequest;
import com.example.todolist.dto.ProjectResponse;
import com.example.todolist.service.ProjectService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/projects")
public class ProjectController {
    private final ProjectService projectService;

    public ProjectController(ProjectService projectService) {
        this.projectService = projectService;
    }

    @GetMapping
    public ResponseEntity<?> getAll() {
        String username = currentUsername();
        return ResponseEntity.ok(projectService.getProjects(username).stream().map(ProjectResponse::from).toList());
    }

    @PostMapping
    public ResponseEntity<?> create(@Valid @RequestBody ProjectRequest request) {
        String username = currentUsername();
        return ResponseEntity.ok(ProjectResponse.from(projectService.createProject(username, request.getName(), request.getColor())));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id, @Valid @RequestBody ProjectRequest request) {
        String username = currentUsername();
        return ResponseEntity.ok(ProjectResponse.from(projectService.updateProject(username, id, request.getName(), request.getColor())));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        String username = currentUsername();
        projectService.deleteProject(username, id);
        return ResponseEntity.ok("Successfully deleted a project");
    }

    private String currentUsername() {
        return SecurityContextHolder.getContext().getAuthentication().getName();
    }
}
