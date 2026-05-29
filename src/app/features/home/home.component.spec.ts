import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Task } from '../../core/models/task.model';
import { TaskService } from '../../core/services/task.service';
import { HomeComponent } from './home.component';

const HOME_TASKS: Task[] = [
  {
    id: 'pending',
    title: 'Pendente',
    description: 'Aguardando inicio',
    status: 'pending',
    createdAt: '2026-05-29T08:00:00.000Z',
    updatedAt: '2026-05-29T08:00:00.000Z',
  },
  {
    id: 'progress',
    title: 'Em andamento',
    description: 'Trabalho ativo',
    status: 'in_progress',
    createdAt: '2026-05-29T09:00:00.000Z',
    updatedAt: '2026-05-29T09:00:00.000Z',
  },
  {
    id: 'done',
    title: 'Concluida',
    description: 'Entrega registrada',
    status: 'done',
    createdAt: '2026-05-29T10:00:00.000Z',
    updatedAt: '2026-05-29T10:00:00.000Z',
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

  it('renders the home title, navigation actions, and summary counts', () => {
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

    expect(textContent(element)).toContain('Task Manager');
    expect(summaryValues).toEqual(['3', '1', '1', '1']);
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
        description: 'Mais uma pendente',
        status: 'pending',
        createdAt: '2026-05-29T11:00:00.000Z',
        updatedAt: '2026-05-29T11:00:00.000Z',
      },
    ]);
    fixture.detectChanges();

    const summaryValues = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll('.summary-strip dd'),
    ].map((node) => node.textContent?.trim());

    expect(summaryValues).toEqual(['4', '2', '1', '1']);
  });
});
