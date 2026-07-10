import { isPlatformBrowser } from '@angular/common';
import { computed, effect, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import {
  AGENT_RUN_STORAGE_KEY,
  AgentRunCompleteInput,
  AgentRunRecord,
  AgentRunStartInput,
} from '../models/agent-run.model';

const RECENT_AGENT_RUNS_LIMIT = 8;

@Injectable({ providedIn: 'root' })
export class AgentRunService {
  private readonly platformId = inject(PLATFORM_ID);

  readonly runs = signal<AgentRunRecord[]>(this.loadRuns());
  readonly recentRuns = computed(() =>
    this.sortRuns(this.runs()).slice(0, RECENT_AGENT_RUNS_LIMIT),
  );
  readonly activeRuns = computed(() =>
    this.runs().filter((run) => run.status === 'queued' || run.status === 'running'),
  );
  readonly completedRunsCount = computed(
    () => this.runs().filter((run) => run.status === 'completed').length,
  );
  readonly failedRunsCount = computed(
    () => this.runs().filter((run) => run.status === 'failed').length,
  );
  readonly averageDurationMs = computed(() => this.calculateAverageDuration(this.runs()));

  constructor() {
    effect(() => {
      const storage = this.storage();

      if (!storage) {
        return;
      }

      storage.setItem(AGENT_RUN_STORAGE_KEY, JSON.stringify(this.runs()));
    });
  }

  queueRun(input: AgentRunStartInput, createdAt = new Date().toISOString()): AgentRunRecord {
    const run: AgentRunRecord = {
      id: this.createId(),
      agentId: input.agentId,
      operation: input.operation,
      status: 'queued',
      provider: input.provider,
      createdAt,
      updatedAt: createdAt,
      taskId: input.taskId,
      taskTitle: input.taskTitle,
      inputSummary: input.inputSummary,
    };

    this.runs.update((runs) => [run, ...runs]);

    return run;
  }

  startRun(runId: string, startedAt = new Date().toISOString()): AgentRunRecord | undefined {
    return this.updateRun(runId, (run) => ({
      ...run,
      status: 'running',
      startedAt,
      updatedAt: startedAt,
    }));
  }

  completeRun(
    runId: string,
    input: AgentRunCompleteInput,
    completedAt = new Date().toISOString(),
  ): AgentRunRecord | undefined {
    return this.updateRun(runId, (run) => ({
      ...run,
      status: 'completed',
      provider: input.provider ?? run.provider,
      completedAt,
      durationMs: this.calculateDuration(run.startedAt ?? run.createdAt, completedAt),
      updatedAt: completedAt,
      outputSummary: input.outputSummary,
      outputCount: input.outputCount,
      fallbackReason: input.fallbackReason,
      errorMessage: undefined,
    }));
  }

  failRun(
    runId: string,
    errorMessage: string,
    completedAt = new Date().toISOString(),
  ): AgentRunRecord | undefined {
    return this.updateRun(runId, (run) => ({
      ...run,
      status: 'failed',
      completedAt,
      durationMs: this.calculateDuration(run.startedAt ?? run.createdAt, completedAt),
      updatedAt: completedAt,
      errorMessage,
    }));
  }

  clearHistory(): void {
    this.runs.set([]);
  }

  private updateRun(
    runId: string,
    updater: (run: AgentRunRecord) => AgentRunRecord,
  ): AgentRunRecord | undefined {
    let updatedRun: AgentRunRecord | undefined;

    this.runs.update((runs) =>
      runs.map((run) => {
        if (run.id !== runId) {
          return run;
        }

        updatedRun = updater(run);
        return updatedRun;
      }),
    );

    return updatedRun;
  }

  private loadRuns(): AgentRunRecord[] {
    const storage = this.storage();

    if (!storage) {
      return [];
    }

    try {
      const parsedRuns = JSON.parse(storage.getItem(AGENT_RUN_STORAGE_KEY) ?? '[]') as unknown;

      return Array.isArray(parsedRuns)
        ? this.sortRuns(parsedRuns.filter((run): run is AgentRunRecord => this.isAgentRun(run)))
        : [];
    } catch {
      return [];
    }
  }

  private isAgentRun(value: unknown): value is AgentRunRecord {
    return (
      this.isRecord(value) &&
      typeof value['id'] === 'string' &&
      typeof value['agentId'] === 'string' &&
      (value['operation'] === 'task_review' || value['operation'] === 'board_recommendation') &&
      (value['status'] === 'queued' ||
        value['status'] === 'running' ||
        value['status'] === 'completed' ||
        value['status'] === 'failed') &&
      (value['provider'] === 'mock' ||
        value['provider'] === 'gateway' ||
        value['provider'] === 'openai') &&
      typeof value['createdAt'] === 'string' &&
      typeof value['updatedAt'] === 'string' &&
      typeof value['inputSummary'] === 'string'
    );
  }

  private calculateAverageDuration(runs: AgentRunRecord[]): number {
    const durations = runs
      .map((run) => run.durationMs)
      .filter((duration): duration is number => typeof duration === 'number');

    if (!durations.length) {
      return 0;
    }

    return Math.round(
      durations.reduce((total, duration) => total + duration, 0) / durations.length,
    );
  }

  private calculateDuration(startedAt: string, completedAt: string): number | undefined {
    const startTime = Date.parse(startedAt);
    const completedTime = Date.parse(completedAt);

    if (Number.isNaN(startTime) || Number.isNaN(completedTime) || completedTime < startTime) {
      return undefined;
    }

    return completedTime - startTime;
  }

  private sortRuns(runs: AgentRunRecord[]): AgentRunRecord[] {
    return [...runs].sort((firstRun, secondRun) => {
      const firstTime = Date.parse(firstRun.updatedAt);
      const secondTime = Date.parse(secondRun.updatedAt);

      return this.safeTimestamp(secondTime) - this.safeTimestamp(firstTime);
    });
  }

  private safeTimestamp(timestamp: number): number {
    return Number.isNaN(timestamp) ? 0 : timestamp;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  private storage(): Storage | undefined {
    if (!isPlatformBrowser(this.platformId) || typeof globalThis.localStorage === 'undefined') {
      return undefined;
    }

    return globalThis.localStorage;
  }

  private createId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}
