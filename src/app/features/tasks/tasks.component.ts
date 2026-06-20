import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import Fuse, { type IFuseOptions } from 'fuse.js';
import { Observable, Subscription, debounceTime, distinctUntilChanged, finalize, forkJoin, map, of, switchMap } from 'rxjs';

import { AiService } from '../../core/services/ai.service';
import { LabelService, ProjectService, SubtaskService, TaskService } from '../../core/services/task.service';
import { AiAskTasksResponse, AiCleanupSuggestion } from '../../shared/models/ai.model';
import { Label, Project, Subtask, Task, TaskDateFilter, TaskFilter, TaskPriority, TaskSortMode } from '../../shared/models/task.model';
import { ToastService } from '../../shared/ui/toast/toast.service';

type SearchableTask = Task & {
  completedLabel: string;
  dueDateLabel: string;
  labelsLabel: string;
  priorityLabel: string;
  projectLabel: string;
};

type EmptyStateKind = 'noTasks' | 'noActive' | 'noCompleted' | 'search' | 'project' | 'label' | 'filters';

interface TasksEmptyState {
  alt: string;
  image: string;
  kind: EmptyStateKind;
  text: string;
  title: string;
}

type CleanupSuggestionView = AiCleanupSuggestion & {
  localId: string;
};

type TaskView = 'all' | 'today' | 'overdue' | 'important' | 'completed';

