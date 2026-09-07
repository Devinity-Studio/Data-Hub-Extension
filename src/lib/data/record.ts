export type RecordCategory = 'credential' | 'project' | 'finance' | 'custom';

export type DataRecord = {
  id: string;
  title: string;
  category: RecordCategory;
  fields: Record<string, string>;
  secretItems: import('../secret/secretItem').SecretItem[];
  createdAt: number;
  updatedAt: number;
};

export type HistoryEntry = {
  id: string;
  recordId: string;
  action: 'created' | 'updated' | 'copied' | 'revoked' | 'restored';
  changedFields: string[];
  secretItemId?: string;
  createdAt: number;
};
