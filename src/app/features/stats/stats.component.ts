import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { finalize } from 'rxjs';

import { TaskService } from '../../core/services/task.service';
import { Task, TaskPriority } from '../../shared/models/task.model';
import { ToastService } from '../../shared/ui/toast/toast.service';

interface PriorityMetric {
  count: number;
  label: string;
  percent: number;
  value: TaskPriority;
}

@Component({
  selector: 'app-stats',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './stats.component.html',
  styleUrl: './stats.component.scss'
})
export class StatsComponent implements OnInit {
  private readonly taskService = inject(TaskService);
  private readonly toastService = inject(ToastService);

  tasks: Task[] = [];
  isLoading = false;
  listErrorMessage = '';

  ngOnInit(): void {
    this.loadTasks();
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

  get progressPercent(): number {
    if (!this.totalCount) {
      return 0;
    }

    return Math.round((this.completedCount / this.totalCount) * 100);
  }

  get progressMeta(): string {
    return `${this.completedCount} из ${this.totalCount} задач выполнено`;
  }

  get priorityMetrics(): PriorityMetric[] {
    return [
      this.priorityMetric('high', 'Высокий'),
      this.priorityMetric('medium', 'Средний'),
      this.priorityMetric('low', 'Низкий')
    ];
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

  trackByPriority(_index: number, metric: PriorityMetric): TaskPriority {
    return metric.value;
  }

  priorityClass(priority: TaskPriority): string {
    return `priority-bar--${priority}`;
  }

  private priorityMetric(value: TaskPriority, label: string): PriorityMetric {
    const count = this.countByPriority(value);

    return {
      count,
      label,
      percent: this.totalCount ? Math.round((count / this.totalCount) * 100) : 0,
      value
    };
  }

  private countByPriority(priority: TaskPriority): number {
    return this.tasks.filter((task) => task.priority === priority).length;
  }

  private normalizePriority(priority: TaskPriority | string | undefined): TaskPriority {
    if (priority === 'low' || priority === 'medium' || priority === 'high') {
      return priority;
    }

    return 'medium';
  }
}
