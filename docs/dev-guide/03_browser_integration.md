# PassKey Wallet - Developer Guide (Part 3: Browser Integration & Native Messaging)

In Part 1 and 2, we covered the core Electron application (the backend Main Process and the frontend Renderer). However, PassKey Wallet's killer feature is its ability to instantly detect URLs and push passwords using the `Ctrl+Alt+P` hotkey.

To achieve this, the desktop application needs a way to communicate directly with web browsers (Chrome, Edge, Brave, Firefox). This is handled by a combination of a **Browser Extension** and a **Native Messaging Host**.

---

## The Problem: Sandboxing

Modern web browsers are heavily sandboxed for security. A browser extension cannot simply talk to `localhost` easily or read files on your hard drive to find passwords. 

To bridge this gap, browsers provide a secure protocol called **Native Messaging**. It allows an installed browser extension to exchange JSON messages with a registered executable file on your computer via standard input/output (stdin/stdout).

---

## 1. Native Messaging Host (`install-native-host.js`)

Before the browser can talk to our app, it needs to know our app exists. That is the job of the **Native Messaging Host Installer**.

### How it works:
When a user finishes the "Browser Setup" wizard in the UI, the Main Process runs `src/main/nativeHostSetup.js` which points to `install-native-host.js`.

### Objective of the Installer:
It generates a special JSON file (a "manifest") and places it in a very specific, hidden operating system folder that the browser constantly checks.
For example, on Google Chrome (Linux), it places a file at `~/.config/google-chrome/NativeMessagingHosts/com.passkey.wallet.json`.

**What is inside this JSON manifest?**
```json
{
  "name": "com.passkey.wallet",
  "description": "PassKey Wallet Native Host",
  "path": "/absolute/path/to/our/app",  <-- Points the browser to our Electron app!
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://<OUR_EXTENSION_ID>/"
  ]
}
```
This file acts as permission. It tells Chrome: "If the extension with this exact ID asks to talk to `com.passkey.wallet`, run this executable path and let them talk."

### How the Electron App listens:
If you look inside `src/main/index.js`, we have this block of code:
```javascript
if (process.argv.includes('--native-messaging')) {
    setupNativeMessaging();
}
```
When the browser launches our app via Native Messaging, it attaches a hidden `--native-messaging` flag. The app intercepts this, reads the JSON message from the browser via `process.stdin`, processes the URL, and securely sends the credentials back via `process.stdout`.

---

## 2. The Browser Extension (`browser-extension/`)

The browser extension lives entirely inside your web browser. Its only job is to detect the current website's URL and ask the desktop app if there are any saved passwords for it.

### Core Files & Responsibilities:

### `manifest.json` (The Extension's Config)
* **Objective**: Declares the extension's name, permissions, and its background script. It specifically asks for the `nativeMessaging` permission, which is required to talk to our host described above.

### `background.js` (The Engine)
* **Objective**: This script runs constantly in the background of your browser.
* **How it works**:
  1. It connects to the desktop app: `chrome.runtime.connectNative('com.passkey.wallet')`.
  2. It listens for tab changes (`chrome.tabs.onActivated` and `chrome.tabs.onUpdated`).
  3. Whenever you switch tabs or load a new page, it grabs the URL.
  4. It sends a JSON message to the desktop app: `port.postMessage({ type: 'get_credentials', domain: 'github.com' })`.

### The `Ctrl+Alt+P` Quick-Fill Flow:
1. You are on `github.com`. The extension's `background.js` has already detected this and sent `"github.com"` to the desktop app via Native Messaging.
2. The desktop app stores this "last seen URL" in its memory.
3. You press `Ctrl+Alt+P`. 
4. The global shortcut in `index.js` triggers. It checks its memory for the last seen URL.
5. It finds `github.com`, does a database lookup, finds your username/password, and opens the floating Overlay window right over your browser.

---

### What's Next?
We have now covered the **Main Process**, the **Renderer Process (UI)**, and the **Browser Integration**. 

In Part 4, if you'd like, we can dive deep into the specific build tools, packaging (how we combine all of this into a single `.AppImage` or `.deb` file), and GitHub Actions CI/CD pipelines.
