// src/main/index.js
import { app, BrowserWindow, globalShortcut, ipcMain, clipboard, dialog } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import activeWin from 'active-win'
import { initDatabase, getCredentials, addCredential, getAllCredentials, deleteCredential, updateCredential, bulkInsertCredentials } from './db.js'
import * as xlsx from 'xlsx'
import { encryptData, decryptData } from './crypto.js'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Preload is in the same dist folder
const PRELOAD_PATH = path.join(__dirname, 'preload.mjs')

let overlayWindow = null
let dashboardWindow = null

async function getCurrentDomain() {
  try {
    const winInfo = await activeWin()
    console.log('Active Window Info:', winInfo); // DEBUG LOG

    if (!winInfo?.title) return null


    let title = winInfo.title.trim()
    console.log('Raw Title:', title); // DEBUG LOG


    // 1. Try to extract URL if available (Linux/macOS sometimes support this)
    if (winInfo.url) {
      try {
        const urlObj = new URL(winInfo.url)
        console.log('Got URL from OS:', urlObj.hostname);
        return urlObj.hostname.replace('www.', '');
      } catch (e) { /* ignore */ }
    }

    // 2. Heuristics: Remove common browser suffixes to reduce noise
    // "GitHub - Google Chrome" -> "GitHub"
    // "GitHub: Let's build from here - Microsoft Edge" -> "GitHub: Let's build from here"
    const cleanedTitle = title.replace(/(?: - | — | \| )(?:Google Chrome|Chromium|Microsoft Edge|Mozilla Firefox|Brave|Vivaldi|Opera).*/i, '')

    // 3. If it looks like a URL found in title, extract it
    const urlMatch = cleanedTitle.match(/(?:https?:\/\/)?(?:www\.)?([\w-]+\.[\w]{2,})/i)
    if (urlMatch?.[1]) {
      console.log('Extracted URL from title:', urlMatch[1]);
      return urlMatch[1].toLowerCase();
    }

    console.log('Using cleaned title for fuzzy search:', cleanedTitle);
    return cleanedTitle;
  } catch (err) {
    console.error('Active window error:', err)
    return null
  }
}

function createOverlayWindow() {
  overlayWindow = new BrowserWindow({
    width: 440,
    height: 200,
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
    overlayWindow.loadFile(path.join(__dirname, '../render/overlay.html'))
  }
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
    dashboardWindow.webContents.openDevTools()
  } else {
    dashboardWindow.loadFile(path.join(__dirname, '../render/dashboard.html'))
  }

  dashboardWindow.once('ready-to-show', () => {
    dashboardWindow.show()
  })

  dashboardWindow.on('closed', () => {
    dashboardWindow = null
  })
}

app.whenReady().then(() => {
  // Use a cross-platform path: ~/.config/passkey-wallet or %APPDATA%/passkey-wallet
  const appData = app.getPath('appData');
  // db.js appends 'passkey-wallet/passwords.db', so we pass the root appData

  initDatabase(appData, 'masterkey123'); // TODO: Replace hardcoded key

  // Add demo data if needed
  try {
    addCredential('example.com', 'demo_user', 'secret123');
  } catch (e) { /* ignore */ }

  createOverlayWindow()

  // Launch the Dashboard so the user sees the app immediately
  createDashboardWindow()

  globalShortcut.register('Control+Alt+P', async () => {
    if (!overlayWindow) return

    const domain = await getCurrentDomain()
    if (!domain) {
      console.log('Could not detect active window domain')
      return
    }

    const creds = getCredentials(domain)
    const data = creds.length > 0 ? {
      site: domain,
      username: creds[0].username,
      password: creds[0].password
    } : {
      site: domain,
      username: null,
      password: null
    }

    overlayWindow.webContents.send('show-credentials', data)
    overlayWindow.center()
    overlayWindow.show()
    overlayWindow.focus()
  })
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

// === IPC Listeners (The Controller Logic) ===

// Overlay Actions
ipcMain.on('copy-to-clipboard', (event, text) => clipboard.writeText(text))
ipcMain.on('hide-overlay', () => overlayWindow?.hide())

// Dashboard Actions (CRUD)
ipcMain.handle('get-all-credentials', () => getAllCredentials())
ipcMain.handle('add-credential', (event, data) => addCredential(data.domain, data.username, data.password))
ipcMain.handle('delete-credential', (event, id) => deleteCredential(id))
ipcMain.handle('update-credential', (event, data) => updateCredential(data.id, data.username, data.password))

// Import / Export
ipcMain.handle('import-from-excel', async () => {
  // Open file dialog
  const { filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Excel Files', extensions: ['xlsx', 'xls'] }]
  })

  if (filePaths && filePaths.length > 0) {
    try {
      const workbook = xlsx.readFile(filePaths[0])
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]
      const data = xlsx.utils.sheet_to_json(sheet) // Parse to JSON

      // Filter for valid rows
      const validRows = data.filter(r => r.domain && r.username && r.password)
      if (validRows.length > 0) {
        bulkInsertCredentials(validRows)
        createDashboardWindow() // Ensure window is open/focused
        dashboardWindow?.webContents.reload() // Refresh list
        return { success: true, count: validRows.length }
      }
      return { success: false, message: 'No valid rows found (need domain, username, password columns)' }
    } catch (error) {
      console.error(error)
      return { success: false, message: error.message }
    }
  }
  return { cancelled: true }
})

ipcMain.handle('export-to-excel', async () => {
  // Save file dialog
  const { filePath } = await dialog.showSaveDialog({
    defaultPath: 'passwords.xlsx',
    filters: [{ name: 'Excel File', extensions: ['xlsx'] }]
  })

  if (filePath) {
    try {
      const data = getAllCredentials()
      const exportData = data.map(d => ({
        domain: d.domain,
        username: d.username,
        password: d.password
      }))

      const wb = xlsx.utils.book_new()
      const ws = xlsx.utils.json_to_sheet(exportData)
      xlsx.utils.book_append_sheet(wb, ws, 'Passwords')
      xlsx.writeFile(wb, filePath)

      return { success: true }
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

ipcMain.handle('import-encrypted', async (event, password) => {
  const { filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'PassKey Wallet Backup', extensions: ['qpass'] }]
  })

  if (filePaths && filePaths.length > 0) {
    try {
      const content = fs.readFileSync(filePaths[0], 'utf8');
      const decryptedData = decryptData(content, password);

      if (Array.isArray(decryptedData)) {
        bulkInsertCredentials(decryptedData);
        createDashboardWindow();
        dashboardWindow?.webContents.reload();
        return { success: true, count: decryptedData.length };
      }
      return { success: false, message: 'Invalid data format' };
    } catch (error) {
      console.error(error);
      return { success: false, message: 'Decryption failed. Wrong password?' };
    }
  }
  return { cancelled: true };
})