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
    return this.http.post<Task>(this.apiUrl, {
      title: payload.title,
      description: payload.description
    });
  }

  updateTask(id: number, payload: Required<TaskPayload>): Observable<Task> {
    return this.http.put<Task>(`${this.apiUrl}/${id}`, payload);
  }

  deleteTask(id: number): Observable<string> {
    return this.http.delete(`${this.apiUrl}/${id}`, { responseType: 'text' });
  }
}
