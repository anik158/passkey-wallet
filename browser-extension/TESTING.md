# PassKey Wallet Extension - Testing Instructions

## Prerequisites
1. Install PassKey Wallet desktop application
2. Ensure native host is configured (auto-configured on app first-run)

## Test Credentials
No authentication required - this is a local desktop app.

## How to Test

### 1. Install Extension
**Firefox:**
- Go to `about:debugging#/runtime/this-firefox`
- Click "Load Temporary Add-on..."
- Select `browser-extension/firefox/manifest.json`

**Chrome/Edge/Brave:**
- Go to `chrome://extensions`
- Enable "Developer mode"
- Click "Load unpacked"
- Select `browser-extension/chromium` folder

### 2. Verify Native Messaging Connection
1. Open browser console (F12)
2. Extension should log: "Connected to native app" or "Native port established"
3. If connection fails, check that PassKey Wallet desktop app is installed

### 3. Test URL Detection
1. Navigate to any website (e.g., github.com)
2. Extension sends current URL to desktop app
3. Desktop app should show notification/overlay with credentials (if any exist for that domain)

### 4. Verify No External Data Collection
1. Open browser Network tab (F12 → Network)
2. Navigate to multiple websites
3. Verify NO external HTTP requests from the extension
4. All communication is local via native messaging to `localhost:5555`

## Expected Behavior

- ✅ Extension detects active tab URL changes
- ✅ Sends URLs to local desktop app (localhost only)
- ✅ Desktop app receives URLs and displays matching credentials
- ✅ NO data sent to external servers
- ✅ NO login form detection/autofill in extension (all handled by desktop app)

## Data Flow

```
Browser Tab → Extension (URL only) → Native Messaging → Desktop App (localhost) → Credential Overlay
```

**Privacy:** Only URLs are transmitted, and only to the local desktop application on the same machine via native messaging protocol. No external servers involved.
