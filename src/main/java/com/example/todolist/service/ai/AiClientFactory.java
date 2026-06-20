package com.example.todolist.service.ai;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.URISyntaxException;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.List;

@Component
public class AiClientFactory {
    private final boolean enabled;
    private final List<AiProviderConfig> providerConfigs;
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;

    public AiClientFactory(
            ObjectMapper objectMapper,
            @Value("${ai.enabled:false}") boolean enabled,
            @Value("${ai.primary.provider:gemini}") String primaryProvider,
            @Value("${ai.primary.base-url:https://generativelanguage.googleapis.com/v1beta/openai}") String primaryBaseUrl,
            @Value("${ai.primary.model:gemini-2.5-flash}") String primaryModel,
            @Value("${ai.primary.api-key:}") String primaryApiKey,
            @Value("${ai.fallback.enabled:true}") boolean fallbackEnabled,
            @Value("${ai.fallback.provider:groq}") String fallbackProvider,
            @Value("${ai.fallback.base-url:https://api.groq.com/openai/v1}") String fallbackBaseUrl,
            @Value("${ai.fallback.model:llama-3.1-8b-instant}") String fallbackModel,
            @Value("${ai.fallback.api-key:}") String fallbackApiKey,
            @Value("${ai.backup.enabled:true}") boolean backupEnabled,
            @Value("${ai.backup.provider:openrouter}") String backupProvider,
            @Value("${ai.backup.base-url:https://openrouter.ai/api/v1}") String backupBaseUrl,
            @Value("${ai.backup.model:openrouter/free}") String backupModel,
            @Value("${ai.backup.api-key:}") String backupApiKey
    ) {
        this.enabled = enabled;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
        this.providerConfigs = List.of(
                buildConfig(primaryProvider, primaryBaseUrl, primaryModel, primaryApiKey, enabled),
                buildConfig(fallbackProvider, fallbackBaseUrl, fallbackModel, fallbackApiKey, enabled && fallbackEnabled),
                buildConfig(backupProvider, backupBaseUrl, backupModel, backupApiKey, enabled && backupEnabled)
        );
    }

    public AiClient createClient() {
        List<AiClient> clients = providerConfigs.stream()
                .filter(AiProviderConfig::available)
                .map(config -> new OpenAiCompatibleChatClient(config, httpClient, objectMapper))
                .map(AiClient.class::cast)
                .toList();

        return new FallbackAiClient(clients, objectMapper);
    }

    public boolean available() {
        return enabled && providerConfigs.stream().anyMatch(AiProviderConfig::available);
    }

    private AiProviderConfig buildConfig(String provider, String baseUrl, String model, String apiKey, boolean providerEnabled) {
        return new AiProviderConfig(
                trimToEmpty(provider),
                parseUri(baseUrl),
                trimToEmpty(model),
                trimToEmpty(apiKey),
                providerEnabled
        );
    }

    private URI parseUri(String baseUrl) {
        String normalized = trimToEmpty(baseUrl);
        if (normalized.isBlank()) {
            return null;
        }

        try {
            return new URI(normalized);
        } catch (URISyntaxException exception) {
            return null;
        }
    }

    private String trimToEmpty(String value) {
        return value == null ? "" : value.trim();
    }
}
