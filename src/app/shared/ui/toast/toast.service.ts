import { Injectable } from '@angular/core';

export type ToastType = 'success' | 'error' | 'info';

export interface AppToast {
  id: number;
  message: string;
  type: ToastType;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private nextId = 1;
  readonly toasts: AppToast[] = [];

  show(message: string, type: ToastType = 'info'): void {
    const toast: AppToast = {
      id: this.nextId++,
      message,
      type
    };

    this.toasts.push(toast);
    window.setTimeout(() => this.dismiss(toast.id), 3600);
  }

  dismiss(id: number): void {
    const index = this.toasts.findIndex((toast) => toast.id === id);

    if (index >= 0) {
      this.toasts.splice(index, 1);
    }
  }
}
