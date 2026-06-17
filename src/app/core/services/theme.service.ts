import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { computed, effect, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark';

const THEME_STORAGE_KEY = 'taskflow.theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);

  readonly theme = signal<ThemeMode>(this.readStoredTheme() ?? 'light');
  readonly isDarkMode = computed(() => this.theme() === 'dark');

  constructor() {
    effect(() => {
      const theme = this.theme();

      this.applyTheme(theme);
      this.persistTheme(theme);
    });
  }

  toggleTheme(): void {
    this.theme.set(this.isDarkMode() ? 'light' : 'dark');
  }

  setTheme(theme: ThemeMode): void {
    this.theme.set(theme);
  }

  private applyTheme(theme: ThemeMode): void {
    const root = this.document.documentElement;

    root.setAttribute('data-theme', theme);
    root.style?.setProperty('color-scheme', theme);
  }

  private persistTheme(theme: ThemeMode): void {
    const storage = this.storage();

    if (!storage) {
      return;
    }

    storage.setItem(THEME_STORAGE_KEY, theme);
  }

  private readStoredTheme(): ThemeMode | undefined {
    const storage = this.storage();

    if (!storage) {
      return undefined;
    }

    const storedTheme = storage.getItem(THEME_STORAGE_KEY);

    return this.isThemeMode(storedTheme) ? storedTheme : undefined;
  }

  private isThemeMode(value: unknown): value is ThemeMode {
    return value === 'light' || value === 'dark';
  }

  private storage(): Storage | undefined {
    if (!isPlatformBrowser(this.platformId) || typeof globalThis.localStorage === 'undefined') {
      return undefined;
    }

    return globalThis.localStorage;
  }
}
