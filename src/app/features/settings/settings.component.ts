import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';
import { UserPreferencesService } from '../../core/services/user-preferences.service';
import { ToastService } from '../../shared/ui/toast/toast.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss'
})
export class SettingsComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly preferencesService = inject(UserPreferencesService);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);
  private readonly maxAvatarSize = 2 * 1024 * 1024;

  readonly profileForm = this.fb.nonNullable.group({
    displayName: [''],
    email: ['', Validators.email]
  });

  readonly uiForm = this.fb.nonNullable.group({
    compactMode: [false],
    reduceMotion: [false]
  });

  avatarPreview: string | null = null;
  avatarErrorMessage = '';

  ngOnInit(): void {
    const preferences = this.preferencesService.snapshot;

    this.profileForm.setValue({
      displayName: preferences.displayName || this.defaultDisplayName,
      email: preferences.email || this.defaultEmail
    });
    this.uiForm.setValue({
      compactMode: preferences.compactMode,
      reduceMotion: preferences.reduceMotion
    });
    this.avatarPreview = preferences.avatarDataUrl;
  }

  get defaultDisplayName(): string {
    const username = this.authService.getUsername();

    if (!username) {
      return 'Пользователь';
    }

    return username.includes('@') ? username.split('@')[0] || 'Пользователь' : username;
  }

  get defaultEmail(): string {
    const username = this.authService.getUsername();
    return username?.includes('@') ? username : 'user@example.com';
  }

  get profileInitial(): string {
    const name = this.profileForm.controls.displayName.value.trim() || this.defaultDisplayName;
    return name.charAt(0).toLocaleUpperCase('ru-RU') || 'П';
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
      this.toastService.show('Avatar готов к сохранению', 'info');
    };
    reader.onerror = () => {
      this.avatarErrorMessage = 'Не удалось прочитать изображение.';
      this.toastService.show('Не удалось прочитать аватар', 'error');
    };
    reader.readAsDataURL(file);
  }

  saveProfile(): void {
    this.avatarErrorMessage = '';

    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      this.toastService.show('Проверьте email', 'error');
      return;
    }

    const value = this.profileForm.getRawValue();
    this.preferencesService.updateProfile({
      avatarDataUrl: this.avatarPreview,
      displayName: value.displayName,
      email: value.email
    });
    this.toastService.show('Профиль сохранён', 'success');
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

  logout(): void {
    this.authService.logout();
    void this.router.navigateByUrl('/login');
  }
}
