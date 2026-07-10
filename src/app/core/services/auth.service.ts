import { isPlatformBrowser } from '@angular/common';
import { computed, effect, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import {
  AUTH_SESSION_STORAGE_KEY,
  AuthSession,
  DEMO_USERS,
  LoginCredentials,
  ProfileUpdateInput,
} from '../models/auth.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly platformId = inject(PLATFORM_ID);

  readonly session = signal<AuthSession | undefined>(this.readStoredSession());
  readonly currentUser = computed(() => this.session());
  readonly isAuthenticated = computed(() => this.session() !== undefined);

  constructor() {
    effect(() => {
      const session = this.session();
      const storage = this.storage();

      if (!storage) {
        return;
      }

      if (session) {
        storage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
      } else {
        storage.removeItem(AUTH_SESSION_STORAGE_KEY);
      }
    });
  }

  login(
    credentials: LoginCredentials,
    issuedAt = new Date().toISOString(),
  ): AuthSession | undefined {
    const email = credentials.email.trim().toLowerCase();
    const password = credentials.password.trim();
    const user = DEMO_USERS.find(
      (candidate) => candidate.email === email && candidate.password === password,
    );

    if (!user) {
      return undefined;
    }

    const session: AuthSession = {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      team: user.team,
      timezone: user.timezone,
      createdAt: user.createdAt,
      issuedAt,
    };

    this.session.set(session);

    return session;
  }

  logout(): void {
    this.session.set(undefined);
  }

  updateProfile(input: ProfileUpdateInput): AuthSession | undefined {
    const currentSession = this.session();

    if (!currentSession) {
      return undefined;
    }

    const updatedSession: AuthSession = {
      ...currentSession,
      displayName: this.normalizeRequiredText(input.displayName, currentSession.displayName),
      team: this.normalizeRequiredText(input.team, currentSession.team),
      timezone: this.normalizeRequiredText(input.timezone, currentSession.timezone),
    };

    this.session.set(updatedSession);

    return updatedSession;
  }

  private readStoredSession(): AuthSession | undefined {
    const storage = this.storage();

    if (!storage) {
      return undefined;
    }

    try {
      const parsedSession = JSON.parse(
        storage.getItem(AUTH_SESSION_STORAGE_KEY) ?? 'null',
      ) as unknown;

      return this.isAuthSession(parsedSession) ? parsedSession : undefined;
    } catch {
      return undefined;
    }
  }

  private isAuthSession(value: unknown): value is AuthSession {
    return (
      this.isRecord(value) &&
      typeof value['id'] === 'string' &&
      typeof value['email'] === 'string' &&
      typeof value['displayName'] === 'string' &&
      (value['role'] === 'admin' || value['role'] === 'manager' || value['role'] === 'member') &&
      typeof value['team'] === 'string' &&
      typeof value['timezone'] === 'string' &&
      typeof value['createdAt'] === 'string' &&
      typeof value['issuedAt'] === 'string'
    );
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  private normalizeRequiredText(value: string, fallback: string): string {
    const normalizedValue = value.trim();
    return normalizedValue ? normalizedValue : fallback;
  }

  private storage(): Storage | undefined {
    if (!isPlatformBrowser(this.platformId) || typeof globalThis.localStorage === 'undefined') {
      return undefined;
    }

    return globalThis.localStorage;
  }
}
