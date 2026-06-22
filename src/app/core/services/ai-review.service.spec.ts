import { TestBed } from '@angular/core/testing';
import {
  AGENT_CONTRACT_VERSION,
  AgentGatewayConfig,
  AgentId,
  AiReviewResult,
  ChaosScenarioId,
  DEFAULT_AGENT_GATEWAY_CONFIG,
  Task,
  TaskAnalysisProvider,
  TaskPriority,
  TaskStatus,
} from '../models/task.model';
import { TASK_ANALYSIS_PROVIDER } from './agent-provider.tokens';
import { AGENT_GATEWAY_CONFIG, HttpTaskAnalysisProvider } from './agent-gateway.service';
import { AiReviewService } from './ai-review.service';
import { ChaosService } from './chaos.service';

const REVIEWED_AT = '2026-06-02T12:00:00.000Z';

function reviewTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-id',
    title: 'Bug',
    description: 'Corrigir',
    priority: TaskPriority.High,
    status: TaskStatus.Draft,
    category: 'Produto',
    tags: [],
    acceptanceCriteria: [],
    createdAt: REVIEWED_AT,
    updatedAt: REVIEWED_AT,
    aiSuggestions: [],
    auditLogs: [],
    ...overrides,
  };
}

function setupService(
  enabledScenarios: ChaosScenarioId[] = [],
  provider: TaskAnalysisProvider = createTaskAnalysisProvider(),
  gatewayConfig: AgentGatewayConfig = { ...DEFAULT_AGENT_GATEWAY_CONFIG, mode: 'mock' },
  httpProvider = createHttpTaskAnalysisProvider(),
): AiReviewService {
  const enabled = new Set(enabledScenarios);

  TestBed.configureTestingModule({
    providers: [
      AiReviewService,
      {
        provide: TASK_ANALYSIS_PROVIDER,
        useValue: provider,
      },
      {
        provide: AGENT_GATEWAY_CONFIG,
        useValue: gatewayConfig,
      },
      {
        provide: HttpTaskAnalysisProvider,
        useValue: httpProvider,
      },
      {
        provide: ChaosService,
        useValue: {
          isEnabled: vi.fn((scenarioId: ChaosScenarioId) => enabled.has(scenarioId)),
        },
      },
    ],
  });

  return TestBed.inject(AiReviewService);
}

function createHttpTaskAnalysisProvider() {
  return {
    analyze: vi.fn(async (request): Promise<AiReviewResult> => {
      return {
        reviewedAt: request.requestedAt,
        summary: 'gateway analysis',
        suggestions: [],
        qualityScore: {
          score: 98,
          summary: 'gateway ok',
          warnings: [],
          evaluatedAt: request.requestedAt,
        },
        agentRun: {
          agentId: AgentId.InitialTaskAnalysis,
          contractVersion: request.contractVersion,
          provider: 'gateway',
          generatedAt: request.requestedAt,
        },
      };
    }),
  };
}

function createTaskAnalysisProvider(): TaskAnalysisProvider {
  return {
    contract: {
      agentId: AgentId.InitialTaskAnalysis,
      version: AGENT_CONTRACT_VERSION,
      provider: 'mock',
      purpose: 'Test provider',
      inputSchema: 'TaskAnalysisRequest',
      outputSchema: 'AiReviewResult',
    },
    analyze: vi.fn((request): AiReviewResult => {
      return {
        reviewedAt: request.requestedAt,
        summary: request.context.includeSlowAiWarning ? 'slow analysis' : 'fast analysis',
        suggestions: [],
        qualityScore: {
          score: request.context.includeSlowAiWarning ? 90 : 100,
          summary: 'ok',
          warnings: [],
          evaluatedAt: request.requestedAt,
        },
      };
    }),
  };
}

