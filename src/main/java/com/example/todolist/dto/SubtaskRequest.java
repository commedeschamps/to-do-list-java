package com.example.todolist.dto;

import lombok.Data;

@Data
public class SubtaskRequest {
    private String title;
    private Boolean completed;
}
