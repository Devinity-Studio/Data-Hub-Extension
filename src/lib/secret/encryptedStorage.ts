import { encrypt, decrypt, generateKey, exportKey, importKey } from '../crypto/aesGcm';
import { makeId } from '../utils/id';

const MASTER_KEY_STORAGE_KEY = 'dataHubMasterKey';
const SECRETS_STORAGE_KEY = 'encryptedSecrets';

export interface StoredSecret {
  id: string;
  type: string;
  label: string;
  encryptedValue: string;
  iv: string;
  status: string;
  expiresAt?: number;
  createdAt: number;
  lastUsedAt?: number;
  revokedAt?: number;
  notes?: string;
}

// Get or create the master encryption key
export function getMasterKey(): Promise<CryptoKey> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(MASTER_KEY_STORAGE_KEY, (result) => {
      try {
        const existingKey = result[MASTER_KEY_STORAGE_KEY] as string | undefined;
        if (existingKey) {
          importKey(existingKey).then(resolve).catch(reject);
        } else {
          generateKey().then(async (newKey) => {
            const exported = await exportKey(newKey);
            chrome.storage.local.set({ [MASTER_KEY_STORAGE_KEY]: exported }).then(() => {
              resolve(newKey);
            }).catch(reject);
          }).catch(reject);
        }
      } catch (error) {
        reject(error);
      }
    });
  });
}

// Encrypt and store a secret value
export async function storeSecretValue(secretId: string, plaintext: string): Promise<void> {
  const key = await getMasterKey();
  const { ciphertext, iv } = await encrypt(plaintext, key);

  return new Promise((resolve, reject) => {
    chrome.storage.local.get(SECRETS_STORAGE_KEY, (result) => {
      try {
        const secrets = (result[SECRETS_STORAGE_KEY] as Map<string, { ciphertext: string; iv: string }>) || new Map();
        secrets.set(secretId, { ciphertext, iv });
        chrome.storage.local.set({ [SECRETS_STORAGE_KEY]: Array.from(secrets.entries()) })
          .then(resolve)
          .catch(reject);
      } catch (error) {
        reject(error);
      }
    });
  });
}

// Retrieve and decrypt a secret value
export async function retrieveSecretValue(secretId: string): Promise<string> {
  const key = await getMasterKey();

  return new Promise((resolve, reject) => {
    chrome.storage.local.get(SECRETS_STORAGE_KEY, (result) => {
      try {
        const stored = result[SECRETS_STORAGE_KEY] as Array<[string, { ciphertext: string; iv: string }]> | undefined;
        if (!stored) {
          reject(new Error('Secret not found'));
          return;
        }

        const secretsMap = new Map(stored);
        const secretData = secretsMap.get(secretId);

        if (!secretData) {
          reject(new Error('Secret not found'));
          return;
        }

        const plaintext = decrypt(secretData.ciphertext, secretData.iv, key);
        resolve(plaintext);
      } catch (error) {
        reject(error);
      }
    });
  });
}

// Delete a secret's encrypted value
export async function deleteSecretValue(secretId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(SECRETS_STORAGE_KEY, (result) => {
      try {
        const stored = result[SECRETS_STORAGE_KEY] as Array<[string, { ciphertext: string; iv: string }]> | undefined;
        if (!stored) {
          resolve();
          return;
        }

        const secretsMap = new Map(stored);
        secretsMap.delete(secretId);

        chrome.storage.local.set({ [SECRETS_STORAGE_KEY]: Array.from(secretsMap.entries()) })
          .then(resolve)
          .catch(reject);
      } catch (error) {
        reject(error);
      }
    });
  });
}

// Initialize encryption for the extension
export async function initEncryption(): Promise<void> {
  try {
    await getMasterKey();
  } catch (error) {
    console.error('Failed to initialize encryption:', error);
    throw error;
  }
}
