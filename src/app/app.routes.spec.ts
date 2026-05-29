import { routes } from './app.routes';
import { HomeComponent } from './features/home/home.component';
import { TaskCreateComponent } from './features/task-create/task-create.component';
import { TaskListComponent } from './features/task-list/task-list.component';

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
        path: '**',
        redirectTo: '',
      },
    ]);
  });
});
