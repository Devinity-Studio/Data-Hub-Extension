/**
 * V2 Canonical Domain Model Types
 * 
 * นิยามตาม FieldValue → SecretRef → SecretItem architecture
 * ที่ผ่านการแก้ไขตาม Condition ของ Co-Founder
 */

// ============================================================================
// LAYER 1: CATEGORY / FORMAT / TYPE (Template Layer)
// ============================================================================

export type RecordCategory = 'credential' | 'project' | 'finance' | 'custom';

export type FormatDefinition = {
  id: string;
  categoryId: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  order: number;
};

export type TypeDefinition = {
  id: string;
  formatId: string;
  name: string;
  description?: string;
  fieldDefinitions: FieldDefinition[]; // Reusable template, not mutable
};

// ============================================================================
// LAYER 2: FIELD DEFINITION (Schema Layer)
// ============================================================================

export type FieldType = 
  | 'text'
  | 'email'
  | 'url'
  | 'password'      // References SecretItem
  | 'api-key'       // References SecretItem
  | 'token'         // References SecretItem
  | 'backup-code'   // References SecretItem
  | 'number'
  | 'date'
  | 'select'
  | 'textarea'
  | 'phone'
  | 'account-number'
  | 'crypto-address';

export type FieldValidation = {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  options?: SelectOption[];
};

export type SelectOption = {
  value: string;
  label: string;
};

export type FieldDefinition = {
  id: string;
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  secret?: boolean; // true = must reference SecretItem
  masked?: boolean;
  copyable?: boolean;
  validation?: FieldValidation;
  order: number;
  description?: string;
  placeholder?: string;
};

// ============================================================================
// LAYER 3: SERVICE (Instance Layer)
// ============================================================================

export type Service = {
  id: string;
  name: string;
  url?: string;
  faviconUrl?: string;
  categoryId: string;
  formatId?: string;
  typeId?: string; // References TypeDefinition for schema
  
  // Metadata
  description?: string;
  tags?: string[];
  
  // Capture support
  origins?: string[]; // URL patterns for auto-match
  appIds?: string[];  // App identifiers for mobile
  
  createdAt: number;
  updatedAt: number;
};

// ============================================================================
// LAYER 4: ACCOUNT (Actual Data Layer)
// ============================================================================

export type Account = {
  id: string;
  serviceId: string;
  label: string; // e.g., "john@gmail.com", "Work Account"
  
  // Authentication info (non-secret)
  username?: string;
  authType?: 'password' | 'oauth' | 'passkey' | 'sso' | 'custom';
  
  // Field values - แยกชัดเจนระหว่าง normal vs secret
  fields: FieldValue[];
  
  // Secret references - Source of truth สำหรับ secret values
  secretRefs: SecretRef[];
  
  // Metadata
  notes?: string;
  tags?: string[];
  
  createdAt: number;
  updatedAt: number;
  lastAccessedAt?: number;
};

// ============================================================================
// LAYER 5: FIELD VALUE (Actual Values - Non-Secret or Secret Reference)
// ============================================================================

export type FieldValue = {
  fieldDefId: string; // Reference to FieldDefinition.id
  value?: string;     // Plain value สำหรับ non-secret fields
  secretRefId?: string; // Reference to SecretRef.id สำหรับ secret fields
  
  // Metadata
  lastModified: number;
};

// ============================================================================
// LAYER 6: SECRET REFERENCE (Bridge between Field and Secret)
// ============================================================================

export type SecretRef = {
  id: string;
  accountId: string;
  fieldDefId: string; // Reference to FieldDefinition.id
  
  // Pointer to current active SecretItem
  currentSecretItemId: string;
  
  // Metadata
  label: string; // Human-readable label
  createdAt: number;
  updatedAt: number;
};

// ============================================================================
// LAYER 7: SECRET ITEM (Immutable Version Container)
// ============================================================================

export type SecretType = 'backup-code' | 'api-key' | 'password' | 'token';
export type SecretStatus = 'active' | 'expired' | 'revoked' | 'rotated';

export type SecretItem = {
  id: string;
  secretRefId: string; // Owner reference
  
  type: SecretType;
  status: SecretStatus;
  
  // Encrypted value (AES-GCM)
  encryptedValue: string;
  iv: string;
  authTag?: string; // For AES-GCM
  
  // Lifecycle
  version: number; // Auto-increment, max 5 versions kept
  createdAt: number;
  expiresAt?: number;
  revokedAt?: number;
  rotatedAt?: number;
  
  // Usage tracking
  lastUsedAt?: number;
  usageCount?: number;
  
  // Audit
  notes?: string;
  createdBy?: string; // User/system that created this version
};

// ============================================================================
// LAYER 8: SECRET VERSION HISTORY (Audit Trail)
// ============================================================================

export type SecretVersionHistory = {
  id: string;
  secretItemId: string;
  
  // Snapshot of previous state
  previousEncryptedValue: string;
  previousIv: string;
  previousAuthTag?: string;
  
  // Reason for change
  reason: 'rotation' | 'update' | 'revoke' | 'restore';
  description?: string;
  
  // Timestamp
  createdAt: number;
  createdBy?: string;
};

// ============================================================================
// LAYER 9: AUDIT HISTORY (System-wide Event Log)
// ============================================================================

export type AuditEventType =
  | 'created'
  | 'updated'
  | 'revealed'
  | 'copied'
  | 'rotated'
  | 'revoked'
  | 'restored'
  | 'accessed'
  | 'exported'
  | 'imported'
  | 'synced';

export type AuditEntityType = 'service' | 'account' | 'field' | 'secret' | 'category';

export type AuditHistoryEntry = {
  id: string;
  
  // What happened
  eventType: AuditEventType;
  entityType: AuditEntityType;
  entityId: string;
  
  // Context
  userId?: string;
  sessionId?: string;
  ipAddress?: string; // If applicable
  userAgent?: string; // If applicable
  
  // Details
  changedFields?: string[];
  oldValueHash?: string; // Hash only, not actual value
  newValueHash?: string;
  metadata?: Record<string, any>;
  
  // Timestamp (no retention limit - different from Secret Versions)
  createdAt: number;
};

// ============================================================================
// MIGRATION METADATA (สำหรับ Track การย้ายจาก V1)
// ============================================================================

export type MigrationMetadata = {
  migratedFromV1: true;
  v1RecordId: string;
  v1Category: RecordCategory;
  migratedAt: number;
  migrationVersion: string;
  
  // Mapping traceability
  serviceId: string;
  accountIds: string[];
  secretRefIds: string[];
  
  // Integrity verification
  fieldCount: number;
  secretCount: number;
  encryptionVerified: boolean;
};

// ============================================================================
// UNION TYPES (สำหรับ Backward Compatibility)
// ============================================================================

export type V2DataEntity = Service | Account;

export type AnyFieldDefinition = FieldDefinition;

export type AnyFieldValue = FieldValue;

export type AnySecretRef = SecretRef;

// ============================================================================
// HELPER TYPES
// ============================================================================

export type EncryptedPayload = {
  ciphertext: string;
  iv: string;
  authTag?: string;
};

export type DecryptedValue = {
  plaintext: string;
  decryptedAt: number;
  expiresAt: number; // Session expiry
};

export type SessionContext = {
  sessionId: string;
  unlockedAt: number;
  expiresAt: number;
  masterKeyDerivation: 'pbkdf2' | 'argon2';
};
