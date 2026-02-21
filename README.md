# PassKey Wallet

A secure, local-first password manager built with Electron. It detects the active browser tab via a browser extension and shows a credential overlay with a global keyboard shortcut.

---

## Features

- 🔐 Encrypted SQLite vault (`better-sqlite3-multiple-ciphers` + Argon2 key derivation)
- 🧩 Browser extension for Chrome/Edge/Brave and Firefox with automatic URL detection
- ⚡ Global shortcut `Ctrl+Alt+P` — shows matching credentials for the current tab
- 🔄 Automated native messaging host installation on first launch
- 💾 Backup and restore via encrypted `.qpass` files
- 🔒 Auto-lock after configurable idle time
- 🎨 Dark glassmorphism UI

---

## Architecture

```
Electron App (Main Process)
├── src/main/index.js          — App entry, IPC handlers, global shortcut
├── src/main/urlServer.js      — Unix socket server (receives URLs from native host)
├── src/main/urlDetector.js    — Detects active browser URL (extension > title fallback)
├── src/main/autoInstaller.js  — Auto-installs native messaging manifests on first run
└── src/render/                — Dashboard, login, overlay, browser-setup UI

Browser Extension
├── browser-extension/chromium/ — Manifest V3, chrome.* APIs
├── browser-extension/firefox/  — Manifest V2, browser.* APIs + consent flow
└── browser-extension/native-host.js — Bridges extension ↔ Electron via Unix socket

Native Messaging Pipeline
  Chrome/Firefox Extension
    → chrome.runtime.connectNative()
    → native-host binary (stdin/stdout)
    → /tmp/passkey-wallet.sock
    → Electron URL Server
    → Credential overlay shown
```

---

## Development Setup

### Prerequisites

- Node.js 18+
- npm

### Install dependencies

```bash
npm install
```

### Run in development

```bash
npm run dev
```

On first launch the app auto-installs the native messaging host for all detected browsers (Chrome, Edge, Brave, Firefox).

### Build

```bash
npm run build
```

Produces installers in `dist_app/` (`.AppImage` + `.deb` on Linux, `.exe` on Windows, `.dmg` on macOS).

---

## Browser Extension Setup

### Chrome / Edge / Brave

1. Open `chrome://extensions` → enable **Developer mode**
2. Click **Load unpacked** → select `browser-extension/chromium/`
3. Press `Ctrl+Alt+P` while on any site to see detected credentials

### Firefox

1. Open `about:debugging` → **This Firefox** → **Load Temporary Add-on**
2. Select `browser-extension/firefox/manifest.json`
3. Accept the data consent prompt that opens automatically
4. For production: submit to [addons.mozilla.org](https://addons.mozilla.org)

> **Note:** Firefox native messaging requires the permanent extension ID set in `browser_specific_settings.gecko.id`. The auto-installer uses `passkey-wallet@passkey-wallet.com`.

---

## How Credential Detection Works

1. The browser extension sends the current tab URL to the native host binary via native messaging
2. The native host binary forwards it to the Electron app over a Unix socket (`/tmp/passkey-wallet.sock`)
3. When `Ctrl+Alt+P` is pressed, the app matches the hostname against stored credentials
4. The floating overlay shows matching usernames/passwords

If no URL is received from the extension (e.g. Firefox without native messaging), the app falls back to parsing the window title.

---

## Security

- All credentials encrypted at rest with AES-256 via `better-sqlite3-multiple-ciphers`
- Master password never stored — Argon2 key derived on each unlock
- Extension communicates only over `localhost` / native messaging (no remote servers)
- `contextIsolation: true`, `nodeIntegration: false` in all Electron renderer windows

---

## Project Structure

```
passkey-wallet/
├── browser-extension/
│   ├── chromium/          Manifest V3 extension
│   ├── firefox/           Manifest V2 extension + consent flow
│   ├── native-host.js     Native messaging bridge (Node.js source)
│   └── dist/              Compiled native-host binaries
├── src/
│   ├── main/              Electron main process
│   └── render/            HTML/CSS/JS for all windows
├── scripts/               Utility scripts
├── public/                Icons
└── electron-builder.json5 Packaging config
```

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start in development mode with hot reload |
| `npm run build` | Build native host + Electron app for distribution |
| `npm run build:native-host` | Compile `native-host.js` to standalone binaries |
| `npm run load-extension` | Helper to load the extension via CLI |
