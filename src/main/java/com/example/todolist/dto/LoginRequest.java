package com.example.todolist.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class LoginRequest {
    @NotBlank(message = "Проверьте обязательные поля")
    private String username;

    @NotBlank(message = "Проверьте обязательные поля")
    private String password;
}
