# V2-0 Domain Model Evidence Report

**วันที่:** 2024
**สถานะ:** V2-0 — LOCK CANONICAL DOMAIN MODEL (IN PROGRESS)

---

## 1. Current V1 Actual Domain Model (จาก Source Code จริง)

### 1.1 Core Entities ที่พบใน `/workspace/src/lib/data/record.ts`

```typescript
// ไฟล์: /workspace/src/lib/data/record.ts
export type RecordCategory = 'credential' | 'project' | 'finance' | 'custom';

export type DataRecord = {
  id: string;
  title: string;
  category: RecordCategory;
  fields: Record<string, string>; // ⚠️ ใช้ Record<string, string> อย่างเดียว
  secretItems: SecretItem[];
  createdAt: number;
  updatedAt: number;
};

export type HistoryEntry = {
  id: string;
  recordId: string;
  action: 'created' | 'updated' | 'copied' | 'revoked' | 'restored';
  changedFields: string[];
  secretItemId?: string;
  createdAt: number;
};
```

### 1.2 Secret Management (`/workspace/src/lib/secret/secretItem.ts`)

```typescript
export type SecretType = 'backup-code' | 'api-key' | 'password' | 'token';
export type SecretStatus = 'active' | 'expired' | 'revoked';

export type SecretItem = {
  id: string;
  type: SecretType;
  label: string;
  encryptedValue: string;
  iv: string;
  status: SecretStatus;
  expiresAt?: number;
  createdAt: number;
  lastUsedAt?: number;
  revokedAt?: number;
  notes?: string;
  // ❌ ขาด: version, updatedAt, accountId reference
};
```

### 1.3 Cloud Account (`/workspace/src/lib/cloud/account.ts`)

```typescript
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
```

### 1.4 Quick Access Path Mapping (`/workspace/src/lib/quick-access/pathMapping.ts`)

```typescript
export type OsPathMapping = {
  id: string;
  name: string;
  windowsPath?: string;
  linuxPath?: string;
  macosPath?: string;
  createdAt: number;
  updatedAt: number;
};
```

### 1.5 Encryption (`/workspace/src/lib/crypto/aesGcm.ts`)

- ✅ AES-GCM 256-bit
- ✅ IV แยกต่างหากทุกครั้ง (12 bytes)
- ✅ Master key เก็บใน `chrome.storage.local`
- ✅ Encrypted values เก็บแยกใน storage key อื่น

### 1.6 การใช้งานจริงใน UI (`/workspace/src/components/Secrets.tsx`)

- ✅ อ่าน/เขียน Secrets ผ่าน `chrome.storage.local`
- ✅ แสดงสถานะ (active/expired/revoked)
- ✅ มี Toggle Status (Revoke/Activate)
- ✅ Copy value ได้หลัง reveal
- ⚠️ **ไม่มี Service/Account separation** — Secrets เป็น standalone items
- ⚠️ **ไม่มี FieldDefinition** — fields เป็น `Record<string, string>`
- ⚠️ **ไม่มี History service ทำงานจริง** — มีแค่ type definition

### 1.7 สรุป V1 Domain Model

```
┌─────────────────────────────────────────────────────┐
│                    DataRecord                        │
├─────────────────────────────────────────────────────┤
│  id: string                                         │
│  title: string                                      │
│  category: 'credential'|'project'|'finance'|'custom'│
│  fields: Record<string, string>  ⚠️ untyped         │
│  secretItems: SecretItem[]                          │
│  createdAt: number                                  │
│  updatedAt: number                                  │
└─────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│                     SecretItem                       │
├─────────────────────────────────────────────────────┤
│  id: string                                         │
│  type: 'password'|'api-key'|'token'|'backup-code'   │
│  label: string                                      │
│  encryptedValue: string                             │
│  iv: string                                         │
│  status: 'active'|'expired'|'revoked'               │
│  expiresAt?: number                                 │
│  createdAt: number                                  │
│  lastUsedAt?: number                                │
│  revokedAt?: number                                 │
│  notes?: string                                     │
│  ❌ ขาด: version, updatedAt, accountId              │
└─────────────────────────────────────────────────────┘
```

**ปัญหาหลักของ V1:**
1. ❌ ไม่มี Category → Format → Type → Field architecture
2. ❌ ไม่มี Service/Account separation (หนึ่ง Record = หนึ่ง item)
3. ❌ fields เป็น `Record<string, string>` ไม่มี type/validation
4. ❌ SecretItem ไม่มี reference ไปยัง parent Account
5. ❌ ไม่มี version ใน SecretItem (ไม่สามารถทำ rotation/history)
6. ❌ HistoryEntry มีแค่ type แต่ไม่มี service ทำงานจริง
7. ❌ ไม่มี Financial Institution Catalog
8. ❌ ไม่มี Generator
9. ❌ ไม่มี Website/App Capture

