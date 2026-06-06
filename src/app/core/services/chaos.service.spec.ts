import { TestBed } from '@angular/core/testing';
import { AuditLogEvent, CHAOS_SCENARIOS } from '../models/task.model';
import { ChaosService } from './chaos.service';

const CHAOS_STORAGE_KEY = 'task-manager.chaos-scenarios';
const CHAOS_LOG_STORAGE_KEY = 'task-manager.chaos-logs';
const TEST_NOW = '2026-06-06T12:00:00.000Z';

function setupStorage(values: Record<string, string | null> = {}) {
  const storage = {
    getItem: vi.fn((key: string) => values[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values[key] = value;
    }),
  };

  vi.stubGlobal('localStorage', storage);

  return storage;
}

function setupCrypto(...ids: string[]) {
  const randomUUID = vi.fn();
  ids.forEach((id) => randomUUID.mockReturnValueOnce(id));
  randomUUID.mockReturnValue('fallback-chaos-log');
  vi.stubGlobal('crypto', { randomUUID });
}

function setupService(): ChaosService {
  TestBed.configureTestingModule({ providers: [ChaosService] });
  return TestBed.inject(ChaosService);
}

describe('ChaosService', () => {
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

  it('loads default scenarios when storage is unavailable', () => {
    vi.stubGlobal('localStorage', undefined);
    const service = setupService();
    TestBed.tick();

    expect(service.scenarios()).toEqual(CHAOS_SCENARIOS);
    expect(service.activeScenarios()).toEqual([]);
    expect(service.activeCount()).toBe(0);
    expect(service.auditLogs()).toEqual([]);
  });

  it('loads persisted scenarios and valid audit logs', () => {
    setupStorage({
      [CHAOS_STORAGE_KEY]: JSON.stringify([
        { id: 'ai_slow', enabled: true },
        { id: 'cms_timeout', enabled: true },
        { id: 'unknown', enabled: true },
        { id: 'network_loss', enabled: 'yes' },
      ]),
      [CHAOS_LOG_STORAGE_KEY]: JSON.stringify([
        {
          id: 'log-id',
          event: AuditLogEvent.ChaosScenarioEnabled,
          taskId: 'chaos',
          timestamp: TEST_NOW,
        },
        { id: 'invalid-log' },
      ]),
    });

    const service = setupService();

    expect(service.isEnabled('ai_slow')).toBe(true);
    expect(service.isEnabled('cms_timeout')).toBe(true);
    expect(service.isEnabled('network_loss')).toBe(false);
    expect(service.activeCount()).toBe(2);
    expect(service.auditLogs()).toEqual([
      {
        id: 'log-id',
        event: AuditLogEvent.ChaosScenarioEnabled,
        taskId: 'chaos',
        timestamp: TEST_NOW,
      },
    ]);
  });

  it('toggles scenarios, records logs, and persists state', () => {
    const storage = setupStorage();
    setupCrypto('enable-log', 'disable-log');

    const service = setupService();
    service.setScenario('ai_unavailable', true);
    service.setScenario('ai_unavailable', true);
    TestBed.tick();

    expect(service.isEnabled('ai_unavailable')).toBe(true);
    expect(service.activeCount()).toBe(1);
    expect(service.auditLogs()[0]).toEqual({
      id: 'enable-log',
      event: AuditLogEvent.ChaosScenarioEnabled,
      taskId: 'chaos',
      timestamp: TEST_NOW,
      metadata: {
        scenarioId: 'ai_unavailable',
        scenarioName: 'IA fora do ar',
      },
    });

    service.setScenario('ai_unavailable', false);
    service.setScenario('missing' as never, true);
    TestBed.tick();

    expect(service.isEnabled('ai_unavailable')).toBe(false);
    expect(service.auditLogs()[0]).toEqual({
      id: 'disable-log',
      event: AuditLogEvent.ChaosScenarioDisabled,
      taskId: 'chaos',
      timestamp: TEST_NOW,
      metadata: {
        scenarioId: 'ai_unavailable',
        scenarioName: 'IA fora do ar',
      },
    });
    expect(storage.setItem).toHaveBeenCalledWith(
      CHAOS_STORAGE_KEY,
      JSON.stringify(service.scenarios()),
    );
    expect(storage.setItem).toHaveBeenCalledWith(
      CHAOS_LOG_STORAGE_KEY,
      JSON.stringify(service.auditLogs()),
    );
  });

  it('resets enabled scenarios and logs disabled events', () => {
    setupStorage({
      [CHAOS_STORAGE_KEY]: JSON.stringify([
        { id: 'ai_slow', enabled: true },
        { id: 'cms_timeout', enabled: true },
      ]),
    });
    setupCrypto('reset-ai-log', 'reset-cms-log');

    const service = setupService();
    service.reset();
    service.reset();

    expect(service.activeScenarios()).toEqual([]);
    expect(service.auditLogs()).toEqual([
      {
        id: 'reset-ai-log',
        event: AuditLogEvent.ChaosScenarioDisabled,
        taskId: 'chaos',
        timestamp: TEST_NOW,
        metadata: {
          scenarioId: 'ai_slow',
          scenarioName: 'IA lenta',
        },
      },
      {
        id: 'reset-cms-log',
        event: AuditLogEvent.ChaosScenarioDisabled,
        taskId: 'chaos',
        timestamp: TEST_NOW,
        metadata: {
          scenarioId: 'cms_timeout',
          scenarioName: 'Timeout no envio',
        },
      },
    ]);
  });

  it('falls back when stored chaos data is invalid', () => {
    setupStorage({
      [CHAOS_STORAGE_KEY]: JSON.stringify({ id: 'not-array' }),
      [CHAOS_LOG_STORAGE_KEY]: JSON.stringify({ id: 'not-array' }),
    });
    expect(setupService().scenarios()).toEqual(CHAOS_SCENARIOS);
    expect(TestBed.inject(ChaosService).auditLogs()).toEqual([]);

    TestBed.resetTestingModule();
    setupStorage({
      [CHAOS_STORAGE_KEY]: '{invalid json',
      [CHAOS_LOG_STORAGE_KEY]: '{invalid json',
    });
    const service = setupService();

    expect(service.scenarios()).toEqual(CHAOS_SCENARIOS);
    expect(service.auditLogs()).toEqual([]);
  });
});
