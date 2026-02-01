import { app, BrowserWindow, globalShortcut, ipcMain, clipboard, dialog, Menu, powerMonitor } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import activeWin from 'active-win'
import { initDatabase, getCredentials, addCredential, getAllCredentials, deleteCredential, deleteAllCredentials, updateCredential, bulkInsertCredentials, getCredentialsPage, closeDatabase, checkDuplicates, findCredential } from './db.js'
import * as xlsx from 'xlsx'
import { encryptData, decryptData } from './crypto.js'
import fs from 'fs'
import Store from 'electron-store';

const store = new Store();

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Remove default menu
Menu.setApplicationMenu(null);

// Preload is in the same dist folder
const PRELOAD_PATH = path.join(__dirname, 'preload.mjs')

// Linux GPU Acceleration Fix for File Dialogs
if (process.platform === 'linux') {
  app.disableHardwareAcceleration();
}

// Comprehensive error logging
process.on('uncaughtException', (error) => {
  console.error('=== UNCAUGHT EXCEPTION ===');
  console.error(error);
  console.error('Stack:', error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('=== UNHANDLED REJECTION ===');
  console.error('Promise:', promise);
  console.error('Reason:', reason);
});

console.log('=== APP STARTING ===');
console.log('Platform:', process.platform);
console.log('App path:', app.getAppPath());
console.log('User data:', app.getPath('userData'));

// Single Instance Lock - Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  console.log('Another instance is already running. Exiting...');
  app.quit();
  // IMPORTANT: Exit the process immediately, don't continue execution
  process.exit(0);
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, focus our window
    console.log('Second instance attempted, focusing existing window');
    if (dashboardWindow) {
      if (dashboardWindow.isMinimized()) dashboardWindow.restore();
      dashboardWindow.focus();
    } else if (loginWindow) {
      if (loginWindow.isMinimized()) loginWindow.restore();
      loginWindow.focus();
    }
  });
}

// Ensure lock is released on exit
app.on('will-quit', () => {
  console.log('App will quit, releasing lock...');
  app.releaseSingleInstanceLock();
});

let overlayWindow = null
let dashboardWindow = null
let loginWindow = null

async function getCurrentDomain() {
  try {
    const winInfo = await activeWin()
    // console.log('Active Window Info:', winInfo); // DEBUG LOG

    if (!winInfo?.title) return null

    const appName = winInfo.owner?.name || 'Unknown App';
    // 0. Ignore ourself
    if (appName.includes('PassKey Wallet') || appName.includes('Electron')) {
      // console.log('Ignoring self focus');
      return null;
    }

    let title = winInfo.title.trim()
    let domain = null;

    // 1. Try to extract URL if available (Linux/macOS sometimes support this)
    if (winInfo.url) {
      try {
        const urlObj = new URL(winInfo.url)
        // console.log('Got URL from OS:', urlObj.hostname);
        domain = urlObj.hostname.replace('www.', '');
      } catch (e) { /* ignore */ }
    }

    if (!domain) {
      // 2. Heuristics: Remove common browser suffixes to reduce noise
      const cleanedTitle = title.replace(/(?: - | — | \| )(?:Google Chrome|Chromium|Microsoft Edge|Mozilla Firefox|Brave|Vivaldi|Opera).*/i, '')

      // 3. If it looks like a URL found in title, extract it
      // Regex for finding domain-like strings (e.g., mysite.com, login.google.com)
      const urlMatch = cleanedTitle.match(/([a-zA-Z0-9-]+\.[a-zA-Z]{2,})/i)
      if (urlMatch?.[1]) {
        // console.log('Extracted URL from title:', urlMatch[1]);
        domain = urlMatch[1].toLowerCase();
      } else {
        // If no domain-like string, use the first part of the title as a best guess
        // e.g. "Google - Google Chrome" -> "Google" (cleaned above)
        // If users have "My Bank" as title but "mybank.com" in DB, fuzzy search in DB handles it?
        // console.log('Using cleaned title for fuzzy search:', cleanedTitle);
        domain = cleanedTitle;
      }
    }

    return { domain, appName };

  } catch (err) {
    console.error('Active window error:', err)
    return null
  }
}

