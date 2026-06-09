import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuthCredentials } from '../../shared/models/auth.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/auth`;
  private readonly tokenKey = 'todo_jwt_token';

  register(credentials: AuthCredentials): Observable<string> {
    return this.http.post(`${this.apiUrl}/register`, credentials, {
      responseType: 'text'
    });
  }

  login(credentials: AuthCredentials): Observable<string> {
    return this.http
      .post(`${this.apiUrl}/login`, credentials, { responseType: 'text' })
      .pipe(tap((token) => this.saveToken(token)));
  }

  saveToken(token: string): void {
    localStorage.setItem(this.tokenKey, token);
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  isAuthenticated(): boolean {
    return Boolean(this.getToken());
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
  }
}
