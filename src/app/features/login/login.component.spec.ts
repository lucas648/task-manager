import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { AuthSession, DEMO_USERS } from '../../core/models/auth.model';
import { AuthService } from '../../core/services/auth.service';
import { LoginComponent } from './login.component';

@Component({
  standalone: true,
  template: '',
})
class RouteStubComponent {}

const SESSION: AuthSession = {
  id: 'user-admin',
  email: 'admin@taskflow.local',
  displayName: 'Ana Admin',
  role: 'admin',
  team: 'Operacoes',
  timezone: 'America/Sao_Paulo',
  createdAt: '2026-07-01T09:00:00.000Z',
  issuedAt: '2026-07-03T12:00:00.000Z',
};

function setupComponent(loginResult: AuthSession | null = SESSION, returnUrl = '/tasks') {
  const loginSpy = vi.fn(() => loginResult ?? undefined);
  TestBed.configureTestingModule({
    imports: [LoginComponent],
    providers: [
      provideRouter([{ path: 'tasks', component: RouteStubComponent }]),
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: {
            queryParamMap: convertToParamMap({ returnUrl }),
          },
        },
      },
      {
        provide: AuthService,
        useValue: {
          login: loginSpy,
        },
      },
    ],
  });

  const fixture = TestBed.createComponent(LoginComponent);
  fixture.detectChanges();

  return {
    fixture,
    loginSpy,
    router: TestBed.inject(Router),
  };
}

describe('LoginComponent', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders demo users and fills selected credentials', () => {
    const { fixture } = setupComponent();
    const compiled = fixture.nativeElement as HTMLElement;
    const demoButtons = compiled.querySelectorAll<HTMLButtonElement>('.demo-user');

    expect(demoButtons).toHaveLength(DEMO_USERS.length);

    demoButtons[1].click();
    fixture.detectChanges();

    expect(compiled.querySelector<HTMLInputElement>('input[type="email"]')?.value).toBe(
      DEMO_USERS[1].email,
    );
    expect(compiled.querySelector<HTMLInputElement>('input[type="password"]')?.value).toBe(
      DEMO_USERS[1].password,
    );
  });

  it('marks invalid login forms before calling auth', () => {
    const { fixture, loginSpy } = setupComponent();
    const compiled = fixture.nativeElement as HTMLElement;

    compiled.querySelector<HTMLInputElement>('input[type="email"]')!.value = '';
    compiled
      .querySelector<HTMLInputElement>('input[type="email"]')!
      .dispatchEvent(new Event('input'));
    compiled.querySelector<HTMLInputElement>('input[type="password"]')!.value = '';
    compiled
      .querySelector<HTMLInputElement>('input[type="password"]')!
      .dispatchEvent(new Event('input'));
    compiled.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(loginSpy).not.toHaveBeenCalled();
    expect(compiled.querySelector('.form-error')?.textContent).toContain('Informe e-mail e senha');
  });

  it('logs in and redirects to returnUrl', () => {
    const { fixture, loginSpy, router } = setupComponent(SESSION, '/tasks');
    const navigateSpy = vi.spyOn(router, 'navigateByUrl');

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLFormElement>('form')!
      .dispatchEvent(new Event('submit'));

    expect(loginSpy).toHaveBeenCalledWith({
      email: DEMO_USERS[0].email,
      password: DEMO_USERS[0].password,
    });
    expect(navigateSpy).toHaveBeenCalledWith('/tasks');
  });

  it('shows an error for invalid credentials', () => {
    const { fixture, loginSpy, router } = setupComponent(null);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl');

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLFormElement>('form')!
      .dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(loginSpy).toHaveBeenCalledOnce();
    expect(navigateSpy).not.toHaveBeenCalled();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.form-error')?.textContent,
    ).toContain('Credenciais invalidas.');
  });

  it('falls back to home when returnUrl is not an app path', () => {
    const { fixture, router } = setupComponent(SESSION, 'https://example.com/tasks');
    const navigateSpy = vi.spyOn(router, 'navigateByUrl');

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLFormElement>('form')!
      .dispatchEvent(new Event('submit'));

    expect(navigateSpy).toHaveBeenCalledWith('/');
  });
});
