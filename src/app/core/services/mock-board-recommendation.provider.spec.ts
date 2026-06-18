import {
  AGENT_CONTRACT_VERSION,
  AGENT_PROMPT_CONTRACTS,
  AgentId,
  BoardRecommendationSeverity,
  BoardRecommendationType,
  BoardTimeSummary,
  Task,
  TaskPriority,
  TaskStatus,
} from '../models/task.model';
import { MockBoardRecommendationProvider } from './mock-board-recommendation.provider';

const GENERATED_AT = new Date('2026-06-03T12:00:00.000Z');
const AGENT_RUN = {
  agentId: AgentId.BoardAdvisor,
  contractVersion: AGENT_CONTRACT_VERSION,
  provider: 'mock',
  generatedAt: GENERATED_AT.toISOString(),
};

function createTask(overrides: Partial<Task>): Task {
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

function createSummary(tasks: Task[], overThresholdIds: string[]): BoardTimeSummary {
  return {
    generatedAt: GENERATED_AT.toISOString(),
    taskMetrics: tasks.map((task) => ({
      taskId: task.id,
      taskTitle: task.title,
      currentStatus: task.status,
      statusStartedAt: task.createdAt,
      currentAgeMinutes: overThresholdIds.includes(task.id) ? 1800 : 60,
      currentAgeLabel: overThresholdIds.includes(task.id) ? '1 d' : '1 h',
      thresholdMinutes: 1440,
      isOverThreshold: overThresholdIds.includes(task.id),
      durations: [],
    })),
    statusMetrics: [],
  };
}

function createRequest(tasks: Task[], boardTime = createSummary(tasks, [])) {
  return {
    tasks,
    boardTime,
    requestedAt: GENERATED_AT.toISOString(),
    contractVersion: AGENT_CONTRACT_VERSION,
  };
}

describe('MockBoardRecommendationProvider', () => {
  const provider = new MockBoardRecommendationProvider();

  it('exposes the board advisor contract', () => {
    expect(provider.contract).toEqual(AGENT_PROMPT_CONTRACTS[AgentId.BoardAdvisor]);
  });

  it('recommends operational actions for stalled and incomplete tasks', () => {
    const tasks = [
      createTask({
        id: 'draft',
        title: 'Draft parado',
        status: TaskStatus.Draft,
      }),
      createTask({
        id: 'progress',
        title: 'Execucao bloqueada',
        status: TaskStatus.InProgress,
        priority: TaskPriority.Urgent,
        assignee: undefined,
        acceptanceCriteria: [],
      }),
    ];
    const summary = provider.recommend(
      createRequest(tasks, createSummary(tasks, ['draft', 'progress'])),
    );

    expect(summary).toMatchObject({
      generatedAt: GENERATED_AT.toISOString(),
      total: 5,
      infoCount: 0,
      warningCount: 3,
      criticalCount: 2,
      agentRun: AGENT_RUN,
    });
    expect(summary.recommendations.map((recommendation) => recommendation.type)).toEqual([
      BoardRecommendationType.ReviewTask,
      BoardRecommendationType.SplitTask,
      BoardRecommendationType.AssignOwner,
      BoardRecommendationType.AddAcceptanceCriteria,
      BoardRecommendationType.UpdatePriority,
    ]);
    expect(summary.recommendations[0]).toMatchObject({
      id: 'draft-review_task',
      taskId: 'draft',
      taskTitle: 'Draft parado',
      severity: BoardRecommendationSeverity.Warning,
      title: 'Revisar task com IA',
      relatedMetricLabel: '1 d',
      currentStatus: TaskStatus.Draft,
      createdAt: GENERATED_AT.toISOString(),
    });
    expect(summary.recommendations[2]).toMatchObject({
      id: 'progress-assign_owner',
      severity: BoardRecommendationSeverity.Warning,
      title: 'Definir responsavel',
    });
    expect(summary.recommendations[4]).toMatchObject({
      id: 'progress-update_priority',
      severity: BoardRecommendationSeverity.Critical,
      suggestedAction: 'Levar para o rito de prioridade e definir a proxima acao imediatamente.',
    });
  });

  it('recommends moving approved and published tasks that exceed board limits', () => {
    const tasks = [
      createTask({
        id: 'approved',
        title: 'Aprovada parada',
        status: TaskStatus.Approved,
      }),
      createTask({
        id: 'published',
        title: 'Publicada parada',
        status: TaskStatus.Published,
      }),
    ];
    const summary = provider.recommend(
      createRequest(tasks, createSummary(tasks, ['approved', 'published'])),
    );

    expect(summary.recommendations).toHaveLength(2);
    expect(summary.recommendations).toEqual([
      expect.objectContaining({
        id: 'approved-move_task',
        type: BoardRecommendationType.MoveTask,
        reason: 'A task esta em Approved ha 1 d.',
      }),
      expect.objectContaining({
        id: 'published-move_task',
        type: BoardRecommendationType.MoveTask,
        reason: 'A task esta em Published ha 1 d.',
      }),
    ]);
  });

  it('recommends human decisions and exception review for reviewed, rejected, and error tasks', () => {
    const tasks = [
      createTask({
        id: 'reviewed',
        title: 'Revisada parada',
        status: TaskStatus.AiReviewed,
      }),
      createTask({
        id: 'rejected',
        title: 'Rejeitada parada',
        status: TaskStatus.Rejected,
      }),
      createTask({
        id: 'error',
        title: 'Erro parado',
        status: TaskStatus.Error,
      }),
    ];
    const summary = provider.recommend(
      createRequest(tasks, createSummary(tasks, ['reviewed', 'rejected', 'error'])),
    );

    expect(summary.recommendations).toEqual([
      expect.objectContaining({
        id: 'reviewed-review_task',
        severity: BoardRecommendationSeverity.Warning,
        title: 'Concluir decisao humana',
      }),
      expect.objectContaining({
        id: 'rejected-review_task',
        severity: BoardRecommendationSeverity.Critical,
        reason: 'A task esta em Rejected ha 1 d.',
      }),
      expect.objectContaining({
        id: 'error-review_task',
        severity: BoardRecommendationSeverity.Critical,
        reason: 'A task esta em Error ha 1 d.',
      }),
    ]);
  });

  it('recommends light owner follow-up without board-time metrics', () => {
    const task = createTask({
      id: 'unassigned',
      title: 'Sem owner',
      assignee: undefined,
    });
    const summary = provider.recommend(
      createRequest([task], {
        generatedAt: GENERATED_AT.toISOString(),
        taskMetrics: [],
        statusMetrics: [],
      }),
    );

    expect(summary).toMatchObject({
      total: 1,
      infoCount: 1,
      warningCount: 0,
      criticalCount: 0,
      agentRun: AGENT_RUN,
    });
    expect(summary.recommendations[0]).toMatchObject({
      id: 'unassigned-assign_owner',
      severity: BoardRecommendationSeverity.Info,
      reason: 'A task ainda nao tem responsavel definido.',
    });
  });

  it('skips completed and healthy tasks', () => {
    const tasks = [
      createTask({
        id: 'completed',
        status: TaskStatus.Completed,
        assignee: undefined,
        acceptanceCriteria: [],
      }),
      createTask({
        id: 'healthy',
        status: TaskStatus.InProgress,
      }),
    ];
    const summary = provider.recommend(createRequest(tasks, createSummary(tasks, [])));

    expect(summary).toEqual({
      generatedAt: GENERATED_AT.toISOString(),
      recommendations: [],
      total: 0,
      infoCount: 0,
      warningCount: 0,
      criticalCount: 0,
      agentRun: AGENT_RUN,
    });
  });

  it('ignores unexpected task statuses without creating unsafe recommendations', () => {
    const task = createTask({
      id: 'unexpected',
      status: 'archived' as TaskStatus,
    });
    const summary = provider.recommend(
      createRequest([task], createSummary([task], ['unexpected'])),
    );

    expect(summary).toEqual({
      generatedAt: GENERATED_AT.toISOString(),
      recommendations: [],
      total: 0,
      infoCount: 0,
      warningCount: 0,
      criticalCount: 0,
      agentRun: AGENT_RUN,
    });
  });
});
