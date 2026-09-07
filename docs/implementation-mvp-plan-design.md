# Universal Data Manager Extension
## Implementation MVP Plan & Design

> เอกสารฉบับนี้กำหนดขอบเขต MVP, สถาปัตยกรรม, Data Model และเกณฑ์รับมอบสำหรับ Browser Extension จัดการข้อมูลส่วนตัวและข้อมูลสำหรับงานพัฒนา

- **สถานะ:** Draft สำหรับเริ่มพัฒนา
- **ขอบเขต:** Browser Extension แบบ Manifest V3
- **เป้าหมายหลัก:** เข้าถึงข้อมูลเร็ว, รองรับ Sidebar และ Dashboard, ปกป้อง Secret และเชื่อมต่อแหล่งข้อมูลหลายระบบ

## 1. เป้าหมายและขอบเขต MVP

### เป้าหมาย

1. จัดเก็บข้อมูลแบบ Custom Fields ได้ตามหมวดหมู่
2. สลับ Sidebar Mode และ Full Dashboard Mode ได้ทันที
3. รองรับ Light, Dark และ Auto Theme โดยไม่ Refresh หน้า
4. เปิดใช้ Quick Access สำหรับ Local Path แบบ Multi-OS
5. รองรับ Backup Code และ API Key หลายรายการต่อ Record
6. กำหนดวันหมดอายุและสถานะของแต่ละ Code/Key ได้
7. เชื่อมต่อ Cloud Drive หลาย Provider และหลาย Account/Profile
8. เข้ารหัสข้อมูลลับก่อนจัดเก็บหรือ Sync ขึ้น Cloud

### รวมใน MVP

- Layout State Persistence
- Theme State Persistence
- Search, One-click Copy และ Masked Secret
- Custom Key-Value Fields
- Backup Code และ API Key Secret Items
- Expiration, Status, Revoke และ Last Used
- History การแก้ไขล่าสุด 5 รายการต่อ Record
- Password/API Key Generator
- Multi-OS Path Mapping
- Cloud Account Manager และ OAuth2
- Sync Status, Error State และ Re-authentication

### ไม่รวมใน MVP

- Real-time collaboration
- การเปิดหรือแก้ไข Local Folder โดยตรงที่รับประกันได้ทุก Browser/OS
- Conflict Resolution แบบอัตโนมัติขั้นสูง
- Mobile Extension UI
- Server-side search บนข้อมูลที่เข้ารหัส

## 2. Technical Architecture

```text
Extension UI
├── Sidebar View
├── Dashboard View
├── Settings View
└── Cloud Account Manager

Application Services
├── Layout Store
├── Theme Store
├── Record Store
├── Secret Item Service
├── Quick Access Service
├── Cloud Account Service
├── Sync Service
└── Encryption Service

Persistence
├── chrome.storage.local       # ข้อมูลและ Secret ที่เข้ารหัสแล้ว
├── chrome.storage.sync        # เฉพาะค่าตั้งค่าที่ไม่ลับ หากเหมาะสม
└── Cloud Drive APIs            # Ciphertext และ metadata ที่จำเป็น
```

### เทคโนโลยีแนะนำ

- Manifest V3
- React + TypeScript
- Tailwind CSS หรือ CSS Variables
- CSS Container Queries สำหรับ Responsive UI
- Lucide Icons
- `chrome.storage.local`
- Web Crypto API ด้วย AES-GCM
- OAuth2 ผ่าน Identity API หรือ Provider OAuth Flow

## 3. Layout Adaptive System

### Sidebar Mode

เหมาะกับ Browser Sidebar หรือพื้นที่แคบ:

- แสดง Quick Access เป็นรายการแนวตั้ง
- มี Search และ Copy Action ที่เข้าถึงได้ทันที
- การ์ดข้อมูลใช้ 1 คอลัมน์และแสดงเฉพาะข้อมูลสำคัญ
- Secret แสดงเป็น Masked Value โดยค่าเริ่มต้น
- แสดงปุ่มขยายเป็น Dashboard ที่ Header
- ซ่อนสถิติและตารางที่ไม่จำเป็นต่อการเข้าถึงเร็ว

