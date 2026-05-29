import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { PRIORITY_OPTIONS, TaskPriority } from '../../core/models/task.model';
import { TaskService } from '../../core/services/task.service';

@Component({
  selector: 'app-task-create',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './task-create.component.html',
})
export class TaskCreateComponent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly taskService = inject(TaskService);

  protected readonly priorityOptions = PRIORITY_OPTIONS;

  protected readonly taskForm = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(3)]],
    description: ['', [Validators.required]],
    priority: [TaskPriority.Medium, [Validators.required]],
    category: ['', [Validators.required]],
    tags: [''],
    assignee: [''],
    dueDate: [''],
    acceptanceCriteria: [''],
  });

  protected addTask(): void {
    const rawTask = this.taskForm.getRawValue();
    const hasInvalidText =
      rawTask.title.trim().length < 3 || !rawTask.description.trim() || !rawTask.category.trim();

    if (this.taskForm.invalid || hasInvalidText) {
      if (rawTask.title.trim().length < 3) {
        this.taskForm.controls.title.setErrors({ minlength: true });
      }
      if (!rawTask.description.trim()) {
        this.taskForm.controls.description.setErrors({ required: true });
      }
      if (!rawTask.category.trim()) {
        this.taskForm.controls.category.setErrors({ required: true });
      }
      this.taskForm.markAllAsTouched();
      return;
    }

    this.taskService.addTask({
      title: rawTask.title,
      description: rawTask.description,
      priority: rawTask.priority,
      category: rawTask.category,
      tags: this.parseList(rawTask.tags),
      assignee: rawTask.assignee,
      dueDate: rawTask.dueDate,
      acceptanceCriteria: this.parseList(rawTask.acceptanceCriteria),
    });
    void this.router.navigateByUrl('/tasks');
  }

  private parseList(value: string): string[] {
    return value
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
}
