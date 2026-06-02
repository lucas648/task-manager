import { TaskPriority, TaskStatus } from '../models/task.model';
import { AiReviewService } from './ai-review.service';

const REVIEWED_AT = '2026-06-02T12:00:00.000Z';

describe('AiReviewService', () => {
  it('returns a minimal mocked review summary for the task', () => {
    const service = new AiReviewService();

    expect(
      service.review(
        {
          id: 'task-id',
          title: 'Revisar checkout',
          description: 'Validar fluxo',
          priority: TaskPriority.High,
          status: TaskStatus.Draft,
          category: 'Produto',
          tags: [],
          acceptanceCriteria: [],
          createdAt: REVIEWED_AT,
          updatedAt: REVIEWED_AT,
          aiSuggestions: [],
          auditLogs: [],
        },
        REVIEWED_AT,
      ),
    ).toEqual({
      reviewedAt: REVIEWED_AT,
      summary: 'Revisao tecnica registrada para "Revisar checkout".',
    });
  });
});
