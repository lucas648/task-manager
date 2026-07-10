import { AgentId } from './task.model';
import {
  AGENT_RUN_OPERATION_LABELS,
  AGENT_RUN_STATUS_LABELS,
  AGENT_RUN_STORAGE_KEY,
  AgentRunRecord,
} from './agent-run.model';

describe('agent run models', () => {
  it('defines labels, storage key, and a stable record shape', () => {
    const record: AgentRunRecord = {
      id: 'run-id',
      agentId: AgentId.InitialTaskAnalysis,
      operation: 'task_review',
      status: 'completed',
      provider: 'mock',
      createdAt: '2026-07-03T12:00:00.000Z',
      updatedAt: '2026-07-03T12:00:02.000Z',
      startedAt: '2026-07-03T12:00:00.000Z',
      completedAt: '2026-07-03T12:00:02.000Z',
      durationMs: 2000,
      inputSummary: 'Task revisada',
      outputSummary: 'Resumo gerado',
      outputCount: 2,
    };

    expect(AGENT_RUN_STORAGE_KEY).toBe('taskflow.agentRuns');
    expect(AGENT_RUN_STATUS_LABELS).toEqual({
      queued: 'Na fila',
      running: 'Executando',
      completed: 'Concluido',
      failed: 'Falhou',
    });
    expect(AGENT_RUN_OPERATION_LABELS).toEqual({
      task_review: 'Analise inicial',
      board_recommendation: 'Board Advisor',
    });
    expect(record).toMatchObject({
      agentId: AgentId.InitialTaskAnalysis,
      operation: 'task_review',
      status: 'completed',
    });
  });
});
