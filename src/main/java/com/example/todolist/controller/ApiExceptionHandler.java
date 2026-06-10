package com.example.todolist.controller;

import com.example.todolist.dto.ApiErrorResponse;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiErrorResponse> handleValidation(MethodArgumentNotValidException exception) {
        String message = exception.getBindingResult()
                .getFieldErrors()
                .stream()
                .map(error -> error.getDefaultMessage() == null ? "Проверьте обязательные поля" : error.getDefaultMessage())
                .filter(text -> !text.isBlank())
                .findFirst()
                .orElse("Проверьте обязательные поля");

        return ResponseEntity.badRequest().body(new ApiErrorResponse(message));
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ApiErrorResponse> handleResponseStatus(ResponseStatusException exception) {
        String message = exception.getReason() == null || exception.getReason().isBlank()
                ? "Проверьте обязательные поля"
                : exception.getReason();

        return ResponseEntity.status(exception.getStatusCode()).body(new ApiErrorResponse(message));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiErrorResponse> handleDataIntegrity() {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ApiErrorResponse("Имя пользователя уже занято"));
    }

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<ApiErrorResponse> handleBadCredentials() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new ApiErrorResponse("Неверное имя пользователя или пароль"));
    }
}
