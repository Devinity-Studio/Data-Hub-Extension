import { useState, useEffect, useMemo } from 'react';
import { QuickAccessView } from './QuickAccess';
import { SecretsView } from './Secrets';
import { CloudAccountsView } from './CloudAccounts';
import { type CloudAccount } from '../lib/cloud/account';
import { getOAuthUrl } from '../lib/cloud/googleDrive';

const CLOUD_ACCOUNTS_KEY = 'cloudAccounts';

function readCloudAccounts(): Promise<CloudAccount[]> {
  return new Promise((resolve) => {
    chrome.storage.local.get(CLOUD_ACCOUNTS_KEY, (result) => {
      resolve((result[CLOUD_ACCOUNTS_KEY] as CloudAccount[] | undefined) ?? []);
    });
  });
}

export function DashboardView() {
  const [cloudAccounts, setCloudAccounts] = useState<CloudAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showQuickAccess, setShowQuickAccess] = useState(true);
  const [showSecrets, setShowSecrets] = useState(true);

  useEffect(() => {
    readCloudAccounts().then((data) => {
      setCloudAccounts(data);
      setLoading(false);
    });
  }, []);

  const connectedAccounts = useMemo(() => 
    cloudAccounts.filter((a) => a.status === 'connected'),
    [cloudAccounts]
  );

  const totalSecrets = useMemo(() => 0, []); // Would be computed from secrets store
  const totalPaths = useMemo(() => 0, []); // Would be computed from paths store

  if (loading) {
    return <div className="text-muted">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted mt-1">
            Manage your data, secrets, and cloud connections
          </p>
        </div>
        <button
          className="px-4 py-2 bg-accent text-white rounded-lg"
          onClick={() => {
            const url = getOAuthUrl();
            chrome.identity.launchWebAuthFlow(
              { url, interactive: true },
              (redirectUrl) => {
                if (chrome.runtime.lastError) {
                  console.error('Auth error:', chrome.runtime.lastError);
                  return;
                }
                // Handle OAuth callback here
                console.log('OAuth redirect:', redirectUrl);
              }
            );
          }}
        >
          Connect Google Drive
        </button>
      </div>

      {/* Welcome section */}
      <div className="p-5 bg-gradient-to-br from-accent/10 to-transparent rounded-xl border">
        <h2 className="text-xl font-semibold">Welcome to Data Hub</h2>
        <p className="text-sm text-muted mt-1">
          Your personal data manager. All data is encrypted locally - only you have the keys.
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="p-4 border rounded-xl bg-surface text-center hover:shadow-md transition-shadow">
          <div className="text-3xl mb-2">📁</div>
          <div className="text-2xl font-bold text-accent">{totalPaths}</div>
          <div className="text-sm text-muted">Quick Access Paths</div>
        </div>
        <div className="p-4 border rounded-xl bg-surface text-center hover:shadow-md transition-shadow">
          <div className="text-3xl mb-2">🔐</div>
          <div className="text-2xl font-bold text-accent">{totalSecrets}</div>
          <div className="text-sm text-muted">Encrypted Secrets</div>
        </div>
        <div className="p-4 border rounded-xl bg-surface text-center hover:shadow-md transition-shadow">
          <div className="text-3xl mb-2">☁️</div>
          <div className="text-2xl font-bold text-accent">{connectedAccounts.length}</div>
          <div className="text-sm text-muted">Cloud Accounts</div>
        </div>
        <div className="p-4 border rounded-xl bg-surface text-center hover:shadow-md transition-shadow">
          <div className="text-3xl mb-2">🔒</div>
          <div className="text-2xl font-bold text-accent">AES-256</div>
          <div className="text-sm text-muted">Encryption Standard</div>
        </div>
      </div>

      {/* Cloud sync status */}
      {connectedAccounts.length > 0 && (
        <div className="p-4 border rounded-xl bg-surface">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2">
              <span>☁️</span> Cloud Sync Status
            </h3>
            <span className="text-xs px-2 py-1 rounded bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400">
              Connected
            </span>
          </div>
          <div className="space-y-2">
            {connectedAccounts.map((account) => (
              <div key={account.id} className="flex items-center justify-between text-sm">
                <span className="font-medium">{account.displayName}</span>
                {account.lastSyncAt && (
                  <span className="text-muted">
                    Last sync: {new Date(account.lastSyncAt).toLocaleString()}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main content sections - collapsible */}
      <div className="space-y-4">
        {/* Quick Access toggle */}
        <button
          className={`w-full px-4 py-3 rounded-xl border text-left flex items-center justify-between ${
            showQuickAccess ? 'border-accent bg-accent/5' : 'bg-surface'
          }`}
          onClick={() => setShowQuickAccess(!showQuickAccess)}
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">📁</span>
            <div>
              <div className="font-semibold">Quick Access</div>
              <div className="text-xs text-muted">OS path mappings for quick file access</div>
            </div>
          </div>
          <span className={`text-xl transition-transform ${showQuickAccess ? 'rotate-180' : ''}`}>▼</span>
        </button>

        {/* Quick Access content */}
        {showQuickAccess && <QuickAccessView />}

        {/* Secrets toggle */}
        <button
          className={`w-full px-4 py-3 rounded-xl border text-left flex items-center justify-between ${
            showSecrets ? 'border-accent bg-accent/5' : 'bg-surface'
          }`}
          onClick={() => setShowSecrets(!showSecrets)}
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">🔐</span>
            <div>
              <div className="font-semibold">Secrets</div>
              <div className="text-xs text-muted">Encrypted passwords, API keys, and tokens</div>
            </div>
          </div>
          <span className={`text-xl transition-transform ${showSecrets ? 'rotate-180' : ''}`}>▼</span>
        </button>

        {/* Secrets content */}
        {showSecrets && <SecretsView />}
      </div>

      {/* Cloud accounts */}
      <div className="space-y-4">
        <button
          className="w-full px-4 py-3 rounded-xl border text-left flex items-center justify-between bg-surface"
          onClick={() => setShowQuickAccess(false)}
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">☁️</span>
            <div>
              <div className="font-semibold">Cloud Accounts</div>
              <div className="text-xs text-muted">Manage cloud storage connections</div>
            </div>
          </div>
        </button>

        <CloudAccountsView />
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-muted py-4 border-t space-y-1">
        <p>Data Hub Extension v0.1.0</p>
        <p>🔒 Your data is encrypted with AES-256-GCM</p>
        <p>Only you have the decryption key</p>
      </div>
    </div>
  );
}
