package com.example.todolist.dto;

import com.example.todolist.entity.Task;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;

public record TaskResponse(
        Long id,
        String title,
        String description,
        boolean completed,
        String priority,
        LocalDate dueDate,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        LocalDateTime completedAt,
        ProjectResponse project,
        List<LabelResponse> labels,
        String color,
        int subtaskTotal,
        int subtaskCompleted
) {
    public static TaskResponse from(Task task) {
        List<LabelResponse> labelResponses = task.getLabels()
                .stream()
                .sorted(Comparator.comparing(label -> label.getName().toLowerCase()))
                .map(LabelResponse::from)
                .toList();
        int subtaskTotal = task.getSubtasks().size();
        int subtaskCompleted = (int) task.getSubtasks().stream().filter(subtask -> subtask.isCompleted()).count();

        return new TaskResponse(
                task.getId(),
                task.getTitle(),
                task.getDescription(),
                task.isCompleted(),
                task.getPriority(),
                task.getDueDate(),
                task.getCreatedAt(),
                task.getUpdatedAt(),
                task.getCompletedAt(),
                ProjectResponse.from(task.getProject()),
                labelResponses,
                task.getColor(),
                subtaskTotal,
                subtaskCompleted
        );
    }
}
