import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';
import {
  AGENT_PROMPT_CONTRACTS,
  AgentContractsResponse,
  AgentGatewayMode,
  BoardRecommendationRequest,
  TaskAnalysisRequest,
} from './app/core/models/task.model';
import { MockBoardRecommendationProvider } from './app/core/services/mock-board-recommendation.provider';
import { MockTaskAnalysisProvider } from './app/core/services/mock-task-analysis.provider';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();
const taskAnalysisProvider = new MockTaskAnalysisProvider();
const boardRecommendationProvider = new MockBoardRecommendationProvider();
const agentGatewayMode: AgentGatewayMode = 'mock';

app.use('/api/agents', express.json({ limit: '1mb' }));

app.get('/api/agents/contracts', (_req, res) => {
  const response: AgentContractsResponse = {
    mode: agentGatewayMode,
    contracts: AGENT_PROMPT_CONTRACTS,
    generatedAt: new Date().toISOString(),
  };

  res.json(response);
});

app.post('/api/agents/task-analysis', (req, res) => {
  if (!isTaskAnalysisRequest(req.body)) {
    res.status(400).json({ message: 'TaskAnalysisRequest invalido.' });
    return;
  }

  res.json(taskAnalysisProvider.analyze(req.body));
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
