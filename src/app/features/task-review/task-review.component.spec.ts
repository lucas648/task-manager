import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { Task, TaskPriority, TaskStatus } from '../../core/models/task.model';
import { TaskService } from '../../core/services/task.service';
import { TaskWorkflowService } from '../../core/services/task-workflow.service';
import { TaskReviewComponent } from './task-review.component';

const BASE_TASK: Task = {
  id: 'task-id',
  title: 'Publicar conteudo',
  description: 'Gerar e enviar payload final',
  priority: TaskPriority.High,
  status: TaskStatus.Draft,
  category: 'Produto',
  tags: ['cms'],
  assignee: 'Lucas',
  dueDate: '2026-06-10',
  acceptanceCriteria: ['Payload aprovado'],
  createdAt: '2026-06-02T10:00:00.000Z',
  updatedAt: '2026-06-02T10:00:00.000Z',
  aiSuggestions: [],
  auditLogs: [
    {
      id: 'audit-id',
      event: 'TASK_CREATED' as Task['auditLogs'][number]['event'],
      taskId: 'task-id',
      timestamp: '2026-06-02T10:00:00.000Z',
    },
  ],
};

function taskWithStatus(status: TaskStatus): Task {
  return {
    ...BASE_TASK,
    status,
    ...(status === TaskStatus.Approved ||
    status === TaskStatus.Published ||
    status === TaskStatus.InProgress ||
    status === TaskStatus.Completed
      ? { approvedAt: '2026-06-02T11:00:00.000Z' }
      : {}),
    ...(status === TaskStatus.Published ||
    status === TaskStatus.InProgress ||
    status === TaskStatus.Completed
      ? {
          cmsPayload: {
            externalId: 'task-id',
            title: 'Publicar conteudo',
            description: 'Gerar e enviar payload final',
            priority: TaskPriority.High,
            tags: ['cms'],
            acceptanceCriteria: ['Payload aprovado'],
            approvedAt: '2026-06-02T11:00:00.000Z',
            source: 'taskflow-ai',
          },
          publishedAt: '2026-06-02T12:00:00.000Z',
        }
      : {}),
  };
}

describe('TaskReviewComponent', () => {
  const tasks = signal<Task[]>([BASE_TASK]);
  const taskService = {
    findTask: vi.fn((taskId: string) => tasks().find((task) => task.id === taskId)),
  };
  const workflowService = {
    approveTask: vi.fn(() => ({ success: true, message: 'aprovada' })),
    completeTask: vi.fn(() => ({ success: true, message: 'concluida' })),
    publishTask: vi.fn(() => ({ success: true, message: 'publicada' })),
    reviewWithAi: vi.fn(() => ({ success: true, message: 'revisada' })),
    startWork: vi.fn(() => ({ success: true, message: 'iniciada' })),
  };

  beforeEach(async () => {
    tasks.set([BASE_TASK]);
    Object.values(workflowService).forEach((spy) => spy.mockClear());
    taskService.findTask.mockClear();

    await TestBed.configureTestingModule({
      imports: [TaskReviewComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ taskId: 'task-id' }),
            },
          },
        },
        {
          provide: TaskService,
          useValue: taskService,
        },
        {
          provide: TaskWorkflowService,
          useValue: workflowService,
        },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders task details, workflow steps, payload, and audit logs', () => {
    tasks.set([taskWithStatus(TaskStatus.Published)]);
    const fixture = TestBed.createComponent(TaskReviewComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('h1')?.textContent).toContain('Revisao da task');
    expect(element.textContent).toContain('Publicar conteudo');
    expect(element.textContent).toContain('Payload aprovado');
    expect(element.textContent).toContain('TASK_CREATED');
    expect(element.querySelector('pre')?.textContent).toContain('"source": "taskflow-ai"');
    expect(element.querySelector('.workflow-steps .is-current')?.textContent).toContain(
      'Published',
    );
    expect(
      (fixture.componentInstance as unknown as { isCompletedStep: Function }).isCompletedStep(
        TaskStatus.Draft,
        TaskStatus.Error,
      ),
    ).toBe(false);
  });

  it('renders a fallback when the task is missing', () => {
    tasks.set([]);
    const fixture = TestBed.createComponent(TaskReviewComponent);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Task nao encontrada');
    expect((fixture.nativeElement as HTMLElement).querySelector('a')?.getAttribute('href')).toBe(
      '/tasks',
    );
  });

  it('runs the expected action for each workflow status', () => {
    const fixture = TestBed.createComponent(TaskReviewComponent);
    const cases = [
      [TaskStatus.Draft, 'Revisar com IA', workflowService.reviewWithAi, 'revisada'],
      [TaskStatus.AiReviewed, 'Aprovar tarefa', workflowService.approveTask, 'aprovada'],
      [TaskStatus.Approved, 'Gerar payload e publicar', workflowService.publishTask, 'publicada'],
      [TaskStatus.Published, 'Iniciar trabalho', workflowService.startWork, 'iniciada'],
      [TaskStatus.InProgress, 'Concluir task', workflowService.completeTask, 'concluida'],
      [TaskStatus.Error, 'Tentar publicar novamente', workflowService.publishTask, 'publicada'],
    ] as const;

    for (const [status, label, spy, message] of cases) {
      tasks.set([taskWithStatus(status)]);
      fixture.detectChanges();
      const button = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].find(
        (candidate) => candidate.textContent?.includes(label),
      );

      expect(button?.textContent).toContain(label);
      button?.click();
      fixture.detectChanges();

      expect(spy).toHaveBeenCalledWith('task-id');
      expect((fixture.nativeElement as HTMLElement).textContent).toContain(message);
      spy.mockClear();
    }
  });

  it('shows completed tasks without action buttons', () => {
    tasks.set([taskWithStatus(TaskStatus.Completed)]);
    const fixture = TestBed.createComponent(TaskReviewComponent);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Task concluida.');
    expect((fixture.nativeElement as HTMLElement).querySelector('button')).toBeNull();
  });

  it('handles review routes without a task id', async () => {
    TestBed.resetTestingModule();
    tasks.set([BASE_TASK]);

    await TestBed.configureTestingModule({
      imports: [TaskReviewComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({}),
            },
          },
        },
        {
          provide: TaskService,
          useValue: taskService,
        },
        {
          provide: TaskWorkflowService,
          useValue: workflowService,
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(TaskReviewComponent);
    fixture.detectChanges();

    expect(taskService.findTask).toHaveBeenCalledWith('');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Task nao encontrada');
  });
});
