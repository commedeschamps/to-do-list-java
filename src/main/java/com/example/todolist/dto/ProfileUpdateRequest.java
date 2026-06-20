package com.example.todolist.dto;

import jakarta.validation.constraints.Size;

public record ProfileUpdateRequest(
        @Size(max = 80, message = "Отображаемое имя должно быть не длиннее 80 символов")
        String displayName
) {
}
