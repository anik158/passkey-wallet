import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('ipc', {
    send: (channel, data) => ipcRenderer.send(channel, data)
})
