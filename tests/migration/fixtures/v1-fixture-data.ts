/**
 * V1 Fixture Data สำหรับทดสอบ Migration
 * 
 * สร้างข้อมูลจำลองที่แทนสถานะจริงของ V1 DataRecord
 * ครอบคลุมทุก category และ edge cases
 */

import { DataRecord, SecretItem } from '../../src/lib/data/types';

/**
 * Helper: สร้าง SecretItem แบบ V1
 */
function createV1SecretItem(
  type: 'password' | 'api-key' | 'token' | 'backup-code',
  label: string,
  value: string,
  status: 'active' | 'expired' | 'revoked' = 'active'
): SecretItem {
  // ในความเป็นจริง encryptedValue และ iv มาจาก encryption function
  // แต่สำหรับ fixture เราจะใช้ placeholder ที่ simulate รูปแบบ
  return {
    id: `secret-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type,
    label,
    encryptedValue: `enc_${Buffer.from(value).toString('base64')}`, // simulate
    iv: `iv_${Math.random().toString(36).substr(2, 16)}`,
    status,
    createdAt: Date.now() - Math.floor(Math.random() * 10000000),
    expiresAt: status === 'expired' ? Date.now() - 1000 : undefined,
    revokedAt: status === 'revoked' ? Date.now() - 1000 : undefined,
    notes: status === 'revoked' ? 'Revoked for testing' : undefined,
  };
}

/**
 * Fixture 1: Credential Record (Basic)
 * - มี username, password
 * - 1 active secret (password)
 */
export const fixtureCredentialBasic: DataRecord = {
  id: 'v1-cred-basic-001',
  title: 'Google Account',
  category: 'credential',
  fields: {
    username: 'john.doe@gmail.com',
    url: 'https://accounts.google.com',
  },
  secretItems: [
    createV1SecretItem('password', 'Password', 'SuperSecret123!', 'active'),
  ],
  createdAt: Date.now() - 86400000 * 30,
  updatedAt: Date.now() - 86400000 * 5,
};

/**
 * Fixture 2: Credential Record (Multi-Secret)
 * - มี password + backup codes + API key
 * - หลายสถานะ (active, expired, revoked)
 */
export const fixtureCredentialMultiSecret: DataRecord = {
  id: 'v1-cred-multi-002',
  title: 'GitHub Account',
  category: 'credential',
  fields: {
    username: 'johndoe',
    url: 'https://github.com',
    email: 'john@example.com',
  },
  secretItems: [
    createV1SecretItem('password', 'Login Password', 'GitPass456!', 'active'),
    createV1SecretItem('api-key', 'Personal Access Token', 'ghp_xxxxxxxxxxxxxxxxxxxx', 'active'),
    createV1SecretItem('backup-code', 'Backup Codes', 'ABC123-DEF456-GHI789', 'active'),
    createV1SecretItem('token', 'OAuth Token', 'oauth_token_xyz', 'expired'),
    createV1SecretItem('api-key', 'Old API Key', 'old_key_revoked', 'revoked'),
  ],
  createdAt: Date.now() - 86400000 * 90,
  updatedAt: Date.now() - 86400000 * 2,
};

/**
 * Fixture 3: Project Record
 * - Custom fields
 * - No secrets
 */
export const fixtureProject: DataRecord = {
  id: 'v1-proj-003',
  title: 'Website Redesign Project',
  category: 'project',
  fields: {
    client: 'Acme Corp',
    budget: '$50,000',
    startDate: '2024-01-15',
    endDate: '2024-06-30',
    status: 'In Progress',
    teamLead: 'Jane Smith',
  },
  secretItems: [],
  createdAt: Date.now() - 86400000 * 60,
  updatedAt: Date.now() - 86400000 * 1,
};

/**
 * Fixture 4: Finance Record
 * - Financial institution data
 * - Sensitive numbers
 */
export const fixtureFinance: DataRecord = {
  id: 'v1-fin-004',
  title: 'KBank Savings Account',
  category: 'finance',
  fields: {
    institution: 'Kasikornbank',
    accountNumber: '123-4-56789-0',
    accountType: 'Savings',
    branch: 'Silom',
  },
  secretItems: [
    createV1SecretItem('password', 'Internet Banking Password', 'KBankPass789!', 'active'),
    createV1SecretItem('token', 'OTP Seed', 'otp_seed_base32', 'active'),
  ],
  createdAt: Date.now() - 86400000 * 120,
  updatedAt: Date.now() - 86400000 * 7,
};

/**
 * Fixture 5: Custom Record (Complex Fields)
 * - Mixed field types (stored as strings in V1)
 * - Multiple secrets
 */
export const fixtureCustomComplex: DataRecord = {
  id: 'v1-cust-005',
  title: 'Server Infrastructure',
  category: 'custom',
  fields: {
    serverName: 'prod-web-01',
    ipAddress: '192.168.1.100',
    os: 'Ubuntu 22.04 LTS',
    cpu: '8 cores',
    ram: '32GB',
    storage: '1TB SSD',
    location: 'Bangkok DC',
    provider: 'AWS',
  },
  secretItems: [
    createV1SecretItem('password', 'Root Password', 'R00tP@ssw0rd!', 'active'),
    createV1SecretItem('api-key', 'SSH Private Key', '-----BEGIN RSA PRIVATE KEY-----...', 'active'),
    createV1SecretItem('token', 'API Token', 'api_tok_1234567890', 'active'),
  ],
  createdAt: Date.now() - 86400000 * 200,
  updatedAt: Date.now() - 86400000 * 10,
};

/**
 * Fixture 6: Edge Case - Empty Fields
 * - Minimal record
 */
export const fixtureMinimal: DataRecord = {
  id: 'v1-min-006',
  title: 'Simple Note',
  category: 'custom',
  fields: {},
  secretItems: [],
  createdAt: Date.now() - 86400000,
  updatedAt: Date.now() - 86400000,
};

/**
 * Fixture 7: Edge Case - Only Secrets
 * - No fields, only secrets
 */
export const fixtureOnlySecrets: DataRecord = {
  id: 'v1-sec-007',
  title: 'Master Password Vault',
  category: 'credential',
  fields: {
    note: 'Contains master passwords for critical systems',
  },
  secretItems: [
    createV1SecretItem('password', 'Admin Password', 'Adm1nP@ss!', 'active'),
    createV1SecretItem('password', 'Recovery Password', 'Rec0v3ry!', 'active'),
    createV1SecretItem('backup-code', 'Emergency Codes', 'EMG-001-EMG-002-EMG-003', 'active'),
  ],
  createdAt: Date.now() - 86400000 * 365,
  updatedAt: Date.now() - 86400000 * 30,
};

/**
 * Fixture 8: Edge Case - Special Characters in Fields
 * - Unicode, emojis, special chars
 */
export const fixtureSpecialChars: DataRecord = {
  id: 'v1-spe-008',
  title: 'International Account 🌏',
  category: 'credential',
  fields: {
    username: 'ユーザー名@test.co.jp',
    displayName: 'John  Doe  Jr.',
    notes: 'Special chars: @#$%^&*()_+-=[]{}|;:\'",.<>?/`~🎉',
  },
  secretItems: [
    createV1SecretItem('password', 'Password', 'P@$$w0rd!日本語', 'active'),
  ],
  createdAt: Date.now() - 86400000 * 15,
  updatedAt: Date.now() - 86400000 * 3,
};

