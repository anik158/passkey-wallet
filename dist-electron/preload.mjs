"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("api", {
  onShowCredentials: (callback) => electron.ipcRenderer.on("show-credentials", (_event, value) => callback(value)),
  hideOverlay: () => electron.ipcRenderer.send("hide-overlay"),
  copyToClipboard: (text) => electron.ipcRenderer.send("copy-to-clipboard", text),
  // Dashboard APIs
  getAllCredentials: () => electron.ipcRenderer.invoke("get-all-credentials"),
  addCredential: (data) => electron.ipcRenderer.invoke("add-credential", data),
  deleteCredential: (id) => electron.ipcRenderer.invoke("delete-credential", id),
  updateCredential: (data) => electron.ipcRenderer.invoke("update-credential", data),
  // Import/Export
  importFromExcel: () => electron.ipcRenderer.invoke("import-from-excel"),
  exportToExcel: () => electron.ipcRenderer.invoke("export-to-excel"),
  // Secure Backup
  importEncrypted: (password) => electron.ipcRenderer.invoke("import-encrypted", password),
  exportEncrypted: (password) => electron.ipcRenderer.invoke("export-encrypted", password)
});
