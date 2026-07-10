import { AgentId, TaskPriority, TaskStatus } from './task.model';
import {
  DEFAULT_OBSERVABILITY_CONFIG,
  isRumConfigReady,
  OBSERVABILITY_ATTRIBUTE_KEYS,
  OBSERVABILITY_ENV_KEYS,
  OBSERVABILITY_TAG_KEYS,
  ObservabilityEvent,
  ObservabilityEventContext,
  ObservabilityTagContext,
  resolveObservabilityConfig,
  TASKFLOW_APP_TAG,
} from './observability.model';

describe('observability models', () => {
  it('defines Datadog env keys, tag keys, attributes, and default config', () => {
    expect(OBSERVABILITY_ENV_KEYS).toEqual({
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
    });
    expect(OBSERVABILITY_TAG_KEYS).toEqual({
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
    });
    expect(OBSERVABILITY_ATTRIBUTE_KEYS).toEqual({
      correlationId: 'correlation_id',
      taskId: 'task_id',
      userId: 'user_id',
      agentRunId: 'agent_run_id',
    });
    expect(TASKFLOW_APP_TAG).toBe('taskflow-ai');
    expect(DEFAULT_OBSERVABILITY_CONFIG).toEqual({
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
    });
  });

  it('resolves enabled Datadog config from env-like values', () => {
    const config = resolveObservabilityConfig({
      DATADOG_ENABLED: 'true',
      DD_ENV: 'prod',
      DD_SERVICE: 'taskflow-web',
      DD_VERSION: '1.2.3',
      DD_SITE: 'datadoghq.eu',
      DD_RUM_APPLICATION_ID: 'rum-app-id',
      DD_RUM_CLIENT_TOKEN: 'rum-client-token',
      DD_RUM_SESSION_SAMPLE_RATE: '75',
      DD_RUM_REPLAY_SAMPLE_RATE: '25',
      DD_TRACE_SAMPLE_RATE: '50',
    });

    expect(config).toEqual({
      enabled: true,
      env: 'prod',
      service: 'taskflow-web',
      version: '1.2.3',
      site: 'datadoghq.eu',
      rumApplicationId: 'rum-app-id',
      rumClientToken: 'rum-client-token',
      rumSessionSampleRate: 75,
      rumSessionReplaySampleRate: 25,
      traceSampleRate: 50,
    });
    expect(isRumConfigReady(config)).toBe(true);
  });

  it('falls back, trims text values, accepts numeric enabled, and clamps sample rates', () => {
    const config = resolveObservabilityConfig({
      DATADOG_ENABLED: '1',
      DD_ENV: '  staging  ',
      DD_SERVICE: '   ',
      DD_RUM_SESSION_SAMPLE_RATE: '120',
      DD_RUM_REPLAY_SAMPLE_RATE: '-10',
      DD_TRACE_SAMPLE_RATE: 'invalid',
    });

    expect(config).toEqual({
      ...DEFAULT_OBSERVABILITY_CONFIG,
      enabled: true,
      env: 'staging',
      rumSessionSampleRate: 100,
      rumSessionReplaySampleRate: 0,
      traceSampleRate: 100,
    });
    expect(isRumConfigReady(config)).toBe(false);
  });

  it('types the supported tag and event contexts', () => {
    const tagContext: ObservabilityTagContext = {
      component: 'server',
      feature: 'ai',
      operation: 'agent_run',
      taskStatus: TaskStatus.AiReviewed,
      taskPriority: TaskPriority.High,
      agentId: AgentId.InitialTaskAnalysis,
      agentProvider: 'openai',
      agentOperation: 'task_review',
      runStatus: 'completed',
      fallback: false,
    };
    const eventContext: ObservabilityEventContext = {
      ...tagContext,
      correlationId: 'correlation-id',
      taskId: 'task-id',
      userId: 'user-id',
      agentRunId: 'agent-run-id',
      attributes: {
        duration_ms: 1200,
      },
    };
    const event: ObservabilityEvent = {
      name: 'agent.run_completed',
      timestamp: '2026-07-10T10:00:00.000Z',
      tags: ['feature:ai'],
      attributes: {
        correlation_id: 'correlation-id',
      },
    };

    expect(tagContext.feature).toBe('ai');
    expect(eventContext.attributes?.['duration_ms']).toBe(1200);
    expect(event.name).toBe('agent.run_completed');
  });
});