describe('AiReviewService', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('delegates review to the configured mock task analysis provider', async () => {
    const provider = createTaskAnalysisProvider();
    const task = reviewTask();
    const review = await setupService([], provider).review(task, REVIEWED_AT);

    expect(provider.analyze).toHaveBeenCalledWith({
      task,
      requestedAt: REVIEWED_AT,
      contractVersion: AGENT_CONTRACT_VERSION,
      context: {
        includeSlowAiWarning: false,
      },
    });
    expect(review).toMatchObject({
      reviewedAt: REVIEWED_AT,
      summary: 'fast analysis',
      qualityScore: {
        score: 100,
      },
    });
  });

  it('uses the gateway provider when HTTP mode is active', async () => {
    const provider = createTaskAnalysisProvider();
    const httpProvider = createHttpTaskAnalysisProvider();
    const task = reviewTask();
    const review = await setupService(
      [],
      provider,
      { ...DEFAULT_AGENT_GATEWAY_CONFIG, mode: 'http' },
      httpProvider,
    ).review(task, REVIEWED_AT);

    expect(httpProvider.analyze).toHaveBeenCalledWith({
      task,
      requestedAt: REVIEWED_AT,
      contractVersion: AGENT_CONTRACT_VERSION,
      context: {
        includeSlowAiWarning: false,
      },
    });
    expect(provider.analyze).not.toHaveBeenCalled();
    expect(review).toMatchObject({
      summary: 'gateway analysis',
      agentRun: {
        provider: 'gateway',
      },
    });
  });

  it('falls back to the mock provider when the gateway fails', async () => {
    const provider = createTaskAnalysisProvider();
    const httpProvider = {
      analyze: vi.fn(async () => {
        throw new Error('gateway indisponivel');
      }),
    };
    const review = await setupService(
      [],
      provider,
      { ...DEFAULT_AGENT_GATEWAY_CONFIG, mode: 'http' },
      httpProvider,
    ).review(reviewTask(), REVIEWED_AT);

    expect(provider.analyze).toHaveBeenCalledOnce();
    expect(review).toMatchObject({
      summary: 'fast analysis',
      agentRun: {
        agentId: AgentId.InitialTaskAnalysis,
        contractVersion: AGENT_CONTRACT_VERSION,
        provider: 'mock',
        generatedAt: REVIEWED_AT,
        fallbackReason: 'Fallback mockado apos falha do gateway: Error: gateway indisponivel',
      },
    });
  });

  it('forwards the slow AI chaos context to the provider', async () => {
    const provider = createTaskAnalysisProvider();
    const review = await setupService(['ai_slow'], provider).review(reviewTask(), REVIEWED_AT);

    expect(provider.analyze).toHaveBeenCalledWith(
      expect.objectContaining({
        context: {
          includeSlowAiWarning: true,
        },
      }),
    );
    expect(review.summary).toBe('slow analysis');
  });

  it('throws controlled errors for blocking AI chaos scenarios before provider execution', async () => {
    const provider = createTaskAnalysisProvider();

    await expect(
      setupService(['network_loss'], provider).review(reviewTask(), REVIEWED_AT),
    ).rejects.toThrow('Perda de conexao simulada durante revisao da IA.');

    TestBed.resetTestingModule();
    await expect(
      setupService(['ai_unavailable'], provider).review(reviewTask(), REVIEWED_AT),
    ).rejects.toThrow('IA fora do ar no cenario de caos.');

    TestBed.resetTestingModule();
    await expect(
      setupService(['ai_invalid_response'], provider).review(reviewTask(), REVIEWED_AT),
    ).rejects.toThrow('Resposta invalida da IA no cenario de caos.');

    expect(provider.analyze).not.toHaveBeenCalled();
  });

  it('allows a direct mock review for synchronous consumers', () => {
    const provider = createTaskAnalysisProvider();
    const review = setupService([], provider).reviewWithMock(reviewTask(), REVIEWED_AT);

    expect(review.summary).toBe('fast analysis');
    expect(provider.analyze).toHaveBeenCalledOnce();
  });
});
