import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
    onShowCredentials: (callback) => ipcRenderer.on('show-credentials', (_event, value) => callback(value)),
    hideOverlay: () => ipcRenderer.send('hide-overlay'),
    copyToClipboard: (text) => ipcRenderer.send('copy-to-clipboard', text),
    login: (password) => ipcRenderer.invoke('login-attempt', password),
    checkDbExists: () => ipcRenderer.invoke('check-db-exists'),

    // Dashboard APIs
    getAllCredentials: () => ipcRenderer.invoke('get-all-credentials'),
    getCredentialsPage: (page, pageSize) => ipcRenderer.invoke('get-credentials-page', { page, pageSize }),
    findCredential: (domain, username) => ipcRenderer.invoke('find-credential', { domain, username }),
    addCredential: (data) => ipcRenderer.invoke('add-credential', data),
    deleteCredential: (id) => ipcRenderer.invoke('delete-credential', id),
    updateCredential: (data) => ipcRenderer.invoke('update-credential', data),

    // Import/Export
    importFromExcel: () => ipcRenderer.invoke('import-from-excel'),
    forceImportFromExcel: (validRows) => ipcRenderer.invoke('force-import-excel', validRows),

    // Secure Backup
    exportEncrypted: (password) => ipcRenderer.invoke('export-encrypted', password),
    selectBackupFile: () => ipcRenderer.invoke('select-backup-file'),
    restoreBackup: (filePath, password) => ipcRenderer.invoke('restore-backup', { filePath, password }),
    forceRestoreBackup: (decryptedData) => ipcRenderer.invoke('force-restore-backup', decryptedData),

    // Settings & Security
    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
    lockApp: () => ipcRenderer.invoke('lock-app'),
    deleteAllCredentials: () => ipcRenderer.invoke('delete-all-credentials'),
    resetActivity: () => ipcRenderer.send('reset-activity') // For tracking user activity
})