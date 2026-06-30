// Electron 메인 프로세스
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const NaverAd = require('./api/naver-ad');
const NaverTrends = require('./api/naver-trends');

let mainWindow;

function getDataPath() {
  // userData 경로 대신 앱 폴더 옆에 고정 경로 사용 (실행 방식에 따라 userData가 바뀌는 문제 방지)
  return path.join(__dirname, 'appdata.json');
}

function loadAppData() {
  try {
    const p = getDataPath();
    if (!fs.existsSync(p)) return {};
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch { return {}; }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400, height: 820, minWidth: 1000, minHeight: 600,
    icon: path.join(__dirname, 'icons', 'icon128.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: '황금키워드 도구',
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'main.html'));
  mainWindow.setMenuBarVisibility(false);
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// ── IPC: 트렌드 키워드 수집 ──────────────────────────────────────
ipcMain.handle('collect-trends', async (_event, params = {}) => {
  try {
    const data = loadAppData();
    const settings = data.settings || {};
    const clientId = params.clientId || settings.naverClientId || '';
    const clientSecret = params.clientSecret || settings.naverClientSecret || '';
    const results = await NaverTrends.collectAll({ clientId, clientSecret });
    return { success: true, data: results };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ── IPC: 광고 API 키워드 분석 ─────────────────────────────────────
ipcMain.handle('analyze-keywords', async (_event, { keywords, customerId, apiKey, secretKey }) => {
  try {
    const result = await NaverAd.getKeywordStats(keywords, customerId, apiKey, secretKey);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ── IPC: 외부 링크 열기 ──────────────────────────────────────────
ipcMain.handle('open-external', async (_event, url) => {
  await shell.openExternal(url);
});

// ── IPC: 데이터 저장 ─────────────────────────────────────────────
ipcMain.handle('save-data', async (_event, newData) => {
  try {
    const existing = loadAppData();
    fs.writeFileSync(getDataPath(), JSON.stringify({ ...existing, ...newData }, null, 2), 'utf-8');
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ── IPC: 데이터 로드 ─────────────────────────────────────────────
ipcMain.handle('load-data', async () => {
  return loadAppData();
});
