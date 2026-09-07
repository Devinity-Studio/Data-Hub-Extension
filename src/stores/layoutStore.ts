import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

export type LayoutMode = 'sidebar' | 'dashboard';

const LAYOUT_KEY = 'layoutSettings';

function readLayout(): Promise<LayoutMode> {
  return new Promise((resolve) => {
    chrome.storage.local.get(LAYOUT_KEY, (result) => {
      resolve((result[LAYOUT_KEY] as { mode: LayoutMode } | undefined)?.mode ?? 'sidebar');
    });
  });
}

function writeLayout(mode: LayoutMode): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [LAYOUT_KEY]: { mode } }, resolve);
  });
}

interface LayoutContextValue {
  layoutMode: LayoutMode;
  setLayoutMode: (mode: LayoutMode) => void;
}

const LayoutContext = createContext<LayoutContextValue | null>(null);

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [layoutMode, setLayoutModeState] = useState<LayoutMode>('sidebar');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let ignore = false;

    readLayout().then((mode) => {
      if (!ignore) {
        setLayoutModeState(mode);
        setLoaded(true);
      }
    });

    return () => {
      ignore = true;
    };
  }, []);

  const setLayoutMode = useCallback(
    (mode: LayoutMode) => {
      setLayoutModeState(mode);
      writeLayout(mode).catch(() => {
        // ignore storage errors in UI for now
      });
    },
    []
  );

  return React.createElement(
    LayoutContext.Provider,
    { value: { layoutMode, setLayoutMode } },
    children
  );
}

export function useLayout(): LayoutContextValue {
  const ctx = useContext(LayoutContext);
  if (!ctx) {
    throw new Error('useLayout must be used within LayoutProvider');
  }
  return ctx;
}
