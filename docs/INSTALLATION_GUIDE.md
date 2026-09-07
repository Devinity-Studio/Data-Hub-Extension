# Data Hub Extension - Installation Guide

## Overview

Data Hub Extension is a personal data manager browser extension built with Manifest V3, WXT, React, and TypeScript. It provides encrypted storage for secrets, quick access to file paths, and cloud synchronization capabilities.

## Table of Contents

1. [Features & Capabilities](#features--capabilities)
2. [Technical Stack](#technical-stack)
3. [Installation](#installation)
4. [Usage Guide](#usage-guide)
5. [Functions & How to Use Them](#functions--how-to-use-them)
6. [Security Features](#security-features)
7. [Development](#development)
8. [Building for Production](#building-for-production)

---

## Features & Capabilities

### 1. Secrets Management 🔐

**Description**: Securely store and manage passwords, API keys, tokens, and backup codes.

**Capabilities**:
- Add, edit, and delete secrets
- Categorize secrets by type (Password, API Key, Token, Backup Code)
- Track expiration dates with automatic status updates
- Encrypt all data locally using AES-256-GCM
- Copy values to clipboard with one click

**Functionality**:
| Function | Description |
|----------|-------------|
| Add Secret | Create new secret with label, type, and optional notes |
| View Value | Reveal encrypted value (decrypted on-the-fly) |
| Copy Value | Copy decrypted value to clipboard |
| Toggle Status | Activate/Revoke secret access |
| Set Expiration | Set expiration date for time-sensitive secrets |
| Filter Secrets | View all, active, expired, or revoked secrets |

### 2. Quick Access - Path Mappings 📁

**Description**: Store and quickly access file system paths for different operating systems.

**Capabilities**:
- Store paths for Windows, macOS, and Linux
- Automatically detect user's platform
- Show resolved path for current system
- Add, edit, and delete path mappings

**Functionality**:
| Function | Description |
|----------|-------------|
| Add Path | Create new path mapping with name and OS-specific paths |
| Auto-Resolve | Automatically shows correct path for current OS |
| Delete Path | Remove unwanted path mappings |
| Platform Display | Shows current platform (Win/Mac/Linux) |

### 3. Cloud Accounts ☁️

**Description**: Connect and manage cloud storage accounts for data synchronization.

**Capabilities**:
- Connect Google Drive, OneDrive, or Dropbox accounts
- Track connection status (Connected, Expired, Error)
- View last sync timestamp
- OAuth-based authentication

**Functionality**:
| Function | Description |
|----------|-------------|
| Connect Account | Initiate OAuth flow to connect cloud service |
| Disconnect | Remove cloud account connection |
| View Status | Check connection status and last sync time |
| Delete Account | Remove cloud account from extension |

### 4. Dashboard Overview

**Description**: Central hub showing all extension data and status.

**Capabilities**:
- Quick stats overview (paths count, secrets count, cloud accounts)
- Collapsible sections for easy navigation
- Security information display
- Quick action buttons

---

## Technical Stack

### Core Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| **WXT** | 0.21.x | Extension framework for Manifest V3 |
| **React** | 18.3.x | UI component library |
| **TypeScript** | 5.7+ | Type-safe JavaScript |
| **Tailwind CSS** | 3.4.x | Utility-first CSS framework |

### Infrastructure

- **Manifest V3**: Latest Chrome extension platform
- **Chrome Storage API**: Local data persistence
- **Web Crypto API**: AES-256-GCM encryption
- **Google Identity API**: OAuth 2.0 authentication (optional)

### Architecture

```
Data Hub Extension
├── Background Service Worker
│   └── Handles extension lifecycle events
├── Popup UI
│   ├── Sidebar View
│   │   ├── Overview
│   │   ├── Quick Access
│   │   ├── Secrets
│   │   └── Cloud Accounts
│   └── Dashboard View
│       ├── Stats Cards
│       ├── Collapsible Sections
│       └── Cloud Sync Status
└── Storage Layer
    ├── Chrome Storage (local)
    └── Web Crypto API (encryption)
```

---

## Installation

### Prerequisites

- Google Chrome browser (version 110+)
- Node.js (version 18+)
-npm or yarn package manager

### Method 1: Load Unpacked Extension (Development)

1. **Clone or download the project**
   ```bash
   git clone <repository-url>
   cd data-hub-extension
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the extension**
   ```bash
   npm run build
   ```

4. **Load in Chrome**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right corner)
   - Click "Load unpacked"
   - Select the `.output/chrome-mv3/` directory
   - The extension icon should appear in your toolbar

5. **Pin the extension** (optional)
   - Click the puzzle piece icon in Chrome toolbar
   - Click the pin icon next to "Data Hub"

### Method 2: Run in Development Mode

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Start development server**
   ```bash
   npm run dev
   ```

3. **Load unpacked extension**
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select `.output/chrome-mv3-dev/`
   - The extension will auto-reload on code changes

### Method 3: Install from ZIP (Distribution)

1. **Build the extension**
   ```bash
   npm run build:zip
   ```

2. **Install the ZIP**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" (not "Upload" - Chrome doesn't support direct ZIP install for dev)
   - Alternatively, extract the ZIP and load the folder

---

## Usage Guide

### First Launch

1. Click the Data Hub extension icon in your toolbar
2. The popup will open showing the dashboard
3. You can switch between **Sidebar** and **Dashboard** layout using the toggle button

### Managing Secrets

1. Click the 🔐 **Secrets** tab (sidebar) or section (dashboard)
2. Click "Add Secret" button
3. Fill in:
   - **Label**: Name of the secret (e.g., "GitHub Password")
   - **Type**: Password, API Key, Token, or Backup Code
   - **Notes**: Optional description
   - **Status**: Active or Expired
4. Click "Save"
5. To view/copy value:
   - Click "Reveal value"
   - Click "Copy" to copy to clipboard

### Setting Up Quick Access Paths

1. Click the 📁 **Quick Access** tab
2. Click "Add Path" button
3. Fill in:
   - **Name**: Descriptive name (e.g., "Projects Folder")
   - **Windows Path**: Path for Windows (e.g., `C:\Users\Name\Projects`)
   - **Linux Path**: Path for Linux (e.g., `/home/name/projects`)
   - **macOS Path**: Path for macOS (e.g., `/Users/name/projects`)
4. Click "Save"
5. The extension will automatically show the correct path for your OS

### Connecting Cloud Accounts

1. Click the ☁️ **Cloud Accounts** tab
2. Click "Add Account" or "Connect Google Drive" button
3. Complete the OAuth flow in the popup window
4. Once connected, you'll see:
   - Account name
   - Connected status
   - Last sync timestamp

---

## Functions & How to Use Them

### Theme Toggle

**Function**: Switch between Light, Dark, and Auto themes

**How to use**:
1. In the header, click the theme button
2. Cycle through: Light → Dark → Auto → Light
3. "Auto" follows system preference

**Technical**: Uses CSS custom properties and `data-theme` attribute on `<html>`

### Layout Toggle

**Function**: Switch between Sidebar and Dashboard layouts

**How to use**:
1. In the header, click the layout button
2. Choose "Sidebar" for narrow navigation panel
3. Choose "Dashboard" for full-width card layout

**Technical**: State is persisted in Chrome storage under `layoutSettings`

### Secret Encryption

**Function**: All secret values are encrypted before storage

**How it works**:
1. On first use, a master key is generated using `crypto.subtle.generateKey()`
2. The key is exported and stored in Chrome storage
3. Each secret value is encrypted with AES-256-GCM
4. A unique IV (Initialization Vector) is generated for each encryption
5. Both ciphertext and IV are stored; only you can decrypt

**Security**: Even if someone accesses your Chrome storage, they cannot read your secrets without the master key stored in your browser profile.

### Platform Detection

**Function**: Automatically shows the correct file path for your OS

**How it works**:
1. Uses `navigator.platform` to detect OS
2. Maps: `Win32` → Windows path, `MacIntel/MacARM` → macOS path, others → Linux path
3. Displays the resolved path with platform indicator

---

## Security Features

### 🔒 Encryption

- **Algorithm**: AES-256-GCM (Authenticated Encryption)
- **Key Generation**: Cryptographically secure random key
- **Storage**: Key stored in Chrome local storage
- **Per-value IV**: Unique initialization vector for each encryption

### 🔐 Data Protection

- All secrets encrypted before storage
- No data leaves your browser without explicit consent
- Cloud sync (when implemented) would require encryption first

### 🛡️ Privacy

- No telemetry or analytics
- No external data collection
- All data stays in your browser

---

## Development

### Project Structure

```
data-hub-extension/
├── src/
│   ├── App.tsx              # Main React component
│   ├── styles.css           # Global styles + Tailwind
│   ├── components/
│   │   ├── SidebarView.tsx  # Sidebar navigation
│   │   ├── DashboardView.tsx# Dashboard layout
│   │   ├── QuickAccess.tsx  # Path mappings
│   │   ├── Secrets.tsx      # Secrets management
│   │   └── CloudAccounts.tsx# Cloud accounts
│   ├── lib/
│   │   ├── cloud/           # Cloud integration
│   │   ├── crypto/          # Encryption utilities
│   │   ├── secret/          # Secret types & storage
│   │   └── ...
│   ├── stores/              # State management
│   └── types/               # TypeScript types
├── entrypoints/
│   ├── background.ts        # Service worker
│   └── popup/
│       ├── index.html       # Popup HTML
│       └── main.tsx         # React entry point
├── wxt.config.ts            # WXT configuration
├── tailwind.config.mjs      # Tailwind configuration
└── package.json             # Dependencies
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build production extension |
| `npm run build:zip` | Build and create ZIP file |
| `npm run preview` | Preview the built extension |

### Environment Setup

1. Install Node.js 18+
2. Run `npm install`
3. Start coding with `npm run dev`

---

## Building for Production

### Standard Build

```bash
npm run build
```

Output: `.output/chrome-mv3/`

### Build with ZIP

```bash
npm run build:zip
```

Output: `.output/*.zip`

### Test Before Distribution

1. Build: `npm run build`
2. Load unpacked extension from `.output/chrome-mv3/`
3. Test all features thoroughly
4. Check browser console for errors
5. Submit to Chrome Web Store (requires developer account)

---

## Troubleshooting

### Extension Not Loading

- Check Chrome version (110+ required)
- Ensure Developer Mode is enabled
- Verify you're loading the correct directory
- Check Chrome console for errors (F12 → Console)

### Secrets Not Decrypting

- Ensure you're using the same browser profile
- Clear Chrome storage if key was lost (secrets will be lost)
- Check that `chrome.storage.local` is not cleared

### Cloud OAuth Not Working

- Register your extension ID in Google Cloud Console
- Set correct redirect URIs
- Ensure `identity` permission is in manifest

---

## Support & Contribution

For issues, feature requests, or contributions, please refer to the project repository.

---

**Data Hub Extension** - Your data, your control, your encryption.
