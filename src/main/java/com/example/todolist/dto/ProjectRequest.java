package com.example.todolist.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ProjectRequest {
    @NotBlank(message = "Название проекта обязательно")
    private String name;
    private String color;
}
