import { useState, useEffect } from 'react';
import { type OsPathMapping, resolveOsPath } from '../lib/quick-access/pathMapping';
import { makeId } from '../lib/utils/id';

const STORAGE_KEY = 'quickAccessPaths';

function readPaths(): Promise<OsPathMapping[]> {
  return new Promise((resolve) => {
    chrome.storage.local.get(STORAGE_KEY, (result) => {
      resolve((result[STORAGE_KEY] as OsPathMapping[] | undefined) ?? []);
    });
  });
}

function writePaths(paths: OsPathMapping[]): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY]: paths }, resolve);
  });
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString();
}

export function QuickAccessView() {
  const [paths, setPaths] = useState<OsPathMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newPath, setNewPath] = useState<Partial<OsPathMapping>>({
    name: '',
    windowsPath: '',
    linuxPath: '',
    macosPath: '',
  });

  useEffect(() => {
    readPaths().then((data) => {
      setPaths(data);
      setLoading(false);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const now = Date.now();
    const path: OsPathMapping = {
      id: makeId(),
      name: newPath.name || 'Untitled',
      windowsPath: newPath.windowsPath || '',
      linuxPath: newPath.linuxPath || '',
      macosPath: newPath.macosPath || '',
      createdAt: now,
      updatedAt: now,
    };
    const updated = [...paths, path];
    setPaths(updated);
    await writePaths(updated);
    setNewPath({ name: '', windowsPath: '', linuxPath: '', macosPath: '' });
    setShowForm(false);
  };

  const handleDelete = async (id: string) => {
    const updated = paths.filter((p) => p.id !== id);
    setPaths(updated);
    await writePaths(updated);
  };

  const currentPath = navigator.platform;
  const resolvedPath = (mapping: OsPathMapping) => resolveOsPath(mapping);

  if (loading) {
    return <div className="text-muted">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Quick Access</h2>
        <button
          className="px-3 py-1 text-sm rounded border"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Cancel' : 'Add Path'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-3 p-3 border rounded bg-surface">
          <input
            type="text"
            placeholder="Name"
            value={newPath.name}
            onChange={(e) => setNewPath({ ...newPath, name: e.target.value })}
            className="w-full px-3 py-2 border rounded text-sm"
            required
          />
          <div className="grid grid-cols-3 gap-2">
            <input
              type="text"
              placeholder="Windows"
              value={newPath.windowsPath || ''}
              onChange={(e) => setNewPath({ ...newPath, windowsPath: e.target.value })}
              className="px-3 py-2 border rounded text-sm"
            />
            <input
              type="text"
              placeholder="Linux"
              value={newPath.linuxPath || ''}
              onChange={(e) => setNewPath({ ...newPath, linuxPath: e.target.value })}
              className="px-3 py-2 border rounded text-sm"
            />
            <input
              type="text"
              placeholder="macOS"
              value={newPath.macosPath || ''}
              onChange={(e) => setNewPath({ ...newPath, macosPath: e.target.value })}
              className="px-3 py-2 border rounded text-sm"
            />
          </div>
          <button type="submit" className="px-3 py-2 bg-accent text-white rounded text-sm">
            Save
          </button>
        </form>
      )}

      <div className="space-y-2">
        {paths.map((path) => {
          const resolved = resolvedPath(path);
          return (
            <div
              key={path.id}
              className="p-3 border rounded bg-surface flex items-center justify-between"
            >
              <div>
                <div className="font-medium">{path.name}</div>
                <div className="text-xs text-muted mt-1">
                  {resolved ? (
                    <>
                      <span className="text-accent">{resolved}</span>
                      <span className="ml-2 text-xs">({currentPath})</span>
                    </>
                  ) : (
                    'No path for this platform'
                  )}
                </div>
                <div className="text-xs text-muted mt-1">
                  Added {formatDate(path.createdAt)}
                </div>
              </div>
              <button
                className="px-2 py-1 text-xs rounded border text-danger"
                onClick={() => handleDelete(path.id)}
              >
                Delete
              </button>
            </div>
          );
        })}
        {paths.length === 0 && (
          <p className="text-sm text-muted text-center py-4">
            No quick access paths configured yet.
          </p>
        )}
      </div>
    </div>
  );
}
