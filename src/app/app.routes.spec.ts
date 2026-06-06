import { routes } from './app.routes';
import { ChaosDashboardComponent } from './features/chaos-dashboard/chaos-dashboard.component';
import { HomeComponent } from './features/home/home.component';
import { TaskCreateComponent } from './features/task-create/task-create.component';
import { TaskListComponent } from './features/task-list/task-list.component';
import { TaskReviewComponent } from './features/task-review/task-review.component';

describe('app routes', () => {
  it('routes home, task list, task creation, and unknown paths', () => {
    expect(routes).toEqual([
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
        path: 'chaos',
        component: ChaosDashboardComponent,
      },
      {
        path: '**',
        redirectTo: '',
      },
    ]);
  });
});
