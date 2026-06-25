import {
  AGENT_PROMPT_CONTRACTS,
  AgentId,
  AsyncBoardRecommendationProvider,
  BoardRecommendation,
  BoardRecommendationRequest,
  BoardRecommendationSeverity,
  BoardRecommendationSummary,
  BoardRecommendationType,
  Task,
} from '../models/task.model';

export type OpenAiBoardRecommendationFetch = typeof fetch;

interface OpenAiBoardRecommendationProviderOptions {
  apiKey?: string;
  endpoint?: string;
  fetchImpl?: OpenAiBoardRecommendationFetch;
  model?: string;
}

interface OpenAiBoardRecommendationPayload {
  recommendations: ValidatedOpenAiRecommendationPayload[];
}

interface ValidatedOpenAiRecommendationPayload {
  task: Task;
  type: BoardRecommendationType;
  severity: BoardRecommendationSeverity;
  title: string;
  reason: string;
  suggestedAction: string;
  relatedMetricLabel: string;
}

const DEFAULT_OPENAI_RESPONSES_ENDPOINT = 'https://api.openai.com/v1/responses';
const DEFAULT_OPENAI_MODEL = 'gpt-5.5';
const BOARD_RECOMMENDATION_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['recommendations'],
  properties: {
    recommendations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'taskId',
          'type',
          'severity',
          'title',
          'reason',
          'suggestedAction',
          'relatedMetricLabel',
        ],
        properties: {
          taskId: { type: 'string' },
          type: {
            type: 'string',
            enum: Object.values(BoardRecommendationType),
          },
          severity: {
            type: 'string',
            enum: Object.values(BoardRecommendationSeverity),
          },
          title: { type: 'string' },
          reason: { type: 'string' },
          suggestedAction: { type: 'string' },
          relatedMetricLabel: { type: 'string' },
        },
      },
    },
  },
} as const;

const BOARD_RECOMMENDATION_INSTRUCTIONS = [
  'Voce e o BoardAdvisorAgent do TaskFlow AI.',
  'Analise as tasks e metricas de tempo por baia para recomendar proximas acoes operacionais.',
  'Responda somente no JSON estruturado solicitado, sem markdown.',
  'Use apenas taskId existentes na entrada e nao invente dados externos.',
  'Priorize recomendacoes acionaveis, sustentaveis e proporcionais ao risco observado.',
  'Use relatedMetricLabel como texto curto quando a recomendacao vier de uma metrica de tempo; caso contrario use string vazia.',
].join('\n');

export class OpenAiBoardRecommendationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpenAiBoardRecommendationError';
  }
}

export class OpenAiBoardRecommendationProvider implements AsyncBoardRecommendationProvider {
  readonly contract = {
    ...AGENT_PROMPT_CONTRACTS[AgentId.BoardAdvisor],
    provider: 'openai' as const,
  };

  private readonly apiKey: string;
  private readonly endpoint: string;
  private readonly fetchImpl: OpenAiBoardRecommendationFetch;
  private readonly model: string;

  constructor(options: OpenAiBoardRecommendationProviderOptions = {}) {
    const env = readOpenAiEnv();
    this.apiKey = options.apiKey ?? env.apiKey;
    this.endpoint = options.endpoint ?? DEFAULT_OPENAI_RESPONSES_ENDPOINT;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.model = options.model ?? env.model;
  }

  isConfigured(): boolean {
    return this.apiKey.trim().length > 0;
  }

  async recommend(request: BoardRecommendationRequest): Promise<BoardRecommendationSummary> {
    if (!this.isConfigured()) {
      throw new OpenAiBoardRecommendationError('OPENAI_API_KEY nao configurada.');
    }

    const response = await this.fetchImpl(this.endpoint, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(this.createRequestBody(request)),
    });

    if (!response.ok) {
      throw new OpenAiBoardRecommendationError(`OpenAI retornou status ${response.status}.`);
    }

    const responseBody = await response.json();
    const parsedPayload = parseJsonObject(this.extractOutputText(responseBody));
    const payload = this.validatePayload(parsedPayload, request);
    const recommendations = payload.recommendations.map((recommendation, index) =>
      this.createRecommendation(recommendation, request.requestedAt, index),
    );

