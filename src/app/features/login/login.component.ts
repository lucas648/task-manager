import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DEMO_USERS } from '../../core/models/auth.model';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly demoUsers = DEMO_USERS;
  protected readonly loginForm = this.fb.nonNullable.group({
    email: [DEMO_USERS[0].email, [Validators.required, Validators.email]],
    password: [DEMO_USERS[0].password, [Validators.required]],
  });
  protected loginError = '';

  protected login(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    const session = this.authService.login(this.loginForm.getRawValue());

    if (!session) {
      this.loginError = 'Credenciais invalidas.';
      return;
    }

    this.loginError = '';
    void this.router.navigateByUrl(this.readReturnUrl());
  }

  protected useDemoUser(email: string, password: string): void {
    this.loginForm.setValue({ email, password });
    this.loginError = '';
  }

  private readReturnUrl(): string {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    return returnUrl?.startsWith('/') ? returnUrl : '/';
  }
}
