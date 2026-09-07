export type SecretType = 'backup-code' | 'api-key' | 'password' | 'token';
export type SecretStatus = 'active' | 'expired' | 'revoked';

export type SecretItem = {
  id: string;
  type: SecretType;
  label: string;
  encryptedValue: string;
  iv: string;
  status: SecretStatus;
  expiresAt?: number;
  createdAt: number;
  lastUsedAt?: number;
  revokedAt?: number;
  notes?: string;
};
