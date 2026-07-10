import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  AGENT_PROMPT_CONTRACTS,
  AgentContractsResponse,
  AgentGatewayMode,
  AgentId,
  AgentRunMetadata,
  BoardRecommendationRequest,
  STARTER_TASKS,
  Task,
  TaskAnalysisRequest,
  TaskStatus,
} from './app/core/models/task.model';
import { resolveObservabilityConfig } from './app/core/models/observability.model';
import { MockBoardRecommendationProvider } from './app/core/services/mock-board-recommendation.provider';
import { MockTaskAnalysisProvider } from './app/core/services/mock-task-analysis.provider';
import { OpenAiTaskAnalysisProvider } from './app/core/services/openai-task-analysis.provider';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();
const taskStore = createServerTaskStore(readTaskStorePath());
const openAiTaskAnalysisProvider = new OpenAiTaskAnalysisProvider();
const taskAnalysisProvider = new MockTaskAnalysisProvider();
const boardRecommendationProvider = new MockBoardRecommendationProvider();

app.use('/api/agents', express.json({ limit: '1mb' }));
app.use('/api/tasks', express.json({ limit: '1mb' }));

app.get('/api/observability/config', (_req, res) => {
  res.json(resolveObservabilityConfig(process.env));
});

app.get('/api/tasks', (_req, res) => {
  res.json({ tasks: taskStore.list() });
});

app.put('/api/tasks', (req, res) => {
  if (!isTaskListPayload(req.body)) {
    res.status(400).json({ message: 'Lista de tasks invalida.' });
    return;
  }

  res.json({ tasks: taskStore.replace(req.body.tasks) });
});

app.post('/api/tasks', (req, res) => {
  if (!isTask(req.body)) {
    res.status(400).json({ message: 'Task invalida.' });
    return;
  }

  res.status(201).json({ task: taskStore.upsert(req.body) });
});

app.patch('/api/tasks/:taskId/status', (req, res) => {
  if (!isTaskStatus(req.body?.status)) {
    res.status(400).json({ message: 'Status invalido.' });
    return;
  }

  const task = taskStore.update(req.params['taskId'], {
    status: req.body.status,
    updatedAt: new Date().toISOString(),
  });

  if (!task) {
    res.status(404).json({ message: 'Task nao encontrada.' });
    return;
  }

  res.json({ task });
});

app.patch('/api/tasks/:taskId', (req, res) => {
  if (!isRecord(req.body)) {
    res.status(400).json({ message: 'Atualizacao invalida.' });
    return;
  }

  const task = taskStore.update(req.params['taskId'], {
    ...req.body,
    id: req.params['taskId'],
    updatedAt: new Date().toISOString(),
  });

  if (!task) {
    res.status(404).json({ message: 'Task nao encontrada.' });
    return;
  }

  res.json({ task });
});

app.delete('/api/tasks/:taskId', (req, res) => {
  if (!taskStore.delete(req.params['taskId'])) {
    res.status(404).json({ message: 'Task nao encontrada.' });
    return;
  }

  res.status(204).send();
});

app.get('/api/agents/contracts', (_req, res) => {
  const agentGatewayMode = readAgentGatewayMode();
  const response: AgentContractsResponse = {
    mode: agentGatewayMode,
    contracts: {
      ...AGENT_PROMPT_CONTRACTS,
      [AgentId.InitialTaskAnalysis]: {
        ...AGENT_PROMPT_CONTRACTS[AgentId.InitialTaskAnalysis],
        provider: openAiTaskAnalysisProvider.isConfigured() ? 'openai' : 'mock',
      },
    },
    generatedAt: new Date().toISOString(),
  };

  res.json(response);
});

app.post('/api/agents/task-analysis', async (req, res) => {
  if (!isTaskAnalysisRequest(req.body)) {
    res.status(400).json({ message: 'TaskAnalysisRequest invalido.' });
    return;
  }

  if (openAiTaskAnalysisProvider.isConfigured()) {
    try {
      res.json(await openAiTaskAnalysisProvider.analyze(req.body));
      return;
    } catch (error) {
      res.json(createFallbackTaskAnalysis(req.body, error));
      return;
    }
  }

  res.json(createFallbackTaskAnalysis(req.body, 'OPENAI_API_KEY nao configurada.'));
});