    return {
      generatedAt: request.requestedAt,
      recommendations,
      total: recommendations.length,
      infoCount: this.countBySeverity(recommendations, BoardRecommendationSeverity.Info),
      warningCount: this.countBySeverity(recommendations, BoardRecommendationSeverity.Warning),
      criticalCount: this.countBySeverity(recommendations, BoardRecommendationSeverity.Critical),
      agentRun: {
        agentId: this.contract.agentId,
        contractVersion: request.contractVersion,
        provider: this.contract.provider,
        generatedAt: request.requestedAt,
      },
    };
  }

  private createRequestBody(request: BoardRecommendationRequest): Record<string, unknown> {
    return {
      model: this.model,
      instructions: BOARD_RECOMMENDATION_INSTRUCTIONS,
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: JSON.stringify({
                contractVersion: request.contractVersion,
                requestedAt: request.requestedAt,
                tasks: request.tasks,
                boardTime: request.boardTime,
              }),
            },
          ],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'taskflow_board_recommendations',
          strict: true,
          schema: BOARD_RECOMMENDATION_RESPONSE_SCHEMA,
        },
      },
    };
  }

  private extractOutputText(responseBody: unknown): string {
    if (isRecord(responseBody) && typeof responseBody['output_text'] === 'string') {
      return responseBody['output_text'];
    }

    if (isRecord(responseBody) && Array.isArray(responseBody['output'])) {
      for (const outputItem of responseBody['output']) {
        const text = this.readOutputItemText(outputItem);

        if (text) {
          return text;
        }
      }
    }

    throw new OpenAiBoardRecommendationError('Resposta da OpenAI nao contem texto estruturado.');
  }

  private readOutputItemText(outputItem: unknown): string | undefined {
    if (!isRecord(outputItem) || !Array.isArray(outputItem['content'])) {
      return undefined;
    }

    for (const contentItem of outputItem['content']) {
      if (isRecord(contentItem) && typeof contentItem['text'] === 'string') {
        return contentItem['text'];
      }
    }

    return undefined;
  }

  private validatePayload(
    value: unknown,
    request: BoardRecommendationRequest,
  ): OpenAiBoardRecommendationPayload {
    if (!isRecord(value)) {
      throw new OpenAiBoardRecommendationError('Payload estruturado da OpenAI deve ser objeto.');
    }

    return {
      recommendations: this.validateRecommendations(value['recommendations'], request),
    };
  }

  private validateRecommendations(
    value: unknown,
    request: BoardRecommendationRequest,
  ): ValidatedOpenAiRecommendationPayload[] {
    if (!Array.isArray(value)) {
      throw new OpenAiBoardRecommendationError('recommendations deve ser uma lista.');
    }

    return value.map((recommendation) => this.validateRecommendation(recommendation, request));
  }

  private validateRecommendation(
    value: unknown,
    request: BoardRecommendationRequest,
  ): ValidatedOpenAiRecommendationPayload {
    if (!isRecord(value)) {
      throw new OpenAiBoardRecommendationError('Cada recomendacao deve ser objeto.');
    }

    const taskId = readString(value['taskId'], 'recommendation.taskId');
    const task = request.tasks.find((candidate) => candidate.id === taskId);

    if (!task) {
      throw new OpenAiBoardRecommendationError('recommendation.taskId desconhecido.');
    }

    return {
      task,
      type: readRecommendationType(value['type']),
      severity: readRecommendationSeverity(value['severity']),
      title: readString(value['title'], 'recommendation.title'),
      reason: readString(value['reason'], 'recommendation.reason'),
      suggestedAction: readString(value['suggestedAction'], 'recommendation.suggestedAction'),
      relatedMetricLabel: readString(
        value['relatedMetricLabel'],
        'recommendation.relatedMetricLabel',
      ),
    };
  }

  private createRecommendation(
    recommendation: ValidatedOpenAiRecommendationPayload,
    createdAt: string,
    index: number,
  ): BoardRecommendation {
    return {
      id: `${recommendation.task.id}-${recommendation.type}-openai-recommendation-${index + 1}`,
      taskId: recommendation.task.id,
      taskTitle: recommendation.task.title,
      type: recommendation.type,
      severity: recommendation.severity,
      title: recommendation.title,
      reason: recommendation.reason,
      suggestedAction: recommendation.suggestedAction,
      currentStatus: recommendation.task.status,
      createdAt,
      relatedMetricLabel: recommendation.relatedMetricLabel,
    };
  }

  private countBySeverity(
    recommendations: BoardRecommendation[],
    severity: BoardRecommendationSeverity,
  ): number {
    return recommendations.filter((recommendation) => recommendation.severity === severity).length;
  }
}

function readOpenAiEnv(): { apiKey: string; model: string } {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env;

  return {
    apiKey: env?.['OPENAI_API_KEY'] ?? '',
    model: env?.['OPENAI_MODEL'] ?? DEFAULT_OPENAI_MODEL,
  };
}

function parseJsonObject(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new OpenAiBoardRecommendationError('Resposta estruturada da OpenAI nao e JSON valido.');
  }
}

function readString(value: unknown, fieldName: string): string {
  if (typeof value === 'string') {
    return value;
  }

  throw new OpenAiBoardRecommendationError(`${fieldName} deve ser texto.`);
}

function readRecommendationType(value: unknown): BoardRecommendationType {
  if (Object.values(BoardRecommendationType).includes(value as BoardRecommendationType)) {
    return value as BoardRecommendationType;
  }

  throw new OpenAiBoardRecommendationError('recommendation.type invalido.');
}

function readRecommendationSeverity(value: unknown): BoardRecommendationSeverity {
  if (Object.values(BoardRecommendationSeverity).includes(value as BoardRecommendationSeverity)) {
    return value as BoardRecommendationSeverity;
  }

  throw new OpenAiBoardRecommendationError('recommendation.severity invalida.');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
