package com.example.todolist.dto;

import com.example.todolist.entity.Project;

import java.time.LocalDateTime;

public record ProjectResponse(
        Long id,
        String name,
        String color,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public static ProjectResponse from(Project project) {
        if (project == null) {
            return null;
        }

        return new ProjectResponse(
                project.getId(),
                project.getName(),
                project.getColor(),
                project.getCreatedAt(),
                project.getUpdatedAt()
        );
    }
}
