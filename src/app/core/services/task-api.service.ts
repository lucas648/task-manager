import { inject, Injectable, InjectionToken } from '@angular/core';
import { Task, TaskStatus } from '../models/task.model';

export type TaskApiFetch = typeof fetch;

interface TaskListResponse {
  tasks: Task[];
}

interface TaskResponse {
  task: Task;
}

export const TASK_API_BASE_URL = new InjectionToken<string>('TaskApiBaseUrl', {
  providedIn: 'root',
  factory: () => '/api/tasks',
});

export const TASK_API_FETCH = new InjectionToken<TaskApiFetch>('TaskApiFetch', {
  providedIn: 'root',
  factory: () => globalThis.fetch.bind(globalThis),
});

export class TaskApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'TaskApiError';
  }
}

@Injectable({ providedIn: 'root' })
export class TaskApiClient {
  private readonly baseUrl = inject(TASK_API_BASE_URL);
  private readonly fetchImpl = inject(TASK_API_FETCH);

  async listTasks(): Promise<Task[]> {
    const response = await this.fetchImpl(this.buildUrl(), {
      method: 'GET',
      headers: {
        accept: 'application/json',
      },
    });

    return this.parseJson<TaskListResponse>(response).then((body) => body.tasks);
  }

  async replaceTasks(tasks: Task[]): Promise<Task[]> {
    const response = await this.fetchImpl(this.buildUrl(), {
      method: 'PUT',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ tasks }),
    });

    return this.parseJson<TaskListResponse>(response).then((body) => body.tasks);
  }

  async createTask(task: Task): Promise<Task> {
    const response = await this.fetchImpl(this.buildUrl(), {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify(task),
    });

    return this.parseJson<TaskResponse>(response).then((body) => body.task);
  }

  async updateTask(taskId: string, update: Partial<Task>): Promise<Task> {
    const response = await this.fetchImpl(this.buildUrl(encodeURIComponent(taskId)), {
      method: 'PATCH',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify(update),
    });

    return this.parseJson<TaskResponse>(response).then((body) => body.task);
  }

  async changeTaskStatus(taskId: string, status: TaskStatus): Promise<Task> {
    const response = await this.fetchImpl(this.buildUrl(`${encodeURIComponent(taskId)}/status`), {
      method: 'PATCH',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ status }),
    });

    return this.parseJson<TaskResponse>(response).then((body) => body.task);
  }

  async deleteTask(taskId: string): Promise<void> {
    const response = await this.fetchImpl(this.buildUrl(encodeURIComponent(taskId)), {
      method: 'DELETE',
      headers: {
        accept: 'application/json',
      },
    });

    return this.parseEmpty(response);
  }

  private async parseJson<ResponseBody>(response: Response): Promise<ResponseBody> {
    if (!response.ok) {
      throw new TaskApiError(`Task API retornou status ${response.status}.`, response.status);
    }

    return (await response.json()) as ResponseBody;
  }

  private async parseEmpty(response: Response): Promise<void> {
    if (!response.ok) {
      throw new TaskApiError(`Task API retornou status ${response.status}.`, response.status);
    }
  }

  private buildUrl(path = ''): string {
    return path ? `${this.baseUrl}/${path}` : this.baseUrl;
  }
}
