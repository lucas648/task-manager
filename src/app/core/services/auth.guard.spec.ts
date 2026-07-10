import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { AuthSession } from '../models/auth.model';
import { authGuard, guestGuard } from './auth.guard';
import { AuthService } from './auth.service';

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

function setupGuard(isAuthenticated: boolean) {
  const session = signal<AuthSession | undefined>(isAuthenticated ? SESSION : undefined);
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: AuthService,
        useValue: {
          isAuthenticated: computed(() => session() !== undefined),
        },
      },
    ],
  });

  const router = TestBed.inject(Router);

  return {
    router,
    runAuthGuard: () =>
      TestBed.runInInjectionContext(() => authGuard({} as never, { url: '/tasks/new' } as never)),
    runGuestGuard: () =>
      TestBed.runInInjectionContext(() => guestGuard({} as never, { url: '/login' } as never)),
  };
}

describe('auth guards', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('allows authenticated users through protected routes', () => {
    expect(setupGuard(true).runAuthGuard()).toBe(true);
  });

  it('redirects anonymous users to login with returnUrl', () => {
    const { router, runAuthGuard } = setupGuard(false);
    const result = runAuthGuard();

    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result as UrlTree)).toBe('/login?returnUrl=%2Ftasks%2Fnew');
  });

  it('redirects authenticated users away from login', () => {
    const { router, runGuestGuard } = setupGuard(true);
    const result = runGuestGuard();

    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result as UrlTree)).toBe('/');
  });

  it('allows anonymous users to open login', () => {
    expect(setupGuard(false).runGuestGuard()).toBe(true);
  });
});
