// 네이버 트렌드 키워드 수집 - 크리에이터 어드바이저 API + Mock 데이터 fallback
const axios = require('axios');

// 32개 카테고리 Mock 데이터
const MOCK_CATEGORIES = [
  "맛집", "카페/디저트", "여행/국내", "여행/해외", "푸드/레시피",
  "IT/가젯", "패션/의류", "뷰티/화장품", "리빙/인테리어", "원예/식물",
  "자동차", "등산/아웃도어", "캠핑/글램핑", "골프", "낚시",
  "일상/생각", "육아/아동", "반려동물", "예술/디자인", "공연/전시",
  "도서/문학", "비즈니스/경제", "주식/재테크", "부동산", "학습/교육",
  "사진/카메라", "영화/드라마", "건강/의학", "취미/DIY", "외국어/학습",
  "만화/웹툰", "음악/악기"
];

const MOCK_KEYWORDS = {
  "맛집": ["성수동 신상 오마카세 맛집", "연남동 야키토리 골목 맛집", "망원시장 가성비 칼국수", "여의도 한우 룸식당", "압구정 수제버거 맛집"],
  "카페/디저트": ["종로 한옥 감성 카페", "연희동 스페셜티 드립커피", "수원 행궁동 크루키 핫플", "성수 루프탑 크로플", "송리단길 조용한 카페"],
  "여행/국내": ["강릉 주문진 오션뷰 숙소", "제주도 서귀포 수국 명소", "경주 황리단길 당일치기", "부산 영도 흰여울마을", "남해 독일마을 펜션"],
  "여행/해외": ["일본 후쿠오카 자유여행", "베트남 다낭 쇼핑 리스트", "태국 방콕 가성비 호텔", "대만 타이베이 예스진지", "유럽 이탈리아 로마 투어"],
  "푸드/레시피": ["백종원 소고기 무국 레시피", "에어프라이어 마늘빵 만들기", "다이어트 양배추 참치 덮밥", "토마토 바질 파스타 황금비율", "수제 그릭요거트 만들기"],
  "IT/가젯": ["아이폰 최신 후기", "노이즈캔슬링 헤드폰 추천", "맥북 에어 성능 비교", "기계식 키보드 입문 가이드", "갤럭시 워치 LTE 설정"],
  "패션/의류": ["여름 원피스 체형별 추천", "오버핏 린넨 셔츠 코디", "남자 반바지 브랜드 추천", "스트릿 패션 무신사 추천", "빈티지 청바지 쇼핑"],
  "뷰티/화장품": ["여름 선크림 추천 2024", "수분크림 저자극 추천", "쿠션 파운데이션 비교", "눈가 주름 아이크림", "무기자차 선스틱 추천"],
  "리빙/인테리어": ["작은 원룸 인테리어 꿀팁", "북유럽 감성 거실 꾸미기", "화장실 수납 선반 추천", "주방 타일 셀프 시공", "침실 조명 분위기 연출"],
  "원예/식물": ["베란다 텃밭 토마토 키우기", "다육이 물주기 주기", "공기정화 식물 추천", "고무나무 분갈이 방법", "수경재배 채소 키우기"],
  "자동차": ["전기차 아이오닉6 장거리 후기", "중고차 구매 체크리스트", "블랙박스 추천 2024", "셀프 세차 용품 추천", "타이어 교체 시기 확인"],
  "등산/아웃도어": ["북한산 등산 코스 추천", "등산화 브랜드 비교", "트레킹 배낭 고르는 법", "여름 산행 필수 용품", "초보자 등산 코스"],
  "캠핑/글램핑": ["가평 글램핑장 추천", "캠핑 텐트 브랜드 비교", "오토캠핑 장비 체크리스트", "캠핑 요리 레시피", "겨울 캠핑 난방 용품"],
  "골프": ["골프 입문자 클럽 추천", "스크린골프 연습 방법", "골프웨어 브랜드 추천", "필드 라운딩 예절", "골프 레슨 비용"],
  "낚시": ["한강 붕어낚시 포인트", "바다낚시 입문 장비", "루어낚시 미노우 추천", "제주 갯바위 낚시", "낚시 릴 브랜드 비교"],
  "일상/생각": ["30대 직장인 일상 브이로그", "혼밥 혼술 즐기는 법", "주말 집순이 루틴", "미니멀 라이프 실천 방법", "감사일기 쓰는 법"],
  "육아/아동": ["신생아 수면 교육 방법", "유아 이유식 레시피", "어린이집 준비물 체크리스트", "아기 발달 놀이 추천", "초등학생 용돈 교육"],
  "반려동물": ["강아지 산책 루틴 만들기", "고양이 중성화 수술 비용", "강아지 훈련 기초", "고양이 모래 추천", "반려동물 보험 비교"],
  "예술/디자인": ["수채화 입문 준비물", "아이패드 드로잉 앱 추천", "디지털 일러스트 강의", "캘리그라피 독학 방법", "사진 보정 라이트룸 기초"],
  "공연/전시": ["서울 무료 전시 추천", "뮤지컬 티켓 예매 방법", "미술관 관람 에티켓", "홍대 인디밴드 공연", "국립현대미술관 전시"],
  "도서/문학": ["2024 베스트셀러 소설", "자기계발 추천 도서", "독서 습관 만드는 법", "북클럽 운영 방법", "전자책 리더기 추천"],
  "비즈니스/경제": ["부업 아이디어 2024", "재택근무 생산성 향상", "스타트업 창업 준비", "직장인 연말정산 팁", "엑셀 업무 자동화"],
  "주식/재테크": ["ETF 투자 입문 가이드", "월급쟁이 재테크 방법", "미국주식 시작하는 법", "청약 당첨 전략", "적금 금리 비교"],
  "부동산": ["전세 계약 체크리스트", "청약 가점 계산 방법", "아파트 실거래가 조회", "월세 계약시 주의사항", "부동산 투자 입문"],
  "학습/교육": ["공무원 시험 준비 방법", "토익 단기간 점수 올리기", "온라인 강의 추천", "자격증 공부 계획표", "수능 국어 공부법"],
  "사진/카메라": ["미러리스 카메라 추천", "스마트폰 사진 잘 찍는 법", "인물 사진 배경 흐리기", "풍경 사진 구도 잡기", "사진 편집 앱 추천"],
  "영화/드라마": ["2024 넷플릭스 추천작", "역대 명작 한국 영화", "주말 드라마 추천", "영화 OTT 비교", "공포 영화 추천"],
  "건강/의학": ["다이어트 식단 짜는 법", "홈트레이닝 루틴", "수면 질 높이는 방법", "비타민 영양제 추천", "허리 통증 스트레칭"],
  "취미/DIY": ["레진아트 입문 키트", "뜨개질 독학 유튜브", "프라모델 입문 추천", "핸드드립 커피 도구", "가죽공예 입문 세트"],
  "외국어/학습": ["일본어 혼자 공부하는 법", "영어 회화 유튜브 채널", "스페인어 입문 앱 추천", "중국어 HSK 준비", "언어 교환 파트너 찾기"],
  "만화/웹툰": ["2024 인기 네이버 웹툰", "카카오 웹툰 추천", "만화책 수집 입문", "레진코믹스 추천작", "웹툰 작가 되는 법"],
  "음악/악기": ["기타 독학 입문 방법", "피아노 성인 독학", "유튜브 드럼 레슨 추천", "DAW 음악 제작 입문", "우쿨렐레 코드 기초"]
};