function createOverlayWindow() {
  overlayWindow = new BrowserWindow({
    width: 440,
    height: 260, // Increased height to fit app name and content
    show: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      preload: PRELOAD_PATH,
      sandbox: true,
      contextIsolation: true
    }
  })

  const devServerUrl = process.env.VITE_DEV_SERVER_URL
  if (devServerUrl) {
    overlayWindow.loadURL(path.join(devServerUrl, 'src/render/overlay.html'))
  } else {
    overlayWindow.loadFile(path.join(__dirname, '../dist/src/render/overlay.html'))
  }

  overlayWindow.on('closed', () => {
    overlayWindow = null
  })
}

// Helper for finding icon
const getIconPath = () => {
  // Use platform-specific icons
  if (process.platform === 'win32') {
    return path.resolve(__dirname, '../public/icon.ico');
  }
  // Linux and macOS use PNG
  return path.resolve(__dirname, '../public/icon.png');
}

function createDashboardWindow() {
  if (dashboardWindow) {
    dashboardWindow.focus()
    return
  }

  // Create the main application window
  dashboardWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    show: false, // Wait until ready to show
    title: 'PassKey Wallet - Password Manager',
    icon: getIconPath(),
    webPreferences: {
      preload: PRELOAD_PATH,
      sandbox: true,
      contextIsolation: true
    }
  })

  const devServerUrl = process.env.VITE_DEV_SERVER_URL
  if (devServerUrl) {
    // In dev mode, we assume Vite serves this file
    dashboardWindow.loadURL(path.join(devServerUrl, 'src/render/dashboard.html'))
    // dashboardWindow.webContents.openDevTools() // Debug mode ENABLED
  } else {
    dashboardWindow.loadFile(path.join(__dirname, '../dist/src/render/dashboard.html'))
  }

  dashboardWindow.once('ready-to-show', () => {
    dashboardWindow.show()
  })

  dashboardWindow.on('closed', () => {
    dashboardWindow = null
  })
}

function createLoginWindow() {
  loginWindow = new BrowserWindow({
    width: 400,
    height: 500,
    title: 'Login - PassKey Wallet',
    resizable: false,
    icon: getIconPath(),
    webPreferences: {
      preload: PRELOAD_PATH,
      sandbox: true,
      contextIsolation: true
    }
  })

  const devServerUrl = process.env.VITE_DEV_SERVER_URL
  if (devServerUrl) {
    loginWindow.loadURL(path.join(devServerUrl, 'src/render/login.html'))
  } else {
    // In production, Vite puts files in dist/src/render/
    const htmlPath = path.join(__dirname, '../dist/src/render/login.html');
    console.log('[LOGIN] Loading from:', htmlPath);
    console.log('[LOGIN] File exists:', fs.existsSync(htmlPath));
    loginWindow.loadFile(htmlPath);
  }

  // Debug: Check for load errors
  loginWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('[LOGIN] Failed to load:', errorCode, errorDescription);
  });

  loginWindow.on('closed', () => {
    loginWindow = null
  })
}

ipcMain.handle('check-db-exists', () => {
  const appData = app.getPath('appData');
  const dbPath = path.join(appData, 'passkey-wallet', 'passwords.db');
  return fs.existsSync(dbPath);
})

ipcMain.handle('login-attempt', async (event, password) => {
  try {
    const appData = app.getPath('appData');
    // Attempt init. This will throw if password is wrong AND db exists/is encrypted
    initDatabase(appData, password);

    // Login success!
    if (loginWindow) {
      loginWindow.close();
      loginWindow = null;
    }

    startApp();
    return true;
  } catch (err) {
    console.error('Login failed:', err.message);
    return false;
  }
})

