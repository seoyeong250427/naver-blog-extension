// 네이버 트렌드 키워드 수집 모듈 - 쇼핑인사이트 카테고리별 인기 키워드
const axios = require('axios');

function getDateRange(days = 7) {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { startDate: fmt(start), endDate: fmt(end) };
}

// 네이버 쇼핑인사이트 32개 카테고리 인기 키워드
const SHOPPING_CATEGORIES = [
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
  { id: '50000010', name: '면세점' },
  { id: '50000011', name: '도서' },
  { id: '50000012', name: '자동차공구' },
  { id: '50000013', name: '반려동물' },
  { id: '50000014', name: '식물원예' },
  { id: '50000015', name: '헬스의료' },
  { id: '50000016', name: '음반DVD' },
  { id: '50000017', name: '악기' },
  { id: '50000018', name: '아트컬렉션' },
  { id: '50000019', name: '문구오피스' },
  { id: '50000020', name: '장난감취미' },
  { id: '50000021', name: '게임' },
  { id: '50000022', name: '주방용품' },
  { id: '50000023', name: '청소세탁' },
  { id: '50000024', name: '욕실용품' },
  { id: '50000025', name: '침구커튼' },
  { id: '50000026', name: '조명전기' },
  { id: '50000027', name: '공구DIY' },
  { id: '50000028', name: '여성의류' },
  { id: '50000029', name: '남성의류' },
  { id: '50000030', name: '가방지갑' },
  { id: '50000031', name: '신발' },
];

// 쇼핑인사이트 카테고리별 인기 키워드 조회
async function fetchShoppingKeywords(clientId, clientSecret) {
  if (!clientId || !clientSecret) return [];

  const { startDate, endDate } = getDateRange(7);
  const results = [];
  const seen = new Set();

  for (const cat of SHOPPING_CATEGORIES) {
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
          timeout: 10000,
        }
      );

      const keywords = res.data?.results?.[0]?.data || [];
      keywords.slice(0, 5).forEach((item, i) => {
        const kw = item.title || item.keyword || '';
        if (!kw || seen.has(kw)) return;
        seen.add(kw);
        results.push({
          keyword: kw,
          rank: i + 1,
          category: cat.name,
          ratio: Math.round(item.ratio || 0),
          isNew: false,
          collectedAt: Date.now(),
        });
      });

      await new Promise((r) => setTimeout(r, 200));
    } catch (err) {
      console.error(`쇼핑 ${cat.name} 오류:`, err.response?.status, err.message);
    }
  }

  return results;
}

// 네이버 데이터랩 블로그 카테고리별 인기 키워드 (검색어트렌드)
const BLOG_CATEGORIES = [
  { topic: 'home', name: '생활' },
  { topic: 'food', name: '음식' },
  { topic: 'sports', name: '스포츠' },
  { topic: 'beauty', name: '미용' },
  { topic: 'health', name: '건강' },
  { topic: 'travel', name: '여행' },
  { topic: 'entertainment', name: '연예' },
  { topic: 'game', name: '게임' },
  { topic: 'pet', name: '반려동물' },
  { topic: 'culture', name: '문화' },
];

// 데이터랩 블로그 카테고리 인기 키워드
async function fetchBlogCategoryKeywords(clientId, clientSecret) {
  if (!clientId || !clientSecret) return [];

  const { startDate, endDate } = getDateRange(7);
  const results = [];
  const seen = new Set();

  for (const cat of BLOG_CATEGORIES) {
    try {
      const res = await axios.get(
        `https://openapi.naver.com/v1/datalab/blog/category/keywords?startDate=${startDate}&endDate=${endDate}&timeUnit=date&category=${cat.topic}&device=&gender=&ages=`,
        {
          headers: {
            'X-Naver-Client-Id': clientId,
            'X-Naver-Client-Secret': clientSecret,
          },
          timeout: 10000,
        }
      );

      const keywords = res.data?.results?.[0]?.data || [];
      keywords.slice(0, 5).forEach((item, i) => {
        const kw = item.title || item.keyword || '';
        if (!kw || seen.has(kw)) return;
        seen.add(kw);
        results.push({
          keyword: kw,
          rank: i + 1,
          category: cat.name,
          ratio: Math.round(item.ratio || 0),
          isNew: false,
          collectedAt: Date.now(),
        });
      });

      await new Promise((r) => setTimeout(r, 150));
    } catch (err) {
      console.error(`블로그 카테고리 ${cat.name} 오류:`, err.response?.status, err.message);
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

  // 쇼핑인사이트 32개 카테고리 인기 키워드
  add(await fetchShoppingKeywords(clientId, clientSecret));

  // 블로그 카테고리 인기 키워드
  add(await fetchBlogCategoryKeywords(clientId, clientSecret));

  console.log(`수집 완료: ${all.length}개`);
  return all;
}

module.exports = { collectAll, fetchShoppingKeywords, fetchBlogCategoryKeywords };
