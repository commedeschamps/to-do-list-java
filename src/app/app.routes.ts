import { Routes } from '@angular/router';

import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then(
        (m) => m.LoginComponent
      )
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./features/auth/register/register.component').then(
        (m) => m.RegisterComponent
      )
  },
  {
    path: 'tasks',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/tasks/tasks.component').then((m) => m.TasksComponent)
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'tasks'
  },
  {
    path: '**',
    redirectTo: 'tasks'
  }
];
