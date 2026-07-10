import { inject, Injectable } from '@angular/core';
import {
  AGENT_CONTRACT_VERSION,
  AgentId,
  AgentProviderKind,
  BoardRecommendationRequest,
  BoardRecommendationSummary,
  BoardTimeSummary,
  Task,
} from '../models/task.model';
import { AgentRunService } from './agent-run.service';
import { BOARD_RECOMMENDATION_PROVIDER } from './agent-provider.tokens';
import { AGENT_GATEWAY_CONFIG, HttpBoardRecommendationProvider } from './agent-gateway.service';

@Injectable({ providedIn: 'root' })
export class AiRecommendationService {
  private readonly agentGatewayConfig = inject(AGENT_GATEWAY_CONFIG);
  private readonly agentRunService = inject(AgentRunService);
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
    const run = this.agentRunService.queueRun(
      {
        agentId: AgentId.BoardAdvisor,
        operation: 'board_recommendation',
        provider: this.readRecommendationProvider(),
        inputSummary: `${request.tasks.length} tasks analisadas`,
      },
      request.requestedAt,
    );

    this.agentRunService.startRun(run.id, request.requestedAt);

    try {
      const summary =
        this.agentGatewayConfig.mode === 'mock'
          ? this.boardRecommendationProvider.recommend(request)
          : await this.recommendWithGatewayFallback(request);

      this.agentRunService.completeRun(
        run.id,
        {
          provider: summary.agentRun?.provider,
          outputSummary: `${summary.total} recomendacoes`,
          outputCount: summary.total,
          fallbackReason: summary.agentRun?.fallbackReason,
        },
        summary.generatedAt,
      );

      return summary;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Nao foi possivel recomendar acoes do board.';

      this.agentRunService.failRun(run.id, message, request.requestedAt);

      throw error;
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

  private async recommendWithGatewayFallback(
    request: BoardRecommendationRequest,
  ): Promise<BoardRecommendationSummary> {
    try {
      return await this.httpBoardRecommendationProvider.recommend(request);
    } catch (error) {
      return this.createFallbackRecommendations(request, error);
    }
  }

  private readRecommendationProvider(): AgentProviderKind {
    return this.agentGatewayConfig.mode === 'mock'
      ? this.boardRecommendationProvider.contract.provider
      : 'gateway';
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
