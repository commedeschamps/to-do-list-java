import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import Fuse, { type IFuseOptions } from 'fuse.js';
import { Subscription, debounceTime, distinctUntilChanged, finalize } from 'rxjs';

import { TaskService } from '../../core/services/task.service';
import { Task, TaskFilter, TaskPriority } from '../../shared/models/task.model';
import { ToastService } from '../../shared/ui/toast/toast.service';

type SearchableTask = Task & {
  completedLabel: string;
  dueDateLabel: string;
  priorityLabel: string;
};

type EmptyStateKind = 'noTasks' | 'noActive' | 'noCompleted' | 'search';

interface TasksEmptyState {
  alt: string;
  image: string;
  kind: EmptyStateKind;
  text: string;
  title: string;
}

@Component({
  selector: 'app-tasks',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './tasks.component.html',
  styleUrl: './tasks.component.scss'
})
export class TasksComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly taskService = inject(TaskService);
  private readonly toastService = inject(ToastService);
  private createModalTrigger: HTMLElement | null = null;
  private confirmModalTrigger: HTMLElement | null = null;

  @ViewChild('createModalPanel') private createModalPanel?: ElementRef<HTMLElement>;
  @ViewChild('confirmModalPanel') private confirmModalPanel?: ElementRef<HTMLElement>;

  readonly searchControl = new FormControl('', { nonNullable: true });

  readonly taskForm = this.fb.nonNullable.group({
    title: ['', Validators.required],
    description: ['', Validators.required],
    completed: [false],
    priority: ['medium' as TaskPriority, Validators.required],
    dueDate: ['']
  });

  readonly editForm = this.fb.nonNullable.group({
    title: ['', Validators.required],
    description: ['', Validators.required],
    completed: [false],
    priority: ['medium' as TaskPriority, Validators.required],
    dueDate: ['']
  });

  readonly filters: Array<{ label: string; value: TaskFilter }> = [
    { label: 'Все', value: 'all' },
    { label: 'Активные', value: 'active' },
    { label: 'Выполненные', value: 'completed' }
  ];

  readonly priorities: Array<{ label: string; value: TaskPriority }> = [
    { label: 'Низкий', value: 'low' },
    { label: 'Средний', value: 'medium' },
    { label: 'Высокий', value: 'high' }
  ];

  readonly skeletonItems = [0, 1, 2];
  readonly statSkeletonItems = [0, 1, 2, 3];

  private readonly searchOptions: IFuseOptions<SearchableTask> = {
    keys: [
      { name: 'title', weight: 0.44 },
      { name: 'description', weight: 0.22 },
      { name: 'priorityLabel', weight: 0.16 },
      { name: 'completedLabel', weight: 0.08 },
      { name: 'dueDateLabel', weight: 0.1 }
    ],
    threshold: 0.35,
    ignoreLocation: true,
    includeScore: true
  };
  private readonly searchSubscription: Subscription;

  tasks: Task[] = [];
  activeFilter: TaskFilter = 'all';
  editingTaskId: number | null = null;
  taskPendingDelete: Task | null = null;
  isLoading = false;
  isSaving = false;
  isCreateModalOpen = false;
  formErrorMessage = '';
  editErrorMessage = '';
  listErrorMessage = '';
  searchQuery = '';

  constructor() {
    this.searchSubscription = this.searchControl.valueChanges
      .pipe(debounceTime(220), distinctUntilChanged())
      .subscribe((query) => {
        this.searchQuery = query;
      });
  }

  ngOnInit(): void {
    this.loadTasks();
  }

  ngOnDestroy(): void {
    this.searchSubscription.unsubscribe();
  }

  get filteredTasks(): Task[] {
    return this.tasks.filter((task) => this.matchesActiveFilter(task));
  }

  get visibleTasks(): Task[] {
    const filteredTasks = this.filteredTasks;
    const query = this.normalizedSearchQuery;

    if (!query) {
      return filteredTasks;
    }

    return new Fuse(this.toSearchableTasks(filteredTasks), this.searchOptions)
      .search(query)
      .map((result) => result.item);
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
    return this.tasks.filter((task) => this.taskPriority(task) === 'high').length;
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

  get emptyState(): TasksEmptyState | null {
    if (this.isLoading || this.visibleTasks.length) {
      return null;
    }

    if (this.normalizedSearchQuery) {
      return {
        alt: 'Ничего не найдено',
        image: 'assets/sprites/empty-checklist-sad.png',
        kind: 'search',
        text: 'Попробуйте изменить запрос или фильтр.',
        title: 'Ничего не найдено'
      };
    }

    if (!this.totalCount) {
      return {
        alt: 'Пустой список задач',
        image: 'assets/sprites/empty-checklist-sad.png',
        kind: 'noTasks',
        text: 'Добавьте первую задачу, чтобы начать работу.',
        title: 'Задач пока нет'
      };
    }

    if (this.activeFilter === 'active') {
      return {
        alt: 'Все задачи выполнены',
        image: 'assets/sprites/success-character.png',
        kind: 'noActive',
        text: 'Все задачи выполнены. Отличная работа.',
        title: 'Активных задач нет'
      };
    }

    if (this.activeFilter === 'completed') {
      return {
        alt: 'Нет выполненных задач',
        image: 'assets/sprites/empty-checklist-sad.png',
        kind: 'noCompleted',
        text: 'Завершите задачу, чтобы она появилась здесь.',
        title: 'Выполненных задач нет'
      };
    }

    return null;
  }

  loadTasks(): void {
    this.isLoading = true;
    this.listErrorMessage = '';

    this.taskService
      .getTasks()
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (tasks) => {
          this.setTasks(tasks);
        },
        error: () => {
          this.listErrorMessage = 'Не удалось загрузить задачи.';
          this.toastService.show('Не удалось загрузить задачи', 'error');
        }
      });
  }

  openCreateModal(event?: Event): void {
    this.createModalTrigger = this.eventTarget(event);
    this.formErrorMessage = '';
    this.taskForm.reset({
      title: '',
      description: '',
      completed: false,
      priority: 'medium',
      dueDate: ''
    });
    this.isCreateModalOpen = true;
    window.setTimeout(() => this.focusFirstControl(this.createModalPanel), 0);
  }

  closeCreateModal(): void {
    this.isCreateModalOpen = false;
    this.formErrorMessage = '';
    this.createModalTrigger?.focus();
    this.createModalTrigger = null;
  }

  submitTask(): void {
    this.formErrorMessage = '';

    if (this.taskForm.invalid) {
      this.taskForm.markAllAsTouched();
      return;
    }

    const formValue = this.taskForm.getRawValue();
    this.isSaving = true;

    this.taskService
      .createTask(formValue)
      .pipe(finalize(() => (this.isSaving = false)))
      .subscribe({
        next: (createdTask) => {
          this.setTasks([createdTask, ...this.tasks]);
          this.closeCreateModal();
          this.resetForm();
          this.toastService.show('Задача создана', 'success');
        },
        error: () => {
          this.formErrorMessage = 'Не удалось создать задачу.';
          this.toastService.show('Не удалось создать задачу', 'error');
        }
      });
  }

  startEdit(task: Task): void {
    this.editingTaskId = task.id;
    this.editErrorMessage = '';
    this.editForm.setValue({
      title: task.title,
      description: task.description,
      completed: task.completed,
      priority: this.taskPriority(task),
      dueDate: task.dueDate ?? ''
    });
  }

  saveInlineEdit(task: Task): void {
    this.editErrorMessage = '';

    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    this.isSaving = true;

    this.taskService
      .updateTask(task.id, this.editForm.getRawValue())
      .pipe(finalize(() => (this.isSaving = false)))
      .subscribe({
        next: (updatedTask) => {
          this.setTasks(this.tasks.map((item) => (item.id === updatedTask.id ? updatedTask : item)));
          this.resetForm();
          this.toastService.show('Задача обновлена', 'success');
        },
        error: () => {
          this.editErrorMessage = 'Не удалось обновить задачу.';
          this.toastService.show('Не удалось обновить задачу', 'error');
        }
      });
  }

  resetForm(): void {
    this.editingTaskId = null;
    this.editErrorMessage = '';
    this.taskForm.reset({
      title: '',
      description: '',
      completed: false,
      priority: 'medium',
      dueDate: ''
    });
    this.editForm.reset({
      title: '',
      description: '',
      completed: false,
      priority: 'medium',
      dueDate: ''
    });
  }

  setFilter(filter: TaskFilter): void {
    this.activeFilter = filter;
  }

  clearSearch(): void {
    this.searchControl.setValue('');
  }

  toggleCompleted(task: Task): void {
    const nextTask = {
      title: task.title,
      description: task.description,
      completed: !task.completed,
      priority: this.taskPriority(task),
      dueDate: task.dueDate ?? null
    };

    this.taskService.updateTask(task.id, nextTask).subscribe({
      next: (updatedTask) => {
        this.setTasks(this.tasks.map((item) => (item.id === updatedTask.id ? updatedTask : item)));
        this.toastService.show('Статус изменён', 'info');
      },
      error: () => {
        this.listErrorMessage = 'Не удалось изменить статус задачи.';
        this.toastService.show('Не удалось обновить задачу', 'error');
      }
    });
  }

  deleteTask(task: Task, event?: Event): void {
    this.confirmModalTrigger = this.eventTarget(event);
    this.taskPendingDelete = task;
    window.setTimeout(() => this.focusFirstControl(this.confirmModalPanel), 0);
  }

  confirmDelete(): void {
    if (!this.taskPendingDelete) {
      return;
    }

    const task = this.taskPendingDelete;
    this.isSaving = true;

    this.taskService.deleteTask(task.id).pipe(finalize(() => (this.isSaving = false))).subscribe({
      next: () => {
        this.setTasks(this.tasks.filter((item) => item.id !== task.id));

        if (this.editingTaskId === task.id) {
          this.resetForm();
        }

        this.closeConfirmDialog();
        this.toastService.show('Задача удалена', 'success');
      },
      error: () => {
        this.listErrorMessage = 'Не удалось удалить задачу.';
        this.toastService.show('Не удалось удалить задачу', 'error');
      }
    });
  }

  closeConfirmDialog(): void {
    this.taskPendingDelete = null;
    this.confirmModalTrigger?.focus();
    this.confirmModalTrigger = null;
  }

  trackByTaskId(_index: number, task: Task): number {
    return task.id;
  }

  isEditing(task: Task): boolean {
    return this.editingTaskId === task.id;
  }

  setCreatePriority(priority: TaskPriority): void {
    this.taskForm.controls.priority.setValue(priority);
  }

  setEditPriority(priority: TaskPriority): void {
    this.editForm.controls.priority.setValue(priority);
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
      return 'Без даты';
    }

    const dueDate = this.parseLocalDate(task.dueDate);

    if (!dueDate) {
      return 'Дата указана';
    }

    const diffDays = this.daysFromToday(dueDate);

    if (diffDays < 0 && !task.completed) {
      return 'Просрочено';
    }

    if (diffDays === 0) {
      return 'Сегодня';
    }

    if (diffDays === 1) {
      return 'Завтра';
    }

    return new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'long'
    }).format(dueDate);
  }

  dueDateClass(task: Task): string {
    if (!task.dueDate) {
      return 'due-date-badge--empty';
    }

    if (task.completed) {
      return 'due-date-badge--done';
    }

    const dueDate = this.parseLocalDate(task.dueDate);

    if (!dueDate) {
      return 'due-date-badge--empty';
    }

    const diffDays = this.daysFromToday(dueDate);

    if (diffDays < 0) {
      return 'due-date-badge--overdue';
    }

    if (diffDays <= 1) {
      return 'due-date-badge--soon';
    }

    return 'due-date-badge--planned';
  }

  emptyStatePrimaryAction(state: TasksEmptyState): void {
    if (state.kind === 'noTasks') {
      this.openCreateModal();
      return;
    }

    if (state.kind === 'noActive' || state.kind === 'search') {
      this.setFilter('all');
      return;
    }

    this.setFilter('active');
  }

  emptyStatePrimaryLabel(state: TasksEmptyState): string {
    if (state.kind === 'noTasks') {
      return 'Добавить задачу';
    }

    if (state.kind === 'noCompleted') {
      return 'Показать активные';
    }

    return 'Показать все задачи';
  }

  @HostListener('document:keydown', ['$event'])
  handleDocumentKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      if (this.taskPendingDelete) {
        this.closeConfirmDialog();
        return;
      }

      if (this.isCreateModalOpen) {
        this.closeCreateModal();
        return;
      }

      if (this.editingTaskId) {
        this.resetForm();
      }
    }

    if (event.key !== 'Tab') {
      return;
    }

    if (this.taskPendingDelete) {
      this.trapFocus(event, this.confirmModalPanel);
      return;
    }

    if (this.isCreateModalOpen) {
      this.trapFocus(event, this.createModalPanel);
    }
  }

  private withNormalizedPriority(task: Task): Task {
    return {
      ...task,
      priority: this.normalizePriority(task.priority)
    };
  }

  private setTasks(tasks: Task[]): void {
    this.tasks = tasks.map((task) => this.withNormalizedPriority(task));
  }

  private toSearchableTasks(tasks: Task[]): SearchableTask[] {
    return tasks.map((task) => ({
      ...task,
      dueDateLabel: this.dueDateLabel(task),
      completedLabel: task.completed ? 'Выполнена completed done завершена' : 'Активная active open',
      priorityLabel: `${this.priorityLabel(this.taskPriority(task))} ${this.taskPriority(task)}`
    }));
  }

  private matchesActiveFilter(task: Task): boolean {
    if (this.activeFilter === 'active') {
      return !task.completed;
    }

    if (this.activeFilter === 'completed') {
      return task.completed;
    }

    return true;
  }

  private get normalizedSearchQuery(): string {
    return this.searchQuery.trim();
  }

  private normalizePriority(priority: TaskPriority | string | undefined): TaskPriority {
    if (priority === 'low' || priority === 'medium' || priority === 'high') {
      return priority;
    }

    return 'medium';
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

  private eventTarget(event?: Event): HTMLElement | null {
    return event?.currentTarget instanceof HTMLElement ? event.currentTarget : null;
  }

  private focusFirstControl(panel?: ElementRef<HTMLElement>): void {
    const focusable = this.focusableElements(panel);
    focusable[0]?.focus();
  }

  private trapFocus(event: KeyboardEvent, panel?: ElementRef<HTMLElement>): void {
    const focusable = this.focusableElements(panel);

    if (!focusable.length) {
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
      return;
    }

    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private focusableElements(panel?: ElementRef<HTMLElement>): HTMLElement[] {
    if (!panel) {
      return [];
    }

    return Array.from(
      panel.nativeElement.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
      )
    ).filter((element) => !element.hasAttribute('disabled'));
  }
}
