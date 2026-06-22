import { inject, Injectable } from '@angular/core';
import {
  AGENT_CONTRACT_VERSION,
  BoardRecommendationRequest,
  BoardRecommendationSummary,
  BoardTimeSummary,
  Task,
} from '../models/task.model';
import { BOARD_RECOMMENDATION_PROVIDER } from './agent-provider.tokens';
import { AGENT_GATEWAY_CONFIG, HttpBoardRecommendationProvider } from './agent-gateway.service';

@Injectable({ providedIn: 'root' })
export class AiRecommendationService {
  private readonly agentGatewayConfig = inject(AGENT_GATEWAY_CONFIG);
  private readonly boardRecommendationProvider = inject(BOARD_RECOMMENDATION_PROVIDER);
  private readonly httpBoardRecommendationProvider = inject(HttpBoardRecommendationProvider);

  recommend(
    tasks: Task[],
    boardTime: BoardTimeSummary,
    generatedAt = new Date(boardTime.generatedAt),
  ): BoardRecommendationSummary {
    return this.boardRecommendationProvider.recommend(
      this.createRequest(tasks, boardTime, generatedAt),
    );
  }

  async recommendAsync(
    tasks: Task[],
    boardTime: BoardTimeSummary,
    generatedAt = new Date(boardTime.generatedAt),
  ): Promise<BoardRecommendationSummary> {
    const request = this.createRequest(tasks, boardTime, generatedAt);

    if (this.agentGatewayConfig.mode === 'mock') {
      return this.boardRecommendationProvider.recommend(request);
    }

    try {
      return await this.httpBoardRecommendationProvider.recommend(request);
    } catch (error) {
      return this.createFallbackRecommendations(request, error);
    }
  }

  private createRequest(
    tasks: Task[],
    boardTime: BoardTimeSummary,
    generatedAt: Date,
  ): BoardRecommendationRequest {
    return {
      tasks,
      boardTime,
      requestedAt: generatedAt.toISOString(),
      contractVersion: AGENT_CONTRACT_VERSION,
    };
  }

  private createFallbackRecommendations(
    request: BoardRecommendationRequest,
    error: unknown,
  ): BoardRecommendationSummary {
    const fallbackSummary = this.boardRecommendationProvider.recommend(request);

    return {
      ...fallbackSummary,
      agentRun: {
        agentId: this.boardRecommendationProvider.contract.agentId,
        contractVersion: request.contractVersion,
        provider: this.boardRecommendationProvider.contract.provider,
        generatedAt: request.requestedAt,
        fallbackReason: `Fallback mockado apos falha do gateway: ${String(error)}`,
      },
    };
  }
}
