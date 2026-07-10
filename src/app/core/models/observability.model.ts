import { AgentRunOperation, AgentRunStatus } from './agent-run.model';
import { AgentId, AgentProviderKind, TaskPriority, TaskStatus } from './task.model';

export type ObservabilityComponent = 'web' | 'server';
export type ObservabilityFeature = 'tasks' | 'ai' | 'analytics' | 'auth' | 'chaos' | 'cms';
export type ObservabilityOperation =
  | 'create_task'
  | 'update_task'
  | 'review_task'
  | 'move_task'
  | 'publish_task'
  | 'login'
  | 'logout'
  | 'agent_run';

export type ObservabilityAttributeValue = string | number | boolean | undefined;

export interface ObservabilityConfig {
  enabled: boolean;
  env: string;
  service: string;
  version: string;
  site: string;
  rumApplicationId: string;
  rumClientToken: string;
  rumSessionSampleRate: number;
  rumSessionReplaySampleRate: number;
  traceSampleRate: number;
}

export interface ObservabilityTagContext {
  component?: ObservabilityComponent;
  feature?: ObservabilityFeature;
  operation?: ObservabilityOperation;
  taskStatus?: TaskStatus;
  taskPriority?: TaskPriority;
  agentId?: AgentId;
  agentProvider?: AgentProviderKind;
  agentOperation?: AgentRunOperation;
  runStatus?: AgentRunStatus;
  fallback?: boolean;
}

export interface ObservabilityEventContext extends ObservabilityTagContext {
  correlationId?: string;
  taskId?: string;
  userId?: string;
  agentRunId?: string;
  attributes?: Record<string, ObservabilityAttributeValue>;
}

export interface ObservabilityEvent {
  name: string;
  timestamp: string;
  tags: string[];
  attributes: Record<string, string | number | boolean>;
}

export const DEFAULT_OBSERVABILITY_CONFIG: ObservabilityConfig = {
  enabled: false,
  env: 'local',
  service: 'taskflow-ai',
  version: 'dev',
  site: 'datadoghq.com',
  rumApplicationId: '',
  rumClientToken: '',
  rumSessionSampleRate: 100,
  rumSessionReplaySampleRate: 0,
  traceSampleRate: 100,
};

export const OBSERVABILITY_ENV_KEYS = {
  enabled: 'DATADOG_ENABLED',
  env: 'DD_ENV',
  service: 'DD_SERVICE',
  version: 'DD_VERSION',
  site: 'DD_SITE',
  rumApplicationId: 'DD_RUM_APPLICATION_ID',
  rumClientToken: 'DD_RUM_CLIENT_TOKEN',
  rumSessionSampleRate: 'DD_RUM_SESSION_SAMPLE_RATE',
  rumSessionReplaySampleRate: 'DD_RUM_REPLAY_SAMPLE_RATE',
  traceSampleRate: 'DD_TRACE_SAMPLE_RATE',
} as const;

export const OBSERVABILITY_TAG_KEYS = {
  app: 'app',
  env: 'env',
  service: 'service',
  version: 'version',
  component: 'component',
  feature: 'feature',
  operation: 'operation',
  taskStatus: 'task_status',
  taskPriority: 'task_priority',
  agentId: 'agent_id',
  agentProvider: 'agent_provider',
  agentOperation: 'agent_operation',
  runStatus: 'run_status',
  fallback: 'fallback',
} as const;

export const OBSERVABILITY_ATTRIBUTE_KEYS = {
  correlationId: 'correlation_id',
  taskId: 'task_id',
  userId: 'user_id',
  agentRunId: 'agent_run_id',
} as const;

export const TASKFLOW_APP_TAG = 'taskflow-ai';

export function resolveObservabilityConfig(
  values: Partial<
    Record<(typeof OBSERVABILITY_ENV_KEYS)[keyof typeof OBSERVABILITY_ENV_KEYS], string | undefined>
  >,
): ObservabilityConfig {
  return {
    enabled: parseBoolean(values[OBSERVABILITY_ENV_KEYS.enabled]),
    env: parseText(values[OBSERVABILITY_ENV_KEYS.env], DEFAULT_OBSERVABILITY_CONFIG.env),
    service: parseText(
      values[OBSERVABILITY_ENV_KEYS.service],
      DEFAULT_OBSERVABILITY_CONFIG.service,
    ),
    version: parseText(
      values[OBSERVABILITY_ENV_KEYS.version],
      DEFAULT_OBSERVABILITY_CONFIG.version,
    ),
    site: parseText(values[OBSERVABILITY_ENV_KEYS.site], DEFAULT_OBSERVABILITY_CONFIG.site),
    rumApplicationId: parseText(
      values[OBSERVABILITY_ENV_KEYS.rumApplicationId],
      DEFAULT_OBSERVABILITY_CONFIG.rumApplicationId,
    ),
    rumClientToken: parseText(
      values[OBSERVABILITY_ENV_KEYS.rumClientToken],
      DEFAULT_OBSERVABILITY_CONFIG.rumClientToken,
    ),
    rumSessionSampleRate: parseSampleRate(
      values[OBSERVABILITY_ENV_KEYS.rumSessionSampleRate],
      DEFAULT_OBSERVABILITY_CONFIG.rumSessionSampleRate,
    ),
    rumSessionReplaySampleRate: parseSampleRate(
      values[OBSERVABILITY_ENV_KEYS.rumSessionReplaySampleRate],
      DEFAULT_OBSERVABILITY_CONFIG.rumSessionReplaySampleRate,
    ),
    traceSampleRate: parseSampleRate(
      values[OBSERVABILITY_ENV_KEYS.traceSampleRate],
      DEFAULT_OBSERVABILITY_CONFIG.traceSampleRate,
    ),
  };
}

export function isRumConfigReady(config: ObservabilityConfig): boolean {
  return config.enabled && Boolean(config.rumApplicationId) && Boolean(config.rumClientToken);
}

function parseBoolean(value: string | undefined): boolean {
  return value === 'true' || value === '1';
}

function parseText(value: string | undefined, fallback: string): string {
  const normalizedValue = value?.trim();

  return normalizedValue ? normalizedValue : fallback;
}

function parseSampleRate(value: string | undefined, fallback: number): number {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    return fallback;
  }

  if (parsedValue < 0) {
    return 0;
  }

  if (parsedValue > 100) {
    return 100;
  }

  return parsedValue;
}
