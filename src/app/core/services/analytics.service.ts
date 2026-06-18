import { computed, inject, Injectable } from '@angular/core';
import {
  AnalyticsSummary,
  AuditLog,
  AuditLogEvent,
  STATUS_OPTIONS,
  Task,
  TaskStatus,
} from '../models/task.model';
import { AiRecommendationService } from './ai-recommendation.service';
import { BoardAnalyticsService } from './board-analytics.service';
import { ChaosService } from './chaos.service';
import { TaskService } from './task.service';

const RECENT_EVENTS_LIMIT = 8;

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly taskService = inject(TaskService);
  private readonly chaosService = inject(ChaosService);
  private readonly boardAnalyticsService = inject(BoardAnalyticsService);
  private readonly aiRecommendationService = inject(AiRecommendationService);

  readonly summary = computed<AnalyticsSummary>(() => {
    const tasks = this.taskService.tasks();
    const taskLogs = tasks.flatMap((task) => task.auditLogs);
    const chaosLogs = this.chaosService.auditLogs();
    const allLogs = [...taskLogs, ...chaosLogs];
    const totalTasks = this.taskService.totalTasks();
    const acceptedSuggestions = this.countSuggestionsByDecision(tasks, 'applied');
    const rejectedSuggestions = this.countSuggestionsByDecision(tasks, 'rejected');
    const decidedSuggestions = acceptedSuggestions + rejectedSuggestions;
    const boardTime = this.boardAnalyticsService.summarize(tasks);

    return {
      totalTasks,
      totalAuditLogs: allLogs.length,
      aiFailures: this.countEvents(taskLogs, AuditLogEvent.AiReviewError),
      cmsFailures: this.countEvents(taskLogs, AuditLogEvent.CmsSendError),
      chaosEvents: this.countChaosEvents(chaosLogs),
      acceptedSuggestions,
      rejectedSuggestions,
      suggestionAcceptanceRate: this.calculatePercentage(acceptedSuggestions, decidedSuggestions),
      averageApprovalMinutes: this.calculateAverageApprovalMinutes(tasks),
      statusMetrics: STATUS_OPTIONS.map((option) => {
        const count = this.countTasksByStatus(tasks, option.value);

        return {
          status: option.value,
          label: option.label,
          count,
          percentage: this.calculatePercentage(count, totalTasks),
        };
      }),
      boardTime,
      boardRecommendations: this.aiRecommendationService.recommend(tasks, boardTime),
      recentEvents: this.sortRecentEvents(allLogs).slice(0, RECENT_EVENTS_LIMIT),
    };
  });

  private countEvents(logs: AuditLog[], event: AuditLogEvent): number {
    return logs.filter((log) => log.event === event).length;
  }

  private countChaosEvents(logs: AuditLog[]): number {
    return logs.filter(
      (log) =>
        log.event === AuditLogEvent.ChaosScenarioEnabled ||
        log.event === AuditLogEvent.ChaosScenarioDisabled,
    ).length;
  }

  private countSuggestionsByDecision(tasks: Task[], decision: 'applied' | 'rejected'): number {
    return tasks
      .flatMap((task) => task.aiSuggestions)
      .filter((suggestion) => suggestion.decision === decision).length;
  }

  private countTasksByStatus(tasks: Task[], status: TaskStatus): number {
    return tasks.filter((task) => task.status === status).length;
  }

  private calculatePercentage(count: number, total: number): number {
    if (!total) {
      return 0;
    }

    return Math.round((count / total) * 100);
  }

  private calculateAverageApprovalMinutes(tasks: Task[]): number {
    let totalDuration = 0;
    let approvedTasks = 0;

    for (const task of tasks) {
      if (!task.approvedAt) {
        continue;
      }

      const createdAt = Date.parse(task.createdAt);
      const approvedAt = Date.parse(task.approvedAt);

      if (Number.isNaN(createdAt)) {
        continue;
      }

      if (Number.isNaN(approvedAt)) {
        continue;
      }

      const duration = approvedAt - createdAt;

      if (duration < 0) {
        continue;
      }

      totalDuration += duration;
      approvedTasks += 1;
    }

    if (!approvedTasks) {
      return 0;
    }

    return Math.round(totalDuration / approvedTasks / 60000);
  }

  private sortRecentEvents(logs: AuditLog[]): AuditLog[] {
    return [...logs].sort((firstLog, secondLog) => {
      const firstTime = this.readTimestamp(firstLog.timestamp);
      const secondTime = this.readTimestamp(secondLog.timestamp);

      return secondTime - firstTime;
    });
  }

  private readTimestamp(timestamp: string): number {
    const parsedTimestamp = Date.parse(timestamp);

    if (Number.isNaN(parsedTimestamp)) {
      return 0;
    }

    return parsedTimestamp;
  }
}
