// 네이버 트렌드 키워드 수집 - 자동완성 확장 + 데이터랩 트렌드 비교
// API 키만 있으면 영구적으로 작동 (쿠키 불필요)
const axios = require('axios');

// 32개 카테고리별 시드 키워드 (자동완성 확장의 출발점)
const CATEGORY_SEEDS = {
  "맛집": ["맛집", "오마카세", "데이트 맛집", "혼밥 맛집"],
  "카페/디저트": ["카페 추천", "디저트 카페", "베이커리"],
  "여행/국내": ["국내 여행지", "당일치기 여행", "펜션 추천"],
  "여행/해외": ["해외여행 추천", "여행 패키지", "신혼여행지"],
  "푸드/레시피": ["간단 레시피", "다이어트 식단", "에어프라이어 요리"],
  "IT/가젯": ["아이폰", "노트북 추천", "무선이어폰"],
  "패션/의류": ["여름 코디", "데일리룩", "원피스 추천"],
  "뷰티/화장품": ["선크림 추천", "수분크림", "쿠션 추천"],
  "리빙/인테리어": ["원룸 인테리어", "셀프 인테리어", "거실 꾸미기"],
  "원예/식물": ["반려식물 추천", "다육식물 키우기", "텃밭 가꾸기"],
  "자동차": ["전기차 추천", "중고차 시세", "자동차 보험"],
  "등산/아웃도어": ["등산 코스 추천", "등산화 추천", "트레킹"],
  "캠핑/글램핑": ["글램핑장 추천", "캠핑용품 추천", "오토캠핑"],
  "골프": ["골프 클럽 추천", "스크린골프", "골프웨어"],
  "낚시": ["낚시 포인트", "민물낚시", "바다낚시"],
  "일상/생각": ["미니멀 라이프", "자기계발", "일상 루틴"],
  "육아/아동": ["신생아 용품", "이유식 레시피", "유아 교육"],
  "반려동물": ["강아지 사료 추천", "고양이 용품", "반려동물 보험"],
  "예술/디자인": ["그림 그리기", "디자인 툴", "캘리그라피"],
  "공연/전시": ["전시회 추천", "뮤지컬 추천", "콘서트"],
  "도서/문학": ["베스트셀러", "자기계발서", "추천 도서"],
  "비즈니스·경제": ["부업 추천", "재택근무", "창업 아이템"],
  "주식/재테크": ["주식 투자", "재테크 방법", "적금 추천"],
  "부동산": ["전세 계약", "청약 가점", "아파트 시세"],
  "학습/교육": ["자격증 추천", "온라인 강의", "공부법"],
  "사진/카메라": ["카메라 추천", "사진 보정", "스마트폰 사진"],
  "영화/드라마": ["영화 추천", "넷플릭스 추천", "드라마 추천"],
  "건강/의학": ["다이어트 방법", "건강검진", "영양제 추천"],
  "취미/DIY": ["취미 추천", "DIY 키트", "핸드메이드"],
  "외국어/학습": ["영어공부법", "일본어 공부", "토익 공부"],
  "만화/웹툰": ["웹툰 추천", "만화 추천", "인기 웹툰"],
  "음악/악기": ["악기 추천", "기타 독학", "피아노 독학"],
};

// 네이버 자동완성 API - 인증 불필요, 가장 안정적
async function fetchAutocomplete(keyword) {
  try {
    const res = await axios.get('https://ac.search.naver.com/nx/ac', {
      params: {
        q: keyword, con: 0, frm: 'nv', ans: 2,
        r_format: 'json', r_enc: 'UTF-8', t_koreng: 1,
        run: 2, rev: 4, q_enc: 'UTF-8', st: 100,
      },
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 5000,
    });
    const items = res.data?.items?.[0] || [];
    return items.map(item => item[0]).filter(Boolean);
  } catch {
    return [];
  }
}

// 데이터랩 검색어트렌드 - 키워드 그룹별 인기도 비교 (API 키 필요)
async function fetchTrendScore(keywords, clientId, clientSecret) {
  if (!clientId || !clientSecret || keywords.length === 0) return {};

  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 7);
  const fmt = d => d.toISOString().slice(0, 10);

  const scores = {};
  const chunks = [];
  for (let i = 0; i < keywords.length; i += 5) chunks.push(keywords.slice(i, i + 5));

  for (const chunk of chunks) {
    try {
      const res = await axios.post(
        'https://openapi.naver.com/v1/datalab/search',
        {
          startDate: fmt(start), endDate: fmt(end), timeUnit: 'date',
          keywordGroups: chunk.map(kw => ({ groupName: kw, keywords: [kw] })),
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
      (res.data?.results || []).forEach(item => {
        const data = item.data || [];
        const avg = data.length ? data.reduce((s,d) => s + (d.ratio||0), 0) / data.length : 0;
        scores[item.title] = avg;
      });
      await new Promise(r => setTimeout(r, 100));
    } catch (err) {
      console.error('데이터랩 오류:', err.response?.status, err.message);
    }
  }
  return scores;
}

// 카테고리별: 시드 키워드 → 자동완성 확장(2단계) → (선택)데이터랩 정렬
async function collectAll({ clientId, clientSecret } = {}) {
  const results = [];
  let rank = 1;

  for (const [category, seeds] of Object.entries(CATEGORY_SEEDS)) {
    const collected = new Set();

    // 시드 키워드별 자동완성 확장
    for (const seed of seeds) {
      const suggestions = await fetchAutocomplete(seed);
      suggestions.slice(0, 5).forEach(kw => collected.add(kw));
      await new Promise(r => setTimeout(r, 80));

      // 2단계 확장: 1차 결과를 다시 시드로 써서 롱테일 후보 확보
      for (const kw of suggestions.slice(0, 3)) {
        const deeper = await fetchAutocomplete(kw);
        deeper.slice(0, 3).forEach(kw2 => collected.add(kw2));
        await new Promise(r => setTimeout(r, 80));
      }
    }

    let keywordList = [...collected].slice(0, 20);

    // 데이터랩 API 키 있으면 트렌드 점수로 정렬
    if (clientId && clientSecret && keywordList.length > 0) {
      const scores = await fetchTrendScore(keywordList, clientId, clientSecret);
      keywordList.sort((a, b) => (scores[b] || 0) - (scores[a] || 0));
    }

    keywordList.slice(0, 5).forEach((kw, i) => {
      results.push({
        keyword: kw,
        rank: rank++,
        category,
        isNew: false,
        collectedAt: Date.now(),
      });
    });
  }

  console.log(`수집 완료: ${results.length}개 (자동완성 확장${clientId ? ' + 데이터랩 정렬' : ''})`);
  return results;
}

// 크리에이터 어드바이저 API 원본 응답(카테고리별 JSON)을 키워드 목록으로 변환
// raw 형태: { [category]: 응답JSON, ... } (main.js의 collectFromAdvisor가 전달)
function normalizeAdvisorRaw(raw) {
  const results = [];
  let rank = 1;

  for (const [category, json] of Object.entries(raw || {})) {
    const items = json?.keywordList || json?.keywords || json?.data || [];
    items.forEach(item => {
      const keyword = item.keyword || item.name || item.title || '';
      if (!keyword) return;
      results.push({
        keyword,
        rank: rank++,
        category,
        rank_change: item.rankChange || item.rank_change || 0,
        isNew: item.isNew || item.is_new || false,
        collectedAt: Date.now(),
      });
    });
  }
  return results;
}

module.exports = { collectAll, CATEGORY_SEEDS, fetchAutocomplete, normalizeAdvisorRaw };
