import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';

type TaskStatus = 'pending' | 'in_progress' | 'done';
type TaskFilter = 'all' | TaskStatus;

interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
}

interface StatusOption {
  value: TaskStatus;
  label: string;
}

interface FilterOption {
  value: TaskFilter;
  label: string;
}

interface TaskColumn {
  status: TaskStatus;
  label: string;
  caption: string;
}

const STORAGE_KEY = 'task-manager.tasks';

const STARTER_TASKS: Task[] = [
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

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly fb = inject(FormBuilder);

  protected readonly statusOptions: StatusOption[] = [
    { value: 'pending', label: 'Pendente' },
    { value: 'in_progress', label: 'Em andamento' },
    { value: 'done', label: 'Concluida' },
  ];

  protected readonly filterOptions: FilterOption[] = [
    { value: 'all', label: 'Todas' },
    ...this.statusOptions,
  ];

  protected readonly columns: TaskColumn[] = [
    { status: 'pending', label: 'Pendentes', caption: 'Aguardando inicio' },
    { status: 'in_progress', label: 'Em andamento', caption: 'Trabalho ativo' },
    { status: 'done', label: 'Concluidas', caption: 'Entrega registrada' },
  ];

  protected readonly tasks = signal<Task[]>(this.loadTasks());
  protected readonly filter = signal<TaskFilter>('all');
  protected readonly searchTerm = signal('');

  protected readonly taskForm = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(3)]],
    description: [''],
    status: ['pending' as TaskStatus, [Validators.required]],
  });

  protected readonly filteredTasks = computed(() => {
    const selectedFilter = this.filter();
    const term = this.searchTerm().trim().toLowerCase();

    return this.tasks().filter((task) => {
      const matchesStatus = selectedFilter === 'all' || task.status === selectedFilter;
      const searchableText = `${task.title} ${task.description}`.toLowerCase();
      const matchesSearch = !term || searchableText.includes(term);

      return matchesStatus && matchesSearch;
    });
  });

  private readonly persistTasks = effect(() => {
    if (!this.canUseStorage()) {
      return;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.tasks()));
  });

  protected addTask(): void {
    if (this.taskForm.invalid) {
      this.taskForm.markAllAsTouched();
      return;
    }

    const now = new Date().toISOString();
    const task = this.taskForm.getRawValue();

    this.tasks.update((tasks) => [
      {
        id: this.createId(),
        title: task.title.trim(),
        description: task.description.trim(),
        status: task.status,
        createdAt: now,
        updatedAt: now,
      },
      ...tasks,
    ]);

    this.taskForm.reset({
      title: '',
      description: '',
      status: 'pending',
    });
  }

  protected changeStatus(taskId: string, status: TaskStatus): void {
    const now = new Date().toISOString();

    this.tasks.update((tasks) =>
      tasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              status,
              updatedAt: now,
            }
          : task
      )
    );
  }

  protected deleteTask(taskId: string): void {
    this.tasks.update((tasks) => tasks.filter((task) => task.id !== taskId));
  }

  protected setFilter(filter: TaskFilter): void {
    this.filter.set(filter);
  }

  protected setSearch(term: string): void {
    this.searchTerm.set(term);
  }

  protected tasksByStatus(status: TaskStatus): Task[] {
    return this.filteredTasks().filter((task) => task.status === status);
  }

  protected countByStatus(status: TaskStatus): number {
    return this.tasks().filter((task) => task.status === status).length;
  }

  private loadTasks(): Task[] {
    if (!this.canUseStorage()) {
      return STARTER_TASKS;
    }

    const storedTasks = localStorage.getItem(STORAGE_KEY);

    if (!storedTasks) {
      return STARTER_TASKS;
    }

    try {
      const parsedTasks = JSON.parse(storedTasks) as Task[];
      return Array.isArray(parsedTasks) ? parsedTasks : STARTER_TASKS;
    } catch {
      return STARTER_TASKS;
    }
  }

  private canUseStorage(): boolean {
    return typeof localStorage !== 'undefined';
  }

  private createId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}
