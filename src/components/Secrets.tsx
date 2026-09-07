import { useState, useEffect } from 'react';
import { type SecretItem, type SecretType, type SecretStatus } from '../lib/secret/secretItem';
import { resolveSecretStatus, isExpiringSoon } from '../lib/secret/secretStatus';
import { makeId } from '../lib/utils/id';
import { formatDate } from '../lib/utils/format';
import { storeSecretValue, retrieveSecretValue, deleteSecretValue } from '../lib/secret/encryptedStorage';

const STORAGE_KEY = 'secrets';

function readSecrets(): Promise<SecretItem[]> {
  return new Promise((resolve) => {
    chrome.storage.local.get(STORAGE_KEY, (result) => {
      resolve((result[STORAGE_KEY] as SecretItem[] | undefined) ?? []);
    });
  });
}

function writeSecrets(secrets: SecretItem[]): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY]: secrets }, resolve);
  });
}

function getStatusColor(status: SecretStatus): string {
  switch (status) {
    case 'active':
      return 'text-green-600 dark:text-green-400';
    case 'expired':
      return 'text-danger';
    case 'revoked':
      return 'text-warning';
    default:
      return 'text-muted';
  }
}

function getTypeIcon(type: SecretType): string {
  switch (type) {
    case 'password':
      return '🔑';
    case 'api-key':
      return '🔐';
    case 'token':
      return '🎫';
    case 'backup-code':
      return '📱';
    default:
      return '📦';
  }
}