### Full Dashboard Mode

เหมาะกับพื้นที่เต็มหน้าจอ:

- แสดง Summary Statistics
- แสดง History 5 รายการล่าสุด
- แสดงข้อมูลแบบ Grid หรือ Table
- แสดง Cloud Accounts, Sync Status และ OS Path Mappings
- แสดงรายละเอียด Secret Items, Expiration และ Status Filter
- ใช้ 2-3 คอลัมน์ตามพื้นที่จริงของ Container

### Layout State

```ts
type LayoutMode = "sidebar" | "dashboard";

type LayoutSettings = {
  mode: LayoutMode;
  updatedAt: number;
};
```

เมื่อผู้ใช้เปลี่ยนโหมด ให้บันทึก `layoutSettings` และกู้คืนเมื่อเปิด Extension ครั้งถัดไป

## 4. Theme System

รองรับ 3 โหมด:

```ts
type ThemeMode = "light" | "dark" | "auto";
```

- `light`: ใช้โทนพื้นขาวและเทาอ่อน พร้อม Accent สีเข้ม
- `dark`: ใช้ Deep Gray/Black พร้อม Accent สีสว่าง
- `auto`: ใช้ `prefers-color-scheme` และติดตามการเปลี่ยนแปลงของระบบ
- ปุ่ม Sun/Moon หรือ Theme Menu ต้องอยู่ใน Header ทุกโหมด
- เปลี่ยน CSS Variables แบบ Real-time โดยไม่ Refresh หน้า
- Transition จำกัดเฉพาะสีและพื้นผิวเพื่อไม่กระทบ Accessibility

ตัวอย่าง Design Tokens:

```css
:root {
  --color-bg: #f6f7f9;
  --color-surface: #ffffff;
  --color-text: #17202a;
  --color-muted: #687382;
  --color-border: #dce1e7;
  --color-accent: #1769e0;
  --color-danger: #c62828;
  --color-warning: #9a6700;
}

[data-theme="dark"] {
  --color-bg: #101216;
  --color-surface: #191c22;
  --color-text: #f4f7fb;
  --color-muted: #9ca8b8;
  --color-border: #303641;
  --color-accent: #b8ff35;
  --color-danger: #ff7b72;
  --color-warning: #f2cc60;
}
```

## 5. Responsive Card Rules

| Context | Columns | Card Behavior |
|---|---:|---|
| Sidebar | 1 | Compact row, title, status และ Copy |
| Dashboard ขนาดเล็ก | 1-2 | Card พร้อม metadata ที่จำเป็น |
| Dashboard ขนาดใหญ่ | 3 | แสดงรายละเอียด, Secret count และ expiration summary |

ให้ใช้ Container Queries เพื่อให้ Component ตัดสินใจจากพื้นที่จริงของตัวเอง ไม่ยึดเฉพาะ viewport width

## 6. Core Data Model

```ts
type RecordCategory = "credential" | "project" | "finance" | "custom";

type DataRecord = {
  id: string;
  title: string;
  category: RecordCategory;
  fields: Record<string, string>;
  secretItems: SecretItem[];
  createdAt: number;
  updatedAt: number;
};

type SecretType = "backup-code" | "api-key" | "password" | "token";
type SecretStatus = "active" | "expired" | "revoked";

type SecretItem = {
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
};
```

## 7. Backup Code และ API Key แบบหลายรายการ

### ความสามารถ

- Record หนึ่งรายการมี Backup Code หรือ API Key ได้มากกว่า 1 รายการ
- กำหนด `label` เพื่อแยกชุดหรือวัตถุประสงค์ เช่น `Primary`, `Recovery`, `Production`, `Staging`
- กำหนดวันหมดอายุเป็นราย Code/Key ได้ หรือปล่อยให้ไม่มีวันหมดอายุเมื่อระบบภายนอกไม่กำหนด
- เปลี่ยนสถานะเป็น Active หรือ Revoked ด้วยตนเอง
- ระบบคำนวณ Expired เมื่อ `expiresAt` ผ่านเวลาปัจจุบัน
- รายการ Revoked ต้องไม่สามารถ Copy หรือใช้เป็น Active Credential ได้
- บันทึก `lastUsedAt` เมื่อผู้ใช้ Copy หรือ Mark as Used ตามกติกาที่ทีมกำหนด
- รองรับการสร้างชุดใหม่และเพิกถอนชุดเก่าเมื่อ Rotation
- แสดงจำนวน Active, Expiring Soon, Expired และ Revoked บน Dashboard

