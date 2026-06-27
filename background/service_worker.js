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
  if (msg.type === 'TEST_NAVER_API')  { testNaverApi(msg).then(sendResponse); return true; }
});

// ── 트렌드 수집 ──────────────────────────────────────────────────────
async function collectNaverTrends(options) {
  const stored = await chrome.storage.local.get(['settings']);
  const clientId = stored.settings?.naverClientId;
  const clientSecret = stored.settings?.naverClientSecret;

  if (!clientId || !clientSecret) {
    return { success: false, error: '설정에서 네이버 검색 API Client ID와 Client Secret을 입력해주세요.' };
  }

  try {
    const keywords = await collectTrendKeywords(clientId, clientSecret, options);
    if (keywords && keywords.length > 0) return { success: true, keywords };
    return { success: false, error: '수집된 키워드가 없습니다.' };
  } catch(e) {
    return { success: false, error: e.message };
  }
}

async function collectTrendKeywords(clientId, clientSecret, options) {
  const { maxRank = 20 } = options;
  const results = [];
  const seen = new Set();

  // 네이버 뉴스 검색으로 트렌드 키워드 수집
  const queries = ['오늘 뉴스', '실시간 이슈', '화제', '최신 트렌드'];

  for (const q of queries) {
    try {
      const res = await fetch(
        `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(q)}&display=20&sort=date`,
        {
          headers: {
            'X-Naver-Client-Id': clientId,
            'X-Naver-Client-Secret': clientSecret
          }
        }
      );

      if (!res.ok) continue;
      const data = await res.json();

      for (const item of (data.items || [])) {
        const title = item.title.replace(/<[^>]+>/g, '').trim();
        // 2~8글자 키워드 추출
        const words = title.split(/[\s,·]+/).filter(w => w.length >= 2 && w.length <= 8 && /[가-힣]/.test(w));
        for (const word of words.slice(0, 2)) {
          if (!seen.has(word) && results.length < maxRank * 2) {
            seen.add(word);
            results.push({
              keyword: word,
              isNew: true,
              rank: results.length + 1,
              category: '뉴스트렌드',
              collectedAt: Date.now()
            });
          }
        }
      }
    } catch(e) { continue; }
  }

  // 블로그 검색으로 추가 수집
  try {
    const res = await fetch(
      `https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent('오늘')}&display=20&sort=date`,
      {
        headers: {
          'X-Naver-Client-Id': clientId,
          'X-Naver-Client-Secret': clientSecret
        }
      }
    );
    if (res.ok) {
      const data = await res.json();
      for (const item of (data.items || [])) {
        const title = item.title.replace(/<[^>]+>/g, '').trim();
        const words = title.split(/[\s,·]+/).filter(w => w.length >= 2 && w.length <= 8 && /[가-힣]/.test(w));
        for (const word of words.slice(0, 2)) {
          if (!seen.has(word) && results.length < maxRank * 3) {
            seen.add(word);
            results.push({
              keyword: word,
              isNew: true,
              rank: results.length + 1,
              category: '블로그트렌드',
              collectedAt: Date.now()
            });
          }
        }
      }
    }
  } catch(e) {}

  return results.slice(0, maxRank);
}

// ── 키워드 분석 ──────────────────────────────────────────────────────
async function analyzeKeyword({ keyword, naverClientId, naverClientSecret }) {
  try {
    const docCount = await getBlogDocCount(keyword, naverClientId, naverClientSecret);
    const trendData = await getDataLabTrend(keyword, naverClientId, naverClientSecret);
    const total = (trendData.pc || 0) + (trendData.mobile || 0);
    const goldIndex = (total > 0 && docCount > 0)
      ? parseFloat(((total / docCount) * 100).toFixed(1))
      : null;

    return {
      success: true,
      data: {
        pc: trendData.pc || 0,
        mobile: trendData.mobile || 0,
        total,
        docCount,
        goldIndex,
        adPc1: null, adPc2: null, adMobile1: null, adMobile2: null
      }
    };
  } catch(e) {
    return { success: false, error: e.message };
  }
}

// ── 데이터랩 트렌드 조회 ─────────────────────────────────────────────
async function getDataLabTrend(keyword, clientId, clientSecret) {
  if (!clientId || !clientSecret) return { pc: 0, mobile: 0 };

  const now = new Date();
  const endDate = now.toISOString().slice(0, 10);
  const startDate = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  let pc = 0, mobile = 0;

  try {
    const resPc = await fetch('https://openapi.naver.com/v1/datalab/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret
      },
      body: JSON.stringify({
        startDate, endDate, timeUnit: 'month',
        keywordGroups: [{ groupName: keyword, keywords: [keyword] }],
        device: 'pc'
      })
    });

    if (resPc.ok) {
      const d = await resPc.json();
      const data = d.results?.[0]?.data;
      if (data?.length > 0) pc = Math.round(data[data.length - 1].ratio * 1000);
    }

    const resMo = await fetch('https://openapi.naver.com/v1/datalab/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret
      },
      body: JSON.stringify({
        startDate, endDate, timeUnit: 'month',
        keywordGroups: [{ groupName: keyword, keywords: [keyword] }],
        device: 'mo'
      })
    });

    if (resMo.ok) {
      const d = await resMo.json();
      const data = d.results?.[0]?.data;
      if (data?.length > 0) mobile = Math.round(data[data.length - 1].ratio * 1000);
    }
  } catch(e) {}

  return { pc, mobile };
}

// ── 블로그 문서수 조회 ───────────────────────────────────────────────
async function getBlogDocCount(keyword, clientId, clientSecret) {
  if (clientId && clientSecret) {
    try {
      const res = await fetch(
        `https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent(keyword)}&display=1`,
        { headers: { 'X-Naver-Client-Id': clientId, 'X-Naver-Client-Secret': clientSecret } }
      );
      if (res.ok) {
        const data = await res.json();
        return data.total || 0;
      }
    } catch(e) {}
  }

  try {
    const res = await fetch(
      `https://search.naver.com/search.naver?where=blog&query=${encodeURIComponent(keyword)}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    const html = await res.text();
    const m = html.match(/총\s*([\d,]+)\s*개/);
    if (m) return parseInt(m[1].replace(/,/g, ''));
    return 0;
  } catch { return 0; }
}

// ── API 연결 테스트 ──────────────────────────────────────────────────
async function testNaverApi({ naverCustomerId, naverAccessLicense, naverSecretKey }) {
  return { success: false, error: '광고 API는 현재 미사용입니다.' };
}
