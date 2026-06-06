import { DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ChaosScenarioId } from '../../core/models/task.model';
import { ChaosService } from '../../core/services/chaos.service';

@Component({
  selector: 'app-chaos-dashboard',
  imports: [DatePipe, RouterLink],
  templateUrl: './chaos-dashboard.component.html',
})
export class ChaosDashboardComponent {
  protected readonly chaosService = inject(ChaosService);

  protected setScenario(scenarioId: ChaosScenarioId, enabled: boolean): void {
    this.chaosService.setScenario(scenarioId, enabled);
  }

  protected resetScenarios(): void {
    this.chaosService.reset();
  }
}
