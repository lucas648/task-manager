import { Injectable } from '@angular/core';
import {
  AuditLog,
  AuditLogEvent,
  BOARD_STATUS_THRESHOLDS_MINUTES,
  BoardStatusTimeMetric,
  BoardTimeSummary,
  STATUS_LABELS,
  STATUS_OPTIONS,
  Task,
  TaskBoardTimeMetric,
  TaskStatus,
  TaskStatusDuration,
} from '../models/task.model';

interface StatusTransition {
  timestamp: number;
  status: TaskStatus;
  fromStatus?: TaskStatus;
}

@Injectable({ providedIn: 'root' })
export class BoardAnalyticsService {
  summarize(tasks: Task[], referenceDate = new Date()): BoardTimeSummary {
    const referenceTime = referenceDate.getTime();
    const taskMetrics = tasks.map((task) => this.buildTaskMetric(task, referenceTime));

    return {
      generatedAt: new Date(referenceTime).toISOString(),
      taskMetrics,
      statusMetrics: STATUS_OPTIONS.map((option) =>
        this.buildStatusMetric(option.value, option.label, taskMetrics),
      ),
    };
  }

  formatDuration(minutes: number): string {
    const safeMinutes = Math.max(0, Math.round(minutes));

    if (safeMinutes < 60) {
      return `${safeMinutes} min`;
    }

    const hours = Math.round(safeMinutes / 60);

    if (hours < 24) {
      return `${hours} h`;
    }

    return `${Math.round(hours / 24)} d`;
  }

  private buildTaskMetric(task: Task, referenceTime: number): TaskBoardTimeMetric {
    const durations = this.buildDurations(task, referenceTime);
    const currentDuration = durations[durations.length - 1];
    const thresholdMinutes = BOARD_STATUS_THRESHOLDS_MINUTES[task.status];
    const isOverThreshold =
      thresholdMinutes !== undefined && currentDuration.durationMinutes > thresholdMinutes;

    return {
      taskId: task.id,
      taskTitle: task.title,
      currentStatus: task.status,
      statusStartedAt: currentDuration.startedAt,
      currentAgeMinutes: currentDuration.durationMinutes,
      currentAgeLabel: currentDuration.durationLabel,
      ...(thresholdMinutes !== undefined ? { thresholdMinutes } : {}),
      isOverThreshold,
      durations,
    };
  }

  private buildDurations(task: Task, referenceTime: number): TaskStatusDuration[] {
    const createdTime = this.readTimestamp(task.createdAt) ?? referenceTime;
    const transitions = this.readTransitions(task.auditLogs);
    const durations: TaskStatusDuration[] = [];
    let currentStatus = transitions[0]?.fromStatus ?? task.status;
    let currentStart = createdTime;

    for (const transition of transitions) {
      if (transition.timestamp < currentStart) {
        continue;
      }

      if (transition.status === currentStatus) {
        continue;
      }

      durations.push(this.createDuration(currentStatus, currentStart, transition.timestamp, false));
      currentStatus = transition.status;
      currentStart = transition.timestamp;
    }

    if (currentStatus !== task.status) {
      const updatedTime = this.readTimestamp(task.updatedAt) ?? currentStart;
      const fallbackStart = Math.max(updatedTime, currentStart);

      durations.push(this.createDuration(currentStatus, currentStart, fallbackStart, false));
      currentStatus = task.status;
      currentStart = fallbackStart;
    }

    durations.push(this.createDuration(currentStatus, currentStart, referenceTime, true));

    return durations;
  }

  private buildStatusMetric(
    status: TaskStatus,
    label: string,
    taskMetrics: TaskBoardTimeMetric[],
  ): BoardStatusTimeMetric {
    const matchingMetrics = taskMetrics.filter((metric) => metric.currentStatus === status);
    const totalMinutes = matchingMetrics.reduce(
      (total, metric) => total + metric.currentAgeMinutes,
      0,
    );
    const averageMinutes = matchingMetrics.length
      ? Math.round(totalMinutes / matchingMetrics.length)
      : 0;
    const longestMetric = this.longestMetric(matchingMetrics);
    const longestMinutes = longestMetric?.currentAgeMinutes ?? 0;
    const thresholdMinutes = BOARD_STATUS_THRESHOLDS_MINUTES[status];

    return {
      status,
      label,
      averageMinutes,
      averageLabel: this.formatDuration(averageMinutes),
      longestMinutes,
      longestLabel: this.formatDuration(longestMinutes),
      ...(longestMetric
        ? {
            longestTaskId: longestMetric.taskId,
            longestTaskTitle: longestMetric.taskTitle,
          }
        : {}),
      ...(thresholdMinutes !== undefined ? { thresholdMinutes } : {}),
      overThresholdCount: matchingMetrics.filter((metric) => metric.isOverThreshold).length,
    };
  }

  private longestMetric(metrics: TaskBoardTimeMetric[]): TaskBoardTimeMetric | undefined {
    return [...metrics].sort(
      (firstMetric, secondMetric) => secondMetric.currentAgeMinutes - firstMetric.currentAgeMinutes,
    )[0];
  }

  private createDuration(
    status: TaskStatus,
    startTime: number,
    endTime: number,
    isCurrent: boolean,
  ): TaskStatusDuration {
    const durationMinutes = this.durationMinutes(startTime, endTime);

    return {
      status,
      label: STATUS_LABELS[status],
      startedAt: new Date(startTime).toISOString(),
      ...(isCurrent ? {} : { endedAt: new Date(endTime).toISOString() }),
      durationMinutes,
      durationLabel: this.formatDuration(durationMinutes),
      isCurrent,
    };
  }

  private readTransitions(logs: AuditLog[]): StatusTransition[] {
    return logs
      .map((log) => this.readTransition(log))
      .filter((transition): transition is StatusTransition => transition !== undefined)
      .sort(
        (firstTransition, secondTransition) =>
          firstTransition.timestamp - secondTransition.timestamp,
      );
  }

  private readTransition(log: AuditLog): StatusTransition | undefined {
    if (log.event !== AuditLogEvent.StatusChanged && log.event !== AuditLogEvent.TaskMoved) {
      return undefined;
    }

    const timestamp = this.readTimestamp(log.timestamp);
    const status = this.readStatus(log.metadata?.['toStatus']);

    if (timestamp === undefined || status === undefined) {
      return undefined;
    }

    const fromStatus = this.readStatus(log.metadata?.['fromStatus']);

    return {
      timestamp,
      status,
      ...(fromStatus ? { fromStatus } : {}),
    };
  }

  private readStatus(value: unknown): TaskStatus | undefined {
    if (typeof value === 'string' && Object.values(TaskStatus).includes(value as TaskStatus)) {
      return value as TaskStatus;
    }

    return undefined;
  }

  private readTimestamp(value: string): number | undefined {
    const timestamp = Date.parse(value);

    return Number.isNaN(timestamp) ? undefined : timestamp;
  }

  private durationMinutes(startTime: number, endTime: number): number {
    return Math.max(0, Math.round((endTime - startTime) / 60000));
  }
}
