import { inject, Injectable } from '@angular/core';
import { AuditLogEvent, Task, TaskStatus, WorkflowActionResult } from '../models/task.model';
import { AiReviewService } from './ai-review.service';
import { CmsService } from './cms.service';
import { TaskPayloadBuilderService } from './task-payload-builder.service';
import { TaskService } from './task.service';

@Injectable({ providedIn: 'root' })
export class TaskWorkflowService {
  private readonly aiReviewService = inject(AiReviewService);
  private readonly cmsService = inject(CmsService);
  private readonly payloadBuilder = inject(TaskPayloadBuilderService);
  private readonly taskService = inject(TaskService);

  reviewWithAi(taskId: string): WorkflowActionResult {
    const task = this.taskService.findTask(taskId);
    const canContinue = this.ensureStatus(task, TaskStatus.Draft, 'revisar com IA');

    if (!canContinue.success) {
      return canContinue;
    }

    const reviewedAt = new Date().toISOString();
    const review = this.aiReviewService.review(task as Task, reviewedAt);
    const updatedTask = this.taskService.applyWorkflowUpdate(
      taskId,
      {
        status: TaskStatus.AiReviewed,
      },
      [
        {
          event: AuditLogEvent.AiReviewStarted,
          metadata: { fromStatus: TaskStatus.Draft },
        },
        {
          event: AuditLogEvent.StatusChanged,
          metadata: { fromStatus: TaskStatus.Draft, toStatus: TaskStatus.AiReviewed },
        },
        {
          event: AuditLogEvent.AiReviewSuccess,
          metadata: { summary: review.summary },
        },
      ],
      review.reviewedAt,
    );

    return {
      success: true,
      message: 'Revisao da IA concluida. A task esta pronta para aprovacao humana.',
      task: updatedTask,
    };
  }

  approveTask(taskId: string): WorkflowActionResult {
    const task = this.taskService.findTask(taskId);
    const canContinue = this.ensureStatus(task, TaskStatus.AiReviewed, 'aprovar');

    if (!canContinue.success) {
      return canContinue;
    }

    const approvedAt = new Date().toISOString();
    const updatedTask = this.taskService.applyWorkflowUpdate(
      taskId,
      {
        approvedAt,
        status: TaskStatus.Approved,
      },
      [
        {
          event: AuditLogEvent.StatusChanged,
          metadata: { fromStatus: TaskStatus.AiReviewed, toStatus: TaskStatus.Approved },
        },
        {
          event: AuditLogEvent.TaskApproved,
          metadata: { approvedAt },
        },
      ],
      approvedAt,
    );

    return {
      success: true,
      message: 'Task aprovada. O payload ja pode ser gerado.',
      task: updatedTask,
    };
  }

  publishTask(taskId: string): WorkflowActionResult {
    const task = this.taskService.findTask(taskId);
    const canContinue = this.ensureStatus(task, TaskStatus.Approved, 'publicar');

    if (!canContinue.success) {
      return canContinue;
    }

    try {
      const publishedAt = new Date().toISOString();
      const payload = this.payloadBuilder.build(task as Task);
      const result = this.cmsService.send(payload, publishedAt);

      if (!result.success) {
        const errorTask = this.taskService.applyWorkflowUpdate(
          taskId,
          {
            cmsError: result.message,
            status: TaskStatus.Error,
          },
          [
            { event: AuditLogEvent.PayloadGenerated, metadata: { externalId: payload.externalId } },
            { event: AuditLogEvent.CmsSendStarted, metadata: { externalId: payload.externalId } },
            {
              event: AuditLogEvent.StatusChanged,
              metadata: { fromStatus: TaskStatus.Approved, toStatus: TaskStatus.Error },
            },
            { event: AuditLogEvent.CmsSendError, metadata: { message: result.message } },
          ],
          result.sentAt,
        );

        return {
          success: false,
          message: result.message,
          payload,
          task: errorTask,
        };
      }

      const updatedTask = this.taskService.applyWorkflowUpdate(
        taskId,
        {
          cmsError: undefined,
          cmsPayload: payload,
          publishedAt,
          status: TaskStatus.Published,
        },
        [
          { event: AuditLogEvent.PayloadGenerated, metadata: { externalId: payload.externalId } },
          { event: AuditLogEvent.CmsSendStarted, metadata: { externalId: payload.externalId } },
          {
            event: AuditLogEvent.StatusChanged,
            metadata: { fromStatus: TaskStatus.Approved, toStatus: TaskStatus.Published },
          },
          { event: AuditLogEvent.CmsSendSuccess, metadata: { statusCode: result.statusCode } },
        ],
        result.sentAt,
      );

      return {
        success: true,
        message: result.message,
        payload,
        task: updatedTask,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Nao foi possivel publicar a task.',
        task,
      };
    }
  }

  startWork(taskId: string): WorkflowActionResult {
    return this.moveForward(
      taskId,
      TaskStatus.Published,
      TaskStatus.InProgress,
      'Task movida para trabalho ativo.',
    );
  }

  completeTask(taskId: string): WorkflowActionResult {
    return this.moveForward(taskId, TaskStatus.InProgress, TaskStatus.Completed, 'Task concluida.');
  }

  private moveForward(
    taskId: string,
    fromStatus: TaskStatus,
    toStatus: TaskStatus,
    message: string,
  ): WorkflowActionResult {
    const task = this.taskService.findTask(taskId);
    const canContinue = this.ensureStatus(task, fromStatus, 'avancar no fluxo');

    if (!canContinue.success) {
      return canContinue;
    }

    const timestamp = new Date().toISOString();
    const updatedTask = this.taskService.applyWorkflowUpdate(
      taskId,
      { status: toStatus },
      [
        {
          event: AuditLogEvent.StatusChanged,
          metadata: { fromStatus, toStatus },
        },
      ],
      timestamp,
    );

    return {
      success: true,
      message,
      task: updatedTask,
    };
  }

  private ensureStatus(
    task: Task | undefined,
    expectedStatus: TaskStatus,
    action: string,
  ): WorkflowActionResult {
    if (!task) {
      return {
        success: false,
        message: 'Task nao encontrada.',
      };
    }

    if (task.status !== expectedStatus) {
      return {
        success: false,
        message: `A task precisa estar em ${expectedStatus} para ${action}.`,
        task,
      };
    }

    return {
      success: true,
      message: '',
      task,
    };
  }
}
