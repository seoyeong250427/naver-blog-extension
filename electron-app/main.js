// Electron 메인 프로세스
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const NaverAd = require('./api/naver-ad');

let mainWindow;
let naverSession; // 네이버 로그인 세션용 파티션

function getDataPath() {
  return path.join(app.getPath('userData'), 'appdata.json');
}

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
    title: '황금키워드 도구',
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'main.html'));
  mainWindow.setMenuBarVisibility(false);
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// ── 네이버 로그인 창 띄우기 ──────────────────────────────────────
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

    // 로그인 완료 감지 - 네이버 메인으로 이동하면 완료
    loginWin.webContents.on('did-navigate', (e, url) => {
      if (url.includes('naver.com') && !url.includes('nidlogin')) {
        loginWin.destroy();
        resolve({ success: true });
      }
    });

    loginWin.on('closed', () => resolve({ success: false, error: '창을 닫았습니다.' }));
  });
});

// ── 크리에이터 어드바이저 크롤링 ─────────────────────────────────
ipcMain.handle('collect-trends', async () => {
  return new Promise((resolve) => {
    const crawler = new BrowserWindow({
      width: 1200,
      height: 900,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        partition: 'persist:naver', // 로그인 세션 재사용
      },
    });

    const TARGET_URL = 'https://creator-advisor.naver.com/naver_blog/foodlover1109/trends';

    crawler.loadURL(TARGET_URL);

    // 타임아웃 30초
    const timeout = setTimeout(() => {
      if (!crawler.isDestroyed()) crawler.destroy();
      resolve({ success: false, error: '크롤링 타임아웃' });
    }, 30000);

    crawler.webContents.on('did-finish-load', async () => {
      try {
        // 페이지 완전 렌더링 대기
        await new Promise(r => setTimeout(r, 3000));

        // 현재 URL 확인 - 로그인 페이지로 리다이렉트됐는지 체크
        const currentUrl = crawler.webContents.getURL();
        if (currentUrl.includes('nidlogin')) {
          clearTimeout(timeout);
          crawler.destroy();
          resolve({ success: false, error: 'LOGIN_REQUIRED' });
          return;
        }

        // 키워드 추출
        const data = await crawler.webContents.executeJavaScript(`
          (function() {
            const results = [];
            const seen = new Set();

            // 카테고리별 키워드 목록 추출
            // 여러 셀렉터 시도
            const keywordSelectors = [
              '.keyword_item .keyword_text',
              '.trend_keyword .keyword',
              '.item_keyword',
              'li.keyword_item',
              '.keyword_list li',
              '.trend_list .item',
              '[class*="keyword"] [class*="text"]',
              '[class*="KeywordItem"]',
              '[class*="keyword-item"]',
            ];

            // 카테고리 셀렉터
            const catSelectors = [
              '.category_name',
              '[class*="category"] [class*="name"]',
              '.tab_name',
              '[class*="Category"]',
            ];

            // 페이지 전체 텍스트에서 추출 시도
            const allItems = document.querySelectorAll('li, .item, [class*="rank"], [class*="keyword"]');
            
            allItems.forEach(el => {
              const text = el.textContent.trim();
              if (text.length > 1 && text.length < 20 && !seen.has(text)) {
                // 숫자나 특수문자로만 이루어진 것 제외
                if (!/^[0-9\\s▲▼-]+$/.test(text)) {
                  seen.add(text);
                  // 부모에서 카테고리 찾기
                  const section = el.closest('section, article, div[class*="category"], div[class*="Category"]');
                  const catEl = section ? section.querySelector('h2, h3, h4, [class*="title"], [class*="name"]') : null;
                  const category = catEl ? catEl.textContent.trim() : '트렌드';
                  results.push({ keyword: text, category });
                }
              }
            });

            return {
              results: results.slice(0, 200),
              url: location.href,
              title: document.title,
              bodyText: document.body.innerText.slice(0, 3000)
            };
          })()
        `);

        clearTimeout(timeout);
        crawler.destroy();

        if (data.results.length > 0) {
          const keywords = data.results.map((item, i) => ({
            keyword: item.keyword,
            rank: i + 1,
            category: item.category,
            isNew: false,
            collectedAt: Date.now(),
          }));
          resolve({ success: true, data: keywords });
        } else {
          // 키워드 못 찾으면 페이지 텍스트 디버그용으로 전달
          console.log('페이지 텍스트:', data.bodyText);
          resolve({ success: false, error: 'NO_DATA', debug: data.bodyText });
        }
      } catch (err) {
        clearTimeout(timeout);
        if (!crawler.isDestroyed()) crawler.destroy();
        resolve({ success: false, error: err.message });
      }
    });

    crawler.on('closed', () => {
      clearTimeout(timeout);
      resolve({ success: false, error: '창이 닫혔습니다.' });
    });
  });
});

// ── IPC: 광고 API 키워드 분석 ────────────────────────────────────
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
ipcMain.handle('save-data', async (_event, data) => {
  try {
    const filePath = getDataPath();
    let existing = {};
    if (fs.existsSync(filePath)) existing = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    fs.writeFileSync(filePath, JSON.stringify({ ...existing, ...data }, null, 2), 'utf-8');
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ── IPC: 데이터 로드 ─────────────────────────────────────────────
ipcMain.handle('load-data', async () => {
  try {
    const filePath = getDataPath();
    if (!fs.existsSync(filePath)) return {};
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch { return {}; }
});
