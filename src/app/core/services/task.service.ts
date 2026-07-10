import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { AuditLogEvent, NewTaskInput, Task, TaskPriority, TaskStatus } from '../models/task.model';
import { AuditLogService } from './audit-log.service';
import { TASK_REPOSITORY } from './task-repository.service';

@Injectable({ providedIn: 'root' })
export class TaskService {
  private readonly auditLogService = inject(AuditLogService);
  private readonly taskRepository = inject(TASK_REPOSITORY);

  readonly tasks = signal<Task[]>(this.taskRepository.loadTasks());
  readonly totalTasks = computed(() => this.tasks().length);

  constructor() {
    effect(() => {
      this.taskRepository.saveTasks(this.tasks());
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

  moveTask(taskId: string, targetStatus: TaskStatus, targetIndex: number): void {
    const now = new Date().toISOString();

    this.tasks.update((tasks) => {
      const sourceTaskIndex = tasks.findIndex((task) => task.id === taskId);

      if (sourceTaskIndex < 0) {
        return tasks;
      }

      const sourceTask = tasks[sourceTaskIndex];
      const sourceStatus = sourceTask.status;
      const sourceColumnIndex = this.findStatusIndex(tasks, taskId, sourceStatus);
      const remainingTasks = tasks.filter((task) => task.id !== taskId);
      const targetColumnSize = remainingTasks.filter((task) => task.status === targetStatus).length;
      const targetColumnIndex = Math.min(Math.max(targetIndex, 0), targetColumnSize);

      if (sourceStatus === targetStatus && sourceColumnIndex === targetColumnIndex) {
        return tasks;
      }

      const movedTask = this.buildMovedTask(
        sourceTask,
        sourceStatus,
        targetStatus,
        sourceColumnIndex,
        targetColumnIndex,
        now,
      );

      return this.insertTaskAtStatusIndex(
        remainingTasks,
        movedTask,
        targetStatus,
        targetColumnIndex,
      );
    });
  }

  deleteTask(taskId: string): void {
    this.tasks.update((tasks) => tasks.filter((task) => task.id !== taskId));
  }

  findTask(taskId: string): Task | undefined {
    return this.tasks().find((task) => task.id === taskId);
  }

  applyWorkflowUpdate(
    taskId: string,
    update: Partial<Task>,
    auditEvents: { event: AuditLogEvent; metadata?: Record<string, unknown> }[],
    timestamp = new Date().toISOString(),
  ): Task | undefined {
    let workflowTask: Task | undefined;

    this.tasks.update((tasks) =>
      tasks.map((task) => {
        if (task.id !== taskId) {
          return task;
        }

        workflowTask = auditEvents.reduce(
          (updatedTask, auditEvent) =>
            this.withAuditLog(updatedTask, auditEvent.event, auditEvent.metadata, timestamp),
          {
            ...task,
            ...update,
            updatedAt: timestamp,
          },
        );

        return workflowTask;
      }),
    );

    return workflowTask;
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

  private buildMovedTask(
    task: Task,
    sourceStatus: TaskStatus,
    targetStatus: TaskStatus,
    sourceColumnIndex: number,
    targetColumnIndex: number,
    timestamp: string,
  ): Task {
    const updatedTask: Task = {
      ...task,
      status: targetStatus,
      updatedAt: timestamp,
      approvedAt: targetStatus === TaskStatus.Approved ? timestamp : task.approvedAt,
      publishedAt: targetStatus === TaskStatus.Published ? timestamp : task.publishedAt,
    };
    const statusEvents =
      sourceStatus === targetStatus
        ? []
        : [
            {
              event: AuditLogEvent.StatusChanged,
              metadata: {
                fromStatus: sourceStatus,
                toStatus: targetStatus,
              },
            },
          ];

    return [
      ...statusEvents,
      {
        event: AuditLogEvent.TaskMoved,
        metadata: {
          fromStatus: sourceStatus,
          toStatus: targetStatus,
          fromColumnIndex: sourceColumnIndex,
          toColumnIndex: targetColumnIndex,
        },
      },
    ].reduce(
      (movedTask, auditEvent) =>
        this.withAuditLog(movedTask, auditEvent.event, auditEvent.metadata, timestamp),
      updatedTask,
    );
  }

  private insertTaskAtStatusIndex(
    tasks: Task[],
    task: Task,
    status: TaskStatus,
    targetIndex: number,
  ): Task[] {
    const targetTask = tasks.filter((candidate) => candidate.status === status)[targetIndex];
    const insertionIndex = targetTask
      ? tasks.findIndex((candidate) => candidate.id === targetTask.id)
      : this.findIndexAfterLastStatus(tasks, status);
    const updatedTasks = [...tasks];

    updatedTasks.splice(insertionIndex, 0, task);

    return updatedTasks;
  }

  private findStatusIndex(tasks: Task[], taskId: string, status: TaskStatus): number {
    return tasks.filter((task) => task.status === status).findIndex((task) => task.id === taskId);
  }

  private findIndexAfterLastStatus(tasks: Task[], status: TaskStatus): number {
    let lastStatusIndex = -1;

    tasks.forEach((task, index) => {
      if (task.status === status) {
        lastStatusIndex = index;
      }
    });

    return lastStatusIndex >= 0 ? lastStatusIndex + 1 : tasks.length;
  }

  private withAuditLog(
    task: Task,
    event: AuditLogEvent,
    metadata: Record<string, unknown> | undefined,
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

  private optionalText(value: string | undefined): string | undefined {
    const normalizedValue = value?.trim();
    return normalizedValue ? normalizedValue : undefined;
  }

  private createId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}
