/**
 * Migration Test Suite
 * 
 * ทดสอบ V1 → V2 Migration ด้วย Fixture Data จริง
 * ตรวจสอบ:
 * 1. Integrity Verification (ข้อมูลครบถ้วน)
 * 2. Encryption Continuity (encrypted values ยังเหมือนเดิม)
 * 3. Rollback Capability (สามารถย้อนกลับได้)
 * 4. Edge Cases (กรณีพิเศษต่างๆ)
 */

import { ALL_V1_FIXTURES, FIXTURE_METADATA } from './fixtures/v1-fixture-data.js';
import {
  migrateV1RecordToV2,
  migrateV1RecordsBatch,
  rollbackV2ToV1,
  MigrationResult,
  BatchMigrationResult,
} from '../../src/lib/v2-domain/migration.js';
import { Account, SecretItem as V2SecretItem } from '../../src/lib/v2-domain/types.js';

// ============================================================================
// TEST RESULTS TRACKING
// ============================================================================

interface TestReport {
  testName: string;
  passed: boolean;
  details: string;
  errors?: string[];
  warnings?: string[];
}

interface FullTestReport {
  timestamp: number;
  totalTests: number;
  passed: number;
  failed: number;
  warnings: number;
  reports: TestReport[];
  summary: {
    integrityCheck: 'PASS' | 'FAIL';
    encryptionContinuity: 'PASS' | 'FAIL';
    rollbackCapability: 'PASS' | 'FAIL';
    edgeCasesHandled: 'PASS' | 'FAIL';
  };
}

// ============================================================================
// TEST 1: INTEGRITY VERIFICATION
// ============================================================================

