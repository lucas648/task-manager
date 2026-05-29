import {
  FILTER_OPTIONS,
  PRIORITY_LABELS,
  PRIORITY_OPTIONS,
  STARTER_TASKS,
  STATUS_LABELS,
  STATUS_OPTIONS,
  TASK_COLUMNS,
  TaskPriority,
  TaskStatus,
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
