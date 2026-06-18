import { TestBed } from '@angular/core/testing';
import {
  AGENT_CONTRACT_VERSION,
  AgentId,
  AiReviewResult,
  ChaosScenarioId,
  Task,
  TaskAnalysisProvider,
  TaskPriority,
  TaskStatus,
} from '../models/task.model';
import { TASK_ANALYSIS_PROVIDER } from './agent-provider.tokens';
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
        provide: ChaosService,
        useValue: {
          isEnabled: vi.fn((scenarioId: ChaosScenarioId) => enabled.has(scenarioId)),
        },
      },
    ],
  });

  return TestBed.inject(AiReviewService);
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

  it('delegates review to the configured task analysis provider', () => {
    const provider = createTaskAnalysisProvider();
    const task = reviewTask();
    const review = setupService([], provider).review(task, REVIEWED_AT);

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

  it('forwards the slow AI chaos context to the provider', () => {
    const provider = createTaskAnalysisProvider();
    const review = setupService(['ai_slow'], provider).review(reviewTask(), REVIEWED_AT);

    expect(provider.analyze).toHaveBeenCalledWith(
      expect.objectContaining({
        context: {
          includeSlowAiWarning: true,
        },
      }),
    );
    expect(review.summary).toBe('slow analysis');
  });

  it('throws controlled errors for blocking AI chaos scenarios before provider execution', () => {
    const provider = createTaskAnalysisProvider();

    expect(() =>
      setupService(['network_loss'], provider).review(reviewTask(), REVIEWED_AT),
    ).toThrow('Perda de conexao simulada durante revisao da IA.');

    TestBed.resetTestingModule();
    expect(() =>
      setupService(['ai_unavailable'], provider).review(reviewTask(), REVIEWED_AT),
    ).toThrow('IA fora do ar no cenario de caos.');

    TestBed.resetTestingModule();
    expect(() =>
      setupService(['ai_invalid_response'], provider).review(reviewTask(), REVIEWED_AT),
    ).toThrow('Resposta invalida da IA no cenario de caos.');

    expect(provider.analyze).not.toHaveBeenCalled();
  });
});
