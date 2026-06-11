package com.example.todolist.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.time.LocalDate;
import java.util.Set;

@Data
public class TaskRequest {
    @NotBlank(message = "Название задачи обязательно")
    private String title;
    private String description;
    private boolean completed;
    private String priority;
    private LocalDate dueDate;
    private Long projectId;
    private Set<Long> labelIds;
    private String color;
}
