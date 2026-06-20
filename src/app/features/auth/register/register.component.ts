import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss'
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly form = this.fb.nonNullable.group(
    {
      username: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(30)]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required]
    },
    { validators: this.passwordsMatchValidator() }
  );

  isSubmitting = false;
  errorMessage = '';
  showPassword = false;
  showConfirmPassword = false;

  submit(): void {
    this.errorMessage = '';

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    const { username, password } = this.form.getRawValue();

    this.authService.register({ username, password }).subscribe({
      next: () => {
        this.isSubmitting = false;
        void this.router.navigateByUrl('/tasks');
      },
      error: (error: unknown) => {
        this.isSubmitting = false;
        const message = this.authService.getRegisterErrorMessage(error);
        this.errorMessage = message === 'Проверьте обязательные поля' && this.form.valid
          ? 'Не удалось завершить регистрацию. Попробуйте войти или повторите позже.'
          : message;
      }
    });
  }

  get usernameErrorMessage(): string {
    const control = this.form.controls.username;

    if (!this.shouldShowValidation(control) || control.valid) {
      return '';
    }

    if (control.hasError('required')) {
      return 'Введите логин';
    }

    if (control.hasError('minlength') || control.hasError('maxlength')) {
      return 'Логин должен быть от 3 до 30 символов';
    }

    return '';
  }

  get passwordErrorMessage(): string {
    const control = this.form.controls.password;

    if (!this.shouldShowValidation(control) || control.valid) {
      return '';
    }

    if (control.hasError('required')) {
      return 'Введите пароль';
    }

    if (control.hasError('minlength')) {
      return 'Пароль должен быть не короче 6 символов';
    }

    return '';
  }

  get confirmPasswordErrorMessage(): string {
    const control = this.form.controls.confirmPassword;

    if (!this.shouldShowValidation(control)) {
      return '';
    }

    if (control.hasError('required')) {
      return 'Подтвердите пароль';
    }

    if (this.form.hasError('passwordMismatch')) {
      return 'Пароли не совпадают';
    }

    return '';
  }

  isFieldInvalid(control: AbstractControl): boolean {
    return this.shouldShowValidation(control) && control.invalid;
  }

  isFieldValid(control: AbstractControl): boolean {
    return this.shouldShowValidation(control) && control.valid;
  }

  isConfirmPasswordInvalid(): boolean {
    const control = this.form.controls.confirmPassword;
    return this.shouldShowValidation(control) && (control.invalid || this.form.hasError('passwordMismatch'));
  }

  isConfirmPasswordValid(): boolean {
    const password = this.form.controls.password;
    const confirmPassword = this.form.controls.confirmPassword;

    return this.shouldShowValidation(confirmPassword)
      && password.valid
      && confirmPassword.valid
      && !this.form.hasError('passwordMismatch');
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  private passwordsMatchValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const password = control.get('password')?.value;
      const confirmPassword = control.get('confirmPassword')?.value;

      if (!password || !confirmPassword) {
        return null;
      }

      return password === confirmPassword ? null : { passwordMismatch: true };
    };
  }

  private shouldShowValidation(control: AbstractControl): boolean {
    return control.touched || control.dirty;
  }
}
