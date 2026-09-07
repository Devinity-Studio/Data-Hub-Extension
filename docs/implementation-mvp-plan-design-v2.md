# Data Hub Extension
## Implementation MVP Plan & Design — v2

> เอกสารฉบับปรับปรุงสำหรับส่งให้ผู้พัฒนา โดยขยายจาก `implementation-mvp-plan-design.md` เดิมให้รองรับระบบจัดเก็บข้อมูลหลายรูปแบบ, Custom Schema, หลายบัญชีต่อบริการ, Financial Institution Catalog, Secret Rotation/History, Responsive Card UI, Multi-OS Quick Access และ Multi-account Cloud Drive อย่างเป็นระบบ

- **สถานะ:** Proposed / Implementation-ready baseline
- **Platform:** Browser Extension, Manifest V3
- **Primary stack:** React + TypeScript
- **Design principle:** Local-first, schema-driven, encrypted-by-default, provider-agnostic
- **เอกสารเดิม:** `docs/implementation-mvp-plan-design.md`

---

## 1. Product Vision

Data Hub Extension เป็นศูนย์กลางสำหรับจัดเก็บและเรียกใช้ข้อมูลส่วนตัว/ข้อมูลสำหรับงานดิจิทัลจาก Browser Extension โดยไม่บังคับให้ข้อมูลทุกชนิดอยู่ในรูปแบบเดียวกัน

ระบบต้องรองรับตั้งแต่ข้อมูลทั่วไป เช่น Website, Calendar, Document และ Image ไปจนถึงข้อมูลอ่อนไหว เช่น Username, Password, Backup Code, API Key, Token, Bank Account และข้อมูลบัตร โดยผู้ใช้สามารถกำหนดโครงสร้างข้อมูลเองได้

หลักสำคัญคือ:

1. **Category → Format → Type → Fields** เป็นโครงสร้างหลักของระบบ
2. ผู้ใช้สร้าง Field เองได้
3. Service/Website/App หนึ่งรายการมีหลาย Account ได้
4. Secret แยก lifecycle จากข้อมูลทั่วไป
5. Secret มี Generator, Rotation และ History ย้อนหลัง 5 ครั้ง
6. UI เดียวกันต้องใช้งานได้ทั้ง Full Dashboard และ Sidebar
7. Card เป็น presentation หลัก และต้องมี favicon เมื่อเป็น Website/App
8. Local Path ต้องรองรับการ map ข้าม Windows/Linux/macOS จาก logical folder เดียวกัน
9. Cloud Drive ต้องรองรับหลาย Provider และหลาย Account/Profile
10. การอัปเดตข้อมูลอัตโนมัติต้องเป็น **ผู้ใช้อนุมัติก่อนเขียนข้อมูลสำคัญ** และต้องมี History เสมอ

---

## 2. Information Architecture

### 2.1 โครงสร้าง 4 ชั้น

```text
Category
  └── Format
       └── Type
            └── Fields
```

ตัวอย่าง:

```text
Category: Finance
  └── Format: Financial Account
       ├── Type: Bank
       │    ├── Institution
       │    ├── Account Name
       │    ├── Account Number
       │    ├── Account Type
       │    └── Currency
       ├── Type: Wallet
       │    ├── Provider
       │    ├── Wallet ID
       │    └── Currency
       └── Type: Crypto
            ├── Exchange / Provider
            ├── Account ID
            ├── Wallet Address
            └── Network
```

### 2.2 Built-in Categories

MVP should ship with starter categories that users may customize:

- Website / App
- Login / Credential
- Finance
- Bank / Wallet / Crypto
- API / Developer
- Calendar
- Document
- Image / Media
- Project
- Custom

Categories are configuration, not hard-coded business logic.

### 2.3 Category Appearance

Each Category supports:

- Minimal icon selection
- Custom accent color
- Name
- Description
- Sort order
- Active/Archived state

Use Lucide-style minimal icons or an equivalent icon set. Icons must be semantic and visually consistent.

---

## 3. Schema Builder / Custom Fields

