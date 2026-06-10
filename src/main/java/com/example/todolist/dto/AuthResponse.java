package com.example.todolist.dto;

public record AuthResponse(String token, CurrentUserResponse user) {
}
