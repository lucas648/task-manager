import { Injectable } from '@angular/core';
import { AiReviewResult, Task } from '../models/task.model';

@Injectable({ providedIn: 'root' })
export class AiReviewService {
  review(task: Task, reviewedAt = new Date().toISOString()): AiReviewResult {
    return {
      reviewedAt,
      summary: `Revisao tecnica registrada para "${task.title}".`,
    };
  }
}