const CHECK_INTERVAL_MS = 10000; // Check idle every 10s
let autoLockInterval = null;

function startAutoLockTimer() {
  if (autoLockInterval) clearInterval(autoLockInterval);

  autoLockInterval = setInterval(() => {
    // If DB is already closed/locked, no need to check
    // We can check if loginWindow is visible or dashboard is null as a proxy
    if (!dashboardWindow && loginWindow) return; // Already locked logic-ish

    const systemIdleSeconds = powerMonitor.getSystemIdleTime();

    const lockMinutes = store.get('autoLockMinutes', 60);
    const lockSeconds = lockMinutes * 60;

    if (systemIdleSeconds >= lockSeconds) {
      console.log(`System idle for ${systemIdleSeconds}s. Locking app.`);
      lockApp();
    }
  }, CHECK_INTERVAL_MS);
}

function lockApp() {
  if (dashboardWindow) {
    dashboardWindow.destroy(); // Force close
    dashboardWindow = null;
  }

  if (overlayWindow) {
    overlayWindow.hide();
  }

  // Close DB connection
  closeDatabase(); // Ensure this is exported/imported from db.js

  // Clear any cached data in memory if we had any (we mostly trust GC + DB close)

  // Show Login
  if (!loginWindow) {
    createLoginWindow();
    loginWindow.show();
  } else {
    loginWindow.show();
    loginWindow.focus();
  }
}

function startApp() {
  createOverlayWindow()
  createDashboardWindow()
  startAutoLockTimer();

  globalShortcut.register('Control+Alt+P', async () => {
    // SECURITY: If app is locked (DB closed), show login window
    const appData = app.getPath('appData');
    const dbPath = path.join(appData, 'passkey-wallet', 'passwords.db');

    // We can also check if dashboardWindow exists. If not, likely locked.
    // But checking DB is more accurate for "can we access secrets".
    // Also we exported closeDatabase, so internal 'db' var will be null.
    // getCredentials throws if db is null.
    try {
      getAllCredentials().slice(0, 1);
    } catch (e) {
      // console.log('DB seems closed/locked, showing login window.');
      if (!loginWindow) createLoginWindow();
      else {
        loginWindow.show();
        loginWindow.focus();
      }
      return;
    }

    if (!overlayWindow) return

    const result = await getCurrentDomain()
    if (!result || !result.domain) {
      console.log('Could not detect active window domain')
      return
    }

    const { domain, appName } = result;

    const creds = getCredentials(domain)
    const data = creds.length > 0 ? {
      site: creds[0].domain, // Use the actual found domain (e.g. google.com) instead of fuzzy title
      appName: appName,
      username: creds[0].username,
      password: creds[0].password
    } : {
      site: domain,
      appName: appName,
      username: null,
      password: null
    }

    overlayWindow.webContents.send('show-credentials', data)
    overlayWindow.center()
    overlayWindow.show()
    overlayWindow.focus()
  })
}

app.whenReady().then(() => {
  createLoginWindow();
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  if (autoLockInterval) clearInterval(autoLockInterval);
  closeDatabase(); // Ensure DB is closed on app exit
})

// === IPC Listeners (The Controller Logic) ===

// Overlay Actions
ipcMain.on('copy-to-clipboard', (event, text) => clipboard.writeText(text))
ipcMain.on('hide-overlay', () => overlayWindow?.hide())

