import { computed, effect, inject, Injectable, signal } from '@angular/core';
import {
  AuditLogEvent,
  NewTaskInput,
  STARTER_TASKS,
  Task,
  TaskPriority,
  TaskStatus,
} from '../models/task.model';
import { AuditLogService } from './audit-log.service';

const STORAGE_KEY = 'task-manager.tasks';

const LEGACY_STATUS_MAP: Record<string, TaskStatus> = {
  pending: TaskStatus.Draft,
  in_progress: TaskStatus.InProgress,
  done: TaskStatus.Completed,
};

@Injectable({ providedIn: 'root' })
export class TaskService {
  private readonly auditLogService = inject(AuditLogService);

  readonly tasks = signal<Task[]>(this.loadTasks());
  readonly totalTasks = computed(() => this.tasks().length);

  constructor() {
    effect(() => {
      if (!this.canUseStorage()) {
        return;
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.tasks()));
    });
  }

  addTask(input: NewTaskInput): Task {
    const now = new Date().toISOString();
    const taskId = this.createId();
    const createdLog = this.auditLogService.createLog(
      AuditLogEvent.TaskCreated,
      taskId,
      { status: TaskStatus.Draft },
      now,
    );
    const task: Task = {
      id: taskId,
      title: input.title.trim(),
      description: input.description.trim(),
      priority: input.priority,
      status: TaskStatus.Draft,
      category: input.category.trim(),
      tags: input.tags,
      assignee: this.optionalText(input.assignee),
      dueDate: this.optionalText(input.dueDate),
      acceptanceCriteria: input.acceptanceCriteria,
      createdAt: now,
      updatedAt: now,
      aiSuggestions: [],
      auditLogs: [createdLog],
    };

    this.tasks.update((tasks) => [task, ...tasks]);

    return task;
  }

  updateTask(taskId: string, input: Partial<NewTaskInput>): void {
    const now = new Date().toISOString();

    this.tasks.update((tasks) =>
      tasks.map((task) => {
        if (task.id !== taskId) {
          return task;
        }

        const updatedTask: Task = {
          ...task,
          ...this.buildTaskUpdates(input),
          updatedAt: now,
        };

        return this.withAuditLog(
          updatedTask,
          AuditLogEvent.TaskUpdated,
          {
            changedFields: Object.keys(input),
          },
          now,
        );
      }),
    );
  }

  changeStatus(taskId: string, status: TaskStatus): void {
    const now = new Date().toISOString();

    this.tasks.update((tasks) =>
      tasks.map((task) => {
        if (task.id !== taskId) {
          return task;
        }

        const updatedTask: Task = {
          ...task,
          status,
          updatedAt: now,
          approvedAt: status === TaskStatus.Approved ? now : task.approvedAt,
          publishedAt: status === TaskStatus.Published ? now : task.publishedAt,
        };

        return this.withAuditLog(
          updatedTask,
          AuditLogEvent.StatusChanged,
          {
            fromStatus: task.status,
            toStatus: status,
          },
          now,
        );
      }),
    );
  }

  deleteTask(taskId: string): void {
    this.tasks.update((tasks) => tasks.filter((task) => task.id !== taskId));
  }

  countByStatus(status: TaskStatus): number {
    return this.tasks().filter((task) => task.status === status).length;
  }

  private buildTaskUpdates(input: Partial<NewTaskInput>): Partial<Task> {
    return {
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.description !== undefined ? { description: input.description.trim() } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.category !== undefined ? { category: input.category.trim() } : {}),
      ...(input.tags !== undefined ? { tags: input.tags } : {}),
      ...(input.assignee !== undefined ? { assignee: this.optionalText(input.assignee) } : {}),
      ...(input.dueDate !== undefined ? { dueDate: this.optionalText(input.dueDate) } : {}),
      ...(input.acceptanceCriteria !== undefined
        ? { acceptanceCriteria: input.acceptanceCriteria }
        : {}),
    };
  }

  private withAuditLog(
    task: Task,
    event: AuditLogEvent,
    metadata: Record<string, unknown>,
    timestamp: string,
  ): Task {
    return {
      ...task,
      auditLogs: [
        ...task.auditLogs,
        this.auditLogService.createLog(event, task.id, metadata, timestamp),
      ],
    };
  }

  private loadTasks(): Task[] {
    if (!this.canUseStorage()) {
      return STARTER_TASKS;
    }

    const storedTasks = localStorage.getItem(STORAGE_KEY);

    if (!storedTasks) {
      return STARTER_TASKS;
    }

    try {
      const parsedTasks = JSON.parse(storedTasks) as unknown;

      if (!Array.isArray(parsedTasks)) {
        return STARTER_TASKS;
      }

      const migratedTasks = parsedTasks
        .map((task) => this.normalizeTask(task))
        .filter((task): task is Task => task !== undefined);

      return migratedTasks.length ? migratedTasks : STARTER_TASKS;
    } catch {
      return STARTER_TASKS;
    }
  }

  private normalizeTask(rawTask: unknown): Task | undefined {
    if (!this.isRecord(rawTask) || typeof rawTask['id'] !== 'string') {
      return undefined;
    }

    const now = new Date().toISOString();

    return {
      id: rawTask['id'],
      title: this.readText(rawTask, 'title', 'Sem titulo'),
      description: this.readText(rawTask, 'description', ''),
      priority: this.readPriority(rawTask['priority']),
      status: this.readStatus(rawTask['status']),
      category: this.readText(rawTask, 'category', 'Geral'),
      tags: this.readStringArray(rawTask['tags']),
      assignee: this.optionalText(this.readOptionalText(rawTask, 'assignee')),
      dueDate: this.optionalText(this.readOptionalText(rawTask, 'dueDate')),
      acceptanceCriteria: this.readStringArray(rawTask['acceptanceCriteria']),
      createdAt: this.readText(rawTask, 'createdAt', now),
      updatedAt: this.readText(rawTask, 'updatedAt', now),
      approvedAt: this.optionalText(this.readOptionalText(rawTask, 'approvedAt')),
      publishedAt: this.optionalText(this.readOptionalText(rawTask, 'publishedAt')),
      aiSuggestions: Array.isArray(rawTask['aiSuggestions']) ? rawTask['aiSuggestions'] : [],
      qualityScore: this.isRecord(rawTask['qualityScore'])
        ? (rawTask['qualityScore'] as unknown as Task['qualityScore'])
        : undefined,
      auditLogs: Array.isArray(rawTask['auditLogs']) ? rawTask['auditLogs'] : [],
    };
  }

  private readStatus(value: unknown): TaskStatus {
    if (typeof value !== 'string') {
      return TaskStatus.Draft;
    }

    if (Object.values(TaskStatus).includes(value as TaskStatus)) {
      return value as TaskStatus;
    }

    return LEGACY_STATUS_MAP[value] ?? TaskStatus.Draft;
  }

  private readPriority(value: unknown): TaskPriority {
    if (typeof value === 'string' && Object.values(TaskPriority).includes(value as TaskPriority)) {
      return value as TaskPriority;
    }

    return TaskPriority.Medium;
  }

  private readText(record: Record<string, unknown>, key: string, fallback: string): string {
    const value = record[key];
    return typeof value === 'string' && value.trim() ? value : fallback;
  }

  private readOptionalText(record: Record<string, unknown>, key: string): string | undefined {
    const value = record[key];
    return typeof value === 'string' ? value : undefined;
  }

  private readStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .filter((item): item is string => typeof item === 'string' && !!item.trim())
      .map((item) => item.trim());
  }

  private optionalText(value: string | undefined): string | undefined {
    const normalizedValue = value?.trim();
    return normalizedValue ? normalizedValue : undefined;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  private canUseStorage(): boolean {
    return typeof localStorage !== 'undefined';
  }

  private createId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}
