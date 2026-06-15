import { DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AnalyticsService } from '../../core/services/analytics.service';

@Component({
  selector: 'app-analytics-dashboard',
  imports: [DatePipe, RouterLink],
  templateUrl: './analytics-dashboard.component.html',
})
export class AnalyticsDashboardComponent {
  protected readonly analyticsService = inject(AnalyticsService);
}
