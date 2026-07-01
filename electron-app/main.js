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

// ── 네이버 로그인 창 (크리에이터 어드바이저 세션용) ─────────────────
ipcMain.handle('naver-login', async () => {
  return new Promise((resolve) => {
    const loginWin = new BrowserWindow({
      width: 500,
      height: 600,
      title: '네이버 로그인',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        partition: 'persist:naver',
      },
    });

    loginWin.loadURL('https://nid.naver.com/nidlogin.login');

    // 로그인 완료 감지 - nidlogin 페이지를 벗어나면 완료로 처리
    loginWin.webContents.on('did-navigate', (_e, url) => {
      if (url.includes('naver.com') && !url.includes('nidlogin')) {
        loginWin.destroy();
        resolve({ success: true });
      }
    });

    loginWin.on('closed', () => resolve({ success: false, error: '창을 닫았습니다.' }));
  });
});

// ── 크리에이터 어드바이저에서 실시간 트렌드 수집 (로그인 세션 재사용) ─
// 쿠키 문자열을 따로 저장하지 않고, 로그인 세션이 담긴 페이지 안에서
// 직접 fetch를 호출해 브라우저가 쿠키를 자동으로 관리하게 한다.
function collectFromAdvisor(blogId) {
  return new Promise((resolve) => {
    const crawler = new BrowserWindow({
      width: 1200,
      height: 900,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        partition: 'persist:naver',
      },
    });

    const targetUrl = `https://creator-advisor.naver.com/naver_blog/${blogId}/trends`;

    const timeout = setTimeout(() => {
      if (!crawler.isDestroyed()) crawler.destroy();
      resolve({ success: false, error: '크리에이터 어드바이저 응답 시간 초과' });
    }, 40000);

    crawler.loadURL(targetUrl);

    crawler.webContents.on('did-finish-load', async () => {
      try {
        await new Promise(r => setTimeout(r, 1500));

        const currentUrl = crawler.webContents.getURL();
        if (currentUrl.includes('nidlogin')) {
          clearTimeout(timeout);
          crawler.destroy();
          resolve({ success: false, error: 'LOGIN_REQUIRED' });
          return;
        }

        const categories = Object.keys(NaverTrends.CATEGORY_SEEDS);
        const raw = await crawler.webContents.executeJavaScript(`
          (async () => {
            const categories = ${JSON.stringify(categories)};
            const today = new Date().toISOString().slice(0, 10);
            const out = {};
            for (const cat of categories) {
              try {
                const url = 'https://creator-advisor.naver.com/api/v6/trend/category?categories='
                  + encodeURIComponent(cat)
                  + '&contentType=text&date=' + today
                  + '&hasRankChange=true&interval=day&limit=20&service=naver_blog';
                const res = await fetch(url, { credentials: 'include', headers: { 'Accept': 'application/json' } });
                if (res.ok) out[cat] = await res.json();
              } catch (e) {}
              await new Promise(r => setTimeout(r, 150));
            }
            return out;
          })()
        `);

        clearTimeout(timeout);
        crawler.destroy();
        resolve({ success: true, raw });
      } catch (err) {
        clearTimeout(timeout);
        if (!crawler.isDestroyed()) crawler.destroy();
        resolve({ success: false, error: err.message });
      }
    });
  });
}

// ── IPC: 트렌드 키워드 수집 ──────────────────────────────────────
// 블로그 아이디가 설정돼 있으면 크리에이터 어드바이저(실시간 트렌드)를 먼저 시도하고,
// 로그인이 안 돼있거나 실패하면 자동완성 기반 방식으로 대체한다.
ipcMain.handle('collect-trends', async (_event, params = {}) => {
  try {
    const data = loadAppData();
    const settings = data.settings || {};
    const clientId = params.clientId || settings.naverClientId || '';
    const clientSecret = params.clientSecret || settings.naverClientSecret || '';
    const blogId = params.blogId || settings.sBlogId || '';

    if (blogId) {
      const advisorRes = await collectFromAdvisor(blogId);
      if (advisorRes.error === 'LOGIN_REQUIRED') {
        return { success: false, error: 'LOGIN_REQUIRED' };
      }
      if (advisorRes.success) {
        const results = NaverTrends.normalizeAdvisorRaw(advisorRes.raw);
        if (results.length > 0) {
          return { success: true, data: results, source: 'advisor' };
        }
      }
      console.warn('크리에이터 어드바이저 수집 실패, 자동완성 방식으로 대체:', advisorRes.error);
    }

    const results = await NaverTrends.collectAll({ clientId, clientSecret });
    return { success: true, data: results, source: 'autocomplete' };
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
