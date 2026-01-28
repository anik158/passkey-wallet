import { app, globalShortcut, ipcMain, clipboard, BrowserWindow } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import activeWin from "active-win";
import Database from "better-sqlite3-multiple-ciphers";
import fs from "fs";
import __cjs_mod__ from "node:module";
const __filename = import.meta.filename;
const __dirname = import.meta.dirname;
const require2 = __cjs_mod__.createRequire(import.meta.url);
let db;
function initDatabase(userDataPath, password) {
  const dbDir = path.join(userDataPath, "quickpass");
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  const dbPath = path.join(dbDir, "passwords.db");
  db = new Database(dbPath, { verbose: console.log });
  db.pragma(`key = '${password}'`);
  db.exec(`
    CREATE TABLE IF NOT EXISTS credentials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      domain TEXT NOT NULL,
      username TEXT NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_domain ON credentials(domain);
  `);
  console.log("Database initialized at", dbPath);
}
function getCredentials(domain) {
  if (!db) throw new Error("DB not initialized");
  const stmt = db.prepare("SELECT * FROM credentials WHERE domain LIKE ?");
  return stmt.all(`%${domain}%`);
}
function addCredential(domain, username, password) {
  if (!db) throw new Error("DB not initialized");
  const stmt = db.prepare("INSERT INTO credentials (domain, username, password) VALUES (?, ?, ?)");
  return stmt.run(domain, username, password);
}
const __filename$1 = fileURLToPath(import.meta.url);
const __dirname$1 = path.dirname(__filename$1);
const PRELOAD_PATH = path.join(__dirname$1, "../preload.js");
let overlayWindow = null;
async function getCurrentDomain() {
  try {
    const winInfo = await activeWin();
    if (!winInfo?.title) return null;
    const title = winInfo.title.trim();
    let domain = title.split(/·|-|—|\|/).pop()?.trim() || title;
    const match = title.match(/(?:https?:\/\/)?(?:www\.)?([\w-]+\.[\w]{2,})(?:[\/:\s]|$)/i);
    if (match?.[1]) domain = match[1].toLowerCase();
    return domain;
  } catch (err) {
    console.error("Active window error:", err);
    return null;
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
  });
  if (process.env.VITE_DEV_SERVER_URL) {
    overlayWindow.loadURL(path.join(process.env.VITE_DEV_SERVER_URL, "src/render/overlay.html"));
  } else {
    overlayWindow.loadFile(path.join(__dirname$1, "../render/overlay.html"));
  }
}
app.whenReady().then(() => {
  const homeDir = app.getPath("home");
  const configDir = path.join(homeDir, ".config");
  initDatabase(configDir, "masterkey123");
  try {
    addCredential("example.com", "demo_user", "secret123");
  } catch (e) {
  }
  createOverlayWindow();
  globalShortcut.register("Control+Alt+P", async () => {
    if (!overlayWindow) return;
    const domain = await getCurrentDomain();
    if (!domain) {
      console.log("Could not detect active window domain");
      return;
    }
    console.log("Detected domain:", domain);
    const creds = getCredentials(domain);
    const data = creds.length > 0 ? {
      site: domain,
      username: creds[0].username,
      password: creds[0].password
    } : {
      site: domain,
      username: null,
      password: null
    };
    overlayWindow.webContents.send("show-credentials", data);
    overlayWindow.center();
    overlayWindow.show();
    overlayWindow.focus();
  });
});
app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
ipcMain.on("copy-to-clipboard", (event, text) => {
  clipboard.writeText(text);
});
ipcMain.on("hide-overlay", () => {
  overlayWindow?.hide();
});
