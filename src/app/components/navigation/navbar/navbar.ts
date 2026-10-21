import { Component, Output, Input, EventEmitter, inject, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ThemeService } from '../../../services/theme.service';
import { AuthService, User } from '../../../services/auth.service';
import { NavigationSettingsService } from '../../../services/navigation-settings.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
    MatDividerModule
  ],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NavbarComponent implements OnInit, OnDestroy, AfterViewInit {
  @Output() menuToggle = new EventEmitter<void>();
  @Input() showMenuButton = true;
  @ViewChild('navbarToolbar', { read: ElementRef }) navbarToolbar!: ElementRef;

  private themeService = inject(ThemeService);
  private authService = inject(AuthService);
  private navigationSettingsService = inject(NavigationSettingsService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  isDarkMode = false;
  isLoggedIn = false;
  currentUser: User | null = null;
  userAvatar = '/assets/images/default-avatar.svg';
  userName = 'User';
  userEmail = '';
  imageLoadError = false;
  canAccessAdmin = false;
  navbarBackgroundColor = '#1976d2';

  private subscriptions = new Subscription();

  ngOnInit() {
    // Subscribe to theme changes
    this.subscriptions.add(
      this.themeService.isDarkMode$.subscribe((isDark: boolean) => {
        this.isDarkMode = isDark;
        this.cdr.markForCheck();
      })
    );

    // Subscribe to auth state changes
    this.subscriptions.add(
      this.authService.isAuthenticated$.subscribe((isAuth: boolean) => {
        this.isLoggedIn = isAuth;
        this.cdr.markForCheck();
      })
    );

    // Subscribe to current user changes
    this.subscriptions.add(
      this.authService.currentUser$.subscribe((user: User | null) => {
        this.currentUser = user;
        this.updateUserData(user);
        this.cdr.markForCheck();
      })
    );

    // Subscribe to navigation settings for navbar color
    this.subscriptions.add(
      this.navigationSettingsService.settings$.subscribe(settings => {
        if (settings?.navbarBackgroundColor) {
          this.navbarBackgroundColor = settings.navbarBackgroundColor;
          setTimeout(() => this.applyNavbarStyles(), 100);
          this.cdr.markForCheck();
        }
      })
    );
  }

  ngAfterViewInit() {
    setTimeout(() => this.applyNavbarStyles(), 100);
  }

  applyNavbarStyles() {
    if (this.navbarToolbar?.nativeElement) {
      this.navbarToolbar.nativeElement.style.setProperty('background-color', this.navbarBackgroundColor, 'important');
      // Keep the brand and menu readable on administrator-selected navbar colors.
      const hex = this.navbarBackgroundColor.replace('#', '');
      const expanded = hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex;
      const channels = [0, 2, 4].map(offset => {
        const value = parseInt(expanded.slice(offset, offset + 2), 16) / 255;
        return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
      });
      const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
      const foreground = luminance > 0.179 ? '#172033' : '#ffffff';
      this.navbarToolbar.nativeElement.style.setProperty('--navbar-foreground', foreground);
    }
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  private updateUserData(user: User | null): void {
    if (user) {
      this.userAvatar = user.avatar || '/assets/images/default-avatar.svg';
      this.userName = user.name || 'User';
      this.userEmail = user.email || '';
      this.canAccessAdmin = this.authService.canAccessAdminPanel();
    } else {
      this.userAvatar = '/assets/images/default-avatar.svg';
      this.userName = 'User';
      this.userEmail = '';
      this.canAccessAdmin = false;
    }
  }

  onMenuToggle(): void {
    this.menuToggle.emit();
  }

  onThemeToggle(): void {
    this.themeService.toggleTheme();
  }

  onLogin(): void {
    this.router.navigate(['/auth/login']);
  }

  onLogout(): void {
    this.authService.logout();
    this.router.navigate(['/']);
  }

  onProfile(): void {
    this.router.navigate(['/auth/profile']);
  }

  onSettings(): void {
    this.router.navigate(['/auth/settings']);
  }

  onAdminPanel(): void {
    this.router.navigate(['/admin']);
  }

  getUserAvatar(): string {
    return this.userAvatar;
  }

  getUserName(): string {
    return this.userName;
  }

  getUserEmail(): string {
    return this.userEmail;
  }

  onImageError(): void {
    this.imageLoadError = true;
    this.userAvatar = '/assets/images/default-avatar.svg';
  }

  onImageLoad(): void {
    this.imageLoadError = false;
  }
}
