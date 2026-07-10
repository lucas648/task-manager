export type UserRole = 'admin' | 'manager' | 'member';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  team: string;
  timezone: string;
  createdAt: string;
}

export interface DemoUser extends UserProfile {
  password: string;
}

export interface AuthSession extends UserProfile {
  issuedAt: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface ProfileUpdateInput {
  displayName: string;
  team: string;
  timezone: string;
}

export const AUTH_SESSION_STORAGE_KEY = 'taskflow.auth.session';

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  manager: 'Gestor',
  member: 'Membro',
};

export const DEMO_USERS: DemoUser[] = [
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
];
