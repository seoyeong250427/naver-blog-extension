// 네이버 트렌드 키워드 수집 - 크리에이터 어드바이저 실제 API
const axios = require('axios');

// 32개 카테고리 (크리에이터 어드바이저 기준)
const CATEGORIES = [
  "맛집", "카페/디저트", "여행/국내", "여행/해외", "푸드/레시피",
  "IT/가젯", "패션/의류", "뷰티/화장품", "리빙/인테리어", "원예/식물",
  "자동차", "등산/아웃도어", "캠핑/글램핑", "골프", "낚시",
  "일상/생각", "육아/아동", "반려동물", "예술/디자인", "공연/전시",
  "도서/문학", "비즈니스·경제", "주식/재테크", "부동산", "학습/교육",
  "사진/카메라", "영화/드라마", "건강/의학", "취미/DIY", "외국어/학습",
  "만화/웹툰", "음악/악기"
];

// Mock 데이터
const MOCK_KEYWORDS = {
  "맛집": ["성수동 신상 오마카세", "연남동 야키토리 맛집", "망원시장 칼국수", "여의도 한우 맛집", "압구정 수제버거"],
  "카페/디저트": ["종로 한옥 카페", "연희동 스페셜티 커피", "수원 행궁동 크루키", "성수 루프탑 카페", "송리단길 감성 카페"],
  "여행/국내": ["강릉 주문진 오션뷰", "제주도 서귀포 수국", "경주 황리단길", "부산 영도 흰여울마을", "남해 독일마을"],
  "여행/해외": ["일본 후쿠오카 여행", "베트남 다낭 쇼핑", "태국 방콕 호텔", "대만 타이베이 여행", "이탈리아 로마 투어"],
  "푸드/레시피": ["소고기 무국 레시피", "에어프라이어 마늘빵", "다이어트 참치 덮밥", "토마토 파스타 레시피", "그릭요거트 만들기"],
  "IT/가젯": ["아이폰 최신 후기", "노이즈캔슬링 헤드폰", "맥북 에어 비교", "기계식 키보드 추천", "갤럭시 워치 설정"],
  "패션/의류": ["여름 원피스 추천", "오버핏 린넨 셔츠", "남자 반바지 추천", "스트릿 패션 코디", "빈티지 청바지"],
  "뷰티/화장품": ["여름 선크림 추천", "수분크림 추천", "쿠션 파운데이션", "아이크림 추천", "선스틱 추천"],
  "리빙/인테리어": ["원룸 인테리어 꿀팁", "북유럽 감성 거실", "화장실 수납 선반", "주방 타일 시공", "침실 조명 연출"],
  "원예/식물": ["베란다 토마토 키우기", "다육이 물주기", "공기정화 식물", "고무나무 분갈이", "수경재배 채소"],
  "자동차": ["전기차 장거리 후기", "중고차 구매 체크", "블랙박스 추천", "셀프 세차 용품", "타이어 교체 시기"],
  "등산/아웃도어": ["북한산 등산 코스", "등산화 브랜드 비교", "트레킹 배낭 추천", "여름 산행 용품", "초보자 등산 코스"],
  "캠핑/글램핑": ["가평 글램핑장 추천", "캠핑 텐트 비교", "오토캠핑 장비", "캠핑 요리 레시피", "겨울 캠핑 난방"],
  "골프": ["골프 입문 클럽 추천", "스크린골프 연습법", "골프웨어 추천", "필드 라운딩 예절", "골프 레슨 비용"],
  "낚시": ["한강 붕어낚시 포인트", "바다낚시 입문 장비", "루어낚시 미노우", "제주 갯바위 낚시", "낚시 릴 추천"],
  "일상/생각": ["직장인 일상 브이로그", "혼밥 혼술 즐기기", "주말 집순이 루틴", "미니멀 라이프 실천", "감사일기 쓰는 법"],
  "육아/아동": ["신생아 수면 교육", "유아 이유식 레시피", "어린이집 준비물", "아기 발달 놀이", "초등학생 용돈 교육"],
  "반려동물": ["강아지 산책 루틴", "고양이 중성화 비용", "강아지 훈련 기초", "고양이 모래 추천", "반려동물 보험"],
  "예술/디자인": ["수채화 입문 준비물", "아이패드 드로잉 앱", "디지털 일러스트 강의", "캘리그라피 독학", "사진 보정 라이트룸"],
  "공연/전시": ["서울 무료 전시", "뮤지컬 티켓 예매", "미술관 관람 에티켓", "홍대 인디밴드 공연", "국립현대미술관 전시"],
  "도서/문학": ["베스트셀러 소설 추천", "자기계발 도서 추천", "독서 습관 만들기", "북클럽 운영 방법", "전자책 리더기 추천"],
  "비즈니스·경제": ["부업 아이디어", "재택근무 생산성", "스타트업 창업 준비", "연말정산 팁", "엑셀 업무 자동화"],
  "주식/재테크": ["ETF 투자 입문", "월급쟁이 재테크", "미국주식 시작하기", "청약 당첨 전략", "적금 금리 비교"],
  "부동산": ["전세 계약 체크리스트", "청약 가점 계산", "아파트 실거래가 조회", "월세 계약 주의사항", "부동산 투자 입문"],
  "학습/교육": ["공무원 시험 준비", "토익 점수 올리기", "온라인 강의 추천", "자격증 공부 계획", "수능 국어 공부법"],
  "사진/카메라": ["미러리스 카메라 추천", "스마트폰 사진 잘 찍기", "인물사진 배경 흐리기", "풍경사진 구도 잡기", "사진 편집 앱 추천"],
  "영화/드라마": ["넷플릭스 추천작", "역대 명작 한국 영화", "주말 드라마 추천", "OTT 비교", "공포 영화 추천"],
  "건강/의학": ["다이어트 식단 짜기", "홈트레이닝 루틴", "수면 질 높이기", "비타민 영양제 추천", "허리 통증 스트레칭"],
  "취미/DIY": ["레진아트 입문 키트", "뜨개질 독학", "프라모델 입문", "핸드드립 커피 도구", "가죽공예 입문"],
  "외국어/학습": ["일본어 혼자 공부하기", "영어 회화 유튜브", "스페인어 입문 앱", "중국어 HSK 준비", "언어 교환 파트너"],
  "만화/웹툰": ["네이버 웹툰 추천", "카카오 웹툰 추천", "만화책 수집 입문", "레진코믹스 추천", "웹툰 작가 되는 법"],
  "음악/악기": ["기타 독학 입문", "피아노 성인 독학", "드럼 레슨 추천", "DAW 음악 제작 입문", "우쿨렐레 코드 기초"]
};

