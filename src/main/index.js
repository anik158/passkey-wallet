import { app, BrowserWindow, globalShortcut, ipcMain, clipboard, dialog, Menu, powerMonitor, Tray, shell } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { getBrowserURL } from './urlDetector.js';
import activeWin from 'active-win'
import { initDatabase, getCredentials, addCredential, getAllCredentials, deleteCredential, deleteAllCredentials, updateCredential, bulkInsertCredentials, getCredentialsPage, closeDatabase, checkDuplicates, findCredential } from './db.js'
import * as xlsx from 'xlsx'
import { encryptData, decryptData } from './crypto.js'
import fs from 'fs'
import { getExtensionPath } from './extensionSetup.js'
import { promptExtensionInstall } from './extensionPrompt.js'
import { startURLServer, stopURLServer, getCurrentURL } from './urlServer.js'
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

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  console.log('Another instance is already running. Exiting...');
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    console.log('Second instance attempted, focusing existing window');

    if (dashboardWindow) {
      if (dashboardWindow.isMinimized()) dashboardWindow.restore();
      dashboardWindow.show();
      dashboardWindow.focus();
    } else if (loginWindow) {
      if (loginWindow.isMinimized()) loginWindow.restore();
      loginWindow.show();
      loginWindow.focus();
    } else {
      createLoginWindow();
    }
  });
}

app.on('will-quit', () => {
  console.log('App will quit, releasing lock...');
  app.releaseSingleInstanceLock();
});

/**
 * Detects the current active window's domain for credential matching.
 * Priority: 1) Direct URL extraction (OS-specific), 2) activeWin URL, 3) Title parsing
 * Returns domain, app name, and detection method for debugging.
 */
async function getCurrentDomain() {
  try {
    const winInfo = await activeWin()
    console.log('[DOMAIN] Active window:', {
      title: winInfo?.title,
      url: winInfo?.url,
      app: winInfo?.owner?.name
    });

    if (!winInfo?.title) return null

    const appName = winInfo.owner?.name || 'Unknown App';
    if (appName.includes('PassKey Wallet') || appName.includes('Electron')) {
      return null;
    }

    let title = winInfo.title.trim()
    let domain = null;
    let method = 'unknown';

    const directURL = await getBrowserURL();
    if (directURL) {
      domain = directURL;
      method = 'direct-url';
      console.log('[DOMAIN] Detected via direct extraction:', domain);
      return { domain, appName, method };
    }

    if (winInfo.url) {
      try {
        const urlObj = new URL(winInfo.url)
        domain = urlObj.hostname.replace('www.', '');
        method = 'activewin-url';
        console.log('[DOMAIN] Detected from activeWin URL:', domain);
      } catch (e) { /* ignore */ }
    }

    if (!domain) {
      const cleanedTitle = title.replace(/(?: - | — | \| )(?:Google Chrome|Chromium|Microsoft Edge|Mozilla Firefox|Brave|Vivaldi|Opera).*/i, '')
      const urlMatch = cleanedTitle.match(/([a-zA-Z0-9-]+\.[a-zA-Z]{2,})/i)
      if (urlMatch?.[1]) {
        domain = urlMatch[1].toLowerCase();
        method = 'title-regex';
        console.log('[DOMAIN] Detected from title regex:', domain);
      } else {
        domain = cleanedTitle.toLowerCase().trim();
        method = 'title-fallback';
        console.log('[DOMAIN] Using title as-is:', domain);
      }
    }

    return { domain, appName, method };

  } catch (err) {
    console.error('Active window error:', err)
    return null
  }
}

let overlayWindow = null
let dashboardWindow = null
let loginWindow = null
let tray = null

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
  if (devServerUrl && !app.isPackaged) {
    overlayWindow.loadURL(`${devServerUrl}src/render/overlay.html`)
  } else {
    overlayWindow.loadFile(path.join(__dirname, '../dist/src/render/overlay.html'))
  }

  overlayWindow.on('closed', () => {
    overlayWindow = null
  })
}

/**
 * Returns platform-specific icon path (ICO for Windows, PNG for Linux/Mac)
 */