### 3.1 User-defined Fields

ผู้ใช้ต้องสามารถสร้าง Field เองสำหรับ Format/Type ที่ต้องการ

```ts
type FieldDefinition = {
  id: string;
  key: string;
  label: string;
  type:
    | "text"
    | "textarea"
    | "url"
    | "email"
    | "username"
    | "password"
    | "secret"
    | "token"
    | "api-key"
    | "backup-code"
    | "number"
    | "currency"
    | "date"
    | "datetime"
    | "boolean"
    | "select"
    | "multiselect"
    | "phone"
    | "account-number"
    | "image"
    | "file"
    | "json";
  required?: boolean;
  secret?: boolean;
  masked?: boolean;
  copyable?: boolean;
  options?: SelectOption[];
  validation?: FieldValidation;
  order: number;
};
```

### 3.2 Field behavior

แต่ละ Field สามารถกำหนด:

- Required / Optional
- Secret / Non-secret
- Masked / Visible
- Copyable / Non-copyable
- Validation Rule
- Default Value
- Placeholder
- Dropdown / Multi-select options
- Display order

**ห้ามใช้ `Record<string, string>` เป็น data model หลักเพียงอย่างเดียวอีกต่อไป** เพราะไม่สามารถอธิบายชนิด, validation, secret boundary และ UI behavior ของ Field ได้เพียงพอ

---

## 4. Record และ Multi-account Model

### 4.1 Service เป็น Parent, Account เป็น Child

Website/App เดียวสามารถมีหลาย Account ได้โดยไม่สร้างข้อมูลซ้ำของ Service

```ts
type Service = {
  id: string;
  name: string;
  url?: string;
  faviconUrl?: string;
  categoryId: string;
  formatId?: string;
  typeId?: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
};

type Account = {
  id: string;
  serviceId: string;
  label: string;
  username?: string;
  authType?: "password" | "oauth" | "passkey" | "sso" | "custom";
  fields: FieldValue[];
  secretItems: SecretItem[];
  createdAt: number;
  updatedAt: number;
};
```

ตัวอย่าง:

```text
GitHub
├── Personal
├── Work
└── Organization
```

UI ต้องแสดง Service Card ก่อน แล้วให้ผู้ใช้เลือก Account ภายใน Service นั้น

---

## 5. Standard Credential Fields

Built-in templates should support at least:

- URL
- Login/Auth Type
- Username
- Password
- Backup Code
- API Key
- Token
- Account Number

แต่ Field เหล่านี้ยังต้องเป็น **Template Fields** ไม่ใช่ข้อจำกัดถาวร เพราะผู้ใช้สามารถเพิ่ม Field อื่นเองได้

---

## 6. Financial Institution Catalog

### 6.1 UX

เมื่อสร้าง Financial Account ให้เลือก:

```text
[ Institution dropdown ]
   🏦 Bank Name
   👛 Wallet Name
   ₿ Crypto / Exchange
```

แต่ละ option ต้องมี:

- icon/logo reference
- display name
- short name
- institution type
- country
- currency support
- provider identifier

### 6.2 Scope

Catalog ต้องออกแบบเป็น **data-driven registry** ไม่ hard-code ใน UI เพื่อรองรับการเพิ่ม/แก้ไขสถาบันโดยไม่ต้องเปลี่ยน component หลัก

MVP seed data ควรครอบคลุม:

- ธนาคารพาณิชย์ไทยและธนาคารดิจิทัลที่ให้บริการในประเทศไทย
- ผู้ให้บริการ e-wallet / payment ที่นิยมในไทย
- ผู้ให้บริการระดับโลกที่ผู้ใช้มีแนวโน้มต้องจัดเก็บข้อมูล เช่น PayPal
- Crypto exchange / wallet เช่น Binance และ provider ชั้นนำอื่น

**ข้อกำหนดสำคัญ:** ไม่ควรเขียนคำว่า “ทุกสถาบันการเงินทั่วโลก” เป็น static list ใน source code เพราะ catalog ไม่มีวันสิ้นสุด ให้ใช้ registry + versioning + update mechanism แทน

