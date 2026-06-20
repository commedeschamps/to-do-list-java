package com.example.todolist.dto;

import java.util.List;

public record AiCleanupSuggestionsResponse(List<Suggestion> suggestions) {
    public record Suggestion(
            String type,
            Long taskId,
            String title,
            String description,
            ProposedChanges proposedChanges
    ) {
    }

    public record ProposedChanges(
            String dueDate,
            String priority,
            String projectName,
            List<String> labelNames,
            Boolean completed
    ) {
    }
}
