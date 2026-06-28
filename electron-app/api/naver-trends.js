// 네이버 트렌드 키워드 수집 - 데이터랩 검색어트렌드 기반
const axios = require('axios');

function getDateRange(days = 7) {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { startDate: fmt(start), endDate: fmt(end) };
}

// 카테고리별 시드 키워드 목록
const CATEGORY_KEYWORDS = [
  { category: '패션의류', keywords: ['원피스','후드티','청바지','코트','니트','패딩','레깅스','블라우스','슬랙스','맨투맨'] },
  { category: '패션잡화', keywords: ['운동화','샌들','백팩','크로스백','모자','벨트','지갑','선글라스','부츠','슬리퍼'] },
  { category: '화장품미용', keywords: ['선크림','파운데이션','립스틱','마스카라','세럼','토너','에센스','비비크림','아이크림','미스트'] },
  { category: '디지털가전', keywords: ['에어팟','스마트폰','노트북','태블릿','이어폰','스피커','청소기','선풍기','공기청정기','냉장고'] },
  { category: '가구인테리어', keywords: ['소파','책상','침대','조명','커튼','카펫','행거','선반','수납함','매트리스'] },
  { category: '출산육아', keywords: ['유모차','기저귀','분유','젖병','아기침대','카시트','이유식','아기로션','베이비워시','속싸개'] },
  { category: '식품', keywords: ['단백질쉐이크','견과류','그래놀라','오메가3','비타민','홍삼','닭가슴살','샐러드','두부','현미'] },
  { category: '스포츠레저', keywords: ['요가매트','덤벨','폼롤러','자전거','등산화','테니스라켓','수영복','캠핑의자','헬스장갑','줄넘기'] },
  { category: '생활건강', keywords: ['마스크','칫솔','면도기','체온계','혈압계','안마기','족욕기','가습기','제습기','공기청정기'] },
  { category: '여행문화', keywords: ['캐리어','여행가방','목베개','여행파우치','트래블월렛','여행용멀티탭','세면도구세트','압축팩','여권지갑','네임택'] },
  { category: '반려동물', keywords: ['강아지사료','고양이사료','강아지간식','고양이간식','펫패드','하네스','애견유모차','고양이모래','강아지옷','펫샴푸'] },
  { category: '도서', keywords: ['자기계발','소설','에세이','경제경영','육아책','요리책','영어공부','수험서','그림책','만화'] },
];

// 데이터랩 검색어트렌드 API로 카테고리별 인기 키워드 수집
async function fetchCategoryTrends(clientId, clientSecret) {
  if (!clientId || !clientSecret) return [];

  const { startDate, endDate } = getDateRange(7);
  const results = [];
  const seen = new Set();

  for (const cat of CATEGORY_KEYWORDS) {
    try {
      // 5개씩 나눠서 호출 (API 최대 5개 그룹)
      const chunks = [];
      for (let i = 0; i < cat.keywords.length; i += 5) {
        chunks.push(cat.keywords.slice(i, i + 5));
      }

      const allScores = [];

      for (const chunk of chunks) {
        const res = await axios.post(
          'https://openapi.naver.com/v1/datalab/search',
          {
            startDate,
            endDate,
            timeUnit: 'date',
            keywordGroups: chunk.map((kw) => ({ groupName: kw, keywords: [kw] })),
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
          const data = item.data || [];
          const avg = data.length ? data.reduce((s, d) => s + (d.ratio || 0), 0) / data.length : 0;
          allScores.push({ keyword: item.title, ratio: avg });
        });

        await new Promise((r) => setTimeout(r, 150));
      }

      // 트렌드 수치 높은 순으로 정렬해서 상위 5개 추가
      allScores.sort((a, b) => b.ratio - a.ratio);
      allScores.slice(0, 5).forEach((item, i) => {
        if (!item.keyword || seen.has(item.keyword)) return;
        seen.add(item.keyword);
        results.push({
          keyword: item.keyword,
          rank: i + 1,
          category: cat.category,
          ratio: Math.round(item.ratio),
          isNew: false,
          collectedAt: Date.now(),
        });
      });

    } catch (err) {
      console.error(`${cat.category} 트렌드 오류:`, err.response?.status, err.message);
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

  const results = await fetchCategoryTrends(clientId, clientSecret);
  console.log(`수집 완료: ${results.length}개`);
  return results;
}

module.exports = { collectAll, fetchCategoryTrends };
