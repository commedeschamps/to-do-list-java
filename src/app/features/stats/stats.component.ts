import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ChartData, ChartOptions } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { finalize } from 'rxjs';

import { AiService } from '../../core/services/ai.service';
import { TaskService } from '../../core/services/task.service';
import { AiRiskRadar, AiWeeklySummary } from '../../shared/models/ai.model';
import { Task, TaskPriority } from '../../shared/models/task.model';
import { ToastService } from '../../shared/ui/toast/toast.service';

@Component({
  selector: 'app-stats',
  standalone: true,
  imports: [CommonModule, BaseChartDirective],
  templateUrl: './stats.component.html',
  styleUrl: './stats.component.scss'
})
export class StatsComponent implements OnInit {
  private readonly taskService = inject(TaskService);
  private readonly aiService = inject(AiService);
  private readonly toastService = inject(ToastService);

  tasks: Task[] = [];
  isLoading = false;
  listErrorMessage = '';
  aiEnabled = false;
  aiStatusMessage = 'Проверяем доступность AI.';
  aiRiskRadar: AiRiskRadar | null = null;
  aiWeeklySummary: AiWeeklySummary | null = null;
  aiRiskErrorMessage = '';
  aiWeeklyErrorMessage = '';
  isAiRiskLoading = false;
  isAiWeeklyLoading = false;

