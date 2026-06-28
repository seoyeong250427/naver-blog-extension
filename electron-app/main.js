// Electron 메인 프로세스 - 창 생성 및 IPC 핸들러
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const NaverAd = require('./api/naver-ad');

let mainWindow;

// 데이터 파일 경로
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

// ── IPC: 네이버 트렌드 크롤링 (내장 브라우저 사용) ──────────────────
ipcMain.handle('collect-trends', async (_event, { clientId, clientSecret } = {}) => {
  return new Promise((resolve) => {
    // 숨겨진 크롤링용 창 생성
    const crawler = new BrowserWindow({
      width: 1200,
      height: 800,
      show: false, // 숨김
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        partition: 'persist:naver', // 네이버 로그인 세션 유지
      },
    });

    const results = [];
    const seen = new Set();
    let processed = 0;

    // 네이버 데이터랩 카테고리별 트렌드 페이지
    const DATALAB_CATEGORIES = [
      { id: 'home',          name: '생활' },
      { id: 'food',          name: '음식' },
      { id: 'sports',        name: '스포츠' },
      { id: 'beauty',        name: '미용' },
      { id: 'health',        name: '건강' },
      { id: 'travel',        name: '여행' },
      { id: 'entertainment', name: '연예' },
      { id: 'game',          name: '게임' },
      { id: 'pet',           name: '반려동물' },
      { id: 'politics',      name: '정치사회' },
      { id: 'it',            name: 'IT' },
      { id: 'economy',       name: '경제' },
      { id: 'culture',       name: '문화' },
      { id: 'fashion',       name: '패션' },
      { id: 'parenting',     name: '육아' },
      { id: 'education',     name: '교육' },
    ];

    let catIndex = 0;

    async function crawlNext() {
      if (catIndex >= DATALAB_CATEGORIES.length) {
        crawler.destroy();
        console.log(`크롤링 완료: ${results.length}개`);
        resolve({ success: true, data: results });
        return;
      }

      const cat = DATALAB_CATEGORIES[catIndex++];
      const url = `https://datalab.naver.com/keyword/trendSearch.naver?categoryId=${cat.id}`;

      try {
        await crawler.loadURL(url);

        // 페이지 로딩 대기
        await new Promise(r => setTimeout(r, 2000));

        // 키워드 추출
        const keywords = await crawler.webContents.executeJavaScript(`
          (function() {
            const items = [];
            // 데이터랩 트렌드 키워드 셀렉터
            const selectors = [
              '.keyword_list .item .keyword',
              '.trend_keyword_list li .keyword',
              '.list_keyword li',
              'li.item span.keyword',
              '.keyword_rank_list li',
            ];
            for (const sel of selectors) {
              const els = document.querySelectorAll(sel);
              if (els.length > 0) {
                els.forEach(el => {
                  const text = el.textContent.trim();
                  if (text && text.length > 1 && text.length < 30) items.push(text);
                });
                break;
              }
            }
            // 못 찾으면 페이지 텍스트에서 추출 시도
            if (items.length === 0) {
              const allText = document.body.innerText;
              return { items, html: document.body.innerHTML.slice(0, 2000) };
            }
            return { items, html: '' };
          })()
        `);

        if (keywords.items.length > 0) {
          keywords.items.slice(0, 10).forEach((kw, i) => {
            if (seen.has(kw)) return;
            seen.add(kw);
            results.push({
              keyword: kw,
              rank: i + 1,
              category: cat.name,
              isNew: false,
              collectedAt: Date.now(),
            });
          });
          console.log(`${cat.name}: ${keywords.items.length}개 수집`);
        } else {
          console.log(`${cat.name}: 키워드 없음`, keywords.html.slice(0, 200));
        }
      } catch (err) {
        console.error(`${cat.name} 크롤링 오류:`, err.message);
      }

      // 다음 카테고리
      setTimeout(crawlNext, 500);
    }

    crawler.on('closed', () => {
      if (results.length === 0) {
        resolve({ success: false, error: '크롤링 실패' });
      }
    });

    crawlNext();

    // 2분 타임아웃
    setTimeout(() => {
      if (!crawler.isDestroyed()) crawler.destroy();
      resolve({ success: true, data: results });
    }, 120000);
  });
});

// ── IPC: 네이버 광고 API 키워드 분석 ──────────────────────────────
ipcMain.handle('analyze-keywords', async (_event, { keywords, customerId, apiKey, secretKey }) => {
  try {
    const result = await NaverAd.getKeywordStats(keywords, customerId, apiKey, secretKey);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ── IPC: 외부 링크 열기 ───────────────────────────────────────────
ipcMain.handle('open-external', async (_event, url) => {
  await shell.openExternal(url);
});

// ── IPC: 데이터 저장 ──────────────────────────────────────────────
ipcMain.handle('save-data', async (_event, data) => {
  try {
    const filePath = getDataPath();
    let existing = {};
    if (fs.existsSync(filePath)) {
      existing = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
    fs.writeFileSync(filePath, JSON.stringify({ ...existing, ...data }, null, 2), 'utf-8');
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ── IPC: 데이터 로드 ──────────────────────────────────────────────
ipcMain.handle('load-data', async () => {
  try {
    const filePath = getDataPath();
    if (!fs.existsSync(filePath)) return {};
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return {};
  }
});