// Dashboard Actions (CRUD)
ipcMain.handle('get-all-credentials', () => getAllCredentials())
ipcMain.handle('get-credentials-page', (event, { page, pageSize }) => getCredentialsPage(page, pageSize))
ipcMain.handle('add-credential', async (event, data) => {
  const existing = findCredential(data.domain, data.username);
  if (existing) {
    const { response } = await dialog.showMessageBox({
      type: 'question',
      buttons: ['Overwrite', 'Cancel'],
      defaultId: 0,
      title: 'Duplicate Credential',
      message: `A password for ${data.domain} (${data.username}) already exists.\nDo you want to overwrite it?`,
      detail: 'The existing password will be updated.'
    });

    if (response === 1) return { cancelled: true }; // Cancelled

    // Overwrite
    return updateCredential(existing.id, data.username, data.password);
  }
  return addCredential(data.domain, data.username, data.password);
})
ipcMain.handle('delete-credential', (event, id) => deleteCredential(id))
ipcMain.handle('delete-all-credentials', () => {
  try {
    const result = deleteAllCredentials()
    return { success: true, count: result.count }
  } catch (err) {
    console.error('Delete all failed:', err)
    return { success: false, message: err.message }
  }
})
ipcMain.handle('update-credential', (event, data) => updateCredential(data.id, data.username, data.password))

// Import / Export
// Import
ipcMain.handle('import-from-excel', async () => {
  const { filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Excel Files', extensions: ['xlsx', 'xls'] },
      { name: 'CSV Files', extensions: ['csv'] }
    ]
  })

  // AGGRESSIVE focus restoration for Linux
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    console.log('[FOCUS] Restoring focus after import dialog');
    dashboardWindow.restore(); // Restore if minimized
    dashboardWindow.setAlwaysOnTop(true); // Force to top
    dashboardWindow.show(); // Ensure visible
    dashboardWindow.focus(); // Focus
    dashboardWindow.setAlwaysOnTop(false); // Remove always-on-top
    console.log('[FOCUS] Focus restored, window should be active');
  }

  if (filePaths && filePaths.length > 0) {
    const filePath = filePaths[0]

    try {
      const buffer = fs.readFileSync(filePath)
      const workbook = xlsx.read(buffer, { type: 'buffer' })
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]
      const rawData = xlsx.utils.sheet_to_json(sheet)

      if (!rawData || rawData.length === 0) {
        return { success: false, message: 'File appears empty' }
      }

      // Smart Column Mapping
      // We look for keys that resemble 'domain', 'username', 'password'
      const firstRow = rawData[0];
      const keys = Object.keys(firstRow);

      const findKey = (candidates) => keys.find(k => candidates.some(c => k.toLowerCase().includes(c)));

      const domainKey = findKey(['domain', 'site', 'url', 'web', 'link']);
      const userKey = findKey(['user', 'login', 'email', 'account']);
      const passKey = findKey(['pass', 'pwd', 'key', 'secret', 'code']);

      if (!domainKey || !userKey || !passKey) {
        return {
          success: false,
          message: `Could not identify columns automatically. Found headers: ${keys.join(', ')}. Need columns like 'Domain', 'Username', 'Password'.`
        }
      }

      const validRows = [];
      let skippedCount = 0;

      for (const row of rawData) {
        const d = row[domainKey];
        const u = row[userKey];
        const p = row[passKey];

        if (d && u && p) {
          validRows.push({ domain: String(d), username: String(u), password: String(p) });
        } else {
          skippedCount++;
        }
      }

      if (validRows.length > 0) {

        // 1. Check for duplicates first
        const duplicates = checkDuplicates(validRows);
        if (duplicates.length > 0) {
          const message = `Found ${duplicates.length} duplicate entries (e.g., ${duplicates[0]}).\n\nDo you want to overwrite them with the new passwords?`;
          const { response } = await dialog.showMessageBox({
            type: 'question',
            buttons: ['Overwrite & Import', 'Cancel'],
            defaultId: 0,
            title: 'Duplicates Found',
            message: message,
            detail: 'Existing passwords for these accounts will be updated.'
          });

          if (response === 1) { // Cancel (Index 1)
            return { success: false, message: 'Import cancelled by user.' };
          }
        }

        bulkInsertCredentials(validRows);
        // Refresh dashboard if open
        if (dashboardWindow) {
          // We might want to notify renderer to refresh, 
          // but since this is an invoke, render can refresh after await
        }
        return { success: true, count: validRows.length, skipped: skippedCount }
      }

      return { success: false, message: 'No valid rows found.' }

    } catch (error) {
      console.error(error)
      return { success: false, message: error.message }
    }
  }
  return { cancelled: true }
})