  readonly doughnutOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '64%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          boxWidth: 12,
          color: '#a9b0c4',
          font: {
            family: 'Inter, system-ui, sans-serif',
            weight: 700
          }
        }
      }
    }
  };

  readonly barOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      }
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(255, 255, 255, 0.06)'
        },
        ticks: {
          color: '#a9b0c4'
        }
      },
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(255, 255, 255, 0.06)'
        },
        ticks: {
          color: '#a9b0c4',
          precision: 0
        }
      }
    }
  };

  readonly lineOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      }
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(255, 255, 255, 0.05)'
        },
        ticks: {
          color: '#a9b0c4'
        }
      },
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(255, 255, 255, 0.06)'
        },
        ticks: {
          color: '#a9b0c4',
          precision: 0
        }
      }
    }
  };

  ngOnInit(): void {
    this.loadTasks();
    this.loadAiStatus();
  }

  get totalCount(): number {
    return this.tasks.length;
  }

  get activeCount(): number {
    return this.tasks.filter((task) => !task.completed).length;
  }

  get completedCount(): number {
    return this.tasks.filter((task) => task.completed).length;
  }

  get highPriorityCount(): number {
    return this.countByPriority('high');
  }

  get overdueCount(): number {
    return this.tasks.filter((task) => this.isOverdue(task)).length;
  }

  get todayCount(): number {
    return this.tasks.filter((task) => this.isToday(task)).length;
  }

  get noDeadlineCount(): number {
    return this.tasks.filter((task) => !task.dueDate).length;
  }

  get progressPercent(): number {
    if (!this.totalCount) {
      return 0;
    }

    return Math.round((this.completedCount / this.totalCount) * 100);
  }

  get progressMeta(): string {
    return `${this.completedCount} из ${this.totalCount} задач выполнено`;
  }

  get statusChartData(): ChartData<'doughnut'> {
    return {
      labels: ['Активные', 'Выполненные'],
      datasets: [
        {
          data: [this.activeCount, this.completedCount],
          backgroundColor: ['#3b82f6', '#22c55e'],
          borderColor: ['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.12)'],
          borderWidth: 1
        }
      ]
    };
  }

  get priorityChartData(): ChartData<'bar'> {
    return {
      labels: ['Высокий', 'Средний', 'Низкий'],
      datasets: [
        {
          data: [this.countActiveByPriority('high'), this.countActiveByPriority('medium'), this.countActiveByPriority('low')],
          backgroundColor: ['#f59e0b', '#0f766e', '#3b82f6'],
          borderRadius: 8,
          maxBarThickness: 42
        }
      ]
    };
  }

  get projectChartData(): ChartData<'bar'> {
    const distribution = this.projectDistribution();

    return {
      labels: distribution.map((item) => item.name),
      datasets: [
        {
          data: distribution.map((item) => item.count),
          backgroundColor: distribution.map((item) => item.color),
          borderRadius: 8,
          maxBarThickness: 44
        }
      ]
    };
  }

  get hasProjectData(): boolean {
    return this.tasks.some((task) => task.project);
  }

  get insights(): string[] {
    if (!this.totalCount) {
      return ['Создайте несколько задач, чтобы увидеть статистику.'];
    }

    const insights: string[] = [];

    if (this.overdueCount) {
      insights.push(`У вас ${this.overdueCount} просроченные задачи.`);
    }

    if (this.noDeadlineCount) {
      insights.push(`${this.noDeadlineCount} задач без дедлайна.`);
    }

    const busiestProject = this.projectDistribution().filter((item) => item.name !== 'Без проекта').sort((a, b) => b.activeCount - a.activeCount)[0];

    if (busiestProject && busiestProject.activeCount > 0) {
      insights.push(`Больше всего активных задач в проекте «${busiestProject.name}».`);
    }

    const activeHighPriority = this.tasks.filter((task) => this.normalizePriority(task.priority) === 'high' && !task.completed).length;

    if (activeHighPriority > 0) {
      insights.push(`Высокий приоритет ещё ожидает внимания: ${activeHighPriority} активных задач.`);
    }

    if (!insights.length) {
      insights.push('Список выглядит спокойно: срочных проблем сейчас нет.');
    }

    return insights;
  }

  get completedWeeklyChartData(): ChartData<'line'> {
    const days = this.lastSevenDays();

    return {
      labels: days.map((day) =>
        new Intl.DateTimeFormat('ru-RU', {
          day: 'numeric',
          month: 'short'
        }).format(day)
      ),
      datasets: [
        {
          data: days.map((day) => this.completedCountForDay(day)),
          borderColor: '#22c55e',
          backgroundColor: 'rgba(34, 197, 94, 0.14)',
          fill: true,
          pointBackgroundColor: '#86efac',
          pointBorderColor: '#14532d',
          pointRadius: 4,
          tension: 0.35
        }
      ]
    };
  }

  loadTasks(): void {
    this.isLoading = true;
    this.listErrorMessage = '';

    this.taskService
      .getTasks()
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (tasks) => {
          this.tasks = tasks.map((task) => ({
            ...task,
            priority: this.normalizePriority(task.priority)
          }));
        },
        error: () => {
          this.listErrorMessage = 'Не удалось загрузить статистику.';
          this.toastService.show('Не удалось загрузить статистику', 'error');
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

  analyzeRisks(): void {
    if (!this.aiEnabled || this.isAiRiskLoading || !this.tasks.length) {
      return;
    }

    this.aiRiskErrorMessage = '';
    this.isAiRiskLoading = true;
    this.aiService
      .getRiskRadar()
      .pipe(finalize(() => (this.isAiRiskLoading = false)))
      .subscribe({
        next: (result) => {
          this.aiRiskRadar = result;
        },
        error: () => {
          this.aiRiskErrorMessage = 'AI не смог сформировать ответ. Попробуйте ещё раз.';
          this.toastService.show('AI-анализ рисков недоступен', 'error');
        }
      });
  }

  buildWeeklySummary(): void {
    if (!this.aiEnabled || this.isAiWeeklyLoading || !this.tasks.length) {
      return;
    }

    this.aiWeeklyErrorMessage = '';
    this.isAiWeeklyLoading = true;
    this.aiService
      .getWeeklySummary()
      .pipe(finalize(() => (this.isAiWeeklyLoading = false)))
      .subscribe({
        next: (result) => {
          this.aiWeeklySummary = result;
        },
        error: () => {
          this.aiWeeklyErrorMessage = 'AI не смог сформировать ответ. Попробуйте ещё раз.';
          this.toastService.show('Итоги недели недоступны', 'error');
        }
      });
  }

  riskLevelLabel(level: string): string {
    if (level === 'HIGH') {
      return 'Высокий риск';
    }

    if (level === 'MEDIUM') {
      return 'Средний риск';
    }

    return 'Низкий риск';
  }

  riskLevelClass(level: string): string {
    return `ai-risk-level--${level.toLowerCase()}`;
  }

  private countByPriority(priority: TaskPriority): number {
    return this.tasks.filter((task) => task.priority === priority).length;
  }

  private countActiveByPriority(priority: TaskPriority): number {
    return this.tasks.filter((task) => !task.completed && task.priority === priority).length;
  }

  private projectDistribution(): Array<{ name: string; color: string; count: number; activeCount: number }> {
    const distribution = new Map<string, { name: string; color: string; count: number; activeCount: number }>();

    for (const task of this.tasks) {
      const key = task.project?.id ? String(task.project.id) : 'none';
      const current = distribution.get(key) ?? {
        name: task.project?.name ?? 'Без проекта',
        color: task.project?.color ?? '#64748b',
        count: 0,
        activeCount: 0
      };

      current.count += 1;

      if (!task.completed) {
        current.activeCount += 1;
      }

      distribution.set(key, current);
    }

    return [...distribution.values()].sort((first, second) => second.count - first.count);
  }

  private completedCountForDay(day: Date): number {
    const dayKey = this.dateKey(day);

    return this.tasks.filter((task) => {
      if (!task.completedAt) {
        return false;
      }

      return this.dateKey(new Date(task.completedAt)) === dayKey;
    }).length;
  }

  private lastSevenDays(): Date[] {
    const today = new Date();
    const days: Date[] = [];

    for (let index = 6; index >= 0; index--) {
      days.push(new Date(today.getFullYear(), today.getMonth(), today.getDate() - index));
    }

    return days;
  }

  private dateKey(date: Date): string {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${date.getFullYear()}-${month}-${day}`;
  }

  private isOverdue(task: Task): boolean {
    if (!task.dueDate || task.completed) {
      return false;
    }

    const dueDate = this.parseLocalDate(task.dueDate);
    return dueDate ? this.daysFromToday(dueDate) < 0 : false;
  }

  private isToday(task: Task): boolean {
    if (!task.dueDate) {
      return false;
    }

    const dueDate = this.parseLocalDate(task.dueDate);
    return dueDate ? this.daysFromToday(dueDate) === 0 : false;
  }

  private parseLocalDate(value: string): Date | null {
    const [year, month, day] = value.split('-').map(Number);

    if (!year || !month || !day) {
      return null;
    }

    return new Date(year, month - 1, day);
  }

  private daysFromToday(date: Date): number {
    const today = new Date();
    const normalizedToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const normalizedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    return Math.round((normalizedDate.getTime() - normalizedToday.getTime()) / 86_400_000);
  }

  private normalizePriority(priority: TaskPriority | string | undefined): TaskPriority {
    if (priority === 'low' || priority === 'medium' || priority === 'high') {
      return priority;
    }

    return 'medium';
  }
}
