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
  const { newOnly = true, maxRank = 20 } = options;

  // 네이버 트렌드 32개 카테고리
  const categories = [
    { id: '100', name: '비즈니스/경제' }, { id: '101', name: '맛집' },
    { id: '102', name: '세계여행' },      { id: '103', name: '패션/미용' },
    { id: '104', name: '상품리뷰' },      { id: '105', name: '육아/결혼' },
    { id: '106', name: '일상/생각' },     { id: '107', name: '국내여행' },
    { id: '108', name: '건강/의학' },     { id: '109', name: '요리/레시피' },
    { id: '110', name: '교육/학문' },     { id: '111', name: 'IT/컴퓨터' },
    { id: '112', name: '인테리어/DIY' },  { id: '113', name: '자동차' },
    { id: '114', name: '스타/연예인' },   { id: '115', name: '방송' },
    { id: '116', name: '취미' },          { id: '117', name: '스포츠' },
    { id: '118', name: '게임' },          { id: '119', name: '사회/정치' },
    { id: '120', name: '영화' },          { id: '121', name: '드라마' },
    { id: '122', name: '여학/외국어' },   { id: '123', name: '문학/책' },
    { id: '124', name: '반려동물' },      { id: '125', name: '음악' },
    { id: '126', name: '공연/전시' },     { id: '127', name: '쫄은글/이미지' },
    { id: '128', name: '원예/재배' },     { id: '129', name: '사진' },
    { id: '130', name: '만화/애니' },     { id: '131', name: '미술/디자인' }
  ];

  const results = [];
  const seen = new Set();

  for (const cat of categories) {
    try {
      const url = `https://trends.naver.com/trends/keywordsChartList.naver?period=DAILY&categoryId=${cat.id}`;
      const res = await fetch(url, {
        credentials: 'include',
        headers: { 'Accept': 'application/json, text/plain, */*' }
      });

      if (!res.ok) continue;

      const data = await res.json();
      const items = data.keywordList || [];

      for (const item of items) {
        if (item.rank > maxRank) continue;
        if (newOnly && !item.isNew) continue;
        if (!item.keyword || seen.has(item.keyword)) continue;

        seen.add(item.keyword);
        results.push({
          keyword: item.keyword,
          isNew: item.isNew || false,
          rank: item.rank || results.length + 1,
          riseRank: item.rankingChange || 0,
          category: cat.name,
          collectedAt: Date.now()
        });
      }
    } catch(e) { continue; }

    await new Promise(r => setTimeout(r, 150));
  }

  return results;
}

// ── 키워드 분석 ──────────────────────────────────────────────────────
async function analyzeKeyword({ keyword, naverClientId, naverClientSecret }) {
  try {
    // 타임아웃 5초 설정
    const timeout = (ms) => new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms));

    const [docCount, trendData] = await Promise.all([
      Promise.race([getBlogDocCount(keyword, naverClientId, naverClientSecret), timeout(5000)]).catch(() => 0),
      Promise.race([getDataLabTrend(keyword, naverClientId, naverClientSecret), timeout(5000)]).catch(() => ({ pc: 0, mobile: 0 }))
    ]);

    const total = (trendData.pc || 0) + (trendData.mobile || 0);
    const goldIndex = (docCount > 0)
      ? parseFloat(((total / (docCount || 1)) * 100).toFixed(1))
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
    return { success: true, data: { pc:0, mobile:0, total:0, docCount:0, goldIndex:null, adPc1:null, adPc2:null, adMobile1:null, adMobile2:null } };
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