// Secure Backup Handlers
ipcMain.handle('export-encrypted', async (event, password) => {
  const { filePath } = await dialog.showSaveDialog({
    defaultPath: 'backup.qpass',
    filters: [{ name: 'PassKey Wallet Backup', extensions: ['qpass'] }]
  })

  // AGGRESSIVE focus restoration for Linux
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    console.log('[FOCUS] Restoring focus after backup dialog');
    dashboardWindow.restore();
    dashboardWindow.setAlwaysOnTop(true);
    dashboardWindow.show();
    dashboardWindow.focus();
    dashboardWindow.setAlwaysOnTop(false);
    console.log('[FOCUS] Focus restored');
  }

  if (filePath) {
    try {
      const data = getAllCredentials();
      // Encrypt the entire array
      const encryptedContent = encryptData(data, password);

      fs.writeFileSync(filePath, encryptedContent, 'utf8');
      return { success: true };
    } catch (error) {
      console.error(error);
      return { success: false, message: error.message };
    }
  }
  return { cancelled: true };
})

ipcMain.handle('select-backup-file', async () => {
  const { filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'PassKey Wallet Backup', extensions: ['qpass'] }]
  })

  // AGGRESSIVE focus restoration for Linux
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    console.log('[FOCUS] Restoring focus after restore file dialog');
    dashboardWindow.restore();
    dashboardWindow.setAlwaysOnTop(true);
    dashboardWindow.show();
    dashboardWindow.focus();
    dashboardWindow.setAlwaysOnTop(false);
    console.log('[FOCUS] Focus restored');
  }

  return filePaths && filePaths.length > 0 ? filePaths[0] : null;
})

ipcMain.handle('restore-backup', async (event, { filePath, password }) => {
  try {
    if (!fs.existsSync(filePath)) {
      return { success: false, message: 'File not found' };
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const decryptedData = decryptData(content, password);

    if (Array.isArray(decryptedData)) {

      // 1. Check for duplicates
      const duplicates = checkDuplicates(decryptedData);
      if (duplicates.length > 0) {
        const message = `Found ${duplicates.length} duplicate entries in backup (e.g., ${duplicates[0]}).\n\nDo you want to overwrite existing passwords?`;
        const { response } = await dialog.showMessageBox({
          type: 'question',
          buttons: ['Overwrite & Restore', 'Cancel'],
          defaultId: 0,
          title: 'Backup Duplicates',
          message: message,
          detail: 'Existing passwords will be updated to match the backup.'
        });

        if (response === 1) { // Cancel
          return { success: false, message: 'Restore cancelled by user.' };
        }
      }

      bulkInsertCredentials(decryptedData);

      // Refresh dashboard if it's open
      // Refresh dashboard if it's open
      if (dashboardWindow) {
        dashboardWindow.webContents.send('refresh-data');
        dashboardWindow.focus(); // Ensure window reclaims focus
      } else {
        createDashboardWindow();
      }

      return { success: true, count: decryptedData.length };
    }
    return { success: false, message: 'Invalid data format or wrong password' };
  } catch (error) {
    console.error(error);
    return { success: false, message: 'Decryption failed. Wrong password?' };
  }
})

// Settings IPC
ipcMain.handle('get-settings', () => {
  return {
    autoLockMinutes: store.get('autoLockMinutes', 60)
  };
});

ipcMain.handle('save-settings', (event, settings) => {
  if (settings.autoLockMinutes !== undefined) {
    store.set('autoLockMinutes', parseInt(settings.autoLockMinutes));
    // Restart the timer with the new duration
    startAutoLockTimer();
  }
  return true;
});

ipcMain.handle('lock-app', () => {
  lockApp();
});