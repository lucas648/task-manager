import { TestBed } from '@angular/core/testing';
import { AuditLogEvent, STARTER_TASKS, Task, TaskPriority, TaskStatus } from '../models/task.model';
import { TaskService } from './task.service';

const STORAGE_KEY = 'task-manager.tasks';
const TEST_NOW = '2026-05-29T12:00:00.000Z';

function setupStorage(initialValue: string | null = null) {
  let storedValue = initialValue;

  const storage = {
    getItem: vi.fn((key: string) => (key === STORAGE_KEY ? storedValue : null)),
    setItem: vi.fn((key: string, value: string) => {
      if (key === STORAGE_KEY) {
        storedValue = value;
      }
    }),
    removeItem: vi.fn(),
    clear: vi.fn(),
    key: vi.fn(),
    get length() {
      return storedValue ? 1 : 0;
    },
  };

  vi.stubGlobal('localStorage', storage);

  return storage;
}

function setupCrypto(...ids: string[]) {
  const randomUUID = vi.fn();
  ids.forEach((id) => randomUUID.mockReturnValueOnce(id));
  randomUUID.mockReturnValue('fallback-uuid');
  vi.stubGlobal('crypto', { randomUUID });
  return randomUUID;
}

function setupService(): TaskService {
  TestBed.configureTestingModule({ providers: [TaskService] });
  return TestBed.inject(TaskService);
}

