import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuthCredentials, AuthResponse, CurrentUser } from '../../shared/models/auth.model';
import { UserPreferencesService } from './user-preferences.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly preferencesService = inject(UserPreferencesService);
  private readonly apiUrl = `${environment.apiUrl}/auth`;
  private readonly tokenKey = 'todo_jwt_token';
  private readonly currentUserKey = 'todo_current_user';
  private readonly currentUserSubject = new BehaviorSubject<CurrentUser | null>(this.readStoredCurrentUser());

  readonly currentUser$ = this.currentUserSubject.asObservable();

  constructor() {
    this.preferencesService.useUser(this.currentUserSubject.value?.username ?? this.getUsername());
  }

  register(credentials: AuthCredentials): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/register`, credentials)
      .pipe(tap((response) => this.saveSession(response)));
  }

  login(credentials: AuthCredentials): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/login`, credentials)
      .pipe(tap((response) => this.saveSession(response)));
  }

  refreshCurrentUser(): Observable<CurrentUser> {
    return this.http
      .get<CurrentUser>(`${this.apiUrl}/me`)
      .pipe(tap((user) => this.saveCurrentUser(user)));
  }

  updateProfile(displayName: string): Observable<CurrentUser> {
    return this.http
      .put<CurrentUser>(`${this.apiUrl}/me/profile`, { displayName })
      .pipe(tap((user) => this.saveCurrentUser(user)));
  }

  saveToken(token: string): void {
    localStorage.setItem(this.tokenKey, token);
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  getUsername(): string | null {
    const currentUser = this.getCurrentUser();

    if (currentUser) {
      return currentUser.username;
    }

    const token = this.getToken();

    if (!token) {
      return null;
    }

    return this.decodeJwtSubject(token);
  }

  getCurrentUser(): CurrentUser | null {
    return this.currentUserSubject.value;
  }

  getDisplayName(user: CurrentUser | null = this.getCurrentUser()): string {
    const displayName = user?.displayName?.trim();
    return displayName || user?.username || 'Пользователь';
  }

  isAuthenticated(): boolean {
    return Boolean(this.getToken());
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.currentUserKey);
    this.currentUserSubject.next(null);
    this.preferencesService.useUser(null);
  }

  getRegisterErrorMessage(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) {
      return 'Проверьте обязательные поля';
    }

    if (error.status === 0) {
      return 'Не удалось подключиться к серверу. Попробуйте позже.';
    }

    if (error.status === 200) {
      return 'Аккаунт создан, но автоматический вход не сработал. Войдите вручную.';
    }

    const message = this.extractErrorMessage(error);
    const normalizedMessage = message.toLowerCase();

    if (error.status === 409 || normalizedMessage.includes('пользовател')) {
      return 'Имя пользователя уже занято';
    }

    if (normalizedMessage.includes('пароль')) {
      return 'Пароль слишком короткий';
    }

    if (error.status === 400) {
      return message || 'Проверьте обязательные поля';
    }

    return message || 'Проверьте обязательные поля';
  }

  getLoginErrorMessage(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) {
      return 'Неверное имя пользователя или пароль';
    }

    if (error.status === 0) {
      return 'Не удалось подключиться к серверу. Попробуйте позже.';
    }

    return this.extractErrorMessage(error) || 'Неверное имя пользователя или пароль';
  }

  private saveSession(response: AuthResponse): void {
    this.saveToken(response.token);
    this.saveCurrentUser(response.user);
  }

  private saveCurrentUser(user: CurrentUser): void {
    localStorage.setItem(this.currentUserKey, JSON.stringify(user));
    this.currentUserSubject.next(user);
    this.preferencesService.useUser(user.username);
  }

  private readStoredCurrentUser(): CurrentUser | null {
    const tokenUsername = this.getToken() ? this.decodeJwtSubject(this.getToken() ?? '') : null;

    if (!tokenUsername) {
      localStorage.removeItem(this.currentUserKey);
      return null;
    }

    const raw = localStorage.getItem(this.currentUserKey);

    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<CurrentUser>;

      if (typeof parsed.id === 'number' && typeof parsed.username === 'string' && parsed.username.trim()) {
        const username = parsed.username.trim();

        if (username !== tokenUsername) {
          localStorage.removeItem(this.currentUserKey);
          return null;
        }

        return {
          id: parsed.id,
          username,
          displayName: typeof parsed.displayName === 'string' ? parsed.displayName : null
        };
      }

      localStorage.removeItem(this.currentUserKey);
      return null;
    } catch {
      localStorage.removeItem(this.currentUserKey);
      return null;
    }
  }

  private extractErrorMessage(error: HttpErrorResponse): string {
    if (typeof error.error === 'string') {
      return error.error;
    }

    if (error.error && typeof error.error === 'object' && 'message' in error.error) {
      const message = (error.error as { message?: unknown }).message;
      return typeof message === 'string' ? message : '';
    }

    if (error.error && typeof error.error === 'object' && 'text' in error.error) {
      const text = (error.error as { text?: unknown }).text;
      return typeof text === 'string' ? text : '';
    }

    return '';
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
