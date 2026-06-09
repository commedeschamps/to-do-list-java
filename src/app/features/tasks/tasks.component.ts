import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';

import { AuthService } from '../../core/services/auth.service';
import { TaskService } from '../../core/services/task.service';
import { Task, TaskFilter } from '../../shared/models/task.model';

@Component({
  selector: 'app-tasks',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './tasks.component.html',
  styleUrl: './tasks.component.scss'
})
export class TasksComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly taskService = inject(TaskService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly taskForm = this.fb.nonNullable.group({
    title: ['', Validators.required],
    description: ['', Validators.required],
    completed: [false]
  });

  readonly filters: Array<{ label: string; value: TaskFilter }> = [
    { label: 'Все', value: 'all' },
    { label: 'Активные', value: 'active' },
    { label: 'Выполненные', value: 'completed' }
  ];

  tasks: Task[] = [];
  activeFilter: TaskFilter = 'all';
  editingTaskId: number | null = null;
  isLoading = false;
  isSaving = false;
  formErrorMessage = '';
  listErrorMessage = '';

  ngOnInit(): void {
    this.loadTasks();
  }

  get filteredTasks(): Task[] {
    if (this.activeFilter === 'active') {
      return this.tasks.filter((task) => !task.completed);
    }

    if (this.activeFilter === 'completed') {
      return this.tasks.filter((task) => task.completed);
    }

    return this.tasks;
  }

  get totalCount(): number {
    return this.tasks.length;
  }

  loadTasks(): void {
    this.isLoading = true;
    this.listErrorMessage = '';

    this.taskService
      .getTasks()
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (tasks) => {
          this.tasks = tasks;
        },
        error: () => {
          this.listErrorMessage = 'Не удалось загрузить задачи.';
        }
      });
  }

  submitTask(): void {
    this.formErrorMessage = '';

    if (this.taskForm.invalid) {
      this.taskForm.markAllAsTouched();
      return;
    }

    const formValue = this.taskForm.getRawValue();
    this.isSaving = true;

    if (this.editingTaskId) {
      this.taskService
        .updateTask(this.editingTaskId, formValue)
        .pipe(finalize(() => (this.isSaving = false)))
        .subscribe({
          next: (updatedTask) => {
            this.tasks = this.tasks.map((task) =>
              task.id === updatedTask.id ? updatedTask : task
            );
            this.resetForm();
          },
          error: () => {
            this.formErrorMessage = 'Не удалось обновить задачу.';
          }
        });
      return;
    }

    this.taskService
      .createTask(formValue)
      .pipe(finalize(() => (this.isSaving = false)))
      .subscribe({
        next: (createdTask) => {
          this.tasks = [createdTask, ...this.tasks];
          this.resetForm();
        },
        error: () => {
          this.formErrorMessage = 'Не удалось создать задачу.';
        }
      });
  }

  startEdit(task: Task): void {
    this.editingTaskId = task.id;
    this.taskForm.setValue({
      title: task.title,
      description: task.description,
      completed: task.completed
    });
  }

  resetForm(): void {
    this.editingTaskId = null;
    this.taskForm.reset({
      title: '',
      description: '',
      completed: false
    });
  }

  setFilter(filter: TaskFilter): void {
    this.activeFilter = filter;
  }

  toggleCompleted(task: Task): void {
    const nextTask = {
      title: task.title,
      description: task.description,
      completed: !task.completed
    };

    this.taskService.updateTask(task.id, nextTask).subscribe({
      next: (updatedTask) => {
        this.tasks = this.tasks.map((item) =>
          item.id === updatedTask.id ? updatedTask : item
        );
      },
      error: () => {
        this.listErrorMessage = 'Не удалось изменить статус задачи.';
      }
    });
  }

  deleteTask(task: Task): void {
    const confirmed = window.confirm(`Удалить задачу "${task.title}"?`);

    if (!confirmed) {
      return;
    }

    this.taskService.deleteTask(task.id).subscribe({
      next: () => {
        this.tasks = this.tasks.filter((item) => item.id !== task.id);

        if (this.editingTaskId === task.id) {
          this.resetForm();
        }
      },
      error: () => {
        this.listErrorMessage = 'Не удалось удалить задачу.';
      }
    });
  }

  logout(): void {
    this.authService.logout();
    void this.router.navigateByUrl('/login');
  }

  trackByTaskId(_index: number, task: Task): number {
    return task.id;
  }
}
