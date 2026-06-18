import { TestBed } from '@angular/core/testing';
import {
  AGENT_CONTRACT_VERSION,
  AgentId,
  BoardRecommendationProvider,
  BoardTimeSummary,
  Task,
  TaskPriority,
  TaskStatus,
} from '../models/task.model';
import { BOARD_RECOMMENDATION_PROVIDER } from './agent-provider.tokens';
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

describe('AiRecommendationService', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('delegates board recommendations to the configured provider', () => {
    const provider = createProvider();
    const tasks = [createTask()];
    const boardTime = createSummary(tasks);
    TestBed.configureTestingModule({
      providers: [
        AiRecommendationService,
        {
          provide: BOARD_RECOMMENDATION_PROVIDER,
          useValue: provider,
        },
      ],
    });

    const summary = TestBed.inject(AiRecommendationService).recommend(tasks, boardTime);

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
    TestBed.configureTestingModule({
      providers: [
        AiRecommendationService,
        {
          provide: BOARD_RECOMMENDATION_PROVIDER,
          useValue: provider,
        },
      ],
    });

    TestBed.inject(AiRecommendationService).recommend(tasks, boardTime, explicitDate);

    expect(provider.recommend).toHaveBeenCalledWith(
      expect.objectContaining({
        requestedAt: explicitDate.toISOString(),
      }),
    );
  });
});
