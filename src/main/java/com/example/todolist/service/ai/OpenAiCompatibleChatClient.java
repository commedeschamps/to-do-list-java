package com.example.todolist.service.ai;

import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class OpenAiCompatibleChatClient implements AiClient {
    private final AiProviderConfig config;
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;

    public OpenAiCompatibleChatClient(AiProviderConfig config, HttpClient httpClient, ObjectMapper objectMapper) {
        this.config = config;
        this.httpClient = httpClient;
        this.objectMapper = objectMapper;
    }

    @Override
    public String generateJson(String systemPrompt, String userPrompt) {
        if (!config.available()) {
            throw new AiProviderException("AI provider is not configured");
        }

        try {
            Map<String, Object> requestBody = new LinkedHashMap<>();
            requestBody.put("model", config.model());
            requestBody.put("messages", List.of(
                    Map.of("role", "system", "content", systemPrompt),
                    Map.of("role", "user", "content", userPrompt)
            ));
            requestBody.put("temperature", 0.2);

            HttpRequest request = HttpRequest.newBuilder(config.chatCompletionsUri())
                    .timeout(Duration.ofSeconds(35))
                    .header("Authorization", "Bearer " + config.apiKey())
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(requestBody)))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new AiProviderException("AI provider returned an unavailable response");
            }

            return extractMessageContent(response.body());
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new AiProviderException("AI provider request was interrupted", exception);
        } catch (IOException | RuntimeException exception) {
            if (exception instanceof AiProviderException providerException) {
                throw providerException;
            }
            throw new AiProviderException("AI provider request failed", exception);
        }
    }

    private String extractMessageContent(String responseBody) throws IOException {
        Map<?, ?> root = objectMapper.readValue(responseBody, Map.class);
        Object choicesObject = root.get("choices");

        if (!(choicesObject instanceof List<?> choices) || choices.isEmpty()) {
            throw new AiProviderException("AI provider response did not include choices");
        }

        Object firstChoice = choices.get(0);
        if (!(firstChoice instanceof Map<?, ?> choice)) {
            throw new AiProviderException("AI provider response choice is invalid");
        }

        Object messageObject = choice.get("message");
        if (!(messageObject instanceof Map<?, ?> message)) {
            throw new AiProviderException("AI provider response message is invalid");
        }

        Object content = message.get("content");
        if (content instanceof String text && !text.isBlank()) {
            return text.trim();
        }

        throw new AiProviderException("AI provider response content is empty");
    }
}
