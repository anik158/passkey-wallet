# PassKey Wallet Browser Extension

## Automatic Installation

PassKey Wallet **automatically** detects and configures all installed browsers when you launch the app.

**No manual setup required!**

---

## Supported Browsers

✅ Google Chrome  
✅ Microsoft Edge  
✅ Brave  
✅ Opera  
✅ Vivaldi  
✅ Firefox  
✅ Tor Browser

---

## How to Use

### 1. Install PassKey Wallet

Install the app using your package manager:
- **Linux**: Double-click `.deb` file or `./PassKey-Wallet.AppImage`
- **Windows**: Run `.exe` installer
- **macOS**: Open `.dmg` and drag to Applications

### 2. Launch the App

On first launch, PassKey Wallet will:
- ✅ Detect all installed browsers
- ✅ Configure extension support automatically
- ✅ Prepare extension files

**Permission prompt**: You may be asked for your password to install system files. This is normal and only happens once.

### 3. Install Browser Extension

**Option A - From App (Recommended)**
1. Open PassKey Wallet dashboard
2. Click **"Install Browser Extension"** button
3. Browser opens to extensions page
4. Click **"Load unpacked"**
5. Select the folder that opened
6. Done!

**Option B - Manual**
1. Open your browser's extension page:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
   - Brave: `brave://extensions`
   - Firefox: `about:debugging#/runtime/this-firefox`
   
2. Enable "Developer mode"
3. Click "Load unpacked" / "Load Temporary Add-on"
4. Navigate to extension folder:

**Chromium browsers** (Chrome, Edge, Brave, Opera, Vivaldi):
- **Linux**: `~/.local/share/passkey-wallet/browser-extension/chromium`
- **Windows**: `C:\Users\<YourName>\AppData\Local\Programs\passkey-wallet\resources\browser-extension\chromium`
- **macOS**: `/Applications/PassKey Wallet.app/Contents/Resources/browser-extension/chromium`

**Firefox** (Firefox, Tor Browser):
- **Linux**: `~/.local/share/passkey-wallet/browser-extension/firefox`
- **Windows**: `C:\Users\<YourName>\AppData\Local\Programs\passkey-wallet\resources\browser-extension\firefox`
- **macOS**: `/Applications/PassKey Wallet.app/Contents/Resources/browser-extension/firefox`

**Note:** One Chromium extension works for ALL Chromium-based browsers!

---

## What If I Install a New Browser Later?

**Automatic!** Just restart PassKey Wallet and it will detect and configure the new browser.

**Example:**
- Day 1: Use Chrome → Extension works
- Day 30: Install Firefox
- Day 31: Restart PassKey Wallet → Firefox automatically configured

---

## How It Works

```
Browser Extension ←→ PassKey Wallet App
  (sends URL)         (matches credentials)
```

1. Extension detects current tab URL
2. Sends URL to PassKey Wallet (local connection only)
3. App matches credentials for that domain
4. You press `Ctrl+Alt+P` to see credentials

**100% Offline. No internet required.**

---

## Troubleshooting

**Extension shows "Native host not found"**
- Restart PassKey Wallet
- Click "Settings" → "Reinstall Extension Support"

**New browser not working**
- Restart PassKey Wallet (auto-detects new browsers)

**Permission denied on Linux**
- This is normal - enter your password when prompted
- Required to install system files (one-time only)

---

## Security

✅ **Local only** - Extension talks to app via localhost  
✅ **No external connections** - Works completely offline  
✅ **Read-only** - Extension only reads URL, cannot modify pages  
✅ **Open source** - All code is visible and auditable
