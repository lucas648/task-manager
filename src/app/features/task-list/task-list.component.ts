import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  FILTER_OPTIONS,
  PRIORITY_LABELS,
  STATUS_OPTIONS,
  STATUS_LABELS,
  TASK_COLUMNS,
  Task,
  BoardRecommendation,
  BoardRecommendationSummary,
  TaskBoardTimeMetric,
  TaskFilter,
  TaskStatus,
} from '../../core/models/task.model';
import { AiRecommendationService } from '../../core/services/ai-recommendation.service';
import { BoardAnalyticsService } from '../../core/services/board-analytics.service';
import { TaskService } from '../../core/services/task.service';

@Component({
  selector: 'app-task-list',
  imports: [CommonModule, DragDropModule, FormsModule, RouterLink],
  templateUrl: './task-list.component.html',
})
export class TaskListComponent {
  protected readonly taskService = inject(TaskService);
  private readonly boardAnalyticsService = inject(BoardAnalyticsService);
  private readonly aiRecommendationService = inject(AiRecommendationService);
  protected readonly statusOptions = STATUS_OPTIONS;
  protected readonly statusLabels = STATUS_LABELS;
  protected readonly priorityLabels = PRIORITY_LABELS;
  protected readonly filterOptions = FILTER_OPTIONS;
  protected readonly columns = TASK_COLUMNS;
  protected readonly filter = signal<TaskFilter>('all');
  protected readonly searchTerm = signal('');

  protected readonly filteredTasks = computed(() => {
    const selectedFilter = this.filter();
    const term = this.searchTerm().trim().toLowerCase();

    return this.taskService.tasks().filter((task) => {
      const matchesStatus = selectedFilter === 'all' || task.status === selectedFilter;
      const searchableText =
        `${task.title} ${task.description} ${task.category} ${task.tags.join(' ')} ${task.assignee ?? ''}`.toLowerCase();
      const matchesSearch = !term || searchableText.includes(term);

      return matchesStatus && matchesSearch;
    });
  });
  protected readonly hasActiveFilters = computed(
    () => this.filter() !== 'all' || !!this.searchTerm().trim(),
  );
  protected readonly hasFilteredTasks = computed(() => this.filteredTasks().length > 0);
  protected readonly boardTimeSummary = computed(() =>
    this.boardAnalyticsService.summarize(this.filteredTasks()),
  );
  protected readonly boardTimeMetrics = computed(() =>
    this.boardTimeSummary().taskMetrics.reduce<Record<string, TaskBoardTimeMetric>>(
      (metrics, metric) => {
        metrics[metric.taskId] = metric;

        return metrics;
      },
      {},
    ),
  );
  protected readonly recommendationSummary = signal<BoardRecommendationSummary>(
    this.aiRecommendationService.recommend([], this.boardAnalyticsService.summarize([])),
  );
  protected readonly recommendationsByTask = computed(() =>
    this.recommendationSummary().recommendations.reduce<
      Partial<Record<string, BoardRecommendation[]>>
    >((recommendations, recommendation) => {
      recommendations[recommendation.taskId] = [
        ...(recommendations[recommendation.taskId] ?? []),
        recommendation,
      ];

      return recommendations;
    }, {}),
  );
  private readonly recommendationRefresh = effect(() => {
    const tasks = this.filteredTasks();
    const boardTime = this.boardTimeSummary();

    this.recommendationSummary.set(this.aiRecommendationService.recommend(tasks, boardTime));
    void this.aiRecommendationService
      .recommendAsync(tasks, boardTime)
      .then((summary) => this.recommendationSummary.set(summary));
  });

  protected setFilter(filter: TaskFilter): void {
    this.filter.set(filter);
  }

  protected setSearch(term: string): void {
    this.searchTerm.set(term);
  }

  protected clearFilters(): void {
    this.filter.set('all');
    this.searchTerm.set('');
  }

  protected tasksByStatus(status: TaskStatus): Task[] {
    return this.filteredTasks().filter((task) => task.status === status);
  }

  protected dropTask(event: CdkDragDrop<Task[], Task[], Task>, status: TaskStatus): void {
    this.taskService.moveTask(event.item.data.id, status, event.currentIndex);
  }

  protected changeStatus(taskId: string, status: TaskStatus): void {
    this.taskService.changeStatus(taskId, status);
  }

  protected deleteTask(taskId: string): void {
    this.taskService.deleteTask(taskId);
  }
}
