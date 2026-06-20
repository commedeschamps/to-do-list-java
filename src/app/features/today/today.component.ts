import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';

import { AiAssistantUiService } from '../../core/services/ai-assistant-ui.service';
import { AiService } from '../../core/services/ai.service';
import { TaskService } from '../../core/services/task.service';
import { AiTodayPlan } from '../../shared/models/ai.model';
import { Task, TaskPriority } from '../../shared/models/task.model';
import { ToastService } from '../../shared/ui/toast/toast.service';

@Component({
  selector: 'app-today',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './today.component.html',
  styleUrl: './today.component.scss'
})
export class TodayComponent implements OnInit {
  private readonly taskService = inject(TaskService);
  private readonly aiService = inject(AiService);
  private readonly assistantUi = inject(AiAssistantUiService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);

  tasks: Task[] = [];
  isLoading = false;
  listErrorMessage = '';
  aiEnabled = false;
  aiStatusMessage = 'Проверяем доступность AI.';
  aiErrorMessage = '';
  aiPlan: AiTodayPlan | null = null;
  isAiLoading = false;

  ngOnInit(): void {
    this.loadTasks();
    this.loadAiStatus();
  }

  get activeTasks(): Task[] {
    return this.tasks.filter((task) => !task.completed);
  }

  get focusTasks(): Task[] {
    const priorityWeight: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };

    return [...this.activeTasks]
      .sort((left, right) => {
        const priorityDelta = priorityWeight[this.taskPriority(left)] - priorityWeight[this.taskPriority(right)];

        if (priorityDelta !== 0) {
          return priorityDelta;
        }

        if (!left.dueDate) return 1;
        if (!right.dueDate) return -1;
        return left.dueDate.localeCompare(right.dueDate);
      })
      .slice(0, 3);
  }

  get todayDateLabel(): string {
    return new Intl.DateTimeFormat('ru-RU', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    }).format(new Date());
  }

  get activeCount(): number {
    return this.activeTasks.length;
  }

  get highPriorityCount(): number {
    return this.tasks.filter((task) => this.taskPriority(task) === 'high').length;
  }

  get completedCount(): number {
    return this.tasks.filter((task) => task.completed).length;
  }

  get overdueTasks(): Task[] {
    return this.activeTasks.filter((task) => Boolean(task.dueDate && task.dueDate < this.todayKey));
  }

  get todayTasks(): Task[] {
    return this.activeTasks.filter((task) => task.dueDate === this.todayKey);
  }

  get unscheduledTasks(): Task[] {
    return this.activeTasks.filter((task) => !task.dueDate);
  }

  get agendaTasksCount(): number {
    return this.overdueTasks.length + this.todayTasks.length + this.unscheduledTasks.length;
  }

  loadTasks(): void {
    this.isLoading = true;
    this.listErrorMessage = '';

    this.taskService
      .getTasks()
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (tasks) => {
          this.tasks = tasks.map((task) => this.withNormalizedPriority(task));
        },
        error: () => {
          this.listErrorMessage = 'Не удалось загрузить задачи.';
          this.toastService.show('Не удалось загрузить задачи', 'error');
        }
      });
  }

  loadAiStatus(): void {
    this.aiService.getStatus().subscribe({
      next: (status) => {
        this.aiEnabled = status.enabled;
        this.aiStatusMessage = status.message;
      },
      error: () => {
        this.aiEnabled = false;
        this.aiStatusMessage = 'AI-помощник временно недоступен. Попробуйте позже.';
      }
    });
  }

  buildTodayPlan(): void {
    if (!this.aiEnabled || this.isAiLoading || !this.tasks.length) {
      return;
    }

    this.aiErrorMessage = '';
    this.isAiLoading = true;
    this.aiService
      .getTodayPlan()
      .pipe(finalize(() => (this.isAiLoading = false)))
      .subscribe({
        next: (plan) => {
          this.aiPlan = plan;
        },
        error: () => {
          this.aiErrorMessage = 'AI не смог сформировать ответ. Попробуйте ещё раз.';
          this.toastService.show('AI-план недоступен', 'error');
        }
      });
  }

  openAiPlanner(): void {
    this.assistantUi.open('plan');
  }

  openTask(taskId: number): void {
    void this.router.navigate(['/tasks'], { queryParams: { task: taskId } });
  }

  createTask(): void {
    void this.router.navigate(['/tasks'], { queryParams: { create: '1' } });
  }

  taskTitle(taskId: number): string {
    return this.tasks.find((task) => task.id === taskId)?.title ?? `Задача #${taskId}`;
  }

  toggleCompleted(task: Task): void {
    this.taskService
      .updateTask(task.id, {
        title: task.title,
        description: task.description ?? null,
        completed: !task.completed,
        priority: this.taskPriority(task),
        dueDate: task.dueDate ?? null,
        projectId: task.project?.id ?? null,
        labelIds: task.labels?.map((label) => label.id) ?? [],
        color: task.color ?? null
      })
      .subscribe({
        next: (updatedTask) => {
          this.tasks = this.tasks.map((item) => (item.id === updatedTask.id ? this.withNormalizedPriority(updatedTask) : item));
          this.toastService.show('Статус изменён', 'info');
        },
        error: () => {
          this.toastService.show('Не удалось обновить задачу', 'error');
        }
      });
  }

  trackByTaskId(_index: number, task: Task): number {
    return task.id;
  }

  taskPriority(task: Task): TaskPriority {
    return this.normalizePriority(task.priority);
  }

  priorityLabel(priority: TaskPriority): string {
    if (priority === 'low') {
      return 'Низкий';
    }

    if (priority === 'high') {
      return 'Высокий';
    }

    return 'Средний';
  }

  priorityClass(priority: TaskPriority): string {
    return `priority-badge--${priority}`;
  }

  dueDateLabel(task: Task): string {
    if (!task.dueDate) {
      return 'Без времени';
    }

    if (task.dueDate < this.todayKey) {
      return 'Просрочено';
    }

    if (task.dueDate === this.todayKey) {
      return 'Сегодня';
    }

    return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(new Date(`${task.dueDate}T00:00:00`));
  }

  get projectFallback(): string {
    return 'Без проекта';
  }

  private withNormalizedPriority(task: Task): Task {
    return {
      ...task,
      priority: this.normalizePriority(task.priority)
    };
  }

  private normalizePriority(priority: TaskPriority | string | undefined): TaskPriority {
    if (priority === 'low' || priority === 'medium' || priority === 'high') {
      return priority;
    }

    return 'medium';
  }

  private get todayKey(): string {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60_000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 10);
  }
}
