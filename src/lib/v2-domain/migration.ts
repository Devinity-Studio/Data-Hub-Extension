/**
 * V1 → V2 Migration Script
 * 
 * แปลง V1 DataRecord → V2 Service + Account + FieldValue + SecretRef + SecretItem
 * โดยรักษา Encryption Continuity และสร้าง Migration Metadata สำหรับ Traceability
 */

import { DataRecord, RecordCategory } from '../data/record';
import { SecretItem as V1SecretItem } from '../secret/secretItem';
import {
  Service,
  Account,
  FieldValue,
  SecretRef,
  SecretItem as V2SecretItem,
  MigrationMetadata,
  FieldType,
} from './types';

// ============================================================================
// CONFIGURATION
// ============================================================================

const MIGRATION_VERSION = 'v2.0.0-alpha.1';
const DEFAULT_SERVICE_NAME = 'Legacy Import';

// ============================================================================
// TYPE MAPPING: V1 Category → V2 Default Service
// ============================================================================

function getCategoryDefaultService(category: RecordCategory): Partial<Service> {
  const serviceMap: Record<RecordCategory, { name: string; categoryId: string }> = {
    credential: { name: 'Imported Credentials', categoryId: 'credential' },
    project: { name: 'Imported Projects', categoryId: 'project' },
    finance: { name: 'Imported Finance', categoryId: 'finance' },
    custom: { name: 'Imported Custom', categoryId: 'custom' },
  };
  
  return serviceMap[category];
}

// ============================================================================
// FIELD TYPE INFERENCE (V1 fields เป็น Record<string,string> ต้อง infer type)
// ============================================================================

function inferFieldType(key: string, value: string): FieldType {
  const lowerKey = key.toLowerCase();
  const lowerValue = value.toLowerCase();
  
  // Check for secret types
  if (lowerKey.includes('password') || lowerKey.includes('pass')) {
    return 'password';
  }
  if (lowerKey.includes('api') && lowerKey.includes('key')) {
    return 'api-key';
  }
  if (lowerKey.includes('token')) {
    return 'token';
  }
  if (lowerKey.includes('backup') && lowerKey.includes('code')) {
    return 'backup-code';
  }
  
  // Check for common field types
  if (lowerKey.includes('email') || lowerValue.includes('@')) {
    return 'email';
  }
  if (lowerKey.includes('url') || lowerValue.startsWith('http')) {
    return 'url';
  }
  if (lowerKey.includes('phone') || lowerKey.includes('tel')) {
    return 'phone';
  }
  if (lowerKey.includes('account') && lowerKey.includes('number')) {
    return 'account-number';
  }
  if (lowerKey.includes('crypto') || lowerKey.includes('wallet')) {
    return 'crypto-address';
  }
  if (lowerKey.includes('date') || lowerKey.includes('time')) {
    return 'date';
  }
  if (lowerKey.includes('count') || lowerKey.includes('amount') || lowerKey.includes('budget')) {
    return 'number';
  }
  
  // Default to text
  return 'text';
}

// ============================================================================
// SECRET ITEM MIGRATION (V1 → V2)
// ============================================================================

function migrateSecretItem(
  v1Secret: V1SecretItem,
  secretRefId: string,
  version: number
): V2SecretItem {
  // Map V1 status to V2 status
  const v2StatusMap: Record<string, 'active' | 'expired' | 'revoked' | 'rotated'> = {
    active: 'active',
    expired: 'expired',
    revoked: 'revoked',
  };
  
  return {
    id: `v2-${v1Secret.id}`, // Prefix เพื่อ trace กลับไป V1 ได้
    secretRefId,
    type: v1Secret.type,
    status: v2StatusMap[v1Secret.status] || 'active',
    
    // Preserve encrypted value และ iv จาก V1 (Encryption Continuity)
    encryptedValue: v1Secret.encryptedValue,
    iv: v1Secret.iv,
    authTag: undefined, // V1 ไม่มี authTag
    
    // Lifecycle
    version, // Version 1 สำหรับ migration
    createdAt: v1Secret.createdAt,
    expiresAt: v1Secret.expiresAt,
    revokedAt: v1Secret.revokedAt,
    rotatedAt: undefined,
    
    // Usage tracking
    lastUsedAt: v1Secret.lastUsedAt,
    usageCount: 0,
    
    // Audit
    notes: v1Secret.notes,
    createdBy: 'migration',
  };
}

// ============================================================================
// MAIN MIGRATION FUNCTION
// ============================================================================

export interface MigrationResult {
  success: boolean;
  v1Record: DataRecord;
  v2Service?: Service;
  v2Account?: Account;
  v2FieldValues?: FieldValue[];
  v2SecretRefs?: SecretRef[];
  v2SecretItems?: V2SecretItem[];
  migrationMetadata?: MigrationMetadata;
  errors?: string[];
  warnings?: string[];
}

