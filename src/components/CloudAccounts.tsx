import { useState, useEffect } from 'react';
import { type CloudAccount, type CloudProvider, type CloudAccountStatus } from '../lib/cloud/account';
import { makeId } from '../lib/utils/id';
import { formatDate } from '../lib/utils/format';

const STORAGE_KEY = 'cloudAccounts';

function readAccounts(): Promise<CloudAccount[]> {
  return new Promise((resolve) => {
    chrome.storage.local.get(STORAGE_KEY, (result) => {
      resolve((result[STORAGE_KEY] as CloudAccount[] | undefined) ?? []);
    });
  });
}

function writeAccounts(accounts: CloudAccount[]): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY]: accounts }, resolve);
  });
}

function getProviderIcon(provider: CloudProvider): string {
  switch (provider) {
    case 'google-drive':
      return 'Google Drive';
    case 'onedrive':
      return 'OneDrive';
    case 'dropbox':
      return 'Dropbox';
    default:
      return provider;
  }
}

function getStatusColor(status: CloudAccountStatus): string {
  switch (status) {
    case 'connected':
      return 'text-green-600 dark:text-green-400';
    case 'expired':
      return 'text-warning';
    case 'error':
      return 'text-danger';
    default:
      return 'text-muted';
  }
}

export function CloudAccountsView() {
  const [accounts, setAccounts] = useState<CloudAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newAccount, setNewAccount] = useState<Partial<CloudAccount>>({
    provider: 'google-drive',
    displayName: '',
    status: 'connected',
  });

  useEffect(() => {
    readAccounts().then((data) => {
      setAccounts(data);
      setLoading(false);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const now = Date.now();
    const account: CloudAccount = {
      id: makeId(),
      provider: newAccount.provider as CloudProvider,
      displayName: newAccount.displayName || 'Untitled',
      status: newAccount.status as CloudAccountStatus,
      lastSyncAt: now,
    };
    const updated = [...accounts, account];
    setAccounts(updated);
    await writeAccounts(updated);
    setNewAccount({ provider: 'google-drive', displayName: '', status: 'connected' });
    setShowForm(false);
  };

  const handleDelete = async (id: string) => {
    const updated = accounts.filter((a) => a.id !== id);
    setAccounts(updated);
    await writeAccounts(updated);
  };

  const handleDisconnect = async (account: CloudAccount) => {
    const updated = accounts.map((a) =>
      a.id === account.id ? { ...a, status: 'error' as CloudAccountStatus } : a
    );
    setAccounts(updated);
    await writeAccounts(updated);
  };

  const connectedCount = accounts.filter((a) => a.status === 'connected').length;

  if (loading) {
    return <div className="text-muted">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Cloud Accounts</h2>
        <button
          className="px-3 py-1 text-sm rounded border"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Cancel' : 'Add Account'}
        </button>
      </div>

      {/* Stats */}
      <div className="p-3 border rounded bg-surface">
        <div className="text-sm text-muted">Connected Accounts</div>
        <div className="text-2xl font-semibold text-accent">{connectedCount} / {accounts.length}</div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-3 p-3 border rounded bg-surface">
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Display Name"
              value={newAccount.displayName || ''}
              onChange={(e) => setNewAccount({ ...newAccount, displayName: e.target.value })}
              className="px-3 py-2 border rounded text-sm"
              required
            />
            <select
              value={newAccount.provider || 'google-drive'}
              onChange={(e) => setNewAccount({ ...newAccount, provider: e.target.value as CloudProvider })}
              className="px-3 py-2 border rounded text-sm"
            >
              <option value="google-drive">Google Drive</option>
              <option value="onedrive">OneDrive</option>
              <option value="dropbox">Dropbox</option>
            </select>
          </div>
          <button type="submit" className="px-3 py-2 bg-accent text-white rounded text-sm">
            Connect
          </button>
        </form>
      )}

      {/* Accounts list */}
      <div className="space-y-2">
        {accounts.map((account) => (
          <div
            key={account.id}
            className="p-3 border rounded bg-surface flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded bg-surface flex items-center justify-center border">
                <span className="text-lg">{getProviderIcon(account.provider)}</span>
              </div>
              <div>
                <div className="font-medium">{account.displayName}</div>
                <div className="text-xs text-muted">
                  {account.provider} • {account.status}
                  {account.email && <span> • {account.email}</span>}
                </div>
                {account.lastSyncAt && (
                  <div className="text-xs text-muted">
                    Last sync: {formatDate(account.lastSyncAt)}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-1 rounded ${getStatusColor(account.status)}`}>
                {account.status}
              </span>
              {account.status === 'connected' && (
                <button
                  className="px-2 py-1 text-xs rounded border text-warning"
                  onClick={() => handleDisconnect(account)}
                >
                  Disconnect
                </button>
              )}
              <button
                className="px-2 py-1 text-xs rounded border text-danger"
                onClick={() => handleDelete(account.id)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        {accounts.length === 0 && (
          <p className="text-sm text-muted text-center py-4">
            No cloud accounts connected. Connect a Google Drive account to enable cloud sync.
          </p>
        )}
      </div>

      {/* Info box */}
      <div className="p-3 border rounded bg-surface text-sm">
        <p className="text-muted mb-2">About Cloud Sync</p>
        <p>
          Your data will be encrypted locally before being synced to the cloud.
          Only you have the decryption key. Currently supports Google Drive for the MVP.
        </p>
      </div>
    </div>
  );
}
