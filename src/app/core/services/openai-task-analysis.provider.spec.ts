import {
  AGENT_CONTRACT_VERSION,
  AgentId,
  Task,
  TaskPriority,
  TaskStatus,
} from '../models/task.model';
import {
  OpenAiTaskAnalysisError,
  OpenAiTaskAnalysisProvider,
} from './openai-task-analysis.provider';

const REQUESTED_AT = '2026-06-22T12:00:00.000Z';

const TASK: Task = {
  id: 'task-id',
  title: 'Revisar checkout',
  description: 'Validar o fluxo de checkout autenticado com pagamento e confirmacao final.',
  priority: TaskPriority.High,
  status: TaskStatus.Draft,
  category: 'Produto',
  tags: ['checkout'],
  assignee: 'Lucas',
  dueDate: '2026-06-30',
  acceptanceCriteria: ['Pagamento aprovado.'],
  createdAt: REQUESTED_AT,
  updatedAt: REQUESTED_AT,
  aiSuggestions: [],
  auditLogs: [],
};

const REQUEST = {
  task: TASK,
  requestedAt: REQUESTED_AT,
  contractVersion: AGENT_CONTRACT_VERSION,
  context: {
    includeSlowAiWarning: false,
  },
};

function createProvider(fetchImpl = vi.fn(), apiKey = 'test-key') {
  return new OpenAiTaskAnalysisProvider({
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
    summary: 'Task clara com pequenos ajustes recomendados.',
    suggestions: [
      {
        field: 'title',
        suggestedValue: 'Revisar checkout autenticado',
        reason: 'Titulo mais especifico.',
      },
      {
        field: 'acceptanceCriteria',
        suggestedValue: ['Pagamento aprovado.', 'Confirmacao final exibida.'],
        reason: 'Criterios objetivos reduzem ambiguidade.',
      },
    ],
    qualityScore: {
      score: 88.6,
      summary: 'Boa task para aprovacao humana.',
      warnings: ['Detalhar evidencias esperadas.'],
    },
    ...overrides,
  };
}

describe('OpenAiTaskAnalysisProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls the OpenAI Responses API and maps structured output to an AI review', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        output_text: JSON.stringify(payload()),
      }),
    );
    const provider = createProvider(fetchImpl);

    await expect(provider.analyze(REQUEST)).resolves.toEqual({
      reviewedAt: REQUESTED_AT,
      summary: 'Task clara com pequenos ajustes recomendados.',
      suggestions: [
        {
          id: 'task-id-title-openai-suggestion-1',
          field: 'title',
          originalValue: 'Revisar checkout',
          suggestedValue: 'Revisar checkout autenticado',
          reason: 'Titulo mais especifico.',
          decision: 'pending',
        },
        {
          id: 'task-id-acceptanceCriteria-openai-suggestion-2',
          field: 'acceptanceCriteria',
          originalValue: ['Pagamento aprovado.'],
          suggestedValue: ['Pagamento aprovado.', 'Confirmacao final exibida.'],
          reason: 'Criterios objetivos reduzem ambiguidade.',
          decision: 'pending',
        },
      ],
      qualityScore: {
        score: 89,
        summary: 'Boa task para aprovacao humana.',
        warnings: ['Detalhar evidencias esperadas.'],
        evaluatedAt: REQUESTED_AT,
      },
      agentRun: {
        agentId: AgentId.InitialTaskAnalysis,
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
    expect(body).toMatchObject({
      model: 'gpt-test',
      text: {
        format: {
          type: 'json_schema',
          name: 'taskflow_task_analysis',
          strict: true,
        },
      },
    });
    expect(body.input[0].content[0].text).toContain('Revisar checkout');
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
        output_text: JSON.stringify(payload()),
      }),
    );
    const provider = new OpenAiTaskAnalysisProvider({
      endpoint: 'https://api.openai.test/v1/responses',
      fetchImpl: fetchImpl as typeof fetch,
    });

    await provider.analyze(REQUEST);

    const firstCall = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(firstCall[1].body as string);
    expect(firstCall[1].headers).toMatchObject({
      authorization: 'Bearer env-key',
    });
    expect(body.model).toBe('gpt-env');
  });

  it('uses global fetch, default model, and nullable task fields when options are omitted', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        output_text: JSON.stringify(payload()),
      }),
    );
    vi.stubGlobal('fetch', fetchImpl);
    vi.stubGlobal('process', {
      env: {
        OPENAI_API_KEY: 'env-key',
      },
    });
    const provider = new OpenAiTaskAnalysisProvider();

    await provider.analyze({
      ...REQUEST,
      task: {
        ...TASK,
        assignee: undefined,
        dueDate: undefined,
      },
    });

    const firstCall = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(firstCall[1].body as string);
    const serializedInput = JSON.parse(body.input[0].content[0].text);

    expect(firstCall[0]).toBe('https://api.openai.com/v1/responses');
    expect(body.model).toBe('gpt-5.5');
    expect(serializedInput.task).toMatchObject({
      assignee: null,
      dueDate: null,
    });
  });

  it('extracts content from the Responses output array', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        output: [
          { content: [] },
          {
            content: [
              {
                type: 'output_text',
                text: JSON.stringify(
                  payload({
                    suggestions: [
                      {
                        field: 'description',
                        suggestedValue: 'Descricao revisada com impacto e validacao.',
                        reason: 'Descricao mais completa.',
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
    const review = await createProvider(fetchImpl).analyze(REQUEST);

    expect(review.suggestions).toEqual([
      expect.objectContaining({
        field: 'description',
        originalValue: TASK.description,
        suggestedValue: 'Descricao revisada com impacto e validacao.',
      }),
    ]);
  });

  it('rejects calls when the API key is missing', async () => {
    const provider = createProvider(vi.fn(), '');

    await expect(provider.analyze(REQUEST)).rejects.toThrow(
      new OpenAiTaskAnalysisError('OPENAI_API_KEY nao configurada.'),
    );
    expect(provider.isConfigured()).toBe(false);
  });

  it('wraps non-success OpenAI responses', async () => {
    const provider = createProvider(vi.fn(async () => jsonResponse({ error: 'rate_limit' }, 429)));

    await expect(provider.analyze(REQUEST)).rejects.toThrow(
      new OpenAiTaskAnalysisError('OpenAI retornou status 429.'),
    );
  });

  it('rejects invalid JSON output', async () => {
    const provider = createProvider(vi.fn(async () => jsonResponse({ output_text: '{' })));

    await expect(provider.analyze(REQUEST)).rejects.toThrow(
      new OpenAiTaskAnalysisError('Resposta estruturada da OpenAI nao e JSON valido.'),
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

    await expect(provider.analyze(REQUEST)).rejects.toThrow(
      new OpenAiTaskAnalysisError('Resposta da OpenAI nao contem texto estruturado.'),
    );
  });

  it('rejects object responses without output fields', async () => {
    const provider = createProvider(vi.fn(async () => jsonResponse({ id: 'response-id' })));

    await expect(provider.analyze(REQUEST)).rejects.toThrow(
      new OpenAiTaskAnalysisError('Resposta da OpenAI nao contem texto estruturado.'),
    );
  });

  it('rejects malformed structured payloads', async () => {
    const cases = [
      {
        outputText: '[]',
        message: 'Payload estruturado da OpenAI deve ser objeto.',
      },
      {
        outputText: JSON.stringify(payload({ summary: 10 })),
        message: 'summary deve ser texto.',
      },
      {
        outputText: JSON.stringify(payload({ suggestions: 'titulo' })),
        message: 'suggestions deve ser uma lista.',
      },
      {
        outputText: JSON.stringify(payload({ suggestions: ['titulo'] })),
        message: 'Cada sugestao deve ser objeto.',
      },
      {
        outputText: JSON.stringify(payload({ suggestions: [{ field: 'owner' }] })),
        message: 'Campo de sugestao invalido.',
      },
      {
        outputText: JSON.stringify(
          payload({
            suggestions: [
              {
                field: 'title',
                suggestedValue: ['Titulo em lista'],
                reason: 'Formato invalido.',
              },
            ],
          }),
        ),
        message: 'suggestion.suggestedValue deve ser texto.',
      },
      {
        outputText: JSON.stringify(
          payload({
            suggestions: [
              {
                field: 'acceptanceCriteria',
                suggestedValue: 'Criterio unico',
                reason: 'Formato invalido.',
              },
            ],
          }),
        ),
        message: 'suggestion.suggestedValue deve ser lista de textos.',
      },
      {
        outputText: JSON.stringify(
          payload({
            suggestions: [
              {
                field: 'title',
                suggestedValue: 'Titulo revisado',
                reason: 20,
              },
            ],
          }),
        ),
        message: 'suggestion.reason deve ser texto.',
      },
      {
        outputText: JSON.stringify(payload({ qualityScore: null })),
        message: 'qualityScore deve ser objeto.',
      },
      {
        outputText: JSON.stringify(payload({ qualityScore: { score: 120 } })),
        message: 'qualityScore.score deve estar entre 0 e 100.',
      },
      {
        outputText: JSON.stringify(
          payload({
            qualityScore: {
              score: 90,
              summary: 15,
              warnings: [],
            },
          }),
        ),
        message: 'qualityScore.summary deve ser texto.',
      },
      {
        outputText: JSON.stringify(
          payload({
            qualityScore: {
              score: 90,
              summary: 'Ok',
              warnings: ['Ok', 10],
            },
          }),
        ),
        message: 'qualityScore.warnings deve ser lista de textos.',
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

      await expect(provider.analyze(REQUEST)).rejects.toThrow(
        new OpenAiTaskAnalysisError(testCase.message),
      );
    }
  });
});
