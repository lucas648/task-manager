import { inject, Injectable } from '@angular/core';
import {
  AGENT_CONTRACT_VERSION,
  AgentId,
  AgentProviderKind,
  AiReviewResult,
  Task,
  TaskAnalysisRequest,
} from '../models/task.model';
import { AgentRunService } from './agent-run.service';
import { TASK_ANALYSIS_PROVIDER } from './agent-provider.tokens';
import { AGENT_GATEWAY_CONFIG, HttpTaskAnalysisProvider } from './agent-gateway.service';
import { ChaosService } from './chaos.service';

@Injectable({ providedIn: 'root' })
export class AiReviewService {
  private readonly agentGatewayConfig = inject(AGENT_GATEWAY_CONFIG);
  private readonly agentRunService = inject(AgentRunService);
  private readonly chaosService = inject(ChaosService);
  private readonly httpTaskAnalysisProvider = inject(HttpTaskAnalysisProvider);
  private readonly taskAnalysisProvider = inject(TASK_ANALYSIS_PROVIDER);

  async review(task: Task, reviewedAt = new Date().toISOString()): Promise<AiReviewResult> {
    const request = this.createRequest(task, reviewedAt);
    const run = this.agentRunService.queueRun(
      {
        agentId: AgentId.InitialTaskAnalysis,
        operation: 'task_review',
        provider: this.readReviewProvider(),
        taskId: task.id,
        taskTitle: task.title,
        inputSummary: `Revisar ${task.title}`,
      },
      reviewedAt,
    );

    this.agentRunService.startRun(run.id, reviewedAt);

    try {
      if (this.chaosService.isEnabled('network_loss')) {
        throw new Error('Perda de conexao simulada durante revisao da IA.');
      }

      if (this.chaosService.isEnabled('ai_unavailable')) {
        throw new Error('IA fora do ar no cenario de caos.');
      }

      if (this.chaosService.isEnabled('ai_invalid_response')) {
        throw new Error('Resposta invalida da IA no cenario de caos.');
      }

      const review =
        this.agentGatewayConfig.mode === 'mock'
          ? this.taskAnalysisProvider.analyze(request)
          : await this.reviewWithGatewayFallback(request);

      this.agentRunService.completeRun(
        run.id,
        {
          provider: review.agentRun?.provider,
          outputSummary: review.summary,
          outputCount: review.suggestions.length,
          fallbackReason: review.agentRun?.fallbackReason,
        },
        review.reviewedAt,
      );

      return review;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Nao foi possivel concluir a revisao da IA.';

      this.agentRunService.failRun(run.id, message, reviewedAt);

      throw error;
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

  private async reviewWithGatewayFallback(request: TaskAnalysisRequest): Promise<AiReviewResult> {
    try {
      return await this.httpTaskAnalysisProvider.analyze(request);
    } catch (error) {
      return this.createFallbackReview(request, error);
    }
  }

  private readReviewProvider(): AgentProviderKind {
    return this.agentGatewayConfig.mode === 'mock'
      ? this.taskAnalysisProvider.contract.provider
      : 'gateway';
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
