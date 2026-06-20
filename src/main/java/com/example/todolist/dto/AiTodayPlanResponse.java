package com.example.todolist.dto;

import java.util.List;

public record AiTodayPlanResponse(
        String summary,
        List<TopTask> topTasks,
        List<String> plan,
        List<String> warnings
) {
    public record TopTask(Long taskId, String reason) {
    }
}
