// src/main/index.js
import { app, BrowserWindow, globalShortcut, ipcMain, clipboard } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import activeWin from 'active-win'
import { initDatabase, getCredentials, addCredential } from './db.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// In vite-plugin-electron, main and preload are output to the same dist-electron folder
const PRELOAD_PATH = path.join(__dirname, 'preload.mjs')

let overlayWindow = null

async function getCurrentDomain() {
  try {
    const winInfo = await activeWin()
    if (!winInfo?.title) return null

    const title = winInfo.title.trim()
    let domain = title.split(/·|-|—|\|/).pop()?.trim() || title

    const match = title.match(/(?:https?:\/\/)?(?:www\.)?([\w-]+\.[\w]{2,})(?:[\/:\s]|$)/i)
    if (match?.[1]) domain = match[1].toLowerCase()

    return domain
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

  // In production, this might need adjustment depending on how files are served
  if (process.env.VITE_DEV_SERVER_URL) {
    overlayWindow.loadURL(path.join(process.env.VITE_DEV_SERVER_URL, 'src/render/overlay.html'))
    // overlayWindow.webContents.openDevTools({ mode: 'detach' }) // Debugging
  } else {
    overlayWindow.loadFile(path.join(__dirname, '../render/overlay.html'))
  }
}

app.whenReady().then(() => {
  // Initialize DB with a dummy master password for now (TODO: Prompt user)
  const homeDir = app.getPath('home');
  const configDir = path.join(homeDir, '.config');

  // This will result in ~/.config/quickpass/passwords.db
  initDatabase(configDir, 'masterkey123');

  // Seed a test credential if none exist (optional, for demo)
  try {
    addCredential('example.com', 'demo_user', 'secret123');
  } catch (e) { /* ignore constraint errors */ }

  createOverlayWindow()

  globalShortcut.register('Control+Alt+P', async () => {
    if (!overlayWindow) return

    const domain = await getCurrentDomain()
    if (!domain) {
      console.log('Could not detect active window domain')
      return
    }

    console.log('Detected domain:', domain)
    const creds = getCredentials(domain)

    // If no creds found, send partial data so UI shows "No creds for [domain]"
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

ipcMain.on('copy-to-clipboard', (event, text) => {
  clipboard.writeText(text)
})

ipcMain.on('hide-overlay', () => {
  overlayWindow?.hide()
})