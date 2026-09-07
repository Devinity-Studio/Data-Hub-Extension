type LayoutMode = 'sidebar' | 'dashboard';

const LAYOUT_KEY = 'layoutSettings';

export function getLayout(): LayoutMode {
  return (window as unknown as { layoutSettings?: { mode: LayoutMode } }).layoutSettings?.mode ?? 'sidebar';
}

export function setLayout(mode: LayoutMode): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ layoutSettings: { mode } }, () => {
      resolve();
    });
  });
}
