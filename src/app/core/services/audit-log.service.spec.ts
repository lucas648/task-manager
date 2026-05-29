import { AuditLogEvent } from '../models/task.model';
import { AuditLogService } from './audit-log.service';

const TEST_NOW = '2026-05-29T12:00:00.000Z';

describe('AuditLogService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('creates audit logs with crypto ids and metadata', () => {
    vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'audit-id') });
    const service = new AuditLogService();

    expect(
      service.createLog(AuditLogEvent.TaskCreated, 'task-id', { status: 'draft' }, TEST_NOW),
    ).toEqual({
      id: 'audit-id',
      event: AuditLogEvent.TaskCreated,
      taskId: 'task-id',
      timestamp: TEST_NOW,
      metadata: { status: 'draft' },
    });
  });

  it('omits metadata and creates fallback ids when crypto is unavailable', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(TEST_NOW));
    vi.stubGlobal('crypto', undefined);
    vi.spyOn(Math, 'random').mockReturnValue(0.25);
    const service = new AuditLogService();

    expect(service.createLog(AuditLogEvent.TaskUpdated, 'task-id')).toEqual({
      id: `${new Date(TEST_NOW).getTime()}-9`,
      event: AuditLogEvent.TaskUpdated,
      taskId: 'task-id',
      timestamp: TEST_NOW,
    });

    vi.useRealTimers();
  });
});
