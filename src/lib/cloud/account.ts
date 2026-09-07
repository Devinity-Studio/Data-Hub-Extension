export type CloudProvider = 'google-drive' | 'onedrive' | 'dropbox';
export type CloudAccountStatus = 'connected' | 'expired' | 'error';

export type CloudAccount = {
  id: string;
  provider: CloudProvider;
  displayName: string;
  email?: string;
  profileName?: string;
  status: CloudAccountStatus;
  lastSyncAt?: number;
};
