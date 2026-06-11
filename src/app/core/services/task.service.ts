import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Label, LabelPayload, Project, ProjectPayload, Subtask, SubtaskPayload, Task, TaskPayload } from '../../shared/models/task.model';

@Injectable({
  providedIn: 'root'
})
export class TaskService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/tasks`;

  getTasks(): Observable<Task[]> {
    return this.http.get<Task[]>(this.apiUrl);
  }

  createTask(payload: TaskPayload): Observable<Task> {
    return this.http.post<Task>(this.apiUrl, this.toRequestPayload(payload));
  }

  updateTask(id: number, payload: TaskPayload): Observable<Task> {
    return this.http.put<Task>(`${this.apiUrl}/${id}`, this.toRequestPayload(payload));
  }

  deleteTask(id: number): Observable<string> {
    return this.http.delete(`${this.apiUrl}/${id}`, { responseType: 'text' });
  }

  private toRequestPayload(payload: TaskPayload) {
    return {
      title: payload.title,
      description: payload.description?.trim() || null,
      completed: payload.completed ?? false,
      priority: payload.priority ?? 'medium',
      dueDate: payload.dueDate || null,
      projectId: payload.projectId ?? null,
      labelIds: payload.labelIds,
      color: payload.color?.trim() || null
    };
  }
}

@Injectable({
  providedIn: 'root'
})
export class ProjectService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/projects`;

  getProjects(): Observable<Project[]> {
    return this.http.get<Project[]>(this.apiUrl);
  }

  createProject(payload: ProjectPayload): Observable<Project> {
    return this.http.post<Project>(this.apiUrl, payload);
  }

  updateProject(id: number, payload: ProjectPayload): Observable<Project> {
    return this.http.put<Project>(`${this.apiUrl}/${id}`, payload);
  }

  deleteProject(id: number): Observable<string> {
    return this.http.delete(`${this.apiUrl}/${id}`, { responseType: 'text' });
  }
}

@Injectable({
  providedIn: 'root'
})
export class LabelService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/labels`;

  getLabels(): Observable<Label[]> {
    return this.http.get<Label[]>(this.apiUrl);
  }

  createLabel(payload: LabelPayload): Observable<Label> {
    return this.http.post<Label>(this.apiUrl, payload);
  }

  updateLabel(id: number, payload: LabelPayload): Observable<Label> {
    return this.http.put<Label>(`${this.apiUrl}/${id}`, payload);
  }

  deleteLabel(id: number): Observable<string> {
    return this.http.delete(`${this.apiUrl}/${id}`, { responseType: 'text' });
  }
}

@Injectable({
  providedIn: 'root'
})
export class SubtaskService {
  private readonly http = inject(HttpClient);
  private readonly taskApiUrl = `${environment.apiUrl}/tasks`;

  getSubtasks(taskId: number): Observable<Subtask[]> {
    return this.http.get<Subtask[]>(`${this.taskApiUrl}/${taskId}/subtasks`);
  }

  createSubtask(taskId: number, payload: SubtaskPayload): Observable<Subtask> {
    return this.http.post<Subtask>(`${this.taskApiUrl}/${taskId}/subtasks`, payload);
  }

  updateSubtask(taskId: number, subtaskId: number, payload: SubtaskPayload): Observable<Subtask> {
    return this.http.patch<Subtask>(`${this.taskApiUrl}/${taskId}/subtasks/${subtaskId}`, payload);
  }

  deleteSubtask(taskId: number, subtaskId: number): Observable<string> {
    return this.http.delete(`${this.taskApiUrl}/${taskId}/subtasks/${subtaskId}`, { responseType: 'text' });
  }
}
