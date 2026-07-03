import { Component, computed, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ROLE_LABELS } from '../../core/models/auth.model';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-profile',
  imports: [ReactiveFormsModule],
  templateUrl: './profile.component.html',
})
export class ProfileComponent {
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  protected readonly user = this.authService.currentUser;
  protected readonly roleLabel = computed(() => {
    const user = this.user();
    return user ? ROLE_LABELS[user.role] : '';
  });
  protected readonly profileForm = this.fb.nonNullable.group({
    displayName: [this.user()?.displayName ?? '', [Validators.required]],
    team: [this.user()?.team ?? '', [Validators.required]],
    timezone: [this.user()?.timezone ?? 'America/Sao_Paulo', [Validators.required]],
  });
  protected savedMessage = '';

  protected saveProfile(): void {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    const updatedProfile = this.authService.updateProfile(this.profileForm.getRawValue());

    this.savedMessage = updatedProfile ? 'Perfil atualizado.' : 'Sessao nao encontrada.';
  }
}
