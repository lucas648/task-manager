import { Routes } from '@angular/router';
import { HomeComponent } from './features/home/home.component';
import { TaskCreateComponent } from './features/task-create/task-create.component';
import { TaskListComponent } from './features/task-list/task-list.component';
import { TaskReviewComponent } from './features/task-review/task-review.component';

export const routes: Routes = [
  {
    path: '',
    component: HomeComponent,
  },
  {
    path: 'tasks',
    component: TaskListComponent,
  },
  {
    path: 'tasks/new',
    component: TaskCreateComponent,
  },
  {
    path: 'tasks/:taskId/review',
    component: TaskReviewComponent,
  },
  {
    path: '**',
    redirectTo: '',
  },
];
