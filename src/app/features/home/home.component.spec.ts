import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Task, TaskPriority, TaskStatus } from '../../core/models/task.model';
import { TaskService } from '../../core/services/task.service';
import { HomeComponent } from './home.component';

const HOME_TASKS: Task[] = [
  {
    id: 'draft',
    title: 'Draft',
    description: 'Aguardando inicio',
    priority: TaskPriority.Medium,
    status: TaskStatus.Draft,
    category: 'Produto',
    tags: [],
    acceptanceCriteria: [],
    createdAt: '2026-05-29T08:00:00.000Z',
    updatedAt: '2026-05-29T08:00:00.000Z',
    aiSuggestions: [],
    auditLogs: [],
  },
  {
    id: 'progress',
    title: 'Em andamento',
    description: 'Trabalho ativo',
    priority: TaskPriority.High,
    status: TaskStatus.InProgress,
    category: 'Delivery',
    tags: [],
    acceptanceCriteria: [],
    createdAt: '2026-05-29T09:00:00.000Z',
    updatedAt: '2026-05-29T09:00:00.000Z',
    aiSuggestions: [],
    auditLogs: [],
  },
  {
    id: 'completed',
    title: 'Concluida',
    description: 'Entrega registrada',
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

function textContent(fixtureElement: HTMLElement): string {
  return fixtureElement.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

describe('HomeComponent', () => {
  const tasks = signal<Task[]>([...HOME_TASKS]);
  const taskService = {
    tasks,
    totalTasks: computed(() => tasks().length),
    countByStatus: vi.fn(
      (status: Task['status']) => tasks().filter((task) => task.status === status).length,
    ),
  };

  beforeEach(async () => {
    tasks.set([...HOME_TASKS]);
    taskService.countByStatus.mockClear();

    await TestBed.configureTestingModule({
      imports: [HomeComponent],
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

  it('renders the home title, navigation actions, and primary workflow counts', () => {
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const summaryValues = [...element.querySelectorAll('.summary-strip dd')].map((node) =>
      node.textContent?.trim(),
    );
    const links = [...element.querySelectorAll('.home-actions a')].map((link) => ({
      href: link.getAttribute('href'),
      text: link.textContent?.trim(),
    }));

    expect(textContent(element)).toContain('TaskFlow AI');
    expect(summaryValues).toEqual(['3', '1', '0', '0', '0', '1', '1']);
    expect(links).toEqual([
      { href: '/tasks', text: 'Ver lista completa' },
      { href: '/tasks/new', text: 'Inserir nova task' },
    ]);
  });

  it('updates summary numbers when the shared task signal changes', () => {
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();

    tasks.set([
      ...HOME_TASKS,
      {
        id: 'new',
        title: 'Nova',
        description: 'Mais uma draft',
        priority: TaskPriority.Medium,
        status: TaskStatus.Draft,
        category: 'Produto',
        tags: [],
        acceptanceCriteria: [],
        createdAt: '2026-05-29T11:00:00.000Z',
        updatedAt: '2026-05-29T11:00:00.000Z',
        aiSuggestions: [],
        auditLogs: [],
      },
    ]);
    fixture.detectChanges();

    const summaryValues = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll('.summary-strip dd'),
    ].map((node) => node.textContent?.trim());

    expect(summaryValues).toEqual(['4', '2', '0', '0', '0', '1', '1']);
  });
});
