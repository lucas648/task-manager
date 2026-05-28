import { computed, effect, Injectable, signal } from '@angular/core';
import { NewTaskInput, STARTER_TASKS, Task, TaskStatus } from '../models/task.model';

const STORAGE_KEY = 'task-manager.tasks';

@Injectable({ providedIn: 'root' })
export class TaskService {
  readonly tasks = signal<Task[]>(this.loadTasks());
  readonly totalTasks = computed(() => this.tasks().length);

  constructor() {
    effect(() => {
      if (!this.canUseStorage()) {
        return;
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.tasks()));
    });
  }

  addTask(input: NewTaskInput): Task {
    const now = new Date().toISOString();
    const task: Task = {
      id: this.createId(),
      title: input.title.trim(),
      description: input.description.trim(),
      status: input.status,
      createdAt: now,
      updatedAt: now,
    };

    this.tasks.update((tasks) => [task, ...tasks]);

    return task;
  }

  changeStatus(taskId: string, status: TaskStatus): void {
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

  deleteTask(taskId: string): void {
    this.tasks.update((tasks) => tasks.filter((task) => task.id !== taskId));
  }

  countByStatus(status: TaskStatus): number {
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
