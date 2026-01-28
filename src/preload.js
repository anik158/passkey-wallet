import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
    onShowCredentials: (callback) => ipcRenderer.on('show-credentials', (_event, value) => callback(value)),
    hideOverlay: () => ipcRenderer.send('hide-overlay'),
    copyToClipboard: (text) => ipcRenderer.send('copy-to-clipboard', text)
})