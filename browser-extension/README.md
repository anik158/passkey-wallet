# PassKey Wallet Browser Extension

Extension for accurate URL detection in Chrome, Brave, Edge, and Firefox.

## Quick Install

1. **Load Extension:**
   - Chrome: `chrome://extensions` → "Load unpacked" → select `chromium` folder
   - Firefox: `about:debugging` → "Load Temporary Add-on" → select `firefox/manifest.json`

2. **Install Native Host:**
   - Linux/macOS: Run `./install-native-host.sh`
   - Windows: Run `install-native-host.bat`
   - Enter extension ID when prompted

3. **Reload Extension** - Done!

## Files

- `chromium/` - Chrome/Brave/Edge extension
- `firefox/` - Firefox extension
- `native-host.js` - Native messaging host
- `install-native-host.sh` - Linux/macOS installer
- `install-native-host.bat` - Windows installer

## Incognito Mode

Go to browser extensions → PassKey Wallet → Details → Enable "Allow in Incognito"

## Troubleshooting

**Extension ID changes on reload (dev only):**
Just re-run the installer with the new ID.

**In production:**
Extension published to Chrome Web Store will have permanent ID.
