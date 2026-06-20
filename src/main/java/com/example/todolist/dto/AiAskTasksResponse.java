package com.example.todolist.dto;

import java.util.List;

public record AiAskTasksResponse(
        String answer,
        List<Long> relatedTaskIds,
        List<String> suggestedActions
) {
}
