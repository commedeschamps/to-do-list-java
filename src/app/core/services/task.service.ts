import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Task, TaskPayload } from '../../shared/models/task.model';

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

  private toRequestPayload(payload: TaskPayload): Required<TaskPayload> {
    return {
      title: payload.title,
      description: payload.description,
      completed: payload.completed ?? false,
      priority: payload.priority ?? 'medium',
      dueDate: payload.dueDate || null
    };
  }
}