### 6.3 Institution model

```ts
type FinancialInstitution = {
  id: string;
  name: string;
  shortName?: string;
  type: "bank" | "wallet" | "payment" | "exchange" | "crypto-wallet";
  countryCodes: string[];
  iconRef?: string;
  websiteUrl?: string;
  active: boolean;
  sortOrder?: number;
};
```

---

## 7. Secret Management

Secret types:

- Password
- API Key
- Token
- Backup Code
- Recovery Code
- Private Key / Seed-related secret **ต้องอยู่ใน Security scope ที่เข้มงวดเป็นพิเศษ**

### 7.1 Secret Item

```ts
type SecretItem = {
  id: string;
  accountId: string;
  type: SecretType;
  label: string;
  encryptedValue: string;
  iv: string;
  version: number;
  status: "active" | "expired" | "revoked";
  expiresAt?: number;
  createdAt: number;
  updatedAt: number;
  lastUsedAt?: number;
  revokedAt?: number;
};
```

### 7.2 Generator

Generator must support at least:

- Password generation
- API key generation
- Token generation
- Backup code generation

Generator settings:

- Length
- Character set
- Exclude ambiguous characters
- Number of codes
- Prefix (optional)
- Copy generated value
- Save directly as a new Secret Item

Generated secrets must never appear in application logs.

---

## 8. History — 5 Versions / 5 Latest Events

ผู้ใช้ต้องการดู “ประวัติข้อมูล 5 ครั้งหลังสุด” จึงต้องแยกให้ชัดระหว่าง:

1. **Event History** — ใคร/เมื่อไร/ทำอะไร
2. **Value Version History** — ค่าข้อมูลย้อนหลัง ซึ่งอาจมี Secret

MVP ให้เก็บ Event History 5 รายการเป็นค่าเริ่มต้น และรองรับ Value Version History เฉพาะเมื่อมี security design สำหรับ encrypted historical values แล้ว

```ts
type HistoryEntry = {
  id: string;
  entityId: string;
  entityType: "service" | "account" | "secret" | "field";
  action: "created" | "updated" | "generated" | "copied" | "revoked" | "restored";
  changedFields: string[];
  createdAt: number;
};
```

UI ต้องแสดง:

- วันที่/เวลา
- Action
- Field ที่เปลี่ยน
- ผู้กระทำ = Local User
- Restore action เมื่อ policy อนุญาต

**ห้ามแสดง Secret value ใน History โดย plaintext**

---

## 9. Automatic Update / Ask-to-Update

ระบบสามารถสอบถามผู้ใช้เพื่ออัปเดตข้อมูลอัตโนมัติได้ แต่ต้องมี Human Confirmation สำหรับข้อมูลสำคัญ

Flow:

```text
Detect change
   ↓
Compare with stored metadata
   ↓
Prepare proposed update
   ↓
Show changed fields
   ↓
User Approves
   ↓
Write encrypted data
   ↓
Create history event
```

สำหรับข้อมูลที่ไม่ sensitive เช่น favicon, page title หรือ URL metadata สามารถ auto-update ได้ตาม policy

สำหรับ Password, API Key, Token, Account Number และข้อมูลการเงิน:

- ห้าม silent overwrite เป็น default
- ต้องแสดง proposed change
- ต้องยืนยันก่อน Save
- ต้องสร้าง History Event

---

## 10. Website/App Capture

เมื่อผู้ใช้เปิด Website/App สามารถสร้างหรือจับคู่ Service ได้จาก Current Tab

ระบบควรตรวจ:

- URL / origin
- hostname
- page title
- favicon
- existing Service
- existing Account

ถ้าพบ Service เดิม:

```text
Existing Service
   ├── Account A
   ├── Account B
   └── + Add Account
```

ไม่ควรสร้าง Service ซ้ำเพียงเพราะ URL path แตกต่างกัน หากอยู่ภายใต้ origin เดียวกันและ mapping policy ระบุว่าเป็น service เดียวกัน

---

