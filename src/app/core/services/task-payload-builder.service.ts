import { Injectable } from '@angular/core';
import { CmsPayload, Task } from '../models/task.model';

@Injectable({ providedIn: 'root' })
export class TaskPayloadBuilderService {
  build(task: Task): CmsPayload {
    if (!task.approvedAt) {
      throw new Error('Task precisa estar aprovada antes de gerar payload.');
    }

    return {
      externalId: task.id,
      title: task.title,
      description: task.description,
      priority: task.priority,
      tags: task.tags,
      acceptanceCriteria: task.acceptanceCriteria,
      approvedAt: task.approvedAt,
      source: 'taskflow-ai',
    };
  }
}
