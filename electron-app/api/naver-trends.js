// 네이버 트렌드 키워드 수집 모듈
const axios = require('axios');

function getDateRange(days = 7) {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { startDate: fmt(start), endDate: fmt(end) };
}

// 네이버 데이터랩 검색어트렌드 - 키워드 그룹별 트렌드 수치
async function fetchDatalabTrends(clientId, clientSecret) {
  if (!clientId || !clientSecret) return [];

  const { startDate, endDate } = getDateRange(7);

  const candidates = [
    ['다이어트','헬스','운동','요가','필라테스'],
    ['여행','제주도','해외여행','호텔','항공권'],
    ['맛집','카페','배달음식','레시피','요리'],
    ['패션','코디','쇼핑','옷','신발'],
    ['화장품','스킨케어','립스틱','파운데이션','선크림'],
    ['영화','드라마','넷플릭스','웹툰','게임'],
    ['육아','임신','출산','아기','어린이집'],
    ['부동산','아파트','전세','청약','대출'],
    ['주식','코인','비트코인','투자','재테크'],
    ['취업','자격증','공무원','면접','이직'],
  ];

  const results = [];
  const seen = new Set();

  for (const group of candidates) {
    try {
      const res = await axios.post(
        'https://openapi.naver.com/v1/datalab/search',
        {
          startDate,
          endDate,
          timeUnit: 'date',
          keywordGroups: group.map((kw) => ({ groupName: kw, keywords: [kw] })),
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
      const sorted = items
        .map((item) => {
          const data = item.data || [];
          const avg = data.length ? data.reduce((s, d) => s + (d.ratio || 0), 0) / data.length : 0;
          return { keyword: item.title, ratio: avg };
        })
        .sort((a, b) => b.ratio - a.ratio);

      sorted.forEach((item, i) => {
        if (!item.keyword || seen.has(item.keyword)) return;
        seen.add(item.keyword);
        results.push({
          keyword: item.keyword,
          rank: i + 1,
          category: '검색트렌드',
          ratio: Math.round(item.ratio),
          isNew: false,
          collectedAt: Date.now(),
        });
      });

      await new Promise((r) => setTimeout(r, 100));
    } catch (err) {
      console.error('데이터랩 오류:', err.response?.status, err.message);
    }
  }

  return results;
}

// 네이버 쇼핑인사이트 카테고리별 인기 키워드
async function fetchShoppingTrends(clientId, clientSecret) {
  if (!clientId || !clientSecret) return [];

  const { startDate, endDate } = getDateRange(7);
  const results = [];
  const seen = new Set();

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
    { id: '50000009', name: '여행문화' },
  ];

  for (const cat of shopCats) {
    try {
      // 쇼핑인사이트 분야별 트렌드 - 올바른 엔드포인트
      const res = await axios.post(
        'https://openapi.naver.com/v1/datalab/shopping/categories',
        {
          startDate,
          endDate,
          timeUnit: 'date',
          category: [{ name: cat.name, param: [cat.id] }],
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
          timeout: 10000,
        }
      );

      // 트렌드 수치가 높으면 해당 카테고리 키워드 추가
      const data = res.data?.results?.[0]?.data || [];
      const avg = data.length ? data.reduce((s, d) => s + (d.ratio || 0), 0) / data.length : 0;

      if (avg > 0 && !seen.has(cat.name)) {
        seen.add(cat.name);
        results.push({
          keyword: cat.name,
          rank: results.length + 1,
          category: '쇼핑트렌드',
          ratio: Math.round(avg),
          isNew: false,
          collectedAt: Date.now(),
        });
      }

      await new Promise((r) => setTimeout(r, 200));
    } catch (err) {
      console.error(`쇼핑 ${cat.name} 오류:`, err.response?.status, err.message);
    }
  }

  return results;
}

// 전체 수집 진입점
async function collectAll({ clientId, clientSecret } = {}) {
  if (!clientId || !clientSecret) {
    console.error('네이버 검색 API 키가 없습니다.');
    return [];
  }

  const all = [];
  const seen = new Set();

  const add = (items) => {
    items.forEach((item) => {
      if (!item.keyword || seen.has(item.keyword)) return;
      seen.add(item.keyword);
      all.push(item);
    });
  };

  add(await fetchDatalabTrends(clientId, clientSecret));
  add(await fetchShoppingTrends(clientId, clientSecret));

  console.log(`수집 완료: ${all.length}개`);
  return all;
}

module.exports = { collectAll, fetchDatalabTrends, fetchShoppingTrends };