function generateMockData() {
  const trends = [];
  let rank = 1;
  for (const cat of CATEGORIES) {
    const keywords = MOCK_KEYWORDS[cat] || [`${cat} 트렌드`, `${cat} 추천`, `${cat} 정보`];
    keywords.forEach((kw) => {
      trends.push({
        keyword: kw,
        rank: rank++,
        category: cat,
        rank_change: Math.floor(Math.random() * 20) + 1,
        isNew: Math.random() > 0.5,
        collectedAt: Date.now(),
      });
    });
  }
  return trends;
}

// 크리에이터 어드바이저 실제 API 호출
async function collectFromAdvisorApi(cookie) {
  const today = new Date().toISOString().slice(0, 10);
  const results = [];
  const seen = new Set();

  for (const cat of CATEGORIES) {
    try {
      const url = `https://creator-advisor.naver.com/api/v6/trend/category?categories=${encodeURIComponent(cat)}&contentType=text&date=${today}&hasRankChange=true&interval=day&limit=20&service=naver_blog`;

      const res = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Cookie': cookie,
          'Referer': 'https://creator-advisor.naver.com/',
          'Accept': 'application/json',
        },
        timeout: 8000,
      });

      const items = res.data?.keywordList || res.data?.keywords || res.data?.data || [];
      items.slice(0, 10).forEach((item, i) => {
        const kw = item.keyword || item.name || item.title || '';
        if (!kw || seen.has(kw)) return;
        seen.add(kw);
        results.push({
          keyword: kw,
          rank: i + 1,
          category: cat,
          rank_change: item.rankChange || item.rank_change || 0,
          isNew: item.isNew || item.is_new || false,
          collectedAt: Date.now(),
        });
      });

      await new Promise(r => setTimeout(r, 100));
    } catch (err) {
      console.error(`${cat} 수집 오류: ${err.response?.status} ${err.message}`);
    }
  }

  return results;
}

async function collectAll({ cookie } = {}) {
  if (cookie) {
    try {
      const results = await collectFromAdvisorApi(cookie);
      if (results.length > 0) {
        console.log(`크리에이터 어드바이저 수집 완료: ${results.length}개`);
        return results;
      }
    } catch (err) {
      console.warn('API 실패, Mock 사용:', err.message);
    }
  }

  console.log('Mock 데이터 32개 카테고리 사용');
  return generateMockData();
}

module.exports = { collectAll, CATEGORIES };
