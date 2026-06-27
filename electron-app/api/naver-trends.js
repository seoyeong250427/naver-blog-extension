// 네이버 데이터랩 트렌드 32개 카테고리 크롤링 모듈
const axios = require('axios');

// 네이버 데이터랩 쇼핑 인사이트 카테고리 코드 (32개)
const CATEGORIES = [
  { id: '50000000', name: '패션의류' },
  { id: '50000001', name: '패션잡화' },
  { id: '50000002', name: '화장품/미용' },
  { id: '50000003', name: '디지털/가전' },
  { id: '50000004', name: '가구/인테리어' },
  { id: '50000005', name: '출산/육아' },
  { id: '50000006', name: '식품' },
  { id: '50000007', name: '스포츠/레저' },
  { id: '50000008', name: '생활/건강' },
  { id: '50000009', name: '여행/문화' },
  { id: '50000010', name: '면세점' },
  { id: '50000011', name: '도서' },
  { id: '50000012', name: '자동차/공구' },
  { id: '50000013', name: '반려동물' },
];

// 네이버 검색어 트렌드 API (데이터랩)
const DATALAB_URL = 'https://openapi.naver.com/v1/datalab/search';

// 네이버 쇼핑 인사이트 급상승 키워드 URL
const SHOPPING_INSIGHT_URL = 'https://openapi.naver.com/v1/datalab/shopping/categories/keywords/ratio';

// 날짜 포맷 헬퍼
function getDateRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 7);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { startDate: fmt(start), endDate: fmt(end) };
}

// 네이버 실시간 급상승 검색어 (PC/모바일 통합)
async function fetchRealtimeTrends() {
  try {
    // 네이버 실시간 트렌드 비공개 API 활용
    const res = await axios.get(
      'https://signal.naver.com/v1/search/trend?caller=signalapp&device=all',
      { timeout: 10000 }
    );
    const items = res.data?.items?.[0]?.data || [];
    return items.map((item, i) => ({
      rank: i + 1,
      keyword: item.title || item.keyword || '',
      category: '실시간급상승',
    }));
  } catch {
    return [];
  }
}

// 네이버 쇼핑 인사이트 카테고리별 급상승 키워드
async function fetchCategoryTrends(clientId, clientSecret) {
  const { startDate, endDate } = getDateRange();
  const results = [];

  for (const cat of CATEGORIES) {
    try {
      const res = await axios.post(
        SHOPPING_INSIGHT_URL,
        {
          startDate,
          endDate,
          timeUnit: 'date',
          category: [{ name: cat.name, param: [cat.id] }],
          device: 'pc',
          ages: [],
          gender: '',
        },
        {
          headers: {
            'X-Naver-Client-Id': clientId,
            'X-Naver-Client-Secret': clientSecret,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );

      const keywords = res.data?.results?.[0]?.data || [];
      keywords.slice(0, 10).forEach((item, i) => {
        results.push({
          rank: i + 1,
          keyword: item.title || '',
          category: cat.name,
          ratio: item.ratio || 0,
        });
      });

      // API 레이트 리밋 방지
      await new Promise((r) => setTimeout(r, 200));
    } catch (err) {
      console.error(`카테고리 ${cat.name} 수집 실패:`, err.message);
    }
  }

  return results;
}

// 네이버 데이터랩 검색어 트렌드 (키워드 그룹 비교)
async function fetchDatalabTrends(keywords, clientId, clientSecret) {
  const { startDate, endDate } = getDateRange();

  // 한 번에 최대 5개 키워드 그룹
  const chunks = [];
  for (let i = 0; i < keywords.length; i += 5) {
    chunks.push(keywords.slice(i, i + 5));
  }

  const results = [];
  for (const chunk of chunks) {
    try {
      const res = await axios.post(
        DATALAB_URL,
        {
          startDate,
          endDate,
          timeUnit: 'date',
          keywordGroups: chunk.map((kw) => ({
            groupName: kw,
            keywords: [kw],
          })),
        },
        {
          headers: {
            'X-Naver-Client-Id': clientId,
            'X-Naver-Client-Secret': clientSecret,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );

      const items = res.data?.results || [];
      items.forEach((item) => {
        const latest = item.data?.[item.data.length - 1];
        results.push({
          keyword: item.title,
          ratio: latest?.ratio || 0,
          category: '데이터랩',
        });
      });

      await new Promise((r) => setTimeout(r, 200));
    } catch (err) {
      console.error('데이터랩 트렌드 수집 실패:', err.message);
    }
  }

  return results;
}

// 전체 수집 진입점 - main.js IPC 핸들러에서 호출
async function collectAll({ clientId, clientSecret } = {}) {
  const all = [];

  // 1. 실시간 급상승 (인증 불필요)
  const realtime = await fetchRealtimeTrends();
  all.push(...realtime);

  // 2. 쇼핑 카테고리별 (clientId/Secret 필요)
  if (clientId && clientSecret) {
    const category = await fetchCategoryTrends(clientId, clientSecret);
    all.push(...category);
  }

  // 중복 제거 (keyword 기준)
  const seen = new Set();
  return all.filter((item) => {
    if (seen.has(item.keyword)) return false;
    seen.add(item.keyword);
    return true;
  });
}

module.exports = { collectAll, fetchRealtimeTrends, fetchCategoryTrends, fetchDatalabTrends, CATEGORIES };
