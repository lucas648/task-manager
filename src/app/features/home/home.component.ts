import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TASK_COLUMNS } from '../../core/models/task.model';
import { TaskService } from '../../core/services/task.service';

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  templateUrl: './home.component.html',
})
export class HomeComponent {
  protected readonly taskService = inject(TaskService);
  protected readonly columns = TASK_COLUMNS;
}
