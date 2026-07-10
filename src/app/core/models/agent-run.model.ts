import { AgentId, AgentProviderKind } from './task.model';

export type AgentRunStatus = 'queued' | 'running' | 'completed' | 'failed';
export type AgentRunOperation = 'task_review' | 'board_recommendation';

export interface AgentRunRecord {
  id: string;
  agentId: AgentId;
  operation: AgentRunOperation;
  status: AgentRunStatus;
  provider: AgentProviderKind;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  taskId?: string;
  taskTitle?: string;
  inputSummary: string;
  outputSummary?: string;
  outputCount?: number;
  errorMessage?: string;
  fallbackReason?: string;
}

export interface AgentRunStartInput {
  agentId: AgentId;
  operation: AgentRunOperation;
  provider: AgentProviderKind;
  inputSummary: string;
  taskId?: string;
  taskTitle?: string;
}

export interface AgentRunCompleteInput {
  provider?: AgentProviderKind;
  outputSummary: string;
  outputCount: number;
  fallbackReason?: string;
}

export const AGENT_RUN_STORAGE_KEY = 'taskflow.agentRuns';

export const AGENT_RUN_STATUS_LABELS: Record<AgentRunStatus, string> = {
  queued: 'Na fila',
  running: 'Executando',
  completed: 'Concluido',
  failed: 'Falhou',
};

export const AGENT_RUN_OPERATION_LABELS: Record<AgentRunOperation, string> = {
  task_review: 'Analise inicial',
  board_recommendation: 'Board Advisor',
};
