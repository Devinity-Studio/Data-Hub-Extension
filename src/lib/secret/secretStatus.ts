export type SecretStatus = 'active' | 'expired' | 'revoked';

export function resolveSecretStatus(status: SecretStatus, expiresAt?: number): SecretStatus {
  if (status === 'revoked') {
    return 'revoked';
  }

  if (expiresAt != null && expiresAt <= Date.now()) {
    return 'expired';
  }

  return 'active';
}

export function isExpiringSoon(expiresAt: number, windowMs = 7 * 24 * 60 * 60 * 1000): boolean {
  const now = Date.now();
  const threshold = now + windowMs;
  return expiresAt > now && expiresAt <= threshold;
}

export function canCopy(status: SecretStatus, expiresAt?: number): boolean {
  return resolveSecretStatus(status, expiresAt) === 'active';
}
