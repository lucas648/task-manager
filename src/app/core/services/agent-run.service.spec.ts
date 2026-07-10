import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AgentId } from '../models/task.model';
import { AGENT_RUN_STORAGE_KEY, AgentRunRecord } from '../models/agent-run.model';
import { AgentRunService } from './agent-run.service';

const CREATED_AT = '2026-07-03T12:00:00.000Z';
const STARTED_AT = '2026-07-03T12:00:01.000Z';
const COMPLETED_AT = '2026-07-03T12:00:04.000Z';

function createRun(overrides: Partial<AgentRunRecord> = {}): AgentRunRecord {
  return {
    id: 'stored-run',
    agentId: AgentId.InitialTaskAnalysis,
    operation: 'task_review',
    status: 'completed',
    provider: 'mock',
    createdAt: CREATED_AT,
    updatedAt: COMPLETED_AT,
    startedAt: STARTED_AT,
    completedAt: COMPLETED_AT,
    durationMs: 3000,
    inputSummary: 'Task revisada',
    outputSummary: 'Resumo',
    outputCount: 1,
    ...overrides,
  };
}

function setupStorage(initialValue: string | null = null) {
  let storedValue = initialValue;
  const storage = {
    getItem: vi.fn((key: string) => (key === AGENT_RUN_STORAGE_KEY ? storedValue : null)),
    setItem: vi.fn((key: string, value: string) => {
      if (key === AGENT_RUN_STORAGE_KEY) {
        storedValue = value;
      }
    }),
  };

  vi.stubGlobal('localStorage', storage);

  return storage;
}

function setupService(platformId = 'browser'): AgentRunService {
  TestBed.configureTestingModule({
    providers: [
      AgentRunService,
      {
        provide: PLATFORM_ID,
        useValue: platformId,
      },
    ],
  });

  return TestBed.inject(AgentRunService);
}

