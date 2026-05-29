import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Task, TaskFilter, TaskStatus } from '../../core/models/task.model';
import { TaskService } from '../../core/services/task.service';
import { TaskListComponent } from './task-list.component';

const LIST_TASKS: Task[] = [
  {
    id: 'pending',
    title: 'Planejar backlog',
    description: 'Organizar prioridades',
    status: 'pending',
    createdAt: '2026-05-29T08:00:00.000Z',
    updatedAt: '2026-05-29T08:00:00.000Z',
  },
  {
    id: 'progress',
    title: 'Implementar API',
    description: 'Backend de tasks',
    status: 'in_progress',
    createdAt: '2026-05-29T09:00:00.000Z',
    updatedAt: '2026-05-29T09:00:00.000Z',
  },
  {
    id: 'done',
    title: 'Publicar release',
    description: '',
    status: 'done',
    createdAt: '2026-05-29T10:00:00.000Z',
    updatedAt: '2026-05-29T10:00:00.000Z',
  },
];

type TaskListTestApi = {
  setFilter(filter: TaskFilter): void;
  setSearch(term: string): void;
  tasksByStatus(status: TaskStatus): Task[];
  changeStatus(taskId: string, status: TaskStatus): void;
  deleteTask(taskId: string): void;
};

function cardTitles(element: HTMLElement): string[] {
  return [...element.querySelectorAll('article.task-card h2')].map(
    (node) => node.textContent?.trim() ?? '',
  );
}

describe('TaskListComponent', () => {
  const tasks = signal<Task[]>([...LIST_TASKS]);
  const taskService = {
    tasks,
    changeStatus: vi.fn((taskId: string, status: TaskStatus) => {
      tasks.update((currentTasks) =>
        currentTasks.map((task) => (task.id === taskId ? { ...task, status } : task)),
      );
    }),
    deleteTask: vi.fn((taskId: string) => {
      tasks.update((currentTasks) => currentTasks.filter((task) => task.id !== taskId));
    }),
  };

  beforeEach(async () => {
    tasks.set([...LIST_TASKS]);
    taskService.changeStatus.mockClear();
    taskService.deleteTask.mockClear();

    await TestBed.configureTestingModule({
      imports: [TaskListComponent],
      providers: [
        provideRouter([]),
        {
          provide: TaskService,
          useValue: taskService,
        },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders every column and every task by default', () => {
    const fixture = TestBed.createComponent(TaskListComponent);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    expect(
      [...element.querySelectorAll('.column-header p')].map((node) => node.textContent?.trim()),
    ).toEqual(['Pendentes', 'Em andamento', 'Concluidas']);
    expect(cardTitles(element)).toEqual([
      'Planejar backlog',
      'Implementar API',
      'Publicar release',
    ]);
    expect(element.querySelectorAll('.task-description').length).toBe(2);
  });

  it('filters tasks by status and search text', () => {
    const fixture = TestBed.createComponent(TaskListComponent);
    const component = fixture.componentInstance as unknown as TaskListTestApi;

    component.setFilter('in_progress');
    fixture.detectChanges();
    expect(component.tasksByStatus('in_progress').map((task) => task.id)).toEqual(['progress']);
    expect(cardTitles(fixture.nativeElement as HTMLElement)).toEqual(['Implementar API']);

    component.setFilter('all');
    component.setSearch('  BACKEND  ');
    fixture.detectChanges();

    expect(cardTitles(fixture.nativeElement as HTMLElement)).toEqual(['Implementar API']);
  });

  it('shows empty states when filters remove every task', () => {
    const fixture = TestBed.createComponent(TaskListComponent);
    const component = fixture.componentInstance as unknown as TaskListTestApi;

    component.setSearch('sem resultado');
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelectorAll('.empty-state').length).toBe(3);
  });

  it('delegates status changes and deletions to the task service', () => {
    const fixture = TestBed.createComponent(TaskListComponent);
    const component = fixture.componentInstance as unknown as TaskListTestApi;

    component.changeStatus('pending', 'done');
    component.deleteTask('progress');
    fixture.detectChanges();

    expect(taskService.changeStatus).toHaveBeenCalledWith('pending', 'done');
    expect(taskService.deleteTask).toHaveBeenCalledWith('progress');
    expect(cardTitles(fixture.nativeElement as HTMLElement)).toEqual([
      'Planejar backlog',
      'Publicar release',
    ]);
  });
});
