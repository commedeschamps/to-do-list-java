import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { AuthService } from '../../core/services/auth.service';
import { AiAssistantUiService } from '../../core/services/ai-assistant-ui.service';
import { AiService } from '../../core/services/ai.service';
import { UserPreferencesService } from '../../core/services/user-preferences.service';
import { ToastService } from '../../shared/ui/toast/toast.service';

type SettingsSection = 'profile' | 'interface' | 'ai' | 'account';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss'
})
export class SettingsComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly aiService = inject(AiService);
  private readonly aiAssistantUi = inject(AiAssistantUiService);
  private readonly fb = inject(FormBuilder);
  private readonly preferencesService = inject(UserPreferencesService);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);
  private readonly maxAvatarSize = 2 * 1024 * 1024;
  private readonly subscriptions = new Subscription();

  readonly profileForm = this.fb.nonNullable.group({
    displayName: ['', Validators.maxLength(80)]
  });

  readonly uiForm = this.fb.nonNullable.group({
    compactMode: [false],
    reduceMotion: [false]
  });

  avatarPreview: string | null = null;
  avatarErrorMessage = '';
  aiEnabled = false;
  aiStatusMessage = 'Проверяем доступность AI.';
  isSavingProfile = false;
  profileErrorMessage = '';
  activeSection: SettingsSection = 'profile';

  ngOnInit(): void {
    const preferences = this.preferencesService.snapshot;
    const currentUser = this.authService.getCurrentUser();

    this.profileForm.setValue({
      displayName: currentUser?.displayName ?? ''
    });
    this.uiForm.setValue({
      compactMode: preferences.compactMode,
      reduceMotion: preferences.reduceMotion
    });
    this.avatarPreview = preferences.avatarDataUrl;
    this.subscriptions.add(
      this.authService.currentUser$.subscribe((user) => {
        if (user && !this.profileForm.dirty && !this.isSavingProfile) {
          this.profileForm.controls.displayName.setValue(user.displayName ?? '');
        }
      })
    );
    this.loadAiStatus();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  get defaultDisplayName(): string {
    return this.authService.getDisplayName();
  }

  get accountUsername(): string {
    return this.authService.getUsername() ?? 'Пользователь';
  }

  get profileInitial(): string {
    const name = this.profileForm.controls.displayName.value.trim() || this.defaultDisplayName;
    return name.charAt(0).toLocaleUpperCase('ru-RU') || 'П';
  }

  get profileIdentityName(): string {
    return this.profileForm.controls.displayName.value.trim() || this.defaultDisplayName;
  }

  selectSection(section: SettingsSection): void {
    this.activeSection = section;
  }

  resetProfile(): void {
    const currentUser = this.authService.getCurrentUser();
    this.profileForm.controls.displayName.setValue(currentUser?.displayName ?? '');
    this.profileForm.markAsPristine();
    this.avatarPreview = this.preferencesService.snapshot.avatarDataUrl;
    this.avatarErrorMessage = '';
    this.profileErrorMessage = '';
  }

  onAvatarSelected(event: Event): void {
    this.avatarErrorMessage = '';
    const input = event.target;

    if (!(input instanceof HTMLInputElement) || !input.files?.length) {
      return;
    }

    const file = input.files[0];
    input.value = '';

    if (!file.type.startsWith('image/')) {
      this.avatarErrorMessage = 'Выберите файл изображения.';
      this.toastService.show('Аватар должен быть изображением', 'error');
      return;
    }

    if (file.size > this.maxAvatarSize) {
      this.avatarErrorMessage = 'Размер изображения должен быть до 2 МБ.';
      this.toastService.show('Аватар должен быть меньше 2 МБ', 'error');
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      this.avatarPreview = typeof reader.result === 'string' ? reader.result : null;
      this.toastService.show('Фото готово к сохранению', 'info');
    };
    reader.onerror = () => {
      this.avatarErrorMessage = 'Не удалось прочитать изображение.';
      this.toastService.show('Не удалось прочитать аватар', 'error');
    };
    reader.readAsDataURL(file);
  }

  saveProfile(): void {
    this.avatarErrorMessage = '';
    this.profileErrorMessage = '';

    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    const value = this.profileForm.getRawValue();
    this.isSavingProfile = true;

    this.authService.updateProfile(value.displayName).subscribe({
      next: (user) => {
        this.isSavingProfile = false;
        this.profileForm.controls.displayName.setValue(user.displayName ?? '');
        this.profileForm.markAsPristine();
        this.preferencesService.updateAvatar(this.avatarPreview);
        this.toastService.show('Профиль сохранён', 'success');
      },
      error: () => {
        this.isSavingProfile = false;
        this.profileErrorMessage = 'Не удалось сохранить профиль. Попробуйте ещё раз.';
        this.toastService.show('Не удалось сохранить профиль', 'error');
      }
    });
  }

  removeAvatar(): void {
    this.avatarPreview = null;
    this.preferencesService.removeAvatar();
    this.toastService.show('Аватар удалён', 'info');
  }

  saveUiSettings(): void {
    this.preferencesService.updateUi(this.uiForm.getRawValue());
    this.toastService.show('Настройки интерфейса сохранены', 'success');
  }

  openAiAssistant(): void {
    this.aiAssistantUi.open('ask');
  }

  logout(): void {
    this.authService.logout();
    void this.router.navigateByUrl('/login');
  }

  private loadAiStatus(): void {
    this.aiService.getStatus().subscribe({
      next: (status) => {
        this.aiEnabled = status.enabled;
        this.aiStatusMessage = status.message;
      },
      error: () => {
        this.aiEnabled = false;
        this.aiStatusMessage = 'AI-помощник временно недоступен.';
      }
    });
  }
}
