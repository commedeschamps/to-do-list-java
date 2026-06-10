package com.example.todolist.controller;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<String> handleValidation(MethodArgumentNotValidException exception) {
        String message = exception.getBindingResult()
                .getFieldErrors()
                .stream()
                .map(error -> error.getDefaultMessage() == null ? "Проверьте обязательные поля" : error.getDefaultMessage())
                .filter(text -> !text.isBlank())
                .findFirst()
                .orElse("Проверьте обязательные поля");

        return ResponseEntity.badRequest().body(message);
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<String> handleResponseStatus(ResponseStatusException exception) {
        String message = exception.getReason() == null || exception.getReason().isBlank()
                ? "Проверьте обязательные поля"
                : exception.getReason();

        return ResponseEntity.status(exception.getStatusCode()).body(message);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<String> handleDataIntegrity() {
        return ResponseEntity.status(HttpStatus.CONFLICT).body("Имя пользователя уже занято");
    }
}
