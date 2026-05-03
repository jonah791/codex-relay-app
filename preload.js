const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  getProviders: () => ipcRenderer.invoke('get-providers'),
  saveConfig: (cfg) => ipcRenderer.invoke('save-config', cfg),
  fetchCodexModels: () => ipcRenderer.invoke('fetch-codex-models'),
  fetchUpstreamModels: (url, key) => ipcRenderer.invoke('fetch-upstream-models', url, key),
});
