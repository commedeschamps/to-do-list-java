package com.example.todolist.controller;

import com.example.todolist.dto.LabelRequest;
import com.example.todolist.dto.LabelResponse;
import com.example.todolist.service.LabelService;
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
@RequestMapping("/api/labels")
public class LabelController {
    private final LabelService labelService;

    public LabelController(LabelService labelService) {
        this.labelService = labelService;
    }

    @GetMapping
    public ResponseEntity<?> getAll() {
        String username = currentUsername();
        return ResponseEntity.ok(labelService.getLabels(username).stream().map(LabelResponse::from).toList());
    }

    @PostMapping
    public ResponseEntity<?> create(@Valid @RequestBody LabelRequest request) {
        String username = currentUsername();
        return ResponseEntity.ok(LabelResponse.from(labelService.createLabel(username, request.getName(), request.getColor())));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id, @Valid @RequestBody LabelRequest request) {
        String username = currentUsername();
        return ResponseEntity.ok(LabelResponse.from(labelService.updateLabel(username, id, request.getName(), request.getColor())));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        String username = currentUsername();
        labelService.deleteLabel(username, id);
        return ResponseEntity.ok("Successfully deleted a label");
    }

    private String currentUsername() {
        return SecurityContextHolder.getContext().getAuthentication().getName();
    }
}