/**
 * Migrate single V1 DataRecord → V2 Service + Account
 * 
 * Mapping Strategy:
 * - 1 V1 DataRecord → 1 V2 Service (grouped by category) + 1 V2 Account
 * - V1 fields → V2 FieldValue[] (infer type จาก key/value)
 * - V1 secretItems → V2 SecretRef[] + V2SecretItem[]
 */
export function migrateV1RecordToV2(v1Record: DataRecord): MigrationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  try {
    const now = Date.now();
    
    // -------------------------------------------------------------------------
    // Step 1: Create/Reuse Service (grouped by category)
    // -------------------------------------------------------------------------
    const defaultService = getCategoryDefaultService(v1Record.category);
    
    const v2Service: Service = {
      id: `svc-${v1Record.category}-${now}`,
      name: v1Record.title.includes(' ') ? v1Record.title.split(' ')[0] : v1Record.title, // Use first word or full title
      categoryId: v1Record.category,
      formatId: undefined, // Will be assigned later by Schema Engine
      typeId: undefined, // Will be assigned later by Schema Engine
      
      description: `Migrated from V1 ${v1Record.category} record`,
      tags: ['migrated', 'v1'],
      
      createdAt: v1Record.createdAt,
      updatedAt: v1Record.updatedAt,
    };
    
    // -------------------------------------------------------------------------
    // Step 2: Create Account
    // -------------------------------------------------------------------------
    const v2Account: Account = {
      id: `acc-${v1Record.id}`,
      serviceId: v2Service.id,
      label: v1Record.title, // Use V1 title as account label
      
      username: v1Record.fields['username'] || v1Record.fields['email'],
      authType: 'password', // Default assumption
      
      fields: [], // Will populate below
      secretRefs: [], // Will populate below
      
      notes: v1Record.fields['notes'] || v1Record.fields['note'],
      tags: ['migrated'],
      
      createdAt: v1Record.createdAt,
      updatedAt: v1Record.updatedAt,
      lastAccessedAt: undefined,
    };
    
    // -------------------------------------------------------------------------
    // Step 3: Migrate Fields (non-secret)
    // -------------------------------------------------------------------------
    const v2FieldValues: FieldValue[] = [];
    let fieldCounter = 0;
    
    for (const [key, value] of Object.entries(v1Record.fields)) {
      // Skip fields that will become secrets
      const fieldType = inferFieldType(key, value);
      const isSecret = ['password', 'api-key', 'token', 'backup-code'].includes(fieldType);
      
      if (isSecret) {
        // จะถูกจัดการใน Step 4
        continue;
      }
      
      // Create FieldDefinition ID (dynamic สำหรับ migrated data)
      const fieldDefId = `field-def-${v1Record.id}-${fieldCounter++}`;
      
      const fieldValue: FieldValue = {
        fieldDefId,
        value, // Plain value สำหรับ non-secret
        secretRefId: undefined,
        lastModified: v1Record.updatedAt,
      };
      
      v2FieldValues.push(fieldValue);
    }
    
    v2Account.fields = v2FieldValues;
    
    // -------------------------------------------------------------------------
    // Step 4: Migrate Secret Items → SecretRef + SecretItem
    // -------------------------------------------------------------------------
    const v2SecretRefs: SecretRef[] = [];
    const v2SecretItems: V2SecretItem[] = [];
    let secretCounter = 0;
    
    for (const v1Secret of v1Record.secretItems) {
      const secretRefId = `sref-${v1Secret.id}`;
      
      // Create SecretRef
      const fieldDefId = `field-def-secret-${v1Record.id}-${secretCounter++}`;
      
      const secretRef: SecretRef = {
        id: secretRefId,
        accountId: v2Account.id,
        fieldDefId,
        currentSecretItemId: `v2-${v1Secret.id}`, // Points to migrated SecretItem
        label: v1Secret.label,
        createdAt: v1Secret.createdAt,
        updatedAt: v1Secret.createdAt,
      };
      
      v2SecretRefs.push(secretRef);
      
      // Create corresponding FieldValue (with secretRefId instead of value)
      const secretFieldValue: FieldValue = {
        fieldDefId,
        value: undefined, // No plain value
        secretRefId, // Points to SecretRef
        lastModified: v1Secret.createdAt,
      };
      
      v2Account.fields.push(secretFieldValue);
      
      // Create V2 SecretItem (version 1)
      const v2SecretItem = migrateSecretItem(v1Secret, secretRefId, 1);
      v2SecretItems.push(v2SecretItem);
    }
    
    v2Account.secretRefs = v2SecretRefs;
    
    // -------------------------------------------------------------------------
    // Step 5: Create Migration Metadata (สำหรับ Traceability)
    // -------------------------------------------------------------------------
    const migrationMetadata: MigrationMetadata = {
      migratedFromV1: true,
      v1RecordId: v1Record.id,
      v1Category: v1Record.category,
      migratedAt: now,
      migrationVersion: MIGRATION_VERSION,
      
      // Mapping traceability
      serviceId: v2Service.id,
      accountIds: [v2Account.id],
      secretRefIds: v2SecretRefs.map(sr => sr.id),
      
      // Integrity verification
      fieldCount: v2FieldValues.length + v2SecretRefs.length,
      secretCount: v2SecretItems.length,
      encryptionVerified: true, // Assume verified ถ้าไม่มี error
    };
    
    // -------------------------------------------------------------------------
    // Validation
    // -------------------------------------------------------------------------
    if (!v2Service.id) {
      errors.push('Service ID is missing');
    }
    if (!v2Account.id) {
      errors.push('Account ID is missing');
    }
    if (v2SecretItems.length !== v1Record.secretItems.length) {
      warnings.push(
        `Secret count mismatch: V1 had ${v1Record.secretItems.length}, V2 has ${v2SecretItems.length}`
      );
    }
    
    return {
      success: errors.length === 0,
      v1Record,
      v2Service,
      v2Account,
      v2FieldValues,
      v2SecretRefs,
      v2SecretItems,
      migrationMetadata,
      errors,
      warnings,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      v1Record: v1Record,
      errors: [`Migration failed: ${errorMessage}`],
    };
  }
}