---

## 2. Proposed V2 Canonical Domain Model

### 2.1 Core Principle

**Template/Definition ≠ Actual Data**

- **FieldDefinition** = Template (นิยามว่า Field มีอะไรบ้าง)
- **FieldValue** = Actual Data (ค่าจริงที่ผู้ใช้กรอก)
- **Service** = Parent Entity (เช่น GitHub, Google, Bank)
- **Account** = Child Entity (เช่น Personal, Work, Organization)

### 2.2 Canonical Model Hierarchy

```
Category
   │
   └── Format
         │
         └── Type
               │
               └── FieldDefinition[]  ← Template
                     │
                     ▼
                  Service            ← Instance ของ Type
                     │
            ┌────────┴────────┐
            ▼                 ▼
         Account          Metadata
            │
            ▼
        FieldValue[]       ← Actual Values
            │
            ├── normal values (plaintext)
            └── secret values
                  │
                  ▼
            SecretItem[]
                  │
                  ▼
            SecretVersion[]  ← History 5 versions
```

### 2.3 นิยามแต่ละชั้น

#### Layer 1: Category

```typescript
type Category = {
  id: string;
  name: string;
  description?: string;
  iconRef: string;        // Lucide icon name
  accentColor?: string;   // hex color
  sortOrder: number;
  active: boolean;
  createdAt: number;
  updatedAt: number;
};
```

**หน้าที่:** จัดกลุ่มข้อมูลระดับสูงสุด (Website, Finance, API, Document, etc.)

#### Layer 2: Format

```typescript
type Format = {
  id: string;
  categoryId: string;
  name: string;           // เช่น "Financial Account", "Credential", "Document"
  description?: string;
  sortOrder: number;
};
```

**หน้าที่:** แบ่งย่อยภายใน Category ตามลักษณะข้อมูล

#### Layer 3: Type

```typescript
type Type = {
  id: string;
  formatId: string;
  name: string;           // เช่น "Bank", "Wallet", "Crypto Exchange"
  description?: string;
  fieldDefinitions: FieldDefinition[];
};
```

**หน้าที่:** นิยามโครงสร้าง Field ที่ชัดเจนสำหรับแต่ละกรณีใช้

#### Layer 4: FieldDefinition (Template)

```typescript
type FieldType = 
  | "text" | "textarea" | "url" | "email" | "username"
  | "password" | "secret" | "token" | "api-key" | "backup-code"
  | "number" | "currency" | "date" | "datetime" | "boolean"
  | "select" | "multiselect" | "phone" | "account-number"
  | "image" | "file" | "json";

type FieldValidation = {
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  custom?: string;  // function reference หรือ rule ID
};

type SelectOption = {
  value: string;
  label: string;
};

type FieldDefinition = {
  id: string;
  key: string;          // machine-readable key (e.g., "accountNumber")
  label: string;        // display name (e.g., "Account Number")
  type: FieldType;
  required?: boolean;
  secret?: boolean;     // ถ้า true → ต้อง encrypt
  masked?: boolean;     // ถ้า true → แสดง ••• โดย default
  copyable?: boolean;   // ถ้า true → แสดงปุ่ม copy
  options?: SelectOption[];  // สำหรับ select/multiselect
  validation?: FieldValidation;
  order: number;        // ลำดับการแสดงผล
  defaultValue?: string;
  placeholder?: string;
};
```

**หน้าที่:** นิยามชนิด, validation, UI behavior ของแต่ละ Field

#### Layer 5: Service (Instance)

```typescript
type Service = {
  id: string;
  name: string;
  url?: string;
  faviconUrl?: string;
  categoryId: string;
  formatId?: string;
  typeId?: string;
  notes?: string;
  origin?: string;      // สำหรับ match กับ website
  metadata: {
    capturedAt?: number;
    lastVisitedAt?: number;
    visitCount?: number;
  };
  createdAt: number;
  updatedAt: number;
};
```

**หน้าที่:** เป็น Parent Entity ที่รวม Accounts หลายๆ อันเข้าด้วยกัน

#### Layer 6: Account (Child of Service)

```typescript
type AuthType = "password" | "oauth" | "passkey" | "sso" | "custom";

type Account = {
  id: string;
  serviceId: string;    // FK → Service
  label: string;        // เช่น "Personal", "Work", "Organization"
  username?: string;
  authType?: AuthType;
  fields: FieldValue[];
  secretItems: SecretItem[];
  metadata: {
    lastUsedAt?: number;
    lastSyncAt?: number;
  };
  createdAt: number;
  updatedAt: number;
};
```

