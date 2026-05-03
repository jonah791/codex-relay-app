const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  getProviders: () => ipcRenderer.invoke('get-providers'),
  saveConfig: (cfg) => ipcRenderer.invoke('save-config', cfg),
});
