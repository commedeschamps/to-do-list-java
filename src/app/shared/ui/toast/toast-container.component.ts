import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';

import { AppToast, ToastService } from './toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-container" aria-live="polite" aria-atomic="true">
      @for (toast of toastService.toasts; track toast.id) {
        <article class="app-toast" [ngClass]="toastClass(toast)">
          <span class="app-toast__icon" aria-hidden="true">
            {{ toastIcon(toast) }}
          </span>
          <p>{{ toast.message }}</p>
          <button
            class="app-toast__close"
            type="button"
            aria-label="Закрыть уведомление"
            (click)="toastService.dismiss(toast.id)"
          >
            ×
          </button>
        </article>
      }
    </div>
  `
})
export class ToastContainerComponent {
  readonly toastService = inject(ToastService);

  toastClass(toast: AppToast): string {
    return `app-toast--${toast.type}`;
  }

  toastIcon(toast: AppToast): string {
    if (toast.type === 'success') {
      return '✓';
    }

    if (toast.type === 'error') {
      return '!';
    }

    return 'i';
  }
}
