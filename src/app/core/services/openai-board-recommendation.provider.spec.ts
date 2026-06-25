import {
  AGENT_CONTRACT_VERSION,
  AgentId,
  BoardRecommendationSeverity,
  BoardRecommendationType,
  BoardTimeSummary,
  Task,
  TaskPriority,
  TaskStatus,
} from '../models/task.model';
import {
  OpenAiBoardRecommendationError,
  OpenAiBoardRecommendationProvider,
} from './openai-board-recommendation.provider';

const REQUESTED_AT = '2026-06-22T12:00:00.000Z';

const TASK: Task = {
  id: 'task-id',
  title: 'Revisar checkout',
  description: 'Validar o fluxo de checkout autenticado com pagamento e confirmacao final.',
  priority: TaskPriority.High,
  status: TaskStatus.InProgress,
  category: 'Produto',
  tags: ['checkout'],
  assignee: 'Lucas',
  dueDate: '2026-06-30',
  acceptanceCriteria: ['Pagamento aprovado.'],
  createdAt: '2026-06-20T12:00:00.000Z',
  updatedAt: REQUESTED_AT,
  aiSuggestions: [],
  auditLogs: [],
};

const SECOND_TASK: Task = {
  ...TASK,
  id: 'second-task-id',
  title: 'Publicar payload CMS',
  status: TaskStatus.Published,
  assignee: undefined,
  dueDate: undefined,
};

const BOARD_TIME: BoardTimeSummary = {
  generatedAt: REQUESTED_AT,
  taskMetrics: [
    {
      taskId: TASK.id,
      taskTitle: TASK.title,
      currentStatus: TASK.status,
      statusStartedAt: TASK.createdAt,
      currentAgeMinutes: 2880,
      currentAgeLabel: '2 d',
      thresholdMinutes: 4320,
      isOverThreshold: false,
      durations: [],
    },
    {
      taskId: SECOND_TASK.id,
      taskTitle: SECOND_TASK.title,
      currentStatus: SECOND_TASK.status,
      statusStartedAt: SECOND_TASK.createdAt,
      currentAgeMinutes: 600,
      currentAgeLabel: '10 h',
      thresholdMinutes: 480,
      isOverThreshold: true,
      durations: [],
    },
  ],
  statusMetrics: [],
};

const REQUEST = {
  tasks: [TASK, SECOND_TASK],
  boardTime: BOARD_TIME,
  requestedAt: REQUESTED_AT,
  contractVersion: AGENT_CONTRACT_VERSION,
};

function createProvider(fetchImpl = vi.fn(), apiKey = 'test-key') {
  return new OpenAiBoardRecommendationProvider({
    apiKey,
    endpoint: 'https://api.openai.test/v1/responses',
    fetchImpl: fetchImpl as typeof fetch,
    model: 'gpt-test',
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  });
}

function payload(overrides: Record<string, unknown> = {}) {
  return {
    recommendations: [
      {
        taskId: TASK.id,
        type: BoardRecommendationType.AssignOwner,
        severity: BoardRecommendationSeverity.Info,
        title: 'Confirmar responsavel',
        reason: 'A task deve manter owner explicito durante a execucao.',
        suggestedAction: 'Validar se Lucas segue como responsavel.',
        relatedMetricLabel: '',
      },
      {
        taskId: TASK.id,
        type: BoardRecommendationType.SplitTask,
        severity: BoardRecommendationSeverity.Critical,
        title: 'Quebrar escopo em entregas menores',
        reason: 'A task esta ativa ha tempo relevante para o board.',
        suggestedAction: 'Separar validacao de pagamento e confirmacao final.',
        relatedMetricLabel: '2 d',
      },
      {
        taskId: SECOND_TASK.id,
        type: BoardRecommendationType.MoveTask,
        severity: BoardRecommendationSeverity.Warning,
        title: 'Mover payload para execucao',
        reason: 'A task publicada esta acima do limite da baia.',
        suggestedAction: 'Confirmar envio e mover para In Progress.',
        relatedMetricLabel: '10 h',
      },
    ],
    ...overrides,
  };
}

describe('OpenAiBoardRecommendationProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls the OpenAI Responses API and maps structured output to board recommendations', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        output_text: JSON.stringify(payload()),
      }),
    );
    const provider = createProvider(fetchImpl);

    await expect(provider.recommend(REQUEST)).resolves.toEqual({
      generatedAt: REQUESTED_AT,
      recommendations: [
        {
          id: 'task-id-assign_owner-openai-recommendation-1',
          taskId: TASK.id,
          taskTitle: TASK.title,
          type: BoardRecommendationType.AssignOwner,
          severity: BoardRecommendationSeverity.Info,
          title: 'Confirmar responsavel',
          reason: 'A task deve manter owner explicito durante a execucao.',
          suggestedAction: 'Validar se Lucas segue como responsavel.',
          currentStatus: TaskStatus.InProgress,
          createdAt: REQUESTED_AT,
          relatedMetricLabel: '',
        },
        {
          id: 'task-id-split_task-openai-recommendation-2',
          taskId: TASK.id,
          taskTitle: TASK.title,
          type: BoardRecommendationType.SplitTask,
          severity: BoardRecommendationSeverity.Critical,
          title: 'Quebrar escopo em entregas menores',
          reason: 'A task esta ativa ha tempo relevante para o board.',
          suggestedAction: 'Separar validacao de pagamento e confirmacao final.',
          currentStatus: TaskStatus.InProgress,
          createdAt: REQUESTED_AT,
          relatedMetricLabel: '2 d',
        },
        {
          id: 'second-task-id-move_task-openai-recommendation-3',
          taskId: SECOND_TASK.id,
          taskTitle: SECOND_TASK.title,
          type: BoardRecommendationType.MoveTask,
          severity: BoardRecommendationSeverity.Warning,
          title: 'Mover payload para execucao',
          reason: 'A task publicada esta acima do limite da baia.',
          suggestedAction: 'Confirmar envio e mover para In Progress.',
          currentStatus: TaskStatus.Published,
          createdAt: REQUESTED_AT,
          relatedMetricLabel: '10 h',
        },
      ],
      total: 3,
      infoCount: 1,
      warningCount: 1,
      criticalCount: 1,
      agentRun: {
        agentId: AgentId.BoardAdvisor,
        contractVersion: AGENT_CONTRACT_VERSION,
        provider: 'openai',
        generatedAt: REQUESTED_AT,
      },
    });
    expect(fetchImpl).toHaveBeenCalledWith('https://api.openai.test/v1/responses', {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-key',
        'content-type': 'application/json',
      },
      body: expect.any(String),
    });
    const firstCall = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(firstCall[1].body as string);
    const serializedInput = JSON.parse(body.input[0].content[0].text);

    expect(body).toMatchObject({
      model: 'gpt-test',
      text: {
        format: {
          type: 'json_schema',
          name: 'taskflow_board_recommendations',
          strict: true,
        },
      },
    });
    expect(serializedInput).toMatchObject({
      contractVersion: AGENT_CONTRACT_VERSION,
      requestedAt: REQUESTED_AT,
      tasks: [
        expect.objectContaining({ id: TASK.id, title: TASK.title }),
        expect.objectContaining({
          id: SECOND_TASK.id,
          title: SECOND_TASK.title,
        }),
      ],
      boardTime: BOARD_TIME,
    });
    expect(provider.contract.provider).toBe('openai');
    expect(provider.isConfigured()).toBe(true);
  });

  it('reads OpenAI config from environment defaults', async () => {
    vi.stubGlobal('process', {
      env: {
        OPENAI_API_KEY: 'env-key',
        OPENAI_MODEL: 'gpt-env',
      },
    });
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        output_text: JSON.stringify(payload({ recommendations: [] })),
      }),
    );
    const provider = new OpenAiBoardRecommendationProvider({
      endpoint: 'https://api.openai.test/v1/responses',
      fetchImpl: fetchImpl as typeof fetch,
    });

    await provider.recommend(REQUEST);

    const firstCall = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(firstCall[1].body as string);
    expect(firstCall[1].headers).toMatchObject({
      authorization: 'Bearer env-key',
    });
    expect(body.model).toBe('gpt-env');
  });

  it('uses global fetch and default model when options are omitted', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        output_text: JSON.stringify(payload({ recommendations: [] })),
      }),
    );
    vi.stubGlobal('fetch', fetchImpl);
    vi.stubGlobal('process', {
      env: {
        OPENAI_API_KEY: 'env-key',
      },
    });
    const provider = new OpenAiBoardRecommendationProvider();

    await provider.recommend(REQUEST);

    const firstCall = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(firstCall[1].body as string);
    expect(firstCall[0]).toBe('https://api.openai.com/v1/responses');
    expect(body.model).toBe('gpt-5.5');
  });

  it('handles a missing process global as empty OpenAI config', async () => {
    vi.stubGlobal('process', undefined);
    vi.stubGlobal('fetch', vi.fn());
    const provider = new OpenAiBoardRecommendationProvider();

    await expect(provider.recommend(REQUEST)).rejects.toThrow(
      new OpenAiBoardRecommendationError('OPENAI_API_KEY nao configurada.'),
    );
    expect(provider.isConfigured()).toBe(false);
  });

  it('extracts content from the Responses output array', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        output: [
          { content: [{ type: 'output_text', text: '' }] },
          {
            content: [
              {
                type: 'output_text',
                text: JSON.stringify(
                  payload({
                    recommendations: [
                      {
                        taskId: SECOND_TASK.id,
                        type: BoardRecommendationType.CompleteTask,
                        severity: BoardRecommendationSeverity.Info,
                        title: 'Concluir acompanhamento',
                        reason: 'Payload pronto para encerramento operacional.',
                        suggestedAction: 'Validar evidencias e concluir task.',
                        relatedMetricLabel: '',
                      },
                    ],
                  }),
                ),
              },
            ],
          },
        ],
      }),
    );
    const summary = await createProvider(fetchImpl).recommend(REQUEST);

    expect(summary.recommendations).toEqual([
      expect.objectContaining({
        taskId: SECOND_TASK.id,
        type: BoardRecommendationType.CompleteTask,
        currentStatus: TaskStatus.Published,
      }),
    ]);
  });

  it('rejects calls when the API key is missing', async () => {
    const provider = createProvider(vi.fn(), '');

    await expect(provider.recommend(REQUEST)).rejects.toThrow(
      new OpenAiBoardRecommendationError('OPENAI_API_KEY nao configurada.'),
    );
    expect(provider.isConfigured()).toBe(false);
  });

  it('wraps non-success OpenAI responses', async () => {
    const provider = createProvider(vi.fn(async () => jsonResponse({ error: 'rate_limit' }, 429)));

    await expect(provider.recommend(REQUEST)).rejects.toThrow(
      new OpenAiBoardRecommendationError('OpenAI retornou status 429.'),
    );
  });

  it('rejects invalid JSON output', async () => {
    const provider = createProvider(vi.fn(async () => jsonResponse({ output_text: '{' })));

    await expect(provider.recommend(REQUEST)).rejects.toThrow(
      new OpenAiBoardRecommendationError('Resposta estruturada da OpenAI nao e JSON valido.'),
    );
  });

  it('rejects responses without structured text', async () => {
    const provider = createProvider(
      vi.fn(async () =>
        jsonResponse({
          output: [null, { content: [{ type: 'output_text' }] }],
        }),
      ),
    );

    await expect(provider.recommend(REQUEST)).rejects.toThrow(
      new OpenAiBoardRecommendationError('Resposta da OpenAI nao contem texto estruturado.'),
    );
  });

  it('rejects object responses without output fields', async () => {
    const provider = createProvider(vi.fn(async () => jsonResponse({ id: 'response-id' })));

    await expect(provider.recommend(REQUEST)).rejects.toThrow(
      new OpenAiBoardRecommendationError('Resposta da OpenAI nao contem texto estruturado.'),
    );
  });

  it('rejects malformed structured payloads', async () => {
    const cases = [
      {
        outputText: '[]',
        message: 'Payload estruturado da OpenAI deve ser objeto.',
      },
      {
        outputText: JSON.stringify(payload({ recommendations: 'acao' })),
        message: 'recommendations deve ser uma lista.',
      },
      {
        outputText: JSON.stringify(payload({ recommendations: ['acao'] })),
        message: 'Cada recomendacao deve ser objeto.',
      },
      {
        outputText: JSON.stringify(
          payload({
            recommendations: [
              {
                taskId: 10,
              },
            ],
          }),
        ),
        message: 'recommendation.taskId deve ser texto.',
      },
      {
        outputText: JSON.stringify(
          payload({
            recommendations: [
              {
                taskId: 'unknown-task',
              },
            ],
          }),
        ),
        message: 'recommendation.taskId desconhecido.',
      },
      {
        outputText: JSON.stringify(
          payload({
            recommendations: [
              {
                taskId: TASK.id,
                type: 'archive_task',
              },
            ],
          }),
        ),
        message: 'recommendation.type invalido.',
      },
      {
        outputText: JSON.stringify(
          payload({
            recommendations: [
              {
                taskId: TASK.id,
                type: BoardRecommendationType.ReviewTask,
                severity: 'urgent',
              },
            ],
          }),
        ),
        message: 'recommendation.severity invalida.',
      },
      {
        outputText: JSON.stringify(
          payload({
            recommendations: [
              {
                taskId: TASK.id,
                type: BoardRecommendationType.ReviewTask,
                severity: BoardRecommendationSeverity.Warning,
                title: 123,
              },
            ],
          }),
        ),
        message: 'recommendation.title deve ser texto.',
      },
    ];

    for (const testCase of cases) {
      const provider = createProvider(
        vi.fn(async () =>
          jsonResponse({
            output_text: testCase.outputText,
          }),
        ),
      );

      await expect(provider.recommend(REQUEST)).rejects.toThrow(
        new OpenAiBoardRecommendationError(testCase.message),
      );
    }
  });
});
