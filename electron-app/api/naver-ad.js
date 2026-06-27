// 네이버 광고 API + 데이터랩 + 블로그 문서수 키워드 분석 모듈
const axios = require('axios');
const crypto = require('crypto');

// ── 네이버 광고 API 서명 생성 ──────────────────────────────────────
function makeSignature(timestamp, method, path, secretKey) {
  const message = `${timestamp}.${method}.${path}`;
  return crypto.createHmac('sha256', secretKey).update(message).digest('base64');
}

// 네이버 광고 API - 키워드 검색량 조회
async function getAdKeywordStats(keywords, customerId, accessLicense, secretKey) {
  const timestamp = Date.now().toString();
  const method = 'GET';
  const path = '/keywordstool';
  const signature = makeSignature(timestamp, method, path, secretKey);

  const query = keywords.map((kw) => `hintKeywords=${encodeURIComponent(kw)}`).join('&');

  try {
    const res = await axios.get(`https://api.naver.com/keywordstool?${query}&showDetail=1`, {
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Timestamp': timestamp,
        'X-API-KEY': accessLicense,
        'X-Customer': String(customerId),
        'X-Signature': signature,
      },
      timeout: 10000,
    });

    return (res.data?.keywordList || []).map((item) => ({
      keyword: item.relKeyword,
      adPc1: item.monthlyPcQcCnt || 0,
      adMobile1: item.monthlyMobileQcCnt || 0,
      adPc2: item.monthlyAvePcClkCnt || 0,
      adMobile2: item.monthlyAveMobileClkCnt || 0,
      competitionIndex: item.compIdx || '-',
    }));
  } catch (err) {
    throw new Error(`광고 API 오류: ${err.response?.status || err.message}`);
  }
}

// ── 데이터랩 트렌드 조회 (기존 service_worker.js 로직 이식) ─────────
async function getDataLabTrend(keyword, clientId, clientSecret) {
  if (!clientId || !clientSecret) return { pc: 0, mobile: 0 };

  const now = new Date();
  const endDate = now.toISOString().slice(0, 10);
  const startDate = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const body = (device) => ({
    startDate,
    endDate,
    timeUnit: 'month',
    keywordGroups: [{ groupName: keyword, keywords: [keyword] }],
    device,
  });

  const headers = {
    'Content-Type': 'application/json',
    'X-Naver-Client-Id': clientId,
    'X-Naver-Client-Secret': clientSecret,
  };

  let pc = 0;
  let mobile = 0;

  try {
    const resPc = await axios.post('https://openapi.naver.com/v1/datalab/search', body('pc'), { headers, timeout: 5000 });
    const pcData = resPc.data?.results?.[0]?.data;
    if (pcData?.length > 0) pc = Math.round(pcData[pcData.length - 1].ratio * 1000);
  } catch {}

  try {
    const resMo = await axios.post('https://openapi.naver.com/v1/datalab/search', body('mo'), { headers, timeout: 5000 });
    const moData = resMo.data?.results?.[0]?.data;
    if (moData?.length > 0) mobile = Math.round(moData[moData.length - 1].ratio * 1000);
  } catch {}

  return { pc, mobile };
}

// ── 블로그 문서수 조회 (기존 로직 이식) ──────────────────────────────
async function getBlogDocCount(keyword, clientId, clientSecret) {
  if (clientId && clientSecret) {
    try {
      const res = await axios.get(
        `https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent(keyword)}&display=1`,
        {
          headers: { 'X-Naver-Client-Id': clientId, 'X-Naver-Client-Secret': clientSecret },
          timeout: 5000,
        }
      );
      if (res.data?.total) return res.data.total;
    } catch {}
  }

  try {
    const res = await axios.get(
      `https://search.naver.com/search.naver?where=blog&query=${encodeURIComponent(keyword)}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 5000 }
    );
    const m = res.data.match(/총\s*([\d,]+)\s*개/);
    if (m) return parseInt(m[1].replace(/,/g, ''));
  } catch {}

  return 0;
}

// ── 단일 키워드 분석 (IPC 핸들러에서 호출) ────────────────────────
async function analyzeKeyword({ keyword, clientId, clientSecret, customerId, accessLicense, secretKey }) {
  const timeout = (ms) => new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms));

  const [docCount, trendData] = await Promise.all([
    Promise.race([getBlogDocCount(keyword, clientId, clientSecret), timeout(5000)]).catch(() => 0),
    Promise.race([getDataLabTrend(keyword, clientId, clientSecret), timeout(5000)]).catch(() => ({ pc: 0, mobile: 0 })),
  ]);

  const total = (trendData.pc || 0) + (trendData.mobile || 0);
  const goldIndex = docCount > 0 ? parseFloat(((total / (docCount || 1)) * 100).toFixed(1)) : null;

  // 광고 API 키가 있으면 광고 데이터도 조회
  let adData = { adPc1: null, adPc2: null, adMobile1: null, adMobile2: null };
  if (customerId && accessLicense && secretKey) {
    try {
      const stats = await Promise.race([
        getAdKeywordStats([keyword], customerId, accessLicense, secretKey),
        timeout(8000),
      ]);
      const item = stats.find((s) => s.keyword === keyword) || stats[0];
      if (item) {
        adData = {
          adPc1: item.adPc1,
          adPc2: item.adPc2,
          adMobile1: item.adMobile1,
          adMobile2: item.adMobile2,
        };
      }
    } catch {}
  }

  return {
    success: true,
    data: {
      pc: trendData.pc || 0,
      mobile: trendData.mobile || 0,
      total,
      docCount,
      goldIndex,
      ...adData,
    },
  };
}

// ── 여러 키워드 일괄 분석 (IPC 핸들러 진입점) ─────────────────────
async function getKeywordStats(keywords, customerId, apiKey, secretKey) {
  const results = [];
  for (const kw of keywords) {
    const r = await analyzeKeyword({
      keyword: kw.keyword,
      clientId: kw.naverClientId,
      clientSecret: kw.naverClientSecret,
      customerId,
      accessLicense: apiKey,
      secretKey,
    });
    results.push({ keyword: kw.keyword, ...r.data });
    await new Promise((r) => setTimeout(r, 150));
  }
  return results;
}

// ── API 연결 테스트 ────────────────────────────────────────────────
async function testConnection(customerId, accessLicense, secretKey) {
  try {
    const result = await getAdKeywordStats(['테스트'], customerId, accessLicense, secretKey);
    return { success: true, count: result.length };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = { getKeywordStats, analyzeKeyword, testConnection, getAdKeywordStats };
