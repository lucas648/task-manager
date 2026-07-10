import { TestBed } from '@angular/core/testing';
import { Task, TaskPriority, TaskStatus } from '../models/task.model';
import {
  TASK_API_BASE_URL,
  TASK_API_FETCH,
  TaskApiClient,
  TaskApiError,
  TaskApiFetch,
} from './task-api.service';

const TASK: Task = {
  id: 'task-id',
  title: 'Sincronizar tasks',
  description: 'Validar API de persistencia',
  priority: TaskPriority.High,
  status: TaskStatus.Draft,
  category: 'Arquitetura',
  tags: ['api'],
  acceptanceCriteria: ['Endpoints respondem corretamente.'],
  createdAt: '2026-07-01T12:00:00.000Z',
  updatedAt: '2026-07-01T12:00:00.000Z',
  aiSuggestions: [],
  auditLogs: [],
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  });
}

describe('TaskApiClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    TestBed.resetTestingModule();
  });

  it('resolves default API config and fetch implementation', async () => {
    const fetchSpy = vi.fn(async () => jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchSpy);
    TestBed.configureTestingModule({});

    const fetchImpl = TestBed.inject(TASK_API_FETCH);

    expect(TestBed.inject(TASK_API_BASE_URL)).toBe('/api/tasks');
    await fetchImpl('/api/ping');
    expect(fetchSpy).toHaveBeenCalledWith('/api/ping');
  });

  it('calls all task API endpoints through the configured base URL', async () => {
    const updatedTask: Task = {
      ...TASK,
      title: 'Sincronizar tasks editadas',
      status: TaskStatus.InProgress,
    };
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ tasks: [TASK] }))
      .mockResolvedValueOnce(jsonResponse({ tasks: [updatedTask] }))
      .mockResolvedValueOnce(jsonResponse({ task: TASK }, 201))
      .mockResolvedValueOnce(jsonResponse({ task: updatedTask }))
      .mockResolvedValueOnce(jsonResponse({ task: updatedTask }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    TestBed.configureTestingModule({
      providers: [
        TaskApiClient,
        {
          provide: TASK_API_BASE_URL,
          useValue: '/custom/tasks',
        },
        {
          provide: TASK_API_FETCH,
          useValue: fetchSpy as TaskApiFetch,
        },
      ],
    });
    const client = TestBed.inject(TaskApiClient);

    await expect(client.listTasks()).resolves.toEqual([TASK]);
    await expect(client.replaceTasks([updatedTask])).resolves.toEqual([updatedTask]);
    await expect(client.createTask(TASK)).resolves.toEqual(TASK);
    await expect(client.updateTask('task/id', { title: updatedTask.title })).resolves.toEqual(
      updatedTask,
    );
    await expect(client.changeTaskStatus('task/id', TaskStatus.InProgress)).resolves.toEqual(
      updatedTask,
    );
    await expect(client.deleteTask('task/id')).resolves.toBeUndefined();

    expect(fetchSpy).toHaveBeenNthCalledWith(1, '/custom/tasks', {
      method: 'GET',
      headers: {
        accept: 'application/json',
      },
    });
    expect(fetchSpy).toHaveBeenNthCalledWith(2, '/custom/tasks', {
      method: 'PUT',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ tasks: [updatedTask] }),
    });
    expect(fetchSpy).toHaveBeenNthCalledWith(3, '/custom/tasks', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify(TASK),
    });
    expect(fetchSpy).toHaveBeenNthCalledWith(4, '/custom/tasks/task%2Fid', {
      method: 'PATCH',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ title: updatedTask.title }),
    });
    expect(fetchSpy).toHaveBeenNthCalledWith(5, '/custom/tasks/task%2Fid/status', {
      method: 'PATCH',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ status: TaskStatus.InProgress }),
    });
    expect(fetchSpy).toHaveBeenNthCalledWith(6, '/custom/tasks/task%2Fid', {
      method: 'DELETE',
      headers: {
        accept: 'application/json',
      },
    });
  });

  it('throws typed errors for JSON responses with non-success status', async () => {
    const fetchSpy = vi.fn(async () => jsonResponse({ message: 'falha' }, 503));
    TestBed.configureTestingModule({
      providers: [
        TaskApiClient,
        {
          provide: TASK_API_FETCH,
          useValue: fetchSpy as TaskApiFetch,
        },
      ],
    });

    await expect(TestBed.inject(TaskApiClient).listTasks()).rejects.toEqual(
      new TaskApiError('Task API retornou status 503.', 503),
    );
  });

  it('throws typed errors for empty responses with non-success status', async () => {
    const fetchSpy = vi.fn(async () => new Response(null, { status: 404 }));
    TestBed.configureTestingModule({
      providers: [
        TaskApiClient,
        {
          provide: TASK_API_FETCH,
          useValue: fetchSpy as TaskApiFetch,
        },
      ],
    });

    await expect(TestBed.inject(TaskApiClient).deleteTask('missing')).rejects.toEqual(
      new TaskApiError('Task API retornou status 404.', 404),
    );
  });
});
