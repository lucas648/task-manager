import { TestBed } from '@angular/core/testing';
import {
  AGENT_CONTRACT_VERSION,
  AgentGatewayConfig,
  AgentId,
  BoardRecommendationProvider,
  BoardRecommendationSummary,
  BoardTimeSummary,
  DEFAULT_AGENT_GATEWAY_CONFIG,
  Task,
  TaskPriority,
  TaskStatus,
} from '../models/task.model';
import { BOARD_RECOMMENDATION_PROVIDER } from './agent-provider.tokens';
import { AgentRunService } from './agent-run.service';
import { AGENT_GATEWAY_CONFIG, HttpBoardRecommendationProvider } from './agent-gateway.service';
import { AiRecommendationService } from './ai-recommendation.service';

const GENERATED_AT = new Date('2026-06-03T12:00:00.000Z');

function createTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-id',
    title: 'Task operacional',
    description: 'Detalhes da task',
    priority: TaskPriority.Medium,
    status: TaskStatus.Draft,
    category: 'Produto',
    tags: [],
    assignee: 'Lucas',
    acceptanceCriteria: ['Criterio validado'],
    createdAt: '2026-06-01T08:00:00.000Z',
    updatedAt: '2026-06-01T08:00:00.000Z',
    aiSuggestions: [],
    auditLogs: [],
    ...overrides,
  };
}

function createSummary(tasks: Task[]): BoardTimeSummary {
  return {
    generatedAt: GENERATED_AT.toISOString(),
    taskMetrics: tasks.map((task) => ({
      taskId: task.id,
      taskTitle: task.title,
      currentStatus: task.status,
      statusStartedAt: task.createdAt,
      currentAgeMinutes: 60,
      currentAgeLabel: '1 h',
      thresholdMinutes: 1440,
      isOverThreshold: false,
      durations: [],
    })),
    statusMetrics: [],
  };
}

function createProvider(): BoardRecommendationProvider {
  return {
    contract: {
      agentId: AgentId.BoardAdvisor,
      version: AGENT_CONTRACT_VERSION,
      provider: 'mock',
      purpose: 'Test provider',
      inputSchema: 'BoardRecommendationRequest',
      outputSchema: 'BoardRecommendationSummary',
    },
    recommend: vi.fn((request) => ({
      generatedAt: request.requestedAt,
      recommendations: [],
      total: request.tasks.length,
      infoCount: 0,
      warningCount: 0,
      criticalCount: 0,
    })),
  };
}

function createHttpProvider() {
  return {
    recommend: vi.fn(async (request): Promise<BoardRecommendationSummary> => {
      return {
        generatedAt: request.requestedAt,
        recommendations: [],
        total: 10,
        infoCount: 7,
        warningCount: 2,
        criticalCount: 1,
        agentRun: {
          agentId: AgentId.BoardAdvisor,
          contractVersion: request.contractVersion,
          provider: 'gateway',
          generatedAt: request.requestedAt,
        },
      };
    }),
  };
}

function setupService(
  provider = createProvider(),
  gatewayConfig: AgentGatewayConfig = { ...DEFAULT_AGENT_GATEWAY_CONFIG, mode: 'mock' },
  httpProvider = createHttpProvider(),
  agentRunService = createAgentRunService(),
): { service: AiRecommendationService; agentRunService: ReturnType<typeof createAgentRunService> } {
  TestBed.configureTestingModule({
    providers: [
      AiRecommendationService,
      {
        provide: BOARD_RECOMMENDATION_PROVIDER,
        useValue: provider,
      },
      {
        provide: AGENT_GATEWAY_CONFIG,
        useValue: gatewayConfig,
      },
      {
        provide: AgentRunService,
        useValue: agentRunService,
      },
      {
        provide: HttpBoardRecommendationProvider,
        useValue: httpProvider,
      },
    ],
  });

  return {
    service: TestBed.inject(AiRecommendationService),
    agentRunService,
  };
}

function createAgentRunService() {
  return {
    queueRun: vi.fn(() => ({ id: 'run-id' })),
    startRun: vi.fn(),
    completeRun: vi.fn(),
    failRun: vi.fn(),
  };
}