describe('TaskService', () => {
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

  it('loads starter tasks when storage is unavailable and creates draft tasks with fallback ids', () => {
    vi.stubGlobal('localStorage', undefined);
    vi.stubGlobal('crypto', undefined);
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const service = setupService();
    TestBed.tick();
    const task = service.addTask({
      title: '  Nova tarefa  ',
      description: '  Detalhe  ',
      priority: TaskPriority.High,
      category: '  Produto  ',
      tags: [' discovery ', 'ux'],
      assignee: '  Lucas  ',
      dueDate: '2026-06-01',
      acceptanceCriteria: ['criterio um'],
    });

    expect(service.totalTasks()).toBe(STARTER_TASKS.length + 1);
    expect(service.countByStatus(TaskStatus.Draft)).toBe(2);
    expect(task).toEqual({
      id: `${new Date(TEST_NOW).getTime()}-i`,
      title: 'Nova tarefa',
      description: 'Detalhe',
      priority: TaskPriority.High,
      status: TaskStatus.Draft,
      category: 'Produto',
      tags: [' discovery ', 'ux'],
      assignee: 'Lucas',
      dueDate: '2026-06-01',
      acceptanceCriteria: ['criterio um'],
      createdAt: TEST_NOW,
      updatedAt: TEST_NOW,
      aiSuggestions: [],
      auditLogs: [
        {
          id: `${new Date(TEST_NOW).getTime()}-i`,
          event: AuditLogEvent.TaskCreated,
          taskId: `${new Date(TEST_NOW).getTime()}-i`,
          timestamp: TEST_NOW,
          metadata: { status: TaskStatus.Draft },
        },
      ],
    });
  });

  it('uses crypto ids and persists enriched tasks to localStorage', () => {
    const storage = setupStorage(null);
    setupCrypto('task-id', 'log-id');

    const service = setupService();
    const task = service.addTask({
      title: 'Criar roteiro',
      description: 'Preparar pauta da sprint',
      priority: TaskPriority.Medium,
      category: 'Delivery',
      tags: [],
      assignee: '  ',
      dueDate: '',
      acceptanceCriteria: [],
    });
    TestBed.tick();

    expect(task.id).toBe('task-id');
    expect(task.status).toBe(TaskStatus.Draft);
    expect(task.assignee).toBeUndefined();
    expect(task.dueDate).toBeUndefined();
    expect(task.auditLogs[0]).toEqual({
      id: 'log-id',
      event: AuditLogEvent.TaskCreated,
      taskId: 'task-id',
      timestamp: TEST_NOW,
      metadata: { status: TaskStatus.Draft },
    });
    expect(storage.setItem).toHaveBeenLastCalledWith(STORAGE_KEY, JSON.stringify(service.tasks()));
  });

  it('migrates legacy tasks and preserves enriched fields when available', () => {
    const storedTasks = [
      {
        id: 'legacy-pending',
        title: '',
        description: 'Detalhe legado',
        status: 'pending',
        createdAt: '2026-05-29T08:00:00.000Z',
        updatedAt: '2026-05-29T08:00:00.000Z',
        tags: [' bug ', 12, 'auth'],
      },
      {
        id: 'legacy-done',
        title: 'Finalizada',
        description: 'Detalhe finalizado',
        status: 'done',
        priority: 'urgent',
        category: 'Operacao',
        assignee: ' Maria ',
        dueDate: '2026-07-01',
        acceptanceCriteria: [' Aceite ', null],
        approvedAt: '2026-05-29T10:00:00.000Z',
        publishedAt: '2026-05-29T11:00:00.000Z',
        aiSuggestions: [{ id: 'suggestion' }],
        qualityScore: { score: 88, summary: 'Boa', warnings: [], evaluatedAt: TEST_NOW },
        cmsPayload: {
          externalId: 'legacy-done',
          title: 'Finalizada',
          description: 'Detalhe finalizado',
          priority: 'urgent',
          tags: [],
          acceptanceCriteria: ['Aceite'],
          approvedAt: '2026-05-29T10:00:00.000Z',
          source: 'taskflow-ai',
        },
        cmsError: ' Erro anterior ',
        auditLogs: [{ id: 'audit' }],
      },
      null,
      {
        id: 'legacy-invalid-status',
        title: 123,
        description: 456,
        status: 42,
        priority: 42,
        category: 7,
        tags: 'sem-array',
        assignee: 99,
        dueDate: 99,
        acceptanceCriteria: 'sem-array',
      },
      {
        id: 'legacy-unknown-status',
        title: 'Status desconhecido',
        description: 'Deve voltar para draft',
        status: 'unknown',
      },
    ];
    setupStorage(JSON.stringify(storedTasks));

    const service = setupService();

    expect(service.tasks()).toEqual([
      {
        id: 'legacy-pending',
        title: 'Sem titulo',
        description: 'Detalhe legado',
        priority: TaskPriority.Medium,
        status: TaskStatus.Draft,
        category: 'Geral',
        tags: ['bug', 'auth'],
        assignee: undefined,
        dueDate: undefined,
        acceptanceCriteria: [],
        createdAt: '2026-05-29T08:00:00.000Z',
        updatedAt: '2026-05-29T08:00:00.000Z',
        approvedAt: undefined,
        publishedAt: undefined,
        aiSuggestions: [],
        qualityScore: undefined,
        cmsPayload: undefined,
        cmsError: undefined,
        auditLogs: [],
      },
      {
        id: 'legacy-done',
        title: 'Finalizada',
        description: 'Detalhe finalizado',
        priority: TaskPriority.Urgent,
        status: TaskStatus.Completed,
        category: 'Operacao',
        tags: [],
        assignee: 'Maria',
        dueDate: '2026-07-01',
        acceptanceCriteria: ['Aceite'],
        createdAt: TEST_NOW,
        updatedAt: TEST_NOW,
        approvedAt: '2026-05-29T10:00:00.000Z',
        publishedAt: '2026-05-29T11:00:00.000Z',
        aiSuggestions: [{ id: 'suggestion' }],
        qualityScore: { score: 88, summary: 'Boa', warnings: [], evaluatedAt: TEST_NOW },
        cmsPayload: {
          externalId: 'legacy-done',
          title: 'Finalizada',
          description: 'Detalhe finalizado',
          priority: 'urgent',
          tags: [],
          acceptanceCriteria: ['Aceite'],
          approvedAt: '2026-05-29T10:00:00.000Z',
          source: 'taskflow-ai',
        },
        cmsError: 'Erro anterior',
        auditLogs: [{ id: 'audit' }],
      },
      {
        id: 'legacy-invalid-status',
        title: 'Sem titulo',
        description: '',
        priority: TaskPriority.Medium,
        status: TaskStatus.Draft,
        category: 'Geral',
        tags: [],
        assignee: undefined,
        dueDate: undefined,
        acceptanceCriteria: [],
        createdAt: TEST_NOW,
        updatedAt: TEST_NOW,
        approvedAt: undefined,
        publishedAt: undefined,
        aiSuggestions: [],
        qualityScore: undefined,
        cmsPayload: undefined,
        cmsError: undefined,
        auditLogs: [],
      },
      {
        id: 'legacy-unknown-status',
        title: 'Status desconhecido',
        description: 'Deve voltar para draft',
        priority: TaskPriority.Medium,
        status: TaskStatus.Draft,
        category: 'Geral',
        tags: [],
        assignee: undefined,
        dueDate: undefined,
        acceptanceCriteria: [],
        createdAt: TEST_NOW,
        updatedAt: TEST_NOW,
        approvedAt: undefined,
        publishedAt: undefined,
        aiSuggestions: [],
        qualityScore: undefined,
        cmsPayload: undefined,
        cmsError: undefined,
        auditLogs: [],
      },
    ]);
  });

  it('updates tasks and records changed fields in audit logs', () => {
    setupStorage(
      JSON.stringify([
        {
          id: 'one',
          title: 'Primeira',
          description: 'Detalhe um',
          status: TaskStatus.Draft,
        },
        {
          id: 'two',
          title: 'Segunda',
          description: 'Detalhe dois',
          status: TaskStatus.InProgress,
        },
      ]),
    );
    setupCrypto('update-log-id');

    const service = setupService();
    service.updateTask('one', {
      title: ' Atualizada ',
      description: ' Nova descricao ',
      priority: TaskPriority.Low,
      category: ' Produto ',
      tags: ['tag'],
      assignee: ' Ana ',
      dueDate: '2026-08-01',
      acceptanceCriteria: ['aceite'],
    });

    expect(service.tasks()[0]).toEqual({
      ...service.tasks()[0],
      id: 'one',
      title: 'Atualizada',
      description: 'Nova descricao',
      priority: TaskPriority.Low,
      status: TaskStatus.Draft,
      category: 'Produto',
      tags: ['tag'],
      assignee: 'Ana',
      dueDate: '2026-08-01',
      acceptanceCriteria: ['aceite'],
      updatedAt: TEST_NOW,
      auditLogs: [
        {
          id: 'update-log-id',
          event: AuditLogEvent.TaskUpdated,
          taskId: 'one',
          timestamp: TEST_NOW,
          metadata: {
            changedFields: [
              'title',
              'description',
              'priority',
              'category',
              'tags',
              'assignee',
              'dueDate',
              'acceptanceCriteria',
            ],
          },
        },
      ],
    });
    expect(service.tasks()[1].title).toBe('Segunda');

    setupCrypto('empty-update-log-id');
    service.updateTask('one', {});
    expect(service.tasks()[0].auditLogs.at(-1)).toEqual({
      id: 'empty-update-log-id',
      event: AuditLogEvent.TaskUpdated,
      taskId: 'one',
      timestamp: TEST_NOW,
      metadata: {
        changedFields: [],
      },
    });
  });

  it('finds tasks and applies workflow updates with audit logs', () => {
    setupStorage(
      JSON.stringify([
        {
          id: 'one',
          title: 'Primeira',
          description: 'Detalhe um',
          status: TaskStatus.Approved,
          approvedAt: TEST_NOW,
        },
      ]),
    );
    setupCrypto('payload-log-id');

    const service = setupService();
    const payload = {
      externalId: 'one',
      title: 'Primeira',
      description: 'Detalhe um',
      priority: TaskPriority.Medium,
      tags: [],
      acceptanceCriteria: [],
      approvedAt: TEST_NOW,
      source: 'taskflow-ai' as const,
    };

    expect(service.findTask('one')?.title).toBe('Primeira');
    expect(
      service.applyWorkflowUpdate(
        'one',
        {
          cmsPayload: payload,
          status: TaskStatus.Published,
        },
        [{ event: AuditLogEvent.PayloadGenerated }],
      ),
    ).toEqual({
      ...service.tasks()[0],
      cmsPayload: payload,
      status: TaskStatus.Published,
      updatedAt: TEST_NOW,
      auditLogs: [
        {
          id: 'payload-log-id',
          event: AuditLogEvent.PayloadGenerated,
          taskId: 'one',
          timestamp: TEST_NOW,
        },
      ],
    });
    expect(service.applyWorkflowUpdate('missing', {}, [])).toBeUndefined();
  });

  it('changes status, fills approval/publication timestamps, and deletes tasks', () => {
    setupStorage(
      JSON.stringify([
        {
          id: 'one',
          title: 'Primeira',
          description: 'Detalhe um',
          status: TaskStatus.Draft,
        },
        {
          id: 'two',
          title: 'Segunda',
          description: 'Detalhe dois',
          status: TaskStatus.InProgress,
        },
      ]),
    );
    setupCrypto('approved-log', 'published-log', 'progress-log');

    const service = setupService();

    service.changeStatus('one', TaskStatus.Approved);
    expect(service.tasks()[0].approvedAt).toBe(TEST_NOW);
    expect(service.tasks()[0].publishedAt).toBeUndefined();

    service.changeStatus('one', TaskStatus.Published);
    expect(service.tasks()[0].approvedAt).toBe(TEST_NOW);
    expect(service.tasks()[0].publishedAt).toBe(TEST_NOW);

    service.changeStatus('two', TaskStatus.InProgress);
    expect(service.tasks()[1].auditLogs.at(-1)).toEqual({
      id: 'progress-log',
      event: AuditLogEvent.StatusChanged,
      taskId: 'two',
      timestamp: TEST_NOW,
      metadata: {
        fromStatus: TaskStatus.InProgress,
        toStatus: TaskStatus.InProgress,
      },
    });

    service.deleteTask('two');
    expect(service.tasks().map((task) => task.id)).toEqual(['one']);
  });

  it('moves tasks on the kanban board, updates status timestamps, and records movement logs', () => {
    setupStorage(
      JSON.stringify([
        {
          id: 'one',
          title: 'Primeira',
          description: 'Detalhe um',
          status: TaskStatus.Draft,
        },
        {
          id: 'two',
          title: 'Segunda',
          description: 'Detalhe dois',
          status: TaskStatus.Completed,
        },
        {
          id: 'three',
          title: 'Terceira',
          description: 'Detalhe tres',
          status: TaskStatus.InProgress,
        },
        {
          id: 'four',
          title: 'Quarta',
          description: 'Detalhe quatro',
          status: TaskStatus.Draft,
        },
      ]),
    );
    setupCrypto(
      'one-status-log',
      'one-moved-log',
      'two-moved-log',
      'three-status-log',
      'three-moved-log',
      'four-status-log',
      'four-moved-log',
    );

    const service = setupService();

    service.moveTask('one', TaskStatus.Completed, 0);
    expect(service.tasks().map((task) => task.id)).toEqual(['one', 'two', 'three', 'four']);
    expect(service.tasks()[0]).toMatchObject({
      id: 'one',
      status: TaskStatus.Completed,
      updatedAt: TEST_NOW,
      auditLogs: [
        {
          id: 'one-status-log',
          event: AuditLogEvent.StatusChanged,
          taskId: 'one',
          timestamp: TEST_NOW,
          metadata: {
            fromStatus: TaskStatus.Draft,
            toStatus: TaskStatus.Completed,
          },
        },
        {
          id: 'one-moved-log',
          event: AuditLogEvent.TaskMoved,
          taskId: 'one',
          timestamp: TEST_NOW,
          metadata: {
            fromStatus: TaskStatus.Draft,
            toStatus: TaskStatus.Completed,
            fromColumnIndex: 0,
            toColumnIndex: 0,
          },
        },
      ],
    });

    service.moveTask('two', TaskStatus.Completed, 0);
    expect(service.tasks().map((task) => task.id)).toEqual(['two', 'one', 'three', 'four']);
    expect(service.findTask('two')?.auditLogs).toEqual([
      {
        id: 'two-moved-log',
        event: AuditLogEvent.TaskMoved,
        taskId: 'two',
        timestamp: TEST_NOW,
        metadata: {
          fromStatus: TaskStatus.Completed,
          toStatus: TaskStatus.Completed,
          fromColumnIndex: 1,
          toColumnIndex: 0,
        },
      },
    ]);

    service.moveTask('three', TaskStatus.Approved, 10);
    expect(service.findTask('three')).toMatchObject({
      status: TaskStatus.Approved,
      approvedAt: TEST_NOW,
      publishedAt: undefined,
    });
    expect(service.findTask('three')?.auditLogs.map((log) => log.id)).toEqual([
      'three-status-log',
      'three-moved-log',
    ]);

    service.moveTask('four', TaskStatus.Published, 10);
    expect(service.tasks().map((task) => task.id)).toEqual(['two', 'one', 'three', 'four']);
    expect(service.findTask('four')).toMatchObject({
      status: TaskStatus.Published,
      approvedAt: undefined,
      publishedAt: TEST_NOW,
    });
    expect(service.findTask('four')?.auditLogs.at(-1)).toMatchObject({
      event: AuditLogEvent.TaskMoved,
      metadata: {
        fromStatus: TaskStatus.Draft,
        toStatus: TaskStatus.Published,
        fromColumnIndex: 0,
        toColumnIndex: 0,
      },
    });
  });

  it('ignores missing kanban tasks and same-position moves', () => {
    setupStorage(
      JSON.stringify([
        {
          id: 'one',
          title: 'Primeira',
          description: 'Detalhe um',
          status: TaskStatus.Draft,
        },
      ]),
    );

    const service = setupService();

    service.moveTask('missing', TaskStatus.Draft, 0);
    service.moveTask('one', TaskStatus.Draft, 0);

    expect(service.tasks()).toEqual([
      {
        id: 'one',
        title: 'Primeira',
        description: 'Detalhe um',
        priority: TaskPriority.Medium,
        status: TaskStatus.Draft,
        category: 'Geral',
        tags: [],
        assignee: undefined,
        dueDate: undefined,
        acceptanceCriteria: [],
        createdAt: TEST_NOW,
        updatedAt: TEST_NOW,
        approvedAt: undefined,
        publishedAt: undefined,
        aiSuggestions: [],
        qualityScore: undefined,
        cmsPayload: undefined,
        cmsError: undefined,
        auditLogs: [],
      },
    ]);
  });

  it('appends moved tasks after the last task in an occupied kanban column', () => {
    setupStorage(
      JSON.stringify([
        {
          id: 'one',
          title: 'Primeira',
          description: 'Detalhe um',
          status: TaskStatus.Draft,
        },
        {
          id: 'two',
          title: 'Segunda',
          description: 'Detalhe dois',
          status: TaskStatus.Completed,
        },
      ]),
    );
    setupCrypto('status-log', 'move-log');

    const service = setupService();

    service.moveTask('one', TaskStatus.Completed, 99);

    expect(service.tasks().map((task) => task.id)).toEqual(['two', 'one']);
    expect(service.findTask('one')?.auditLogs.at(-1)).toMatchObject({
      id: 'move-log',
      event: AuditLogEvent.TaskMoved,
      metadata: {
        fromStatus: TaskStatus.Draft,
        toStatus: TaskStatus.Completed,
        fromColumnIndex: 0,
        toColumnIndex: 1,
      },
    });
  });

  it('falls back to starter tasks for invalid stored data', () => {
    setupStorage(JSON.stringify({ id: 'not-an-array' }));
    expect(setupService().tasks()).toEqual(STARTER_TASKS);

    TestBed.resetTestingModule();
    setupStorage('{invalid json');
    expect(setupService().tasks()).toEqual(STARTER_TASKS);

    TestBed.resetTestingModule();
    setupStorage(JSON.stringify([{ title: 'sem id' }]));
    expect(setupService().tasks()).toEqual(STARTER_TASKS);

    TestBed.resetTestingModule();
    setupStorage(JSON.stringify([]));
    expect(setupService().tasks()).toEqual(STARTER_TASKS);
  });

  it('creates fallback ids when crypto exists without randomUUID', () => {
    setupStorage(null);
    vi.stubGlobal('crypto', {});
    vi.spyOn(Math, 'random').mockReturnValue(0.75);

    const service = setupService();
    const task = service.addTask({
      title: 'Sem randomUUID',
      description: 'Detalhe',
      priority: TaskPriority.Low,
      category: 'Testes',
      tags: [],
      acceptanceCriteria: [],
    });

    expect(task.id).toBe(`${new Date(TEST_NOW).getTime()}-r`);
  });
});
