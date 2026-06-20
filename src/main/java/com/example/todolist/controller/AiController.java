package com.example.todolist.controller;

import com.example.todolist.dto.AiAskTasksRequest;
import com.example.todolist.dto.AiAskTasksResponse;
import com.example.todolist.dto.AiCleanupSuggestionsResponse;
import com.example.todolist.dto.AiRiskRadarResponse;
import com.example.todolist.dto.AiStatusResponse;
import com.example.todolist.dto.AiTodayPlanResponse;
import com.example.todolist.dto.AiWeeklySummaryResponse;
import com.example.todolist.service.AiService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/ai")
public class AiController {
    private final AiService aiService;

    public AiController(AiService aiService) {
        this.aiService = aiService;
    }

    @GetMapping("/status")
    public ResponseEntity<AiStatusResponse> status() {
        return ResponseEntity.ok(aiService.status());
    }

    @PostMapping("/today-plan")
    public ResponseEntity<AiTodayPlanResponse> todayPlan(Authentication authentication) {
        return ResponseEntity.ok(aiService.todayPlan(authentication.getName()));
    }

    @PostMapping("/risk-radar")
    public ResponseEntity<AiRiskRadarResponse> riskRadar(Authentication authentication) {
        return ResponseEntity.ok(aiService.riskRadar(authentication.getName()));
    }

    @PostMapping("/ask-tasks")
    public ResponseEntity<AiAskTasksResponse> askTasks(
            Authentication authentication,
            @Valid @RequestBody AiAskTasksRequest request
    ) {
        return ResponseEntity.ok(aiService.askTasks(authentication.getName(), request.question()));
    }

    @PostMapping("/auto-cleanup")
    public ResponseEntity<AiCleanupSuggestionsResponse> autoCleanup(Authentication authentication) {
        return ResponseEntity.ok(aiService.autoCleanup(authentication.getName()));
    }

    @PostMapping("/weekly-summary")
    public ResponseEntity<AiWeeklySummaryResponse> weeklySummary(Authentication authentication) {
        return ResponseEntity.ok(aiService.weeklySummary(authentication.getName()));
    }
}
