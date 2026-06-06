import { TestBed } from '@angular/core/testing';
import { ChaosScenarioId, CmsPayload, TaskPriority } from '../models/task.model';
import { ChaosService } from './chaos.service';
import { CmsService } from './cms.service';

const SENT_AT = '2026-06-02T12:00:00.000Z';

const PAYLOAD: CmsPayload = {
  externalId: 'task-id',
  title: 'Publicar pauta',
  description: 'Enviar payload',
  priority: TaskPriority.Medium,
  tags: ['cms'],
  acceptanceCriteria: ['Payload valido'],
  approvedAt: SENT_AT,
  source: 'taskflow-ai',
};

function setupService(enabledScenarios: ChaosScenarioId[] = []): CmsService {
  const enabled = new Set(enabledScenarios);

  TestBed.configureTestingModule({
    providers: [
      CmsService,
      {
        provide: ChaosService,
        useValue: {
          isEnabled: vi.fn((scenarioId: ChaosScenarioId) => enabled.has(scenarioId)),
        },
      },
    ],
  });

  return TestBed.inject(CmsService);
}

describe('CmsService', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('simulates a successful CMS send', () => {
    expect(setupService().send(PAYLOAD, SENT_AT)).toEqual({
      success: true,
      statusCode: 202,
      message: 'Payload task-id aceito pelo CMS mockado.',
      sentAt: SENT_AT,
    });
  });

  it('simulates network loss, unavailable CMS, timeout, and duplicate payload', () => {
    expect(setupService(['network_loss']).send(PAYLOAD, SENT_AT)).toEqual({
      success: false,
      statusCode: 0,
      message: 'Perda de conexao simulada durante envio ao CMS.',
      sentAt: SENT_AT,
    });

    TestBed.resetTestingModule();
    expect(setupService(['cms_unavailable']).send(PAYLOAD, SENT_AT)).toEqual({
      success: false,
      statusCode: 503,
      message: 'CMS fora do ar no cenario de caos.',
      sentAt: SENT_AT,
    });

    TestBed.resetTestingModule();
    expect(setupService(['cms_timeout']).send(PAYLOAD, SENT_AT)).toEqual({
      success: false,
      statusCode: 408,
      message: 'Timeout simulado durante envio ao CMS.',
      sentAt: SENT_AT,
    });

    TestBed.resetTestingModule();
    expect(setupService(['cms_duplicate_payload']).send(PAYLOAD, SENT_AT)).toEqual({
      success: false,
      statusCode: 409,
      message: 'Payload task-id duplicado no CMS mockado.',
      sentAt: SENT_AT,
    });
  });
});
