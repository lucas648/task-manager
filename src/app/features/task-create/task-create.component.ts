import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { STATUS_OPTIONS, TaskStatus } from '../../core/models/task.model';
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

  protected readonly statusOptions = STATUS_OPTIONS;

  protected readonly taskForm = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(3)]],
    description: [''],
    status: ['pending' as TaskStatus, [Validators.required]],
  });

  protected addTask(): void {
    const rawTask = this.taskForm.getRawValue();

    if (this.taskForm.invalid || rawTask.title.trim().length < 3) {
      this.taskForm.controls.title.setErrors({ minlength: true });
      this.taskForm.markAllAsTouched();
      return;
    }

    this.taskService.addTask(rawTask);
    void this.router.navigateByUrl('/tasks');
  }
}
