package com.example.todolist.dto;

import java.util.List;

public record AiWeeklySummaryResponse(
        String summary,
        int completedCount,
        int createdCount,
        List<String> highlights,
        List<String> problems,
        List<String> nextWeekSuggestions
) {
}
