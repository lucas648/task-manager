import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuditLog, AuditLogEvent, Task, TaskPriority, TaskStatus } from '../models/task.model';
import { AnalyticsService } from './analytics.service';
import { ChaosService } from './chaos.service';
import { TaskService } from './task.service';

const TEST_DATE = '2026-06-06T10:00:00.000Z';

function createLog(id: string, event: AuditLogEvent, timestamp: string): AuditLog {
  return {
    id,
    event,
    taskId: id.startsWith('chaos') ? 'chaos' : 'task-id',
    timestamp,
  };
}

function createTask(overrides: Partial<Task>): Task {
  return {
    id: 'task-id',
    title: 'Task',
    description: 'Detalhe',
    priority: TaskPriority.Medium,
    status: TaskStatus.Draft,
    category: 'Produto',
    tags: [],
    acceptanceCriteria: [],
    createdAt: TEST_DATE,
    updatedAt: TEST_DATE,
    aiSuggestions: [],
    auditLogs: [],
    ...overrides,
  };
}

describe('AnalyticsService', () => {
  const tasks = signal<Task[]>([]);
  const chaosLogs = signal<AuditLog[]>([]);
  const taskService = {
    tasks,
    totalTasks: computed(() => tasks().length),
  };
  const chaosService = {
    auditLogs: chaosLogs,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-06T14:00:00.000Z'));
    tasks.set([]);
    chaosLogs.set([]);

    TestBed.configureTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: TaskService,
          useValue: taskService,
        },
        {
          provide: ChaosService,
          useValue: chaosService,
        },
      ],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  it('aggregates task, AI, CMS, suggestion, approval, chaos, and recent-event metrics', () => {
    tasks.set([
      createTask({
        id: 'draft-task',
        status: TaskStatus.Draft,
        aiSuggestions: [
          {
            id: 'suggestion-applied',
            field: 'title',
            originalValue: 'Task',
            suggestedValue: 'Task revisada',
            reason: 'Mais clara',
            decision: 'applied',
          },
          {
            id: 'suggestion-rejected',
            field: 'description',
            originalValue: 'Detalhe',
            suggestedValue: 'Detalhe revisado',
            reason: 'Mais contexto',
            decision: 'rejected',
          },
          {
            id: 'suggestion-pending',
            field: 'acceptanceCriteria',
            originalValue: [],
            suggestedValue: ['Aceite'],
            reason: 'Criterio faltante',
            decision: 'pending',
          },
        ],
        auditLogs: [
          createLog('ai-error-log', AuditLogEvent.AiReviewError, '2026-06-06T10:01:00.000Z'),
          createLog('cms-error-log', AuditLogEvent.CmsSendError, '2026-06-06T10:02:00.000Z'),
          createLog('invalid-date-log', AuditLogEvent.TaskCreated, 'invalid-date'),
        ],
      }),
      createTask({
        id: 'approved-task',
        status: TaskStatus.Approved,
        approvedAt: '2026-06-06T11:00:00.000Z',
        aiSuggestions: [
          {
            id: 'second-applied',
            field: 'title',
            originalValue: 'Task',
            suggestedValue: 'Task aprovada',
            reason: 'Mais clara',
            decision: 'applied',
          },
        ],
        auditLogs: [
          createLog('approved-log', AuditLogEvent.TaskApproved, '2026-06-06T11:00:00.000Z'),
        ],
      }),
      createTask({
        id: 'published-task',
        status: TaskStatus.Published,
        createdAt: 'invalid-date',
        approvedAt: '2026-06-06T11:00:00.000Z',
        auditLogs: [
          createLog('ai-success-log', AuditLogEvent.AiReviewSuccess, '2026-06-06T09:00:00.000Z'),
        ],
      }),
      createTask({
        id: 'completed-task',
        status: TaskStatus.Completed,
        approvedAt: 'invalid-date',
        auditLogs: [
          createLog('updated-log', AuditLogEvent.TaskUpdated, '2026-06-06T08:00:00.000Z'),
        ],
      }),
      createTask({
        id: 'error-task',
        status: TaskStatus.Error,
        createdAt: '2026-06-06T13:00:00.000Z',
        approvedAt: '2026-06-06T12:00:00.000Z',
        auditLogs: [
          createLog('status-log', AuditLogEvent.StatusChanged, '2026-06-06T12:00:00.000Z'),
        ],
      }),
    ]);
    chaosLogs.set([
      createLog(
        'chaos-enabled-log',
        AuditLogEvent.ChaosScenarioEnabled,
        '2026-06-06T10:30:00.000Z',
      ),
      createLog(
        'chaos-disabled-log',
        AuditLogEvent.ChaosScenarioDisabled,
        '2026-06-06T10:40:00.000Z',
      ),
      createLog('chaos-other-log', AuditLogEvent.TaskUpdated, '2026-06-06T10:50:00.000Z'),
    ]);

    const summary = TestBed.inject(AnalyticsService).summary();

    expect(summary).toMatchObject({
      totalTasks: 5,
      totalAuditLogs: 10,
      aiFailures: 1,
      cmsFailures: 1,
      chaosEvents: 2,
      acceptedSuggestions: 2,
      rejectedSuggestions: 1,
      suggestionAcceptanceRate: 67,
      averageApprovalMinutes: 60,
    });
    expect(summary.statusMetrics).toEqual([
      { status: TaskStatus.Draft, label: 'Draft', count: 1, percentage: 20 },
      { status: TaskStatus.AiReviewed, label: 'AI Reviewed', count: 0, percentage: 0 },
      { status: TaskStatus.Approved, label: 'Approved', count: 1, percentage: 20 },
      { status: TaskStatus.Published, label: 'Published', count: 1, percentage: 20 },
      { status: TaskStatus.InProgress, label: 'In Progress', count: 0, percentage: 0 },
      { status: TaskStatus.Completed, label: 'Completed', count: 1, percentage: 20 },
      { status: TaskStatus.Rejected, label: 'Rejected', count: 0, percentage: 0 },
      { status: TaskStatus.Error, label: 'Error', count: 1, percentage: 20 },
    ]);
    expect(summary.boardTime.generatedAt).toBe('2026-06-06T14:00:00.000Z');
    expect(summary.boardTime.taskMetrics).toHaveLength(5);
    expect(
      summary.boardTime.taskMetrics.find((metric) => metric.taskId === 'draft-task'),
    ).toMatchObject({
      currentStatus: TaskStatus.Draft,
      currentAgeMinutes: 240,
      currentAgeLabel: '4 h',
      isOverThreshold: false,
    });
    expect(
      summary.boardTime.statusMetrics.find((metric) => metric.status === TaskStatus.Draft),
    ).toMatchObject({
      averageMinutes: 240,
      averageLabel: '4 h',
      longestTaskId: 'draft-task',
      overThresholdCount: 0,
    });
    expect(summary.recentEvents.map((event) => event.id)).toEqual([
      'status-log',
      'approved-log',
      'chaos-other-log',
      'chaos-disabled-log',
      'chaos-enabled-log',
      'cms-error-log',
      'ai-error-log',
      'ai-success-log',
    ]);
  });

  it('returns zeroed metrics when there is no observable data', () => {
    const summary = TestBed.inject(AnalyticsService).summary();

    expect(summary).toMatchObject({
      totalTasks: 0,
      totalAuditLogs: 0,
      aiFailures: 0,
      cmsFailures: 0,
      chaosEvents: 0,
      acceptedSuggestions: 0,
      rejectedSuggestions: 0,
      suggestionAcceptanceRate: 0,
      averageApprovalMinutes: 0,
      recentEvents: [],
    });
    expect(summary.statusMetrics.every((metric) => metric.count === 0)).toBe(true);
    expect(summary.statusMetrics.every((metric) => metric.percentage === 0)).toBe(true);
    expect(summary.boardTime).toMatchObject({
      generatedAt: '2026-06-06T14:00:00.000Z',
      taskMetrics: [],
    });
    expect(summary.boardTime.statusMetrics.every((metric) => metric.averageMinutes === 0)).toBe(
      true,
    );
  });
});
