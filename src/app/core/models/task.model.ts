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
  TaskMoved = 'TASK_MOVED',
  AiReviewStarted = 'AI_REVIEW_STARTED',
  AiReviewSuccess = 'AI_REVIEW_SUCCESS',
  AiReviewError = 'AI_REVIEW_ERROR',
  AiSuggestionApplied = 'AI_SUGGESTION_APPLIED',
  AiSuggestionRejected = 'AI_SUGGESTION_REJECTED',
  TaskApproved = 'TASK_APPROVED',
  PayloadGenerated = 'PAYLOAD_GENERATED',
  CmsSendStarted = 'CMS_SEND_STARTED',
  CmsSendSuccess = 'CMS_SEND_SUCCESS',
  CmsSendError = 'CMS_SEND_ERROR',
  ChaosScenarioEnabled = 'CHAOS_SCENARIO_ENABLED',
  ChaosScenarioDisabled = 'CHAOS_SCENARIO_DISABLED',
}

export type TaskFilter = 'all' | TaskStatus;
export type SuggestionDecision = 'pending' | 'applied' | 'rejected';
export type ChaosScenarioId =
  | 'ai_unavailable'
  | 'ai_slow'
  | 'ai_invalid_response'
  | 'cms_unavailable'
  | 'cms_timeout'
  | 'cms_duplicate_payload'
  | 'network_loss';

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

export interface AiReviewResult {
  reviewedAt: string;
  summary: string;
  suggestions: AiSuggestion[];
  qualityScore: TaskQualityScore;
}

export interface CmsSendResult {
  success: boolean;
  statusCode: number;
  message: string;
  sentAt: string;
}

export interface ChaosScenario {
  id: ChaosScenarioId;
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
  cmsPayload?: CmsPayload;
  cmsError?: string;
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

export interface WorkflowActionResult {
  success: boolean;
  message: string;
  task?: Task;
  payload?: CmsPayload;
}

export interface StatusMetric {
  status: TaskStatus;
  label: string;
  count: number;
  percentage: number;
}

export interface TaskStatusDuration {
  status: TaskStatus;
  label: string;
  startedAt: string;
  endedAt?: string;
  durationMinutes: number;
  durationLabel: string;
  isCurrent: boolean;
}

export interface TaskBoardTimeMetric {
  taskId: string;
  taskTitle: string;
  currentStatus: TaskStatus;
  statusStartedAt: string;
  currentAgeMinutes: number;
  currentAgeLabel: string;
  thresholdMinutes?: number;
  isOverThreshold: boolean;
  durations: TaskStatusDuration[];
}

export interface BoardStatusTimeMetric {
  status: TaskStatus;
  label: string;
  averageMinutes: number;
  averageLabel: string;
  longestMinutes: number;
  longestLabel: string;
  longestTaskId?: string;
  longestTaskTitle?: string;
  thresholdMinutes?: number;
  overThresholdCount: number;
}

export interface BoardTimeSummary {
  generatedAt: string;
  taskMetrics: TaskBoardTimeMetric[];
  statusMetrics: BoardStatusTimeMetric[];
}

export interface AnalyticsSummary {
  totalTasks: number;
  totalAuditLogs: number;
  aiFailures: number;
  cmsFailures: number;
  chaosEvents: number;
  acceptedSuggestions: number;
  rejectedSuggestions: number;
  suggestionAcceptanceRate: number;
  averageApprovalMinutes: number;
  statusMetrics: StatusMetric[];
  boardTime: BoardTimeSummary;
  recentEvents: AuditLog[];
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

export const BOARD_STATUS_THRESHOLDS_MINUTES: Partial<Record<TaskStatus, number>> = {
  [TaskStatus.Draft]: 1440,
  [TaskStatus.AiReviewed]: 720,
  [TaskStatus.Approved]: 1440,
  [TaskStatus.Published]: 480,
  [TaskStatus.InProgress]: 4320,
};

export const TASK_COLUMNS: TaskColumn[] = [
  { status: TaskStatus.Draft, label: 'Draft', caption: 'Aguardando revisão' },
  { status: TaskStatus.AiReviewed, label: 'AI Reviewed', caption: 'Revisada pela IA' },
  { status: TaskStatus.Approved, label: 'Approved', caption: 'Validação humana feita' },
  { status: TaskStatus.Published, label: 'Published', caption: 'Payload publicado' },
  { status: TaskStatus.InProgress, label: 'In Progress', caption: 'Trabalho ativo' },
  { status: TaskStatus.Completed, label: 'Completed', caption: 'Entrega finalizada' },
];

export const WORKFLOW_TRANSITIONS: Partial<Record<TaskStatus, TaskStatus>> = {
  [TaskStatus.Draft]: TaskStatus.AiReviewed,
  [TaskStatus.AiReviewed]: TaskStatus.Approved,
  [TaskStatus.Approved]: TaskStatus.Published,
  [TaskStatus.Published]: TaskStatus.InProgress,
  [TaskStatus.InProgress]: TaskStatus.Completed,
};

export const CHAOS_SCENARIOS: ChaosScenario[] = [
  {
    id: 'ai_unavailable',
    name: 'IA fora do ar',
    description: 'Interrompe a revisao por IA antes de gerar sugestoes.',
    enabled: false,
  },
  {
    id: 'ai_slow',
    name: 'IA lenta',
    description: 'Marca a revisao como lenta e reduz o score de qualidade.',
    enabled: false,
  },
  {
    id: 'ai_invalid_response',
    name: 'Resposta invalida da IA',
    description: 'Faz a revisao falhar por payload de IA inconsistente.',
    enabled: false,
  },
  {
    id: 'cms_unavailable',
    name: 'CMS fora do ar',
    description: 'Retorna indisponibilidade no envio ao CMS mockado.',
    enabled: false,
  },
  {
    id: 'cms_timeout',
    name: 'Timeout no envio',
    description: 'Simula estouro de tempo durante publicacao.',
    enabled: false,
  },
  {
    id: 'cms_duplicate_payload',
    name: 'Payload duplicado',
    description: 'Retorna conflito de payload ja publicado.',
    enabled: false,
  },
  {
    id: 'network_loss',
    name: 'Perda de conexao',
    description: 'Interrompe chamadas de IA e CMS por conexao indisponivel.',
    enabled: false,
  },
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