@Component({
  selector: 'app-tasks',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './tasks.component.html',
  styleUrl: './tasks.component.scss'
})
export class TasksComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly aiService = inject(AiService);
  private readonly taskService = inject(TaskService);
  private readonly projectService = inject(ProjectService);
  private readonly labelService = inject(LabelService);
  private readonly subtaskService = inject(SubtaskService);
  private readonly toastService = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private createModalTrigger: HTMLElement | null = null;
  private confirmModalTrigger: HTMLElement | null = null;

  @ViewChild('createModalPanel') private createModalPanel?: ElementRef<HTMLElement>;
  @ViewChild('confirmModalPanel') private confirmModalPanel?: ElementRef<HTMLElement>;

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly quickAddControl = new FormControl('', { nonNullable: true });
  readonly aiQuestionControl = new FormControl('Что у меня срочное на этой неделе?', { nonNullable: true });

  readonly taskForm = this.fb.nonNullable.group({
    title: ['', Validators.required],
    description: [''],
    completed: [false],
    priority: ['medium' as TaskPriority, Validators.required],
    dueDate: [''],
    projectId: [0],
    labelIds: [[] as number[]],
    color: ['#3B82F6']
  });

  readonly editForm = this.fb.nonNullable.group({
    title: ['', Validators.required],
    description: [''],
    completed: [false],
    priority: ['medium' as TaskPriority, Validators.required],
    dueDate: [''],
    projectId: [0],
    labelIds: [[] as number[]],
    color: ['#3B82F6']
  });

  readonly newProjectNameControl = new FormControl('', { nonNullable: true });
  readonly newProjectColorControl = new FormControl('#3B82F6', { nonNullable: true });
  readonly newLabelNameControl = new FormControl('', { nonNullable: true });
  readonly newLabelColorControl = new FormControl('#FF6B6B', { nonNullable: true });
  readonly subtaskTitleControl = new FormControl('', { nonNullable: true });

  readonly filters: Array<{ label: string; value: TaskFilter }> = [
    { label: 'Все', value: 'all' },
    { label: 'Активные', value: 'active' },
    { label: 'Выполненные', value: 'completed' }
  ];

  readonly taskViews: Array<{ label: string; value: TaskView }> = [
    { label: 'Все', value: 'all' },
    { label: 'Сегодня', value: 'today' },
    { label: 'Просроченные', value: 'overdue' },
    { label: 'Важные', value: 'important' },
    { label: 'Выполненные', value: 'completed' }
  ];

  readonly dateFilters: Array<{ label: string; value: TaskDateFilter }> = [
    { label: 'Любая дата', value: 'all' },
    { label: 'Просроченные', value: 'overdue' },
    { label: 'Сегодня', value: 'today' },
    { label: 'Без даты', value: 'noDate' }
  ];

  readonly sortOptions: Array<{ label: string; value: TaskSortMode }> = [
    { label: 'Сначала срочные', value: 'dueDate' },
    { label: 'Высокий приоритет', value: 'priority' },
    { label: 'Сначала новые', value: 'newest' },
    { label: 'Сначала старые', value: 'oldest' },
    { label: 'Сначала выполненные', value: 'completedFirst' },
    { label: 'Сначала активные', value: 'activeFirst' }
  ];

  readonly priorities: Array<{ label: string; value: TaskPriority }> = [
    { label: 'Низкий', value: 'low' },
    { label: 'Средний', value: 'medium' },
    { label: 'Высокий', value: 'high' }
  ];

  readonly colorPresets = ['#3B82F6', '#22C55E', '#F59E0B', '#EF4444', '#8B5CF6', '#14B8A6'];
  readonly aiQuestionExamples = [
    'Что мне сделать сегодня?',
    'Какие задачи просрочены?',
    'Что у меня без дедлайна?',
    'Какие задачи лучше перенести?'
  ];

  readonly skeletonItems = [0, 1, 2];
  readonly statSkeletonItems = [0, 1, 2, 3];

  private readonly searchOptions: IFuseOptions<SearchableTask> = {
    keys: [
      { name: 'title', weight: 0.44 },
      { name: 'description', weight: 0.22 },
      { name: 'projectLabel', weight: 0.1 },
      { name: 'labelsLabel', weight: 0.12 },
      { name: 'priorityLabel', weight: 0.16 },
      { name: 'completedLabel', weight: 0.08 },
      { name: 'dueDateLabel', weight: 0.1 }
    ],
    threshold: 0.35,
    ignoreLocation: true,
    includeScore: true
  };
  private readonly subscriptions = new Subscription();

  tasks: Task[] = [];
  projects: Project[] = [];
  labels: Label[] = [];
  subtasksByTaskId: Record<number, Subtask[]> = {};
  activeFilter: TaskFilter = 'all';
  activeTaskView: TaskView = 'all';
  activeProjectId: number | 'all' = 'all';
  activeLabelId: number | 'all' = 'all';
  activePriority: TaskPriority | 'all' = 'all';
  activeDateFilter: TaskDateFilter = 'all';
  sortMode: TaskSortMode = 'dueDate';
  editingTaskId: number | null = null;
  taskPendingDelete: Task | null = null;
  isLoading = false;
  isSaving = false;
  isSubtaskSaving = false;
  isProjectSaving = false;
  isLabelSaving = false;
  isCreateModalOpen = false;
  isCreateProjectOpen = false;
  isCreateLabelOpen = false;
  isFiltersOpen = false;
  formErrorMessage = '';
  editErrorMessage = '';
  listErrorMessage = '';
  searchQuery = '';
  aiEnabled = false;
  aiStatusMessage = 'Проверяем доступность AI.';
  aiAskErrorMessage = '';
  aiCleanupErrorMessage = '';
  aiAskResponse: AiAskTasksResponse | null = null;
  cleanupSuggestions: CleanupSuggestionView[] = [];
  isAiAskLoading = false;
  isAiCleanupLoading = false;
  cleanupApplyingId: string | null = null;
  private pendingFocusTaskId: number | null = null;

  constructor() {
    this.subscriptions.add(
      this.searchControl.valueChanges
        .pipe(debounceTime(220), distinctUntilChanged())
        .subscribe((query) => {
          this.searchQuery = query;
        })
    );
  }

  ngOnInit(): void {
    this.subscriptions.add(
      this.route.queryParamMap.subscribe((params) => {
        const projectParam = Number(params.get('project'));
        const taskParam = Number(params.get('task'));
        this.activeProjectId = Number.isFinite(projectParam) && projectParam > 0 ? projectParam : 'all';
        this.pendingFocusTaskId = Number.isFinite(taskParam) && taskParam > 0 ? taskParam : null;
        if (params.get('create') === '1' && !this.isCreateModalOpen) {
          window.setTimeout(() => this.openCreateModal(), 0);
        }
      })
    );
    this.loadTasks();
    this.loadAiStatus();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  get filteredTasks(): Task[] {
    return this.tasks.filter((task) => this.matchesFilters(task));
  }

  get visibleTasks(): Task[] {
    const filteredTasks = this.filteredTasks;
    const query = this.normalizedSearchQuery;

    if (!query) {
      return this.sortTasks(filteredTasks);
    }

    const searchedTasks = new Fuse(this.toSearchableTasks(filteredTasks), this.searchOptions)
      .search(query)
      .map((result) => result.item);

    return this.sortTasks(searchedTasks);
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

  get overdueCount(): number {
    return this.tasks.filter((task) => this.isOverdue(task)).length;
  }

  get todayCount(): number {
    return this.tasks.filter((task) => this.isToday(task)).length;
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

  get summaryLabel(): string {
    return `${this.totalCount} ${this.pluralize(this.totalCount, 'задача', 'задачи', 'задач')} · ${this.activeCount} ${this.pluralize(this.activeCount, 'активная', 'активные', 'активных')} · ${this.highPriorityCount} ${this.pluralize(this.highPriorityCount, 'важная', 'важные', 'важных')}`;
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

    if (this.activeProjectId !== 'all') {
      return {
        alt: 'Нет задач в проекте',
        image: 'assets/sprites/empty-checklist-sad.png',
        kind: 'project',
        text: 'Добавьте задачу в выбранный проект или измените фильтр.',
        title: 'Нет задач в этом проекте'
      };
    }

    if (this.activeLabelId !== 'all') {
      return {
        alt: 'Нет задач с меткой',
        image: 'assets/sprites/empty-checklist-sad.png',
        kind: 'label',
        text: 'Добавьте метку к задаче или выберите другую метку.',
        title: 'Нет задач с этой меткой'
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

    if (this.activePriority !== 'all' || this.activeDateFilter !== 'all') {
      return {
        alt: 'Нет задач по фильтрам',
        image: 'assets/sprites/empty-checklist-sad.png',
        kind: 'filters',
        text: 'Попробуйте изменить параметры фильтра.',
        title: 'Нет задач по выбранным условиям'
      };
    }

    return null;
  }

  loadTasks(): void {
    this.isLoading = true;
    this.listErrorMessage = '';

    forkJoin({
      tasks: this.taskService.getTasks(),
      projects: this.projectService.getProjects(),
      labels: this.labelService.getLabels()
    })
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: ({ tasks, projects, labels }) => {
          this.projects = projects;
          this.labels = labels;
          this.setTasks(tasks);
          if (this.pendingFocusTaskId) {
            this.focusTask(this.pendingFocusTaskId);
          }
        },
        error: () => {
          this.listErrorMessage = 'Не удалось загрузить задачи и справочники.';
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

  useAiQuestion(question: string): void {
    this.aiQuestionControl.setValue(question);
  }

  askTasks(): void {
    const question = this.aiQuestionControl.value.trim();

    if (!this.aiEnabled || this.isAiAskLoading || !question) {
      return;
    }

    this.aiAskErrorMessage = '';
    this.isAiAskLoading = true;
    this.aiService
      .askTasks(question)
      .pipe(finalize(() => (this.isAiAskLoading = false)))
      .subscribe({
        next: (response) => {
          this.aiAskResponse = response;
        },
        error: () => {
          this.aiAskErrorMessage = 'AI не смог сформировать ответ. Попробуйте ещё раз.';
          this.toastService.show('AI-ответ недоступен', 'error');
        }
      });
  }

  getCleanupSuggestions(): void {
    if (!this.aiEnabled || this.isAiCleanupLoading || !this.tasks.length) {
      return;
    }

    this.aiCleanupErrorMessage = '';
    this.isAiCleanupLoading = true;
    this.aiService
      .getCleanupSuggestions()
      .pipe(finalize(() => (this.isAiCleanupLoading = false)))
      .subscribe({
        next: (response) => {
          this.cleanupSuggestions = response.suggestions.map((suggestion, index) => ({
            ...suggestion,
            localId: `${suggestion.taskId}-${suggestion.type}-${index}`
          }));
        },
        error: () => {
          this.aiCleanupErrorMessage = 'AI не смог сформировать ответ. Попробуйте ещё раз.';
          this.toastService.show('AI-порядок недоступен', 'error');
        }
      });
  }

  relatedTasks(taskIds: number[]): Task[] {
    const idSet = new Set(taskIds);
    return this.tasks.filter((task) => idSet.has(task.id));
  }

  focusTask(taskId: number): void {
    this.clearAdvancedFilters();
    this.setFilter('all');
    this.clearSearch();
    window.setTimeout(() => {
      document.getElementById(`task-${taskId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 0);
  }

  cleanupTaskTitle(taskId: number): string {
    return this.tasks.find((task) => task.id === taskId)?.title ?? `Задача #${taskId}`;
  }

  cleanupPreview(suggestion: AiCleanupSuggestion): string[] {
    const changes = suggestion.proposedChanges ?? {};
    const preview: string[] = [];

    if (changes.dueDate) {
      preview.push(`Дедлайн: ${changes.dueDate}`);
    }

    if (changes.priority) {
      preview.push(`Приоритет: ${this.priorityLabel(changes.priority)}`);
    }

    if (changes.projectName) {
      preview.push(`Проект: ${changes.projectName}`);
    }

    if (changes.labelNames?.length) {
      preview.push(`Метки: ${changes.labelNames.join(', ')}`);
    }

    if (changes.completed !== null && changes.completed !== undefined) {
      preview.push(changes.completed ? 'Отметить выполненной' : 'Вернуть в активные');
    }

    return preview.length ? preview : ['AI предлагает проверить задачу вручную.'];
  }

  dismissCleanupSuggestion(suggestion: CleanupSuggestionView): void {
    this.cleanupSuggestions = this.cleanupSuggestions.filter((item) => item.localId !== suggestion.localId);
  }

  applyCleanupSuggestion(suggestion: CleanupSuggestionView): void {
    const task = this.tasks.find((item) => item.id === suggestion.taskId);

    if (!task) {
      this.dismissCleanupSuggestion(suggestion);
      return;
    }

    const changes = suggestion.proposedChanges ?? {};
    this.cleanupApplyingId = suggestion.localId;

    forkJoin({
      projectId: this.resolveProjectId(task, changes.projectName),
      labelIds: this.resolveLabelIds(task, changes.labelNames ?? [])
    })
      .pipe(
        switchMap(({ projectId, labelIds }) =>
          this.taskService.updateTask(task.id, {
            ...this.toPayloadFromTask(task),
            completed: changes.completed ?? task.completed,
            dueDate: changes.dueDate || task.dueDate || null,
            priority: changes.priority ? this.normalizePriority(changes.priority) : this.taskPriority(task),
            projectId,
            labelIds
          })
        ),
        finalize(() => (this.cleanupApplyingId = null))
      )
      .subscribe({
        next: (updatedTask) => {
          this.setTasks(this.tasks.map((item) => (item.id === updatedTask.id ? updatedTask : item)));
          this.dismissCleanupSuggestion(suggestion);
          this.toastService.show('Предложение применено', 'success');
        },
        error: () => {
          this.toastService.show('Не удалось применить предложение', 'error');
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
      dueDate: '',
      projectId: 0,
      labelIds: [],
      color: '#3B82F6'
    });
    this.isCreateProjectOpen = false;
    this.isCreateLabelOpen = false;
    this.newProjectNameControl.setValue('');
    this.newLabelNameControl.setValue('');
    this.isCreateModalOpen = true;
    window.setTimeout(() => this.focusFirstControl(this.createModalPanel), 0);
  }

  closeCreateModal(): void {
    this.isCreateModalOpen = false;
    this.formErrorMessage = '';
    this.isCreateProjectOpen = false;
    this.isCreateLabelOpen = false;
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
      .createTask(this.toTaskPayload(formValue))
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

  quickAddTask(): void {
    const title = this.quickAddControl.value.trim();

    if (!title || this.isSaving) {
      return;
    }

    this.isSaving = true;
    this.taskService
      .createTask({
        title,
        description: '',
        completed: false,
        priority: 'medium',
        dueDate: null,
        projectId: null,
        labelIds: [],
        color: '#3B82F6'
      })
      .pipe(finalize(() => (this.isSaving = false)))
      .subscribe({
        next: (createdTask) => {
          this.setTasks([createdTask, ...this.tasks]);
          this.quickAddControl.setValue('');
          this.setTaskView('all');
          this.toastService.show('Задача добавлена', 'success');
        },
        error: () => {
          this.toastService.show('Не удалось добавить задачу', 'error');
        }
      });
  }

  startEdit(task: Task): void {
    this.editingTaskId = task.id;
    this.editErrorMessage = '';
    this.editForm.setValue({
      title: task.title,
      description: task.description ?? '',
      completed: task.completed,
      priority: this.taskPriority(task),
      dueDate: task.dueDate ?? '',
      projectId: task.project?.id ?? 0,
      labelIds: task.labels?.map((label) => label.id) ?? [],
      color: task.color ?? task.project?.color ?? '#3B82F6'
    });
    this.loadSubtasks(task.id);
  }

  saveInlineEdit(task: Task): void {
    this.editErrorMessage = '';

    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    this.isSaving = true;

    this.taskService
      .updateTask(task.id, this.toTaskPayload(this.editForm.getRawValue()))
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
      dueDate: '',
      projectId: 0,
      labelIds: [],
      color: '#3B82F6'
    });
    this.editForm.reset({
      title: '',
      description: '',
      completed: false,
      priority: 'medium',
      dueDate: '',
      projectId: 0,
      labelIds: [],
      color: '#3B82F6'
    });
    this.subtaskTitleControl.setValue('');
  }

  setFilter(filter: TaskFilter): void {
    this.activeFilter = filter;
  }

  setTaskView(view: TaskView): void {
    this.activeTaskView = view;
    this.activeFilter = view === 'completed' ? 'completed' : view === 'all' ? 'all' : 'active';
    this.activeDateFilter = view === 'today' ? 'today' : view === 'overdue' ? 'overdue' : 'all';
    this.activePriority = view === 'important' ? 'high' : 'all';
  }

  toggleFilters(): void {
    this.isFiltersOpen = !this.isFiltersOpen;
  }

  setProjectFilter(event: Event): void {
    const value = this.selectValue(event);
    this.activeProjectId = value === 'all' ? 'all' : Number(value);
  }

  setLabelFilter(event: Event): void {
    const value = this.selectValue(event);
    this.activeLabelId = value === 'all' ? 'all' : Number(value);
  }

  setPriorityFilter(event: Event): void {
    const value = this.selectValue(event);
    this.activePriority = value === 'all' ? 'all' : this.normalizePriority(value);
  }

  setDateFilter(event: Event): void {
    const value = this.selectValue(event);
    this.activeDateFilter = value === 'overdue' || value === 'today' || value === 'noDate' ? value : 'all';
  }

  setSortMode(event: Event): void {
    const value = this.selectValue(event);
    const sortModes: TaskSortMode[] = ['dueDate', 'priority', 'newest', 'oldest', 'completedFirst', 'activeFirst'];
    this.sortMode = sortModes.includes(value as TaskSortMode) ? (value as TaskSortMode) : 'dueDate';
  }

  clearAdvancedFilters(): void {
    this.activeTaskView = 'all';
    this.activeFilter = 'all';
    this.activeProjectId = 'all';
    this.activeLabelId = 'all';
    this.activePriority = 'all';
    this.activeDateFilter = 'all';
  }

  clearSearch(): void {
    this.searchControl.setValue('');
  }

  isLabelSelected(control: 'create' | 'edit', labelId: number): boolean {
    const labelIds = control === 'create' ? this.taskForm.controls.labelIds.value : this.editForm.controls.labelIds.value;
    return labelIds.includes(labelId);
  }

  toggleLabel(control: 'create' | 'edit', labelId: number): void {
    const formControl = control === 'create' ? this.taskForm.controls.labelIds : this.editForm.controls.labelIds;
    const labelIds = formControl.value;
    formControl.setValue(labelIds.includes(labelId) ? labelIds.filter((id) => id !== labelId) : [...labelIds, labelId]);
  }

  createProject(control: 'create' | 'edit'): void {
    const name = this.newProjectNameControl.value.trim();

    if (!name) {
      this.toastService.show('Введите название проекта', 'error');
      return;
    }

    this.isProjectSaving = true;
    this.projectService
      .createProject({ name, color: this.newProjectColorControl.value })
      .pipe(finalize(() => (this.isProjectSaving = false)))
      .subscribe({
        next: (project) => {
          this.projects = [...this.projects, project].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
          const targetControl = control === 'create' ? this.taskForm.controls.projectId : this.editForm.controls.projectId;
          targetControl.setValue(project.id);
          this.newProjectNameControl.setValue('');
          this.isCreateProjectOpen = false;
          this.toastService.show('Проект создан', 'success');
        },
        error: () => {
          this.toastService.show('Не удалось создать проект', 'error');
        }
      });
  }

  createLabel(control: 'create' | 'edit'): void {
    const name = this.newLabelNameControl.value.trim();

    if (!name) {
      this.toastService.show('Введите название метки', 'error');
      return;
    }

    this.isLabelSaving = true;
    this.labelService
      .createLabel({ name, color: this.newLabelColorControl.value })
      .pipe(finalize(() => (this.isLabelSaving = false)))
      .subscribe({
        next: (label) => {
          this.labels = [...this.labels, label].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
          const targetControl = control === 'create' ? this.taskForm.controls.labelIds : this.editForm.controls.labelIds;
          targetControl.setValue([...targetControl.value, label.id]);
          this.newLabelNameControl.setValue('');
          this.isCreateLabelOpen = false;
          this.toastService.show('Метка создана', 'success');
        },
        error: () => {
          this.toastService.show('Не удалось создать метку', 'error');
        }
      });
  }

  subtasksFor(task: Task): Subtask[] {
    return this.subtasksByTaskId[task.id] ?? [];
  }

  subtaskProgressLabel(task: Task): string {
    const loadedSubtasks = this.subtasksByTaskId[task.id];
    const total = loadedSubtasks?.length ?? task.subtaskTotal ?? 0;
    const completed = loadedSubtasks?.filter((subtask) => subtask.completed).length ?? task.subtaskCompleted ?? 0;
    return `Подзадачи ${completed}/${total}`;
  }

  hasSubtasks(task: Task): boolean {
    return (task.subtaskTotal ?? 0) > 0 || this.subtasksFor(task).length > 0;
  }

  addSubtask(task: Task): void {
    const title = this.subtaskTitleControl.value.trim();

    if (!title) {
      this.toastService.show('Введите название подзадачи', 'error');
      return;
    }

    this.isSubtaskSaving = true;
    this.subtaskService
      .createSubtask(task.id, { title, completed: false })
      .pipe(finalize(() => (this.isSubtaskSaving = false)))
      .subscribe({
        next: (subtask) => {
          this.setSubtasks(task.id, [...this.subtasksFor(task), subtask]);
          this.subtaskTitleControl.setValue('');
          this.toastService.show('Подзадача добавлена', 'success');
        },
        error: () => {
          this.toastService.show('Не удалось добавить подзадачу', 'error');
        }
      });
  }

  toggleSubtask(task: Task, subtask: Subtask): void {
    this.subtaskService.updateSubtask(task.id, subtask.id, { completed: !subtask.completed }).subscribe({
      next: (updatedSubtask) => {
        this.setSubtasks(
          task.id,
          this.subtasksFor(task).map((item) => (item.id === updatedSubtask.id ? updatedSubtask : item))
        );
      },
      error: () => {
        this.toastService.show('Не удалось обновить подзадачу', 'error');
      }
    });
  }

  renameSubtask(task: Task, subtask: Subtask, event: Event): void {
    const nextTitle = this.selectValue(event).trim();

    if (!nextTitle || nextTitle === subtask.title) {
      return;
    }

    this.subtaskService.updateSubtask(task.id, subtask.id, { title: nextTitle }).subscribe({
      next: (updatedSubtask) => {
        this.setSubtasks(
          task.id,
          this.subtasksFor(task).map((item) => (item.id === updatedSubtask.id ? updatedSubtask : item))
        );
      },
      error: () => {
        this.toastService.show('Не удалось переименовать подзадачу', 'error');
      }
    });
  }

  deleteSubtask(task: Task, subtask: Subtask): void {
    this.subtaskService.deleteSubtask(task.id, subtask.id).subscribe({
      next: () => {
        this.setSubtasks(task.id, this.subtasksFor(task).filter((item) => item.id !== subtask.id));
        this.toastService.show('Подзадача удалена', 'info');
      },
      error: () => {
        this.toastService.show('Не удалось удалить подзадачу', 'error');
      }
    });
  }

  toggleCompleted(task: Task): void {
    const nextTask = {
      ...this.toPayloadFromTask(task),
      completed: !task.completed
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

  setCreateColor(color: string): void {
    this.taskForm.controls.color.setValue(color);
  }

  setEditColor(color: string): void {
    this.editForm.controls.color.setValue(color);
  }

  toggleProjectCreator(): void {
    this.isCreateProjectOpen = !this.isCreateProjectOpen;
  }

  toggleLabelCreator(): void {
    this.isCreateLabelOpen = !this.isCreateLabelOpen;
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

  visibleLabels(task: Task): Label[] {
    return (task.labels ?? []).slice(0, 3);
  }

  extraLabelsCount(task: Task): number {
    return Math.max((task.labels?.length ?? 0) - 3, 0);
  }

  projectColor(project: Project | null | undefined): string {
    return project?.color || '#3B82F6';
  }

  taskColor(task: Task): string | null {
    return task.color || task.project?.color || null;
  }

  emptyStatePrimaryAction(state: TasksEmptyState): void {
    if (state.kind === 'noTasks') {
      this.openCreateModal();
      return;
    }

    if (state.kind === 'noActive' || state.kind === 'search' || state.kind === 'project' || state.kind === 'label' || state.kind === 'filters') {
      this.clearAdvancedFilters();
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

    if (state.kind === 'project' || state.kind === 'label' || state.kind === 'filters') {
      return 'Сбросить фильтры';
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
      description: task.description ?? null,
      labels: task.labels ?? [],
      priority: this.normalizePriority(task.priority),
      subtaskTotal: task.subtaskTotal ?? 0,
      subtaskCompleted: task.subtaskCompleted ?? 0
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
      labelsLabel: (task.labels ?? []).map((label) => label.name).join(' '),
      priorityLabel: `${this.priorityLabel(this.taskPriority(task))} ${this.taskPriority(task)}`,
      projectLabel: task.project?.name ?? ''
    }));
  }

  private matchesFilters(task: Task): boolean {
    return (
      this.matchesActiveFilter(task) &&
      this.matchesProjectFilter(task) &&
      this.matchesLabelFilter(task) &&
      this.matchesPriorityFilter(task) &&
      this.matchesDateFilter(task)
    );
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

  private matchesProjectFilter(task: Task): boolean {
    return this.activeProjectId === 'all' || task.project?.id === this.activeProjectId;
  }

  private matchesLabelFilter(task: Task): boolean {
    return this.activeLabelId === 'all' || (task.labels ?? []).some((label) => label.id === this.activeLabelId);
  }

  private matchesPriorityFilter(task: Task): boolean {
    return this.activePriority === 'all' || this.taskPriority(task) === this.activePriority;
  }

  private matchesDateFilter(task: Task): boolean {
    if (this.activeDateFilter === 'overdue') {
      return this.isOverdue(task);
    }

    if (this.activeDateFilter === 'today') {
      return this.isToday(task);
    }

    if (this.activeDateFilter === 'noDate') {
      return !task.dueDate;
    }

    return true;
  }

  private sortTasks(tasks: Task[]): Task[] {
    return [...tasks].sort((first, second) => {
      if (this.sortMode === 'priority') {
        return this.priorityRank(second) - this.priorityRank(first) || this.compareDueDates(first, second);
      }

      if (this.sortMode === 'newest') {
        return this.timestamp(second.createdAt) - this.timestamp(first.createdAt);
      }

      if (this.sortMode === 'oldest') {
        return this.timestamp(first.createdAt) - this.timestamp(second.createdAt);
      }

      if (this.sortMode === 'completedFirst') {
        return Number(second.completed) - Number(first.completed) || this.compareDueDates(first, second);
      }

      if (this.sortMode === 'activeFirst') {
        return Number(first.completed) - Number(second.completed) || this.compareDueDates(first, second);
      }

      return this.compareDueDates(first, second) || this.priorityRank(second) - this.priorityRank(first);
    });
  }

  private compareDueDates(first: Task, second: Task): number {
    return this.dueDateRank(first) - this.dueDateRank(second) || this.dueDateTime(first) - this.dueDateTime(second);
  }

  private dueDateRank(task: Task): number {
    if (this.isOverdue(task)) {
      return 0;
    }

    if (this.isToday(task)) {
      return 1;
    }

    if (task.dueDate) {
      return 2;
    }

    return 3;
  }

  private dueDateTime(task: Task): number {
    if (!task.dueDate) {
      return Number.MAX_SAFE_INTEGER;
    }

    return this.parseLocalDate(task.dueDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  }

  private priorityRank(task: Task): number {
    const priority = this.taskPriority(task);

    if (priority === 'high') {
      return 3;
    }

    if (priority === 'medium') {
      return 2;
    }

    return 1;
  }

  private timestamp(value: string | undefined): number {
    return value ? new Date(value).getTime() : 0;
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

  private toTaskPayload(formValue: {
    title: string;
    description: string;
    completed: boolean;
    priority: TaskPriority;
    dueDate: string;
    projectId: number;
    labelIds: number[];
    color: string;
  }) {
    return {
      title: formValue.title,
      description: formValue.description,
      completed: formValue.completed,
      priority: formValue.priority,
      dueDate: formValue.dueDate || null,
      projectId: formValue.projectId || null,
      labelIds: formValue.labelIds,
      color: formValue.color || null
    };
  }

  private toPayloadFromTask(task: Task) {
    return {
      title: task.title,
      description: task.description ?? null,
      completed: task.completed,
      priority: this.taskPriority(task),
      dueDate: task.dueDate ?? null,
      projectId: task.project?.id ?? null,
      labelIds: task.labels?.map((label) => label.id) ?? [],
      color: task.color ?? null
    };
  }

  private loadSubtasks(taskId: number): void {
    this.subtaskService.getSubtasks(taskId).subscribe({
      next: (subtasks) => {
        this.setSubtasks(taskId, subtasks);
      },
      error: () => {
        this.toastService.show('Не удалось загрузить подзадачи', 'error');
      }
    });
  }

  private setSubtasks(taskId: number, subtasks: Subtask[]): void {
    this.subtasksByTaskId = {
      ...this.subtasksByTaskId,
      [taskId]: subtasks
    };

    const completed = subtasks.filter((subtask) => subtask.completed).length;
    this.tasks = this.tasks.map((task) =>
      task.id === taskId
        ? {
            ...task,
            subtaskTotal: subtasks.length,
            subtaskCompleted: completed
          }
        : task
    );
  }

  private resolveProjectId(task: Task, projectName: string | null | undefined): Observable<number | null> {
    const normalizedName = projectName?.trim();

    if (!normalizedName) {
      return of(task.project?.id ?? null);
    }

    const existingProject = this.projects.find((project) => project.name.toLowerCase() === normalizedName.toLowerCase());

    if (existingProject) {
      return of(existingProject.id);
    }

    return this.projectService.createProject({ name: normalizedName, color: task.color ?? '#3B82F6' }).pipe(
      map((project) => {
        this.projects = [...this.projects, project].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
        return project.id;
      })
    );
  }

  private resolveLabelIds(task: Task, labelNames: string[]): Observable<number[]> {
    const currentIds = task.labels?.map((label) => label.id) ?? [];
    const normalizedNames = [...new Set(labelNames.map((name) => name.trim()).filter(Boolean))];

    if (!normalizedNames.length) {
      return of(currentIds);
    }

    const existingByName = new Map(this.labels.map((label) => [label.name.toLowerCase(), label]));
    const existingIds = normalizedNames
      .map((name) => existingByName.get(name.toLowerCase())?.id)
      .filter((id): id is number => typeof id === 'number');
    const missingNames = normalizedNames.filter((name) => !existingByName.has(name.toLowerCase()));

    if (!missingNames.length) {
      return of([...new Set([...currentIds, ...existingIds])]);
    }

    return forkJoin(missingNames.map((name) => this.labelService.createLabel({ name, color: '#64748B' }))).pipe(
      map((createdLabels) => {
        this.labels = [...this.labels, ...createdLabels].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
        return [...new Set([...currentIds, ...existingIds, ...createdLabels.map((label) => label.id)])];
      })
    );
  }

  private selectValue(event: Event): string {
    const target = event.target;

    if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) {
      return target.value;
    }

    return '';
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

  private pluralize(value: number, one: string, few: string, many: string): string {
    const normalized = Math.abs(value) % 100;
    const lastDigit = normalized % 10;

    if (normalized > 10 && normalized < 20) {
      return many;
    }

    if (lastDigit === 1) {
      return one;
    }

    if (lastDigit >= 2 && lastDigit <= 4) {
      return few;
    }

    return many;
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