describe('AiRecommendationService', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('delegates board recommendations to the configured provider', () => {
    const provider = createProvider();
    const tasks = [createTask()];
    const boardTime = createSummary(tasks);

    const summary = setupService(provider).service.recommend(tasks, boardTime);

    expect(provider.recommend).toHaveBeenCalledWith({
      tasks,
      boardTime,
      requestedAt: GENERATED_AT.toISOString(),
      contractVersion: AGENT_CONTRACT_VERSION,
    });
    expect(summary).toMatchObject({
      generatedAt: GENERATED_AT.toISOString(),
      total: 1,
    });
  });

  it('uses the explicit generation date when provided', () => {
    const provider = createProvider();
    const explicitDate = new Date('2026-06-03T15:30:00.000Z');
    const tasks = [createTask()];
    const boardTime = createSummary(tasks);

    setupService(provider).service.recommend(tasks, boardTime, explicitDate);

    expect(provider.recommend).toHaveBeenCalledWith(
      expect.objectContaining({
        requestedAt: explicitDate.toISOString(),
      }),
    );
  });

  it('uses the mock provider for async recommendations when mock mode is active', async () => {
    const provider = createProvider();
    const httpProvider = createHttpProvider();
    const tasks = [createTask()];
    const boardTime = createSummary(tasks);
    const { service, agentRunService } = setupService(
      provider,
      { ...DEFAULT_AGENT_GATEWAY_CONFIG, mode: 'mock' },
      httpProvider,
    );
    const summary = await service.recommendAsync(tasks, boardTime);

    expect(provider.recommend).toHaveBeenCalledOnce();
    expect(httpProvider.recommend).not.toHaveBeenCalled();
    expect(summary.total).toBe(1);
    expect(agentRunService.queueRun).toHaveBeenCalledWith(
      {
        agentId: AgentId.BoardAdvisor,
        operation: 'board_recommendation',
        provider: 'mock',
        inputSummary: '1 tasks analisadas',
      },
      GENERATED_AT.toISOString(),
    );
    expect(agentRunService.startRun).toHaveBeenCalledWith('run-id', GENERATED_AT.toISOString());
    expect(agentRunService.completeRun).toHaveBeenCalledWith(
      'run-id',
      {
        provider: undefined,
        outputSummary: '1 recomendacoes',
        outputCount: 1,
        fallbackReason: undefined,
      },
      GENERATED_AT.toISOString(),
    );
  });

  it('uses the gateway provider for async recommendations when HTTP mode is active', async () => {
    const provider = createProvider();
    const httpProvider = createHttpProvider();
    const tasks = [createTask()];
    const boardTime = createSummary(tasks);
    const { service, agentRunService } = setupService(
      provider,
      { ...DEFAULT_AGENT_GATEWAY_CONFIG, mode: 'http' },
      httpProvider,
    );
    const summary = await service.recommendAsync(tasks, boardTime);

    expect(httpProvider.recommend).toHaveBeenCalledWith({
      tasks,
      boardTime,
      requestedAt: GENERATED_AT.toISOString(),
      contractVersion: AGENT_CONTRACT_VERSION,
    });
    expect(provider.recommend).not.toHaveBeenCalled();
    expect(summary).toMatchObject({
      total: 10,
      agentRun: {
        provider: 'gateway',
      },
    });
    expect(agentRunService.completeRun).toHaveBeenCalledWith(
      'run-id',
      expect.objectContaining({
        provider: 'gateway',
        outputSummary: '10 recomendacoes',
      }),
      GENERATED_AT.toISOString(),
    );
  });

  it('falls back to mock recommendations when the gateway fails', async () => {
    const provider = createProvider();
    const httpProvider = {
      recommend: vi.fn(async () => {
        throw new Error('gateway indisponivel');
      }),
    };
    const tasks = [createTask()];
    const boardTime = createSummary(tasks);
    const { service, agentRunService } = setupService(
      provider,
      { ...DEFAULT_AGENT_GATEWAY_CONFIG, mode: 'http' },
      httpProvider,
    );
    const summary = await service.recommendAsync(tasks, boardTime);

    expect(provider.recommend).toHaveBeenCalledOnce();
    expect(summary).toMatchObject({
      total: 1,
      agentRun: {
        agentId: AgentId.BoardAdvisor,
        contractVersion: AGENT_CONTRACT_VERSION,
        provider: 'mock',
        generatedAt: GENERATED_AT.toISOString(),
        fallbackReason: 'Fallback mockado apos falha do gateway: Error: gateway indisponivel',
      },
    });
    expect(agentRunService.completeRun).toHaveBeenCalledWith(
      'run-id',
      expect.objectContaining({
        provider: 'mock',
        fallbackReason: 'Fallback mockado apos falha do gateway: Error: gateway indisponivel',
      }),
      GENERATED_AT.toISOString(),
    );
  });

  it('marks board recommendation runs as failed when the provider throws', async () => {
    const provider = {
      ...createProvider(),
      recommend: vi.fn(() => {
        throw new Error('provider falhou');
      }),
    };
    const tasks = [createTask()];
    const boardTime = createSummary(tasks);
    const { service, agentRunService } = setupService(provider);

    await expect(service.recommendAsync(tasks, boardTime)).rejects.toThrow('provider falhou');

    expect(agentRunService.failRun).toHaveBeenCalledWith(
      'run-id',
      'provider falhou',
      GENERATED_AT.toISOString(),
    );
  });

  it('marks board recommendation runs as failed with a generic message for non-error failures', async () => {
    const provider = {
      ...createProvider(),
      recommend: vi.fn(() => {
        throw 'falha sem Error';
      }),
    };
    const tasks = [createTask()];
    const boardTime = createSummary(tasks);
    const { service, agentRunService } = setupService(provider);

    await expect(service.recommendAsync(tasks, boardTime)).rejects.toBe('falha sem Error');

    expect(agentRunService.failRun).toHaveBeenCalledWith(
      'run-id',
      'Nao foi possivel recomendar acoes do board.',
      GENERATED_AT.toISOString(),
    );
  });
});
