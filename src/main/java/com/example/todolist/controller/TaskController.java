package com.example.todolist.controller;

import com.example.todolist.dto.TaskRequest;
import com.example.todolist.service.TaskService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/tasks")
public class TaskController {

    private final TaskService taskService;

    public TaskController(TaskService taskService) {
        this.taskService = taskService;
    }

    @GetMapping
    public ResponseEntity<?> getAll() {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        return ResponseEntity.ok(taskService.getAllTasks(username));
    }

    @PostMapping
    public ResponseEntity<?> create(@Valid @RequestBody TaskRequest request) {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        return ResponseEntity.ok(taskService.createTask(username, request.getTitle(), request.getDescription(), request.getPriority(), request.getDueDate(), request.isCompleted()));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id, @Valid @RequestBody TaskRequest request) {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        return ResponseEntity.ok(taskService.updateTask(username, id, request.getTitle(), request.getDescription(), request.isCompleted(), request.getPriority(), request.getDueDate()));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        taskService.deleteTask(username, id);
        return ResponseEntity.ok("Successfully deleted a task");
    }
}
