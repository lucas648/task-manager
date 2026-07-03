import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/services/auth.guard';
import { AnalyticsDashboardComponent } from './features/analytics-dashboard/analytics-dashboard.component';
import { ChaosDashboardComponent } from './features/chaos-dashboard/chaos-dashboard.component';
import { HomeComponent } from './features/home/home.component';
import { LoginComponent } from './features/login/login.component';
import { ProfileComponent } from './features/profile/profile.component';
import { TaskCreateComponent } from './features/task-create/task-create.component';
import { TaskListComponent } from './features/task-list/task-list.component';
import { TaskReviewComponent } from './features/task-review/task-review.component';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent,
    canActivate: [guestGuard],
  },
  {
    path: '',
    component: HomeComponent,
    canActivate: [authGuard],
  },
  {
    path: 'tasks',
    component: TaskListComponent,
    canActivate: [authGuard],
  },
  {
    path: 'tasks/new',
    component: TaskCreateComponent,
    canActivate: [authGuard],
  },
  {
    path: 'tasks/:taskId/review',
    component: TaskReviewComponent,
    canActivate: [authGuard],
  },
  {
    path: 'chaos',
    component: ChaosDashboardComponent,
    canActivate: [authGuard],
  },
  {
    path: 'analytics',
    component: AnalyticsDashboardComponent,
    canActivate: [authGuard],
  },
  {
    path: 'profile',
    component: ProfileComponent,
    canActivate: [authGuard],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