## 11. Card Presentation

### 11.1 Standard Card

Card ต้องแสดง:

- favicon/icon
- Service name
- Account label
- category icon/color
- username หรือ identifier ที่ไม่ sensitive
- Secret count
- status
- last updated
- quick actions

Quick actions:

- Open
- Copy safe field
- Reveal/Copy Secret หลัง confirmation
- Edit
- Add Account

### 11.2 Responsive

```text
Sidebar       → compact card, 1 column
Small Desktop → 1–2 columns
Full Desktop  → 2–4 columns ตาม container
Mobile        → 1 column, touch-friendly
```

ใช้ Container Queries เป็นหลัก และไม่ผูก layout กับ viewport อย่างเดียว

---

## 12. Full Dashboard / Sidebar / Mobile

### Sidebar

เน้น retrieval speed:

- Search
- Category filter
- Quick Access
- Recent items
- compact cards
- Add button
- Expand to Full Dashboard

### Full Dashboard

เน้น management:

- Summary
- Category navigation
- Service/Account cards
- Secret status
- History
- Generator
- Cloud accounts
- Quick Access mappings
- Settings

### Mobile

Mobile presentation ต้องเป็น responsive web/extension-compatible UI architecture เดียวกัน แม้ Browser Extension บาง platform จะไม่รองรับ mobile extension โดยตรง

ดังนั้น **Mobile UI เป็น design target / responsive surface ไม่ใช่การรับประกันว่า extension จะติดตั้งบนทุก mobile browser**

---

## 13. Theme

รองรับ:

- Light
- Dark
- Auto

Theme state ต้อง persist และเปลี่ยนได้โดยไม่ reload UI

Design tokens ต้องเป็น shared variables ระหว่าง Sidebar และ Dashboard

---

## 14. Quick Access — Dual OS

แนวคิดคือผู้ใช้สร้าง logical folder เดียว:

```text
Work Projects
├── Windows → D:\Work\Projects
├── Linux   → /mnt/data/Work/Projects
└── macOS   → /Users/me/Work/Projects
```

### Requirements

- Detect OS
- Resolve path ตาม OS ปัจจุบัน
- Copy Path
- Open Folder เมื่อ platform/browser อนุญาต
- แสดง invalid mapping state
- ไม่ทำให้ UI ล่มเมื่อ path ใช้งานไม่ได้

### Native Capability

Browser Extension ไม่สามารถรับประกันการเปิด local folder ทุก browser/OS ได้

MVP:

1. Copy Path ต้องทำงานแน่นอน
2. Try Open เป็น best-effort
3. แยก Native Messaging Host เป็น Phase ถัดไป

---

## 15. Cloud Drive — Multi Account / Profile

Target providers:

- Google Drive
- OneDrive
- Dropbox

Provider architecture:

```ts
interface CloudProviderAdapter {
  connect(): Promise<CloudAccount>;
  disconnect(accountId: string): Promise<void>;
  upload(accountId: string, payload: EncryptedPayload): Promise<void>;
  download(accountId: string): Promise<EncryptedPayload>;
  getStatus(accountId: string): Promise<CloudStatus>;
}
```

### Multi-account

```text
Google Drive
├── Personal
└── Work

OneDrive
└── Work
```

รองรับ:

- Multiple accounts per provider
- Profile name
- Active account
- Disconnect
- Re-authentication
- Last sync
- Sync status
- Error state

Cloud ต้องได้รับ **ciphertext** ไม่ใช่ plaintext secret

---

## 16. Storage & Security Architecture

```text
UI
 ↓
Domain Services
 ├── Schema Service
 ├── Record Service
 ├── Secret Service
 ├── History Service
 ├── Quick Access Service
 └── Cloud Sync Service
 ↓
Storage Adapter
 ├── Local Storage
 └── Cloud Adapter
      ↓
Encryption Boundary
```

### Rules

