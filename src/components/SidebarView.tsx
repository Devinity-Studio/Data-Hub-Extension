import { useState } from 'react';
import { QuickAccessView } from './QuickAccess';
import { SecretsView } from './Secrets';
import { CloudAccountsView } from './CloudAccounts';

type ViewSection = 'overview' | 'quick-access' | 'secrets' | 'cloud';

export function SidebarView() {
  const [activeView, setActiveView] = useState<ViewSection>('overview');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['main']));

  const toggleSection = (section: string) => {
    const newSet = new Set(expandedSections);
    if (newSet.has(section)) {
      newSet.delete(section);
    } else {
      newSet.add(section);
    }
    setExpandedSections(newSet);
  };

  const renderContent = () => {
    switch (activeView) {
      case 'quick-access':
        return (
          <div className="mt-4">
            <QuickAccessView />
          </div>
        );
      case 'secrets':
        return (
          <div className="mt-4">
            <SecretsView />
          </div>
        );
      case 'cloud':
        return (
          <div className="mt-4">
            <CloudAccountsView />
          </div>
        );
      default:
        return (
          <div className="mt-4">
            <div className="p-4 bg-gradient-to-br from-accent/10 to-transparent rounded-lg border">
              <h2 className="text-lg font-semibold">Data Hub</h2>
              <p className="text-sm text-muted mt-1">
                Your personal data manager browser extension.
              </p>
            </div>

            <div className="mt-4 p-4 border rounded bg-surface">
              <h3 className="font-medium mb-2">Quick Stats</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted">Feature</span>
                </div>
                <div>
                  <span className="text-muted">Status</span>
                </div>
                <div className="text-accent font-medium">Secrets</div>
                <div className="text-green-600 dark:text-green-400">Ready</div>
                <div className="text-accent font-medium">Quick Access</div>
                <div className="text-green-600 dark:text-green-400">Ready</div>
                <div className="text-accent font-medium">Cloud Sync</div>
                <div className="text-green-600 dark:text-green-400">Ready</div>
              </div>
            </div>

            <div className="mt-4 p-4 border rounded bg-surface">
              <h3 className="font-medium mb-2">About</h3>
              <p className="text-sm text-muted">
                Data Hub is a personal data manager browser extension built with:
              </p>
              <ul className="text-sm text-muted mt-2 space-y-1">
                <li>• Manifest V3</li>
                <li>• WXT Framework</li>
                <li>• React + TypeScript</li>
                <li>• Tailwind CSS</li>
                <li>• Encrypted cloud sync (Google Drive MVP)</li>
              </ul>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex h-full">
      {/* Sidebar navigation */}
      <div className="w-64 border-r bg-surface flex flex-col">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Data Hub</h2>
        </div>

        {/* Navigation items */}
        <nav className="flex-1 p-2">
          <button
            className={`w-full px-3 py-2 rounded text-left text-sm flex items-center gap-2 ${
              activeView === 'overview' ? 'bg-accent/10 text-accent' : 'hover:bg-surface'
            }`}
            onClick={() => setActiveView('overview')}
          >
            <span>🏠</span>
            <span>Overview</span>
          </button>

          <button
            className={`w-full px-3 py-2 rounded text-left text-sm flex items-center gap-2 ${
              activeView === 'quick-access' ? 'bg-accent/10 text-accent' : 'hover:bg-surface'
            }`}
            onClick={() => setActiveView('quick-access')}
          >
            <span>📁</span>
            <span>Quick Access</span>
          </button>

          <button
            className={`w-full px-3 py-2 rounded text-left text-sm flex items-center gap-2 ${
              activeView === 'secrets' ? 'bg-accent/10 text-accent' : 'hover:bg-surface'
            }`}
            onClick={() => setActiveView('secrets')}
          >
            <span>🔐</span>
            <span>Secrets</span>
          </button>

          <button
            className={`w-full px-3 py-2 rounded text-left text-sm flex items-center gap-2 ${
              activeView === 'cloud' ? 'bg-accent/10 text-accent' : 'hover:bg-surface'
            }`}
            onClick={() => setActiveView('cloud')}
          >
            <span>☁️</span>
            <span>Cloud Accounts</span>
          </button>
        </nav>

        {/* Footer */}
        <div className="p-3 border-t text-xs text-muted">
          <p>Version 0.1.0</p>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 overflow-auto p-4">
        {renderContent()}
      </div>
    </div>
  );
}
