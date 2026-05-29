import { TestBed } from '@angular/core/testing';
import { STARTER_TASKS, Task } from '../models/task.model';
import { TaskService } from './task.service';

const STORAGE_KEY = 'task-manager.tasks';
const TEST_NOW = '2026-05-29T12:00:00.000Z';

function setupStorage(initialValue: string | null = null) {
  let storedValue = initialValue;

  const storage = {
    getItem: vi.fn((key: string) => (key === STORAGE_KEY ? storedValue : null)),
    setItem: vi.fn((key: string, value: string) => {
      if (key === STORAGE_KEY) {
        storedValue = value;
      }
    }),
    removeItem: vi.fn(),
    clear: vi.fn(),
    key: vi.fn(),
    get length() {
      return storedValue ? 1 : 0;
    },
  };

  vi.stubGlobal('localStorage', storage);

  return storage;
}

function setupService(): TaskService {
  TestBed.configureTestingModule({ providers: [TaskService] });
  return TestBed.inject(TaskService);
}

describe('TaskService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(TEST_NOW));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('loads starter tasks when storage is unavailable and creates fallback ids', () => {
    vi.stubGlobal('localStorage', undefined);
    vi.stubGlobal('crypto', undefined);
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const service = setupService();
    TestBed.tick();
    const task = service.addTask({
      title: '  Nova tarefa  ',
      description: '  Detalhe  ',
      status: 'pending',
    });

    expect(service.totalTasks()).toBe(STARTER_TASKS.length + 1);
    expect(service.countByStatus('pending')).toBe(2);
    expect(task).toEqual({
      id: `${new Date(TEST_NOW).getTime()}-i`,
      title: 'Nova tarefa',
      description: 'Detalhe',
      status: 'pending',
      createdAt: TEST_NOW,
      updatedAt: TEST_NOW,
    });
  });

  it('loads starter tasks from empty storage, uses crypto ids, and persists updates', () => {
    const storage = setupStorage(null);
    vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'task-id') });

    const service = setupService();
    const task = service.addTask({
      title: 'Criar roteiro',
      description: 'Preparar pauta da sprint',
      status: 'in_progress',
    });
    TestBed.tick();

    expect(task.id).toBe('task-id');
    expect(service.tasks()[0]).toEqual({
      id: 'task-id',
      title: 'Criar roteiro',
      description: 'Preparar pauta da sprint',
      status: 'in_progress',
      createdAt: TEST_NOW,
      updatedAt: TEST_NOW,
    });
    expect(storage.setItem).toHaveBeenLastCalledWith(STORAGE_KEY, JSON.stringify(service.tasks()));
  });

  it('loads stored arrays, changes status, deletes tasks, and keeps other tasks intact', () => {
    const storedTasks: Task[] = [
      {
        id: 'one',
        title: 'Primeira',
        description: 'Detalhe um',
        status: 'pending',
        createdAt: '2026-05-29T08:00:00.000Z',
        updatedAt: '2026-05-29T08:00:00.000Z',
      },
      {
        id: 'two',
        title: 'Segunda',
        description: 'Detalhe dois',
        status: 'done',
        createdAt: '2026-05-29T09:00:00.000Z',
        updatedAt: '2026-05-29T09:00:00.000Z',
      },
    ];
    setupStorage(JSON.stringify(storedTasks));

    const service = setupService();

    expect(service.tasks()).toEqual(storedTasks);

    service.changeStatus('one', 'in_progress');
    expect(service.tasks()).toEqual([
      {
        ...storedTasks[0],
        status: 'in_progress',
        updatedAt: TEST_NOW,
      },
      storedTasks[1],
    ]);
    expect(service.countByStatus('in_progress')).toBe(1);

    service.deleteTask('two');
    expect(service.tasks()).toEqual([
      {
        ...storedTasks[0],
        status: 'in_progress',
        updatedAt: TEST_NOW,
      },
    ]);
  });

  it('falls back to starter tasks for non-array stored values', () => {
    setupStorage(JSON.stringify({ id: 'not-an-array' }));

    const service = setupService();

    expect(service.tasks()).toEqual(STARTER_TASKS);
  });

  it('falls back to starter tasks for invalid JSON', () => {
    setupStorage('{invalid json');

    const service = setupService();

    expect(service.tasks()).toEqual(STARTER_TASKS);
  });

  it('creates fallback ids when crypto exists without randomUUID', () => {
    setupStorage(null);
    vi.stubGlobal('crypto', {});
    vi.spyOn(Math, 'random').mockReturnValue(0.75);

    const service = setupService();
    const task = service.addTask({
      title: 'Sem randomUUID',
      description: '',
      status: 'done',
    });

    expect(task.id).toBe(`${new Date(TEST_NOW).getTime()}-r`);
  });
});