describe('AgentRunService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(CREATED_AT));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('loads, sorts, persists, and clears valid run history', () => {
    const storage = setupStorage(
      JSON.stringify([
        createRun({ id: 'older-run', updatedAt: '2026-07-03T11:00:00.000Z' }),
        createRun({
          id: 'newer-run',
          operation: 'board_recommendation',
          status: 'running',
          provider: 'gateway',
          updatedAt: '2026-07-03T13:00:00.000Z',
        }),
        createRun({
          id: 'queued-openai-run',
          status: 'queued',
          provider: 'openai',
          updatedAt: 'invalid-date',
        }),
        createRun({
          id: 'failed-run',
          status: 'failed',
          updatedAt: '2026-07-03T10:00:00.000Z',
        }),
      ]),
    );
    const service = setupService();

    expect(service.runs().map((run) => run.id)).toEqual([
      'newer-run',
      'older-run',
      'failed-run',
      'queued-openai-run',
    ]);
    expect(service.recentRuns().map((run) => run.id)).toEqual([
      'newer-run',
      'older-run',
      'failed-run',
      'queued-openai-run',
    ]);
    expect(service.completedRunsCount()).toBe(1);
    expect(service.failedRunsCount()).toBe(1);
    expect(service.averageDurationMs()).toBe(3000);

    service.clearHistory();
    TestBed.tick();

    expect(service.runs()).toEqual([]);
    expect(storage.setItem).toHaveBeenLastCalledWith(AGENT_RUN_STORAGE_KEY, '[]');
  });

  it('queues, starts, completes, and fails runs', () => {
    setupStorage();
    vi.stubGlobal('crypto', {
      randomUUID: vi
        .fn()
        .mockReturnValueOnce('run-id')
        .mockReturnValueOnce('no-start-run-id')
        .mockReturnValueOnce('failed-run-id'),
    });
    const service = setupService();

    const queuedRun = service.queueRun(
      {
        agentId: AgentId.InitialTaskAnalysis,
        operation: 'task_review',
        provider: 'gateway',
        taskId: 'task-id',
        taskTitle: 'Revisar tarefa',
        inputSummary: 'Revisar tarefa',
      },
      CREATED_AT,
    );

    expect(queuedRun).toMatchObject({
      id: 'run-id',
      status: 'queued',
      provider: 'gateway',
      taskId: 'task-id',
    });
    expect(service.activeRuns().map((run) => run.id)).toEqual(['run-id']);

    expect(service.startRun('run-id', STARTED_AT)).toMatchObject({
      status: 'running',
      startedAt: STARTED_AT,
    });
    expect(
      service.completeRun(
        'run-id',
        {
          provider: 'mock',
          outputSummary: '2 sugestoes',
          outputCount: 2,
          fallbackReason: 'Fallback mockado',
        },
        COMPLETED_AT,
      ),
    ).toMatchObject({
      status: 'completed',
      provider: 'mock',
      durationMs: 3000,
      outputSummary: '2 sugestoes',
      outputCount: 2,
      fallbackReason: 'Fallback mockado',
    });

    expect(
      service.queueRun(
        {
          agentId: AgentId.BoardAdvisor,
          operation: 'board_recommendation',
          provider: 'mock',
          inputSummary: 'Sem start',
        },
        CREATED_AT,
      ),
    ).toMatchObject({
      id: 'no-start-run-id',
      status: 'queued',
    });
    expect(
      service.completeRun(
        'no-start-run-id',
        {
          outputSummary: 'Sem start concluido',
          outputCount: 0,
        },
        COMPLETED_AT,
      ),
    ).toMatchObject({
      provider: 'mock',
      durationMs: 4000,
    });

    expect(
      service.queueRun(
        {
          agentId: AgentId.BoardAdvisor,
          operation: 'board_recommendation',
          provider: 'mock',
          inputSummary: 'Board vazio',
        },
        'invalid-date',
      ),
    ).toMatchObject({
      status: 'queued',
    });
    expect(service.startRun('missing')).toBeUndefined();
    expect(
      service.failRun('failed-run-id', 'Falha controlada', '2026-07-03T11:00:00.000Z'),
    ).toMatchObject({
      status: 'failed',
      durationMs: undefined,
      errorMessage: 'Falha controlada',
    });
    expect(service.failedRunsCount()).toBe(1);
    expect(service.activeRuns()).toEqual([]);
  });

  it('falls back to generated ids and ignores invalid stored data', () => {
    setupStorage(
      JSON.stringify([
        { id: 'invalid-run' },
        { ...createRun(), id: 10 },
        { ...createRun(), operation: 'unknown' },
        { ...createRun(), status: 'unknown' },
        { ...createRun(), provider: 'unknown' },
        'not-run',
      ]),
    );
    vi.stubGlobal('crypto', {});
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const service = setupService();

    const queuedRun = service.queueRun({
      agentId: AgentId.BoardAdvisor,
      operation: 'board_recommendation',
      provider: 'mock',
      inputSummary: '3 tasks analisadas',
    });

    expect(service.runs()).toHaveLength(1);
    expect(queuedRun.id).toBe(`${new Date(CREATED_AT).getTime()}-i`);
    expect(service.averageDurationMs()).toBe(0);
  });

  it('returns empty history for invalid JSON, non-array values, and server platform', () => {
    setupStorage('{invalid json');
    const invalidJsonService = setupService();
    expect(invalidJsonService.runs()).toEqual([]);
    expect(invalidJsonService.averageDurationMs()).toBe(0);

    TestBed.resetTestingModule();
    setupStorage(JSON.stringify({ id: 'not-array' }));
    expect(setupService().runs()).toEqual([]);

    TestBed.resetTestingModule();
    const storage = setupStorage(JSON.stringify([createRun()]));
    expect(setupService('server').runs()).toEqual([]);
    TestBed.tick();
    expect(storage.setItem).not.toHaveBeenCalled();
  });
});
