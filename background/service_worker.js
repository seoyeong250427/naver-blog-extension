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
  if (msg.type === 'COLLECT_TRENDS')  { collectNaverTrends(msg.options).then(sendResponse); return true; }
  if (msg.type === 'ANALYZE_KEYWORD') { analyzeKeyword(msg).then(sendResponse); return true; }
  if (msg.type === 'TEST_NAVER_SEARCH') { testNaverSearch(msg).then(sendResponse); return true; }
  if (msg.type === 'TEST_NAVER_API')  { testNaverApi(msg).then(sendResponse); return true; }
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

// ── 키워드 분석 ──────────────────────────────────────────────────────
async function analyzeKeyword({ keyword, naverCustomerId, naverAccessLicense, naverSecretKey, naverClientId, naverClientSecret }) {
  try {
    const adData   = await getAdData(keyword, naverCustomerId, naverAccessLicense, naverSecretKey);
    const docCount = await getBlogDocCount(keyword, naverClientId, naverClientSecret);
    const total    = (adData.pc || 0) + (adData.mobile || 0);
    const goldIndex = (total > 0 && docCount > 0)
      ? parseFloat(((total / docCount) * 100).toFixed(1))
      : null;
    return {
      success: true,
      data: { pc: adData.pc||0, mobile: adData.mobile||0, total, docCount, goldIndex,
              adPc1:null, adPc2:null, adMobile1:null, adMobile2:null }
    };
  } catch(e) {
    return { success: false, error: e.message };
  }
}

async function getAdData(keyword, customerId, license, secret) {
  const method = 'GET';
  const path   = '/keywordstool';
  const timestamp = String(Date.now());
  const sig = await makeSignature(timestamp, method, path, secret);
  const params = new URLSearchParams({ hintKeywords: keyword, showDetail: '1' });

  const res = await fetch(`https://manage.searchad.naver.com${path}?${params}`, {
    method,
    headers: {
      'Content-Type':  'application/json',
      'X-Timestamp':   timestamp,
      'X-API-KEY':     license,
      'X-Customer':    String(customerId),
      'X-Signature':   sig,
      'Accept':        'application/json',
      'Cache-Control': 'no-cache'
    }
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`광고 API ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  const item = data.keywordList?.find(k => k.relKeyword === keyword) || data.keywordList?.[0];
  if (!item) return { pc: 0, mobile: 0 };
  return { pc: item.monthlyPcQcCnt || 0, mobile: item.monthlyMobileQcCnt || 0 };
}

async function getBlogDocCount(keyword) {
  try {
    const res = await fetch(
      `https://search.naver.com/search.naver?where=blog&query=${encodeURIComponent(keyword)}`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120' } }
    );
    const html = await res.text();
    const m1 = html.match(/총\s*([\d,]+)\s*개/);
    if (m1) return parseInt(m1[1].replace(/,/g, ''));
    const m2 = html.match(/(\d[\d,]*)\s*건/);
    if (m2) return parseInt(m2[1].replace(/,/g, ''));
    return 0;
  } catch { return 0; }
}

// ✅ HMAC-SHA256 서명 생성
async function makeSignature(timestamp, method, path, secret) {
  const message = `${timestamp}.${method}.${path}`;
  const enc     = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

async function testNaverApi({ naverCustomerId, naverAccessLicense, naverSecretKey }) {
  try {
    await getAdData('블로그', naverCustomerId, naverAccessLicense, naverSecretKey);
    return { success: true };
  } catch(e) {
    return { success: false, error: e.message };
  }
}
