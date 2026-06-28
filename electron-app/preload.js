// preload.js - 메인 프로세스 ↔ 렌더러 브릿지
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  collectTrends: (params) => ipcRenderer.invoke('collect-trends', params),
  analyzeKeywords: (params) => ipcRenderer.invoke('analyze-keywords', params),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  saveData: (data) => ipcRenderer.invoke('save-data', data),
  loadData: () => ipcRenderer.invoke('load-data'),
});
