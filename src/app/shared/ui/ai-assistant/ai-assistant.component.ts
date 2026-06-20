import { CommonModule } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Subscription, finalize } from 'rxjs';

import { AiAssistantTab, AiAssistantUiService } from '../../../core/services/ai-assistant-ui.service';
import { AiService } from '../../../core/services/ai.service';
import { TaskService } from '../../../core/services/task.service';
import {
  AiAskTasksResponse,
  AiCleanupSuggestion,
  AiRiskRadar,
  AiTodayPlan,
  AiWeeklySummary
} from '../../models/ai.model';
import { Task } from '../../models/task.model';

@Component({
  selector: 'app-ai-assistant',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './ai-assistant.component.html',
  styleUrl: './ai-assistant.component.scss'
})
export class AiAssistantComponent implements OnInit, OnDestroy {
  private readonly aiService = inject(AiService);
  private readonly taskService = inject(TaskService);
  readonly ui = inject(AiAssistantUiService);
  private readonly subscriptions = new Subscription();

  readonly questionControl = new FormControl('', { nonNullable: true });
  readonly quickPrompts = [
    'Что сделать сегодня?',
    'Какие задачи просрочены?',
    'Что можно перенести?',
    'Где узкие места?'
  ];
  readonly tabs: Array<{ value: AiAssistantTab; label: string }> = [
    { value: 'ask', label: 'Спросить' },
    { value: 'plan', label: 'План' },
    { value: 'analysis', label: 'Анализ' },
    { value: 'cleanup', label: 'Порядок' },
    { value: 'summary', label: 'Итоги' }
  ];

  isOpen = false;
  activeTab: AiAssistantTab = 'ask';
  aiEnabled = false;
  statusMessage = 'Проверяем доступность AI…';
  isLoading = false;
  errorMessage = '';
  tasks: Task[] = [];
  answer: AiAskTasksResponse | null = null;
  todayPlan: AiTodayPlan | null = null;
  riskRadar: AiRiskRadar | null = null;
  cleanupSuggestions: AiCleanupSuggestion[] = [];
  weeklySummary: AiWeeklySummary | null = null;

  ngOnInit(): void {
    this.subscriptions.add(
      this.ui.state$.subscribe((state) => {
        this.isOpen = state.isOpen;
        this.activeTab = state.tab;
      })
    );

    this.subscriptions.add(
      this.aiService.getStatus().subscribe({
        next: (status) => {
          this.aiEnabled = status.enabled;
          this.statusMessage = status.message;
        },
        error: () => {
          this.aiEnabled = false;
          this.statusMessage = 'AI-помощник временно недоступен.';
        }
      })
    );

    this.subscriptions.add(
      this.taskService.getTasks().subscribe({
        next: (tasks) => (this.tasks = tasks),
        error: () => (this.tasks = [])
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  selectTab(tab: AiAssistantTab): void {
    this.errorMessage = '';
    this.ui.selectTab(tab);
  }

  usePrompt(prompt: string): void {
    this.questionControl.setValue(prompt);
    this.selectTab('ask');
    this.ask();
  }

  ask(): void {
    const question = this.questionControl.value.trim();

    if (!question || !this.canRun) {
      return;
    }

    this.selectTab('ask');
    this.startRequest();
    this.aiService
      .askTasks(question)
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (result) => (this.answer = result),
        error: () => this.failRequest()
      });
  }

  buildPlan(): void {
    if (!this.canRun) {
      return;
    }

    this.selectTab('plan');
    this.startRequest();
    this.aiService
      .getTodayPlan()
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (result) => (this.todayPlan = result),
        error: () => this.failRequest()
      });
  }

  analyzeRisks(): void {
    if (!this.canRun) {
      return;
    }

    this.selectTab('analysis');
    this.startRequest();
    this.aiService
      .getRiskRadar()
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (result) => (this.riskRadar = result),
        error: () => this.failRequest()
      });
  }

  buildWeeklySummary(): void {
    if (!this.canRun) {
      return;
    }

    this.selectTab('summary');
    this.startRequest();
    this.aiService
      .getWeeklySummary()
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (result) => (this.weeklySummary = result),
        error: () => this.failRequest()
      });
  }

  getCleanupSuggestions(): void {
    if (!this.canRun) {
      return;
    }

    this.selectTab('cleanup');
    this.startRequest();
    this.aiService
      .getCleanupSuggestions()
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (result) => (this.cleanupSuggestions = result.suggestions),
        error: () => this.failRequest()
      });
  }

  taskTitle(taskId: number): string {
    return this.tasks.find((task) => task.id === taskId)?.title ?? `Задача #${taskId}`;
  }

  relatedTasks(taskIds: number[]): Task[] {
    return taskIds.map((id) => this.tasks.find((task) => task.id === id)).filter((task): task is Task => Boolean(task));
  }

  riskLabel(level: string): string {
    if (level === 'HIGH') {
      return 'Высокий риск';
    }

    if (level === 'MEDIUM') {
      return 'Средний риск';
    }

    return 'Низкий риск';
  }

  cleanupPreview(suggestion: AiCleanupSuggestion): string[] {
    const changes = suggestion.proposedChanges;
    const preview: string[] = [];

    if (changes.dueDate) preview.push(`Срок: ${changes.dueDate}`);
    if (changes.priority) preview.push(`Приоритет: ${changes.priority}`);
    if (changes.projectName) preview.push(`Проект: ${changes.projectName}`);
    if (changes.labelNames?.length) preview.push(`Метки: ${changes.labelNames.join(', ')}`);
    if (changes.completed !== null && changes.completed !== undefined) preview.push(changes.completed ? 'Завершить' : 'Вернуть в активные');

    return preview;
  }

  cleanText(value: string): string {
    return value
      .replace(/\*\*|__/g, '')
      .replace(/^#{1,6}\s*/gm, '')
      .replace(/^[-*]\s+/gm, '')
      .trim();
  }

  get canRun(): boolean {
    return this.aiEnabled && !this.isLoading && this.tasks.length > 0;
  }

  @HostListener('document:keydown.escape')
  closeOnEscape(): void {
    if (this.isOpen) {
      this.ui.close();
    }
  }

  private startRequest(): void {
    this.errorMessage = '';
    this.isLoading = true;
  }

  private failRequest(): void {
    this.errorMessage = 'AI не смог сформировать ответ. Попробуйте ещё раз.';
  }
}
