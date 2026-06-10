import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FullCalendarModule } from '@fullcalendar/angular';
import { CalendarOptions, EventClickArg, EventInput } from '@fullcalendar/core';
import ruLocale from '@fullcalendar/core/locales/ru';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin, { DateClickArg } from '@fullcalendar/interaction';
import timeGridPlugin from '@fullcalendar/timegrid';
import { finalize } from 'rxjs';

import { TaskService } from '../../core/services/task.service';
import { Task, TaskPriority } from '../../shared/models/task.model';
import { ToastService } from '../../shared/ui/toast/toast.service';

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule, FullCalendarModule, ReactiveFormsModule],
  templateUrl: './calendar.component.html',
  styleUrl: './calendar.component.scss'
})
export class CalendarComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly taskService = inject(TaskService);
  private readonly toastService = inject(ToastService);

  readonly priorities: Array<{ label: string; value: TaskPriority }> = [
    { label: 'Низкий', value: 'low' },
    { label: 'Средний', value: 'medium' },
    { label: 'Высокий', value: 'high' }
  ];

  readonly taskForm = this.fb.nonNullable.group({
    title: ['', Validators.required],
    description: ['', Validators.required],
    completed: [false],
    priority: ['medium' as TaskPriority, Validators.required],
    dueDate: ['', Validators.required]
  });

  calendarOptions: CalendarOptions = {
    plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
    initialView: 'dayGridMonth',
    locales: [ruLocale],
    locale: 'ru',
    firstDay: 1,
    height: 'auto',
    eventDisplay: 'block',
    dayMaxEvents: 3,
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek'
    },
    buttonText: {
      today: 'Сегодня',
      month: 'Месяц',
      week: 'Неделя'
    },
    dateClick: this.handleDateClick.bind(this),
    eventClick: this.handleEventClick.bind(this),
    events: []
  };

  tasks: Task[] = [];
  editingTask: Task | null = null;
  formErrorMessage = '';
  isLoading = false;
  isModalOpen = false;
  isSaving = false;
  listErrorMessage = '';

  ngOnInit(): void {
    this.loadTasks();
  }

  get calendarTaskCount(): number {
    return this.tasks.filter((task) => task.dueDate).length;
  }

  get modalTitle(): string {
    return this.editingTask ? 'Редактировать задачу' : 'Новая задача';
  }

  get modalSubtitle(): string {
    return this.editingTask ? 'Обновите детали задачи в календаре.' : 'Создайте задачу с датой дедлайна.';
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
          this.listErrorMessage = 'Не удалось загрузить календарь.';
          this.toastService.show('Не удалось загрузить календарь', 'error');
        }
      });
  }

  handleDateClick(arg: DateClickArg): void {
    this.openCreateModal(arg.dateStr);
  }

  handleEventClick(arg: EventClickArg): void {
    const taskId = Number(arg.event.id);
    const task = this.tasks.find((item) => item.id === taskId);

    if (task) {
      this.openEditModal(task);
    }
  }

  openCreateModal(dueDate = this.todayDateString()): void {
    this.editingTask = null;
    this.formErrorMessage = '';
    this.taskForm.reset({
      title: '',
      description: '',
      completed: false,
      priority: 'medium',
      dueDate
    });
    this.isModalOpen = true;
  }

  openEditModal(task: Task): void {
    this.editingTask = task;
    this.formErrorMessage = '';
    this.taskForm.reset({
      title: task.title,
      description: task.description,
      completed: task.completed,
      priority: this.taskPriority(task),
      dueDate: task.dueDate ?? this.todayDateString()
    });
    this.isModalOpen = true;
  }

  closeModal(): void {
    this.isModalOpen = false;
    this.editingTask = null;
    this.formErrorMessage = '';
  }

  submitTask(): void {
    this.formErrorMessage = '';

    if (this.taskForm.invalid) {
      this.taskForm.markAllAsTouched();
      return;
    }

    const payload = this.taskForm.getRawValue();
    this.isSaving = true;

    if (this.editingTask) {
      this.taskService
        .updateTask(this.editingTask.id, payload)
        .pipe(finalize(() => (this.isSaving = false)))
        .subscribe({
          next: (updatedTask) => {
            this.setTasks(this.tasks.map((task) => (task.id === updatedTask.id ? updatedTask : task)));
            this.closeModal();
            this.toastService.show('Задача обновлена', 'success');
          },
          error: () => {
            this.formErrorMessage = 'Не удалось обновить задачу.';
            this.toastService.show('Не удалось обновить задачу', 'error');
          }
        });
      return;
    }

    this.taskService
      .createTask(payload)
      .pipe(finalize(() => (this.isSaving = false)))
      .subscribe({
        next: (createdTask) => {
          this.setTasks([createdTask, ...this.tasks]);
          this.closeModal();
          this.toastService.show('Задача создана', 'success');
        },
        error: () => {
          this.formErrorMessage = 'Не удалось создать задачу.';
          this.toastService.show('Не удалось создать задачу', 'error');
        }
      });
  }

  setPriority(priority: TaskPriority): void {
    this.taskForm.controls.priority.setValue(priority);
  }

  taskPriority(task: Task): TaskPriority {
    return this.normalizePriority(task.priority);
  }

  @HostListener('document:keydown.escape')
  handleEscape(): void {
    if (this.isModalOpen) {
      this.closeModal();
    }
  }

  private setTasks(tasks: Task[]): void {
    this.tasks = tasks.map((task) => ({
      ...task,
      priority: this.normalizePriority(task.priority)
    }));
    this.refreshEvents();
  }

  private refreshEvents(): void {
    const events: EventInput[] = this.tasks
      .filter((task) => task.dueDate)
      .map((task) => ({
        id: String(task.id),
        title: task.title,
        start: task.dueDate ?? undefined,
        backgroundColor: this.eventColor(task),
        borderColor: this.eventBorderColor(task),
        textColor: '#ffffff',
        classNames: task.completed ? ['calendar-event--completed'] : []
      }));

    this.calendarOptions = {
      ...this.calendarOptions,
      events
    };
  }

  private eventColor(task: Task): string {
    if (task.completed) {
      return '#15803d';
    }

    const priority = this.taskPriority(task);

    if (priority === 'high') {
      return '#d97706';
    }

    if (priority === 'low') {
      return '#2563eb';
    }

    return '#0f766e';
  }

  private eventBorderColor(task: Task): string {
    return task.completed ? '#16a34a' : this.eventColor(task);
  }

  private normalizePriority(priority: TaskPriority | string | undefined): TaskPriority {
    if (priority === 'low' || priority === 'medium' || priority === 'high') {
      return priority;
    }

    return 'medium';
  }

  private todayDateString(): string {
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');

    return `${today.getFullYear()}-${month}-${day}`;
  }
}
