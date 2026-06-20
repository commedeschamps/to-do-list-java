package com.example.todolist.service.ai;

import tools.jackson.databind.ObjectMapper;

import java.util.List;
import java.util.Map;

public class FallbackAiClient implements AiClient {
    private static final String STRICT_JSON_INSTRUCTION = """
            Previous response was invalid JSON.
            Return a single valid JSON object that matches the requested schema exactly.
            Do not include markdown, comments, prose, or code fences.
            """;

    private final List<AiClient> clients;
    private final ObjectMapper objectMapper;

    public FallbackAiClient(List<AiClient> clients, ObjectMapper objectMapper) {
        this.clients = List.copyOf(clients);
        this.objectMapper = objectMapper;
    }

    @Override
    public String generateJson(String systemPrompt, String userPrompt) {
        if (clients.isEmpty()) {
            throw new AiProviderException("AI providers are not configured");
        }

        AiProviderException lastException = null;

        for (AiClient client : clients) {
            try {
                return generateValidJson(client, systemPrompt, userPrompt);
            } catch (AiProviderException exception) {
                lastException = exception;
            }
        }

        throw new AiProviderException("All AI providers failed", lastException);
    }

    private String generateValidJson(AiClient client, String systemPrompt, String userPrompt) {
        try {
            String json = client.generateJson(systemPrompt, userPrompt);
            return requireJsonObject(json);
        } catch (AiInvalidJsonException exception) {
            String retryJson = client.generateJson(systemPrompt + "\n" + STRICT_JSON_INSTRUCTION, userPrompt);
            return requireJsonObject(retryJson);
        }
    }

    private String requireJsonObject(String value) {
        String json = value == null ? "" : value.trim();

        if (json.isBlank() || json.contains("```")) {
            throw new AiInvalidJsonException("AI provider returned markdown or empty content", null);
        }

        try {
            Object parsed = objectMapper.readValue(json, Object.class);
            if (!(parsed instanceof Map<?, ?>)) {
                throw new AiInvalidJsonException("AI provider returned non-object JSON", null);
            }
            return json;
        } catch (RuntimeException exception) {
            if (exception instanceof AiInvalidJsonException invalidJsonException) {
                throw invalidJsonException;
            }
            throw new AiInvalidJsonException("AI provider returned invalid JSON", exception);
        }
    }
}
