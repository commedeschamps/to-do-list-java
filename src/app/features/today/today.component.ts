import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { finalize } from 'rxjs';

import { TaskService } from '../../core/services/task.service';
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
  private readonly toastService = inject(ToastService);

  tasks: Task[] = [];
  isLoading = false;
  listErrorMessage = '';

  ngOnInit(): void {
    this.loadTasks();
  }

  get activeTasks(): Task[] {
    return this.tasks.filter((task) => !task.completed);
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

  toggleCompleted(task: Task): void {
    this.taskService
      .updateTask(task.id, {
        title: task.title,
        description: task.description,
        completed: !task.completed,
        priority: this.taskPriority(task),
        dueDate: task.dueDate ?? null
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
}
