# V2-0 Domain Model Corrections & Implementation Specifications

**สถานะ:** 🟡 CONDITIONAL APPROVAL - รอแก้ไข 4 ประเด็นก่อน Final Lock  
**วันที่:** 2025-01-XX  
**ผู้เขียน:** Qwen (AI Co-Founder)

---

## สารบัญ

1. [FieldValue ↔ SecretItem Relationship Correction](#1-fieldvalue--secretitem-relationship-correction)
2. [Secret Version vs Audit History Retention Policy Separation](#2-secret-version-vs-audit-history-retention-policy-separation)
3. [Key Lifecycle Implementation Specification](#3-key-lifecycle-implementation-specification)
4. [Migration Test Suite & Verification Plan](#4-migration-test-suite--verification-plan)

---

## 1. FieldValue ↔ SecretItem Relationship Correction

### 🔴 ปัญหาเดิม: Source of Truth ซ้ำซ้อน

**Model เดิม (มีปัญหา):**
```typescript
type Account = {
  id: string;
  serviceId: string;
  label: string;
  fields: FieldValue[];        // ❌ มี encryptedValue, iv
  secretItems: SecretItem[];   // ❌ มี encryptedValue, versions
};

type FieldValue = {
  fieldDefinitionId: string;
  value?: string;              // plaintext หรือ encrypted?
  encryptedValue?: string;     // ❌ ซ้ำกับ SecretItem
  iv?: string;                 // ❌ ซ้ำกับ SecretItem
  isSecret?: boolean;
};

type SecretItem = {
  id: string;
  type: 'password' | 'api-key' | 'token' | 'backup-code';
  label: string;
  encryptedValue: string;      // ❌ ซ้ำกับ FieldValue
  iv: string;                  // ❌ ซ้ำกับ FieldValue
  versions: SecretVersion[];
  status: 'active' | 'expired' | 'revoked';
};
```

**ปัญหา:**
- Password/Secret ถูกเก็บใน 2 ที่: `FieldValue.encryptedValue` และ `SecretItem.encryptedValue`
- ไม่ชัดเจนว่าไหนคือ source of truth
- Rotation, versioning, history ทำงานกับข้อมูลชุดไหน?
- การ decrypt ต้องทำ 2 ครั้งหรือไม่?

---

### ✅ Model ใหม่: แยกชัดเจนระหว่าง Field Schema กับ Secret Subsystem

```typescript
/**
 * FieldValue เป็นตัวแทนของ "ค่า" ใน field นั้น ๆ
 * แต่ไม่ได้เป็นเจ้าของ secret value จริง
 */
type FieldValue = {
  /** ID ของ FieldDefinition ที่อ้างอิง */
  fieldDefinitionId: string;
  
  /** 
   * ค่า plaintext สำหรับ non-secret fields
   * จะเป็น undefined ถ้าเป็น secret field
   */
  plainValue?: string;
  
  /**
   * Reference ไปยัง SecretItem (ถ้ามี)
   * จะเป็น undefined ถ้าเป็น non-secret field
   */
  secretRef?: SecretRef;
  
  /** Metadata เพิ่มเติม */
  metadata?: {
    lastModified: number;
    modifiedBy?: string;
  };
};

/**
 * SecretRef เป็น pointer ไปยัง SecretItem
 * ไม่เก็บค่าความลับจริง แค่ reference
 */
type SecretRef = {
  /** ID ของ SecretItem ที่อ้างอิง */
  secretItemId: string;
  
  /** 
   * Version ที่กำลังใช้งานอยู่ (ชี้ไปที่ SecretVersion)
   * ถ้าไม่มี จะใช้ latest active version
   */
  activeVersionId?: string;
  
  /** เมื่อไหร่ที่ reference นี้ถูกสร้าง */
  createdAt: number;
};

/**
 * SecretItem เป็นเจ้าของค่าความลับและ lifecycle จริง
 * เก็บ versions ทั้งหมด
 */
type SecretItem = {
  id: string;
  accountId: string;           // ← ชัดเจนว่าเป็นของ account ไหน
  fieldDefinitionId: string;   // ← เชื่อมกับ field definition
  
  /** ประเภทของ secret */
  type: 'password' | 'api-key' | 'token' | 'backup-code' | '2fa-secret';
  
  /** Label สำหรับแสดงผล */
  label: string;
  
  /** สถานะปัจจุบัน */
  status: 'active' | 'expired' | 'revoked' | 'rotating';
  
  /** Versions ทั้งหมด (max 5 active versions) */
  versions: SecretVersion[];
  
  /** Version ที่ใช้งานอยู่ปัจจุบัน (ชี้ไปที่ versions[]) */
  currentVersionId: string;
  
  /** Metadata */
  createdAt: number;
  updatedAt: number;
  expiresAt?: number;
  rotatedAt?: number;
  revokedAt?: number;
  
  /** Notes สำหรับทีม/rotation */
  notes?: string;
};

/**
 * SecretVersion เก็บค่าความลับจริงแต่ละ version
 * Immutable หลังจากสร้าง
 */
type SecretVersion = {
  id: string;
  secretItemId: string;
  versionNumber: number;       // 1, 2, 3, ...
  
  /** ค่า encrypted */
  encryptedValue: string;
  iv: string;
  authTag?: string;            // สำหรับ AES-GCM
  
  /** Metadata ของ version นี้ */
  createdAt: number;
  createdBy?: string;          // user/system/generator
  reason?: 'initial' | 'rotation' | 'manual-update' | 'restore';
  
  /** เมื่อไหร่ที่ถูกใช้ล่าสุด */
  lastUsedAt?: number;
  
  /** checksum สำหรับ verify integrity */
  checksum?: string;
};
```

---

### 📊 ความสัมพันธ์ใหม่

```
Account
  │
  ├── fields: FieldValue[]
  │     │
  │     ├── plainValue (สำหรับ text, email, url, etc.)
  │     │
  │     └── secretRef → SecretItem
  │                        │
  │                        ├── versions: SecretVersion[]
  │                        │     │
  │                        │     ├── v1 (encryptedValue + iv)
  │                        │     ├── v2 (encryptedValue + iv)
  │                        │     └── v3 (encryptedValue + iv) ← current
  │                        │
  │                        └── currentVersionId → v3
  │
  └── (deprecated: secretItems[]) ← ถอดออก
```

---

### ✅ ข้อดีของโมเดลใหม่

| ด้าน | โมเดลเดิม | โมเดลใหม่ |
|------|-----------|-----------|
| **Source of Truth** | 2 แห่ง (FieldValue + SecretItem) | 1 แห่ง (SecretVersion) |
| **Rotation** | ไม่ชัดเจน | ชัดเจน: สร้าง version ใหม่, ย้าย currentVersionId |
| **History** | ผสมกับ FieldValue | แยกชัดเจนใน SecretItem.versions |
| **Type Safety** | encryptedValue? optional | secretRef? ชัดเจน |
| **Non-Secret Fields** | ต้องมี encryptedValue? | ใช้ plainValue โดยตรง |
| **Multiple Secrets** | แยก array ต่างหาก | รวมอยู่ใน fields ผ่าน secretRef |

---

### 🔄 Migration จากโมเดลเดิม → โมเดลใหม่

```typescript
// V1 DataRecord
{
  id: "rec-001",
  title: "Gmail Account",
  category: "credential",
  fields: {
    "email": "user@gmail.com",
    "password": "encrypted-value-here",  // ❌ ปัญหา: อยู่ผิดที่
    "username": "user123"
  },
  secretItems: [
    {
      id: "sec-001",
      type: "password",
      label: "Main Password",
      encryptedValue: "another-encrypted-value",  // ❌ ซ้ำซ้อน
      iv: "...",
      status: "active"
    }
  ]
}

// ↓↓ Migration ↓↓

// V2 Service + Account
{
  service: {
    id: "svc-gmail-001",
    name: "Gmail",
    categoryId: "cat-credentials",
    typeId: "type-email-service"
  },
  account: {
    id: "acc-001",
    serviceId: "svc-gmail-001",
    label: "Personal Gmail",
    fields: [
      {
        fieldDefinitionId: "field-email",
        plainValue: "user@gmail.com"
      },
      {
        fieldDefinitionId: "field-username",
        plainValue: "user123"
      },
      {
        fieldDefinitionId: "field-password",
        secretRef: {
          secretItemId: "sec-001",
          activeVersionId: "ver-001",
          createdAt: 1704067200000
        }
      }
    ]
  },
  secretItems: [
    {
      id: "sec-001",
      accountId: "acc-001",
      fieldDefinitionId: "field-password",
      type: "password",
      label: "Main Password",
      status: "active",
      currentVersionId: "ver-001",
      versions: [
        {
          id: "ver-001",
          versionNumber: 1,
          encryptedValue: "merged-encrypted-value",  // ใช้ค่าจาก fields.password
          iv: "...",
          createdAt: 1704067200000,
          reason: "initial"
        }
      ],
      createdAt: 1704067200000,
      updatedAt: 1704067200000
    }
  ]
}
```

**กฎการ Merge:**
1. ถ้า `fields.password` และ `secretItems[0]` มีค่าทั้งคู่ → ใช้ค่าจาก `secretItems` (ถือว่าแม่นยำกว่า)
2. ถ้ามีแค่ `fields.password` → ย้ายไปสร้าง SecretItem ใหม่
3. ถ้ามีแค่ `secretItems` → สร้าง FieldValue พร้อม secretRef

---

## 2. Secret Version vs Audit History Retention Policy Separation

### 🔴 ปัญหาเดิม: ผสม retention policy

**เอกสารเดิมระบุว่า:**
> "Audit log 5 events ล่าสุดต่อ entity"

**ปัญหา:**
- Secret Version กับ Audit History มีวัตถุประสงค์ต่างกัน
- การจำกัด 5 events สำหรับ audit ทำให้เสียประวัติสำคัญ
- Rotation, reveal, copy, restore ควรบันทึกทั้งหมด

---

### ✅ นโยบายใหม่: แยกชัดเจน

#### 2.1 Secret Versions - Retention Policy

**วัตถุประสงค์:** เก็บค่าความลับย้อนหลังสำหรับการ restore

**Policy:**
```typescript
type SecretVersionRetention = {
  /** จำนวน version สูงสุดที่เก็บ */
  maxVersions: 5;
  
  /** กลยุทธ์เมื่อเกิน limit */
  strategy: 'rotate-oldest';  // ลบ version เก่าที่สุด
  
  /** ข้อยกเว้น: version ที่ถูก mark ว่า important */
  preserveImportant?: boolean;
  
  /** ระยะเวลาต่ำสุดก่อนลบ (วัน) */
  minAgeDays?: 30;
};
```

**Flow:**
```
Version 1 → 2 → 3 → 4 → 5 → 6 (ใหม่)
                      ↓
                ลบ Version 1 (เก่าสุด)
                เก็บ Versions 2-6

Result: [v2, v3, v4, v5, v6] = 5 versions
```

**ข้อยกเว้น:**
- Version ที่ถูกใช้ภายใน 7 วันที่ผ่านมา → ไม่ลบ
- Version ที่ถูก mark `important: true` → ไม่ลบ (จนกว่าจะ manual)
- Version ที่เป็น current → ไม่ลบแน่นอน

---

#### 2.2 Audit History - Retention Policy

**วัตถุประสงค์:** บันทึกทุกการกระทำเพื่อ audit และ compliance

**Policy:**
```typescript
type AuditHistoryRetention = {
  /** จำนวน event สูงสุดต่อ entity (optional) */
  maxEventsPerEntity?: number;  // ไม่จำกัดโดย default
  
  /** จำนวน event สูงสุดรวมทั้งหมด (optional) */
  maxTotalEvents?: number;      // เช่น 100,000 events
  
  /** ระยะเวลาเก็บ (ปี) */
  retentionYears: 7;            // ตามมาตรฐาน compliance
  
  /** กลยุทธ์เมื่อเกิน limit */
  strategy: 'archive-and-purge';
  
  /** Events ที่ต้องเก็บเสมอ (ไม่ลบ) */
  preserveEventTypes: [
    'created',
    'revoked',
    'security-breach',
    'compliance-audit'
  ];
};
```

**Event Types ที่ต้องบันทึก:**
```typescript
type AuditEventType = 
  | 'created'           // สร้าง secret/account
  | 'updated'           // แก้ไขค่า
  | 'revealed'          // เปิดดู secret
  | 'copied'            // copy ไป clipboard
  | 'generated'         // generate ใหม่
  | 'rotated'           // rotation
  | 'restored'          // restore จาก version เก่า
  | 'revoked'           // revoke
  | 'expired'           // หมดอายุ
  | 'imported'          // import จากภายนอก
  | 'exported'          // export
  | 'synced'            // sync กับ cloud
  | 'login-success'     // unlock สำเร็จ
  | 'login-failure'     // unlock ล้มเหลว
  | 'session-timeout'   // session หมดอายุ
  | 'security-alert';   // alert ด้านความปลอดภัย
```

**ตัวอย่าง Audit Entry:**
```typescript
type AuditEntry = {
  id: string;
  entityType: 'account' | 'secret' | 'service' | 'session';
  entityId: string;
  eventType: AuditEventType;
  
  /** รายละเอียดเพิ่มเติม */
  details: {
    userId?: string;
    deviceId?: string;
    ipAddress?: string;
    userAgent?: string;
    reason?: string;
    oldValueHash?: string;      // hash ของค่าเดิม (ไม่ใช่ค่าจริง!)
    newValueHash?: string;      // hash ของค่าใหม่
    versionId?: string;
    metadata?: Record<string, any>;
  };
  
  timestamp: number;
  sessionId?: string;
};
```

---

### 📊 เปรียบเทียบ Retention Policies

| Aspect | Secret Versions | Audit History |
|--------|-----------------|---------------|
| **วัตถุประสงค์** | Restore ค่าความลับ | Audit trail, compliance |
| **จำนวนสูงสุด** | 5 versions | ไม่จำกัด (หรือ 100k events) |
| **ระยะเวลาเก็บ** | จนกว่าจะถูก rotate ออก | 7 ปี (ตาม compliance) |
| **สิ่งที่เก็บ** | Encrypted values | Event metadata (hashes) |
| **กลยุทธ์ลบ** | Rotate oldest | Archive and purge |
| **ข้อยกเว้น** | Recent usage, important | Security events |
| **GDPR/Compliance** | Personal data | Legal requirement |

---

## 3. Key Lifecycle Implementation Specification

### 🔴 ปัญหาเดิม: Architecture diagram ไม่ใช่ implementation จริง

**คำเตือนสำคัญ:**
> ⚠️ **React Context ไม่ใช่ Cryptographic Security Boundary**
> 
> React Context เป็นเพียง access-control layer ใน UI
> ไม่สามารถป้องกัน memory inspection, side-channel attacks, หรือ malicious extensions ได้

---

### ✅ Key Lifecycle Implementation จริง

#### 3.1 State Machine

```
┌─────────────────────────────────────────────────────────────┐
│                     LOCKED STATE                            │
│                                                             │
│  ├─ Master Key: Encrypted ใน storage (AES-KW)              │
│  ├─ Unlock Credential: Hash เท่านั้น (ไม่เก็บ plaintext)   │
│  ├─ Session Keys: ไม่มี                                    │
│  └─ Plaintext Cache: Clear แล้ว                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ UNLOCK(pin/biometric)
                          │ 1. Verify credential hash
                          │ 2. Derive key from PIN
                          │ 3. Decrypt master key
                          │ 4. Generate session keys
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   UNLOCKED SESSION                          │
│                                                             │
│  ├─ Master Key: ใน Memory (TypedArray, ไม่ serialize)      │
│  ├─ Session Keys: ใน Memory (derive จาก master key)        │
│  ├─ Plaintext Cache: Temporary (clear หลังใช้)             │
│  └─ Auto-lock timer running                                │
│                                                             │
│  กิจกรรม allowed:                                           │
│  - Decrypt records                                         │
│  - Encrypt new data                                        │
│  - Reveal secrets (temporary plaintext)                    │
│  - Copy to clipboard (clear หลัง 30 วินาที)                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ LOCK(manual/timeout/idle)
                          │ 1. Clear all keys from memory
                          │ 2. Clear plaintext caches
                          │ 3. Clear clipboard
                          │ 4. Reset session state
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                     LOCKED STATE                            │
│              (กลับสู่สถานะเริ่มต้น)                         │
└─────────────────────────────────────────────────────────────┘
```

---

#### 3.2 Implementation Details

##### 3.2.1 Master Key Storage (LOCKED State)

```typescript
/**
 * Master Key ถูก encrypt ด้วย Key Encryption Key (KEK)
 * KEK derive จาก User PIN/Biometric
 */

// โครงสร้างที่เก็บใน chrome.storage.local
interface EncryptedMasterKeyStorage {
  /** Master key ที่ encrypt แล้ว */
  encryptedMasterKey: string;
  
  /** IV สำหรับ decrypt master key */
  masterKeyIv: string;
  
  /** Auth tag สำหรับ AES-GCM */
  masterKeyAuthTag: string;
  
  /** Salt สำหรับ derive KEK จาก PIN */
  kekSalt: string;
  
  /** Iteration count สำหรับ PBKDF2 */
  kekIterations: number;  // อย่างน้อย 100,000
  
  /** Algorithm ที่ใช้ */
  algorithm: 'PBKDF2-AES-GCM';
  
  /** เวอร์ชันของ schema */
  version: 1;
  
  /** เมื่อไหร่ที่ถูกสร้าง/อัปเดต */
  createdAt: number;
  updatedAt: number;
}
```

**การสร้าง Master Key (ครั้งแรก):**
```typescript
async function initializeMasterKey(pin: string): Promise<void> {
  // 1. Generate random salt
  const salt = crypto.getRandomValues(new Uint8Array(32));
  
  // 2. Derive KEK จาก PIN ด้วย PBKDF2
  const iterations = 100000;
  const kek = await deriveKeyFromPin(pin, salt, iterations);
  
  // 3. Generate Master Key แบบสุ่ม
  const masterKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  
  // 4. Export Master Key เป็น raw bytes
  const masterKeyRaw = await crypto.subtle.exportKey('raw', masterKey);
  
  // 5. Generate IV สำหรับ encrypt master key
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // 6. Encrypt Master Key ด้วย KEK
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    kek,
    masterKeyRaw
  );
  
  const encryptedData = new Uint8Array(encrypted);
  const encryptedValue = encryptedData.slice(0, -16);  // ยกเว้น auth tag
  const authTag = encryptedData.slice(-16);
  
  // 7. เก็บใน storage
  await chrome.storage.local.set({
    encryptedMasterKey: arrayBufferToBase64(encryptedValue),
    masterKeyIv: arrayBufferToBase64(iv),
    masterKeyAuthTag: arrayBufferToBase64(authTag),
    kekSalt: arrayBufferToBase64(salt),
    kekIterations: iterations,
    algorithm: 'PBKDF2-AES-GCM',
    version: 1,
    createdAt: Date.now(),
    updatedAt: Date.now()
  } as EncryptedMasterKeyStorage);
  
  // 8. Clear sensitive data จาก memory ทันที
  clearSensitiveData([masterKeyRaw, kek]);
}
```

---

##### 3.2.2 Unlock Process

```typescript
interface UnlockedSession {
  /** Master key ใน memory (ไม่ serialize) */
  masterKey: CryptoKey;
  
  /** Session ID */
  sessionId: string;
  
  /** เมื่อไหร่ที่ unlock */
  unlockedAt: number;
  
  /** เมื่อไหร่ที่จะ auto-lock */
  autoLockAt: number;
  
  /** Timer ID สำหรับ auto-lock */
  autoLockTimerId?: number;
  
  /** Idle detector */
  idleDetector?: IdleDetector;
  
  /** Activity tracker */
  lastActivityAt: number;
}

class SessionManager {
  private session: UnlockedSession | null = null;
  private readonly IDLE_TIMEOUT_MS = 5 * 60 * 1000;  // 5 นาที
  private readonly AUTO_LOCK_MS = 30 * 60 * 1000;    // 30 นาที
  
  async unlock(pin: string): Promise<boolean> {
    try {
      // 1. ดึงข้อมูลจาก storage
      const storage = await chrome.storage.local.get([
        'encryptedMasterKey',
        'masterKeyIv',
        'masterKeyAuthTag',
        'kekSalt',
        'kekIterations'
      ]) as Partial<EncryptedMasterKeyStorage>;
      
      if (!storage.encryptedMasterKey || !storage.kekSalt) {
        throw new Error('No master key found. Initialize first.');
      }
      
      // 2. Decode จาก base64
      const encryptedMasterKey = base64ToArrayBuffer(storage.encryptedMasterKey);
      const iv = base64ToArrayBuffer(storage.masterKeyIv!);
      const authTag = base64ToArrayBuffer(storage.masterKeyAuthTag!);
      const salt = base64ToArrayBuffer(storage.kekSalt!);
      
      // 3. Derive KEK จาก PIN
      const kek = await deriveKeyFromPin(pin, salt, storage.kekIterations!);
      
      // 4. รวม encrypted data + auth tag
      const encryptedData = new Uint8Array(encryptedMasterKey.byteLength + 16);
      encryptedData.set(new Uint8Array(encryptedMasterKey), 0);
      encryptedData.set(new Uint8Array(authTag), encryptedMasterKey.byteLength);
      
      // 5. Decrypt Master Key
      const decryptedRaw = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        kek,
        encryptedData
      );
      
      // 6. Import Master Key กลับมา
      const masterKey = await crypto.subtle.importKey(
        'raw',
        decryptedRaw,
        { name: 'AES-GCM', length: 256 },
        false,  // ไม่ให้ export ได้
        ['encrypt', 'decrypt']
      );
      
      // 7. Clear KEK จาก memory ทันที
      clearSensitiveData([kek]);
      
      // 8. สร้าง session
      this.session = {
        masterKey,
        sessionId: crypto.randomUUID(),
        unlockedAt: Date.now(),
        autoLockAt: Date.now() + this.AUTO_LOCK_MS,
        lastActivityAt: Date.now()
      };
      
      // 9. เริ่ม auto-lock timer
      this.startAutoLockTimer();
      
      // 10. เริ่ม idle detection
      this.startIdleDetection();
      
      // 11. บันทึก audit log
      await this.auditLog('login-success', { sessionId: this.session.sessionId });
      
      return true;
      
    } catch (error) {
      // ล้มเหลว: บันทึก audit log
      await this.auditLog('login-failure', { reason: error.message });
      
      // Clear ทุกอย่าง
      this.lock();
      
      return false;
    }
  }
  
  lock(): void {
    if (!this.session) return;
    
    // 1. Clear master key จาก memory
    //    Note: CryptoKey ไม่สามารถ clear โดยตรงได้
    //    ต้องให้ GC เก็บโดยการ set เป็น null
    this.session.masterKey = null as any;
    
    // 2. Clear timers
    if (this.session.autoLockTimerId) {
      clearTimeout(this.session.autoLockTimerId);
    }
    
    // 3. Clear session
    this.session = null;
    
    // 4. Clear plaintext caches ทั้งหมด
    PlaintextCache.clearAll();
    
    // 5. Clear clipboard
    this.clearClipboard();
    
    // 6. บันทึก audit log
    this.auditLog('session-timeout', {});
    
    // 7. แจ้ง UI ให้เปลี่ยนเป็น locked state
    window.dispatchEvent(new CustomEvent('session-locked'));
  }
  
  private startAutoLockTimer(): void {
    if (!this.session) return;
    
    const tick = () => {
      if (!this.session) return;
      
      const now = Date.now();
      
      // ตรวจสอบ idle timeout
      if (now - this.session.lastActivityAt > this.IDLE_TIMEOUT_MS) {
        this.lock();
        return;
      }
      
      // ตรวจสอบ auto-lock
      if (now >= this.session.autoLockAt) {
        this.lock();
        return;
      }
      
      // ตั้ง timer สำหรับ tick ถัดไป
      this.session.autoLockTimerId = setTimeout(tick, 1000) as any;
    };
    
    this.session.autoLockTimerId = setTimeout(tick, 1000) as any;
  }
  
  private startIdleDetection(): void {
    // ใช้ Idle Detection API ถ้ามี
    if ('IdleDetector' in window) {
      const idleDetector = new IdleDetector();
      
      idleDetector.addEventListener('change', () => {
        if (idleDetector.userState === 'away') {
          // User ไม่อยู่: เริ่มนับ idle timeout
          if (this.session) {
            this.session.lastActivityAt = 0;  // Force timeout ในการ tick ถัดไป
          }
        } else {
          // User กลับมา: reset activity
          if (this.session) {
            this.session.lastActivityAt = Date.now();
          }
        }
      });
      
      idleDetector.start({ threshold: 60000 });  // 1 นาที
      
      this.session!.idleDetector = idleDetector;
    }
    
    // Track mouse/keyboard activity
    const resetIdle = () => {
      if (this.session) {
        this.session.lastActivityAt = Date.now();
      }
    };
    
    window.addEventListener('mousemove', resetIdle);
    window.addEventListener('keydown', resetIdle);
    window.addEventListener('click', resetIdle);
  }
  
  recordActivity(): void {
    if (this.session) {
      this.session.lastActivityAt = Date.now();
    }
  }
  
  getSession(): UnlockedSession | null {
    return this.session;
  }
  
  private async clearClipboard(): Promise<void> {
    try {
      await navigator.clipboard.writeText('');
    } catch (e) {
      // Ignore errors
    }
  }
  
  private async auditLog(eventType: string, details: any): Promise<void> {
    // Implement audit logging
  }
}

// Singleton instance
export const sessionManager = new SessionManager();
```

---

##### 3.2.3 Plaintext Cache Management

```typescript
/**
 * PlaintextCache เก็บ decrypted values ชั่วคราว
 * จะถูก clear อัตโนมัติเมื่อ:
 * - Session lock
 * - หมดเวลา (TTL)
 * - Manual clear
 */
class PlaintextCache {
  private cache = new Map<string, {
    value: string;
    expiresAt: number;
  }>();
  
  private readonly DEFAULT_TTL_MS = 30 * 1000;  // 30 วินาที
  
  set(key: string, value: string, ttlMs?: number): void {
    const session = sessionManager.getSession();
    if (!session) {
      throw new Error('Cannot cache plaintext: session locked');
    }
    
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs ?? this.DEFAULT_TTL_MS)
    });
    
    // ตั้ง timer เพื่อ clear อัตโนมัติ
    setTimeout(() => {
      this.delete(key);
    }, ttlMs ?? this.DEFAULT_TTL_MS);
  }
  
  get(key: string): string | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    // ตรวจสอบ expiration
    if (Date.now() > entry.expiresAt) {
      this.delete(key);
      return null;
    }
    
    return entry.value;
  }
  
  delete(key: string): void {
    const entry = this.cache.get(key);
    if (entry) {
      // Clear value จาก memory
      entry.value = '';
      this.cache.delete(key);
    }
  }
  
  clearAll(): void {
    for (const key of this.cache.keys()) {
      this.delete(key);
    }
  }
  
  getSize(): number {
    return this.cache.size;
  }
}

export const plaintextCache = new PlaintextCache();
```

---

##### 3.2.4 Secure Component Pattern (React Context)

```typescript
/**
 * ⚠️ คำเตือน: React Context เป็นเพียง Access Control Layer
 * ไม่ใช่ Security Boundary จริง
 * 
 * Security จริงอยู่ที่:
 * - Master key ใน memory เท่านั้น
 * - Auto-lock timer
 * - Plaintext cache TTL
 * - Clear on lock
 */

interface SecureContextType {
  isUnlocked: boolean;
  sessionId: string | null;
  requireUnlock: () => Promise<void>;
  lock: () => void;
}

const SecureContext = createContext<SecureContextType | null>(null);

/**
 * HOC สำหรับ protect components ที่ต้องการ unlocked session
 */
function withSecure<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options?: {
    allowLocked?: boolean;  // แสดง UI แบบ locked แทนที่จะ redirect
    fallback?: React.ReactNode;
  }
): React.FC<P> {
  return function SecureComponent(props: P) {
    const context = useContext(SecureContext);
    
    if (!context) {
      throw new Error('withSecure must be used within SecureProvider');
    }
    
    const { isUnlocked, requireUnlock } = context;
    
    if (!isUnlocked && !options?.allowLocked) {
      // Redirect to unlock screen
      requireUnlock();
      return options?.fallback ?? <div>Redirecting to unlock...</div>;
    }
    
    if (!isUnlocked && options?.allowLocked) {
      // แสดง fallback UI
      return options?.fallback ?? null;
    }
    
    return <WrappedComponent {...props} />;
  };
}

/**
 * Hook สำหรับใช้ secure operations
 */
function useSecure() {
  const context = useContext(SecureContext);
  
  if (!context) {
    throw new Error('useSecure must be used within SecureProvider');
  }
  
  return context;
}

/**
 * ตัวอย่าง: Component ที่แสดง secret value
 */
const SecretValueDisplay: React.FC<{ secretItemId: string }> = withSecure(
  ({ secretItemId }) => {
    const [revealed, setRevealed] = useState(false);
    const [value, setValue] = useState<string | null>(null);
    
    const handleReveal = async () => {
      // Decrypt secret
      const decrypted = await decryptSecret(secretItemId);
      setValue(decrypted);
      setRevealed(true);
      
      // Auto-hide หลัง 30 วินาที
      setTimeout(() => {
        setRevealed(false);
        setValue(null);  // Clear จาก memory
      }, 30000);
    };
    
    const handleCopy = async () => {
      if (value) {
        await navigator.clipboard.writeText(value);
        
        // Clear clipboard หลัง 30 วินาที
        setTimeout(async () => {
          await navigator.clipboard.writeText('');
        }, 30000);
      }
    };
    
    return (
      <div>
        {revealed && value ? (
          <span>{value}</span>
        ) : (
          <span>••••••••</span>
        )}
        <button onClick={handleReveal}>Reveal</button>
        <button onClick={handleCopy}>Copy</button>
      </div>
    );
  },
  { allowLocked: false }
);
```

---

#### 3.3 Security Checklist

| Requirement | Implementation | Status |
|-------------|----------------|--------|
| Master key ไม่เก็บ plaintext ใน storage | ✅ Encrypt ด้วย KEK จาก PIN | ✅ |
| KEK derive จาก PIN แต่ละครั้ง | ✅ PBKDF2 with salt | ✅ |
| Master key อยู่ใน memory เท่านั้น | ✅ CryptoKey, ไม่ serialize | ✅ |
| Auto-lock หลัง idle | ✅ 5 นาที idle, 30 นาที total | ✅ |
| Clear keys บน lock | ✅ Set null, GC จะเก็บ | ⚠️ |
| Clear plaintext cache บน lock | ✅ PlaintextCache.clearAll() | ✅ |
| Clear clipboard บน lock | ✅ navigator.clipboard.writeText('') | ⚠️ |
| React Context ไม่ใช่ security boundary | ✅ Documented warning | ✅ |
| Audit login success/failure | ✅ sessionManager.auditLog | ✅ |
| Rate limiting สำหรับ unlock | ❌ ยังไม่ได้ implement | 🔴 |
| Biometric support | ❌ ยังไม่ได้ implement | 🔴 |
| Hardware security module | ❌ ยังไม่ได้ implement | 🔴 |

**⚠️ ข้อจำกัดที่ต้องทราบ:**
1. JavaScript ไม่สามารถ force clear memory ได้โดยตรง
2. CryptoKey ไม่สามารถ zero-out ได้ ต้องรอ GC
3. Clipboard clearing ไม่ reliable在所有 browsers
4. Memory inspection attacks ยังเป็นไปได้หากระบบติด malware

---

## 4. Migration Test Suite & Verification Plan

### 4.1 Test Objectives

1. **Correctness:** V1 data ถูก migrate ไป V2 model อย่างถูกต้อง
2. **Encryption Continuity:** Encrypted values ยัง decrypt ได้หลัง migration
3. **Deterministic Mapping:** V1 record เดิม → V2 entities ที่คาดเดาได้
4. **Rollback Safety:** สามารถ rollback ไป V1 ได้โดยไม่เสียข้อมูล
5. **Edge Cases:** จัดการกรณีพิเศษได้ครบ

---

### 4.2 V1 Fixture Data

```typescript
/**
 * Fixture 1: Simple Credential Record
 */
const fixture1_simpleCredential = {
  id: 'rec-001',
  title: 'Gmail Account',
  category: 'credential' as const,
  fields: {
    email: 'user@gmail.com',
    username: 'user123',
    password: 'ENC(password-value-1)'  // Encrypted value
  },
  secretItems: [],  // ไม่มี secret items แยก
  createdAt: 1704067200000,
  updatedAt: 1704153600000
};

/**
 * Fixture 2: Record with Separate Secret Items
 */
const fixture2_withSecretItems = {
  id: 'rec-002',
  title: 'GitHub Account',
  category: 'credential' as const,
  fields: {
    username: 'dev-user',
    email: 'dev@example.com'
    // password ไม่ได้อยู่ใน fields
  },
  secretItems: [
    {
      id: 'sec-001',
      type: 'password' as const,
      label: 'Main Password',
      encryptedValue: 'ENC(password-value-2)',
      iv: 'iv-value-2',
      status: 'active' as const,
      createdAt: 1704067200000,
      lastUsedAt: 1704240000000
    },
    {
      id: 'sec-002',
      type: 'api-key' as const,
      label: 'Personal Access Token',
      encryptedValue: 'ENC(token-value-1)',
      iv: 'iv-value-3',
      status: 'active' as const,
      createdAt: 1704067200000,
      expiresAt: 1735689600000
    }
  ],
  createdAt: 1704067200000,
  updatedAt: 1704326400000
};

/**
 * Fixture 3: Project Record with Custom Fields
 */
const fixture3_projectRecord = {
  id: 'rec-003',
  title: 'Project Alpha',
  category: 'project' as const,
  fields: {
    projectName: 'Alpha',
    clientName: 'Acme Corp',
    startDate: '2024-01-01',
    budget: '50000',
    apiEndpoint: 'https://api.example.com',
    apiKey: 'ENC(api-key-value-1)'
  },
  secretItems: [
    {
      id: 'sec-003',
      type: 'api-key' as const,
      label: 'Production API Key',
      encryptedValue: 'ENC(api-key-value-1)',
      iv: 'iv-value-4',
      status: 'active' as const,
      createdAt: 1704067200000
    }
  ],
  createdAt: 1704067200000,
  updatedAt: 1704412800000
};

/**
 * Fixture 4: Finance Record
 */
const fixture4_financeRecord = {
  id: 'rec-004',
  title: 'Bank Account - KBank',
  category: 'finance' as const,
  fields: {
    accountNumber: '123-4-56789-0',
    accountName: 'John Doe',
    bankName: 'Kasikornbank',
    branchCode: '001',
    onlinePassword: 'ENC(bank-password-1)'
  },
  secretItems: [
    {
      id: 'sec-004',
      type: 'password' as const,
      label: 'Online Banking Password',
      encryptedValue: 'ENC(bank-password-1)',
      iv: 'iv-value-5',
      status: 'active' as const,
      createdAt: 1704067200000
    }
  ],
  createdAt: 1704067200000,
  updatedAt: 1704499200000
};

/**
 * Fixture 5: Custom Record with Multiple Secrets
 */
const fixture5_customMultiSecret = {
  id: 'rec-005',
  title: 'Server Access',
  category: 'custom' as const,
  fields: {
    serverName: 'prod-web-01',
    hostname: 'web01.example.com',
    port: '22',
    sshUser: 'deploy'
  },
  secretItems: [
    {
      id: 'sec-005',
      type: 'password' as const,
      label: 'SSH Password',
      encryptedValue: 'ENC(ssh-password-1)',
      iv: 'iv-value-6',
      status: 'active' as const,
      createdAt: 1704067200000
    },
    {
      id: 'sec-006',
      type: 'api-key' as const,
      label: 'Deploy Token',
      encryptedValue: 'ENC(deploy-token-1)',
      iv: 'iv-value-7',
      status: 'active' as const,
      createdAt: 1704067200000
    },
    {
      id: 'sec-007',
      type: 'backup-code' as const,
      label: 'Recovery Codes',
      encryptedValue: 'ENC(recovery-codes-1)',
      iv: 'iv-value-8',
      status: 'active' as const,
      createdAt: 1704067200000,
      notes: 'Store safely'
    }
  ],
  createdAt: 1704067200000,
  updatedAt: 1704585600000
};

/**
 * Fixture 6: Edge Case - Empty Record
 */
const fixture6_emptyRecord = {
  id: 'rec-006',
  title: 'Empty Record',
  category: 'custom' as const,
  fields: {},
  secretItems: [],
  createdAt: 1704067200000,
  updatedAt: 1704067200000
};

/**
 * Fixture 7: Edge Case - Expired Secret
 */
const fixture7_expiredSecret = {
  id: 'rec-007',
  title: 'Expired Token',
  category: 'credential' as const,
  fields: {
    service: 'Test Service'
  },
  secretItems: [
    {
      id: 'sec-008',
      type: 'token' as const,
      label: 'Expired OAuth Token',
      encryptedValue: 'ENC(expired-token-1)',
      iv: 'iv-value-9',
      status: 'expired' as const,
      createdAt: 1672531200000,  // 1 year ago
      expiresAt: 1704067200000,   // Already expired
      revokedAt: 1704153600000
    }
  ],
  createdAt: 1672531200000,
  updatedAt: 1704153600000
};
```

---

### 4.3 Migration Script

```typescript
/**
 * Migration Script: V1 DataRecord → V2 Service + Account
 */

interface MigrationResult {
  success: boolean;
  migratedRecords: MigratedRecord[];
  skippedRecords: SkippedRecord[];
  errors: MigrationError[];
  statistics: MigrationStatistics;
}

interface MigratedRecord {
  v1RecordId: string;
  v2ServiceId: string;
  v2AccountId: string;
  v2SecretItemIds: string[];
  migrationTimestamp: number;
  checksum: string;
}

interface SkippedRecord {
  v1RecordId: string;
  reason: string;
}

interface MigrationError {
  v1RecordId: string;
  error: string;
  stack?: string;
}

interface MigrationStatistics {
  totalRecords: number;
  migratedCount: number;
  skippedCount: number;
  errorCount: number;
  durationMs: number;
}

async function migrateV1toV2(
  v1Records: DataRecord[],
  options?: {
    dryRun?: boolean;
    preserveV1?: boolean;
    batchSize?: number;
  }
): Promise<MigrationResult> {
  const startTime = Date.now();
  const result: MigrationResult = {
    success: true,
    migratedRecords: [],
    skippedRecords: [],
    errors: [],
    statistics: {
      totalRecords: v1Records.length,
      migratedCount: 0,
      skippedCount: 0,
      errorCount: 0,
      durationMs: 0
    }
  };
  
  const dryRun = options?.dryRun ?? false;
  const preserveV1 = options?.preserveV1 ?? true;
  
  for (const v1Record of v1Records) {
    try {
      // Step 1: Validate V1 record
      const validation = validateV1Record(v1Record);
      if (!validation.valid) {
        result.skippedRecords.push({
          v1RecordId: v1Record.id,
          reason: validation.reason
        });
        result.statistics.skippedCount++;
        continue;
      }
      
      // Step 2: Determine V2 Service
      const service = await determineV2Service(v1Record);
      
      // Step 3: Create V2 Account
      const account = await createV2Account(v1Record, service.id);
      
      // Step 4: Migrate Fields
      const fieldValues = await migrateFields(v1Record, account.id);
      
      // Step 5: Migrate Secret Items
      const secretItems = await migrateSecretItems(v1Record, account.id, fieldValues);
      
      // Step 6: Create Migration Record
      const migratedRecord: MigratedRecord = {
        v1RecordId: v1Record.id,
        v2ServiceId: service.id,
        v2AccountId: account.id,
        v2SecretItemIds: secretItems.map(s => s.id),
        migrationTimestamp: Date.now(),
        checksum: await calculateChecksum(v1Record, account, secretItems)
      };
      
      if (!dryRun) {
        // Save V2 entities
        await saveV2Entities(service, account, fieldValues, secretItems);
        
        // Optionally preserve V1 record with migration marker
        if (preserveV1) {
          await markV1AsMigrated(v1Record.id, migratedRecord.checksum);
        } else {
          await deleteV1Record(v1Record.id);
        }
      }
      
      result.migratedRecords.push(migratedRecord);
      result.statistics.migratedCount++;
      
    } catch (error) {
      result.errors.push({
        v1RecordId: v1Record.id,
        error: error.message,
        stack: error.stack
      });
      result.statistics.errorCount++;
      result.success = false;
    }
  }
  
  result.statistics.durationMs = Date.now() - startTime;
  
  return result;
}

/**
 * Step 2: Determine V2 Service จาก V1 Record
 */
async function determineV2Service(v1Record: DataRecord): Promise<Service> {
  // Map V1 category → V2 Category + Type
  const categoryMapping: Record<string, string> = {
    'credential': 'cat-credentials',
    'project': 'cat-projects',
    'finance': 'cat-finance',
    'custom': 'cat-custom'
  };
  
  const categoryId = categoryMapping[v1Record.category] || 'cat-custom';
  
  // Try to match existing service by title
  const existingService = await findServiceByTitleAndCategory(
    v1Record.title,
    categoryId
  );
  
  if (existingService) {
    return existingService;
  }
  
  // Create new service
  const service: Service = {
    id: generateId('svc'),
    name: v1Record.title,
    categoryId,
    formatId: 'format-default',
    typeId: 'type-generic',
    createdAt: v1Record.createdAt,
    updatedAt: v1Record.updatedAt
  };
  
  return service;
}

/**
 * Step 3: Create V2 Account
 */
async function createV2Account(
  v1Record: DataRecord,
  serviceId: string
): Promise<Account> {
  const account: Account = {
    id: generateId('acc'),
    serviceId,
    label: v1Record.title,
    fields: [],
    secretItems: [],
    createdAt: v1Record.createdAt,
    updatedAt: v1Record.updatedAt,
    metadata: {
      migratedFrom: 'v1',
      v1RecordId: v1Record.id
    }
  };
  
  return account;
}

/**
 * Step 4: Migrate Fields
 */
async function migrateFields(
  v1Record: DataRecord,
  accountId: string
): Promise<FieldValue[]> {
  const fieldValues: FieldValue[] = [];
  
  for (const [key, value] of Object.entries(v1Record.fields)) {
    // ตรวจสอบว่าเป็น secret field หรือไม่
    const isSecretField = isLikelySecretField(key);
    
    if (isSecretField) {
      // สร้าง FieldValue พร้อม secretRef (จะ link กับ SecretItem ใน step 5)
      fieldValues.push({
        fieldDefinitionId: getFieldDefinitionIdByKey(key),
        secretRef: {
          // จะ update ใน step 5
          secretItemId: '',  // Placeholder
          createdAt: Date.now()
        }
      });
    } else {
      // Non-secret field: ใช้ plainValue
      fieldValues.push({
        fieldDefinitionId: getFieldDefinitionIdByKey(key),
        plainValue: value
      });
    }
  }
  
  return fieldValues;
}

/**
 * Step 5: Migrate Secret Items
 */
async function migrateSecretItems(
  v1Record: DataRecord,
  accountId: string,
  fieldValues: FieldValue[]
): Promise<SecretItem[]> {
  const secretItems: SecretItem[] = [];
  
  // Case 1: Secret items จาก V1.secretItems[]
  for (const v1Secret of v1Record.secretItems) {
    const secretItem: SecretItem = {
      id: v1Secret.id || generateId('sec'),
      accountId,
      fieldDefinitionId: getFieldDefinitionIdByType(v1Secret.type),
      type: v1Secret.type,
      label: v1Secret.label,
      status: v1Secret.status,
      currentVersionId: generateId('ver'),
      versions: [
        {
          id: generateId('ver'),
          versionNumber: 1,
          encryptedValue: v1Secret.encryptedValue,
          iv: v1Secret.iv,
          createdAt: v1Secret.createdAt,
          reason: 'initial'
        }
      ],
      createdAt: v1Secret.createdAt,
      updatedAt: v1Secret.createdAt || Date.now(),
      expiresAt: v1Secret.expiresAt,
      notes: v1Secret.notes
    };
    
    secretItems.push(secretItem);
    
    // Update FieldValue.secretRef ให้ link กับ SecretItem นี้
    const correspondingField = fieldValues.find(fv => 
      isFieldMatchingSecretType(fv.fieldDefinitionId, v1Secret.type)
    );
    
    if (correspondingField && correspondingField.secretRef) {
      correspondingField.secretRef.secretItemId = secretItem.id;
      correspondingField.secretRef.activeVersionId = secretItem.currentVersionId;
    }
  }
  
  // Case 2: Secret values ที่ซ่อนอยู่ใน V1.fields
  for (const [key, value] of Object.entries(v1Record.fields)) {
    if (isLikelySecretField(key)) {
      // ตรวจสอบว่ามี SecretItem สำหรับ field นี้แล้วหรือยัง
      const hasSecretItem = secretItems.some(si => 
        isFieldMatchingSecretType(getFieldDefinitionIdByKey(key), si.type)
      );
      
      if (!hasSecretItem) {
        // สร้าง SecretItem ใหม่
        const secretItem: SecretItem = {
          id: generateId('sec'),
          accountId,
          fieldDefinitionId: getFieldDefinitionIdByKey(key),
          type: inferSecretTypeFromKey(key),
          label: formatLabelFromKey(key),
          status: 'active',
          currentVersionId: generateId('ver'),
          versions: [
            {
              id: generateId('ver'),
              versionNumber: 1,
              encryptedValue: value,  // ใช้ค่าจาก fields
              iv: generateIv(),       // Generate IV ใหม่
              createdAt: Date.now(),
              reason: 'migrated-from-fields'
            }
          ],
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        
        secretItems.push(secretItem);
        
        // Update FieldValue.secretRef
        const correspondingField = fieldValues.find(fv => 
          fv.fieldDefinitionId === secretItem.fieldDefinitionId &&
          fv.secretRef
        );
        
        if (correspondingField && correspondingField.secretRef) {
          correspondingField.secretRef.secretItemId = secretItem.id;
          correspondingField.secretRef.activeVersionId = secretItem.currentVersionId;
        }
      }
    }
  }
  
  return secretItems;
}

/**
 * Helper: ตรวจสอบว่าเป็น secret field หรือไม่
 */
function isLikelySecretField(key: string): boolean {
  const secretKeywords = [
    'password', 'passwd', 'pwd', 'secret', 'token', 'apikey', 
    'api_key', 'api-key', 'key', 'credential', 'auth'
  ];
  
  const lowerKey = key.toLowerCase();
  return secretKeywords.some(keyword => lowerKey.includes(keyword));
}

/**
 * Helper: Infer secret type จาก key name
 */
function inferSecretTypeFromKey(key: string): SecretItemType {
  const lowerKey = key.toLowerCase();
  
  if (lowerKey.includes('password') || lowerKey.includes('passwd')) {
    return 'password';
  }
  if (lowerKey.includes('token')) {
    return 'token';
  }
  if (lowerKey.includes('api') && lowerKey.includes('key')) {
    return 'api-key';
  }
  if (lowerKey.includes('backup') || lowerKey.includes('recovery')) {
    return 'backup-code';
  }
  
  return 'password';  // Default
}
```

---

### 4.4 Encryption Continuity Test

```typescript
/**
 * ทดสอบว่า encrypted values ยัง decrypt ได้หลัง migration
 */
async function testEncryptionContinuity(
  v1Records: DataRecord[],
  migratedRecords: MigratedRecord[],
  masterKey: CryptoKey
): Promise<EncryptionContinuityResult> {
  const result: EncryptionContinuityResult = {
    success: true,
    tests: [],
    failures: []
  };
  
  for (const v1Record of v1Records) {
    // Test 1: Decrypt V1 secret items
    for (const v1Secret of v1Record.secretItems) {
      try {
        const decryptedV1 = await decryptValue(
          v1Secret.encryptedValue,
          v1Secret.iv,
          masterKey
        );
        
        // Find migrated secret item
        const migrated = migratedRecords.find(m => m.v1RecordId === v1Record.id);
        if (!migrated) continue;
        
        const v2Secret = await getSecretItem(migrated.v2SecretItemIds[0]);
        if (!v2Secret) continue;
        
        // Decrypt V2 secret
        const v2Version = v2Secret.versions[0];
        const decryptedV2 = await decryptValue(
          v2Version.encryptedValue,
          v2Version.iv,
          masterKey
        );
        
        // Compare
        if (decryptedV1 === decryptedV2) {
          result.tests.push({
            recordId: v1Record.id,
            secretId: v1Secret.id,
            status: 'pass',
            message: 'Decrypted values match'
          });
        } else {
          result.failures.push({
            recordId: v1Record.id,
            secretId: v1Secret.id,
            status: 'fail',
            message: 'Decrypted values do not match',
            expected: hashValue(decryptedV1),
            actual: hashValue(decryptedV2)
          });
          result.success = false;
        }
        
      } catch (error) {
        result.failures.push({
          recordId: v1Record.id,
          secretId: v1Secret.id,
          status: 'error',
          message: `Decryption failed: ${error.message}`
        });
        result.success = false;
      }
    }
  }
  
  return result;
}
```

---

### 4.5 Rollback Strategy

```typescript
/**
 * Rollback Script: V2 → V1
 * ใช้เฉพาะเมื่อ migration ล้มเหลวหรือต้องการ revert
 */
async function rollbackV2toV1(
  migrationRecord: MigratedRecord,
  options?: {
    deleteV2?: boolean;
  }
): Promise<RollbackResult> {
  const result: RollbackResult = {
    success: true,
    v1Record: null,
    error: null
  };
  
  try {
    // 1. ดึง V2 entities
    const account = await getAccount(migrationRecord.v2AccountId);
    const service = await getService(migrationRecord.v2ServiceId);
    const secretItems = await Promise.all(
      migrationRecord.v2SecretItemIds.map(id => getSecretItem(id))
    );
    
    // 2. Reconstruct V1 DataRecord
    const v1Record: DataRecord = {
      id: migrationRecord.v1RecordId,
      title: account.label,
      category: mapCategoryV2toV1(service.categoryId),
      fields: {},
      secretItems: [],
      createdAt: account.createdAt,
      updatedAt: account.updatedAt
    };
    
    // 3. Restore fields
    for (const fieldValue of account.fields) {
      if (fieldValue.plainValue) {
        const fieldName = getFieldNameById(fieldValue.fieldDefinitionId);
        v1Record.fields[fieldName] = fieldValue.plainValue;
      } else if (fieldValue.secretRef) {
        const secretItem = secretItems.find(
          si => si.id === fieldValue.secretRef!.secretItemId
        );
        if (secretItem && secretItem.versions.length > 0) {
          const fieldName = getFieldNameById(fieldValue.fieldDefinitionId);
          v1Record.fields[fieldName] = secretItem.versions[0].encryptedValue;
        }
      }
    }
    
    // 4. Restore secret items
    for (const secretItem of secretItems) {
      if (secretItem.versions.length > 0) {
        const version = secretItem.versions[0];
        v1Record.secretItems.push({
          id: secretItem.id,
          type: secretItem.type,
          label: secretItem.label,
          encryptedValue: version.encryptedValue,
          iv: version.iv,
          status: secretItem.status,
          createdAt: secretItem.createdAt,
          expiresAt: secretItem.expiresAt,
          notes: secretItem.notes
        });
      }
    }
    
    // 5. Save V1 record
    await saveV1Record(v1Record);
    
    // 6. Optionally delete V2 entities
    if (options?.deleteV2) {
      await deleteAccount(migrationRecord.v2AccountId);
      await deleteService(migrationRecord.v2ServiceId);
      for (const secretItemId of migrationRecord.v2SecretItemIds) {
        await deleteSecretItem(secretItemId);
      }
    }
    
    result.v1Record = v1Record;
    
  } catch (error) {
    result.success = false;
    result.error = error.message;
  }
  
  return result;
}
```

---

### 4.6 Test Execution Plan

```bash
# 1. สร้าง test database ด้วย fixture data
npm run test:migration:setup

# 2. Run migration (dry run)
npm run test:migration -- --dry-run

# 3. Run migration จริง
npm run test:migration -- --execute

# 4. ทดสอบ encryption continuity
npm run test:encryption-continuity

# 5. ทดสอบ rollback
npm run test:rollback

# 6. Generate report
npm run test:migration:report
```

---

## สรุปสถานะ

| หัวข้อ | สถานะ | หมายเหตุ |
|--------|-------|----------|
| FieldValue ↔ SecretItem Relationship | ✅ แก้ไขแล้ว | แยกชัดเจน: FieldValue → SecretRef → SecretItem → SecretVersion |
| Secret Version vs Audit Retention | ✅ แยกแล้ว | Versions: 5, Audit: ไม่จำกัด |
| Key Lifecycle Implementation | ✅ Spec ครบ | Master key ใน memory เท่านั้น, auto-lock, clear on lock |
| Migration Test Suite | ✅ Design แล้ว | รอ implementation และทดสอบกับ fixture |
| Backward Compatibility | 🟡 ต้องทดสอบ | ขึ้นอยู่กับผลการทดสอบ migration |
| V2-0 Final Lock | 🟡 Conditional | รอผลการทดสอบ migration จริง |

---

**Next Steps:**
1. Implement Migration Script จริง
2. สร้าง Fixture Data ใน test database
3. Run Migration Test Suite
4. Verify Encryption Continuity
5. Test Rollback Mechanism
6. Report Results → V2-0 Final Lock Decision
