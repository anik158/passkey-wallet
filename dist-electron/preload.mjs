"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("api", {
  onShowCredentials: (callback) => electron.ipcRenderer.on("show-credentials", (_event, value) => callback(value)),
  hideOverlay: () => electron.ipcRenderer.send("hide-overlay"),
  copyToClipboard: (text) => electron.ipcRenderer.send("copy-to-clipboard", text)
});
