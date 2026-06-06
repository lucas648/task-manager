import { computed, effect, inject, Injectable, signal } from '@angular/core';
import {
  AuditLog,
  AuditLogEvent,
  CHAOS_SCENARIOS,
  ChaosScenario,
  ChaosScenarioId,
} from '../models/task.model';
import { AuditLogService } from './audit-log.service';

const CHAOS_STORAGE_KEY = 'task-manager.chaos-scenarios';
const CHAOS_LOG_STORAGE_KEY = 'task-manager.chaos-logs';
const CHAOS_TASK_ID = 'chaos';

@Injectable({ providedIn: 'root' })
export class ChaosService {
  private readonly auditLogService = inject(AuditLogService);

  readonly scenarios = signal<ChaosScenario[]>(this.loadScenarios());
  readonly auditLogs = signal<AuditLog[]>(this.loadAuditLogs());
  readonly activeScenarios = computed(() =>
    this.scenarios().filter((scenario) => scenario.enabled),
  );
  readonly activeCount = computed(() => this.activeScenarios().length);

  constructor() {
    effect(() => {
      if (!this.canUseStorage()) {
        return;
      }

      localStorage.setItem(CHAOS_STORAGE_KEY, JSON.stringify(this.scenarios()));
    });

    effect(() => {
      if (!this.canUseStorage()) {
        return;
      }

      localStorage.setItem(CHAOS_LOG_STORAGE_KEY, JSON.stringify(this.auditLogs()));
    });
  }

  isEnabled(scenarioId: ChaosScenarioId): boolean {
    return this.scenarios().some((scenario) => scenario.id === scenarioId && scenario.enabled);
  }

  setScenario(scenarioId: ChaosScenarioId, enabled: boolean): void {
    const currentScenario = this.scenarios().find((scenario) => scenario.id === scenarioId);

    if (!currentScenario || currentScenario.enabled === enabled) {
      return;
    }

    const event = enabled
      ? AuditLogEvent.ChaosScenarioEnabled
      : AuditLogEvent.ChaosScenarioDisabled;

    this.scenarios.update((scenarios) =>
      scenarios.map((scenario) =>
        scenario.id === scenarioId ? { ...scenario, enabled } : scenario,
      ),
    );
    this.auditLogs.update((logs) => [
      this.auditLogService.createLog(event, CHAOS_TASK_ID, {
        scenarioId,
        scenarioName: currentScenario.name,
      }),
      ...logs,
    ]);
  }

  reset(): void {
    const enabledScenarios = this.activeScenarios();

    if (!enabledScenarios.length) {
      return;
    }

    this.scenarios.set(this.scenarios().map((scenario) => ({ ...scenario, enabled: false })));
    this.auditLogs.update((logs) => [
      ...enabledScenarios.map((scenario) =>
        this.auditLogService.createLog(AuditLogEvent.ChaosScenarioDisabled, CHAOS_TASK_ID, {
          scenarioId: scenario.id,
          scenarioName: scenario.name,
        }),
      ),
      ...logs,
    ]);
  }

  private loadScenarios(): ChaosScenario[] {
    if (!this.canUseStorage()) {
      return this.defaultScenarios();
    }

    const storedScenarios = localStorage.getItem(CHAOS_STORAGE_KEY);

    if (!storedScenarios) {
      return this.defaultScenarios();
    }

    try {
      const parsedScenarios = JSON.parse(storedScenarios) as unknown;

      if (!Array.isArray(parsedScenarios)) {
        return this.defaultScenarios();
      }

      return this.defaultScenarios().map((scenario) => {
        const storedScenario = parsedScenarios.find(
          (candidate) => this.isStoredScenario(candidate) && candidate.id === scenario.id,
        );

        return {
          ...scenario,
          enabled: storedScenario?.enabled ?? false,
        };
      });
    } catch {
      return this.defaultScenarios();
    }
  }

  private loadAuditLogs(): AuditLog[] {
    if (!this.canUseStorage()) {
      return [];
    }

    const storedLogs = localStorage.getItem(CHAOS_LOG_STORAGE_KEY);

    if (!storedLogs) {
      return [];
    }

    try {
      const parsedLogs = JSON.parse(storedLogs) as unknown;

      return Array.isArray(parsedLogs)
        ? parsedLogs.filter((log): log is AuditLog => this.isAuditLog(log))
        : [];
    } catch {
      return [];
    }
  }

  private defaultScenarios(): ChaosScenario[] {
    return CHAOS_SCENARIOS.map((scenario) => ({ ...scenario }));
  }

  private isStoredScenario(value: unknown): value is Pick<ChaosScenario, 'id' | 'enabled'> {
    return (
      typeof value === 'object' &&
      value !== null &&
      'id' in value &&
      'enabled' in value &&
      typeof value.enabled === 'boolean'
    );
  }

  private isAuditLog(value: unknown): value is AuditLog {
    return (
      typeof value === 'object' &&
      value !== null &&
      'id' in value &&
      'event' in value &&
      'taskId' in value &&
      'timestamp' in value
    );
  }

  private canUseStorage(): boolean {
    return typeof localStorage !== 'undefined';
  }
}
