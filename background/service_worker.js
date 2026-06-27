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
  const stored = await chrome.storage.local.get(['settings']);
  const clientId = stored.settings?.naverClientId;
  const clientSecret = stored.settings?.naverClientSecret;

  if (!clientId || !clientSecret) {
    return { success: false, error: '설정에서 네이버 검색 API Client ID와 Client Secret을 입력해주세요.' };
  }

  try {
    const keywords = await getTrendKeywordsFromDataLab(clientId, clientSecret, options);
    if (keywords && keywords.length > 0) return { success: true, keywords };
    return { success: false, error: '수집된 키워드가 없습니다.' };
  } catch(e) {
    return { success: false, error: e.message };
  }
}

async function getTrendKeywordsFromDataLab(clientId, clientSecret, options) {
  const { newOnly = true, maxRank = 20 } = options;
  
  // 네이버 32개 카테고리 매핑
  const categories = [
    { id: '100', name: '비지니스/경제' }, { id: '101', name: '맛집' },
    { id: '102', name: '세계여행' }, { id: '103', name: '패션/미용' },
    { id: '104', name: '상품리뷰' }, { id: '105', name: '육아/결혼' },
    { id: '106', name: '일상/생각' }, { id: '107', name: '국내여행' },
    { id: '108', name: '건강/의학' }, { id: '109', name: '요리/레시피' },
    { id: '110', name: '교육/학문' }, { id: '111', name: 'IT/컴퓨터' },
    { id: '112', name: '인테리어/DIY' }, { id: '113', name: '자동차' },
    { id: '114', name: '스타/연예인' }, { id: '115', name: '방송' },
    { id: '116', name: '취미' }, { id: '117', name: '스포츠' },
    { id: '118', name: '게임' }, { id: '119', name: '사회/정치' },
    { id: '120', name: '영화' }, { id: '121', name: '드라마' },
    { id: '122', name: '여학/외국어' }, { id: '123', name: '문학/책' },
    { id: '124', name: '반려동물' }, { id: '125', name: '음악' },
    { id: '126', name: '공연/전시' }, { id: '127', name: '쫄은글/이미지' },
    { id: '128', name: '원예/재배' }, { id: '129', name: '사진' },
    { id: '130', name: '만화/애니' }, { id: '131', name: '미술/디자인' }
  ];

  const results = [];
  const seen = new Set();

  for (const cat of categories) {
    try {
      // 네이버 트렌드 카테고리별 키워드 API
      const url = `https://trends.naver.com/trends/keywordsChartList.naver?period=DAILY&categoryId=${cat.id}`;
      const res = await fetch(url, {
        headers: {
          'X-Naver-Client-Id': clientId,
          'X-Naver-Client-Secret': clientSecret,
          'Accept': 'application/json'
        }
      });

      if (!res.ok) continue;
      
      const data = await res.json();
      const items = data.keywordList || [];

      for (const item of items.slice(0, maxRank)) {
        const kw = item.keyword;
        const isNew = item.isNew || false;
        
        if (!kw || seen.has(kw)) continue;
        if (newOnly && !isNew) continue;
        
        seen.add(kw);
        results.push({
          keyword: kw,
          isNew,
          rank: item.rank || results.length + 1,
          category: cat.name,
          collectedAt: Date.now()
        });
      }
    } catch(e) {
      continue;
    }

    await new Promise(r => setTimeout(r, 100));
  }

  return results;
}


