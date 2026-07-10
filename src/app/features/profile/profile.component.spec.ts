import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthSession } from '../../core/models/auth.model';
import { AuthService } from '../../core/services/auth.service';
import { ProfileComponent } from './profile.component';

const SESSION: AuthSession = {
  id: 'user-manager',
  email: 'gestor@taskflow.local',
  displayName: 'Marcos Gestor',
  role: 'manager',
  team: 'Produto',
  timezone: 'America/Sao_Paulo',
  createdAt: '2026-07-01T09:10:00.000Z',
  issuedAt: '2026-07-03T12:00:00.000Z',
};

interface ProfileSetupOptions {
  sessionValue?: AuthSession | null;
  updateResult?: AuthSession | null;
}

function setupComponent(options: ProfileSetupOptions = {}) {
  const resolvedSession =
    options.sessionValue === null ? undefined : (options.sessionValue ?? SESSION);
  const resolvedUpdate =
    options.updateResult === null ? undefined : (options.updateResult ?? SESSION);
  const session = signal<AuthSession | undefined>(resolvedSession);
  const updateProfileSpy = vi.fn(() => resolvedUpdate);
  TestBed.configureTestingModule({
    imports: [ProfileComponent],
    providers: [
      {
        provide: AuthService,
        useValue: {
          currentUser: computed(() => session()),
          updateProfile: updateProfileSpy,
        },
      },
    ],
  });

  const fixture = TestBed.createComponent(ProfileComponent);
  fixture.detectChanges();

  return {
    fixture,
    updateProfileSpy,
  };
}

describe('ProfileComponent', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders the authenticated user profile and role label', () => {
    const { fixture } = setupComponent();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.profile-summary')?.textContent).toContain('Marcos Gestor');
    expect(compiled.querySelector('.profile-summary')?.textContent).toContain('Gestor');
    expect(
      compiled.querySelector<HTMLInputElement>('input[formControlName="displayName"]')?.value,
    ).toBe('Marcos Gestor');
  });

  it('updates profile fields', () => {
    const updatedSession = {
      ...SESSION,
      displayName: 'Marcos Produto',
      team: 'Growth',
      timezone: 'UTC',
    };
    const { fixture, updateProfileSpy } = setupComponent({ updateResult: updatedSession });
    const compiled = fixture.nativeElement as HTMLElement;

    compiled.querySelector<HTMLInputElement>('input[formControlName="displayName"]')!.value =
      'Marcos Produto';
    compiled
      .querySelector<HTMLInputElement>('input[formControlName="displayName"]')!
      .dispatchEvent(new Event('input'));
    compiled.querySelector<HTMLInputElement>('input[formControlName="team"]')!.value = 'Growth';
    compiled
      .querySelector<HTMLInputElement>('input[formControlName="team"]')!
      .dispatchEvent(new Event('input'));
    compiled.querySelector<HTMLInputElement>('input[formControlName="timezone"]')!.value = 'UTC';
    compiled
      .querySelector<HTMLInputElement>('input[formControlName="timezone"]')!
      .dispatchEvent(new Event('input'));
    compiled.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(updateProfileSpy).toHaveBeenCalledWith({
      displayName: 'Marcos Produto',
      team: 'Growth',
      timezone: 'UTC',
    });
    expect(compiled.querySelector('.success-message')?.textContent).toContain('Perfil atualizado.');
  });

  it('marks invalid forms and shows missing session feedback', () => {
    const { fixture, updateProfileSpy } = setupComponent({ updateResult: null });
    const compiled = fixture.nativeElement as HTMLElement;

    compiled.querySelector<HTMLInputElement>('input[formControlName="displayName"]')!.value = '';
    compiled
      .querySelector<HTMLInputElement>('input[formControlName="displayName"]')!
      .dispatchEvent(new Event('input'));
    compiled.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(updateProfileSpy).not.toHaveBeenCalled();
    expect(compiled.querySelector('.form-error')?.textContent).toContain('Preencha todos');

    compiled.querySelector<HTMLInputElement>('input[formControlName="displayName"]')!.value =
      'Marcos';
    compiled
      .querySelector<HTMLInputElement>('input[formControlName="displayName"]')!
      .dispatchEvent(new Event('input'));
    compiled.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(updateProfileSpy).toHaveBeenCalledOnce();
    expect(compiled.querySelector('.success-message')?.textContent).toContain(
      'Sessao nao encontrada.',
    );
  });

  it('handles missing current user state', () => {
    const { fixture } = setupComponent({ sessionValue: null });

    expect((fixture.componentInstance as unknown as { roleLabel: () => string }).roleLabel()).toBe(
      '',
    );
    expect((fixture.nativeElement as HTMLElement).querySelector('.profile-layout')).toBeNull();
  });
});
