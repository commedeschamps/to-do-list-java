import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
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

  getUsername(): string | null {
    const token = this.getToken();

    if (!token) {
      return null;
    }

    return this.decodeJwtSubject(token);
  }

  isAuthenticated(): boolean {
    return Boolean(this.getToken());
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
  }

  getRegisterErrorMessage(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) {
      return 'Проверьте обязательные поля';
    }

    if (error.status === 0) {
      return 'Не удалось подключиться к серверу. Попробуйте позже.';
    }

    const message = typeof error.error === 'string' ? error.error : '';
    const normalizedMessage = message.toLowerCase();

    if (error.status === 409 || normalizedMessage.includes('пользовател')) {
      return 'Имя пользователя уже занято';
    }

    if (normalizedMessage.includes('email')) {
      return 'Email уже используется';
    }

    if (normalizedMessage.includes('пароль')) {
      return 'Пароль слишком короткий';
    }

    if (error.status === 400) {
      return message || 'Проверьте обязательные поля';
    }

    return message || 'Проверьте обязательные поля';
  }

  private decodeJwtSubject(token: string): string | null {
    const [, payload] = token.split('.');

    if (!payload) {
      return null;
    }

    try {
      const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
      const json = decodeURIComponent(
        atob(base64)
          .split('')
          .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`)
          .join('')
      );
      const decoded = JSON.parse(json) as { sub?: unknown };

      return typeof decoded.sub === 'string' && decoded.sub.trim() ? decoded.sub.trim() : null;
    } catch {
      return null;
    }
  }
}
