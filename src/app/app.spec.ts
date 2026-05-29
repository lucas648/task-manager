import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { App } from './app';

@Component({
  standalone: true,
  template: '',
})
class RouteStubComponent {}

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([
          { path: '', component: RouteStubComponent },
          { path: 'tasks', component: RouteStubComponent },
          { path: 'tasks/new', component: RouteStubComponent },
        ]),
      ],
    }).compileComponents();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
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
    expect(compiled.querySelector('.brand')?.textContent).toContain('Task Manager');
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
    ]);
  });
});
