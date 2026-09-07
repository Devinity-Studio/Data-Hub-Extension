export function formatDate(ts: number): string {
  return new Date(ts).toLocaleString();
}

export function isExpired(expiresAt: number): boolean {
  return expiresAt <= Date.now();
}