const getIconPath = () => {
  if (process.platform === 'win32') {
    return path.resolve(__dirname, '../public/icon.ico');
  }
  return path.resolve(__dirname, '../public/icon.png');
}

/**
 * Creates the main dashboard window.
 * Window is hidden (not destroyed) on close for security - database is locked and login window shown.
 */
function createDashboardWindow() {
  if (dashboardWindow) {
    dashboardWindow.focus()
    return
  }

  dashboardWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    title: 'Dashboard - PassKey Wallet',
    icon: getIconPath(),
    webPreferences: {
      preload: PRELOAD_PATH,
      sandbox: true,
      contextIsolation: true
    }
  })

  dashboardWindow.on('close', (e) => {
    e.preventDefault();
    console.log('[DASHBOARD] Closing - hiding to system tray');
    dashboardWindow.hide();
    closeDatabase();

    if (!tray) {
      createTray();
    }

    if (false && !loginWindow) {
      createLoginWindow();
    } else {
      loginWindow.show();
      loginWindow.focus();
    }
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL
  if (devServerUrl && !app.isPackaged) {
    dashboardWindow.loadURL(`${devServerUrl}src/render/dashboard.html`)
    // dashboardWindow.webContents.openDevTools() // Debug mode ENABLED
  } else {
    dashboardWindow.loadFile(`${__dirname}/../dist/src/render/dashboard.html`)
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
  if (devServerUrl && !app.isPackaged) {
    loginWindow.loadURL(`${devServerUrl}src/render/login.html`)
    console.log('[LOGIN] Loading from dev server:', `${devServerUrl}src/render/login.html`)
  } else {
    // In production, Vite puts files in dist/src/render/
    const loginPath = path.join(__dirname, '../dist/src/render/login.html');
    console.log('[LOGIN] Loading from:', loginPath);
    console.log('[LOGIN] File exists:', fs.existsSync(loginPath));
    loginWindow.loadFile(loginPath);
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

/**
 * Creates system tray icon for background operation.
 * Click tray icon to restore dashboard (requires re-authentication).
 */
function createTray() {
  const iconPath = getIconPath();
  tray = new Tray(iconPath);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Dashboard',
      click: () => {
        if (!loginWindow) {
          createLoginWindow();
        }
        loginWindow.show();
        loginWindow.focus();
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      }
    }
  ]);

  tray.setToolTip('PassKey Wallet');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (!loginWindow) {
      createLoginWindow();
    }
    loginWindow.show();
    loginWindow.focus();
  });
}

/**
 * Starts the application by creating overlay window, dashboard, and registering global shortcut.
 * Ctrl+Alt+P triggers overlay to show credentials for currently active window.
 */
function startApp() {
  createOverlayWindow()
  createDashboardWindow()
  startAutoLockTimer();

  globalShortcut.register('Control+Alt+P', async () => {
    try {
      getAllCredentials().slice(0, 1);
    } catch (e) {
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
      console.log('[OVERLAY] Could not detect active window domain')
      return
    }

    const { domain, appName, method } = result;
    console.log('[OVERLAY] Detected domain:', domain, 'via', method, 'from', appName);

    const creds = getCredentials(domain)
    console.log('[OVERLAY] Found', creds.length, 'credential(s) for', domain);

    const data = {
      site: domain,
      appName: appName,
      credentials: creds.map(c => ({
        username: c.username,
        password: c.password,
        id: c.id
      }))
    };

    overlayWindow.webContents.send('show-credentials', data)
    overlayWindow.center()
    overlayWindow.show()
    overlayWindow.focus()
  })
}

app.whenReady().then(async () => {
  createLoginWindow()

  // Start URL server for browser extension communication
  startURLServer((url) => {
    console.log('[Main] Received URL from extension:', url);
  });

  // Show extension prompt after 3 seconds (unless user dismissed it)
  setTimeout(() => {
    promptExtensionInstall().catch(e => {
      console.error('[Extension] Prompt error:', e);
    });
  }, 3000);
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  if (autoLockInterval) clearInterval(autoLockInterval);
  stopURLServer();
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