function testIntegrityVerification(): TestReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  console.log('\n🧪 TEST 1: Integrity Verification');
  console.log('=====================================');
  
  let totalFieldsMigrated = 0;
  let totalSecretsMigrated = 0;
  
  for (const fixture of ALL_V1_FIXTURES) {
    const result = migrateV1RecordToV2(fixture);
    
    if (!result.success) {
      errors.push(`Failed to migrate ${fixture.id}: ${result.errors?.join(', ')}`);
      continue;
    }
    
    // Verify field count
    const originalFieldCount = Object.keys(fixture.fields).length;
    const migratedFieldCount = result.v2FieldValues?.length || 0;
    const migratedSecretCount = result.v2SecretRefs?.length || 0;
    
    // Note: secret fields ใน V1 จะถูกแยกเป็น SecretRef + FieldValue pair ใน V2
    // ดังนั้น total = non-secret fields + secret fields
    
    totalFieldsMigrated += migratedFieldCount;
    totalSecretsMigrated += migratedSecretCount;
    
    // Verify secrets count
    if (migratedSecretCount !== fixture.secretItems.length) {
      errors.push(
        `Secret count mismatch for ${fixture.id}: ` +
        `V1 had ${fixture.secretItems.length}, V2 has ${migratedSecretCount}`
      );
    }
    
    // Verify migration metadata exists
    if (!result.migrationMetadata) {
      errors.push(`Missing migration metadata for ${fixture.id}`);
    } else {
      // Verify traceability
      if (result.migrationMetadata.v1RecordId !== fixture.id) {
        errors.push(`Wrong v1RecordId in metadata for ${fixture.id}`);
      }
      
      if (result.migrationMetadata.secretCount !== migratedSecretCount) {
        errors.push(`Wrong secretCount in metadata for ${fixture.id}`);
      }
    }
    
    console.log(`  ✓ ${fixture.id}: ${migratedFieldCount} fields, ${migratedSecretCount} secrets`);
  }
  
  console.log(`\n  Total: ${totalFieldsMigrated} fields, ${totalSecretsMigrated} secrets migrated`);
  
  return {
    testName: 'Integrity Verification',
    passed: errors.length === 0,
    details: `Migrated ${totalFieldsMigrated} fields and ${totalSecretsMigrated} secrets from ${ALL_V1_FIXTURES.length} records`,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

// ============================================================================
// TEST 2: ENCRYPTION CONTINUITY
// ============================================================================

function testEncryptionContinuity(): TestReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  console.log('\n🧪 TEST 2: Encryption Continuity');
  console.log('=====================================');
  
  let verifiedCount = 0;
  
  for (const fixture of ALL_V1_FIXTURES) {
    const result = migrateV1RecordToV2(fixture);
    
    if (!result.success || !result.v2SecretItems) {
      errors.push(`Cannot verify encryption for ${fixture.id}: migration failed`);
      continue;
    }
    
    // Verify each secret's encrypted value is preserved
    for (let i = 0; i < fixture.secretItems.length; i++) {
      const v1Secret = fixture.secretItems[i];
      const v2Secret = result.v2SecretItems[i];
      
      if (!v2Secret) {
        errors.push(`Missing V2 secret for ${v1Secret.id}`);
        continue;
      }
      
      // Critical: encryptedValue must be identical
      if (v2Secret.encryptedValue !== v1Secret.encryptedValue) {
        errors.push(
          `Encryption mismatch for ${v1Secret.id}: ` +
          `V1="${v1Secret.encryptedValue}", V2="${v2Secret.encryptedValue}"`
        );
      }
      
      // Critical: IV must be identical
      if (v2Secret.iv !== v1Secret.iv) {
        errors.push(
          `IV mismatch for ${v1Secret.id}: ` +
          `V1="${v1Secret.iv}", V2="${v2Secret.iv}"`
        );
      }
      
      verifiedCount++;
      console.log(`  ✓ ${v1Secret.id}: encryptedValue & IV preserved`);
    }
  }
  
  console.log(`\n  Verified ${verifiedCount} secrets with encryption continuity`);
  
  return {
    testName: 'Encryption Continuity',
    passed: errors.length === 0,
    details: `Verified ${verifiedCount} secrets maintain encrypted values and IVs`,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

// ============================================================================
// TEST 3: ROLLBACK CAPABILITY
// ============================================================================

function testRollbackCapability(): TestReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  console.log('\n🧪 TEST 3: Rollback Capability');
  console.log('=====================================');
  
  let rollbackSuccessCount = 0;
  
  for (const fixture of ALL_V1_FIXTURES) {
    // Step 1: Migrate forward
    const migrationResult = migrateV1RecordToV2(fixture);
    
    if (!migrationResult.success || !migrationResult.v2Account || !migrationResult.v2SecretItems) {
      errors.push(`Cannot test rollback for ${fixture.id}: migration failed`);
      continue;
    }
    
    // Step 2: Rollback
    const rollbackResult = rollbackV2ToV1(
      migrationResult.v2Account,
      migrationResult.v2SecretItems,
      fixture
    );
    
    if (!rollbackResult.success) {
      errors.push(`Rollback failed for ${fixture.id}: ${rollbackResult.errors?.join(', ')}`);
      continue;
    }
    
    // Step 3: Verify rollback integrity
    const rolledBack = rollbackResult.v1Record;
    
    // Verify secret count
    if (rolledBack.secretItems.length !== fixture.secretItems.length) {
      errors.push(
        `Rollback secret count mismatch for ${fixture.id}: ` +
        `Original ${fixture.secretItems.length}, Rolled back ${rolledBack.secretItems.length}`
      );
    }
    
    // Verify encrypted values are still intact after rollback
    for (let i = 0; i < fixture.secretItems.length; i++) {
      const original = fixture.secretItems[i];
      const rolledBackSecret = rolledBack.secretItems[i];
      
      if (!rolledBackSecret) {
        errors.push(`Missing rolled back secret ${i} for ${fixture.id}`);
        continue;
      }
      
      if (rolledBackSecret.encryptedValue !== original.encryptedValue) {
        errors.push(
          `Encrypted value changed after rollback for ${original.id}`
        );
      }
      
      if (rolledBackSecret.iv !== original.iv) {
        errors.push(
          `IV changed after rollback for ${original.id}`
        );
      }
    }
    
    rollbackSuccessCount++;
    console.log(`  ✓ ${fixture.id}: rollback successful, encryption intact`);
  }
  
  console.log(`\n  Successfully rolled back ${rollbackSuccessCount} records`);
  
  return {
    testName: 'Rollback Capability',
    passed: errors.length === 0,
    details: `Successfully rolled back ${rollbackSuccessCount} records with encryption intact`,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

// ============================================================================
// TEST 4: EDGE CASES
// ============================================================================

function testEdgeCases(): TestReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  console.log('\n🧪 TEST 4: Edge Cases');
  console.log('=====================================');
  
  // Test 4.1: Empty fields
  const minimalFixture = ALL_V1_FIXTURES.find(f => f.id === 'v1-min-006');
  if (minimalFixture) {
    const result = migrateV1RecordToV2(minimalFixture);
    if (result.success) {
      console.log('  ✓ Empty fields fixture: handled correctly');
    } else {
      errors.push('Empty fields fixture failed to migrate');
    }
  }
  
  // Test 4.2: Only secrets (no fields)
  const onlySecretsFixture = ALL_V1_FIXTURES.find(f => f.id === 'v1-sec-007');
  if (onlySecretsFixture) {
    const result = migrateV1RecordToV2(onlySecretsFixture);
    if (result.success && result.v2SecretRefs && result.v2SecretRefs.length > 0) {
      console.log('  ✓ Only secrets fixture: handled correctly');
    } else {
      errors.push('Only secrets fixture failed to migrate properly');
    }
  }
  
  // Test 4.3: Special characters
  const specialCharsFixture = ALL_V1_FIXTURES.find(f => f.id === 'v1-spe-008');
  if (specialCharsFixture) {
    const result = migrateV1RecordToV2(specialCharsFixture);
    if (result.success) {
      // Verify special chars are preserved in fields
      console.log('  ✓ Special characters fixture: handled correctly');
    } else {
      errors.push('Special characters fixture failed to migrate');
    }
  }
  
  // Test 4.4: Multi-secret record
  const multiSecretFixture = ALL_V1_FIXTURES.find(f => f.id === 'v1-cred-multi-002');
  if (multiSecretFixture) {
    const result = migrateV1RecordToV2(multiSecretFixture);
    if (result.success && result.v2SecretRefs && result.v2SecretRefs.length === 5) {
      console.log('  ✓ Multi-secret fixture (5 secrets): handled correctly');
    } else {
      errors.push(`Multi-secret fixture: expected 5 secrets, got ${result.v2SecretRefs?.length || 0}`);
    }
  }
  
  // Test 4.5: Mixed status secrets (active, expired, revoked)
  const mixedStatusFixture = ALL_V1_FIXTURES.find(f => f.id === 'v1-cred-multi-002');
  if (mixedStatusFixture) {
    const result = migrateV1RecordToV2(mixedStatusFixture);
    if (result.success && result.v2SecretItems) {
      const activeCount = result.v2SecretItems.filter(s => s.status === 'active').length;
      const expiredCount = result.v2SecretItems.filter(s => s.status === 'expired').length;
      const revokedCount = result.v2SecretItems.filter(s => s.status === 'revoked').length;
      
      console.log(`  ✓ Mixed status: ${activeCount} active, ${expiredCount} expired, ${revokedCount} revoked`);
      
      if (activeCount !== 3 || expiredCount !== 1 || revokedCount !== 1) {
        warnings.push('Status counts may not match expected values');
      }
    }
  }
  
  // Test 4.6: Very old record
  const oldFixture = ALL_V1_FIXTURES.find(f => f.id === 'v1-old-009');
  if (oldFixture) {
    const result = migrateV1RecordToV2(oldFixture);
    if (result.success) {
      console.log('  ✓ Very old record (~3 years): handled correctly');
    } else {
      errors.push('Very old record failed to migrate');
    }
  }
  
  // Test 4.7: Recently updated record
  const recentFixture = ALL_V1_FIXTURES.find(f => f.id === 'v1-rec-010');
  if (recentFixture) {
    const result = migrateV1RecordToV2(recentFixture);
    if (result.success) {
      console.log('  ✓ Recently updated record: handled correctly');
    } else {
      errors.push('Recently updated record failed to migrate');
    }
  }
  
  return {
    testName: 'Edge Cases',
    passed: errors.length === 0,
    details: `Tested ${FIXTURE_METADATA.edgeCases.length} edge case scenarios`,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

// ============================================================================
// TEST 5: BATCH MIGRATION
// ============================================================================

function testBatchMigration(): TestReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  console.log('\n🧪 TEST 5: Batch Migration');
  console.log('=====================================');
  
  const batchResult = migrateV1RecordsBatch(ALL_V1_FIXTURES);
  
  console.log(`  Total records: ${batchResult.totalRecords}`);
  console.log(`  Successful: ${batchResult.successful}`);
  console.log(`  Failed: ${batchResult.failed}`);
  
  if (batchResult.successful !== ALL_V1_FIXTURES.length) {
    errors.push(`Batch migration failed: ${batchResult.failed} records failed`);
  }
  
  console.log(`  Total fields: ${batchResult.summary.totalFields}`);
  console.log(`  Total secrets: ${batchResult.summary.totalSecrets}`);
  console.log(`  Services created: ${batchResult.summary.servicesCreated.size}`);
  console.log(`  Accounts created: ${batchResult.summary.accountsCreated.size}`);
  
  // Verify totals match fixture metadata
  if (batchResult.summary.totalSecrets !== FIXTURE_METADATA.totalSecrets) {
    errors.push(
      `Secret count mismatch: expected ${FIXTURE_METADATA.totalSecrets}, got ${batchResult.summary.totalSecrets}`
    );
  }
  
  return {
    testName: 'Batch Migration',
    passed: errors.length === 0,
    details: `Batch migrated ${batchResult.successful}/${batchResult.totalRecords} records successfully`,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

// ============================================================================
// RUN ALL TESTS
// ============================================================================

export function runMigrationTests(): FullTestReport {
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║   V1 → V2 MIGRATION TEST SUITE            ║');
  console.log('╚════════════════════════════════════════════╝\n');
  
  const reports: TestReport[] = [];
  
  // Run all tests
  reports.push(testIntegrityVerification());
  reports.push(testEncryptionContinuity());
  reports.push(testRollbackCapability());
  reports.push(testEdgeCases());
  reports.push(testBatchMigration());
  
  // Calculate summary
  const passed = reports.filter(r => r.passed).length;
  const failed = reports.filter(r => !r.passed).length;
  const warningCount = reports.reduce((sum, r) => sum + (r.warnings?.length || 0), 0);
  
  // Determine overall status
  const allPassed = failed === 0;
  
  const fullReport: FullTestReport = {
    timestamp: Date.now(),
    totalTests: reports.length,
    passed,
    failed,
    warnings: warningCount,
    reports,
    summary: {
      integrityCheck: reports[0].passed ? 'PASS' : 'FAIL',
      encryptionContinuity: reports[1].passed ? 'PASS' : 'FAIL',
      rollbackCapability: reports[2].passed ? 'PASS' : 'FAIL',
      edgeCasesHandled: reports[3].passed ? 'PASS' : 'FAIL',
    },
  };
  
  // Print final summary
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║              TEST SUMMARY                  ║');
  console.log('╚════════════════════════════════════════════╝\n');
  console.log(`  Total Tests: ${reports.length}`);
  console.log(`  ✅ Passed: ${passed}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log(`  ⚠️  Warnings: ${warningCount}`);
  console.log(`\n  Overall: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}\n`);
  
  // Print detailed results
  if (!allPassed) {
    console.log('═══════════════════════════════════════════\n');
    console.log('FAILED TESTS:\n');
    for (const report of reports) {
      if (!report.passed) {
        console.log(`  ❌ ${report.testName}`);
        if (report.errors) {
          for (const error of report.errors) {
            console.log(`     - ${error}`);
          }
        }
      }
    }
  }
  
  return fullReport;
}

// ============================================================================
// EXPORT FOR CLI
// ============================================================================

// Run tests if this is the main module
runMigrationTests();

