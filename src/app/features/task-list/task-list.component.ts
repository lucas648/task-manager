import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  FILTER_OPTIONS,
  STATUS_OPTIONS,
  TASK_COLUMNS,
  Task,
  TaskFilter,
  TaskStatus,
} from '../../core/models/task.model';
import { TaskService } from '../../core/services/task.service';

@Component({
  selector: 'app-task-list',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './task-list.component.html',
})
export class TaskListComponent {
  protected readonly taskService = inject(TaskService);
  protected readonly statusOptions = STATUS_OPTIONS;
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

  protected setFilter(filter: TaskFilter): void {
    this.filter.set(filter);
  }

  protected setSearch(term: string): void {
    this.searchTerm.set(term);
  }

  protected tasksByStatus(status: TaskStatus): Task[] {
    return this.filteredTasks().filter((task) => task.status === status);
  }

  protected changeStatus(taskId: string, status: TaskStatus): void {
    this.taskService.changeStatus(taskId, status);
  }

  protected deleteTask(taskId: string): void {
    this.taskService.deleteTask(taskId);
  }
}
