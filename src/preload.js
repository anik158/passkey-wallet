import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
    onShowCredentials: (callback) => ipcRenderer.on('show-credentials', (_event, value) => callback(value)),
    hideOverlay: () => ipcRenderer.send('hide-overlay'),
    copyToClipboard: (text) => ipcRenderer.send('copy-to-clipboard', text),

    // Dashboard APIs
    getAllCredentials: () => ipcRenderer.invoke('get-all-credentials'),
    addCredential: (data) => ipcRenderer.invoke('add-credential', data),
    deleteCredential: (id) => ipcRenderer.invoke('delete-credential', id),
    updateCredential: (data) => ipcRenderer.invoke('update-credential', data),

    // Import/Export
    importFromExcel: () => ipcRenderer.invoke('import-from-excel'),
    exportToExcel: () => ipcRenderer.invoke('export-to-excel'),

    // Secure Backup
    importEncrypted: (password) => ipcRenderer.invoke('import-encrypted', password),
    exportEncrypted: (password) => ipcRenderer.invoke('export-encrypted', password)
})