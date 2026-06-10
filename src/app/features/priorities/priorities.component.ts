import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { finalize } from 'rxjs';

import { TaskService } from '../../core/services/task.service';
import { Task, TaskPriority } from '../../shared/models/task.model';
import { ToastService } from '../../shared/ui/toast/toast.service';

interface PriorityGroup {
  description: string;
  label: string;
  value: TaskPriority;
}

@Component({
  selector: 'app-priorities',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './priorities.component.html',
  styleUrl: './priorities.component.scss'
})
export class PrioritiesComponent implements OnInit {
  private readonly taskService = inject(TaskService);
  private readonly toastService = inject(ToastService);

  readonly groups: PriorityGroup[] = [
    { label: 'Высокий', value: 'high', description: 'Задачи, которые стоит закрыть первыми.' },
    { label: 'Средний', value: 'medium', description: 'Плановая работа без срочного риска.' },
    { label: 'Низкий', value: 'low', description: 'Небольшие задачи и идеи на потом.' }
  ];

  tasks: Task[] = [];
  isLoading = false;
  listErrorMessage = '';

  ngOnInit(): void {
    this.loadTasks();
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

  tasksByPriority(priority: TaskPriority): Task[] {
    return this.tasks.filter((task) => this.taskPriority(task) === priority);
  }

  trackByTaskId(_index: number, task: Task): number {
    return task.id;
  }

  trackByGroup(_index: number, group: PriorityGroup): TaskPriority {
    return group.value;
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
