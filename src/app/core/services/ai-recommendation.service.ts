import { inject, Injectable } from '@angular/core';
import {
  AGENT_CONTRACT_VERSION,
  BoardRecommendationSummary,
  BoardTimeSummary,
  Task,
} from '../models/task.model';
import { BOARD_RECOMMENDATION_PROVIDER } from './agent-provider.tokens';

@Injectable({ providedIn: 'root' })
export class AiRecommendationService {
  private readonly boardRecommendationProvider = inject(BOARD_RECOMMENDATION_PROVIDER);

  recommend(
    tasks: Task[],
    boardTime: BoardTimeSummary,
    generatedAt = new Date(boardTime.generatedAt),
  ): BoardRecommendationSummary {
    return this.boardRecommendationProvider.recommend({
      tasks,
      boardTime,
      requestedAt: generatedAt.toISOString(),
      contractVersion: AGENT_CONTRACT_VERSION,
    });
  }
}
