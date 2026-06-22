import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  AiSuggestion,
  PRIORITY_LABELS,
  STATUS_LABELS,
  TASK_COLUMNS,
  TaskStatus,
} from '../../core/models/task.model';
import { TaskService } from '../../core/services/task.service';
import { TaskWorkflowService } from '../../core/services/task-workflow.service';

@Component({
  selector: 'app-task-review',
  imports: [DatePipe, RouterLink],
  templateUrl: './task-review.component.html',
})
export class TaskReviewComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly taskService = inject(TaskService);
  private readonly workflowService = inject(TaskWorkflowService);

  protected readonly TaskStatus = TaskStatus;
  protected readonly statusLabels = STATUS_LABELS;
  protected readonly priorityLabels = PRIORITY_LABELS;
  protected readonly suggestionFieldLabels: Record<AiSuggestion['field'], string> = {
    title: 'Titulo',
    description: 'Descricao',
    acceptanceCriteria: 'Criterios de aceite',
  };
  protected readonly suggestionDecisionLabels: Record<AiSuggestion['decision'], string> = {
    pending: 'Pendente',
    applied: 'Aplicada',
    rejected: 'Rejeitada',
  };
  protected readonly workflowSteps = TASK_COLUMNS;
  protected readonly isReviewing = signal(false);
  protected readonly message = signal('');
  protected readonly taskId = this.route.snapshot.paramMap.get('taskId') ?? '';
  protected readonly task = computed(() => this.taskService.findTask(this.taskId));
  protected readonly payloadJson = computed(() => {
    const payload = this.task()?.cmsPayload;
    return payload ? JSON.stringify(payload, null, 2) : '';
  });

  protected async reviewWithAi(): Promise<void> {
    if (this.isReviewing()) {
      return;
    }

    this.isReviewing.set(true);
    this.setMessage('Revisao da IA em andamento.');

    try {
      const result = await this.workflowService.reviewWithAi(this.taskId);
      this.setMessage(result.message);
    } finally {
      this.isReviewing.set(false);
    }
  }

  protected approveTask(): void {
    this.setMessage(this.workflowService.approveTask(this.taskId).message);
  }

  protected applySuggestion(suggestionId: string): void {
    this.setMessage(this.workflowService.applySuggestion(this.taskId, suggestionId).message);
  }

  protected rejectSuggestion(suggestionId: string): void {
    this.setMessage(this.workflowService.rejectSuggestion(this.taskId, suggestionId).message);
  }

  protected publishTask(): void {
    this.setMessage(this.workflowService.publishTask(this.taskId).message);
  }

  protected startWork(): void {
    this.setMessage(this.workflowService.startWork(this.taskId).message);
  }

  protected completeTask(): void {
    this.setMessage(this.workflowService.completeTask(this.taskId).message);
  }

  protected isCompletedStep(status: TaskStatus, stepStatus: TaskStatus): boolean {
    const currentIndex = this.workflowSteps.findIndex((step) => step.status === status);
    const stepIndex = this.workflowSteps.findIndex((step) => step.status === stepStatus);

    return currentIndex > stepIndex && stepIndex >= 0;
  }

  protected formatSuggestionValue(value: AiSuggestion['suggestedValue']): string {
    return Array.isArray(value) ? value.join('\n') : value;
  }

  private setMessage(message: string): void {
    this.message.set(message);
  }
}
