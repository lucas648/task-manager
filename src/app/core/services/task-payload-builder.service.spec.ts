import { TaskPriority, TaskStatus } from '../models/task.model';
import { TaskPayloadBuilderService } from './task-payload-builder.service';

const APPROVED_AT = '2026-06-02T12:00:00.000Z';

describe('TaskPayloadBuilderService', () => {
  const service = new TaskPayloadBuilderService();

  it('builds the CMS payload from an approved task', () => {
    expect(
      service.build({
        id: 'task-id',
        title: 'Validar release',
        description: 'Checar payload final',
        priority: TaskPriority.Urgent,
        status: TaskStatus.Approved,
        category: 'Release',
        tags: ['release'],
        acceptanceCriteria: ['Payload aprovado'],
        createdAt: APPROVED_AT,
        updatedAt: APPROVED_AT,
        approvedAt: APPROVED_AT,
        aiSuggestions: [],
        auditLogs: [],
      }),
    ).toEqual({
      externalId: 'task-id',
      title: 'Validar release',
      description: 'Checar payload final',
      priority: TaskPriority.Urgent,
      tags: ['release'],
      acceptanceCriteria: ['Payload aprovado'],
      approvedAt: APPROVED_AT,
      source: 'taskflow-ai',
    });
  });

  it('rejects payload generation before human approval', () => {
    expect(() =>
      service.build({
        id: 'task-id',
        title: 'Sem aprovacao',
        description: 'Nao deveria gerar payload',
        priority: TaskPriority.Low,
        status: TaskStatus.AiReviewed,
        category: 'Produto',
        tags: [],
        acceptanceCriteria: [],
        createdAt: APPROVED_AT,
        updatedAt: APPROVED_AT,
        aiSuggestions: [],
        auditLogs: [],
      }),
    ).toThrow('Task precisa estar aprovada antes de gerar payload.');
  });
});
