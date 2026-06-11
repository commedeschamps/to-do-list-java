package com.example.todolist.dto;

import com.example.todolist.entity.Label;

import java.time.LocalDateTime;

public record LabelResponse(
        Long id,
        String name,
        String color,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public static LabelResponse from(Label label) {
        return new LabelResponse(
                label.getId(),
                label.getName(),
                label.getColor(),
                label.getCreatedAt(),
                label.getUpdatedAt()
        );
    }
}
