import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, OnDestroy, ViewChild, inject } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Subscription, filter } from 'rxjs';

import { AuthService } from '../../core/services/auth.service';
import { ProjectService } from '../../core/services/task.service';
import { UserPreferences, UserPreferencesService } from '../../core/services/user-preferences.service';
import { CurrentUser } from '../../shared/models/auth.model';
import { Project } from '../../shared/models/task.model';
import { ToastContainerComponent } from '../../shared/ui/toast/toast-container.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet, ToastContainerComponent],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss'
})
export class AppShellComponent implements OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly projectService = inject(ProjectService);
  private readonly preferencesService = inject(UserPreferencesService);
  private readonly router = inject(Router);
  private readonly subscriptions = new Subscription();

  @ViewChild('profileMenuHost') private profileMenuHost?: ElementRef<HTMLElement>;

  preferences: UserPreferences = this.preferencesService.snapshot;
  currentUser: CurrentUser | null = this.authService.getCurrentUser();
  projects: Project[] = [];
  isProfileMenuOpen = false;
  isSidebarOpen = false;

  constructor() {
    this.subscriptions.add(
      this.preferencesService.preferences$.subscribe((preferences) => {
        this.preferences = preferences;
      })
    );

    this.subscriptions.add(
      this.authService.currentUser$.subscribe((user) => {
        this.currentUser = user;
      })
    );

    this.subscriptions.add(
      this.router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd)).subscribe(() => {
        this.closeSidebar();
        this.closeProfileMenu();
        this.loadProjects();
      })
    );

    this.subscriptions.add(
      this.authService.refreshCurrentUser().subscribe({
        next: () => {
          this.loadProjects();
        },
        error: () => {
          this.authService.logout();
          void this.router.navigateByUrl('/login');
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  get pageTitle(): string {
    const path = this.router.url.split('?')[0].split('#')[0];

    if (path.startsWith('/today')) {
      return 'Сегодня';
    }

    if (path.startsWith('/calendar')) {
      return 'Календарь';
    }

    if (path.startsWith('/priorities')) {
      return 'Приоритеты';
    }

    if (path.startsWith('/stats')) {
      return 'Статистика';
    }

    if (path.startsWith('/settings')) {
      return 'Настройки';
    }

    return 'Задачи';
  }

  get profileName(): string {
    const displayName = this.preferences.displayName.trim();

    if (displayName) {
      return displayName;
    }

    const username = this.currentUser?.username ?? this.authService.getUsername();

    if (!username) {
      return 'Пользователь';
    }

    return username;
  }

  get profileInitial(): string {
    return this.profileName.trim().charAt(0).toLocaleUpperCase('ru-RU') || 'П';
  }

  get avatarDataUrl(): string | null {
    return this.preferences.avatarDataUrl;
  }

  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;

    if (this.isSidebarOpen) {
      this.closeProfileMenu();
    }
  }

  closeSidebar(): void {
    this.isSidebarOpen = false;
  }

  toggleProfileMenu(): void {
    this.isProfileMenuOpen = !this.isProfileMenuOpen;
  }

  closeProfileMenu(): void {
    this.isProfileMenuOpen = false;
  }

  logout(): void {
    this.closeProfileMenu();
    this.closeSidebar();
    this.authService.logout();
    void this.router.navigateByUrl('/login');
  }

  private loadProjects(): void {
    this.projectService.getProjects().subscribe({
      next: (projects) => {
        this.projects = projects;
      },
      error: () => {
        this.projects = [];
      }
    });
  }

  @HostListener('document:keydown', ['$event'])
  handleDocumentKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') {
      return;
    }

    if (this.isProfileMenuOpen) {
      this.closeProfileMenu();
      return;
    }

    if (this.isSidebarOpen) {
      this.closeSidebar();
    }
  }

  @HostListener('document:click', ['$event'])
  handleDocumentClick(event: MouseEvent): void {
    if (!this.isProfileMenuOpen) {
      return;
    }

    const target = event.target;

    if (target instanceof Node && this.profileMenuHost?.nativeElement.contains(target)) {
      return;
    }

    this.closeProfileMenu();
  }
}