- Encrypt before persistence
- AES-GCM via Web Crypto API
- New IV per encryption operation
- Never store Master Password plaintext
- Never log Secret values
- Never put Secret values into error messages
- Mask by default
- Reveal/Copy requires explicit user action and confirmation policy
- Clipboard clearing policy configurable
- Cloud payload encrypted before upload

For high-value secrets, consider an authenticated unlock/session boundary so the encryption key is not continuously available to every UI component.

---

## 17. Data Separation

Separate these concerns:

```text
Catalog
  ├── Categories
  ├── Formats
  ├── Types
  ├── Field Definitions
  └── Financial Institutions

User Data
  ├── Services
  ├── Accounts
  ├── Field Values
  └── Secret Items

Operational Data
  ├── History
  ├── Sync State
  ├── Layout State
  ├── Theme State
  └── Quick Access Mapping
```

This prevents the UI and storage model from becoming a single unstructured object.

---

## 18. MVP Scope

### P0 — Must Have

- Category → Format → Type → Field architecture
- Custom Field Builder
- Service + multi-account model
- Website/App records
- URL / username / password / backup code / API key / token
- Financial Account template
- Institution dropdown architecture
- Category icon + color
- Card UI + favicon
- Sidebar / Full Dashboard
- Light / Dark / Auto
- Search
- Mask / Reveal / Copy
- Password/API Key/Token/Backup Code Generator
- History 5 latest events
- Local encrypted storage
- Windows/Linux Quick Access mapping
- Multi-account cloud architecture
- At least one Cloud Provider end-to-end

### P1 — Should Have

- Calendar records
- Document/image attachments
- More financial providers
- Automatic metadata update
- Proposed update + confirmation flow
- Restore workflow
- macOS path mapping
- More Cloud Providers

### P2 — Later

- Native Messaging Host
- Advanced conflict resolution
- Automated provider catalog updates
- Mobile-specific packaging
- Collaboration
- Server-side encrypted search

---

## 19. Implementation Roadmap

### Milestone 0 — Contract & Architecture

- Lock domain model
- Lock schema model
- Define encryption boundary
- Define browser support matrix
- Define institution registry format
- Define test strategy

**Gate:** Data model and security boundary approved.

### Milestone 1 — UI Foundation

- Manifest V3
- React/TypeScript shell
- Shared layout
- Sidebar/Dashboard
- Theme
- Card primitives
- Category appearance

**Gate:** Responsive shell works without overflow.

### Milestone 2 — Schema & Local Data

- Category/Format/Type management
- Field Builder
- Service/Account model
- CRUD
- Search
- Local encrypted persistence

**Gate:** User can create arbitrary record structures without code changes.

### Milestone 3 — Secret Lifecycle

- Secret types
- Encryption
- Mask/Reveal/Copy
- Generator
- Expiration
- Revoke
- Rotation
- History 5 events

**Gate:** No plaintext secret leakage in storage/log/UI error paths.

### Milestone 4 — Finance & Capture

- Financial templates
- Institution registry
- Bank/Wallet/Crypto selector
- Current-tab capture
- Existing service matching
- Multi-account UX

**Gate:** One service can contain multiple independent accounts.

### Milestone 5 — Quick Access & Dashboard

- OS detection
- Path mapping
- Quick Access
- Dashboard statistics
- History view
- Responsive tuning

**Gate:** Sidebar remains fast and uncluttered while Dashboard exposes management detail.

### Milestone 6 — Cloud

- Provider adapter
- OAuth
- Multiple accounts
- Active account
- Encrypted sync
- Re-auth
- Sync status

**Gate:** Cloud never receives plaintext secret payloads.

### Milestone 7 — Automatic Update & Hardening

- Metadata change detection
- Proposed update
- User confirmation
- History event
- Security review
- Accessibility
- Cross-browser testing
- Backup/restore

**Gate:** No silent destructive overwrite of sensitive fields.

---

## 20. Testing Plan

### Unit

- Schema validation
- Field type validation
- Service/account relationships
- Secret status resolver
- Generator
- History retention
- OS path resolver
- Institution filtering

### Integration

- Local persistence
- Encryption/decryption
- CRUD
- Multi-account service
- Secret lifecycle
- History
- Cloud adapter
- OAuth expiration/re-auth