**หน้าที่:** เป็น Actual Instance ที่ผู้ใช้สร้างสำหรับแต่ละบัญชี

#### Layer 7: FieldValue (Actual Data)

```typescript
type FieldValue = {
  fieldDefinitionId: string;  // FK → FieldDefinition
  value: string;              // plaintext สำหรับ non-secret
  encryptedValue?: string;    // สำหรับ secret fields
  iv?: string;
  updatedAt: number;
};
```

**หน้าที่:** เก็บค่าจริงที่ผู้ใช้กรอก (แยก secret与非secret)

#### Layer 8: SecretItem + SecretVersion

```typescript
type SecretType = "password" | "api-key" | "token" | "backup-code" | "private-key";
type SecretStatus = "active" | "expired" | "revoked";

type SecretVersion = {
  version: number;
  encryptedValue: string;
  iv: string;
  createdAt: number;
  createdBy: "user" | "generator" | "sync" | "rotation";
  reason?: string;  // เช่น "rotated", "updated manually"
};

type SecretItem = {
  id: string;
  accountId: string;    // FK → Account
  fieldDefinitionId?: string;  // FK → FieldDefinition (ถ้า generate จาก field)
  type: SecretType;
  label: string;
  status: SecretStatus;
  expiresAt?: number;
  createdAt: number;
  updatedAt: number;
  lastUsedAt?: number;
  revokedAt?: number;
  currentVersion: number;
  versions: SecretVersion[];  // เก็บ 5 versions ล่าสุด
  notes?: string;
};
```

**หน้าที่:** เก็บ Secret พร้อม version history 5 ครั้ง

#### Layer 9: HistoryEntry (Event Log)

```typescript
type EntityType = "category" | "format" | "type" | "service" | "account" | "secret" | "field";
type HistoryAction = 
  | "created" | "updated" | "deleted"
  | "generated" | "copied" | "revealed"
  | "revoked" | "restored" | "rotated"
  | "synced" | "imported" | "exported";

type HistoryEntry = {
  id: string;
  entityId: string;
  entityType: EntityType;
  action: HistoryAction;
  changedFields?: string[];  // เฉพาะชื่อ field ไม่รวม value
  oldValuePreview?: string;  // เฉพาะ non-secret หรือ masked
  newValuePreview?: string;  // เฉพาะ non-secret หรือ masked
  secretItemId?: string;     // ถ้าเกี่ยวกับ secret
  version?: number;          // สำหรับ secret version tracking
  performedBy: "user" | "generator" | "system" | "sync";
  performedAt: number;
  metadata?: Record<string, string>;
};
```

**หน้าที่:** Audit log 5 events ล่าสุดต่อ entity

---

## 3. Entity Relationship Diagram

```
┌──────────────────────┐
│     Category         │
│  ──────────────────  │
│  id (PK)             │
│  name                │
│  iconRef             │
│  accentColor         │
└──────────┬───────────┘
           │ 1:N
           ▼
┌──────────────────────┐
│       Format         │
│  ──────────────────  │
│  id (PK)             │
│  categoryId (FK)     │
│  name                │
└──────────┬───────────┘
           │ 1:N
           ▼
┌──────────────────────┐
│        Type          │
│  ──────────────────  │
│  id (PK)             │
│  formatId (FK)       │
│  name                │
└──────────┬───────────┘
           │ 1:N (embedded)
           ▼
┌──────────────────────┐
│   FieldDefinition    │
│  ──────────────────  │
│  id (PK)             │
│  typeId (FK)         │
│  key                 │
│  label               │
│  type                │
│  required            │
│  secret              │
│  order               │
└──────────┬───────────┘
           │ Template
           │
           ▼
┌──────────────────────┐
│       Service        │◄──────┐
│  ──────────────────  │       │ Capture
│  id (PK)             │       │ from Tab
│  name                │       │
│  url                 │       │
│  faviconUrl          │       │
│  categoryId (FK)     │       │
│  formatId (FK)       │       │
│  typeId (FK)         │       │
│  origin              │───────┘ Match
└──────────┬───────────┘
           │ 1:N
           ▼
┌──────────────────────┐
│       Account        │
│  ──────────────────  │
│  id (PK)             │
│  serviceId (FK)      │
│  label               │
│  username            │
│  authType            │
└──────────┬───────────┘
           │ 1:N
           ├──────────────────────┐
           ▼                      ▼
┌──────────────────────┐  ┌──────────────────────┐
│     FieldValue       │  │      SecretItem      │
│  ──────────────────  │  │  ──────────────────  │
│  id (PK)             │  │  id (PK)             │
│  accountId (FK)      │  │  accountId (FK)      │
│  fieldDefId (FK)     │  │  type                │
│  value               │  │  label               │
│  encryptedValue?     │  │  status              │
│  iv?                 │  │  expiresAt           │
└──────────────────────┘  │  currentVersion      │
                          └──────────┬───────────┘
                                     │ 1:N
                                     ▼
                          ┌──────────────────────┐
                          │    SecretVersion     │
                          │  ──────────────────  │
                          │  version             │
                          │  encryptedValue      │
                          │  iv                  │
                          │  createdAt           │
                          │  createdBy           │
                          │  reason              │
                          └──────────────────────┘

┌──────────────────────┐
│     HistoryEntry     │◄────────────────────┐
│  ──────────────────  │                     │
│  id (PK)             │                     │
│  entityId (FK)       │                     │
│  entityType          │◄────────────────────┤
│  action              │                     │
│  changedFields       │                     │
│  performedBy         │                     │
│  performedAt         │                     │
└──────────────────────┘                     │
           ▲                                 │
           │ References                      │
           └─────────────────────────────────┘
```

