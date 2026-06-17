import { AuditLog, AuditLogEvent, Task, TaskPriority, TaskStatus } from '../models/task.model';
import { BoardAnalyticsService } from './board-analytics.service';

const REFERENCE_DATE = new Date('2026-06-02T14:00:00.000Z');

function createTask(overrides: Partial<Task>): Task {
  return {
    id: 'task-id',
    title: 'Task em analise',
    description: 'Detalhes da task',
    priority: TaskPriority.Medium,
    status: TaskStatus.Draft,
    category: 'Produto',
    tags: [],
    acceptanceCriteria: [],
    createdAt: '2026-06-02T08:00:00.000Z',
    updatedAt: '2026-06-02T08:00:00.000Z',
    aiSuggestions: [],
    auditLogs: [],
    ...overrides,
  };
}

function createLog(
  id: string,
  event: AuditLogEvent,
  timestamp: string,
  metadata?: Record<string, unknown>,
): AuditLog {
  return {
    id,
    event,
    taskId: 'task-id',
    timestamp,
    ...(metadata ? { metadata } : {}),
  };
}

describe('BoardAnalyticsService', () => {
  const service = new BoardAnalyticsService();

  it('calculates current board time from createdAt when there are no status logs', () => {
    const summary = service.summarize(
      [
        createTask({
          id: 'stale-draft',
          title: 'Draft parado',
          createdAt: '2026-06-01T10:00:00.000Z',
          updatedAt: '2026-06-01T10:00:00.000Z',
        }),
      ],
      REFERENCE_DATE,
    );

    expect(summary.generatedAt).toBe('2026-06-02T14:00:00.000Z');
    expect(summary.taskMetrics[0]).toMatchObject({
      taskId: 'stale-draft',
      taskTitle: 'Draft parado',
      currentStatus: TaskStatus.Draft,
      statusStartedAt: '2026-06-01T10:00:00.000Z',
      currentAgeMinutes: 1680,
      currentAgeLabel: '1 d',
      thresholdMinutes: 1440,
      isOverThreshold: true,
    });
    expect(summary.taskMetrics[0].durations).toEqual([
      {
        status: TaskStatus.Draft,
        label: 'Draft',
        startedAt: '2026-06-01T10:00:00.000Z',
        durationMinutes: 1680,
        durationLabel: '1 d',
        isCurrent: true,
      },
    ]);
    expect(
      summary.statusMetrics.find((metric) => metric.status === TaskStatus.Draft),
    ).toMatchObject({
      averageMinutes: 1680,
      averageLabel: '1 d',
      longestMinutes: 1680,
      longestLabel: '1 d',
      longestTaskId: 'stale-draft',
      longestTaskTitle: 'Draft parado',
      thresholdMinutes: 1440,
      overThresholdCount: 1,
    });
    expect(
      summary.statusMetrics.find((metric) => metric.status === TaskStatus.Completed),
    ).toMatchObject({
      averageMinutes: 0,
      averageLabel: '0 min',
      longestMinutes: 0,
      longestLabel: '0 min',
      overThresholdCount: 0,
    });
  });

  it('rebuilds task timelines from status changes and kanban moves', () => {
    const summary = service.summarize(
      [
        createTask({
          status: TaskStatus.InProgress,
          auditLogs: [
            createLog('created', AuditLogEvent.TaskCreated, '2026-06-02T08:00:00.000Z', {
              status: TaskStatus.Draft,
            }),
            createLog('before-created', AuditLogEvent.StatusChanged, '2026-06-02T07:00:00.000Z', {
              fromStatus: TaskStatus.Draft,
              toStatus: TaskStatus.Error,
            }),
            createLog('invalid-date', AuditLogEvent.StatusChanged, 'invalid-date', {
              fromStatus: TaskStatus.Draft,
              toStatus: TaskStatus.Approved,
            }),
            createLog('missing-status', AuditLogEvent.TaskMoved, '2026-06-02T10:00:00.000Z'),
            createLog('unknown-status', AuditLogEvent.TaskMoved, '2026-06-02T10:15:00.000Z', {
              toStatus: 'waiting',
            }),
            createLog('ai-reviewed', AuditLogEvent.StatusChanged, '2026-06-02T09:00:00.000Z', {
              fromStatus: TaskStatus.Draft,
              toStatus: TaskStatus.AiReviewed,
            }),
            createLog('approved', AuditLogEvent.TaskMoved, '2026-06-02T11:00:00.000Z', {
              fromStatus: TaskStatus.AiReviewed,
              toStatus: TaskStatus.Approved,
            }),
            createLog('same-status', AuditLogEvent.TaskMoved, '2026-06-02T11:30:00.000Z', {
              fromStatus: TaskStatus.Approved,
              toStatus: TaskStatus.Approved,
            }),
            createLog('progress', AuditLogEvent.StatusChanged, '2026-06-02T12:00:00.000Z', {
              fromStatus: TaskStatus.Approved,
              toStatus: TaskStatus.InProgress,
            }),
          ],
        }),
      ],
      REFERENCE_DATE,
    );

    expect(
      summary.taskMetrics[0].durations.map((duration) => ({
        status: duration.status,
        durationMinutes: duration.durationMinutes,
        isCurrent: duration.isCurrent,
      })),
    ).toEqual([
      { status: TaskStatus.Draft, durationMinutes: 60, isCurrent: false },
      { status: TaskStatus.AiReviewed, durationMinutes: 120, isCurrent: false },
      { status: TaskStatus.Approved, durationMinutes: 60, isCurrent: false },
      { status: TaskStatus.InProgress, durationMinutes: 120, isCurrent: true },
    ]);
    expect(summary.taskMetrics[0]).toMatchObject({
      currentStatus: TaskStatus.InProgress,
      currentAgeMinutes: 120,
      currentAgeLabel: '2 h',
      thresholdMinutes: 4320,
      isOverThreshold: false,
    });
  });

  it('uses updatedAt as a fallback when the latest status log is missing', () => {
    const summary = service.summarize(
      [
        createTask({
          status: TaskStatus.Completed,
          updatedAt: '2026-06-02T13:00:00.000Z',
          auditLogs: [
            createLog('progress', AuditLogEvent.StatusChanged, '2026-06-02T09:00:00.000Z', {
              fromStatus: TaskStatus.Draft,
              toStatus: TaskStatus.InProgress,
            }),
          ],
        }),
      ],
      REFERENCE_DATE,
    );

    expect(
      summary.taskMetrics[0].durations.map((duration) => ({
        status: duration.status,
        startedAt: duration.startedAt,
        endedAt: duration.endedAt,
        durationMinutes: duration.durationMinutes,
        isCurrent: duration.isCurrent,
      })),
    ).toEqual([
      {
        status: TaskStatus.Draft,
        startedAt: '2026-06-02T08:00:00.000Z',
        endedAt: '2026-06-02T09:00:00.000Z',
        durationMinutes: 60,
        isCurrent: false,
      },
      {
        status: TaskStatus.InProgress,
        startedAt: '2026-06-02T09:00:00.000Z',
        endedAt: '2026-06-02T13:00:00.000Z',
        durationMinutes: 240,
        isCurrent: false,
      },
      {
        status: TaskStatus.Completed,
        startedAt: '2026-06-02T13:00:00.000Z',
        endedAt: undefined,
        durationMinutes: 60,
        isCurrent: true,
      },
    ]);
  });

  it('keeps the last known transition time when updatedAt is invalid', () => {
    const summary = service.summarize(
      [
        createTask({
          status: TaskStatus.Approved,
          updatedAt: 'invalid-updated-at',
          auditLogs: [
            createLog('progress', AuditLogEvent.StatusChanged, '2026-06-02T09:00:00.000Z', {
              fromStatus: TaskStatus.Draft,
              toStatus: TaskStatus.InProgress,
            }),
          ],
        }),
      ],
      REFERENCE_DATE,
    );

    expect(
      summary.taskMetrics[0].durations.map((duration) => ({
        status: duration.status,
        startedAt: duration.startedAt,
        endedAt: duration.endedAt,
        durationMinutes: duration.durationMinutes,
        isCurrent: duration.isCurrent,
      })),
    ).toEqual([
      {
        status: TaskStatus.Draft,
        startedAt: '2026-06-02T08:00:00.000Z',
        endedAt: '2026-06-02T09:00:00.000Z',
        durationMinutes: 60,
        isCurrent: false,
      },
      {
        status: TaskStatus.InProgress,
        startedAt: '2026-06-02T09:00:00.000Z',
        endedAt: '2026-06-02T09:00:00.000Z',
        durationMinutes: 0,
        isCurrent: false,
      },
      {
        status: TaskStatus.Approved,
        startedAt: '2026-06-02T09:00:00.000Z',
        endedAt: undefined,
        durationMinutes: 300,
        isCurrent: true,
      },
    ]);
  });

  it('falls back safely when createdAt and updatedAt cannot anchor the timeline', () => {
    const summary = service.summarize(
      [
        createTask({
          status: TaskStatus.Approved,
          createdAt: 'invalid-created-at',
          updatedAt: 'invalid-updated-at',
          auditLogs: [
            createLog('progress', AuditLogEvent.StatusChanged, '2026-06-02T09:00:00.000Z', {
              toStatus: TaskStatus.InProgress,
            }),
          ],
        }),
      ],
      REFERENCE_DATE,
    );

    expect(
      summary.taskMetrics[0].durations.map((duration) => ({
        status: duration.status,
        durationMinutes: duration.durationMinutes,
        isCurrent: duration.isCurrent,
      })),
    ).toEqual([{ status: TaskStatus.Approved, durationMinutes: 0, isCurrent: true }]);
  });

  it('formats durations as minutes, hours, and days', () => {
    expect(service.formatDuration(-4)).toBe('0 min');
    expect(service.formatDuration(35)).toBe('35 min');
    expect(service.formatDuration(90)).toBe('2 h');
    expect(service.formatDuration(2880)).toBe('2 d');
  });
});
