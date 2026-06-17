import { DOCUMENT } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

const THEME_STORAGE_KEY = 'taskflow.theme';

function createTestDocument(): Document {
  return document.implementation.createHTMLDocument('TaskFlow AI');
}

function setupStorage(initialValue: string | null = null) {
  let storedValue = initialValue;

  const storage = {
    getItem: vi.fn((key: string) => (key === THEME_STORAGE_KEY ? storedValue : null)),
    setItem: vi.fn((key: string, value: string) => {
      if (key === THEME_STORAGE_KEY) {
        storedValue = value;
      }
    }),
  };

  vi.stubGlobal('localStorage', storage);

  return storage;
}

function setupService(
  testDocument = createTestDocument(),
  platformId: 'browser' | 'server' = 'browser',
): {
  service: ThemeService;
  testDocument: Document;
} {
  TestBed.configureTestingModule({
    providers: [
      ThemeService,
      {
        provide: DOCUMENT,
        useValue: testDocument,
      },
      {
        provide: PLATFORM_ID,
        useValue: platformId,
      },
    ],
  });

  return {
    service: TestBed.inject(ThemeService),
    testDocument,
  };
}

describe('ThemeService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('loads, applies, and persists a stored dark theme', () => {
    const storage = setupStorage('dark');
    const { service, testDocument } = setupService();
    TestBed.tick();

    expect(service.theme()).toBe('dark');
    expect(service.isDarkMode()).toBe(true);
    expect(testDocument.documentElement.dataset['theme']).toBe('dark');
    expect(testDocument.documentElement.style.colorScheme).toBe('dark');
    expect(storage.setItem).toHaveBeenCalledWith(THEME_STORAGE_KEY, 'dark');
  });

  it('falls back to light for invalid stored values and toggles themes', () => {
    const storage = setupStorage('system');
    const { service, testDocument } = setupService();
    TestBed.tick();

    expect(service.theme()).toBe('light');
    expect(testDocument.documentElement.dataset['theme']).toBe('light');

    service.toggleTheme();
    TestBed.tick();
    expect(service.theme()).toBe('dark');
    expect(testDocument.documentElement.dataset['theme']).toBe('dark');
    expect(storage.setItem).toHaveBeenLastCalledWith(THEME_STORAGE_KEY, 'dark');

    service.toggleTheme();
    TestBed.tick();
    expect(service.theme()).toBe('light');
    expect(service.isDarkMode()).toBe(false);
    expect(testDocument.documentElement.style.colorScheme).toBe('light');

    service.setTheme('dark');
    TestBed.tick();
    expect(service.theme()).toBe('dark');
    expect(testDocument.documentElement.dataset['theme']).toBe('dark');
  });

  it('applies themes when storage is unavailable', () => {
    vi.stubGlobal('localStorage', undefined);
    const { service, testDocument } = setupService();
    TestBed.tick();

    expect(service.theme()).toBe('light');
    expect(testDocument.documentElement.dataset['theme']).toBe('light');

    service.setTheme('dark');
    TestBed.tick();

    expect(service.isDarkMode()).toBe(true);
    expect(testDocument.documentElement.dataset['theme']).toBe('dark');
  });

  it('applies the theme on minimal server documents without inline style support', () => {
    vi.stubGlobal('localStorage', undefined);
    const documentElement = {
      setAttribute: vi.fn(),
    };
    const { service } = setupService({ documentElement } as unknown as Document);
    TestBed.tick();

    expect(service.theme()).toBe('light');
    expect(documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'light');

    service.setTheme('dark');
    TestBed.tick();

    expect(documentElement.setAttribute).toHaveBeenLastCalledWith('data-theme', 'dark');
  });

  it('does not read browser storage on the server platform', () => {
    const storage = setupStorage('dark');
    const documentElement = {
      setAttribute: vi.fn(),
    };
    const { service } = setupService({ documentElement } as unknown as Document, 'server');
    TestBed.tick();

    expect(service.theme()).toBe('light');
    expect(storage.getItem).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'light');
  });
});