**Cardinality Summary:**

| Relationship | Cardinality | Notes |
|-------------|-------------|-------|
| Category → Format | 1:N | One category has many formats |
| Format → Type | 1:N | One format has many types |
| Type → FieldDefinition | 1:N (embedded) | Type owns its field definitions |
| Service → Account | 1:N | One service has many accounts |
| Account → FieldValue | 1:N | One account has many field values |
| Account → SecretItem | 1:N | One account has many secrets |
| SecretItem → SecretVersion | 1:N (max 5) | Version history |
| HistoryEntry → [any entity] | N:1 | Polymorphic reference |

---

## 4. State Transitions

### 4.1 Secret Lifecycle State Machine

```
                    ┌─────────────┐
                    │   CREATED   │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
          ┌────────│    ACTIVE   │────────┐
          │        └──────┬──────┘        │
          │               │               │
   revoke │        use/copied│    expire │
          │               │               │
          ▼               │               ▼
   ┌─────────────┐        │        ┌─────────────┐
   │   REVOKED   │        │        │   EXPIRED   │
   └──────┬──────┘        │        └──────┬──────┘
          │               │               │
          │ activate      │               │ rotate
          │               │               │
          └───────────────┼───────────────┘
                          │
                          ▼
                   ┌──────────────┐
                   │   ROTATED    │
                   │ (new version)│
                   └──────────────┘
```

**Transitions:**

| From | Action | To | Notes |
|------|--------|----|-------|
| CREATED | - | ACTIVE | Default state after creation |
| ACTIVE | revoke() | REVOKED | Sets revokedAt timestamp |
| REVOKED | activate() | ACTIVE | Clears revokedAt |
| ACTIVE | expiresAt <= now | EXPIRED | Auto-transition on check |
| ACTIVE | rotate() | ROTATED | Creates new version, keeps old |
| EXPIRED | rotate() | ACTIVE (new version) | New version is active |

**Version Rotation Flow:**

```
rotate(secretId):
  1. Get current SecretItem
  2. Generate new value (or accept user input)
  3. Encrypt new value with new IV
  4. Create SecretVersion {
       version: currentVersion + 1,
       encryptedValue: ...,
       iv: ...,
       createdAt: now,
       createdBy: "rotation" | "generator" | "user",
       reason: "scheduled" | "manual" | "compromised"
     }
  5. Prepend to versions array (keep max 5)
  6. Update currentVersion
  7. Update updatedAt
  8. Create HistoryEntry(action: "rotated")
```

### 4.2 Lock/Unlock Session Boundary

```
┌─────────────────────────────────────────────────────────┐
│                    APPLICATION STATE                     │
└─────────────────────────────────────────────────────────┘

     ┌─────────────┐                         ┌─────────────┐
     │   LOCKED    │────────unlock()─────────►│  UNLOCKED   │
     │             │                         │  SESSION    │
     │  - No access│                         │             │
     │  - Show     │◄────timeout()/lock()────│  - Can read │
     │    unlock   │                         │    encrypted│
     │    screen   │                         │  - Can edit │
     │             │                         │  - Can      │
     │             │                         │    reveal   │
     │             │                         │  - Can      │
     │             │                         │    generate │
     │             │                         │  - Can sync │
     └─────────────┘                         └─────────────┘
                                                    │
                                                    │ Plaintext secrets
                                                    │ exist ONLY in memory
                                                    │ during this session
                                                    ▼
                                          ┌─────────────────┐
                                          │ SECRET VALUES   │
                                          │ IN MEMORY       │
                                          │                 │
                                          │ - Decrypted     │
                                          │ - Masked in UI  │
                                          │ - Cleared on    │
                                          │   lock/timeout  │
                                          └─────────────────┘
```

