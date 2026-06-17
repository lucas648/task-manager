import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Task, TaskFilter, TaskPriority, TaskStatus } from '../../core/models/task.model';
import { TaskService } from '../../core/services/task.service';
import { TaskListComponent } from './task-list.component';

const LIST_TASKS: Task[] = [
  {
    id: 'draft',
    title: 'Planejar backlog',
    description: 'Organizar prioridades',
    priority: TaskPriority.Medium,
    status: TaskStatus.Draft,
    category: 'Produto',
    tags: ['backlog'],
    assignee: 'Lucas',
    acceptanceCriteria: ['Prioridades revisadas'],
    createdAt: '2026-05-29T08:00:00.000Z',
    updatedAt: '2026-05-29T08:00:00.000Z',
    aiSuggestions: [],
    auditLogs: [{ id: 'audit-draft' } as Task['auditLogs'][number]],
  },
  {
    id: 'progress',
    title: 'Implementar API',
    description: 'Backend de tasks',
    priority: TaskPriority.High,
    status: TaskStatus.InProgress,
    category: 'Engenharia',
    tags: ['backend'],
    dueDate: '2026-06-01',
    acceptanceCriteria: [],
    createdAt: '2026-05-29T09:00:00.000Z',
    updatedAt: '2026-05-29T09:00:00.000Z',
    aiSuggestions: [],
    auditLogs: [],
  },
  {
    id: 'completed',
    title: 'Publicar release',
    description: '',
    priority: TaskPriority.Low,
    status: TaskStatus.Completed,
    category: 'Release',
    tags: [],
    acceptanceCriteria: [],
    createdAt: '2026-05-29T10:00:00.000Z',
    updatedAt: '2026-05-29T10:00:00.000Z',
    aiSuggestions: [],
    auditLogs: [],
  },
];

