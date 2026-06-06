import { Injectable } from '@angular/core';
import { AiReviewResult, AiSuggestion, Task, TaskQualityScore } from '../models/task.model';

@Injectable({ providedIn: 'root' })
export class AiReviewService {
  review(task: Task, reviewedAt = new Date().toISOString()): AiReviewResult {
    const warnings = this.buildWarnings(task);
    const score = 100 - warnings.length * 12;
    const qualityScore: TaskQualityScore = {
      score,
      summary: warnings.length
        ? `Score ${score}: existem ajustes recomendados antes da aprovacao.`
        : `Score ${score}: task clara e pronta para aprovacao humana.`,
      warnings,
      evaluatedAt: reviewedAt,
    };

    return {
      reviewedAt,
      summary: `Revisao da IA gerou ${warnings.length} alerta(s) e 3 sugestoes.`,
      suggestions: this.buildSuggestions(task),
      qualityScore,
    };
  }

  private buildSuggestions(task: Task): AiSuggestion[] {
    return [
      {
        id: `${task.id}-title-ai-suggestion`,
        field: 'title',
        originalValue: task.title,
        suggestedValue: `${task.title.trim()} - objetivo e resultado esperado`,
        reason: 'O titulo ganha contexto de entrega e facilita triagem.',
        decision: 'pending',
      },
      {
        id: `${task.id}-description-ai-suggestion`,
        field: 'description',
        originalValue: task.description,
        suggestedValue: `Na categoria ${task.category}, executar "${task.title.trim()}" considerando impacto, responsavel, prazo e validacao com criterios objetivos.`,
        reason: 'A descricao passa a registrar contexto, impacto e validacao esperada.',
        decision: 'pending',
      },
      {
        id: `${task.id}-criteria-ai-suggestion`,
        field: 'acceptanceCriteria',
        originalValue: task.acceptanceCriteria,
        suggestedValue: [
          `Cenario principal de "${task.title.trim()}" validado.`,
          'Responsavel e evidencias registrados antes da publicacao.',
          'Resultado final revisado com criterios objetivos.',
        ],
        reason: 'Criterios explicitos reduzem ambiguidade na aprovacao humana.',
        decision: 'pending',
      },
    ];
  }

  private buildWarnings(task: Task): string[] {
    return [
      task.title.trim().length < 12 ? 'Titulo curto para triagem enterprise.' : '',
      task.description.trim().length < 80 ? 'Descricao pode detalhar mais contexto e impacto.' : '',
      task.acceptanceCriteria.length === 0 ? 'Nenhum criterio de aceite informado.' : '',
      task.tags.length === 0 ? 'Sem tags para agrupamento e busca.' : '',
    ].filter(Boolean);
  }
}