**Security Rules:**

1. **Master Key** เก็บใน `chrome.storage.local` แบบ encrypted ด้วย user password
2. **Unlock Process:**
   - User กรอก master password
   - Derive key จาก password (PBKDF2 หรือ Argon2)
   - Decrypt master key
   - เก็บ master key ใน memory (closure หรือ React context)
   - ตั้ง timeout auto-lock
3. **During Unlocked Session:**
   - สามารถ decrypt secret values ได้
   - Plaintext values อยู่ใน memory ชั่วคราว
   - UI แสดง masked by default
   - User ต้อง click เพื่อ reveal/copy
4. **Lock/Timeout:**
   - Clear master key จาก memory
   - Clear decrypted values จาก memory
   - กลับไป LOCKED state
   - ต้อง unlock ใหม่เพื่อเข้าถึง secrets

**Implementation Pattern:**

```typescript
// Session Manager
class SecuritySession {
  private masterKey: CryptoKey | null = null;
  private timeoutId: number | null = null;
  private readonly TIMEOUT_MS = 15 * 60 * 1000; // 15 นาที

  async unlock(password: string): Promise<boolean> {
    // Derive key from password
    const derivedKey = await deriveKeyFromPassword(password);
    // Decrypt master key
    const encryptedMasterKey = await getEncryptedMasterKey();
    this.masterKey = await decryptMasterKey(encryptedMasterKey, derivedKey);
    // Start timeout
    this.startAutoLock();
    return true;
  }

  lock(): void {
    this.masterKey = null;
    if (this.timeoutId) clearTimeout(this.timeoutId);
    // Clear any decrypted caches
    clearDecryptedCache();
  }

  private startAutoLock(): void {
    if (this.timeoutId) clearTimeout(this.timeoutId);
    this.timeoutId = window.setTimeout(() => {
      this.lock();
    }, this.TIMEOUT_MS);
  }

  getMasterKey(): CryptoKey | null {
    // Reset timeout on each access
    this.startAutoLock();
    return this.masterKey;
  }

  isUnlocked(): boolean {
    return this.masterKey !== null;
  }
}
```

### 4.3 Account/Service CRUD Transitions

```
Service Creation:
  ┌─────────┐   createService()   ┌─────────────┐
  │  NONE   │ ───────────────────►│  SERVICE    │
  └─────────┘                     │  (no acct)  │
                                  └──────┬──────┘
                                         │ addAccount()
                                         ▼
                                  ┌─────────────┐
                                  │  SERVICE    │
                                  │  + Account  │
                                  └─────────────┘

Account Lifecycle:
  ┌─────────┐   addAccount()   ┌─────────────┐
  │  NEW    │ ────────────────►│   ACTIVE    │
  └─────────┘                  └──────┬──────┘
                                      │ updateFields()
                                      │ addSecret()
                                      │ delete()
                                      ▼
                               ┌─────────────┐
                               │   UPDATED   │
                               │   DELETED   │
                               └─────────────┘
```

---

## 5. Security Boundary Architecture

### 5.1 Data Flow with Encryption Boundaries

```
┌──────────────────────────────────────────────────────────────┐
│                         UI LAYER                              │
│  ──────────────────────────────────────────────────────────  │
│  - Renders masked values by default                          │
│  - Requests reveal/copy → requires confirmation              │
│  - Never receives plaintext unless explicitly revealed       │
└───────────────────────┬──────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────────┐
│                    DOMAIN SERVICES                            │
│  ──────────────────────────────────────────────────────────  │
│  - Schema Service      → validates field definitions         │
│  - Record Service      → CRUD operations                     │
│  - Secret Service      → encryption/decryption boundary ⚠️   │
│  - History Service     → audit logging (no secret values)    │
│  - Session Service     → manages unlock/lock state           │
└───────────────────────┬──────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────────┐
│                   STORAGE ADAPTER                             │
│  ──────────────────────────────────────────────────────────  │
│  - Local Storage Adapter  → chrome.storage.local             │
│  - Cloud Adapter          → encrypted payload only           │
│                                                                  │
│  ENCRYPTION BOUNDARY ⚠️                                       │
│  - All secret values encrypted BEFORE persistence            │
│  - Non-secret values stored as plaintext                     │
│  - IV generated fresh for each encryption                    │
└───────────────────────┬──────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────────┐
│                    PHYSICAL STORAGE                           │
│  ──────────────────────────────────────────────────────────  │
│  - chrome.storage.local (encrypted secrets)                  │
│  - Cloud Provider (encrypted payload)                        │
└──────────────────────────────────────────────────────────────┘
```