### สถานะและกติกา

| สถานะ | เงื่อนไข | Copy ได้หรือไม่ |
|---|---|---|
| `active` | ยังไม่หมดอายุและไม่ถูกเพิกถอน | ได้ หลังยืนยันตัวตน/การเปิดเผย |
| `expired` | `expiresAt` น้อยกว่าหรือเท่ากับเวลาปัจจุบัน | ไม่ควรให้ Copy โดยค่าเริ่มต้น |
| `revoked` | ผู้ใช้เพิกถอนหรือระบบภายนอกยกเลิก | ไม่ได้ |

ลำดับความสำคัญของสถานะคือ `revoked` มาก่อน `expired` และ `active` เพื่อป้องกันการนำ Secret ที่ถูกเพิกถอนไปใช้

### Expiration UX

- เพิ่มตัวกรอง `All`, `Active`, `Expiring Soon`, `Expired`, `Revoked`
- แสดง Warning เมื่อใกล้หมดอายุ เช่น ภายใน 7 หรือ 30 วัน โดยกำหนดค่าได้
- แสดงวันหมดอายุในรูปแบบที่อ่านง่ายและเก็บ timestamp แบบ UTC
- แจ้งเตือนโดยไม่เปิดเผยค่า Secret
- ให้ผู้ใช้ต่ออายุ, สร้างรายการใหม่ หรือ Revoke รายการเดิม

### Secret Visibility

- ค่าเริ่มต้นเป็น Masked Value
- ต้องยืนยันก่อน Reveal หรือ Copy
- รองรับ Auto-hide หลังเวลาที่กำหนด
- ไม่แสดงค่าเต็มใน Notification, Search Result, History หรือ Error Log
- ปุ่ม Copy ควรใช้ Icon พร้อม Tooltip และมีสถานะสำเร็จ/ล้มเหลวที่ชัดเจน

## 8. History และ Audit Metadata

ระบบเก็บประวัติการแก้ไขล่าสุด 5 รายการต่อ Record:

```ts
type HistoryEntry = {
  id: string;
  recordId: string;
  action: "created" | "updated" | "copied" | "revoked" | "restored";
  changedFields: string[];
  secretItemId?: string;
  createdAt: number;
};
```

- เก็บเฉพาะ metadata และชื่อ Field ที่เปลี่ยน
- ห้ามเก็บ `encryptedValue` หรือ Plain Text Secret ซ้ำใน History โดยไม่จำเป็น
- การ Restore ต้องสร้าง History Entry ใหม่
- การ Copy Secret ให้บันทึกได้เฉพาะ metadata หากผู้ใช้เปิด Audit Logging

## 9. Multi-OS Quick Access

```ts
type OsPathMapping = {
  id: string;
  name: string;
  windowsPath?: string;
  linuxPath?: string;
  macosPath?: string;
  createdAt: number;
  updatedAt: number;
};
```

ตัวอย่าง:

```text
ชื่อ: Work Projects
Windows: D:\Work\Projects
Linux:   /mnt/data/Work/Projects
```

แนวทาง MVP:

1. ตรวจ OS ปัจจุบันก่อนเลือก Path
2. Copy Path ได้ในคลิกเดียว
3. พยายามเปิด `file://` เฉพาะเมื่อ Browser อนุญาต
4. แสดงข้อความผิดพลาดที่นำไปแก้ไขได้เมื่อเปิด Folder ไม่สำเร็จ
5. เก็บ Root Mapping เป็น Configuration แยกจาก Secret

