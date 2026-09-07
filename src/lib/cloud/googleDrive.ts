// Google Drive OAuth helper
// Note: This is a simplified version. For production, you'd need:
// 1. A backend server to handle OAuth flow securely
// 2. Proper redirect URIs registered in Google Cloud Console

export interface GoogleDriveAuthResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
  scope: string;
}

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  createdTime: string;
  modifiedTime: string;
  webViewLink: string;
}

const GOOGLE_DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.readonly',
];

// In a real extension, this would be your OAuth client ID from Google Cloud Console
// You would set this in chrome.storage or environment variables
const DEFAULT_CLIENT_ID = 'YOUR_CLIENT_ID.apps.googleusercontent.com';
const DEFAULT_REDIRECT_URI = 'https://localhost:3000/oauth2callback';

export function getOAuthUrl(
  clientId: string = DEFAULT_CLIENT_ID,
  redirectUri: string = DEFAULT_REDIRECT_URI,
  state?: string
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_DRIVE_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
  });

  if (state) {
    params.set('state', state);
  }

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCodeForTokens(
  code: string,
  clientId: string = DEFAULT_CLIENT_ID,
  clientSecret: string,
  redirectUri: string = DEFAULT_REDIRECT_URI
): Promise<GoogleDriveAuthResult> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    throw new Error(`Token exchange failed: ${response.statusText}`);
  }

  return response.json();
}

export async function refreshAccessToken(
  refreshToken: string,
  clientId: string = DEFAULT_CLIENT_ID,
  clientSecret: string
): Promise<GoogleDriveAuthResult> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    throw new Error(`Token refresh failed: ${response.statusText}`);
  }

  return response.json();
}

export async function listFiles(
  accessToken: string,
  query: string = "mimeType != 'application/vnd.google-apps.folder' and trashed = false",
  pageSize: number = 100
): Promise<GoogleDriveFile[]> {
  const files: GoogleDriveFile[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL('https://www.googleapis.com/drive/v3/files');
    url.searchParams.set('q', query);
    url.searchParams.set('pageSize', pageSize.toString());
    if (pageToken) {
      url.searchParams.set('pageToken', pageToken);
    }
    url.searchParams.set('fields', 'files(id,name,mimeType,size,createdTime,modifiedTime,webViewLink),nextPageToken');

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to list files: ${response.statusText}`);
    }

    const data = await response.json();
    files.push(...data.files);
    pageToken = data.nextPageToken;
  } while (pageToken);

  return files;
}

export async function getFileContent(
  accessToken: string,
  fileId: string
): Promise<ArrayBuffer> {
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get file content: ${response.statusText}`);
  }

  return response.arrayBuffer();
}

export async function createFile(
  accessToken: string,
  name: string,
  content: ArrayBuffer,
  mimeType: string,
  parentId?: string
): Promise<GoogleDriveFile> {
  const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';

  const metadata = JSON.stringify({
    name,
    mimeType,
    parents: parentId ? [parentId] : undefined,
  });

  const body = `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    metadata + '\r\n' +
    `--${boundary}\r\n` +
    `Content-Type: ${mimeType}\r\n\r\n` +
    new Uint8Array(content) + '\r\n' +
    `--${boundary}--`;

  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary="${boundary}"`,
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`Failed to create file: ${response.statusText}`);
  }

  return response.json();
}

export async function deleteFile(
  accessToken: string,
  fileId: string
): Promise<void> {
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok && response.status !== 404) {
    throw new Error(`Failed to delete file: ${response.statusText}`);
  }
}
