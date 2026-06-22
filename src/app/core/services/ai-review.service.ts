import { inject, Injectable } from '@angular/core';
import {
  AGENT_CONTRACT_VERSION,
  AiReviewResult,
  Task,
  TaskAnalysisRequest,
} from '../models/task.model';
import { TASK_ANALYSIS_PROVIDER } from './agent-provider.tokens';
import { AGENT_GATEWAY_CONFIG, HttpTaskAnalysisProvider } from './agent-gateway.service';
import { ChaosService } from './chaos.service';

@Injectable({ providedIn: 'root' })
export class AiReviewService {
  private readonly agentGatewayConfig = inject(AGENT_GATEWAY_CONFIG);
  private readonly chaosService = inject(ChaosService);
  private readonly httpTaskAnalysisProvider = inject(HttpTaskAnalysisProvider);
  private readonly taskAnalysisProvider = inject(TASK_ANALYSIS_PROVIDER);

  async review(task: Task, reviewedAt = new Date().toISOString()): Promise<AiReviewResult> {
    if (this.chaosService.isEnabled('network_loss')) {
      throw new Error('Perda de conexao simulada durante revisao da IA.');
    }

    if (this.chaosService.isEnabled('ai_unavailable')) {
      throw new Error('IA fora do ar no cenario de caos.');
    }

    if (this.chaosService.isEnabled('ai_invalid_response')) {
      throw new Error('Resposta invalida da IA no cenario de caos.');
    }

    const request = this.createRequest(task, reviewedAt);

    if (this.agentGatewayConfig.mode === 'mock') {
      return this.taskAnalysisProvider.analyze(request);
    }

    try {
      return await this.httpTaskAnalysisProvider.analyze(request);
    } catch (error) {
      return this.createFallbackReview(request, error);
    }
  }

  reviewWithMock(task: Task, reviewedAt = new Date().toISOString()): AiReviewResult {
    return this.taskAnalysisProvider.analyze(this.createRequest(task, reviewedAt));
  }

  private createRequest(task: Task, reviewedAt: string): TaskAnalysisRequest {
    return {
      task,
      requestedAt: reviewedAt,
      contractVersion: AGENT_CONTRACT_VERSION,
      context: {
        includeSlowAiWarning: this.chaosService.isEnabled('ai_slow'),
      },
    };
  }

  private createFallbackReview(request: TaskAnalysisRequest, error: unknown): AiReviewResult {
    const fallbackReview = this.taskAnalysisProvider.analyze(request);

    return {
      ...fallbackReview,
      agentRun: {
        agentId: this.taskAnalysisProvider.contract.agentId,
        contractVersion: request.contractVersion,
        provider: this.taskAnalysisProvider.contract.provider,
        generatedAt: request.requestedAt,
        fallbackReason: `Fallback mockado apos falha do gateway: ${String(error)}`,
      },
    };
  }
}
