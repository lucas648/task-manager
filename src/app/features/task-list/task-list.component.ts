import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  FILTER_OPTIONS,
  PRIORITY_LABELS,
  STATUS_OPTIONS,
  STATUS_LABELS,
  TASK_COLUMNS,
  Task,
  TaskBoardTimeMetric,
  TaskFilter,
  TaskStatus,
} from '../../core/models/task.model';
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
  protected readonly boardTimeMetrics = computed(() =>
    this.boardAnalyticsService
      .summarize(this.filteredTasks())
      .taskMetrics.reduce<Record<string, TaskBoardTimeMetric>>((metrics, metric) => {
        metrics[metric.taskId] = metric;

        return metrics;
      }, {}),
  );

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
