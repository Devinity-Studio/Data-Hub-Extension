import { useState, useEffect } from 'react';
import { SidebarView } from './components/SidebarView';
import { DashboardView } from './components/DashboardView';
import './styles.css';

// Local type definitions
type ThemeMode = 'light' | 'dark' | 'auto';
type LayoutMode = 'sidebar' | 'dashboard';

export default function App() {
  const [theme, setTheme] = useState<ThemeMode>('auto');
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('sidebar');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme === 'auto' ? 'auto' : theme);
  }, [theme]);

  return (
    <div className="flex flex-col h-full bg-bg text-text">
      <header className="flex items-center justify-between px-4 py-3 border-b">
        <h1 className="text-lg font-semibold">Data Hub</h1>

        <div className="flex items-center gap-3">
          <button
            className="px-3 py-1 text-sm rounded border"
            onClick={() => setTheme(theme === 'light' ? 'dark' : theme === 'dark' ? 'auto' : 'light')}
            aria-label="Toggle theme"
          >
            {theme === 'light' ? 'Light' : theme === 'dark' ? 'Dark' : 'Auto'}
          </button>

          <button
            className="px-3 py-1 text-sm rounded border"
            onClick={() => setLayoutMode(layoutMode === 'sidebar' ? 'dashboard' : 'sidebar')}
            aria-label="Toggle layout"
          >
            {layoutMode === 'sidebar' ? 'Sidebar' : 'Dashboard'}
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-4">
        {layoutMode === 'sidebar' ? (
          <SidebarView />
        ) : (
          <DashboardView />
        )}
      </main>
    </div>
  );
}
