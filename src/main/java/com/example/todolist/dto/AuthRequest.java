package com.example.todolist.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class AuthRequest {
    @NotBlank(message = "Проверьте обязательные поля")
    private String username;

    @NotBlank(message = "Проверьте обязательные поля")
    @Size(min = 6, message = "Пароль слишком короткий")
    private String password;
}
