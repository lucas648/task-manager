import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { App } from './app';

@Component({
  standalone: true,
  template: '',
})
class RouteStubComponent {}

const THEME_STORAGE_KEY = 'taskflow.theme';

function setupThemeStorage(initialValue: string | null = null) {
  let storedValue = initialValue;

  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key: string) => (key === THEME_STORAGE_KEY ? storedValue : null)),
    removeItem: vi.fn((key: string) => {
      if (key === THEME_STORAGE_KEY) {
        storedValue = null;
      }
    }),
    setItem: vi.fn((key: string, value: string) => {
      if (key === THEME_STORAGE_KEY) {
        storedValue = value;
      }
    }),
  });
}

describe('App', () => {
  beforeEach(async () => {
    setupThemeStorage();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.colorScheme = '';

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([
          { path: '', component: RouteStubComponent },
          { path: 'tasks', component: RouteStubComponent },
          { path: 'tasks/new', component: RouteStubComponent },
          { path: 'chaos', component: RouteStubComponent },
          { path: 'analytics', component: RouteStubComponent },
        ]),
      ],
    }).compileComponents();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render task manager navigation', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.brand')?.textContent).toContain('TaskFlow AI');
  });

  it('should only activate the exact navigation link for nested task routes', async () => {
    const router = TestBed.inject(Router);
    const fixture = TestBed.createComponent(App);

    await router.navigateByUrl('/tasks/new');
    fixture.detectChanges();
    await fixture.whenStable();

    const links = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll('.site-nav nav a'),
    ].map((link) => ({
      active: link.classList.contains('is-active'),
      text: link.textContent?.trim(),
    }));

    expect(links).toEqual([
      { active: false, text: 'Home' },
      { active: false, text: 'Tasks' },
      { active: true, text: 'Nova task' },
      { active: false, text: 'Chaos' },
      { active: false, text: 'Analytics' },
    ]);
  });

  it('should toggle and persist the app theme', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    TestBed.tick();

    const compiled = fixture.nativeElement as HTMLElement;
    const toggle = compiled.querySelector<HTMLButtonElement>('.theme-toggle');

    expect(toggle?.textContent?.trim()).toBe('Modo escuro');
    expect(toggle?.getAttribute('aria-pressed')).toBe('false');
    expect(document.documentElement.dataset['theme']).toBe('light');

    toggle?.click();
    fixture.detectChanges();
    TestBed.tick();

    expect(toggle?.textContent?.trim()).toBe('Modo claro');
    expect(toggle?.getAttribute('aria-pressed')).toBe('true');
    expect(document.documentElement.dataset['theme']).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(localStorage.getItem('taskflow.theme')).toBe('dark');
  });
});