### 5.2 Plaintext Secret Locations (Allowed vs Forbidden)

| Location | Allowed? | Notes |
|----------|----------|-------|
| Browser Memory (during unlocked session) | ✅ YES | Temporary, cleared on lock |
| UI Input Field (while editing) | ✅ YES | User-initiated, ephemeral |
| Clipboard (after copy action) | ⚠️ CONDITIONAL | User-initiated, show warning |
| chrome.storage.local (persisted) | ❌ NO | Must be encrypted |
| Cloud Storage | ❌ NO | Must be double-encrypted |
| Console Logs | ❌ NO | Never log secrets |
| Error Messages | ❌ NO | Redact secret values |
| History Entries | ❌ NO | Store metadata only |
| Network Requests | ❌ NO | Unless user explicitly sends |

### 5.3 Encryption Operations

```typescript
// Before Persistence (Write Path)
async function storeSecretValue(
  secretId: string,
  plaintext: string,
  session: SecuritySession
): Promise<void> {
  // 1. Verify session is unlocked
  if (!session.isUnlocked()) {
    throw new Error('Session locked');
  }

  // 2. Get master key from session
  const masterKey = session.getMasterKey();
  if (!masterKey) {
    throw new Error('Master key not available');
  }

  // 3. Encrypt with fresh IV
  const { ciphertext, iv } = await encrypt(plaintext, masterKey);

  // 4. Store encrypted data
  await chrome.storage.local.set({
    [`secret:${secretId}`]: { ciphertext, iv }
  });

  // 5. NEVER store plaintext
  // Plaintext exists only in the caller's scope temporarily
}

// After Retrieval (Read Path)
async function retrieveSecretValue(
  secretId: string,
  session: SecuritySession
): Promise<string> {
  // 1. Verify session is unlocked
  if (!session.isUnlocked()) {
    throw new Error('Session locked');
  }

  // 2. Get master key from session
  const masterKey = session.getMasterKey();

  // 3. Retrieve encrypted data
  const stored = await chrome.storage.local.get(`secret:${secretId}`);
  const { ciphertext, iv } = stored[`secret:${secretId}`];

  // 4. Decrypt
  const plaintext = await decrypt(ciphertext, iv, masterKey);

  // 5. Return plaintext (caller must handle responsibly)
  // Caller should clear it after use
  return plaintext;
}
```

### 5.4 Session Boundary Enforcement

```typescript
// React Context for Session
const SecuritySessionContext = createContext<SecuritySession | null>(null);

// Protected Component Wrapper
function ProtectedSecretValue({ secretId }: { secretId: string }) {
  const session = useContext(SecuritySessionContext);
  const [revealed, setRevealed] = useState(false);
  const [value, setValue] = useState<string | null>(null);

  if (!session?.isUnlocked()) {
    return <UnlockPrompt />;
  }

  const handleReveal = async () => {
    try {
      const plaintext = await retrieveSecretValue(secretId, session);
      setValue(plaintext);
      setRevealed(true);

      // Auto-hide after 30 seconds
      setTimeout(() => {
        setValue(null);
        setRevealed(false);
      }, 30000);
    } catch (error) {
      console.error('Failed to reveal secret'); // No secret value in error
    }
  };

  const handleCopy = async () => {
    if (value) {
      await navigator.clipboard.writeText(value);
      // Clear value after copy
      setValue(null);
      setRevealed(false);
    }
  };

  return (
    <div>
      {revealed && value ? (
        <code>••••••••</code> // Still masked in UI
      ) : (
        <code>••••••••</code>
      )}
      <button onClick={handleReveal}>Reveal</button>
      <button onClick={handleCopy}>Copy</button>
    </div>
  );
}
```

---

## 6. Migration Strategy V1 → V2

### 6.1 Backward Compatibility Principles

1. **ไม่ลบข้อมูล V1 ทิ้ง** — ข้อมูลเดิมต้อง migrate ได้ทั้งหมด
2. **ไม่บังคับ migration ทันที** — รองรับ dual-read ระหว่าง migration
3. **ตรวจสอบความถูกต้องก่อนเขียน** — validate ก่อน commit V2 format
4. **rollback ได้** — เก็บ backup ก่อน migration

### 6.2 Migration Mapping

#### V1 DataRecord → V2 Service + Account

