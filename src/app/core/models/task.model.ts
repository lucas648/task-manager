export enum TaskStatus {
  Draft = 'draft',
  AiReviewed = 'ai_reviewed',
  Approved = 'approved',
  Published = 'published',
  InProgress = 'in_progress',
  Completed = 'completed',
  Rejected = 'rejected',
  Error = 'error',
}

export enum TaskPriority {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
  Urgent = 'urgent',
}

export enum AuditLogEvent {
  TaskCreated = 'TASK_CREATED',
  TaskUpdated = 'TASK_UPDATED',
  StatusChanged = 'STATUS_CHANGED',
}

export type TaskFilter = 'all' | TaskStatus;
export type SuggestionDecision = 'pending' | 'applied' | 'rejected';

export interface AuditLog {
  id: string;
  event: AuditLogEvent;
  taskId: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface AiSuggestion {
  id: string;
  field: keyof Pick<Task, 'title' | 'description' | 'acceptanceCriteria'>;
  originalValue: string | string[];
  suggestedValue: string | string[];
  reason: string;
  decision: SuggestionDecision;
}

export interface TaskQualityScore {
  score: number;
  summary: string;
  warnings: string[];
  evaluatedAt: string;
}

export interface CmsPayload {
  externalId: string;
  title: string;
  description: string;
  priority: TaskPriority;
  tags: string[];
  acceptanceCriteria: string[];
  approvedAt: string;
  source: 'taskflow-ai';
}

export interface ChaosScenario {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  category: string;
  tags: string[];
  assignee?: string;
  dueDate?: string;
  acceptanceCriteria: string[];
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  publishedAt?: string;
  aiSuggestions: AiSuggestion[];
  qualityScore?: TaskQualityScore;
  auditLogs: AuditLog[];
}

export interface NewTaskInput {
  title: string;
  description: string;
  priority: TaskPriority;
  category: string;
  tags: string[];
  assignee?: string;
  dueDate?: string;
  acceptanceCriteria: string[];
}

export interface StatusOption {
  value: TaskStatus;
  label: string;
}

export interface PriorityOption {
  value: TaskPriority;
  label: string;
}

export interface FilterOption {
  value: TaskFilter;
  label: string;
}

export interface TaskColumn {
  status: TaskStatus;
  label: string;
  caption: string;
}

export const STATUS_LABELS: Record<TaskStatus, string> = {
  [TaskStatus.Draft]: 'Draft',
  [TaskStatus.AiReviewed]: 'AI Reviewed',
  [TaskStatus.Approved]: 'Approved',
  [TaskStatus.Published]: 'Published',
  [TaskStatus.InProgress]: 'In Progress',
  [TaskStatus.Completed]: 'Completed',
  [TaskStatus.Rejected]: 'Rejected',
  [TaskStatus.Error]: 'Error',
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  [TaskPriority.Low]: 'Baixa',
  [TaskPriority.Medium]: 'Media',
  [TaskPriority.High]: 'Alta',
  [TaskPriority.Urgent]: 'Urgente',
};

export const STATUS_OPTIONS: StatusOption[] = Object.values(TaskStatus).map((status) => ({
  value: status,
  label: STATUS_LABELS[status],
}));

export const WORKFLOW_STATUS_OPTIONS: StatusOption[] = [
  TaskStatus.Draft,
  TaskStatus.AiReviewed,
  TaskStatus.Approved,
  TaskStatus.Published,
  TaskStatus.InProgress,
  TaskStatus.Completed,
].map((status) => ({
  value: status,
  label: STATUS_LABELS[status],
}));

export const PRIORITY_OPTIONS: PriorityOption[] = Object.values(TaskPriority).map((priority) => ({
  value: priority,
  label: PRIORITY_LABELS[priority],
}));

export const FILTER_OPTIONS: FilterOption[] = [{ value: 'all', label: 'Todas' }, ...STATUS_OPTIONS];

export const TASK_COLUMNS: TaskColumn[] = [
  { status: TaskStatus.Draft, label: 'Draft', caption: 'Aguardando revisão' },
  { status: TaskStatus.AiReviewed, label: 'AI Reviewed', caption: 'Revisada pela IA' },
  { status: TaskStatus.Approved, label: 'Approved', caption: 'Validação humana feita' },
  { status: TaskStatus.Published, label: 'Published', caption: 'Payload publicado' },
  { status: TaskStatus.InProgress, label: 'In Progress', caption: 'Trabalho ativo' },
  { status: TaskStatus.Completed, label: 'Completed', caption: 'Entrega finalizada' },
];

export const STARTER_TASKS: Task[] = [
  {
    id: 'starter-1',
    title: 'Receber demandas da equipe',
    description: 'Centralizar novas tarefas no fluxo TaskFlow AI.',
    priority: TaskPriority.Medium,
    status: TaskStatus.Draft,
    category: 'Operacao',
    tags: ['entrada', 'triagem'],
    acceptanceCriteria: ['Demanda registrada com titulo, contexto e prioridade.'],
    createdAt: '2026-05-28T09:00:00.000Z',
    updatedAt: '2026-05-28T09:00:00.000Z',
    aiSuggestions: [],
    auditLogs: [],
  },
  {
    id: 'starter-2',
    title: 'Acompanhar execucao',
    description: 'Mover tarefas ativas para o status de trabalho correto.',
    priority: TaskPriority.High,
    status: TaskStatus.InProgress,
    category: 'Delivery',
    tags: ['execucao'],
    assignee: 'Equipe Produto',
    acceptanceCriteria: ['Toda tarefa ativa deve ter responsavel e status atualizado.'],
    createdAt: '2026-05-28T10:00:00.000Z',
    updatedAt: '2026-05-28T10:30:00.000Z',
    aiSuggestions: [],
    auditLogs: [],
  },
  {
    id: 'starter-3',
    title: 'Registrar entregas finalizadas',
    description: 'Manter o historico das tarefas concluidas.',
    priority: TaskPriority.Low,
    status: TaskStatus.Completed,
    category: 'Auditoria',
    tags: ['historico'],
    acceptanceCriteria: ['Entrega concluida precisa ficar visivel no board.'],
    createdAt: '2026-05-28T08:30:00.000Z',
    updatedAt: '2026-05-28T11:00:00.000Z',
    aiSuggestions: [],
    auditLogs: [],
  },
];
