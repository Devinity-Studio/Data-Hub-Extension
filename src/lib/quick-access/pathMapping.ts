export type OsPathMapping = {
  id: string;
  name: string;
  windowsPath?: string;
  linuxPath?: string;
  macosPath?: string;
  createdAt: number;
  updatedAt: number;
};

export function resolveOsPath(mapping: OsPathMapping): string | undefined {
  if (navigator.platform === 'Win32') {
    return mapping.windowsPath;
  }

  if (navigator.platform === 'MacIntel' || navigator.platform === 'MacARM') {
    return mapping.macosPath;
  }

  return mapping.linuxPath;
}
