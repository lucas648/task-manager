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
import { AgentRunService } from './agent-run.service';
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
  agentRunService = createAgentRunService(),
): { service: AiReviewService; agentRunService: ReturnType<typeof createAgentRunService> } {
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
        provide: AgentRunService,
        useValue: agentRunService,
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

  return {
    service: TestBed.inject(AiReviewService),
    agentRunService,
  };
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

function createAgentRunService() {
  return {
    queueRun: vi.fn(() => ({ id: 'run-id' })),
    startRun: vi.fn(),
    completeRun: vi.fn(),
    failRun: vi.fn(),
  };
}

describe('AiReviewService', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('delegates review to the configured mock task analysis provider', async () => {
    const provider = createTaskAnalysisProvider();
    const task = reviewTask();
    const { service, agentRunService } = setupService([], provider);
    const review = await service.review(task, REVIEWED_AT);

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
    expect(agentRunService.queueRun).toHaveBeenCalledWith(
      {
        agentId: AgentId.InitialTaskAnalysis,
        operation: 'task_review',
        provider: 'mock',
        taskId: task.id,
        taskTitle: task.title,
        inputSummary: 'Revisar Bug',
      },
      REVIEWED_AT,
    );
    expect(agentRunService.startRun).toHaveBeenCalledWith('run-id', REVIEWED_AT);
    expect(agentRunService.completeRun).toHaveBeenCalledWith(
      'run-id',
      {
        provider: undefined,
        outputSummary: 'fast analysis',
        outputCount: 0,
        fallbackReason: undefined,
      },
      REVIEWED_AT,
    );
  });

  it('uses the gateway provider when HTTP mode is active', async () => {
    const provider = createTaskAnalysisProvider();
    const httpProvider = createHttpTaskAnalysisProvider();
    const task = reviewTask();
    const { service, agentRunService } = setupService(
      [],
      provider,
      { ...DEFAULT_AGENT_GATEWAY_CONFIG, mode: 'http' },
      httpProvider,
    );
    const review = await service.review(task, REVIEWED_AT);

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
    expect(agentRunService.queueRun).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'gateway',
      }),
      REVIEWED_AT,
    );
    expect(agentRunService.completeRun).toHaveBeenCalledWith(
      'run-id',
      expect.objectContaining({
        provider: 'gateway',
        outputSummary: 'gateway analysis',
      }),
      REVIEWED_AT,
    );
  });

  it('falls back to the mock provider when the gateway fails', async () => {
    const provider = createTaskAnalysisProvider();
    const httpProvider = {
      analyze: vi.fn(async () => {
        throw new Error('gateway indisponivel');
      }),
    };
    const { service, agentRunService } = setupService(
      [],
      provider,
      { ...DEFAULT_AGENT_GATEWAY_CONFIG, mode: 'http' },
      httpProvider,
    );
    const review = await service.review(reviewTask(), REVIEWED_AT);

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
    expect(agentRunService.completeRun).toHaveBeenCalledWith(
      'run-id',
      expect.objectContaining({
        provider: 'mock',
        fallbackReason: 'Fallback mockado apos falha do gateway: Error: gateway indisponivel',
      }),
      REVIEWED_AT,
    );
  });

  it('forwards the slow AI chaos context to the provider', async () => {
    const provider = createTaskAnalysisProvider();
    const review = await setupService(['ai_slow'], provider).service.review(
      reviewTask(),
      REVIEWED_AT,
    );

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
      setupService(['network_loss'], provider).service.review(reviewTask(), REVIEWED_AT),
    ).rejects.toThrow('Perda de conexao simulada durante revisao da IA.');

    TestBed.resetTestingModule();
    await expect(
      setupService(['ai_unavailable'], provider).service.review(reviewTask(), REVIEWED_AT),
    ).rejects.toThrow('IA fora do ar no cenario de caos.');

    TestBed.resetTestingModule();
    const { service, agentRunService } = setupService(['ai_invalid_response'], provider);
    await expect(service.review(reviewTask(), REVIEWED_AT)).rejects.toThrow(
      'Resposta invalida da IA no cenario de caos.',
    );

    expect(provider.analyze).not.toHaveBeenCalled();
    expect(agentRunService.failRun).toHaveBeenCalledWith(
      'run-id',
      'Resposta invalida da IA no cenario de caos.',
      REVIEWED_AT,
    );
  });

  it('marks runs as failed with a generic message for non-error provider failures', async () => {
    const provider = {
      ...createTaskAnalysisProvider(),
      analyze: vi.fn(() => {
        throw 'falha sem Error';
      }),
    };
    const { service, agentRunService } = setupService([], provider);

    await expect(service.review(reviewTask(), REVIEWED_AT)).rejects.toBe('falha sem Error');

    expect(agentRunService.failRun).toHaveBeenCalledWith(
      'run-id',
      'Nao foi possivel concluir a revisao da IA.',
      REVIEWED_AT,
    );
  });

  it('allows a direct mock review for synchronous consumers', () => {
    const provider = createTaskAnalysisProvider();
    const review = setupService([], provider).service.reviewWithMock(reviewTask(), REVIEWED_AT);

    expect(review.summary).toBe('fast analysis');
    expect(provider.analyze).toHaveBeenCalledOnce();
  });
});
