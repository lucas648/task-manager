import { TaskPriority } from '../models/task.model';
import { CmsService } from './cms.service';

const SENT_AT = '2026-06-02T12:00:00.000Z';

describe('CmsService', () => {
  it('simulates a successful CMS send', () => {
    const service = new CmsService();

    expect(
      service.send(
        {
          externalId: 'task-id',
          title: 'Publicar pauta',
          description: 'Enviar payload',
          priority: TaskPriority.Medium,
          tags: ['cms'],
          acceptanceCriteria: ['Payload valido'],
          approvedAt: SENT_AT,
          source: 'taskflow-ai',
        },
        SENT_AT,
      ),
    ).toEqual({
      success: true,
      statusCode: 202,
      message: 'Payload task-id aceito pelo CMS mockado.',
      sentAt: SENT_AT,
    });
  });
});