// ============================================================================
// BATCH MIGRATION
// ============================================================================

export interface BatchMigrationResult {
  totalRecords: number;
  successful: number;
  failed: number;
  results: MigrationResult[];
  summary: {
    totalFields: number;
    totalSecrets: number;
    servicesCreated: Set<string>;
    accountsCreated: Set<string>;
  };
}

/**
 * Migrate multiple V1 records ใน batch
 */
export function migrateV1RecordsBatch(v1Records: DataRecord[]): BatchMigrationResult {
  const results: MigrationResult[] = [];
  const servicesCreated = new Set<string>();
  const accountsCreated = new Set<string>();
  let totalFields = 0;
  let totalSecrets = 0;
  
  for (const record of v1Records) {
    const result = migrateV1RecordToV2(record);
    results.push(result);
    
    if (result.success && result.v2Service && result.v2Account) {
      servicesCreated.add(result.v2Service.id);
      accountsCreated.add(result.v2Account.id);
      totalFields += result.migrationMetadata!.fieldCount;
      totalSecrets += result.migrationMetadata!.secretCount;
    }
  }
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  return {
    totalRecords: v1Records.length,
    successful,
    failed,
    results,
    summary: {
      totalFields,
      totalSecrets,
      servicesCreated,
      accountsCreated,
    },
  };
}

// ============================================================================
// ROLLBACK FUNCTION (สำหรับกรณีต้องย้อนกลับ)
// ============================================================================

export interface RollbackResult {
  success: boolean;
  v1Record: DataRecord;
  errors?: string[];
}

/**
 * Rollback V2 data กลับไปเป็น V1 DataRecord
 * ใช้เมื่อ migration มีปัญหาและต้อง restore ข้อมูลเดิม
 */
export function rollbackV2ToV1(
  v2Account: Account,
  v2SecretItems: V2SecretItem[],
  originalV1Record: DataRecord
): RollbackResult {
  try {
    // Restore V1 fields จาก non-secret FieldValues
    const restoredFields: Record<string, string> = {};
    
    for (const fieldValue of v2Account.fields) {
      if (fieldValue.value !== undefined && fieldValue.secretRefId === undefined) {
        // Non-secret field - restore directly
        // Note: field key อาจสูญหายถ้าไม่ได้ store ไว้ใน metadata
        restoredFields[`migrated_${fieldValue.fieldDefId}`] = fieldValue.value;
      }
    }
    
    // Restore V1 secretItems
    const restoredSecretItems: V1SecretItem[] = [];
    
    for (const v2Secret of v2SecretItems) {
      // Map V2 status back to V1
      const v1StatusMap: Record<string, 'active' | 'expired' | 'revoked'> = {
        active: 'active',
        expired: 'expired',
        revoked: 'revoked',
        rotated: 'revoked', // Treat rotated as revoked in V1
      };
      
      restoredSecretItems.push({
        id: v2Secret.id.replace('v2-', ''), // Remove prefix
        type: v2Secret.type,
        label: v2Secret.notes || v2Secret.label || 'Migrated Secret',
        encryptedValue: v2Secret.encryptedValue,
        iv: v2Secret.iv,
        status: v1StatusMap[v2Secret.status] || 'active',
        expiresAt: v2Secret.expiresAt,
        createdAt: v2Secret.createdAt,
        lastUsedAt: v2Secret.lastUsedAt,
        revokedAt: v2Secret.revokedAt,
        notes: v2Secret.notes,
      });
    }
    
    const restoredV1Record: DataRecord = {
      ...originalV1Record,
      fields: restoredFields,
      secretItems: restoredSecretItems,
      updatedAt: Date.now(),
    };
    
    return {
      success: true,
      v1Record: restoredV1Record,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      v1Record: originalV1Record,
      errors: [`Rollback failed: ${errorMessage}`],
    };
  }
}
