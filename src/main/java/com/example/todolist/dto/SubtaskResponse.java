package com.example.todolist.dto;

import com.example.todolist.entity.Subtask;

import java.time.LocalDateTime;

public record SubtaskResponse(
        Long id,
        String title,
        boolean completed,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public static SubtaskResponse from(Subtask subtask) {
        return new SubtaskResponse(
                subtask.getId(),
                subtask.getTitle(),
                subtask.isCompleted(),
                subtask.getCreatedAt(),
                subtask.getUpdatedAt()
        );
    }
}