Browser Extension ไม่สามารถรับประกันการเปิด Local Folder โดยตรงได้ทุก Browser/OS หากต้องการความสามารถนี้อย่างเต็มรูปแบบ ให้พิจารณา Native Messaging Host ใน Phase ถัดไป

## 10. Cloud Drive Integration

### Provider เป้าหมาย

- Google Drive
- OneDrive
- Dropbox

### Account Model

```ts
type CloudAccount = {
  id: string;
  provider: "google-drive" | "onedrive" | "dropbox";
  displayName: string;
  email?: string;
  profileName?: string;
  status: "connected" | "expired" | "error";
  lastSyncAt?: number;
};
```

### ความสามารถ MVP

- เชื่อมต่อหลาย Account ต่อ Provider ได้
- ตั้งชื่อ Profile ได้
- เลือก Active Account ได้
- แสดงสถานะ Connected, Expired, Error และ Syncing
- Disconnect และ Re-authenticate ได้
- Upload/Download เฉพาะข้อมูลที่เข้ารหัสแล้ว
- แสดง Sync Error โดยไม่เปิดเผย Token หรือ Secret

### OAuth และ Permission

- ขอ Scope เท่าที่จำเป็น
- ไม่เก็บ OAuth Client Secret ใน Extension
- จัดการ Token Expiration และ Re-authentication
- ไม่บันทึก Access Token ใน Log
- แยก Cloud Account Metadata ออกจากข้อมูลลับ

## 11. Storage และ Security

```text
chrome.storage.local
├── themeSettings
├── layoutSettings
├── pathMappings
├── encryptedRecords
├── historyMetadata
└── cloudAccountMetadata
```

- `chrome.storage.local` ไม่ใช่ E2EE โดยตัวมันเอง ต้องเข้ารหัสก่อนจัดเก็บ
- ใช้ Web Crypto API และ AES-GCM
- เก็บ IV แยกจาก Ciphertext และใช้ IV ใหม่ทุกครั้งที่เข้ารหัส
- ไม่เก็บ Master Password แบบ Plain Text
- หลีกเลี่ยงการแสดง Secret ใน Console, Error, Notification และ Analytics
- กำหนด Clear Clipboard หลัง Copy ได้ตามนโยบายความปลอดภัย
- Cloud ต้องเห็นเฉพาะ Ciphertext และ metadata ที่จำเป็น

## 12. Storage Persistence

ค่าที่ต้องจำข้าม Session:

- `themeSettings.mode`
- `layoutSettings.mode`
- Path Mapping
- Cloud Account Metadata
- Encrypted Records
- History Metadata

ควรใช้ `chrome.storage.local` สำหรับข้อมูลของผู้ใช้รายนั้น และใช้ `chrome.storage.sync` เฉพาะค่าตั้งค่าที่ไม่ลับเมื่อเหมาะสมกับ Quota และ Privacy Model

## 13. Development Roadmap

แผนนี้เรียงตาม dependency โดยให้ Local-first Core Data ใช้งานได้ก่อนเริ่ม Cloud Integration เพื่อลดความเสี่ยงและทำให้ทดสอบ Secret Flow ได้โดยไม่ต้องรอ OAuth

### Milestone 0: Product Contract และ Technical Spike

**ลำดับงาน**

1. ยืนยัน Support Matrix ของ Browser และรูปแบบการเปิด Sidebar/Dashboard
2. ยืนยัน Data Model ของ `DataRecord`, `SecretItem`, History และ Path Mapping
3. กำหนด Security Boundary: สิ่งที่เข้ารหัส, สิ่งที่เก็บเป็น metadata และสิ่งที่ห้ามเขียนลง Log
4. ทดสอบความเป็นไปได้ของ `chrome.storage.local`, Web Crypto API และ OAuth Provider แรก
5. กำหนด Definition of Done และ Test Strategy ก่อนเริ่ม Feature Development

**ผลส่งมอบ:** Technical Decision Record, Data Contract, Support Matrix และ Risk Register

**Gate:** ทีมเห็นชอบ Data Model และยืนยันว่า Secret ไม่ถูกเก็บแบบ Plain Text

