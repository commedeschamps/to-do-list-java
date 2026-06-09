package com.example.todolist.controller;

import com.example.todolist.dto.TaskRequest;
import com.example.todolist.service.TaskService;
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
    public ResponseEntity<?> create(@RequestBody TaskRequest request) {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        return ResponseEntity.ok(taskService.createTask(username, request.getTitle(), request.getDescription()));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id, @RequestBody TaskRequest request) {
        return ResponseEntity.ok(taskService.updateTask(id, request.getTitle(), request.getDescription(), request.isCompleted()));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        taskService.deleteTask(id);
        return ResponseEntity.ok("Successfully deleted a task");
    }
}