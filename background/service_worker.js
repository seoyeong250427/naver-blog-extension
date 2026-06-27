// 황금키워드 도구 백그라운드 서비스 워커

// ── 아이콘 클릭 시 바로 큰 창 열기 ──────────────────────────────────
chrome.action.onClicked.addListener(async () => {
    const url = chrome.runtime.getURL('window/main.html');
    const allWindows = await chrome.windows.getAll({ populate: true });
    for (const win of allWindows) {
          for (const tab of (win.tabs || [])) {
                  if (tab.url && tab.url.includes('window/main.html')) {
                            await chrome.windows.update(win.id, { focused: true });
                            return;
                  }
          }
    }
    chrome.windows.create({ url, type: 'popup', width: 1400, height: 820, focused: true });
});

// ── 메시지 핸들러 ────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'COLLECT_TRENDS')    { collectNaverTrends(msg.options).then(sendResponse); return true; }
    if (msg.type === 'ANALYZE_KEYWORD')   { analyzeKeyword(msg).then(sendResponse); return true; }
    if (msg.type === 'TEST_NAVER_SEARCH') { testNaverSearch(msg).then(sendResponse); return true; }
    if (msg.type === 'TEST_NAVER_API')    { testNaverApi(msg).then(sendResponse); return true; }
});

// ── 트렌드 수집 ──────────────────────────────────────────────────────
async function collectNaverTrends(options) {
    try {
          const tab = await chrome.tabs.create({ url: 'https://trends.naver.com', active: false });
          await waitTabLoad(tab.id, 10000);
          const keywords = await chrome.tabs.sendMessage(tab.id, { type: 'GET_TREND_KEYWORDS', options });
          await chrome.tabs.remove(tab.id);
          if (keywords && keywords.length > 0) return { success: true, keywords };
          return { success: false, error: '키워드를 가져오지 못했습니다. 네이버에 로그인되어 있는지 확인하세요.' };
    } catch(e) {
          return { success: false, error: e.message };
    }
}

function waitTabLoad(tabId, timeout) {
    return new Promise((res, rej) => {
          const t = setTimeout(() => rej(new Error('탭 로드 시간 초과')), timeout);
          chrome.tabs.onUpdated.addListener(function fn(id, info) {
                  if (id === tabId && info.status === 'complete') {
                            clearTimeout(t);
                            chrome.tabs.onUpdated.removeListener(fn);
                            setTimeout(res, 1500);
                  }
          });
    });
}

// ── 네이버 광고 API 연결 테스트 ──────────────────────────────────────
async function testNaverApi({ customerId, accessLicense, secretKey }) {
    try {
          const result = await getAdData('테스트', customerId, accessLicense, secretKey);
          return { success: true, message: '광고 API 연결 성공!' };
    } catch(e) {
          return { success: false, error: e.message };
    }
}

// ── 네이버 검색 API 연결 테스트 ──────────────────────────────────────
async function testNaverSearch({ clientId, clientSecret }) {
    try {
          const res = await fetch(
                  'https://openapi.naver.com/v1/search/blog.json?query=테스트&display=1',
            {
                      headers: {
                                  'X-Naver-Client-Id': clientId,
                                  'X-Naver-Client-Secret': clientSecret
                      }
            }
                );
          if (!res.ok) {
                  const body = await res.text().catch(() => '');
                  return { success: false, error: `검색 API ${res.status}: ${body.slice(0, 200)}` };
          }
          const data = await res.json();
          return { success: true, message: `검색 API 연결 성공! (총 ${data.total}건)` };
    } catch(e) {
          return { success: false, error: e.message };
    }
}

// ── 키워드 분석 ──────────────────────────────────────────────────────
async function analyzeKeyword({ keyword, naverCustomerId, naverAccessLicense, naverSecretKey, naverClientId, naverClientSecret }) {
    try {
          const adData = await getAdData(keyword, naverCustomerId, naverAccessLicense, naverSecretKey);
          const docCount = await getBlogDocCount(keyword, naverClientId, naverClientSecret);
          const total = (adData.pc || 0) + (adData.mobile || 0);
          const goldIndex = (total > 0 && docCount > 0)
            ? parseFloat(((total / docCount) * 100).toFixed(1))
                  : null;
          return {
                  success: true,
                  data: { pc: adData.pc||0, mobile: adData.mobile||0, total, docCount, goldIndex,
                                       adPc1: null, adPc2: null, adMobile1: null, adMobile2: null }
          };
    } catch(e) {
          return { success: false, error: e.message };
    }
}

// ── 네이버 광고 API 데이터 조회 ──────────────────────────────────────
async function getAdData(keyword, customerId, license, secret) {
    const method = 'GET';
    const path = '/keywordstool';
    // 네이버 광고 API: 타임스탬프는 밀리초 단위
  const timestamp = String(Date.now());
    const sig = await makeSignature(timestamp, method, path, secret);
    const params = new URLSearchParams({ hintKeywords: keyword, showDetail: '1' });

  const res = await fetch(`https://manage.searchad.naver.com${path}?${params}`, {
        method,
        headers: {
                'Content-Type': 'application/json; charset=UTF-8',
                'X-Timestamp': timestamp,
                'X-API-KEY': license,
                'X-Customer': String(customerId),
                'X-Signature': sig
        }
  });

  if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`광고 API ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json();
    const item = data.keywordList?.find(k => k.relKeyword === keyword) || data.keywordList?.[0];
    if (!item) return { pc: 0, mobile: 0 };
    return {
          pc: item.monthlyPcQcCnt || 0,
          mobile: item.monthlyMobileQcCnt || 0
    };
}

// ── 블로그 문서수 조회 (네이버 검색 API 우선, 없으면 직접 파싱) ──────
async function getBlogDocCount(keyword, clientId, clientSecret) {
    // 1순위: 네이버 검색 API
  if (clientId && clientSecret) {
        try {
                const res = await fetch(
                          `https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent(keyword)}&display=1`,
                  {
                              headers: {
                                            'X-Naver-Client-Id': clientId,
                                            'X-Naver-Client-Secret': clientSecret
                              }
                  }
                        );
                if (res.ok) {
                          const data = await res.json();
                          return data.total || 0;
                }
        } catch(e) { /* fallback */ }
  }

  // 2순위: 직접 파싱
  try {
        const res = await fetch(
                `https://search.naver.com/search.naver?where=blog&query=${encodeURIComponent(keyword)}`,
          { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124' } }
              );
        const html = await res.text();
        const m1 = html.match(/총\s*([\d,]+)\s*개/);
        if (m1) return parseInt(m1[1].replace(/,/g, ''));
        const m2 = html.match(/"totalCount"\s*:\s*(\d+)/);
        if (m2) return parseInt(m2[1]);
        return 0;
  } catch { return 0; }
}

// ── HMAC-SHA256 서명 생성 ────────────────────────────────────────────
async function makeSignature(timestamp, method, path, secret) {
    const message = `${timestamp}.${method}.${path}`;
    const enc = new TextEncoder();
    const keyData = enc.encode(secret);
    const msgData = enc.encode(message);

  const cryptoKey = await crypto.subtle.importKey(
        'raw', keyData,
    { name: 'HMAC', hash: 'SHA-256' },
        false, ['sign']
      );
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
    return btoa(String.fromCharCode(...new Uint8Array(signature)));
}