### Milestone 1: Extension Foundation และ UI Shell

**ลำดับงาน**

1. สร้าง Manifest V3, React และ TypeScript
2. สร้าง Application Shell, Header และ Navigation
3. สร้าง Sidebar/Dashboard Layout ที่ใช้ Component ร่วมกัน
4. เพิ่ม Design Tokens, Responsive Card และ Container Queries
5. เพิ่ม Light/Dark/Auto Theme และ Theme Toggle
6. เพิ่ม Layout Toggle ระหว่าง Sidebar และ Dashboard
7. บันทึกและกู้คืน Theme/Layout State

**ผลส่งมอบ:** ผู้ใช้เปิด Extension, สลับ Layout/Theme และปิดเปิดใหม่โดย State ยังอยู่

**Gate:** Layout ไม่ล้นในพื้นที่ Sidebar, Theme ไม่ต้อง Refresh และมี Keyboard Focus ที่ใช้งานได้

### Milestone 2: Local Data และ Secret Lifecycle

**ลำดับงาน**

1. สร้าง Storage Adapter สำหรับ `chrome.storage.local`
2. สร้าง CRUD ของ Data Record และ Custom Fields
3. เพิ่ม Backup Code/API Key หลายรายการต่อ Record
4. เพิ่ม Web Crypto Service และเข้ารหัสก่อน Save
5. เพิ่ม Mask, Reveal และ Confirm-before-Copy
6. เพิ่ม Expiration และ Status Resolver
7. เพิ่ม Revoke, Rotation และ Last Used Tracking
8. เพิ่ม History 5 รายการและ Redacted Audit Metadata

**ผลส่งมอบ:** Local-first MVP ที่จัดเก็บ, ค้นหา, Copy, Expire และ Revoke Secret ได้โดยไม่ต้องมี Cloud

**Gate:** Unit/Integration Tests ผ่าน, Revoked Secret Copy ไม่ได้ และไม่มี Plain Text Secret ใน Storage/Log

### Milestone 3: Quick Access และ Usability

**ลำดับงาน**

1. เพิ่ม Multi-OS Path Mapping สำหรับ Windows/Linux
2. เพิ่ม OS Detection และ Path Resolver
3. เพิ่ม Quick Access List ใน Sidebar
4. เพิ่ม Copy Path แบบ One-click
5. ทดลองเปิด Local Folder ตามความสามารถของ Browser
6. เพิ่ม Empty, Error และ Invalid Mapping States

**ผลส่งมอบ:** ผู้ใช้เข้าถึง Path ที่ตั้งค่าไว้ได้จาก Sidebar โดยเลือก Path ตาม OS อัตโนมัติ

**Gate:** Path ที่ไม่ถูกต้องไม่ทำให้ UI ล่ม และผู้ใช้ยัง Copy Path ได้แม้ Browser เปิด Folder ไม่ได้

### Milestone 4: Dashboard และ Operational Views

**ลำดับงาน**

1. เพิ่ม Summary Statistics
2. เพิ่ม Secret Status Filter และ Expiring Soon View
3. เพิ่ม History 5 รายการล่าสุด
4. เพิ่ม Table/Grid สำหรับข้อมูลจำนวนมาก
5. เพิ่ม Generator สำหรับ Password/API Key
6. เพิ่ม Restore และ Rotation Workflow ให้ครบใน Dashboard

**ผลส่งมอบ:** Full Dashboard สำหรับตรวจสถานะข้อมูล, Secret และประวัติการแก้ไข

**Gate:** Dashboard แสดงข้อมูลจำนวนมากได้โดยไม่ทำให้ Sidebar Flow ซับซ้อน และทุก Action มี Loading/Success/Error State

### Milestone 5: Cloud Integration

เริ่มจาก Provider เดียวก่อน แล้วจึงขยายไป Provider อื่นหลัง Sync Contract เสถียร

**ลำดับงาน**

