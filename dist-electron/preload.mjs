"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("api", {
  onShowCredentials: (callback) => electron.ipcRenderer.on("show-credentials", (_event, value) => callback(value)),
  hideOverlay: () => electron.ipcRenderer.send("hide-overlay"),
  copyToClipboard: (text) => electron.ipcRenderer.send("copy-to-clipboard", text),
  login: (password) => electron.ipcRenderer.invoke("login-attempt", password),
  checkDbExists: () => electron.ipcRenderer.invoke("check-db-exists"),
  // Dashboard APIs
  getAllCredentials: () => electron.ipcRenderer.invoke("get-all-credentials"),
  getCredentialsPage: (page, pageSize) => electron.ipcRenderer.invoke("get-credentials-page", { page, pageSize }),
  addCredential: (data) => electron.ipcRenderer.invoke("add-credential", data),
  deleteCredential: (id) => electron.ipcRenderer.invoke("delete-credential", id),
  updateCredential: (data) => electron.ipcRenderer.invoke("update-credential", data),
  // Import/Export
  importFromExcel: () => electron.ipcRenderer.invoke("import-from-excel"),
  // Secure Backup
  exportEncrypted: (password) => electron.ipcRenderer.invoke("export-encrypted", password),
  selectBackupFile: () => electron.ipcRenderer.invoke("select-backup-file"),
  restoreBackup: (filePath, password) => electron.ipcRenderer.invoke("restore-backup", { filePath, password }),
  // Settings & Security
  getSettings: () => electron.ipcRenderer.invoke("get-settings"),
  saveSettings: (settings) => electron.ipcRenderer.invoke("save-settings", settings),
  lockApp: () => electron.ipcRenderer.invoke("lock-app"),
  deleteAllCredentials: () => electron.ipcRenderer.invoke("delete-all-credentials")
});
