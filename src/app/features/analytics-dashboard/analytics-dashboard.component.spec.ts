import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AnalyticsSummary, AuditLogEvent, TaskStatus } from '../../core/models/task.model';
import { AnalyticsService } from '../../core/services/analytics.service';
import { AnalyticsDashboardComponent } from './analytics-dashboard.component';

const ANALYTICS_SUMMARY: AnalyticsSummary = {
  totalTasks: 4,
  totalAuditLogs: 6,
  aiFailures: 1,
  cmsFailures: 2,
  chaosEvents: 3,
  acceptedSuggestions: 5,
  rejectedSuggestions: 1,
  suggestionAcceptanceRate: 83,
  averageApprovalMinutes: 42,
  statusMetrics: [
    { status: TaskStatus.Draft, label: 'Draft', count: 2, percentage: 50 },
    { status: TaskStatus.Approved, label: 'Approved', count: 1, percentage: 25 },
    { status: TaskStatus.Error, label: 'Error', count: 1, percentage: 25 },
  ],
  boardTime: {
    generatedAt: '2026-06-06T14:00:00.000Z',
    taskMetrics: [],
    statusMetrics: [
      {
        status: TaskStatus.Draft,
        label: 'Draft',
        averageMinutes: 120,
        averageLabel: '2 h',
        longestMinutes: 240,
        longestLabel: '4 h',
        longestTaskId: 'task-id',
        longestTaskTitle: 'Planejar backlog',
        thresholdMinutes: 1440,
        overThresholdCount: 1,
      },
      {
        status: TaskStatus.Completed,
        label: 'Completed',
        averageMinutes: 0,
        averageLabel: '0 min',
        longestMinutes: 0,
        longestLabel: '0 min',
        overThresholdCount: 0,
      },
    ],
  },
  recentEvents: [
    {
      id: 'recent-event',
      event: AuditLogEvent.CmsSendError,
      taskId: 'task-id',
      timestamp: '2026-06-06T12:00:00.000Z',
    },
  ],
};

function textContent(fixtureElement: HTMLElement): string {
  return fixtureElement.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

function summaryCards(fixtureElement: HTMLElement): string[] {
  return [...fixtureElement.querySelectorAll('.analytics-summary article')].map((card) =>
    textContent(card as HTMLElement),
  );
}

describe('AnalyticsDashboardComponent', () => {
  const summary = signal<AnalyticsSummary>(ANALYTICS_SUMMARY);
  const analyticsService = {
    summary,
  };

  beforeEach(async () => {
    summary.set(ANALYTICS_SUMMARY);

    await TestBed.configureTestingModule({
      imports: [AnalyticsDashboardComponent],
      providers: [
        provideRouter([]),
        {
          provide: AnalyticsService,
          useValue: analyticsService,
        },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders summary cards, status metrics, recent events, and navigation actions', () => {
    const fixture = TestBed.createComponent(AnalyticsDashboardComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const links = [...element.querySelectorAll('.home-actions a')].map((link) => ({
      href: link.getAttribute('href'),
      text: link.textContent?.trim(),
    }));

    expect(textContent(element)).toContain('Analytics Dashboard');
    expect(summaryCards(element)).toEqual([
      'Total de tasks4',
      'Logs registrados6',
      'Falhas IA1',
      'Falhas CMS2',
      'Eventos chaos3',
      'Taxa sugestoes83%',
      'Sugestoes aceitas5',
      'Tempo aprovacao42 min',
    ]);
    expect(textContent(element)).toContain('Draft2 tasks');
    expect(textContent(element)).toContain('Approved1 tasks');
    expect(textContent(element)).toContain('Tempo por baia');
    expect(textContent(element)).toContain('DraftMedia 2 h4 hPlanejar backlog1 acima');
    expect(textContent(element)).toContain('CompletedMedia 0 min0 minSem tasks0 acima');
    expect(textContent(element)).toContain('CMS_SEND_ERROR');
    expect(links).toEqual([
      { href: '/tasks', text: 'Ver tasks' },
      { href: '/chaos', text: 'Ver chaos' },
    ]);
    expect(element.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('50');
  });

  it('renders an empty recent-event state', () => {
    summary.set({
      ...ANALYTICS_SUMMARY,
      recentEvents: [],
    });

    const fixture = TestBed.createComponent(AnalyticsDashboardComponent);
    fixture.detectChanges();

    expect(textContent(fixture.nativeElement as HTMLElement)).toContain('Sem eventos recentes.');
  });
});
