import {
  AuditLogEvent,
  BOARD_STATUS_THRESHOLDS_MINUTES,
  CHAOS_SCENARIOS,
  FILTER_OPTIONS,
  PRIORITY_LABELS,
  PRIORITY_OPTIONS,
  STARTER_TASKS,
  STATUS_LABELS,
  STATUS_OPTIONS,
  TASK_COLUMNS,
  TaskPriority,
  TaskStatus,
  WORKFLOW_TRANSITIONS,
  WORKFLOW_STATUS_OPTIONS,
} from './task.model';

describe('task model constants', () => {
  it('defines workflow statuses and labels in the expected order', () => {
    expect(Object.values(TaskStatus)).toEqual([
      'draft',
      'ai_reviewed',
      'approved',
      'published',
      'in_progress',
      'completed',
      'rejected',
      'error',
    ]);
    expect(STATUS_LABELS[TaskStatus.AiReviewed]).toBe('AI Reviewed');
    expect(STATUS_OPTIONS.map((option) => option.value)).toEqual(Object.values(TaskStatus));
  });

  it('defines priority options and labels', () => {
    expect(Object.values(TaskPriority)).toEqual(['low', 'medium', 'high', 'urgent']);
    expect(PRIORITY_LABELS[TaskPriority.Urgent]).toBe('Urgente');
    expect(PRIORITY_OPTIONS.map((option) => option.value)).toEqual(Object.values(TaskPriority));
  });

  it('defines workflow audit events and transitions', () => {
    expect(Object.values(AuditLogEvent)).toEqual([
      'TASK_CREATED',
      'TASK_UPDATED',
      'STATUS_CHANGED',
      'TASK_MOVED',
      'AI_REVIEW_STARTED',
      'AI_REVIEW_SUCCESS',
      'AI_REVIEW_ERROR',
      'AI_SUGGESTION_APPLIED',
      'AI_SUGGESTION_REJECTED',
      'TASK_APPROVED',
      'PAYLOAD_GENERATED',
      'CMS_SEND_STARTED',
      'CMS_SEND_SUCCESS',
      'CMS_SEND_ERROR',
      'CHAOS_SCENARIO_ENABLED',
      'CHAOS_SCENARIO_DISABLED',
    ]);
    expect(WORKFLOW_TRANSITIONS).toEqual({
      [TaskStatus.Draft]: TaskStatus.AiReviewed,
      [TaskStatus.AiReviewed]: TaskStatus.Approved,
      [TaskStatus.Approved]: TaskStatus.Published,
      [TaskStatus.Published]: TaskStatus.InProgress,
      [TaskStatus.InProgress]: TaskStatus.Completed,
    });
  });

  it('defines the phase 4 chaos scenarios', () => {
    expect(CHAOS_SCENARIOS.map((scenario) => scenario.id)).toEqual([
      'ai_unavailable',
      'ai_slow',
      'ai_invalid_response',
      'cms_unavailable',
      'cms_timeout',
      'cms_duplicate_payload',
      'network_loss',
    ]);
    expect(CHAOS_SCENARIOS.every((scenario) => !scenario.enabled)).toBe(true);
    expect(CHAOS_SCENARIOS.every((scenario) => scenario.name && scenario.description)).toBe(true);
  });

  it('builds filters from all tasks plus every status', () => {
    expect(FILTER_OPTIONS).toEqual([{ value: 'all', label: 'Todas' }, ...STATUS_OPTIONS]);
  });

  it('keeps kanban columns focused on the primary workflow statuses', () => {
    expect(WORKFLOW_STATUS_OPTIONS.map((option) => option.value)).toEqual([
      TaskStatus.Draft,
      TaskStatus.AiReviewed,
      TaskStatus.Approved,
      TaskStatus.Published,
      TaskStatus.InProgress,
      TaskStatus.Completed,
    ]);
    expect(TASK_COLUMNS.map((column) => column.status)).toEqual(
      WORKFLOW_STATUS_OPTIONS.map((option) => option.value),
    );
    expect(TASK_COLUMNS.every((column) => column.label && column.caption)).toBe(true);
  });

  it('defines board time thresholds for active workflow statuses', () => {
    expect(BOARD_STATUS_THRESHOLDS_MINUTES).toEqual({
      [TaskStatus.Draft]: 1440,
      [TaskStatus.AiReviewed]: 720,
      [TaskStatus.Approved]: 1440,
      [TaskStatus.Published]: 480,
      [TaskStatus.InProgress]: 4320,
    });
    expect(BOARD_STATUS_THRESHOLDS_MINUTES[TaskStatus.Completed]).toBeUndefined();
    expect(BOARD_STATUS_THRESHOLDS_MINUTES[TaskStatus.Rejected]).toBeUndefined();
    expect(BOARD_STATUS_THRESHOLDS_MINUTES[TaskStatus.Error]).toBeUndefined();
  });

  it('seeds starter tasks with enriched task data', () => {
    expect(STARTER_TASKS.map((task) => task.status)).toEqual([
      TaskStatus.Draft,
      TaskStatus.InProgress,
      TaskStatus.Completed,
    ]);
    expect(STARTER_TASKS.every((task) => task.priority && task.category)).toBe(true);
    expect(STARTER_TASKS.every((task) => Array.isArray(task.tags))).toBe(true);
    expect(STARTER_TASKS.every((task) => Array.isArray(task.acceptanceCriteria))).toBe(true);
    expect(new Set(STARTER_TASKS.map((task) => task.id)).size).toBe(STARTER_TASKS.length);
  });
});
