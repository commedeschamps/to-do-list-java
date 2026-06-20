package com.example.todolist.dto;

import java.util.List;

public record AiRiskRadarResponse(
        String riskLevel,
        String summary,
        List<Risk> risks
) {
    public record Risk(String type, String title, String description, String suggestion) {
    }
}
