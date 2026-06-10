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
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./layout/app-shell/app-shell.component').then((m) => m.AppShellComponent),
    children: [
      {
        path: 'tasks',
        loadComponent: () =>
          import('./features/tasks/tasks.component').then((m) => m.TasksComponent)
      },
      {
        path: 'today',
        loadComponent: () =>
          import('./features/today/today.component').then((m) => m.TodayComponent)
      },
      {
        path: 'calendar',
        loadComponent: () =>
          import('./features/calendar/calendar.component').then((m) => m.CalendarComponent)
      },
      {
        path: 'priorities',
        loadComponent: () =>
          import('./features/priorities/priorities.component').then((m) => m.PrioritiesComponent)
      },
      {
        path: 'stats',
        loadComponent: () =>
          import('./features/stats/stats.component').then((m) => m.StatsComponent)
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/settings/settings.component').then((m) => m.SettingsComponent)
      },
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'tasks'
      }
    ]
  },
  {
    path: '**',
    redirectTo: 'tasks'
  }
];
