import { inject, Injectable, InjectionToken } from '@angular/core';
import { CmsPayload, STARTER_TASKS, Task, TaskPriority, TaskStatus } from '../models/task.model';

export const TASK_STORAGE_KEY = 'task-manager.tasks';

const LEGACY_STATUS_MAP: Record<string, TaskStatus> = {
  pending: TaskStatus.Draft,
  in_progress: TaskStatus.InProgress,
  done: TaskStatus.Completed,
};

export interface TaskRepository {
  loadTasks(): Task[];
  saveTasks(tasks: Task[]): void;
}

export const TASK_REPOSITORY = new InjectionToken<TaskRepository>('TaskRepository', {
  providedIn: 'root',
  factory: () => inject(LocalStorageTaskRepository),
});

@Injectable({ providedIn: 'root' })
export class LocalStorageTaskRepository implements TaskRepository {
  loadTasks(): Task[] {
    if (!this.canUseStorage()) {
      return STARTER_TASKS;
    }

    const storedTasks = localStorage.getItem(TASK_STORAGE_KEY);

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

  saveTasks(tasks: Task[]): void {
    if (!this.canUseStorage()) {
      return;
    }

    localStorage.setItem(TASK_STORAGE_KEY, JSON.stringify(tasks));
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
      cmsPayload: this.readCmsPayload(rawTask['cmsPayload']),
      cmsError: this.optionalText(this.readOptionalText(rawTask, 'cmsError')),
      auditLogs: Array.isArray(rawTask['auditLogs']) ? rawTask['auditLogs'] : [],
    };
  }

  private readCmsPayload(value: unknown): CmsPayload | undefined {
    return this.isRecord(value) ? (value as unknown as CmsPayload) : undefined;
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
}
