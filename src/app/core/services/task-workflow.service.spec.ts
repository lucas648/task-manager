import { TestBed } from '@angular/core/testing';
import {
  AuditLogEvent,
  CmsPayload,
  CmsSendResult,
  Task,
  TaskPriority,
  TaskStatus,
} from '../models/task.model';
import { CmsService } from './cms.service';
import { TaskPayloadBuilderService } from './task-payload-builder.service';
import { TaskService } from './task.service';
import { TaskWorkflowService } from './task-workflow.service';

const STORAGE_KEY = 'task-manager.tasks';
const TEST_NOW = '2026-06-02T12:00:00.000Z';

function setupStorage(tasks: unknown[]) {
  let storedValue = JSON.stringify(tasks);

  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key: string) => (key === STORAGE_KEY ? storedValue : null)),
    setItem: vi.fn((key: string, value: string) => {
      if (key === STORAGE_KEY) {
        storedValue = value;
      }
    }),
  });
}

function setupCrypto(...ids: string[]) {
  const randomUUID = vi.fn();
  ids.forEach((id) => randomUUID.mockReturnValueOnce(id));
  randomUUID.mockReturnValue('fallback-id');
  vi.stubGlobal('crypto', { randomUUID });
}

function setupWorkflow(
  tasks: unknown[],
  providers: Parameters<typeof TestBed.configureTestingModule>[0]['providers'] = [],
) {
  setupStorage(tasks);

  TestBed.configureTestingModule({
    providers: [TaskService, TaskWorkflowService, ...(providers ?? [])],
  });

  return {
    taskService: TestBed.inject(TaskService),
    workflowService: TestBed.inject(TaskWorkflowService),
  };
}

function storedTask(status = TaskStatus.Draft): Partial<Task> {
  return {
    id: 'task-id',
    title: 'Preparar publicacao',
    description: 'Gerar fluxo completo',
    priority: TaskPriority.High,
    status,
    category: 'Produto',
    tags: ['cms'],
    acceptanceCriteria: ['Payload gerado'],
    createdAt: TEST_NOW,
    updatedAt: TEST_NOW,
  };
}

describe('TaskWorkflowService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(TEST_NOW));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('moves a task through the main workflow and records audit logs', () => {
    setupCrypto(
      'ai-start-log',
      'ai-status-log',
      'ai-success-log',
      'approved-status-log',
      'approved-log',
      'payload-log',
      'cms-start-log',
      'published-status-log',
      'cms-success-log',
      'progress-log',
      'completed-log',
    );
    const { taskService, workflowService } = setupWorkflow([storedTask()]);

    expect(workflowService.reviewWithAi('task-id')).toMatchObject({
      success: true,
      message: 'Revisao da IA concluida. A task esta pronta para aprovacao humana.',
    });
    expect(taskService.findTask('task-id')?.status).toBe(TaskStatus.AiReviewed);
    expect(taskService.findTask('task-id')?.auditLogs.map((log) => log.event)).toEqual([
      AuditLogEvent.AiReviewStarted,
      AuditLogEvent.StatusChanged,
      AuditLogEvent.AiReviewSuccess,
    ]);

    expect(workflowService.approveTask('task-id')).toMatchObject({
      success: true,
      message: 'Task aprovada. O payload ja pode ser gerado.',
    });
    expect(taskService.findTask('task-id')?.approvedAt).toBe(TEST_NOW);

    const publishResult = workflowService.publishTask('task-id');
    expect(publishResult).toMatchObject({
      success: true,
      message: 'Payload task-id aceito pelo CMS mockado.',
      payload: {
        externalId: 'task-id',
        source: 'taskflow-ai',
      },
    });
    expect(taskService.findTask('task-id')).toMatchObject({
      cmsError: undefined,
      publishedAt: TEST_NOW,
      status: TaskStatus.Published,
    });

    expect(workflowService.startWork('task-id')).toMatchObject({
      success: true,
      message: 'Task movida para trabalho ativo.',
    });
    expect(workflowService.completeTask('task-id')).toMatchObject({
      success: true,
      message: 'Task concluida.',
    });
    expect(taskService.findTask('task-id')?.status).toBe(TaskStatus.Completed);
    expect(taskService.findTask('task-id')?.auditLogs.at(-1)).toEqual({
      id: 'completed-log',
      event: AuditLogEvent.StatusChanged,
      taskId: 'task-id',
      timestamp: TEST_NOW,
      metadata: {
        fromStatus: TaskStatus.InProgress,
        toStatus: TaskStatus.Completed,
      },
    });
  });

  it('rejects missing tasks and invalid workflow order', () => {
    setupCrypto('unused-log');
    const { workflowService } = setupWorkflow([storedTask()]);

    expect(workflowService.reviewWithAi('missing')).toEqual({
      success: false,
      message: 'Task nao encontrada.',
    });
    expect(workflowService.approveTask('task-id')).toMatchObject({
      success: false,
      message: 'A task precisa estar em ai_reviewed para aprovar.',
    });
    expect(workflowService.publishTask('task-id')).toMatchObject({
      success: false,
      message: 'A task precisa estar em approved para publicar.',
    });
    expect(workflowService.startWork('task-id')).toMatchObject({
      success: false,
      message: 'A task precisa estar em published para avancar no fluxo.',
    });
  });

  it('moves approved tasks to error when the CMS send fails', () => {
    setupCrypto('payload-log', 'cms-start-log', 'error-status-log', 'cms-error-log');
    const failingCmsService = {
      send: vi.fn(
        (payload: CmsPayload): CmsSendResult => ({
          success: false,
          statusCode: 500,
          message: `Falha ao enviar ${payload.externalId}.`,
          sentAt: TEST_NOW,
        }),
      ),
    };
    const { taskService, workflowService } = setupWorkflow(
      [{ ...storedTask(TaskStatus.Approved), approvedAt: TEST_NOW }],
      [{ provide: CmsService, useValue: failingCmsService }],
    );

    expect(workflowService.publishTask('task-id')).toMatchObject({
      success: false,
      message: 'Falha ao enviar task-id.',
      payload: {
        externalId: 'task-id',
      },
    });
    expect(taskService.findTask('task-id')).toMatchObject({
      cmsError: 'Falha ao enviar task-id.',
      status: TaskStatus.Error,
    });
  });

  it('returns payload generation errors without changing the task', () => {
    const throwingPayloadBuilder = {
      build: vi.fn(() => {
        throw new Error('Payload invalido.');
      }),
    };
    const { taskService, workflowService } = setupWorkflow(
      [{ ...storedTask(TaskStatus.Approved), approvedAt: TEST_NOW }],
      [{ provide: TaskPayloadBuilderService, useValue: throwingPayloadBuilder }],
    );

    expect(workflowService.publishTask('task-id')).toMatchObject({
      success: false,
      message: 'Payload invalido.',
    });
    expect(taskService.findTask('task-id')?.status).toBe(TaskStatus.Approved);
  });

  it('normalizes non-error publishing exceptions', () => {
    const throwingPayloadBuilder = {
      build: vi.fn(() => {
        throw 'payload desconhecido';
      }),
    };
    const { workflowService } = setupWorkflow(
      [{ ...storedTask(TaskStatus.Approved), approvedAt: TEST_NOW }],
      [{ provide: TaskPayloadBuilderService, useValue: throwingPayloadBuilder }],
    );

    expect(workflowService.publishTask('task-id')).toMatchObject({
      success: false,
      message: 'Nao foi possivel publicar a task.',
    });
  });
});
