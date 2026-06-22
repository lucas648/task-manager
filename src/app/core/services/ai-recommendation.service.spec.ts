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
): AiRecommendationService {
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
        provide: HttpBoardRecommendationProvider,
        useValue: httpProvider,
      },
    ],
  });

  return TestBed.inject(AiRecommendationService);
}

describe('AiRecommendationService', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('delegates board recommendations to the configured provider', () => {
    const provider = createProvider();
    const tasks = [createTask()];
    const boardTime = createSummary(tasks);

    const summary = setupService(provider).recommend(tasks, boardTime);

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

    setupService(provider).recommend(tasks, boardTime, explicitDate);

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
    const summary = await setupService(
      provider,
      { ...DEFAULT_AGENT_GATEWAY_CONFIG, mode: 'mock' },
      httpProvider,
    ).recommendAsync(tasks, boardTime);

    expect(provider.recommend).toHaveBeenCalledOnce();
    expect(httpProvider.recommend).not.toHaveBeenCalled();
    expect(summary.total).toBe(1);
  });

  it('uses the gateway provider for async recommendations when HTTP mode is active', async () => {
    const provider = createProvider();
    const httpProvider = createHttpProvider();
    const tasks = [createTask()];
    const boardTime = createSummary(tasks);
    const summary = await setupService(
      provider,
      { ...DEFAULT_AGENT_GATEWAY_CONFIG, mode: 'http' },
      httpProvider,
    ).recommendAsync(tasks, boardTime);

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
    const summary = await setupService(
      provider,
      { ...DEFAULT_AGENT_GATEWAY_CONFIG, mode: 'http' },
      httpProvider,
    ).recommendAsync(tasks, boardTime);

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
  });
});
