import { inject, Injectable, InjectionToken } from '@angular/core';
import {
  AGENT_PROMPT_CONTRACTS,
  AgentContractsResponse,
  AgentGatewayConfig,
  AgentId,
  AiReviewResult,
  AsyncBoardRecommendationProvider,
  AsyncTaskAnalysisProvider,
  BoardRecommendationRequest,
  BoardRecommendationSummary,
  DEFAULT_AGENT_GATEWAY_CONFIG,
  TaskAnalysisRequest,
} from '../models/task.model';

export type AgentGatewayFetch = typeof fetch;

export const AGENT_GATEWAY_CONFIG = new InjectionToken<AgentGatewayConfig>('AgentGatewayConfig', {
  providedIn: 'root',
  factory: () => DEFAULT_AGENT_GATEWAY_CONFIG,
});

export const AGENT_GATEWAY_FETCH = new InjectionToken<AgentGatewayFetch>('AgentGatewayFetch', {
  providedIn: 'root',
  factory: () => globalThis.fetch.bind(globalThis),
});

export class AgentGatewayError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'AgentGatewayError';
  }
}

@Injectable({ providedIn: 'root' })
export class AgentGatewayClient {
  private readonly config = inject(AGENT_GATEWAY_CONFIG);
  private readonly fetchImpl = inject(AGENT_GATEWAY_FETCH);

  readContracts(): Promise<AgentContractsResponse> {
    return this.getJson(this.config.endpoints.contracts);
  }

  analyzeTask(request: TaskAnalysisRequest): Promise<AiReviewResult> {
    return this.postJson(this.config.endpoints.taskAnalysis, request);
  }

  recommendBoard(request: BoardRecommendationRequest): Promise<BoardRecommendationSummary> {
    return this.postJson(this.config.endpoints.boardRecommendations, request);
  }

  private async getJson<ResponseBody>(endpoint: string): Promise<ResponseBody> {
    const response = await this.fetchImpl(this.buildUrl(endpoint), {
      method: 'GET',
      headers: {
        accept: 'application/json',
      },
    });

    return this.parseResponse(response);
  }

  private async postJson<ResponseBody>(endpoint: string, body: unknown): Promise<ResponseBody> {
    const response = await this.fetchImpl(this.buildUrl(endpoint), {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    return this.parseResponse(response);
  }

  private async parseResponse<ResponseBody>(response: Response): Promise<ResponseBody> {
    if (!response.ok) {
      throw new AgentGatewayError(
        `Agent gateway retornou status ${response.status}.`,
        response.status,
      );
    }

    return (await response.json()) as ResponseBody;
  }

  private buildUrl(endpoint: string): string {
    return `${this.config.baseUrl}/${endpoint}`;
  }
}

@Injectable({ providedIn: 'root' })
export class HttpTaskAnalysisProvider implements AsyncTaskAnalysisProvider {
  private readonly gatewayClient = inject(AgentGatewayClient);
  readonly contract = {
    ...AGENT_PROMPT_CONTRACTS[AgentId.InitialTaskAnalysis],
    provider: 'gateway' as const,
  };

  analyze(request: TaskAnalysisRequest): Promise<AiReviewResult> {
    return this.gatewayClient.analyzeTask(request);
  }
}

@Injectable({ providedIn: 'root' })
export class HttpBoardRecommendationProvider implements AsyncBoardRecommendationProvider {
  private readonly gatewayClient = inject(AgentGatewayClient);
  readonly contract = {
    ...AGENT_PROMPT_CONTRACTS[AgentId.BoardAdvisor],
    provider: 'gateway' as const,
  };

  recommend(request: BoardRecommendationRequest): Promise<BoardRecommendationSummary> {
    return this.gatewayClient.recommendBoard(request);
  }
}