### Security

- Plaintext storage scan
- Console/log redaction
- Clipboard behavior
- Secret masking
- Unauthorized copy/reveal
- Cloud ciphertext verification
- Key/session lifecycle

### UI

- Sidebar
- Dashboard
- Card states
- Mobile-width responsive behavior
- Light/Dark/Auto
- Keyboard navigation
- Touch target size
- Empty/loading/error states

---

## 21. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Custom fields become unstructured | Schema Builder + typed FieldDefinition |
| Multiple accounts cause duplicated services | Service/Account parent-child model |
| Financial institution list becomes obsolete | Versioned data-driven registry |
| Secret leaks through history | Metadata-first history; encrypted value history only when explicitly designed |
| Silent auto-update destroys data | Proposed change + confirmation + history |
| Browser cannot open local folder | Copy Path guaranteed; Native Messaging later |
| Cloud token expires | Explicit account status + re-auth flow |
| Sync conflict | Version/updatedAt + conflict state before advanced resolution |
| Large data set slows Sidebar | Retrieval-focused compact cards + virtualization when needed |
| Mobile extension support varies | Treat mobile as responsive UI target, not universal extension guarantee |

---

## 22. Definition of Done

MVP is complete when:

- User can create Category → Format → Type → custom Fields.
- User can create one Service with multiple Accounts.
- Website/App cards show favicon and useful non-secret metadata.
- Standard credential fields are supported.
- Finance records support Bank/Wallet/Crypto templates.
- Institution selector is data-driven and extensible.
- Secrets are encrypted at rest and masked in UI.
- Generator can create supported secret types.
- History shows the latest 5 events with date/time.
- Sidebar and Full Dashboard share the same domain/data layer.
- Light/Dark/Auto works and persists.
- Quick Access resolves mapped folders by OS.
- Cloud supports multiple accounts and encrypted payloads.
- Automatic update proposes sensitive changes instead of silently overwriting them.
- Core tests pass.
- No Secret, OAuth token, master credential or sensitive payload appears in logs.

---

## 23. Developer Implementation Rules

1. **Do not hard-code UI around the initial examples.** Build schema-driven components.
2. **Do not model Service and Account as one flat Record.** They have different lifecycle and identity.
3. **Do not store secret values inside generic history objects.**
4. **Do not make the Financial Institution list a UI constant.** Use a registry.
5. **Do not let auto-update silently overwrite sensitive fields.**
6. **Do not couple Cloud Drive logic to a single provider.** Use adapters.
7. **Do not make Sidebar and Dashboard separate data implementations.** They must consume the same domain services.
8. **Do not assume browser support equals OS file-system access.** Keep Local Path capability isolated.
9. **Do not expose Secret values through search indexing, notification, error messages or analytics.**
10. **Prefer small, testable domain services over a single large store.**

---

## 24. Migration from v1

The existing MVP document already defines useful foundations for:

- Sidebar/Dashboard
- Theme
- Secret lifecycle
- AES-GCM encryption
- History metadata
- Multi-OS path mapping
- Cloud adapters
- testing and release gates

The v2 design should **extend rather than discard** those foundations.

Migration strategy:

```text
Existing DataRecord
       ↓
Migration Adapter
       ↓
Service
  + Account
  + typed Field Values
  + Secret Items
       ↓
New Schema-driven model
```

Keep backward compatibility at the storage adapter level until migration is verified.

---

## 25. Recommended Build Order

```text
Schema
  ↓
Service / Account
  ↓
Typed Fields
  ↓
Encrypted Storage
  ↓
Secret Lifecycle
  ↓
Cards / Sidebar / Dashboard
  ↓
Finance Registry
  ↓
Quick Access
  ↓
Cloud
  ↓
Automatic Update
  ↓
Hardening
```

This order deliberately puts the **data model before visual expansion**. The most important architectural change in v2 is not another screen; it is making the system capable of representing many kinds of data without rewriting the application every time a new data type is introduced.
