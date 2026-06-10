import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface UserPreferences {
  avatarDataUrl: string | null;
  compactMode: boolean;
  displayName: string;
  email: string;
  reduceMotion: boolean;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  avatarDataUrl: null,
  compactMode: false,
  displayName: '',
  email: '',
  reduceMotion: false
};

@Injectable({
  providedIn: 'root'
})
export class UserPreferencesService {
  private readonly document = inject(DOCUMENT);
  private readonly storageKey = 'todo_user_preferences';
  private readonly preferencesSubject = new BehaviorSubject<UserPreferences>(this.readPreferences());

  readonly preferences$ = this.preferencesSubject.asObservable();

  constructor() {
    this.applyUiPreferences(this.preferencesSubject.value);
  }

  get snapshot(): UserPreferences {
    return this.preferencesSubject.value;
  }

  updateProfile(profile: Pick<UserPreferences, 'displayName' | 'email' | 'avatarDataUrl'>): void {
    this.setPreferences({
      ...this.snapshot,
      displayName: profile.displayName.trim(),
      email: profile.email.trim(),
      avatarDataUrl: profile.avatarDataUrl
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
    localStorage.setItem(this.storageKey, JSON.stringify(preferences));
    this.preferencesSubject.next(preferences);
    this.applyUiPreferences(preferences);
  }

  private readPreferences(): UserPreferences {
    const raw = localStorage.getItem(this.storageKey);

    if (!raw) {
      return DEFAULT_PREFERENCES;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<UserPreferences>;

      return {
        avatarDataUrl: typeof parsed.avatarDataUrl === 'string' ? parsed.avatarDataUrl : null,
        compactMode: Boolean(parsed.compactMode),
        displayName: typeof parsed.displayName === 'string' ? parsed.displayName : '',
        email: typeof parsed.email === 'string' ? parsed.email : '',
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
