import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Data Hub Extension',
    description: 'Personal data manager browser extension with sidebar, dashboard, secrets, quick access, and encrypted cloud sync.',
    permissions: [
      'storage',
      'identity',
      'clipboardWrite',
    ],
    host_permissions: [
      'https://drive.google.com/*',
      'https://www.googleapis.com/*',
    ],
    icons: {
      '16': 'icon.png',
      '48': 'icon.png',
      '128': 'icon.png',
    },
  },
});