1. สร้าง Cloud Adapter Interface ที่ไม่ผูกกับ Provider ใด Provider หนึ่ง
2. ทำ OAuth2 และ Account Manager สำหรับ Provider แรก
3. เพิ่มหลาย Account/Profile และ Active Account Selection
4. เพิ่ม Token Expiration และ Re-authentication
5. เข้ารหัส Payload ก่อน Upload และถอดรหัสหลัง Download
6. เพิ่ม Sync Status, Retry และ Error State
7. เพิ่ม Conflict Detection ด้วย `updatedAt`
8. เพิ่ม Provider ถัดไปตามลำดับความสำคัญของผู้ใช้

**ผลส่งมอบ:** Sync ข้อมูลที่เข้ารหัสแล้วกับ Cloud อย่างน้อย 1 Provider และหลาย Account

**Gate:** OAuth Token ไม่ปรากฏใน Log, Cloud ได้รับเฉพาะ Ciphertext และการ Disconnect ไม่ทำให้ข้อมูล Local หาย

### Milestone 6: Hardening, Release และการดูแลหลังเปิดใช้

**ลำดับงาน**

1. ทำ Security Review และตรวจ Permission ให้เหลือเท่าที่จำเป็น
2. ทดสอบ Secret Leakage ใน UI, Log, Clipboard และ Cloud Payload
3. เพิ่ม Backup/Restore และ Quota Monitoring
4. ทำ Accessibility Test และ Cross-browser Test
5. ทดสอบ Migration เมื่อ Data Model เปลี่ยน Version
6. จัดทำ Release Checklist, Privacy Notes และ Known Limitations
7. เปิดใช้แบบจำกัดกลุ่มผู้ใช้และเก็บ Feedback ก่อนขยายการใช้งาน

**ผลส่งมอบ:** Release Candidate พร้อมเอกสารความปลอดภัย, Test Report และแผน Rollback

**Gate:** ผ่าน Definition of Done, ไม่มี Critical Security Issue และมีวิธี Backup/Restore ที่ทดสอบแล้ว

### ลำดับ Sprint แนะนำ

| Sprint | เป้าหมาย | ผลลัพธ์หลัก |
|---|---|---|
| Sprint 0 | Contract และ Spike | Data Model, Security Boundary, Support Matrix |
| Sprint 1 | Foundation | Extension Shell, Layout, Theme, Persistence |
| Sprint 2 | Core Data | Record, Custom Fields, Local Storage |
| Sprint 3 | Secret Lifecycle | Multi Secret, Encryption, Expiration, Revoke, History |
| Sprint 4 | Quick Access | Multi-OS Mapping, Resolver, Copy Path |
| Sprint 5 | Dashboard | Statistics, Filters, Generator, Restore |
| Sprint 6 | Cloud Provider แรก | OAuth2, Multi-account, Encrypted Sync |
| Sprint 7 | Hardening และ Release | Security, Accessibility, Backup, Release Candidate |

### งานที่ทำคู่ขนานได้

- เขียน Unit Tests ของ Data Model ระหว่างพัฒนา UI Shell
- ทำ Design Tokens และ Accessibility Review ระหว่าง Foundation
- ทำ Cloud Adapter Interface ระหว่าง Core Data โดยยังไม่เปิด OAuth จริง
- เตรียม Test Fixtures สำหรับ Expiration, Revoke และ Rotation ก่อนสร้างหน้าจอ Dashboard

### งานที่ไม่ควรเริ่มก่อน

- อย่าเริ่ม Multi-provider Cloud ก่อน Sync Contract และ Encryption Format เสถียร
- อย่าเพิ่ม Native Messaging ก่อนพิสูจน์ว่า Copy Path เพียงพอสำหรับ MVP
- อย่าเพิ่ม Advanced Conflict Resolution ก่อนมี Sync Status และ Conflict Detection พื้นฐาน
- อย่าเพิ่มข้อมูลประเภทใหม่ก่อน `SecretItem` และ Status Resolver ผ่าน Security Tests

## 14. Acceptance Criteria

### Layout และ Theme

