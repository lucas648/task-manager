export type TaskStatus = 'pending' | 'in_progress' | 'done';
export type TaskFilter = 'all' | TaskStatus;

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
}

export interface NewTaskInput {
  title: string;
  description: string;
  status: TaskStatus;
}

export interface StatusOption {
  value: TaskStatus;
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

export const STATUS_OPTIONS: StatusOption[] = [
  { value: 'pending', label: 'Pendente' },
  { value: 'in_progress', label: 'Em andamento' },
  { value: 'done', label: 'Concluida' },
];

export const FILTER_OPTIONS: FilterOption[] = [
  { value: 'all', label: 'Todas' },
  ...STATUS_OPTIONS,
];

export const TASK_COLUMNS: TaskColumn[] = [
  { status: 'pending', label: 'Pendentes', caption: 'Aguardando inicio' },
  { status: 'in_progress', label: 'Em andamento', caption: 'Trabalho ativo' },
  { status: 'done', label: 'Concluidas', caption: 'Entrega registrada' },
];

export const STARTER_TASKS: Task[] = [
  {
    id: 'starter-1',
    title: 'Receber demandas da equipe',
    description: 'Centralizar novas tarefas no quadro.',
    status: 'pending',
    createdAt: '2026-05-28T09:00:00.000Z',
    updatedAt: '2026-05-28T09:00:00.000Z',
  },
  {
    id: 'starter-2',
    title: 'Acompanhar execucao',
    description: 'Mover tarefas ativas para em andamento.',
    status: 'in_progress',
    createdAt: '2026-05-28T10:00:00.000Z',
    updatedAt: '2026-05-28T10:30:00.000Z',
  },
  {
    id: 'starter-3',
    title: 'Registrar entregas finalizadas',
    description: 'Manter o historico das tarefas concluidas.',
    status: 'done',
    createdAt: '2026-05-28T08:30:00.000Z',
    updatedAt: '2026-05-28T11:00:00.000Z',
  },
];
