import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface UserPreferences {
  avatarDataUrl: string | null;
  compactMode: boolean;
  reduceMotion: boolean;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  avatarDataUrl: null,
  compactMode: false,
  reduceMotion: false
};

@Injectable({
  providedIn: 'root'
})
export class UserPreferencesService {
  private readonly document = inject(DOCUMENT);
  private readonly storagePrefix = 'todo_user_preferences';
  private activeStorageKey = `${this.storagePrefix}:anonymous`;
  private readonly preferencesSubject = new BehaviorSubject<UserPreferences>({ ...DEFAULT_PREFERENCES });

  readonly preferences$ = this.preferencesSubject.asObservable();

  constructor() {
    this.applyUiPreferences(this.preferencesSubject.value);
  }

  get snapshot(): UserPreferences {
    return this.preferencesSubject.value;
  }

  useUser(username: string | null): void {
    this.activeStorageKey = username?.trim()
      ? `${this.storagePrefix}:${encodeURIComponent(username.trim())}`
      : `${this.storagePrefix}:anonymous`;

    const preferences = this.readPreferences();
    this.preferencesSubject.next(preferences);
    this.applyUiPreferences(preferences);
  }

  updateAvatar(avatarDataUrl: string | null): void {
    this.setPreferences({
      ...this.snapshot,
      avatarDataUrl
    });
  }

  updateUi(settings: Pick<UserPreferences, 'compactMode' | 'reduceMotion'>): void {
    this.setPreferences({
      ...this.snapshot,
      compactMode: settings.compactMode,
      reduceMotion: settings.reduceMotion
    });
  }

  removeAvatar(): void {
    this.setPreferences({
      ...this.snapshot,
      avatarDataUrl: null
    });
  }

  private setPreferences(preferences: UserPreferences): void {
    localStorage.setItem(this.activeStorageKey, JSON.stringify(preferences));
    this.preferencesSubject.next(preferences);
    this.applyUiPreferences(preferences);
  }

  private readPreferences(): UserPreferences {
    const raw = localStorage.getItem(this.activeStorageKey);

    if (!raw) {
      return DEFAULT_PREFERENCES;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<UserPreferences>;

      return {
        avatarDataUrl: typeof parsed.avatarDataUrl === 'string' ? parsed.avatarDataUrl : null,
        compactMode: Boolean(parsed.compactMode),
        reduceMotion: Boolean(parsed.reduceMotion)
      };
    } catch {
      return DEFAULT_PREFERENCES;
    }
  }

  private applyUiPreferences(preferences: UserPreferences): void {
    const classList = this.document.body.classList;

    classList.toggle('app-compact', preferences.compactMode);
    classList.toggle('app-reduce-motion', preferences.reduceMotion);
  }
}
