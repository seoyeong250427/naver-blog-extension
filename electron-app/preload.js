// preload.js - 메인 프로세스 ↔ 렌더러 브릿지
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // 네이버 트렌드 32개 카테고리 수집
  collectTrends: (categories) => ipcRenderer.invoke('collect-trends', categories),

  // 네이버 광고 API 키워드 분석
  analyzeKeywords: (params) => ipcRenderer.invoke('analyze-keywords', params),

  // 외부 브라우저로 URL 열기
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
});
