import { DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  AGENT_RUN_OPERATION_LABELS,
  AGENT_RUN_STATUS_LABELS,
  AgentRunRecord,
} from '../../core/models/agent-run.model';
import { AgentRunService } from '../../core/services/agent-run.service';
import { AnalyticsService } from '../../core/services/analytics.service';

@Component({
  selector: 'app-analytics-dashboard',
  imports: [DatePipe, RouterLink],
  templateUrl: './analytics-dashboard.component.html',
})
export class AnalyticsDashboardComponent {
  protected readonly agentRunService = inject(AgentRunService);
  protected readonly analyticsService = inject(AnalyticsService);
  protected readonly agentRunOperationLabels = AGENT_RUN_OPERATION_LABELS;
  protected readonly agentRunStatusLabels = AGENT_RUN_STATUS_LABELS;

  protected formatRunDuration(run: AgentRunRecord): string {
    return run.durationMs === undefined ? 'Em andamento' : `${run.durationMs} ms`;
  }
}
