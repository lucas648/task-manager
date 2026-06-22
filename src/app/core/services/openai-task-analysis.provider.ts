import {
  AGENT_PROMPT_CONTRACTS,
  AgentId,
  AiReviewResult,
  AiSuggestion,
  AsyncTaskAnalysisProvider,
  Task,
  TaskAnalysisRequest,
  TaskQualityScore,
} from '../models/task.model';

export type OpenAiTaskAnalysisFetch = typeof fetch;

interface OpenAiTaskAnalysisProviderOptions {
  apiKey?: string;
  endpoint?: string;
  fetchImpl?: OpenAiTaskAnalysisFetch;
  model?: string;
}

interface OpenAiTaskAnalysisPayload {
  summary: string;
  suggestions: OpenAiSuggestionPayload[];
  qualityScore: {
    score: number;
    summary: string;
    warnings: string[];
  };
}

interface OpenAiSuggestionPayload {
  field: AiSuggestion['field'];
  reason: string;
  suggestedValue: string | string[];
}

const DEFAULT_OPENAI_RESPONSES_ENDPOINT = 'https://api.openai.com/v1/responses';
const DEFAULT_OPENAI_MODEL = 'gpt-5.5';
const TASK_ANALYSIS_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'suggestions', 'qualityScore'],
  properties: {
    summary: { type: 'string' },
    suggestions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['field', 'suggestedValue', 'reason'],
        properties: {
          field: {
            type: 'string',
            enum: ['title', 'description', 'acceptanceCriteria'],
          },
          suggestedValue: {
            anyOf: [
              { type: 'string' },
              {
                type: 'array',
                items: { type: 'string' },
              },
            ],
          },
          reason: { type: 'string' },
        },
      },
    },
    qualityScore: {
      type: 'object',
      additionalProperties: false,
      required: ['score', 'summary', 'warnings'],
      properties: {
        score: { type: 'number', minimum: 0, maximum: 100 },
        summary: { type: 'string' },
        warnings: {
          type: 'array',
          items: { type: 'string' },
        },
      },
    },
  },
} as const;

const TASK_ANALYSIS_INSTRUCTIONS = [
  'Voce e o InitialTaskAnalysisAgent do TaskFlow AI.',
  'Analise a task enviada e responda somente no JSON estruturado solicitado.',
  'Sugira melhorias objetivas para titulo, descricao e criterios de aceite quando fizer sentido.',
  'Nao invente dados externos, pessoas ou datas. Preserve o idioma da task.',
  'Score deve ir de 0 a 100 e refletir clareza, contexto, risco e criterios de aceite.',
].join('\n');

export class OpenAiTaskAnalysisError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpenAiTaskAnalysisError';
  }
}

export class OpenAiTaskAnalysisProvider implements AsyncTaskAnalysisProvider {
  readonly contract = {
    ...AGENT_PROMPT_CONTRACTS[AgentId.InitialTaskAnalysis],
    provider: 'openai' as const,
  };

  private readonly apiKey: string;
  private readonly endpoint: string;
  private readonly fetchImpl: OpenAiTaskAnalysisFetch;
  private readonly model: string;

  constructor(options: OpenAiTaskAnalysisProviderOptions = {}) {
    const env = readOpenAiEnv();
    this.apiKey = options.apiKey ?? env.apiKey;
    this.endpoint = options.endpoint ?? DEFAULT_OPENAI_RESPONSES_ENDPOINT;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.model = options.model ?? env.model;
  }

  isConfigured(): boolean {
    return this.apiKey.trim().length > 0;
  }

  async analyze(request: TaskAnalysisRequest): Promise<AiReviewResult> {
    if (!this.isConfigured()) {
      throw new OpenAiTaskAnalysisError('OPENAI_API_KEY nao configurada.');
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
      throw new OpenAiTaskAnalysisError(`OpenAI retornou status ${response.status}.`);
    }

    const responseBody = await response.json();
    const parsedPayload = parseJsonObject(this.extractOutputText(responseBody));
    const payload = this.validatePayload(parsedPayload);

    return {
      reviewedAt: request.requestedAt,
      summary: payload.summary,
      suggestions: payload.suggestions.map((suggestion, index) =>
        this.createSuggestion(request.task, suggestion, index),
      ),
      qualityScore: this.createQualityScore(payload.qualityScore, request.requestedAt),
      agentRun: {
        agentId: this.contract.agentId,
        contractVersion: request.contractVersion,
        provider: this.contract.provider,
        generatedAt: request.requestedAt,
      },
    };
  }