```typescript
// V1 Source
type V1DataRecord = {
  id: string;
  title: string;
  category: 'credential' | 'project' | 'finance' | 'custom';
  fields: Record<string, string>;
  secretItems: V1SecretItem[];
  createdAt: number;
  updatedAt: number;
};

// V2 Target
type V2Service = {
  id: string;              // same as V1 record.id
  name: string;            // same as V1 record.title
  categoryId: string;      // mapped from V1 category
  // ... other fields
};

type V2Account = {
  id: string;              // new ID (generate)
  serviceId: string;       // = V1 record.id
  label: string;           // = "Default" (single account migration)
  fields: V2FieldValue[];  // migrated from V1 fields
  secretItems: V2SecretItem[]; // migrated from V1 secretItems
};
```

#### Migration Algorithm

```typescript
async function migrateV1ToV2(v1Records: V1DataRecord[]): Promise<{
  services: V2Service[],
  accounts: V2Account[],
  categories: V2Category[],
  skipped: MigrationError[]
}> {
  const services: V2Service[] = [];
  const accounts: V2Account[] = [];
  const categories: V2Category[] = [];
  const skipped: MigrationError[] = [];

  // Step 1: Migrate Categories
  const categoryMap: Record<string, string> = {};
  for (const v1Category of ['credential', 'project', 'finance', 'custom']) {
    const v2Category: V2Category = {
      id: makeId(),
      name: capitalize(v1Category),
      iconRef: getDefaultIcon(v1Category),
      sortOrder: 0,
      active: true,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    categories.push(v2Category);
    categoryMap[v1Category] = v2Category.id;
  }

  // Step 2: Migrate each V1 Record
  for (const v1Record of v1Records) {
    try {
      // Validate V1 record
      if (!v1Record.id || !v1Record.title) {
        skipped.push({
          recordId: v1Record.id,
          reason: 'Missing required fields'
        });
        continue;
      }

      // Create V2 Service
      const v2Service: V2Service = {
        id: v1Record.id,
        name: v1Record.title,
        categoryId: categoryMap[v1Record.category] || categories[0].id,
        createdAt: v1Record.createdAt,
        updatedAt: v1Record.updatedAt
      };
      services.push(v2Service);

      // Create V2 Account (single "Default" account per V1 record)
      const v2Account: V2Account = {
        id: makeId(),
        serviceId: v1Record.id,
        label: 'Default',
        fields: [],
        secretItems: [],
        createdAt: v1Record.createdAt,
        updatedAt: v1Record.updatedAt
      };

      // Migrate fields (Record<string, string> → FieldValue[])
      for (const [key, value] of Object.entries(v1Record.fields)) {
        // Create a minimal FieldDefinition for unknown fields
        const fieldDefId = await getOrCreateFieldDefinition(key);
        v2Account.fields.push({
          fieldDefinitionId: fieldDefId,
          value: value,
          updatedAt: v1Record.updatedAt
        });
      }

      // Migrate secret items
      for (const v1Secret of v1Record.secretItems) {
        v2Account.secretItems.push({
          id: v1Secret.id,
          accountId: v2Account.id,  // Set new accountId
          type: v1Secret.type,
          label: v1Secret.label,
          encryptedValue: v1Secret.encryptedValue,  // Keep encrypted value
          iv: v1Secret.iv,
          status: v1Secret.status,
          expiresAt: v1Secret.expiresAt,
          createdAt: v1Secret.createdAt,
          updatedAt: Date.now(),
          lastUsedAt: v1Secret.lastUsedAt,
          revokedAt: v1Secret.revokedAt,
          currentVersion: 1,
          versions: [{
            version: 1,
            encryptedValue: v1Secret.encryptedValue,
            iv: v1Secret.iv,
            createdAt: v1Secret.createdAt,
            createdBy: 'migration'
          }]
        });
      }

      accounts.push(v2Account);
    } catch (error) {
      skipped.push({
        recordId: v1Record.id,
        reason: error.message
      });
    }
  }

  return { services, accounts, categories, skipped };
}
```

### 6.3 What Cannot Be Automatically Migrated

| V1 Feature | V2 Equivalent | Migration Status |
|-----------|---------------|------------------|
| `fields: Record<string, string>` | `FieldValue[]` with FieldDefinition | ✅ Auto-migrate as generic fields |
| `secretItems` | `SecretItem` with versions | ✅ Migrate with version=1 |
| Flat structure | Service → Account hierarchy | ✅ Wrap in "Default" account |
| Category enum | Customizable Category | ✅ Map to built-in categories |
| ❌ N/A | FieldDefinition validation rules | ⚠️ Cannot infer — use defaults |
| ❌ N/A | Service favicon/url | ⚠️ Cannot infer — leave empty |
| ❌ N/A | Account label differentiation | ⚠️ Use "Default" for all |
| ❌ N/A | Secret version history (>1) | ⚠️ Start with version=1 |

