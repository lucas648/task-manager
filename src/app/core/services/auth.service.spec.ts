import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AUTH_SESSION_STORAGE_KEY, AuthSession } from '../models/auth.model';
import { AuthService } from './auth.service';

const ISSUED_AT = '2026-07-03T12:00:00.000Z';
const SESSION: AuthSession = {
  id: 'user-admin',
  email: 'admin@taskflow.local',
  displayName: 'Ana Admin',
  role: 'admin',
  team: 'Operacoes',
  timezone: 'America/Sao_Paulo',
  createdAt: '2026-07-01T09:00:00.000Z',
  issuedAt: ISSUED_AT,
};

function setupStorage(initialValue: string | null = null) {
  let storedValue = initialValue;

  const storage = {
    getItem: vi.fn((key: string) => (key === AUTH_SESSION_STORAGE_KEY ? storedValue : null)),
    setItem: vi.fn((key: string, value: string) => {
      if (key === AUTH_SESSION_STORAGE_KEY) {
        storedValue = value;
      }
    }),
    removeItem: vi.fn((key: string) => {
      if (key === AUTH_SESSION_STORAGE_KEY) {
        storedValue = null;
      }
    }),
  };

  vi.stubGlobal('localStorage', storage);

  return storage;
}

function setupService(platformId = 'browser'): AuthService {
  TestBed.configureTestingModule({
    providers: [
      AuthService,
      {
        provide: PLATFORM_ID,
        useValue: platformId,
      },
    ],
  });

  return TestBed.inject(AuthService);
}

describe('AuthService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    TestBed.resetTestingModule();
  });

  it('loads stored sessions and updates profile data with safe fallbacks', () => {
    const storage = setupStorage(JSON.stringify(SESSION));
    const service = setupService();

    expect(service.currentUser()).toEqual(SESSION);
    expect(service.isAuthenticated()).toBe(true);

    expect(
      service.updateProfile({
        displayName: '  Ana Produto  ',
        team: '   ',
        timezone: '  UTC  ',
      }),
    ).toEqual({
      ...SESSION,
      displayName: 'Ana Produto',
      team: 'Operacoes',
      timezone: 'UTC',
    });
    TestBed.tick();

    expect(storage.setItem).toHaveBeenLastCalledWith(
      AUTH_SESSION_STORAGE_KEY,
      JSON.stringify(service.currentUser()),
    );
  });

  it('logs in, persists sessions, rejects invalid credentials, and logs out', () => {
    const storage = setupStorage();
    const service = setupService();

    expect(
      service.login(
        {
          email: '  ADMIN@TASKFLOW.LOCAL ',
          password: ' admin123 ',
        },
        ISSUED_AT,
      ),
    ).toEqual(SESSION);
    TestBed.tick();

    expect(storage.setItem).toHaveBeenLastCalledWith(
      AUTH_SESSION_STORAGE_KEY,
      JSON.stringify(SESSION),
    );
    expect(
      service.login({
        email: 'admin@taskflow.local',
        password: 'senha-errada',
      }),
    ).toBeUndefined();

    service.logout();
    TestBed.tick();

    expect(service.currentUser()).toBeUndefined();
    expect(service.isAuthenticated()).toBe(false);
    expect(storage.removeItem).toHaveBeenLastCalledWith(AUTH_SESSION_STORAGE_KEY);
  });

  it('ignores invalid stored sessions and profile updates without a session', () => {
    setupStorage(JSON.stringify({ ...SESSION, role: 'owner' }));
    expect(setupService().currentUser()).toBeUndefined();

    TestBed.resetTestingModule();
    setupStorage('{invalid json');
    expect(setupService().currentUser()).toBeUndefined();

    TestBed.resetTestingModule();
    setupStorage(null);
    expect(
      setupService().updateProfile({ displayName: 'Ana', team: 'Ops', timezone: 'UTC' }),
    ).toBeUndefined();
  });

  it('works without browser storage', () => {
    const storage = setupStorage();
    const service = setupService('server');

    expect(service.currentUser()).toBeUndefined();
    expect(
      service.login({ email: 'gestor@taskflow.local', password: 'gestor123' }, ISSUED_AT),
    ).toEqual({
      id: 'user-manager',
      email: 'gestor@taskflow.local',
      displayName: 'Marcos Gestor',
      role: 'manager',
      team: 'Produto',
      timezone: 'America/Sao_Paulo',
      createdAt: '2026-07-01T09:10:00.000Z',
      issuedAt: ISSUED_AT,
    });
    TestBed.tick();

    expect(storage.setItem).not.toHaveBeenCalled();
  });
});
