import {
  AGENT_CONTRACT_VERSION,
  AGENT_PROMPT_CONTRACTS,
  AgentId,
  Task,
  TaskPriority,
  TaskStatus,
} from '../models/task.model';
import { MockTaskAnalysisProvider } from './mock-task-analysis.provider';

const REVIEWED_AT = '2026-06-02T12:00:00.000Z';

function reviewTask(overrides: Partial<Task> = {}): Task {
  return {
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
    ...overrides,
  };
}

function createRequest(task: Task, includeSlowAiWarning = false) {
  return {
    task,
    requestedAt: REVIEWED_AT,
    contractVersion: AGENT_CONTRACT_VERSION,
    context: {
      includeSlowAiWarning,
    },
  };
}

describe('MockTaskAnalysisProvider', () => {
  const provider = new MockTaskAnalysisProvider();

  it('exposes the initial task analysis contract', () => {
    expect(provider.contract).toEqual(AGENT_PROMPT_CONTRACTS[AgentId.InitialTaskAnalysis]);
  });

  it('returns mocked suggestions, quality warnings, and agent metadata for a vague task', () => {
    const review = provider.analyze(createRequest(reviewTask()));

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
      agentRun: {
        agentId: AgentId.InitialTaskAnalysis,
        contractVersion: AGENT_CONTRACT_VERSION,
        provider: 'mock',
        generatedAt: REVIEWED_AT,
      },
    });
  });

  it('returns a perfect mocked score when the task is already detailed', () => {
    const review = provider.analyze(
      createRequest(
        reviewTask({
          title: 'Revisar checkout autenticado',
          description:
            'Validar todo o fluxo de checkout autenticado, incluindo pagamento, pedido criado e mensagem final para o usuario.',
          tags: ['checkout'],
          acceptanceCriteria: ['Pedido criado com sucesso.'],
        }),
      ),
    );

    expect(review.qualityScore).toEqual({
      score: 100,
      summary: 'Score 100: task clara e pronta para aprovacao humana.',
      warnings: [],
      evaluatedAt: REVIEWED_AT,
    });
    expect(review.summary).toBe('Revisao da IA gerou 0 alerta(s) e 3 sugestoes.');
  });

  it('adds a slow response warning when requested by the agent context', () => {
    const review = provider.analyze(
      createRequest(
        reviewTask({
          title: 'Revisar checkout autenticado',
          description:
            'Validar todo o fluxo de checkout autenticado, incluindo pagamento, pedido criado e mensagem final para o usuario.',
          tags: ['checkout'],
          acceptanceCriteria: ['Pedido criado com sucesso.'],
        }),
        true,
      ),
    );

    expect(review.summary).toBe('Revisao da IA gerou 1 alerta(s) e 3 sugestoes.');
    expect(review.qualityScore).toEqual({
      score: 92,
      summary: 'Score 92: existem ajustes recomendados antes da aprovacao.',
      warnings: ['Resposta lenta da IA simulada pelo Chaos Dashboard.'],
      evaluatedAt: REVIEWED_AT,
    });
  });
});
