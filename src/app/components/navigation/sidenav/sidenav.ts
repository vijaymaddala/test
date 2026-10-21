import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../services/auth.service';
import { NavigationSettingsService } from '../../../services/navigation-settings.service';

export interface NavigationItem {
  id: string;
  label: string;
  icon: string;
  route?: string;
  action?: () => void;
  children?: NavigationItem[];
}

@Component({
  selector: 'app-sidenav',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatDividerModule,
    MatTooltipModule
  ],
  templateUrl: './sidenav.html',
  styleUrl: './sidenav.scss'
})
export class SidenavComponent implements OnInit, OnDestroy {
  @Input() opened = false;
  @Input() mode: 'over' | 'push' | 'side' = 'over';
  @Output() openedChange = new EventEmitter<boolean>();
  @Output() navigationClick = new EventEmitter<string>();

  allNavigationItems: NavigationItem[] = [];
  visibleNavigationItems: NavigationItem[] = [];
  sidenavBackgroundColor: string = '#1e293b';
  sidenavTextColor: string = '#ffffff';
  sidenavTheme: 'dark' | 'light' | 'custom' = 'light';
  navigationSections: { label: string; items: NavigationItem[] }[] = [];
  private authSubscription?: Subscription;
  private settingsSubscription?: Subscription;

  constructor(
    private router: Router,
    private authService: AuthService,
    private navigationSettingsService: NavigationSettingsService
  ) {}

  ngOnInit() {
    this.setupNavigationItems();
    this.updateVisibleItems();

    // Subscribe to authentication state changes
    this.authSubscription = this.authService.currentUser$.subscribe(user => {
      this.setupNavigationItems();
      this.updateVisibleItems();
    });

    // Subscribe to navigation settings changes
    this.settingsSubscription = this.navigationSettingsService.settings$.subscribe(settings => {
      if (settings) {
        this.updateVisibleItems();
        this.sidenavBackgroundColor = settings.sidenavBackgroundColor || '#1e293b';
        this.sidenavTheme = settings.sidenavTheme || 'light';
        this.sidenavTextColor = this.getContrastColor(this.sidenavBackgroundColor);
      }
    });
  }

  ngOnDestroy() {
    this.authSubscription?.unsubscribe();
    this.settingsSubscription?.unsubscribe();
  }

  getContrastColor(hexColor: string): string {
    // Convert hex to RGB
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    // Calculate brightness using YIQ formula
    const brightness = ((r * 299) + (g * 587) + (b * 114)) / 1000;

    // Return white for dark backgrounds, dark gray for light backgrounds
    return brightness > 128 ? '#1f2937' : '#ffffff';
  }

  setupNavigationItems() {
    // Base navigation items
    this.allNavigationItems = [
      {
        id: 'home',
        label: 'Home',
        icon: 'home',
        route: '/home'
      },
      {
        id: 'analyze',
        label: 'Analyze',
        icon: 'analytics',
        route: '/analyze'
      },
      {
        id: 'dashboard',
        label: 'Dashboard',
        icon: 'dashboard',
        route: '/dashboard'
      },
      {
        id: 'test-automation',
        label: 'AI Test Automation',
        icon: 'smart_toy',
        route: '/test-automation'
      },
      {
        id: 'test-recording',
        label: 'Test Recording',
        icon: 'video_camera_front',
        route: '/test-recording'
      },
      {
        id: 'saved-test-cases',
        label: 'Saved Test Cases',
        icon: 'bookmark',
        route: '/saved-test-cases'
      },
      {
        id: 'saved-recordings',
        label: 'Saved Recordings',
        icon: 'video_library',
        route: '/saved-recordings'
      },
      {
        id: 'test-results',
        label: 'Test Results',
        icon: 'fact_check',
        route: '/test-results'
      },
      {
        id: 'visual-regression',
        label: 'Visual Regression',
        icon: 'compare',
        route: '/visual-regression'
      },
      {
        id: 'reports',
        label: 'Reports',
        icon: 'assessment',
        route: '/reports'
      },
      {
        id: 'api-monitoring',
        label: 'API Monitoring',
        icon: 'monitor_heart',
        route: '/api-monitoring'
      },
      {
        id: 'api-automation',
        label: 'API Automation',
        icon: 'api',
        route: '/api-automation'
      },
      {
        id: 'team-tests',
        label: 'Team Tests',
        icon: 'group_work',
        route: '/team-tests'
      },
      {
        id: 'team-recordings',
        label: 'Team Recordings',
        icon: 'video_library',
        route: '/team-recordings'
      },
      {
        id: 'team-onboarding',
        label: 'Team Onboarding',
        icon: 'groups',
        route: '/teams/organizations'
      },
      {
        id: 'jira-test-generation',
        label: 'Generate Test Cases',
        icon: 'auto_awesome',
        route: '/jira-test-generation'
      },
      {
        id: 'response-validation',
        label: 'Response Validation',
        icon: 'fact_check',
        route: '/response-validation'
      },
      {
        id: 'logs',
        label: 'System Logs',
        icon: 'terminal',
        route: '/logs'
      },
      {
        id: 'history',
        label: 'History',
        icon: 'history',
        route: '/history'
      }
    ];
  }

  updateVisibleItems() {
    this.visibleNavigationItems = this.allNavigationItems.filter(item =>
      this.navigationSettingsService.isItemVisibleSync(item.id)
    );
    const groups = [
      { label: 'Workspace', ids: ['home', 'analyze', 'dashboard'] },
      { label: 'Testing', ids: ['test-automation', 'test-recording', 'saved-test-cases', 'saved-recordings', 'visual-regression', 'api-automation', 'jira-test-generation', 'response-validation'] },
      { label: 'Insights', ids: ['test-results', 'reports', 'api-monitoring', 'logs', 'history'] },
      { label: 'Team', ids: ['team-tests', 'team-recordings', 'team-onboarding'] }
    ];
    this.navigationSections = groups.map(group => ({
      label: group.label,
      items: this.visibleNavigationItems.filter(item => group.ids.includes(item.id))
    })).filter(group => group.items.length > 0);
    const groupedIds = new Set(groups.flatMap(group => group.ids));
    const remaining = this.visibleNavigationItems.filter(item => !groupedIds.has(item.id));
    if (remaining.length) this.navigationSections.push({ label: 'More', items: remaining });
  }

  expandedItems: Set<string> = new Set();

  onToggle(): void {
    this.opened = !this.opened;
    this.openedChange.emit(this.opened);
  }

  onBackdropClick(): void {
    this.opened = false;
    this.openedChange.emit(this.opened);
  }

  onNavigationItemClick(item: NavigationItem): void {
    if (item.children && item.children.length > 0) {
      this.toggleExpanded(item.id);
    } else {
      if (item.route) {
        this.router.navigate([item.route]);
        this.navigationClick.emit(item.route);
      } else if (item.action) {
        item.action();
      }

      // Close sidenav on mobile after navigation
      if (window.innerWidth <= 768) {
        this.opened = false;
        this.openedChange.emit(this.opened);
      }
    }
  }

  toggleExpanded(itemId: string): void {
    if (this.expandedItems.has(itemId)) {
      this.expandedItems.delete(itemId);
    } else {
      this.expandedItems.add(itemId);
    }
  }

  isExpanded(itemId: string): boolean {
    return this.expandedItems.has(itemId);
  }
}
