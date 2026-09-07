import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

export type ThemeMode = 'light' | 'dark' | 'auto';

const THEME_KEY = 'themeSettings';

function readTheme(): Promise<ThemeMode> {
  return new Promise((resolve) => {
    chrome.storage.local.get(THEME_KEY, (result) => {
      resolve((result[THEME_KEY] as { mode: ThemeMode } | undefined)?.mode ?? 'auto');
    });
  });
}

function writeTheme(mode: ThemeMode): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [THEME_KEY]: { mode } }, resolve);
  });
}

interface ThemeContextValue {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>('auto');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let ignore = false;

    readTheme().then((mode) => {
      if (!ignore) {
        setThemeState(mode);
        setLoaded(true);
      }
    });

    return () => {
      ignore = true;
    };
  }, []);

  const setTheme = useCallback(
    (mode: ThemeMode) => {
      setThemeState(mode);
      writeTheme(mode).catch(() => {
        // ignore storage errors in UI for now
      });
    },
    []
  );

  return React.createElement(
    ThemeContext.Provider,
    { value: { theme, setTheme } },
    children
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