app.post('/api/agents/board-recommendations', (req, res) => {
  if (!isBoardRecommendationRequest(req.body)) {
    res.status(400).json({ message: 'BoardRecommendationRequest invalido.' });
    return;
  }

  res.json(boardRecommendationProvider.recommend(req.body));
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);

function isTaskAnalysisRequest(value: unknown): value is TaskAnalysisRequest {
  return (
    isRecord(value) &&
    isRecord(value['task']) &&
    typeof value['requestedAt'] === 'string' &&
    typeof value['contractVersion'] === 'string' &&
    isRecord(value['context'])
  );
}

function isTaskListPayload(value: unknown): value is { tasks: Task[] } {
  return isRecord(value) && Array.isArray(value['tasks']) && value['tasks'].every(isTask);
}

function isTask(value: unknown): value is Task {
  return (
    isRecord(value) &&
    typeof value['id'] === 'string' &&
    typeof value['title'] === 'string' &&
    typeof value['description'] === 'string' &&
    typeof value['priority'] === 'string' &&
    isTaskStatus(value['status']) &&
    typeof value['category'] === 'string' &&
    isStringArray(value['tags']) &&
    isStringArray(value['acceptanceCriteria']) &&
    typeof value['createdAt'] === 'string' &&
    typeof value['updatedAt'] === 'string' &&
    Array.isArray(value['aiSuggestions']) &&
    Array.isArray(value['auditLogs'])
  );
}

function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === 'string' && Object.values(TaskStatus).includes(value as TaskStatus);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isBoardRecommendationRequest(value: unknown): value is BoardRecommendationRequest {
  return (
    isRecord(value) &&
    Array.isArray(value['tasks']) &&
    isRecord(value['boardTime']) &&
    typeof value['requestedAt'] === 'string' &&
    typeof value['contractVersion'] === 'string'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readAgentGatewayMode(): AgentGatewayMode {
  return openAiTaskAnalysisProvider.isConfigured() ? 'http' : 'mock';
}

function createFallbackTaskAnalysis(request: TaskAnalysisRequest, reason: unknown) {
  const fallbackReview = taskAnalysisProvider.analyze(request);

  return {
    ...fallbackReview,
    agentRun: {
      ...(fallbackReview.agentRun as AgentRunMetadata),
      fallbackReason: `Fallback mockado no gateway: ${String(reason)}`,
    },
  };
}

function readTaskStorePath(): string {
  return process.env['TASKFLOW_TASKS_FILE'] ?? join(process.cwd(), '.taskflow', 'tasks.json');
}

function createServerTaskStore(filePath: string) {
  let cachedTasks: Task[] | undefined;

  function list(): Task[] {
    return cloneTasks(readTasks());
  }

  function replace(tasks: Task[]): Task[] {
    return writeTasks(tasks);
  }

  function upsert(task: Task): Task {
    const tasks = readTasks();
    const taskIndex = tasks.findIndex((candidate) => candidate.id === task.id);
    const updatedTask = cloneTask(task);

    if (taskIndex >= 0) {
      tasks[taskIndex] = updatedTask;
    } else {
      tasks.unshift(updatedTask);
    }

    writeTasks(tasks);

    return cloneTask(updatedTask);
  }

  function update(taskId: string, update: Partial<Task>): Task | undefined {
    const tasks = readTasks();
    const taskIndex = tasks.findIndex((candidate) => candidate.id === taskId);

    if (taskIndex < 0) {
      return undefined;
    }

    const updatedTask: Task = {
      ...tasks[taskIndex],
      ...update,
      id: tasks[taskIndex].id,
    };

    tasks[taskIndex] = updatedTask;
    writeTasks(tasks);

    return cloneTask(updatedTask);
  }

  function deleteTask(taskId: string): boolean {
    const tasks = readTasks();
    const updatedTasks = tasks.filter((task) => task.id !== taskId);

    if (updatedTasks.length === tasks.length) {
      return false;
    }

    writeTasks(updatedTasks);

    return true;
  }

  function readTasks(): Task[] {
    if (cachedTasks) {
      return cloneTasks(cachedTasks);
    }

    if (!existsSync(filePath)) {
      cachedTasks = cloneTasks(STARTER_TASKS);
      return cloneTasks(cachedTasks);
    }

    try {
      const parsedTasks = JSON.parse(readFileSync(filePath, 'utf-8')) as unknown;
      cachedTasks =
        Array.isArray(parsedTasks) && parsedTasks.every(isTask)
          ? cloneTasks(parsedTasks)
          : cloneTasks(STARTER_TASKS);

      return cloneTasks(cachedTasks);
    } catch {
      cachedTasks = cloneTasks(STARTER_TASKS);
      return cloneTasks(cachedTasks);
    }
  }

  function writeTasks(tasks: Task[]): Task[] {
    cachedTasks = cloneTasks(tasks);
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, JSON.stringify(cachedTasks, null, 2));

    return cloneTasks(cachedTasks);
  }

  return {
    list,
    replace,
    upsert,
    update,
    delete: deleteTask,
  };
}

function cloneTask(task: Task): Task {
  return JSON.parse(JSON.stringify(task)) as Task;
}

function cloneTasks(tasks: Task[]): Task[] {
  return tasks.map((task) => cloneTask(task));
}
