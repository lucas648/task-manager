import { Injectable } from '@angular/core';
import {
  BoardRecommendation,
  BoardRecommendationSeverity,
  BoardRecommendationSummary,
  BoardRecommendationType,
  BoardTimeSummary,
  STATUS_LABELS,
  Task,
  TaskBoardTimeMetric,
  TaskPriority,
  TaskStatus,
} from '../models/task.model';

@Injectable({ providedIn: 'root' })
export class AiRecommendationService {
  recommend(
    tasks: Task[],
    boardTime: BoardTimeSummary,
    generatedAt = new Date(boardTime.generatedAt),
  ): BoardRecommendationSummary {
    const metricsByTask = this.mapMetricsByTask(boardTime);
    const recommendations = tasks
      .filter((task) => task.status !== TaskStatus.Completed)
      .flatMap((task) => this.recommendForTask(task, metricsByTask[task.id], generatedAt));

    return {
      generatedAt: generatedAt.toISOString(),
      recommendations,
      total: recommendations.length,
      infoCount: this.countBySeverity(recommendations, BoardRecommendationSeverity.Info),
      warningCount: this.countBySeverity(recommendations, BoardRecommendationSeverity.Warning),
      criticalCount: this.countBySeverity(recommendations, BoardRecommendationSeverity.Critical),
    };
  }

  private recommendForTask(
    task: Task,
    metric: TaskBoardTimeMetric | undefined,
    generatedAt: Date,
  ): BoardRecommendation[] {
    return [
      this.recommendStalledTask(task, metric, generatedAt),
      this.recommendOwner(task, generatedAt),
      this.recommendAcceptanceCriteria(task, generatedAt),
      this.recommendUrgentPriority(task, metric, generatedAt),
    ].filter(
      (recommendation): recommendation is BoardRecommendation => recommendation !== undefined,
    );
  }

  private recommendStalledTask(
    task: Task,
    metric: TaskBoardTimeMetric | undefined,
    generatedAt: Date,
  ): BoardRecommendation | undefined {
    if (!metric?.isOverThreshold) {
      return undefined;
    }

    if (task.status === TaskStatus.Draft) {
      return this.createRecommendation(
        task,
        BoardRecommendationType.ReviewTask,
        BoardRecommendationSeverity.Warning,
        'Revisar task com IA',
        `A task esta em Draft ha ${metric.currentAgeLabel}, acima do limite da baia.`,
        'Abrir o fluxo da task e executar a revisao com IA antes de aprovar.',
        generatedAt,
        metric.currentAgeLabel,
      );
    }

    if (task.status === TaskStatus.InProgress) {
      return this.createRecommendation(
        task,
        BoardRecommendationType.SplitTask,
        BoardRecommendationSeverity.Critical,
        'Revisar bloqueio ou quebrar escopo',
        `A task esta em andamento ha ${metric.currentAgeLabel}, acima do limite esperado.`,
        'Verificar bloqueios, reduzir escopo ou quebrar em tasks menores.',
        generatedAt,
        metric.currentAgeLabel,
      );
    }

    if (task.status === TaskStatus.Approved || task.status === TaskStatus.Published) {
      return this.createRecommendation(
        task,
        BoardRecommendationType.MoveTask,
        BoardRecommendationSeverity.Warning,
        'Mover para a proxima etapa',
        `A task esta em ${STATUS_LABELS[task.status]} ha ${metric.currentAgeLabel}.`,
        'Confirmar se ja pode seguir para a proxima baia do fluxo.',
        generatedAt,
        metric.currentAgeLabel,
      );
    }

    if (task.status === TaskStatus.AiReviewed) {
      return this.createRecommendation(
        task,
        BoardRecommendationType.ReviewTask,
        BoardRecommendationSeverity.Warning,
        'Concluir decisao humana',
        `A task esta revisada pela IA ha ${metric.currentAgeLabel}.`,
        'Aplicar ou rejeitar sugestoes pendentes e decidir aprovacao humana.',
        generatedAt,
        metric.currentAgeLabel,
      );
    }

    if (task.status === TaskStatus.Error || task.status === TaskStatus.Rejected) {
      return this.createRecommendation(
        task,
        BoardRecommendationType.ReviewTask,
        BoardRecommendationSeverity.Critical,
        'Revisar status de excecao',
        `A task esta em ${STATUS_LABELS[task.status]} ha ${metric.currentAgeLabel}.`,
        'Revisar causa, corrigir dados e decidir se volta ao fluxo principal.',
        generatedAt,
        metric.currentAgeLabel,
      );
    }

    return undefined;
  }

  private recommendOwner(task: Task, generatedAt: Date): BoardRecommendation | undefined {
    if (task.assignee) {
      return undefined;
    }

    return this.createRecommendation(
      task,
      BoardRecommendationType.AssignOwner,
      task.status === TaskStatus.InProgress
        ? BoardRecommendationSeverity.Warning
        : BoardRecommendationSeverity.Info,
      'Definir responsavel',
      'A task ainda nao tem responsavel definido.',
      'Atribuir um owner para reduzir risco de espera invisivel.',
      generatedAt,
    );
  }

  private recommendAcceptanceCriteria(
    task: Task,
    generatedAt: Date,
  ): BoardRecommendation | undefined {
    if (task.acceptanceCriteria.length) {
      return undefined;
    }

    return this.createRecommendation(
      task,
      BoardRecommendationType.AddAcceptanceCriteria,
      BoardRecommendationSeverity.Warning,
      'Adicionar criterios de aceite',
      'A task nao possui criterios de aceite.',
      'Completar criterios objetivos antes de avancar no fluxo.',
      generatedAt,
    );
  }

  private recommendUrgentPriority(
    task: Task,
    metric: TaskBoardTimeMetric | undefined,
    generatedAt: Date,
  ): BoardRecommendation | undefined {
    if (task.priority !== TaskPriority.Urgent || !metric?.isOverThreshold) {
      return undefined;
    }

    return this.createRecommendation(
      task,
      BoardRecommendationType.UpdatePriority,
      BoardRecommendationSeverity.Critical,
      'Priorizar task urgente',
      `A task urgente esta parada ha ${metric.currentAgeLabel}.`,
      'Levar para o rito de prioridade e definir a proxima acao imediatamente.',
      generatedAt,
      metric.currentAgeLabel,
    );
  }

  private createRecommendation(
    task: Task,
    type: BoardRecommendationType,
    severity: BoardRecommendationSeverity,
    title: string,
    reason: string,
    suggestedAction: string,
    generatedAt: Date,
    relatedMetricLabel?: string,
  ): BoardRecommendation {
    return {
      id: `${task.id}-${type}`,
      taskId: task.id,
      taskTitle: task.title,
      type,
      severity,
      title,
      reason,
      suggestedAction,
      currentStatus: task.status,
      createdAt: generatedAt.toISOString(),
      ...(relatedMetricLabel ? { relatedMetricLabel } : {}),
    };
  }

  private mapMetricsByTask(boardTime: BoardTimeSummary): Record<string, TaskBoardTimeMetric> {
    return boardTime.taskMetrics.reduce<Record<string, TaskBoardTimeMetric>>((metrics, metric) => {
      metrics[metric.taskId] = metric;

      return metrics;
    }, {});
  }

  private countBySeverity(
    recommendations: BoardRecommendation[],
    severity: BoardRecommendationSeverity,
  ): number {
    return recommendations.filter((recommendation) => recommendation.severity === severity).length;
  }
}
