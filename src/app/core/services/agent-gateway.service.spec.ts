import { TestBed } from '@angular/core/testing';
import {
  AGENT_CONTRACT_VERSION,
  AGENT_PROMPT_CONTRACTS,
  AgentId,
  BoardRecommendationSummary,
  BoardTimeSummary,
  DEFAULT_AGENT_GATEWAY_CONFIG,
  Task,
  TaskPriority,
  TaskStatus,
} from '../models/task.model';
import {
  AGENT_GATEWAY_CONFIG,
  AGENT_GATEWAY_FETCH,
  AgentGatewayClient,
  AgentGatewayError,
  AgentGatewayFetch,
  HttpBoardRecommendationProvider,
  HttpTaskAnalysisProvider,
} from './agent-gateway.service';

const REQUESTED_AT = '2026-06-22T12:00:00.000Z';

const TASK: Task = {
  id: 'task-id',
  title: 'Revisar task inicial',
  description:
    'Validar se a task possui contexto, responsavel, prazo e criterios objetivos antes do fluxo.',
  priority: TaskPriority.High,
  status: TaskStatus.Draft,
  category: 'Produto',
  tags: ['ai'],
  acceptanceCriteria: ['Contexto revisado.'],
  createdAt: REQUESTED_AT,
  updatedAt: REQUESTED_AT,
  aiSuggestions: [],
  auditLogs: [],
};

const BOARD_TIME: BoardTimeSummary = {
  generatedAt: REQUESTED_AT,
  taskMetrics: [],
  statusMetrics: [],
};

const TASK_ANALYSIS_REQUEST = {
  task: TASK,
  requestedAt: REQUESTED_AT,
  contractVersion: AGENT_CONTRACT_VERSION,
  context: {
    includeSlowAiWarning: false,
  },
};

const BOARD_RECOMMENDATION_REQUEST = {
  tasks: [TASK],
  boardTime: BOARD_TIME,
  requestedAt: REQUESTED_AT,
  contractVersion: AGENT_CONTRACT_VERSION,
};

const REVIEW_RESULT = {
  reviewedAt: REQUESTED_AT,
  summary: 'Revisao concluida.',
  suggestions: [],
  qualityScore: {
    score: 100,
    summary: 'Task clara.',
    warnings: [],
    evaluatedAt: REQUESTED_AT,
  },
};

const RECOMMENDATION_RESULT: BoardRecommendationSummary = {
  generatedAt: REQUESTED_AT,
  recommendations: [],
  total: 0,
  infoCount: 0,
  warningCount: 0,
  criticalCount: 0,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  });
}

