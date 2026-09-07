type ThemeMode = 'light' | 'dark' | 'auto';

const THEME_KEY = 'themeSettings';

export function getTheme(): ThemeMode {
  return (window as unknown as { themeSettings?: { mode: ThemeMode } }).themeSettings?.mode ?? 'auto';
}

export function setTheme(mode: ThemeMode): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ themeSettings: { mode } }, () => {
      resolve();
    });
  });
}
