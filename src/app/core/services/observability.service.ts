import { computed, inject, Injectable, InjectionToken, signal } from '@angular/core';
import {
  DEFAULT_OBSERVABILITY_CONFIG,
  isRumConfigReady,
  ObservabilityConfig,
  ObservabilityEvent,
  ObservabilityEventContext,
  ObservabilityTagContext,
  OBSERVABILITY_ATTRIBUTE_KEYS,
  OBSERVABILITY_TAG_KEYS,
  TASKFLOW_APP_TAG,
} from '../models/observability.model';

export const OBSERVABILITY_CONFIG = new InjectionToken<ObservabilityConfig>('ObservabilityConfig', {
  providedIn: 'root',
  factory: () => DEFAULT_OBSERVABILITY_CONFIG,
});

const HIGH_CARDINALITY_ATTRIBUTE_MAP = [
  ['correlationId', OBSERVABILITY_ATTRIBUTE_KEYS.correlationId],
  ['taskId', OBSERVABILITY_ATTRIBUTE_KEYS.taskId],
  ['userId', OBSERVABILITY_ATTRIBUTE_KEYS.userId],
  ['agentRunId', OBSERVABILITY_ATTRIBUTE_KEYS.agentRunId],
] as const;

@Injectable({ providedIn: 'root' })
export class ObservabilityService {
  private readonly initialConfig = inject(OBSERVABILITY_CONFIG);

  readonly config = signal<ObservabilityConfig>(this.initialConfig);
  readonly events = signal<ObservabilityEvent[]>([]);
  readonly rumReady = computed(() => isRumConfigReady(this.config()));
  readonly baseTags = computed(() => this.buildTags());

  setConfig(config: ObservabilityConfig): void {
    this.config.set(config);
  }

  buildTags(context: ObservabilityTagContext = {}): string[] {
    const config = this.config();
    const component = context.component ?? 'web';

    return [
      this.createTag(OBSERVABILITY_TAG_KEYS.env, config.env),
      this.createTag(OBSERVABILITY_TAG_KEYS.service, config.service),
      this.createTag(OBSERVABILITY_TAG_KEYS.version, config.version),
      this.createTag(OBSERVABILITY_TAG_KEYS.app, TASKFLOW_APP_TAG),
      this.createTag(OBSERVABILITY_TAG_KEYS.component, component),
      this.createTag(OBSERVABILITY_TAG_KEYS.feature, context.feature),
      this.createTag(OBSERVABILITY_TAG_KEYS.operation, context.operation),
      this.createTag(OBSERVABILITY_TAG_KEYS.taskStatus, context.taskStatus),
      this.createTag(OBSERVABILITY_TAG_KEYS.taskPriority, context.taskPriority),
      this.createTag(OBSERVABILITY_TAG_KEYS.agentId, context.agentId),
      this.createTag(OBSERVABILITY_TAG_KEYS.agentProvider, context.agentProvider),
      this.createTag(OBSERVABILITY_TAG_KEYS.agentOperation, context.agentOperation),
      this.createTag(OBSERVABILITY_TAG_KEYS.runStatus, context.runStatus),
      this.createTag(OBSERVABILITY_TAG_KEYS.fallback, context.fallback),
    ].filter((tag): tag is string => tag !== undefined);
  }

  trackEvent(
    name: string,
    context: ObservabilityEventContext = {},
    timestamp = new Date().toISOString(),
  ): ObservabilityEvent {
    const event: ObservabilityEvent = {
      name,
      timestamp,
      tags: this.buildTags(context),
      attributes: this.buildAttributes(context),
    };

    this.events.update((events) => [event, ...events]);

    return event;
  }

  clearEvents(): void {
    this.events.set([]);
  }

  private buildAttributes(
    context: ObservabilityEventContext,
  ): Record<string, string | number | boolean> {
    const attributes = this.removeEmptyAttributes(context.attributes ?? {});

    HIGH_CARDINALITY_ATTRIBUTE_MAP.forEach(([sourceKey, targetKey]) => {
      const value = context[sourceKey];

      if (value) {
        attributes[targetKey] = value;
      }
    });

    return attributes;
  }

  private removeEmptyAttributes(
    attributes: Record<string, string | number | boolean | undefined>,
  ): Record<string, string | number | boolean> {
    return Object.fromEntries(
      Object.entries(attributes).filter((entry): entry is [string, string | number | boolean] => {
        const value = entry[1];

        return value !== undefined && value !== '';
      }),
    );
  }

  private createTag(key: string, value: string | number | boolean | undefined): string | undefined {
    const normalizedValue = this.normalizeTagValue(value);

    return normalizedValue ? `${key}:${normalizedValue}` : undefined;
  }

  private normalizeTagValue(value: string | number | boolean | undefined): string {
    if (value === undefined || value === '') {
      return '';
    }

    return String(value).trim().toLowerCase().replace(/\s+/g, '_');
  }
}
