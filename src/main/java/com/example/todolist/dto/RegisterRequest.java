package com.example.todolist.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class RegisterRequest {
    @NotBlank(message = "Проверьте обязательные поля")
    @Size(min = 3, max = 30, message = "Имя пользователя должно быть от 3 до 30 символов")
    private String username;

    @NotBlank(message = "Проверьте обязательные поля")
    @Size(min = 6, message = "Пароль слишком короткий")
    private String password;
}
