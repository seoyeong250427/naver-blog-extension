// 네이버 트렌드 키워드 수집 모듈 - 데이터랩 검색어 트렌드 기반
const axios = require('axios');

// 네이버 데이터랩 블로그 32개 카테고리
const CATEGORIES = [
  { id: '100', name: '정치' },      { id: '101', name: '경제' },
  { id: '102', name: '사회' },      { id: '103', name: '생활문화' },
  { id: '104', name: 'IT과학' },    { id: '105', name: '세계' },
  { id: '106', name: '연예' },      { id: '107', name: '스포츠' },
  { id: '108', name: '건강' },      { id: '109', name: '여행' },
  { id: '110', name: '음식' },      { id: '111', name: '패션미용' },
  { id: '112', name: '인테리어' },  { id: '113', name: '육아' },
  { id: '114', name: '교육' },      { id: '115', name: '직업' },
  { id: '116', name: '취미' },      { id: '117', name: '스포츠' },
  { id: '118', name: '게임' },      { id: '119', name: '사회정치' },
  { id: '120', name: '영화' },      { id: '121', name: '드라마' },
  { id: '122', name: '외국어' },    { id: '123', name: '문학책' },
  { id: '124', name: '반려동물' },  { id: '125', name: '음악' },
  { id: '126', name: '공연전시' },  { id: '127', name: '이슈' },
  { id: '128', name: '원예재배' },  { id: '129', name: '사진' },
  { id: '130', name: '만화애니' },  { id: '131', name: '미술디자인' },
];

// 날짜 헬퍼
function getDateRange(days = 7) {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { startDate: fmt(start), endDate: fmt(end) };
}

// 네이버 데이터랩 검색어 트렌드 - 카테고리별 인기 검색어
async function fetchCategoryKeywords(clientId, clientSecret) {
  if (!clientId || !clientSecret) return [];

  const { startDate, endDate } = getDateRange(30);
  const results = [];
  const seen = new Set();

  // 카테고리별 대표 키워드를 데이터랩으로 트렌드 확인
  // 네이버 데이터랩 트렌드 페이지 크롤링
  for (const cat of CATEGORIES) {
    try {
      const res = await axios.get(
        `https://datalab.naver.com/keyword/trendSearch.naver?categoryId=${cat.id}&timeUnit=date&startDate=${startDate}&endDate=${endDate}`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://datalab.naver.com/',
            'Accept': 'application/json, text/plain, */*',
          },
          timeout: 8000,
        }
      );

      const items = res.data?.keywordList || res.data?.result?.keywordList || [];
      items.slice(0, 10).forEach((item, i) => {
        const kw = item.keyword || item.title || '';
        if (!kw || seen.has(kw)) return;
        seen.add(kw);
        results.push({
          keyword: kw,
          rank: i + 1,
          category: cat.name,
          isNew: item.isNew || false,
          collectedAt: Date.now(),
        });
      });

      await new Promise((r) => setTimeout(r, 150));
    } catch {}
  }

  return results;
}

// 네이버 검색 API로 연관 검색어 수집
async function fetchRelatedKeywords(seed, clientId, clientSecret) {
  try {
    const res = await axios.get(
      `https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent(seed)}&display=1`,
      {
        headers: {
          'X-Naver-Client-Id': clientId,
          'X-Naver-Client-Secret': clientSecret,
        },
        timeout: 5000,
      }
    );
    return res.data?.total || 0;
  } catch {
    return 0;
  }
}

// 네이버 실시간 트렌드 - trends.naver.com 크롤링
async function fetchRealtimeTrends() {
  const results = [];
  const seen = new Set();

  try {
    const res = await axios.get('https://trends.naver.com/trends/keywordsJson.naver', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://trends.naver.com/',
        'Accept': 'application/json',
      },
      timeout: 8000,
    });

    const items = res.data?.keywordList || [];
    items.forEach((item, i) => {
      const kw = item.keyword || '';
      if (!kw || seen.has(kw)) return;
      seen.add(kw);
      results.push({
        keyword: kw,
        rank: i + 1,
        category: '실시간급상승',
        isNew: item.isNew || false,
        collectedAt: Date.now(),
      });
    });
  } catch {}

  // 실패 시 PC/모바일 각각 시도
  if (results.length === 0) {
    for (const device of ['pc', 'mobile']) {
      try {
        const res = await axios.get(
          `https://trends.naver.com/trends/keywordsJson.naver?device=${device}`,
          {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Referer': 'https://trends.naver.com/',
            },
            timeout: 8000,
          }
        );
        const items = res.data?.keywordList || [];
        items.forEach((item, i) => {
          const kw = item.keyword || '';
          if (!kw || seen.has(kw)) return;
          seen.add(kw);
          results.push({
            keyword: kw,
            rank: i + 1,
            category: device === 'pc' ? 'PC급상승' : '모바일급상승',
            isNew: item.isNew || false,
            collectedAt: Date.now(),
          });
        });
      } catch {}
    }
  }

  return results;
}

// 네이버 데이터랩 쇼핑인사이트 카테고리별 급상승
async function fetchShoppingTrends(clientId, clientSecret) {
  if (!clientId || !clientSecret) return [];

  const { startDate, endDate } = getDateRange(7);
  const results = [];
  const seen = new Set();

  // 쇼핑 대분류 카테고리 코드
  const shopCats = [
    { id: '50000000', name: '패션의류' },
    { id: '50000001', name: '패션잡화' },
    { id: '50000002', name: '화장품미용' },
    { id: '50000003', name: '디지털가전' },
    { id: '50000004', name: '가구인테리어' },
    { id: '50000005', name: '출산육아' },
    { id: '50000006', name: '식품' },
    { id: '50000007', name: '스포츠레저' },
    { id: '50000008', name: '생활건강' },
  ];

  for (const cat of shopCats) {
    try {
      const res = await axios.post(
        'https://openapi.naver.com/v1/datalab/shopping/category/keywords',
        {
          startDate,
          endDate,
          timeUnit: 'date',
          category: cat.id,
          device: '',
          ages: [],
          gender: '',
        },
        {
          headers: {
            'X-Naver-Client-Id': clientId,
            'X-Naver-Client-Secret': clientSecret,
            'Content-Type': 'application/json',
          },
          timeout: 8000,
        }
      );

      const items = res.data?.results?.[0]?.data || [];
      items.slice(0, 5).forEach((item, i) => {
        const kw = item.title || item.keyword || '';
        if (!kw || seen.has(kw)) return;
        seen.add(kw);
        results.push({
          keyword: kw,
          rank: i + 1,
          category: cat.name,
          isNew: false,
          collectedAt: Date.now(),
        });
      });

      await new Promise((r) => setTimeout(r, 200));
    } catch {}
  }

  return results;
}

// 전체 수집 진입점
async function collectAll({ clientId, clientSecret } = {}) {
  const all = [];
  const seen = new Set();

  const add = (items) => {
    items.forEach((item) => {
      if (!item.keyword || seen.has(item.keyword)) return;
      seen.add(item.keyword);
      all.push(item);
    });
  };

  // 1. 실시간 급상승 (인증 불필요)
  add(await fetchRealtimeTrends());

  // 2. 쇼핑 트렌드 (검색 API 키 필요)
  if (clientId && clientSecret) {
    add(await fetchShoppingTrends(clientId, clientSecret));
  }

  // 3. 카테고리별 트렌드
  if (clientId && clientSecret) {
    add(await fetchCategoryKeywords(clientId, clientSecret));
  }

  return all;
}

module.exports = { collectAll, fetchRealtimeTrends, fetchShoppingTrends, CATEGORIES };
