import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  AiAskTasksResponse,
  AiCleanupSuggestionsResponse,
  AiRiskRadar,
  AiStatus,
  AiTodayPlan,
  AiWeeklySummary
} from '../../shared/models/ai.model';

@Injectable({
  providedIn: 'root'
})
export class AiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/ai`;

  getStatus(): Observable<AiStatus> {
    return this.http.get<AiStatus>(`${this.apiUrl}/status`);
  }

  getTodayPlan(): Observable<AiTodayPlan> {
    return this.http.post<AiTodayPlan>(`${this.apiUrl}/today-plan`, {});
  }

  getRiskRadar(): Observable<AiRiskRadar> {
    return this.http.post<AiRiskRadar>(`${this.apiUrl}/risk-radar`, {});
  }

  askTasks(question: string): Observable<AiAskTasksResponse> {
    return this.http.post<AiAskTasksResponse>(`${this.apiUrl}/ask-tasks`, { question });
  }

  getCleanupSuggestions(): Observable<AiCleanupSuggestionsResponse> {
    return this.http.post<AiCleanupSuggestionsResponse>(`${this.apiUrl}/auto-cleanup`, {});
  }

  getWeeklySummary(): Observable<AiWeeklySummary> {
    return this.http.post<AiWeeklySummary>(`${this.apiUrl}/weekly-summary`, {});
  }
}
