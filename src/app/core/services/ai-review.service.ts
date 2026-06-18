import { inject, Injectable } from '@angular/core';
import { AGENT_CONTRACT_VERSION, AiReviewResult, Task } from '../models/task.model';
import { TASK_ANALYSIS_PROVIDER } from './agent-provider.tokens';
import { ChaosService } from './chaos.service';

@Injectable({ providedIn: 'root' })
export class AiReviewService {
  private readonly chaosService = inject(ChaosService);
  private readonly taskAnalysisProvider = inject(TASK_ANALYSIS_PROVIDER);

  review(task: Task, reviewedAt = new Date().toISOString()): AiReviewResult {
    if (this.chaosService.isEnabled('network_loss')) {
      throw new Error('Perda de conexao simulada durante revisao da IA.');
    }

    if (this.chaosService.isEnabled('ai_unavailable')) {
      throw new Error('IA fora do ar no cenario de caos.');
    }

    if (this.chaosService.isEnabled('ai_invalid_response')) {
      throw new Error('Resposta invalida da IA no cenario de caos.');
    }

    return this.taskAnalysisProvider.analyze({
      task,
      requestedAt: reviewedAt,
      contractVersion: AGENT_CONTRACT_VERSION,
      context: {
        includeSlowAiWarning: this.chaosService.isEnabled('ai_slow'),
      },
    });
  }
}