describe('AgentGatewayClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    TestBed.resetTestingModule();
  });

  it('resolves default gateway config and fetch implementation', async () => {
    const fetchSpy = vi.fn(async () => jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchSpy);
    TestBed.configureTestingModule({});

    const fetchImpl = TestBed.inject(AGENT_GATEWAY_FETCH);

    expect(TestBed.inject(AGENT_GATEWAY_CONFIG)).toEqual(DEFAULT_AGENT_GATEWAY_CONFIG);
    await fetchImpl('/api/ping');
    expect(fetchSpy).toHaveBeenCalledWith('/api/ping');
  });

  it('reads agent contracts through the gateway', async () => {
    const gatewayResponse = {
      mode: 'mock',
      contracts: AGENT_PROMPT_CONTRACTS,
      generatedAt: REQUESTED_AT,
    };
    const fetchSpy = vi.fn(async () => jsonResponse(gatewayResponse));
    TestBed.configureTestingModule({
      providers: [
        AgentGatewayClient,
        {
          provide: AGENT_GATEWAY_FETCH,
          useValue: fetchSpy,
        },
      ],
    });

    await expect(TestBed.inject(AgentGatewayClient).readContracts()).resolves.toEqual(
      gatewayResponse,
    );
    expect(fetchSpy).toHaveBeenCalledWith('/api/agents/contracts', {
      method: 'GET',
      headers: {
        accept: 'application/json',
      },
    });
  });

  it('posts task analysis and board recommendation requests through configured endpoints', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(REVIEW_RESULT))
      .mockResolvedValueOnce(jsonResponse(RECOMMENDATION_RESULT));
    TestBed.configureTestingModule({
      providers: [
        AgentGatewayClient,
        {
          provide: AGENT_GATEWAY_CONFIG,
          useValue: {
            mode: 'http',
            baseUrl: '/custom-agents',
            endpoints: {
              contracts: 'contracts',
              taskAnalysis: 'task-analysis',
              boardRecommendations: 'board-recommendations',
            },
          },
        },
        {
          provide: AGENT_GATEWAY_FETCH,
          useValue: fetchSpy as AgentGatewayFetch,
        },
      ],
    });
    const client = TestBed.inject(AgentGatewayClient);

    await expect(client.analyzeTask(TASK_ANALYSIS_REQUEST)).resolves.toEqual(REVIEW_RESULT);
    await expect(client.recommendBoard(BOARD_RECOMMENDATION_REQUEST)).resolves.toEqual(
      RECOMMENDATION_RESULT,
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(1, '/custom-agents/task-analysis', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify(TASK_ANALYSIS_REQUEST),
    });
    expect(fetchSpy).toHaveBeenNthCalledWith(2, '/custom-agents/board-recommendations', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify(BOARD_RECOMMENDATION_REQUEST),
    });
  });

  it('throws a typed error when the gateway returns a non-success response', async () => {
    const fetchSpy = vi.fn(async () => jsonResponse({ message: 'falha' }, 503));
    TestBed.configureTestingModule({
      providers: [
        AgentGatewayClient,
        {
          provide: AGENT_GATEWAY_FETCH,
          useValue: fetchSpy,
        },
      ],
    });

    await expect(TestBed.inject(AgentGatewayClient).readContracts()).rejects.toEqual(
      new AgentGatewayError('Agent gateway retornou status 503.', 503),
    );
  });
});

describe('HTTP agent providers', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('delegates task analysis to the gateway client', async () => {
    const gatewayClient = {
      analyzeTask: vi.fn(async () => REVIEW_RESULT),
    };
    TestBed.configureTestingModule({
      providers: [
        HttpTaskAnalysisProvider,
        {
          provide: AgentGatewayClient,
          useValue: gatewayClient,
        },
      ],
    });
    const provider = TestBed.inject(HttpTaskAnalysisProvider);

    await expect(provider.analyze(TASK_ANALYSIS_REQUEST)).resolves.toEqual(REVIEW_RESULT);
    expect(provider.contract).toEqual({
      ...AGENT_PROMPT_CONTRACTS[AgentId.InitialTaskAnalysis],
      provider: 'gateway',
    });
    expect(gatewayClient.analyzeTask).toHaveBeenCalledWith(TASK_ANALYSIS_REQUEST);
  });

  it('delegates board recommendations to the gateway client', async () => {
    const gatewayClient = {
      recommendBoard: vi.fn(async () => RECOMMENDATION_RESULT),
    };
    TestBed.configureTestingModule({
      providers: [
        HttpBoardRecommendationProvider,
        {
          provide: AgentGatewayClient,
          useValue: gatewayClient,
        },
      ],
    });
    const provider = TestBed.inject(HttpBoardRecommendationProvider);

    await expect(provider.recommend(BOARD_RECOMMENDATION_REQUEST)).resolves.toEqual(
      RECOMMENDATION_RESULT,
    );
    expect(provider.contract).toEqual({
      ...AGENT_PROMPT_CONTRACTS[AgentId.BoardAdvisor],
      provider: 'gateway',
    });
    expect(gatewayClient.recommendBoard).toHaveBeenCalledWith(BOARD_RECOMMENDATION_REQUEST);
  });
});