### 6.4 Rollback Strategy

```typescript
// Backup before migration
async function backupV1Data(): Promise<V1DataRecord[]> {
  const result = await chrome.storage.local.get('dataRecords');
  const backup = result.dataRecords || [];
  
  // Store backup with timestamp
  await chrome.storage.local.set({
    'v1_backup_' + Date.now(): backup
  });
  
  return backup;
}

// Rollback function
async function rollbackToV1(backupKey: string): Promise<void> {
  const result = await chrome.storage.local.get(backupKey);
  const v1Backup = result[backupKey];
  
  if (!v1Backup) {
    throw new Error('Backup not found');
  }
  
  // Restore V1 data
  await chrome.storage.local.set({
    'dataRecords': v1Backup
  });
  
  // Clear V2 data
  await clearV2Data();
}
```

### 6.5 Dual-Read Compatibility Period

ระหว่าง migration ให้รองรับการอ่านทั้ง V1 และ V2 format:

```typescript
async function readRecords(): Promise<V2Service[]> {
  // Try V2 first
  const v2Result = await readV2Services();
  if (v2Result.length > 0) {
    return v2Result;
  }
  
  // Fallback to V1
  const v1Records = await readV1Records();
  if (v1Records.length > 0) {
    // On-the-fly migration (read-only)
    return migrateV1ToV2OnTheFly(v1Records);
  }
  
  return [];
}
```

---

## 7. Backward Compatibility Assessment

### คำถาม: "ถ้า V2 ถูก Implement แล้ว ข้อมูล V1 ที่มีอยู่วันนี้จะหาย เสียความหมาย หรือถูกตีความผิดหรือไม่?"

**คำตอบ:** ❌ **ยังไม่สามารถตอบได้ชัดเจน** จนกว่าจะ:

1. ✅ **ทดสอบ Migration Script** กับข้อมูล V1 จริง
2. ✅ **Validate** ว่าทุก field migrate ได้ถูกต้อง
3. ✅ **Verify** ว่า encrypted values ยัง decrypt ได้หลัง migration
4. ✅ **Confirm** ว่า History entries ยังคงความหมาย

### ความเสี่ยงที่ต้องแก้ไขก่อน Lock

| ความเสี่ยง | สถานะ | แก้ไขโดย |
|-----------|-------|----------|
| V1 `Record<string, string>` สูญเสีย semantic meaning | ⚠️ Medium | สร้าง FieldDefinition generics |
| V1 SecretItems ขาด `accountId` reference | ✅ Low | เพิ่มใน migration |
| V1 SecretItems ขาด `version` field | ✅ Low | ตั้ง version=1 |
| Encrypted values อาจ decrypt ไม่ได้ถ้า master key เปลี่ยน | 🔴 High | ต้องใช้ master key เดิม |
| History entries อาจ link กับ recordId ที่เปลี่ยน | ⚠️ Medium | รักษา ID เดิม |

### ข้อกำหนดก่อน Approve V2-0

- [ ] เขียน migration script และทดสอบกับ dummy V1 data
- [ ] ตรวจสอบว่า encrypted values ยัง decrypt ได้
- [ ] สร้าง rollback mechanism
- [ ] กำหนด dual-read period
- [ ] ทดสอบกับ production-like data volume

---

## 8. Next Steps

### Gate Criteria สำหรับ V2-0 Completion

ก่อนจะถือว่า V2-0 เสร็จ ต้อง:

1. ✅ **Domain Model Review** — Co-Founder อนุมัติ canonical model
2. ✅ **Migration Test** — ทดสอบ migrate V1 → V2 สำเร็จ
3. ✅ **Security Review** — ยืนยัน session boundary และ encryption flow
4. ✅ **Backward Compat** — รับรองว่าข้อมูล V1 ไม่หาย

### Recommended Order หลัง V2-0 Lock

```
V2-0 Domain Model Lock ✅ (กำลังทำ)
   ↓
V2-1 Schema Engine (Category/Format/Type/FieldDefinition)
   ↓
V2-2 Service/Account/Field CRUD
   ↓
V2-3 Secret Lifecycle (encryption, version, rotation)
   ↓
V2-4 History/Audit Service
   ↓
V2-5 UI (Card, Sidebar, Dashboard)
   ↓
V2-6 Capture (Website/App detection)
   ↓
V2-7 Sync (Cloud integration)
```

---

**สรุป:** รายงานฉบับนี้แสดงหลักฐานจาก source code V1 จริง และเสนอ canonical domain model สำหรับ V2 พร้อม relationship diagram, state transitions, security boundary และ migration strategy รอการ review และ approval ก่อนเริ่ม implement V2-1 Schema Engine