function generateMockData() {
  const trends = [];
  let rank = 1;
  for (const cat of MOCK_CATEGORIES) {
    const keywords = MOCK_KEYWORDS[cat] || [`${cat} 트렌드 키워드`, `${cat} 추천`, `${cat} 정보`];
    keywords.forEach((kw, i) => {
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

// 크리에이터 어드바이저 API 직접 호출
async function collectFromAdvisorApi(cookie, advisorUrl) {
  // URL에서 channelType, channelId 추출
  // https://creator-advisor.naver.com/naver_blog/foodlover1109/trends
  const match = advisorUrl.match(/creator-advisor\.naver\.com\/([^/]+)\/([^/]+)/);
  if (!match) throw new Error('advisor URL 형식이 잘못됐습니다.');

  const channelType = match[1]; // naver_blog
  const channelId = match[2];  // foodlover1109
  const apiUrl = `https://creator-advisor.naver.com/api/v6/${channelType}/${channelId}/trends`;

  const response = await axios.get(apiUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Cookie': cookie,
      'Referer': advisorUrl,
      'Accept': 'application/json, text/plain, */*',
    },
    timeout: 10000,
  });

  if (response.status !== 200 || !response.data) throw new Error('API 응답 없음');

  const keywordList = response.data.keywordRankList || response.data.keywords || response.data.data || [];
  if (!keywordList.length) throw new Error('키워드 데이터 없음');

  return keywordList.map((item, idx) => ({
    keyword: item.keyword || item.name || '',
    rank: item.rank || idx + 1,
    category: item.categoryName || item.category || '크리에이터 트렌드',
    rank_change: item.rankChange || 0,
    isNew: item.isNew || false,
    collectedAt: Date.now(),
  })).filter(item => item.keyword);
}

// 전체 수집 진입점
async function collectAll({ cookie, advisorUrl } = {}) {
  // 쿠키와 URL이 있으면 실제 API 호출
  if (cookie && advisorUrl) {
    try {
      const results = await collectFromAdvisorApi(cookie, advisorUrl);
      console.log(`크리에이터 어드바이저 수집 완료: ${results.length}개`);
      return results;
    } catch (err) {
      console.warn('크리에이터 어드바이저 API 실패, Mock 데이터 사용:', err.message);
    }
  }

  // 쿠키 없거나 실패 시 Mock 데이터
  console.log('Mock 데이터 32개 카테고리 사용');
  return generateMockData();
}

module.exports = { collectAll, MOCK_CATEGORIES };
