package com.example.todolist.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AiAskTasksRequest(
        @NotBlank(message = "Введите вопрос по задачам")
        @Size(max = 300, message = "Вопрос слишком длинный")
        String question
) {
}
