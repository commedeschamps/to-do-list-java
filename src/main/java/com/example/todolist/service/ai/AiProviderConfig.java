package com.example.todolist.service.ai;

import java.net.URI;

public record AiProviderConfig(
        String provider,
        URI baseUrl,
        String model,
        String apiKey,
        boolean enabled
) {
    public boolean available() {
        return enabled
                && provider != null
                && !provider.isBlank()
                && baseUrl != null
                && model != null
                && !model.isBlank()
                && apiKey != null
                && !apiKey.isBlank();
    }

    public URI chatCompletionsUri() {
        String normalizedBaseUrl = baseUrl.toString().replaceAll("/+$", "");
        return URI.create(normalizedBaseUrl + "/chat/completions");
    }
}