- สลับ Sidebar และ Dashboard ได้โดยไม่สูญเสียข้อมูล
- เปิด Extension ใหม่แล้วใช้ Layout ล่าสุด
- Sidebar ใช้ 1 คอลัมน์ และ Dashboard ปรับเป็นหลายคอลัมน์ตามพื้นที่
- สลับ Light, Dark และ Auto ได้โดยไม่ Refresh
- ปุ่ม Theme อยู่ใน Header ทุกโหมด
- Contrast ผ่าน WCAG AA ในสถานะปกติและ Error/Warning

### Secret Items

- Record เดียวมี Backup Code และ API Key ได้หลายรายการ
- แต่ละรายการกำหนด Expiration และ Status แยกกันได้
- ระบบคำนวณ Expired อัตโนมัติ
- Revoked Secret ไม่สามารถ Copy ได้
- ค่า Secret Masked เป็นค่าเริ่มต้น
- History และ Log ไม่เก็บ Secret แบบ Plain Text
- มี Filter และ Warning สำหรับ Expiring Soon

### Quick Access และ Cloud

- สร้างและแก้ไข Path Mapping ของ Windows/Linux ได้
- Copy Path ได้ในคลิกเดียว
- เชื่อมต่อ Cloud ได้อย่างน้อย 1 Provider และมากกว่า 1 Account
- สลับ Active Account ได้
- แสดง Sync Status และจัดการ Token Expiration ได้
- Cloud ไม่ได้รับข้อมูลลับแบบ Plain Text

## 15. Testing Plan

- Unit Test: Theme Store, Layout Store, Path Resolver, Status Resolver
- Unit Test: Expiration, Rotation, Revoke และ Secret Visibility
- Component Test: Theme Toggle, Layout Toggle, Secret List, Filter, Copy Action
- Integration Test: `chrome.storage.local` และ Restore State
- OAuth Test: Connect, Expire, Re-authenticate และ Disconnect
- Security Test: Plain Text Secret Leakage, Log Redaction และ Clipboard Handling
- Responsive Test: Sidebar, Desktop Dashboard และ Container Width
- Accessibility Test: Keyboard Navigation, Focus State และ Contrast
- Cross-browser Test: Chromium-based browsers ที่อยู่ใน Support Matrix

## 16. Risks และ Mitigations

| Risk | Mitigation |
|---|---|
| Browser จำกัดการเปิด Local Folder | เริ่มจาก Copy Path และวางแผน Native Messaging ภายหลัง |
| OAuth Token หมดอายุ | ตรวจ Expiration และแสดง Re-authentication State |
| Cloud Sync Conflict | ใช้ `updatedAt`, แสดง Conflict และให้ผู้ใช้เลือกใน MVP |
| Secret รั่วจาก Log | Redact Sensitive Fields ทุกชั้น |
| Storage Quota เต็ม | แสดง Quota Warning และมี Export/Backup |
| Expired Key ถูกใช้งาน | ตรวจ Status ก่อน Reveal/Copy และ Default เป็น Block |
| ผู้ใช้ลืม Revoke Key เก่า | มี Rotation Flow และแสดงรายการเก่าที่ Active |
| Auto Theme ไม่ตรงกับระบบ | ใช้ `matchMedia` พร้อม change listener |

## 17. Definition of Done

- รองรับ Sidebar และ Full Dashboard บน Browser ที่อยู่ใน Support Matrix
- Theme และ Layout ถูกจำข้าม Session
- Responsive Cards ปรับตามพื้นที่ Container
- Backup Code/API Key รองรับหลายรายการต่อ Record
- ทุก Secret Item รองรับ Expiration, Status และ Revoke
- Secret ถูก Mask และเข้ารหัสก่อนจัดเก็บ
- History เก็บได้ไม่เกิน 5 รายการต่อ Record โดยไม่เก็บค่า Secret ซ้ำ
- Multi-OS Path Mapping รองรับ Windows และ Linux
- Cloud รองรับอย่างน้อย 1 Provider และหลาย Account
- มี Unit, Integration, Security และ Accessibility Tests สำหรับ Core Flow
- ไม่มี Secret, OAuth Token หรือ Master Password ใน Source Code และ Log
