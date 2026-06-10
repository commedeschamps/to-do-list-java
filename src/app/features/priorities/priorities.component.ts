import { CommonModule } from '@angular/common';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { TaskService } from '../../core/services/task.service';
import { Task, TaskPayload, TaskPriority } from '../../shared/models/task.model';
import { ToastService } from '../../shared/ui/toast/toast.service';

interface PriorityGroup {
  description: string;
  label: string;
  value: TaskPriority;
}

@Component({
  selector: 'app-priorities',
  standalone: true,
  imports: [CommonModule, RouterLink, DragDropModule],
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

  dropListId(priority: TaskPriority): string {
    return `priority-${priority}-list`;
  }

  connectedDropLists(priority: TaskPriority): string[] {
    return this.groups
      .filter((group) => group.value !== priority)
      .map((group) => this.dropListId(group.value));
  }

  dropTask(event: CdkDragDrop<Task[]>, targetPriority: TaskPriority): void {
    const task = event.item.data as Task | undefined;

    if (!task) {
      return;
    }

    if (event.previousContainer === event.container) {
      this.reorderPriorityColumn(targetPriority, event.previousIndex, event.currentIndex);
      return;
    }

    const previousTasks = this.tasks;
    const nextTask = {
      ...task,
      priority: targetPriority
    };

    this.tasks = this.tasks.map((item) => (item.id === task.id ? nextTask : item));

    this.taskService.updateTask(task.id, this.toPayload(nextTask)).subscribe({
      next: (updatedTask) => {
        this.tasks = this.tasks.map((item) => (item.id === updatedTask.id ? this.withNormalizedPriority(updatedTask) : item));
        this.toastService.show('Приоритет обновлён', 'success');
      },
      error: () => {
        this.tasks = previousTasks;
        this.toastService.show('Не удалось изменить приоритет', 'error');
      }
    });
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

  private toPayload(task: Task): Required<TaskPayload> {
    return {
      title: task.title,
      description: task.description,
      completed: task.completed,
      priority: this.taskPriority(task),
      dueDate: task.dueDate ?? null
    };
  }

  private reorderPriorityColumn(priority: TaskPriority, previousIndex: number, currentIndex: number): void {
    const reorderedColumn = this.tasksByPriority(priority);
    moveItemInArray(reorderedColumn, previousIndex, currentIndex);

    let nextColumnIndex = 0;
    this.tasks = this.tasks.map((task) => {
      if (this.taskPriority(task) !== priority) {
        return task;
      }

      return reorderedColumn[nextColumnIndex++];
    });
  }

  private normalizePriority(priority: TaskPriority | string | undefined): TaskPriority {
    if (priority === 'low' || priority === 'medium' || priority === 'high') {
      return priority;
    }

    return 'medium';
  }
}
