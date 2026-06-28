// Electron 메인 프로세스 - 창 생성 및 IPC 핸들러
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const NaverTrends = require('./api/naver-trends');
const NaverAd = require('./api/naver-ad');

// 데이터 파일 경로 - 앱 userData 폴더에 영구 저장
function getDataPath() {
  return path.join(app.getPath('userData'), 'appdata.json');
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 820,
    minWidth: 1000,
    minHeight: 600,
    icon: path.join(__dirname, 'icons', 'icon128.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'default',
    title: '황금키워드 도구',
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'main.html'));
  mainWindow.setMenuBarVisibility(false);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ── IPC 핸들러: 네이버 트렌드 수집 ──
ipcMain.handle('collect-trends', async (_event, categories) => {
  try {
    const result = await NaverTrends.collectAll(categories);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ── IPC 핸들러: 네이버 광고 API 키워드 분석 ──
ipcMain.handle('analyze-keywords', async (_event, { keywords, customerId, apiKey, secretKey }) => {
  try {
    const result = await NaverAd.getKeywordStats(keywords, customerId, apiKey, secretKey);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ── IPC 핸들러: 외부 링크 열기 ──
ipcMain.handle('open-external', async (_event, url) => {
  await shell.openExternal(url);
});

// ── IPC 핸들러: 데이터 저장 ──
ipcMain.handle('save-data', async (_event, data) => {
  try {
    const filePath = getDataPath();
    let existing = {};
    if (fs.existsSync(filePath)) {
      existing = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
    const merged = { ...existing, ...data };
    fs.writeFileSync(filePath, JSON.stringify(merged, null, 2), 'utf-8');
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ── IPC 핸들러: 데이터 로드 ──
ipcMain.handle('load-data', async () => {
  try {
    const filePath = getDataPath();
    if (!fs.existsSync(filePath)) return {};
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (err) {
    return {};
  }
});
