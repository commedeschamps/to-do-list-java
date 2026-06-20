export interface AiStatus {
  enabled: boolean;
  message: string;
}

export interface AiTodayPlan {
  summary: string;
  topTasks: Array<{
    taskId: number;
    reason: string;
  }>;
  plan: string[];
  warnings: string[];
}

export type AiRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface AiRiskRadar {
  riskLevel: AiRiskLevel;
  summary: string;
  risks: Array<{
    type: string;
    title: string;
    description: string;
    suggestion: string;
  }>;
}

export interface AiAskTasksResponse {
  answer: string;
  relatedTaskIds: number[];
  suggestedActions: string[];
}

export interface AiCleanupSuggestion {
  type: string;
  taskId: number;
  title: string;
  description: string;
  proposedChanges: {
    dueDate?: string | null;
    priority?: 'low' | 'medium' | 'high' | null;
    projectName?: string | null;
    labelNames?: string[] | null;
    completed?: boolean | null;
  };
}

export interface AiCleanupSuggestionsResponse {
  suggestions: AiCleanupSuggestion[];
}

export interface AiWeeklySummary {
  summary: string;
  completedCount: number;
  createdCount: number;
  highlights: string[];
  problems: string[];
  nextWeekSuggestions: string[];
}