type TaskListTestApi = {
  setFilter(filter: TaskFilter): void;
  setSearch(term: string): void;
  clearFilters(): void;
  tasksByStatus(status: TaskStatus): Task[];
  dropTask(event: { item: { data: Task }; currentIndex: number }, status: TaskStatus): void;
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
    moveTask: vi.fn((taskId: string, status: TaskStatus, targetIndex: number) => {
      const taskToMove = tasks().find((task) => task.id === taskId);

      if (!taskToMove) {
        return;
      }

      const remainingTasks = tasks().filter((task) => task.id !== taskId);
      const targetTasks = remainingTasks.filter((task) => task.status === status);
      const targetTask = targetTasks[targetIndex];
      const insertionIndex = targetTask
        ? remainingTasks.findIndex((task) => task.id === targetTask.id)
        : remainingTasks.length;

      remainingTasks.splice(insertionIndex, 0, { ...taskToMove, status });
      tasks.set(remainingTasks);
    }),
    deleteTask: vi.fn((taskId: string) => {
      tasks.update((currentTasks) => currentTasks.filter((task) => task.id !== taskId));
    }),
  };

  beforeEach(async () => {
    tasks.set([...LIST_TASKS]);
    taskService.changeStatus.mockClear();
    taskService.moveTask.mockClear();
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

  it('renders primary workflow columns and task metadata by default', () => {
    const fixture = TestBed.createComponent(TaskListComponent);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    expect(
      [...element.querySelectorAll('.column-header p')].map((node) => node.textContent?.trim()),
    ).toEqual(['Draft', 'AI Reviewed', 'Approved', 'Published', 'In Progress', 'Completed']);
    expect(cardTitles(element)).toEqual([
      'Planejar backlog',
      'Implementar API',
      'Publicar release',
    ]);
    expect(element.textContent).toContain('Produto');
    expect(element.textContent).toContain('Media');
    expect(element.textContent).toContain('Draft');
    expect(element.textContent).toContain('Prioridades revisadas');
    expect(element.textContent).toContain('1 logs de auditoria');
    expect(element.querySelector('article.task-card a')?.getAttribute('href')).toBe(
      '/tasks/draft/review',
    );
    expect(
      [...element.querySelectorAll('.screen-header a')].map((link) => ({
        href: link.getAttribute('href'),
        text: link.textContent?.trim(),
      })),
    ).toEqual([
      { href: '/analytics', text: 'Ver analytics' },
      { href: '/tasks/new', text: 'Inserir nova task' },
    ]);
    expect(element.querySelectorAll('.cdk-drop-list').length).toBe(6);
    expect(element.querySelectorAll('.cdk-drag').length).toBe(3);
    expect(element.querySelector('.drag-handle')?.getAttribute('title')).toBe('Mover');
  });

  it('filters tasks by status and search text across enriched fields', () => {
    const fixture = TestBed.createComponent(TaskListComponent);
    const component = fixture.componentInstance as unknown as TaskListTestApi;

    component.setFilter(TaskStatus.InProgress);
    fixture.detectChanges();
    expect(component.tasksByStatus(TaskStatus.InProgress).map((task) => task.id)).toEqual([
      'progress',
    ]);
    expect(cardTitles(fixture.nativeElement as HTMLElement)).toEqual(['Implementar API']);

    component.setFilter('all');
    component.setSearch('  BACKEND  ');
    fixture.detectChanges();
    expect(cardTitles(fixture.nativeElement as HTMLElement)).toEqual(['Implementar API']);

    component.setSearch('lucas');
    fixture.detectChanges();
    expect(cardTitles(fixture.nativeElement as HTMLElement)).toEqual(['Planejar backlog']);
  });

  it('shows a single empty state and clears filters when filters remove every task', () => {
    const fixture = TestBed.createComponent(TaskListComponent);
    const component = fixture.componentInstance as unknown as TaskListTestApi;

    component.setSearch('sem resultado');
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelectorAll('.empty-state').length).toBe(0);
    expect(element.querySelector('.board-empty-state')?.textContent).toContain(
      'Nenhuma task encontrada',
    );
    expect(element.querySelector('.board-empty-state')?.textContent).toContain('Limpar filtros');

    component.clearFilters();
    fixture.detectChanges();

    expect(cardTitles(element)).toEqual([
      'Planejar backlog',
      'Implementar API',
      'Publicar release',
    ]);
  });

  it('shows a creation path when the board has no tasks', () => {
    tasks.set([]);
    const fixture = TestBed.createComponent(TaskListComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.board-empty-state')?.textContent).toContain(
      'Crie uma task para iniciar o fluxo',
    );
    expect(element.querySelector('.board-empty-state a')?.getAttribute('href')).toBe('/tasks/new');
  });

  it('delegates status changes and deletions to the task service', () => {
    const fixture = TestBed.createComponent(TaskListComponent);
    const component = fixture.componentInstance as unknown as TaskListTestApi;

    component.changeStatus('draft', TaskStatus.Completed);
    component.deleteTask('progress');
    fixture.detectChanges();

    expect(taskService.changeStatus).toHaveBeenCalledWith('draft', TaskStatus.Completed);
    expect(taskService.deleteTask).toHaveBeenCalledWith('progress');
    expect(cardTitles(fixture.nativeElement as HTMLElement)).toEqual([
      'Planejar backlog',
      'Publicar release',
    ]);
  });

  it('delegates kanban drops to the task service', () => {
    const fixture = TestBed.createComponent(TaskListComponent);
    const component = fixture.componentInstance as unknown as TaskListTestApi;

    component.dropTask(
      {
        item: {
          data: LIST_TASKS[0],
        },
        currentIndex: 0,
      },
      TaskStatus.Approved,
    );
    fixture.detectChanges();

    expect(taskService.moveTask).toHaveBeenCalledWith('draft', TaskStatus.Approved, 0);
    expect(cardTitles(fixture.nativeElement as HTMLElement)).toEqual([
      'Planejar backlog',
      'Implementar API',
      'Publicar release',
    ]);
    expect(component.tasksByStatus(TaskStatus.Approved).map((task) => task.id)).toEqual(['draft']);
  });
});