// 네이버 검색 API로 트렌드 키워드 수집
async function getTrendKeywordsFromAPI(clientId, clientSecret, options) {
  const categories = [
    'ALL', 'SOCIETY', 'LIFE', 'WORLD', 'CULTURE',
    'TRAVEL', 'FOOD', 'SPORTS', 'ENTERTAINMENT'
  ];

  const keywords = [];
  const seen = new Set();

  for (const category of categories) {
    try {
      const res = await fetch(
        `https://openapi.naver.com/v1/search/trend.json?category=${category}&timeUnit=date`,
        {
          headers: {
            'X-Naver-Client-Id': clientId,
            'X-Naver-Client-Secret': clientSecret
          }
        }
      );

      if (!res.ok) continue;
      const data = await res.json();
      
      if (data.results) {
        for (const item of data.results) {
          const kw = item.keyword || item.title;
          if (kw && !seen.has(kw)) {
            seen.add(kw);
            keywords.push({
              keyword: kw,
              isNew: true,
              rank: keywords.length + 1,
              category: category,
              collectedAt: Date.now()
            });
          }
        }
      }
    } catch(e) { continue; }
  }

  return keywords;
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
              await getAdData('테스트', customerId, accessLicense, secretKey);
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

// ── 키워드 분석 - 데이터랩 API 사용 ────────────────────────────────
async function analyzeKeyword({ keyword, naverClientId, naverClientSecret }) {
  try {
    // 1) 데이터랩 API로 검색 트렌드 조회
    const trendData = await getDataLabTrend(keyword, naverClientId, naverClientSecret);
    
    // 2) 네이버 검색 API로 블로그 문서수 조회
    const docCount = await getBlogDocCount(keyword, naverClientId, naverClientSecret);
    
    // 3) 황금지수 계산 (트렌드 비율 / 블로그문서수 * 1000)
    const trendRatio = trendData.ratio || 0;
    const goldIndex = (trendRatio > 0 && docCount > 0)
      ? parseFloat(((trendRatio / docCount) * 100000).toFixed(1))
      : null;

    return {
      success: true,
      data: {
        pc: trendData.pc || 0,
        mobile: trendData.mobile || 0,
        total: (trendData.pc || 0) + (trendData.mobile || 0),
        docCount,
        goldIndex,
        adPc1: null, adPc2: null, adMobile1: null, adMobile2: null
      }
    };
  } catch(e) {
    return { success: false, error: e.message };
  }
}

// 데이터랩 검색어트렌드 API
async function getDataLabTrend(keyword, clientId, clientSecret) {
  if (!clientId || !clientSecret) throw new Error('네이버 검색 API 키를 설정에서 입력하세요.');

  const now = new Date();
  const endDate = now.toISOString().slice(0, 10);
  const startDate = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const body = JSON.stringify({
    startDate,
    endDate,
    timeUnit: 'month',
    keywordGroups: [{ groupName: keyword, keywords: [keyword] }],
    device: 'pc'
  });

  const resPc = await fetch('https://openapi.naver.com/v1/datalab/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Naver-Client-Id': clientId,
      'X-Naver-Client-Secret': clientSecret
    },
    body
  });

  const bodyMobile = JSON.stringify({
    startDate,
    endDate,
    timeUnit: 'month',
    keywordGroups: [{ groupName: keyword, keywords: [keyword] }],
    device: 'mo'
  });

  const resMobile = await fetch('https://openapi.naver.com/v1/datalab/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Naver-Client-Id': clientId,
      'X-Naver-Client-Secret': clientSecret
    },
    body: bodyMobile
  });

  let pc = 0, mobile = 0, ratio = 0;

  if (resPc.ok) {
    const d = await resPc.json();
    const data = d.results?.[0]?.data;
    if (data && data.length > 0) {
      pc = Math.round(data[data.length - 1].ratio * 1000);
      ratio += data[data.length - 1].ratio;
    }
  }

  if (resMobile.ok) {
    const d = await resMobile.json();
    const data = d.results?.[0]?.data;
    if (data && data.length > 0) {
      mobile = Math.round(data[data.length - 1].ratio * 1000);
      ratio += data[data.length - 1].ratio;
    }
  }

  return { pc, mobile, ratio };
}

// ── 구버전 (사용 안 함) ──
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
      const timestamp = String(Date.now());

  // ✅ 공식 문서 방식: Secret Key를 Base64 디코딩 후 HMAC 키로 사용
  const sig = await makeSignature(timestamp, method, path, secret);

  const params = new URLSearchParams({ hintKeywords: keyword, showDetail: '1' });

  const res = await fetch(`https://manage.searchad.naver.com${path}?${params}`, {
          method,
          headers: {
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

// ── 블로그 문서수 조회 ──────────────────────────────────────────────
async function getBlogDocCount(keyword, clientId, clientSecret) {
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

// ── HMAC-SHA256 서명 생성 (공식 문서 방식) ──────────────────────────
// 네이버 공식 샘플: HMACSHA256(secretKey바이트).ComputeHash(message바이트) → Base64
// Secret Key가 Base64 인코딩된 값이므로 먼저 디코딩 후 HMAC 키로 사용
async function makeSignature(timestamp, method, path, secret) {
      const message = `${timestamp}.${method}.${path}`;
      const enc = new TextEncoder();
      const msgData = enc.encode(message);

  // Secret Key를 UTF-8 bytes로 직접 사용 (공식 Java/C# 샘플과 동일)
  const keyData = enc.encode(secret);

  const cryptoKey = await crypto.subtle.importKey(
          'raw', keyData,
      { name: 'HMAC', hash: 'SHA-256' },
          false, ['sign']
        );
      const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
      return btoa(String.fromCharCode(...new Uint8Array(signature)));
}
