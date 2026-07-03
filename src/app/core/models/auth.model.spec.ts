import { AUTH_SESSION_STORAGE_KEY, DEMO_USERS, ROLE_LABELS } from './auth.model';

describe('auth models', () => {
  it('defines role labels, demo users, and storage key', () => {
    expect(AUTH_SESSION_STORAGE_KEY).toBe('taskflow.auth.session');
    expect(ROLE_LABELS).toEqual({
      admin: 'Administrador',
      manager: 'Gestor',
      member: 'Membro',
    });
    expect(DEMO_USERS).toEqual([
      {
        id: 'user-admin',
        email: 'admin@taskflow.local',
        password: 'admin123',
        displayName: 'Ana Admin',
        role: 'admin',
        team: 'Operacoes',
        timezone: 'America/Sao_Paulo',
        createdAt: '2026-07-01T09:00:00.000Z',
      },
      {
        id: 'user-manager',
        email: 'gestor@taskflow.local',
        password: 'gestor123',
        displayName: 'Marcos Gestor',
        role: 'manager',
        team: 'Produto',
        timezone: 'America/Sao_Paulo',
        createdAt: '2026-07-01T09:10:00.000Z',
      },
      {
        id: 'user-member',
        email: 'membro@taskflow.local',
        password: 'membro123',
        displayName: 'Lia Membro',
        role: 'member',
        team: 'Delivery',
        timezone: 'America/Sao_Paulo',
        createdAt: '2026-07-01T09:20:00.000Z',
      },
    ]);
  });
});
