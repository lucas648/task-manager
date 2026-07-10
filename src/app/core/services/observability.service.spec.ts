import { TestBed } from '@angular/core/testing';
import { AgentId, TaskPriority, TaskStatus } from '../models/task.model';
import { DEFAULT_OBSERVABILITY_CONFIG, ObservabilityConfig } from '../models/observability.model';
import { OBSERVABILITY_CONFIG, ObservabilityService } from './observability.service';

const ENABLED_CONFIG: ObservabilityConfig = {
  enabled: true,
  env: 'Production',
  service: 'TaskFlow Web',
  version: '1.2.3',
  site: 'datadoghq.com',
  rumApplicationId: 'rum-app-id',
  rumClientToken: 'rum-client-token',
  rumSessionSampleRate: 80,
  rumSessionReplaySampleRate: 10,
  traceSampleRate: 50,
};

function setupService(config = ENABLED_CONFIG): ObservabilityService {
  TestBed.configureTestingModule({
    providers: [
      ObservabilityService,
      {
        provide: OBSERVABILITY_CONFIG,
        useValue: config,
      },
    ],
  });

  return TestBed.inject(ObservabilityService);
}

describe('ObservabilityService', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('uses the default config from the root injection token', () => {
    TestBed.configureTestingModule({
      providers: [ObservabilityService],
    });

    const service = TestBed.inject(ObservabilityService);

    expect(service.config()).toEqual(DEFAULT_OBSERVABILITY_CONFIG);
    expect(service.rumReady()).toBe(false);
  });

  it('exposes config, base tags, and RUM readiness', () => {
    const service = setupService();

    expect(service.config()).toEqual(ENABLED_CONFIG);
    expect(service.rumReady()).toBe(true);
    expect(service.baseTags()).toEqual([
      'env:production',
      'service:taskflow_web',
      'version:1.2.3',
      'app:taskflow-ai',
      'component:web',
    ]);

    service.setConfig(DEFAULT_OBSERVABILITY_CONFIG);

    expect(service.rumReady()).toBe(false);
    expect(service.baseTags()).toEqual([
      'env:local',
      'service:taskflow-ai',
      'version:dev',
      'app:taskflow-ai',
      'component:web',
    ]);
  });

  it('builds normalized low-cardinality Datadog tags from context', () => {
    const service = setupService();

    expect(
      service.buildTags({
        component: 'server',
        feature: 'ai',
        operation: 'agent_run',
        taskStatus: TaskStatus.AiReviewed,
        taskPriority: TaskPriority.Urgent,
        agentId: AgentId.InitialTaskAnalysis,
        agentProvider: 'openai',
        agentOperation: 'task_review',
        runStatus: 'completed',
        fallback: true,
      }),
    ).toEqual([
      'env:production',
      'service:taskflow_web',
      'version:1.2.3',
      'app:taskflow-ai',
      'component:server',
      'feature:ai',
      'operation:agent_run',
      'task_status:ai_reviewed',
      'task_priority:urgent',
      'agent_id:initial_task_analysis_agent',
      'agent_provider:openai',
      'agent_operation:task_review',
      'run_status:completed',
      'fallback:true',
    ]);
  });

  it('tracks events with tags and high-cardinality values as attributes', () => {
    const service = setupService();
    const event = service.trackEvent(
      'agent.run_completed',
      {
        feature: 'ai',
        operation: 'agent_run',
        agentId: AgentId.BoardAdvisor,
        agentProvider: 'gateway',
        agentOperation: 'board_recommendation',
        runStatus: 'completed',
        fallback: false,
        correlationId: 'corr-123',
        taskId: 'task-123',
        userId: 'user-123',
        agentRunId: 'run-123',
        attributes: {
          duration_ms: 1234,
          empty_value: '',
          ignored_value: undefined,
          successful: true,
        },
      },
      '2026-07-10T12:00:00.000Z',
    );

    expect(event).toEqual({
      name: 'agent.run_completed',
      timestamp: '2026-07-10T12:00:00.000Z',
      tags: [
        'env:production',
        'service:taskflow_web',
        'version:1.2.3',
        'app:taskflow-ai',
        'component:web',
        'feature:ai',
        'operation:agent_run',
        'agent_id:board_advisor_agent',
        'agent_provider:gateway',
        'agent_operation:board_recommendation',
        'run_status:completed',
        'fallback:false',
      ],
      attributes: {
        duration_ms: 1234,
        successful: true,
        correlation_id: 'corr-123',
        task_id: 'task-123',
        user_id: 'user-123',
        agent_run_id: 'run-123',
      },
    });
    expect(service.events()).toEqual([event]);

    service.clearEvents();

    expect(service.events()).toEqual([]);
  });

  it('keeps event attributes empty when optional high-cardinality values are absent', () => {
    const service = setupService(DEFAULT_OBSERVABILITY_CONFIG);

    expect(service.trackEvent('task.created').attributes).toEqual({});
  });
});
