package com.example.todolist.service.ai;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

import java.util.ArrayDeque;
import java.util.List;
import java.util.Queue;

import static org.assertj.core.api.Assertions.assertThat;

class FallbackAiClientTests {
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void fallsBackWhenPrimaryProviderFails() {
        AiClient primary = (systemPrompt, userPrompt) -> {
            throw new AiProviderException("primary failed");
        };
        QueueClient fallback = new QueueClient("{\"answer\":\"ok\"}");
        FallbackAiClient client = new FallbackAiClient(List.of(primary, fallback), objectMapper);

        String response = client.generateJson("system", "user");

        assertThat(response).isEqualTo("{\"answer\":\"ok\"}");
        assertThat(fallback.calls()).isEqualTo(1);
    }

    @Test
    void retriesProviderOnceWhenJsonIsInvalid() {
        QueueClient primary = new QueueClient("not json", "{\"answer\":\"retry ok\"}");
        FallbackAiClient client = new FallbackAiClient(List.of(primary), objectMapper);

        String response = client.generateJson("system", "user");

        assertThat(response).isEqualTo("{\"answer\":\"retry ok\"}");
        assertThat(primary.calls()).isEqualTo(2);
    }

    @Test
    void fallsBackAfterInvalidJsonRetryFails() {
        QueueClient primary = new QueueClient("not json", "still not json");
        QueueClient backup = new QueueClient("{\"answer\":\"backup ok\"}");
        FallbackAiClient client = new FallbackAiClient(List.of(primary, backup), objectMapper);

        String response = client.generateJson("system", "user");

        assertThat(response).isEqualTo("{\"answer\":\"backup ok\"}");
        assertThat(primary.calls()).isEqualTo(2);
        assertThat(backup.calls()).isEqualTo(1);
    }

    private static class QueueClient implements AiClient {
        private final Queue<String> responses;
        private int calls;

        QueueClient(String... responses) {
            this.responses = new ArrayDeque<>(List.of(responses));
        }

        @Override
        public String generateJson(String systemPrompt, String userPrompt) {
            calls++;
            return responses.remove();
        }

        int calls() {
            return calls;
        }
    }
}
