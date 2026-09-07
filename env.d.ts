/// <reference types="wxt" />
/// <reference types="@wxt-dev/module-react/client" />

declare global {
  interface Window {
    chrome: typeof chrome;
  }
}

export {};
