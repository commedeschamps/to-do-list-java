package com.example.todolist.service;

import com.example.todolist.dto.AiAskTasksResponse;
import com.example.todolist.dto.AiCleanupSuggestionsResponse;
import com.example.todolist.dto.AiRiskRadarResponse;
import com.example.todolist.dto.AiStatusResponse;
import com.example.todolist.dto.AiTodayPlanResponse;
import com.example.todolist.dto.AiWeeklySummaryResponse;
import com.example.todolist.entity.Label;
import com.example.todolist.entity.Task;
import com.example.todolist.repository.TaskRepository;
import com.example.todolist.service.ai.AiClient;
import com.example.todolist.service.ai.AiClientFactory;
import com.example.todolist.service.ai.AiProviderException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class AiService {
    private static final int TASK_CONTEXT_LIMIT = 100;
    private static final int LABEL_CONTEXT_LIMIT = 5;
    private static final int RESPONSE_LIST_LIMIT = 7;
    private static final int RESPONSE_TEXT_LIMIT = 800;
    private static final String AI_UNAVAILABLE_MESSAGE = "AI-помощник временно недоступен. Попробуйте позже.";
    private static final String AI_INVALID_RESPONSE_MESSAGE = "AI не смог сформировать ответ. Попробуйте ещё раз.";
    private static final Set<String> CLEANUP_TYPES = Set.of(
            "ADD_DUE_DATE",
            "SUGGEST_PROJECT",
            "SUGGEST_LABEL",
            "MERGE_DUPLICATE",
            "CHANGE_PRIORITY",
            "COMPLETE_OLD_TASK"
    );

    private final TaskRepository taskRepository;
    private final ObjectMapper objectMapper;
    private final AiClient aiClient;
    private final AiClientFactory aiClientFactory;

    public AiService(
            TaskRepository taskRepository,
            ObjectMapper objectMapper,
            AiClientFactory aiClientFactory
    ) {
        this.taskRepository = taskRepository;
        this.objectMapper = objectMapper;
        this.aiClientFactory = aiClientFactory;
        this.aiClient = aiClientFactory.createClient();
    }

    public AiStatusResponse status() {
        boolean available = isAvailable();
        return new AiStatusResponse(
                available,
                available ? "AI-помощник готов." : AI_UNAVAILABLE_MESSAGE
        );
    }

    @Transactional(readOnly = true)
    public AiTodayPlanResponse todayPlan(String username) {
        TaskContext context = buildContext(username);
        AiTodayPlanResponse response = callAi(
                "today-plan",
                todayPlanPrompt(),
                context,
                AiTodayPlanResponse.class
        );
        validateTodayPlan(response, context.taskIds());
        return response;
    }

    @Transactional(readOnly = true)
    public AiRiskRadarResponse riskRadar(String username) {
        TaskContext context = buildContext(username);
        AiRiskRadarResponse response = callAi(
                "risk-radar",
                riskRadarPrompt(),
                context,
                AiRiskRadarResponse.class
        );
        validateRiskRadar(response);
        return response;
    }

    @Transactional(readOnly = true)
    public AiAskTasksResponse askTasks(String username, String question) {
        String normalizedQuestion = question == null ? "" : question.trim();
        TaskContext context = buildContext(username);
        Map<String, Object> extra = Map.of("question", normalizedQuestion);
        AiAskTasksResponse response = callAi(
                "ask-tasks",
                askTasksPrompt(),
                context.withExtra(extra),
                AiAskTasksResponse.class
        );
        validateAskTasks(response, context.taskIds());
        return response;
    }

    @Transactional(readOnly = true)
    public AiCleanupSuggestionsResponse autoCleanup(String username) {
        TaskContext context = buildContext(username);
        AiCleanupSuggestionsResponse response = callAi(
                "auto-cleanup",
                autoCleanupPrompt(),
                context,
                AiCleanupSuggestionsResponse.class
        );
        validateCleanup(response, context.taskIds());
        return response;
    }

    @Transactional(readOnly = true)
    public AiWeeklySummaryResponse weeklySummary(String username) {
        TaskContext context = buildContext(username);
        AiWeeklySummaryResponse response = callAi(
                "weekly-summary",
                weeklySummaryPrompt(),
                context,
                AiWeeklySummaryResponse.class
        );
        validateWeeklySummary(response);
        return response;
    }

    private boolean isAvailable() {
        return aiClientFactory.available();
    }

    private <T> T callAi(String mode, String prompt, Object context, Class<T> responseType) {
        if (!isAvailable()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, AI_UNAVAILABLE_MESSAGE);
        }

        try {
            String content = aiClient.generateJson(prompt, objectMapper.writeValueAsString(context));
            return objectMapper.readValue(content, responseType);
        } catch (AiProviderException exception) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, AI_UNAVAILABLE_MESSAGE);
        } catch (RuntimeException exception) {
            if (exception instanceof ResponseStatusException responseStatusException) {
                throw responseStatusException;
            }
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, AI_INVALID_RESPONSE_MESSAGE);
        }
    }

    private TaskContext buildContext(String username) {
        List<Task> allTasks = taskRepository.findByUserUsername(username);
        return toTaskContext(username, allTasks);
    }

    private TaskContext toTaskContext(String username, List<Task> allTasks) {
        LocalDate today = LocalDate.now();
        List<Task> sortedTasks = allTasks.stream()
                .sorted(contextComparator())
                .toList();
        List<Map<String, Object>> taskContext = sortedTasks.stream()
                .limit(TASK_CONTEXT_LIMIT)
                .map(this::taskContext)
                .toList();
        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("totalTasks", allTasks.size());
        stats.put("sentTasks", taskContext.size());
        stats.put("activeTasks", allTasks.stream().filter(task -> !task.isCompleted()).count());
        stats.put("completedTasks", allTasks.stream().filter(Task::isCompleted).count());
        stats.put("overdueTasks", allTasks.stream().filter(task -> isOverdue(task, today)).count());
        stats.put("highPriorityTasks", allTasks.stream().filter(task -> "high".equalsIgnoreCase(task.getPriority())).count());
        stats.put("withoutDueDate", allTasks.stream().filter(task -> task.getDueDate() == null).count());
        stats.put("withoutProject", allTasks.stream().filter(task -> task.getProject() == null).count());

        return new TaskContext(
                LocalDate.now().toString(),
                stats,
                taskContext,
                taskContext.stream()
                        .map(item -> item.get("taskId"))
                        .filter(Long.class::isInstance)
                        .map(Long.class::cast)
                        .collect(Collectors.toSet()),
                Map.of()
        );
    }

    private Comparator<Task> contextComparator() {
        return Comparator
                .comparing(Task::isCompleted)
                .thenComparing((Task task) -> task.getDueDate() == null)
                .thenComparing(task -> task.getDueDate() == null ? LocalDate.MAX : task.getDueDate())
                .thenComparing((Task task) -> priorityRank(task.getPriority()), Comparator.reverseOrder())
                .thenComparing(task -> task.getUpdatedAt() == null ? LocalDateTime.MIN : task.getUpdatedAt(), Comparator.reverseOrder());
    }

    private Map<String, Object> taskContext(Task task) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("taskId", task.getId());
        item.put("title", task.getTitle());
        item.put("description", task.getDescription());
        item.put("completed", task.isCompleted());
        item.put("priority", normalizePriority(task.getPriority()));
        item.put("dueDate", task.getDueDate() == null ? null : task.getDueDate().toString());
        item.put("createdAt", task.getCreatedAt() == null ? null : task.getCreatedAt().toString());
        item.put("completedAt", task.getCompletedAt() == null ? null : task.getCompletedAt().toString());
        item.put("project", task.getProject() == null ? null : task.getProject().getName());
        item.put("labels", task.getLabels().stream().map(Label::getName).sorted().limit(LABEL_CONTEXT_LIMIT).toList());
        item.put("subtasks", Map.of(
                "total", task.getSubtasks().size(),
                "completed", task.getSubtasks().stream().filter(subtask -> subtask.isCompleted()).count()
        ));
        return item;
    }

    private boolean isOverdue(Task task, LocalDate today) {
        return !task.isCompleted() && task.getDueDate() != null && task.getDueDate().isBefore(today);
    }

    private int priorityRank(String priority) {
        return switch (normalizePriority(priority)) {
            case "high" -> 3;
            case "medium" -> 2;
            default -> 1;
        };
    }

    private String normalizePriority(String priority) {
        if (priority == null) {
            return "medium";
        }

        String normalized = priority.toLowerCase(Locale.ROOT);
        return normalized.equals("low") || normalized.equals("medium") || normalized.equals("high") ? normalized : "medium";
    }

    private void validateTodayPlan(AiTodayPlanResponse response, Set<Long> taskIds) {
        requireText(response.summary());
        requireList(response.plan(), RESPONSE_LIST_LIMIT);
        requireList(response.warnings(), RESPONSE_LIST_LIMIT);
        requireList(response.topTasks(), RESPONSE_LIST_LIMIT);
        for (AiTodayPlanResponse.TopTask topTask : response.topTasks()) {
            requireTaskId(topTask.taskId(), taskIds);
            requireText(topTask.reason());
        }
    }

    private void validateRiskRadar(AiRiskRadarResponse response) {
        if (!List.of("LOW", "MEDIUM", "HIGH").contains(response.riskLevel())) {
            invalidAiResponse();
        }
        requireText(response.summary());
        requireList(response.risks(), RESPONSE_LIST_LIMIT);
        for (AiRiskRadarResponse.Risk risk : response.risks()) {
            requireText(risk.type());
            requireText(risk.title());
            requireText(risk.description());
            requireText(risk.suggestion());
        }
    }

    private void validateAskTasks(AiAskTasksResponse response, Set<Long> taskIds) {
        requireText(response.answer());
        requireList(response.relatedTaskIds(), RESPONSE_LIST_LIMIT);
        for (Long taskId : response.relatedTaskIds()) {
            requireTaskId(taskId, taskIds);
        }
        requireList(response.suggestedActions(), RESPONSE_LIST_LIMIT);
    }

    private void validateCleanup(AiCleanupSuggestionsResponse response, Set<Long> taskIds) {
        requireList(response.suggestions(), RESPONSE_LIST_LIMIT);
        for (AiCleanupSuggestionsResponse.Suggestion suggestion : response.suggestions()) {
            if (!CLEANUP_TYPES.contains(suggestion.type())) {
                invalidAiResponse();
            }
            requireTaskId(suggestion.taskId(), taskIds);
            requireText(suggestion.title());
            requireText(suggestion.description());
            if (suggestion.proposedChanges() == null) {
                invalidAiResponse();
            }
            validateProposedChanges(suggestion.proposedChanges());
        }
    }

    private void validateProposedChanges(AiCleanupSuggestionsResponse.ProposedChanges changes) {
        if (changes.dueDate() != null && !changes.dueDate().isBlank()) {
            try {
                LocalDate.parse(changes.dueDate());
            } catch (RuntimeException exception) {
                invalidAiResponse();
            }
        }

        if (changes.priority() != null && !changes.priority().isBlank()) {
            String priority = changes.priority().toLowerCase(Locale.ROOT);
            if (!priority.equals("low") && !priority.equals("medium") && !priority.equals("high")) {
                invalidAiResponse();
            }
        }

        if (changes.labelNames() != null && changes.labelNames().stream().anyMatch(name -> name == null || name.isBlank())) {
            invalidAiResponse();
        }

        if (changes.labelNames() != null && changes.labelNames().size() > LABEL_CONTEXT_LIMIT) {
            invalidAiResponse();
        }
    }

    private void validateWeeklySummary(AiWeeklySummaryResponse response) {
        requireText(response.summary());
        if (response.completedCount() < 0 || response.createdCount() < 0) {
            invalidAiResponse();
        }
        requireList(response.highlights(), RESPONSE_LIST_LIMIT);
        requireList(response.problems(), RESPONSE_LIST_LIMIT);
        requireList(response.nextWeekSuggestions(), RESPONSE_LIST_LIMIT);
    }

    private void requireTaskId(Long taskId, Set<Long> taskIds) {
        if (taskId == null || !taskIds.contains(taskId)) {
            invalidAiResponse();
        }
    }

    private void requireText(String text) {
        if (text == null || text.isBlank() || text.length() > RESPONSE_TEXT_LIMIT || text.contains("```")) {
            invalidAiResponse();
        }
    }

    private void requireList(List<?> values, int limit) {
        if (values == null || values.size() > limit || values.stream().anyMatch(Objects::isNull)) {
            invalidAiResponse();
        }

        for (Object value : values) {
            if (value instanceof String text) {
                requireText(text);
            }
        }
    }

    private void invalidAiResponse() {
        throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, AI_INVALID_RESPONSE_MESSAGE);
    }

    private String basePrompt(String mode) {
        return """
                You are an AI Productivity Assistant for a task manager.
                Mode: %s.
                Return only valid JSON.
                Do not include markdown.
                Do not invent tasks.
                Use only the provided task context.
                Use only taskId values present in the context.
                Return at most 7 items in any array.
                Keep every string under 800 characters.
                Keep recommendations concise and practical.
                Answer in Russian.
                Never request or reveal secrets, tokens, passwords, user ids, database credentials, or logs.
                """.formatted(mode);
    }

    private String todayPlanPrompt() {
        return basePrompt("today-plan") + """
                Return schema:
                {"summary":"...","topTasks":[{"taskId":1,"reason":"..."}],"plan":["..."],"warnings":["..."]}
                Choose 3 to 5 topTasks when possible. If there are no tasks, return empty topTasks and practical empty-state text.
                """;
    }

    private String riskRadarPrompt() {
        return basePrompt("risk-radar") + """
                Return schema:
                {"riskLevel":"LOW|MEDIUM|HIGH","summary":"...","risks":[{"type":"OVERDUE_TASKS","title":"...","description":"...","suggestion":"..."}]}
                Look for overdue tasks, high priority tasks without due date, overloaded projects, tasks without project, tasks without due date, too many high priority tasks, and stale tasks.
                """;
    }

    private String askTasksPrompt() {
        return basePrompt("ask-tasks") + """
                Return schema:
                {"answer":"...","relatedTaskIds":[1,2],"suggestedActions":["..."]}
                Answer only questions about the provided tasks. If the question is not about tasks, answer exactly: "Я могу отвечать только по вашим задачам." and use empty arrays.
                """;
    }

    private String autoCleanupPrompt() {
        return basePrompt("auto-cleanup") + """
                Return schema:
                {"suggestions":[{"type":"ADD_DUE_DATE","taskId":1,"title":"...","description":"...","proposedChanges":{"dueDate":"YYYY-MM-DD","priority":"low|medium|high","projectName":"...","labelNames":["..."],"completed":false}}]}
                Use only these suggestion types: ADD_DUE_DATE, SUGGEST_PROJECT, SUGGEST_LABEL, MERGE_DUPLICATE, CHANGE_PRIORITY, COMPLETE_OLD_TASK.
                Do not apply changes. Suggest only one task per suggestion.
                """;
    }

    private String weeklySummaryPrompt() {
        return basePrompt("weekly-summary") + """
                Return schema:
                {"summary":"...","completedCount":0,"createdCount":0,"highlights":["..."],"problems":["..."],"nextWeekSuggestions":["..."]}
                Focus on the last 7 days using createdAt and completedAt.
                """;
    }

    private record TaskContext(
            String today,
            Map<String, Object> stats,
            List<Map<String, Object>> tasks,
            Set<Long> taskIds,
            Map<String, Object> extra
    ) {
        private TaskContext withExtra(Map<String, Object> nextExtra) {
            return new TaskContext(today, stats, tasks, taskIds, nextExtra);
        }
    }
}
