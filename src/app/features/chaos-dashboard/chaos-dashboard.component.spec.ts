import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuditLogEvent, CHAOS_SCENARIOS, ChaosScenario } from '../../core/models/task.model';
import { ChaosService } from '../../core/services/chaos.service';
import { ChaosDashboardComponent } from './chaos-dashboard.component';

describe('ChaosDashboardComponent', () => {
  const scenarios = signal<ChaosScenario[]>([
    { ...CHAOS_SCENARIOS[0], enabled: false },
    { ...CHAOS_SCENARIOS[1], enabled: true },
  ]);
  const auditLogs = signal([
    {
      id: 'chaos-log',
      event: AuditLogEvent.ChaosScenarioEnabled,
      taskId: 'chaos',
      timestamp: '2026-06-06T12:00:00.000Z',
    },
  ]);
  const chaosService = {
    activeCount: () => scenarios().filter((scenario) => scenario.enabled).length,
    auditLogs,
    reset: vi.fn(() => {
      scenarios.set(scenarios().map((scenario) => ({ ...scenario, enabled: false })));
    }),
    scenarios,
    setScenario: vi.fn((scenarioId: string, enabled: boolean) => {
      scenarios.update((currentScenarios) =>
        currentScenarios.map((scenario) =>
          scenario.id === scenarioId ? { ...scenario, enabled } : scenario,
        ),
      );
    }),
  };

  beforeEach(async () => {
    scenarios.set([
      { ...CHAOS_SCENARIOS[0], enabled: false },
      { ...CHAOS_SCENARIOS[1], enabled: true },
    ]);
    auditLogs.set([
      {
        id: 'chaos-log',
        event: AuditLogEvent.ChaosScenarioEnabled,
        taskId: 'chaos',
        timestamp: '2026-06-06T12:00:00.000Z',
      },
    ]);
    chaosService.reset.mockClear();
    chaosService.setScenario.mockClear();

    await TestBed.configureTestingModule({
      imports: [ChaosDashboardComponent],
      providers: [
        provideRouter([]),
        {
          provide: ChaosService,
          useValue: chaosService,
        },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders chaos scenarios, active count, and logs', () => {
    const fixture = TestBed.createComponent(ChaosDashboardComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('h1')?.textContent).toContain('Chaos Dashboard');
    expect(element.textContent).toContain('Cenarios ativos');
    expect(element.textContent).toContain('1');
    expect(element.textContent).toContain('IA fora do ar');
    expect(element.textContent).toContain('IA lenta');
    expect(element.textContent).toContain('CHAOS_SCENARIO_ENABLED');
    expect(element.querySelector('a')?.getAttribute('href')).toBe('/tasks');
  });

  it('toggles and resets scenarios', () => {
    const fixture = TestBed.createComponent(ChaosDashboardComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const checkbox = element.querySelector<HTMLInputElement>('input[type="checkbox"]');
    const resetButton = [...element.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Desativar todos'),
    );

    checkbox?.click();
    fixture.detectChanges();
    expect(chaosService.setScenario).toHaveBeenCalledWith('ai_unavailable', true);

    resetButton?.click();
    fixture.detectChanges();
    expect(chaosService.reset).toHaveBeenCalled();
    expect(element.textContent).toContain('0');
  });

  it('renders an empty log state', () => {
    auditLogs.set([]);
    const fixture = TestBed.createComponent(ChaosDashboardComponent);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Sem eventos registrados.',
    );
  });
});