export function SecretsView() {
  const [secrets, setSecrets] = useState<SecretItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<'all' | SecretStatus>('all');
  const [newSecret, setNewSecret] = useState<Partial<SecretItem>>({
    type: 'password',
    label: '',
    notes: '',
    status: 'active',
  });
  const [showValue, setShowValue] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    readSecrets().then((data) => {
      setSecrets(data);
      setLoading(false);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const now = Date.now();
    const secret: SecretItem = {
      id: makeId(),
      type: newSecret.type as SecretType,
      label: newSecret.label || 'Untitled',
      encryptedValue: '', // Will be populated after encryption
      iv: '',
      status: newSecret.status as SecretStatus,
      createdAt: now,
      notes: newSecret.notes || undefined,
      expiresAt: newSecret.expiresAt || undefined,
    };
    const updated = [...secrets, secret];
    setSecrets(updated);
    await writeSecrets(updated);
    setNewSecret({ type: 'password', label: '', notes: '', status: 'active' });
    setShowForm(false);
  };

  const handleDelete = async (id: string) => {
    // Delete encrypted value first
    await deleteSecretValue(id);
    const updated = secrets.filter((s) => s.id !== id);
    setSecrets(updated);
    await writeSecrets(updated);
    if (showValue === id) {
      setShowValue(null);
    }
  };

  const handleToggleStatus = async (secret: SecretItem) => {
    let newStatus: SecretStatus;
    if (secret.status === 'active') {
      newStatus = 'revoked';
    } else if (secret.status === 'revoked') {
      newStatus = 'active';
    } else {
      return;
    }
    const updated = secrets.map((s) =>
      s.id === secret.id ? { ...s, status: newStatus, revokedAt: newStatus === 'revoked' ? Date.now() : undefined } : s
    );
    setSecrets(updated);
    await writeSecrets(updated);
  };

  const handleCopyValue = async (secret: SecretItem) => {
    try {
      const value = await retrieveSecretValue(secret.id);
      await navigator.clipboard.writeText(value);
      setCopiedId(secret.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleSaveValue = async (secretId: string, plaintext: string) => {
    try {
      await storeSecretValue(secretId, plaintext);
    } catch (error) {
      console.error('Failed to save value:', error);
    }
  };

  const filteredSecrets = secrets.filter((s) => {
    const status = resolveSecretStatus(s.status, s.expiresAt);
    if (filter === 'all') return true;
    return status === filter;
  });

  const activeCount = secrets.filter((s) => resolveSecretStatus(s.status, s.expiresAt) === 'active').length;
  const expiringCount = secrets.filter((s) => {
    if (!s.expiresAt) return false;
    return isExpiringSoon(s.expiresAt);
  }).length;

  if (loading) {
    return <div className="text-muted">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Secrets</h2>
        <button
          className="px-3 py-1 text-sm rounded border"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Cancel' : 'Add Secret'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <button
          className={`p-3 rounded border text-center ${filter === 'all' ? 'border-accent bg-surface' : 'bg-surface'}`}
          onClick={() => setFilter('all')}
        >
          <div className="text-2xl">{secrets.length}</div>
          <div className="text-xs text-muted">Total</div>
        </button>
        <button
          className={`p-3 rounded border text-center ${filter === 'active' ? 'border-accent bg-surface' : 'bg-surface'}`}
          onClick={() => setFilter('active')}
        >
          <div className="text-2xl text-green-600 dark:text-green-400">{activeCount}</div>
          <div className="text-xs text-muted">Active</div>
        </button>
        <button
          className={`p-3 rounded border text-center ${filter === 'expired' ? 'border-accent bg-surface' : 'bg-surface'}`}
          onClick={() => setFilter('expired')}
        >
          <div className="text-2xl text-danger">{secrets.filter((s) => resolveSecretStatus(s.status, s.expiresAt) === 'expired').length}</div>
          <div className="text-xs text-muted">Expired</div>
        </button>
      </div>

      {/* Encryption status */}
      <div className="p-3 border rounded bg-surface text-xs">
        <span className="text-green-600 dark:text-green-400">🔒</span>
        <span className="text-muted ml-2">All secrets are encrypted locally using AES-256-GCM</span>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-3 p-3 border rounded bg-surface">
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Label"
              value={newSecret.label || ''}
              onChange={(e) => setNewSecret({ ...newSecret, label: e.target.value })}
              className="px-3 py-2 border rounded text-sm"
              required
            />
            <select
              value={newSecret.type || 'password'}
              onChange={(e) => setNewSecret({ ...newSecret, type: e.target.value as SecretType })}
              className="px-3 py-2 border rounded text-sm"
            >
              <option value="password">Password</option>
              <option value="api-key">API Key</option>
              <option value="token">Token</option>
              <option value="backup-code">Backup Code</option>
            </select>
          </div>
          <input
            type="text"
            placeholder="Notes (optional)"
            value={newSecret.notes || ''}
            onChange={(e) => setNewSecret({ ...newSecret, notes: e.target.value })}
            className="w-full px-3 py-2 border rounded text-sm"
          />
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted">Status:</label>
            <select
              value={newSecret.status || 'active'}
              onChange={(e) => setNewSecret({ ...newSecret, status: e.target.value as SecretStatus })}
              className="px-3 py-2 border rounded text-sm flex-1"
            >
              <option value="active">Active</option>
              <option value="expired">Expired</option>
            </select>
          </div>
          <button type="submit" className="px-3 py-2 bg-accent text-white rounded text-sm">
            Save
          </button>
        </form>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(['all', 'active', 'expired', 'revoked'] as const).map((f) => (
          <button
            key={f}
            className={`px-3 py-1 text-sm rounded capitalize ${filter === f ? 'bg-accent text-white' : 'border'}`}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Secrets list */}
      <div className="space-y-2">
        {filteredSecrets.map((secret) => {
          const status = resolveSecretStatus(secret.status, secret.expiresAt);
          return (
            <div
              key={secret.id}
              className="p-3 border rounded bg-surface"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{getTypeIcon(secret.type)}</span>
                  <div>
                    <div className={`font-medium ${getStatusColor(status)}`}>
                      {secret.label}
                    </div>
                    <div className="text-xs text-muted flex items-center gap-2 mt-1">
                      <span>{secret.type}</span>
                      {secret.expiresAt && (
                        <>
                          <span>•</span>
                          <span className={isExpiringSoon(secret.expiresAt) ? 'text-warning' : ''}>
                            Expires: {formatDate(secret.expiresAt)}
                          </span>
                        </>
                      )}
                      {secret.notes && <><span>•</span><span>{secret.notes}</span></>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded ${getStatusColor(status)}`}>
                    {status}
                  </span>
                  <button
                    className="px-2 py-1 text-xs rounded border"
                    onClick={() => handleToggleStatus(secret)}
                  >
                    {secret.status === 'active' ? 'Revoke' : 'Activate'}
                  </button>
                </div>
              </div>

              {/* Value section */}
              <div className="border-t pt-2 mt-2">
                {showValue === secret.id ? (
                  <div className="space-y-2">
                    <input
                      type="password"
                      value={''} // TODO: Retrieve actual value
                      readOnly
                      className="w-full px-3 py-2 bg-muted/10 border rounded text-sm font-mono"
                      defaultValue="••••••••"
                    />
                    <div className="flex gap-2">
                      <button
                        className="px-3 py-1 text-xs rounded border flex-1"
                        onClick={() => setShowValue(null)}
                      >
                        Hide
                      </button>
                      <button
                        className={`px-3 py-1 text-xs rounded border flex-1 ${copiedId === secret.id ? 'bg-green-600 dark:bg-green-400 text-white' : ''}`}
                        onClick={() => handleCopyValue(secret)}
                      >
                        {copiedId === secret.id ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    className="w-full px-3 py-2 text-sm rounded border bg-surface hover:bg-muted/10"
                    onClick={() => setShowValue(secret.id)}
                  >
                    Reveal value
                  </button>
                )}
              </div>

              <div className="flex justify-end mt-2">
                <button
                  className="px-2 py-1 text-xs rounded border text-danger"
                  onClick={() => handleDelete(secret.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
        {filteredSecrets.length === 0 && (
          <p className="text-sm text-muted text-center py-4">
            No secrets found.
          </p>
        )}
      </div>
    </div>
  );
}