  private createRequestBody(request: TaskAnalysisRequest): Record<string, unknown> {
    return {
      model: this.model,
      instructions: TASK_ANALYSIS_INSTRUCTIONS,
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: JSON.stringify({
                contractVersion: request.contractVersion,
                context: request.context,
                task: this.serializeTask(request.task),
              }),
            },
          ],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'taskflow_task_analysis',
          strict: true,
          schema: TASK_ANALYSIS_RESPONSE_SCHEMA,
        },
      },
    };
  }

  private serializeTask(task: Task): Record<string, unknown> {
    return {
      id: task.id,
      title: task.title,
      description: task.description,
      priority: task.priority,
      status: task.status,
      category: task.category,
      tags: task.tags,
      assignee: task.assignee ?? null,
      dueDate: task.dueDate ?? null,
      acceptanceCriteria: task.acceptanceCriteria,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
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

    throw new OpenAiTaskAnalysisError('Resposta da OpenAI nao contem texto estruturado.');
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

  private validatePayload(value: unknown): OpenAiTaskAnalysisPayload {
    if (!isRecord(value)) {
      throw new OpenAiTaskAnalysisError('Payload estruturado da OpenAI deve ser objeto.');
    }

    const summary = readString(value['summary'], 'summary');
    const suggestions = this.validateSuggestions(value['suggestions']);
    const qualityScore = this.validateQualityScore(value['qualityScore']);

    return {
      summary,
      suggestions,
      qualityScore,
    };
  }

  private validateSuggestions(value: unknown): OpenAiSuggestionPayload[] {
    if (!Array.isArray(value)) {
      throw new OpenAiTaskAnalysisError('suggestions deve ser uma lista.');
    }

    return value.map((suggestion) => this.validateSuggestion(suggestion));
  }

  private validateSuggestion(value: unknown): OpenAiSuggestionPayload {
    if (!isRecord(value)) {
      throw new OpenAiTaskAnalysisError('Cada sugestao deve ser objeto.');
    }

    const field = this.validateSuggestionField(value['field']);
    const suggestedValue = this.validateSuggestedValue(field, value['suggestedValue']);

    return {
      field,
      suggestedValue,
      reason: readString(value['reason'], 'suggestion.reason'),
    };
  }

  private validateSuggestionField(value: unknown): AiSuggestion['field'] {
    if (value === 'title' || value === 'description' || value === 'acceptanceCriteria') {
      return value;
    }

    throw new OpenAiTaskAnalysisError('Campo de sugestao invalido.');
  }

  private validateSuggestedValue(field: AiSuggestion['field'], value: unknown): string | string[] {
    if (field === 'acceptanceCriteria') {
      return readStringArray(value, 'suggestion.suggestedValue');
    }

    return readString(value, 'suggestion.suggestedValue');
  }

  private validateQualityScore(value: unknown): OpenAiTaskAnalysisPayload['qualityScore'] {
    if (!isRecord(value)) {
      throw new OpenAiTaskAnalysisError('qualityScore deve ser objeto.');
    }

    return {
      score: readScore(value['score']),
      summary: readString(value['summary'], 'qualityScore.summary'),
      warnings: readStringArray(value['warnings'], 'qualityScore.warnings'),
    };
  }

  private createSuggestion(
    task: Task,
    suggestion: OpenAiSuggestionPayload,
    index: number,
  ): AiSuggestion {
    return {
      id: `${task.id}-${suggestion.field}-openai-suggestion-${index + 1}`,
      field: suggestion.field,
      originalValue:
        suggestion.field === 'acceptanceCriteria'
          ? task.acceptanceCriteria
          : task[suggestion.field],
      suggestedValue: suggestion.suggestedValue,
      reason: suggestion.reason,
      decision: 'pending',
    };
  }

  private createQualityScore(
    qualityScore: OpenAiTaskAnalysisPayload['qualityScore'],
    evaluatedAt: string,
  ): TaskQualityScore {
    return {
      ...qualityScore,
      evaluatedAt,
    };
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
    throw new OpenAiTaskAnalysisError('Resposta estruturada da OpenAI nao e JSON valido.');
  }
}

function readString(value: unknown, fieldName: string): string {
  if (typeof value === 'string') {
    return value;
  }

  throw new OpenAiTaskAnalysisError(`${fieldName} deve ser texto.`);
}

function readStringArray(value: unknown, fieldName: string): string[] {
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
    return value;
  }

  throw new OpenAiTaskAnalysisError(`${fieldName} deve ser lista de textos.`);
}

function readScore(value: unknown): number {
  if (typeof value === 'number' && value >= 0 && value <= 100) {
    return Math.round(value);
  }

  throw new OpenAiTaskAnalysisError('qualityScore.score deve estar entre 0 e 100.');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
