package com.example.todolist.controller;

import com.example.todolist.dto.SubtaskRequest;
import com.example.todolist.dto.SubtaskResponse;
import com.example.todolist.service.SubtaskService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/tasks/{taskId}/subtasks")
public class SubtaskController {
    private final SubtaskService subtaskService;

    public SubtaskController(SubtaskService subtaskService) {
        this.subtaskService = subtaskService;
    }

    @GetMapping
    public ResponseEntity<?> getAll(@PathVariable Long taskId) {
        String username = currentUsername();
        return ResponseEntity.ok(subtaskService.getSubtasks(username, taskId).stream().map(SubtaskResponse::from).toList());
    }

    @PostMapping
    public ResponseEntity<?> create(@PathVariable Long taskId, @RequestBody SubtaskRequest request) {
        String username = currentUsername();
        return ResponseEntity.ok(SubtaskResponse.from(subtaskService.createSubtask(
                username,
                taskId,
                request.getTitle(),
                request.getCompleted()
        )));
    }

    @PatchMapping("/{subtaskId}")
    public ResponseEntity<?> update(
            @PathVariable Long taskId,
            @PathVariable Long subtaskId,
            @RequestBody SubtaskRequest request
    ) {
        String username = currentUsername();
        return ResponseEntity.ok(SubtaskResponse.from(subtaskService.updateSubtask(
                username,
                taskId,
                subtaskId,
                request.getTitle(),
                request.getCompleted()
        )));
    }

    @DeleteMapping("/{subtaskId}")
    public ResponseEntity<?> delete(@PathVariable Long taskId, @PathVariable Long subtaskId) {
        String username = currentUsername();
        subtaskService.deleteSubtask(username, taskId, subtaskId);
        return ResponseEntity.ok("Successfully deleted a subtask");
    }

    private String currentUsername() {
        return SecurityContextHolder.getContext().getAuthentication().getName();
    }
}
