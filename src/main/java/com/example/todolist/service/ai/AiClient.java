package com.example.todolist.service.ai;

public interface AiClient {
    String generateJson(String systemPrompt, String userPrompt);
}