/**
 * Fixture 9: Edge Case - Very Old Record
 * - Created long ago, never updated
 */
export const fixtureOldRecord: DataRecord = {
  id: 'v1-old-009',
  title: 'Legacy System Access',
  category: 'credential',
  fields: {
    system: 'Mainframe v3.2',
    username: 'legacy_user',
  },
  secretItems: [
    createV1SecretItem('password', 'Legacy Password', 'LegacyP@ss1990!', 'active'),
  ],
  createdAt: Date.now() - 86400000 * 1000, // ~3 years ago
  updatedAt: Date.now() - 86400000 * 1000,
};

/**
 * Fixture 10: Edge Case - Recently Updated
 * - Just updated
 */
export const fixtureRecentlyUpdated: DataRecord = {
  id: 'v1-rec-010',
  title: 'Just Updated Record',
  category: 'credential',
  fields: {
    username: 'fresh@example.com',
  },
  secretItems: [
    createV1SecretItem('password', 'New Password', 'NewP@ss2024!', 'active'),
  ],
  createdAt: Date.now() - 86400000 * 100,
  updatedAt: Date.now() - 1000, // 1 second ago
};

/**
 * Export all fixtures as array for iteration
 */
export const ALL_V1_FIXTURES: DataRecord[] = [
  fixtureCredentialBasic,
  fixtureCredentialMultiSecret,
  fixtureProject,
  fixtureFinance,
  fixtureCustomComplex,
  fixtureMinimal,
  fixtureOnlySecrets,
  fixtureSpecialChars,
  fixtureOldRecord,
  fixtureRecentlyUpdated,
];

/**
 * Metadata about fixtures
 */
export const FIXTURE_METADATA = {
  totalRecords: ALL_V1_FIXTURES.length,
  byCategory: {
    credential: ALL_V1_FIXTURES.filter(r => r.category === 'credential').length,
    project: ALL_V1_FIXTURES.filter(r => r.category === 'project').length,
    finance: ALL_V1_FIXTURES.filter(r => r.category === 'finance').length,
    custom: ALL_V1_FIXTURES.filter(r => r.category === 'custom').length,
  },
  totalSecrets: ALL_V1_FIXTURES.reduce((sum, r) => sum + r.secretItems.length, 0),
  secretsByStatus: {
    active: ALL_V1_FIXTURES.reduce(
      (sum, r) => sum + r.secretItems.filter(s => s.status === 'active').length,
      0
    ),
    expired: ALL_V1_FIXTURES.reduce(
      (sum, r) => sum + r.secretItems.filter(s => s.status === 'expired').length,
      0
    ),
    revoked: ALL_V1_FIXTURES.reduce(
      (sum, r) => sum + r.secretItems.filter(s => s.status === 'revoked').length,
      0
    ),
  },
  edgeCases: [
    'Empty fields (fixtureMinimal)',
    'Only secrets (fixtureOnlySecrets)',
    'Special characters (fixtureSpecialChars)',
    'Very old record (fixtureOldRecord)',
    'Recently updated (fixtureRecentlyUpdated)',
    'Multi-secret (fixtureCredentialMultiSecret)',
  ],
};

console.log('V1 Fixtures Loaded:', FIXTURE_METADATA);
