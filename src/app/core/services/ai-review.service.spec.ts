import { TaskPriority, TaskStatus } from '../models/task.model';
import { AiReviewService } from './ai-review.service';

const REVIEWED_AT = '2026-06-02T12:00:00.000Z';

describe('AiReviewService', () => {
  it('returns mocked suggestions and quality warnings for a vague task', () => {
    const service = new AiReviewService();

    const review = service.review(
      {
        id: 'task-id',
        title: 'Bug',
        description: 'Corrigir',
        priority: TaskPriority.High,
        status: TaskStatus.Draft,
        category: 'Produto',
        tags: [],
        acceptanceCriteria: [],
        createdAt: REVIEWED_AT,
        updatedAt: REVIEWED_AT,
        aiSuggestions: [],
        auditLogs: [],
      },
      REVIEWED_AT,
    );

    expect(review).toEqual({
      reviewedAt: REVIEWED_AT,
      summary: 'Revisao da IA gerou 4 alerta(s) e 3 sugestoes.',
      suggestions: [
        {
          id: 'task-id-title-ai-suggestion',
          field: 'title',
          originalValue: 'Bug',
          suggestedValue: 'Bug - objetivo e resultado esperado',
          reason: 'O titulo ganha contexto de entrega e facilita triagem.',
          decision: 'pending',
        },
        {
          id: 'task-id-description-ai-suggestion',
          field: 'description',
          originalValue: 'Corrigir',
          suggestedValue:
            'Na categoria Produto, executar "Bug" considerando impacto, responsavel, prazo e validacao com criterios objetivos.',
          reason: 'A descricao passa a registrar contexto, impacto e validacao esperada.',
          decision: 'pending',
        },
        {
          id: 'task-id-criteria-ai-suggestion',
          field: 'acceptanceCriteria',
          originalValue: [],
          suggestedValue: [
            'Cenario principal de "Bug" validado.',
            'Responsavel e evidencias registrados antes da publicacao.',
            'Resultado final revisado com criterios objetivos.',
          ],
          reason: 'Criterios explicitos reduzem ambiguidade na aprovacao humana.',
          decision: 'pending',
        },
      ],
      qualityScore: {
        score: 52,
        summary: 'Score 52: existem ajustes recomendados antes da aprovacao.',
        warnings: [
          'Titulo curto para triagem enterprise.',
          'Descricao pode detalhar mais contexto e impacto.',
          'Nenhum criterio de aceite informado.',
          'Sem tags para agrupamento e busca.',
        ],
        evaluatedAt: REVIEWED_AT,
      },
    });
  });

  it('returns a perfect mocked score when the task is already detailed', () => {
    const service = new AiReviewService();
    const review = service.review(
      {
        id: 'task-id',
        title: 'Revisar checkout autenticado',
        description:
          'Validar todo o fluxo de checkout autenticado, incluindo pagamento, pedido criado e mensagem final para o usuario.',
        priority: TaskPriority.High,
        status: TaskStatus.Draft,
        category: 'Produto',
        tags: ['checkout'],
        acceptanceCriteria: ['Pedido criado com sucesso.'],
        createdAt: REVIEWED_AT,
        updatedAt: REVIEWED_AT,
        aiSuggestions: [],
        auditLogs: [],
      },
      REVIEWED_AT,
    );

    expect(review.qualityScore).toEqual({
      score: 100,
      summary: 'Score 100: task clara e pronta para aprovacao humana.',
      warnings: [],
      evaluatedAt: REVIEWED_AT,
    });
    expect(review.summary).toBe('Revisao da IA gerou 0 alerta(s) e 3 sugestoes.');
  });
});
