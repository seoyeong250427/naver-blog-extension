// 네이버 트렌드 페이지 키워드 수집 content script

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_TREND_KEYWORDS') {
    collectKeywords(msg.options).then(sendResponse);
    return true;
  }
});

async function collectKeywords(options) {
  const { newOnly = true, maxRank = 20, minRiseRank = 0 } = options;
  const results = [];

  try {
    // 네이버 트렌드 32개 카테고리 ID 목록
    const categories = [
      { id: '100', name: '비지니스/경제' },
      { id: '101', name: '맛집' },
      { id: '102', name: '세계여행' },
      { id: '103', name: '패션/미용' },
      { id: '104', name: '상품리뷰' },
      { id: '105', name: '육아/결혼' },
      { id: '106', name: '일상/생각' },
      { id: '107', name: '국내여행' },
      { id: '108', name: '건강/의학' },
      { id: '109', name: '요리/레시피' },
      { id: '110', name: '교육/학문' },
      { id: '111', name: 'IT/컴퓨터' },
      { id: '112', name: '인테리어/DIY' },
      { id: '113', name: '자동차' },
      { id: '114', name: '스타/연예인' },
      { id: '115', name: '방송' },
      { id: '116', name: '취미' },
      { id: '117', name: '스포츠' },
      { id: '118', name: '게임' },
      { id: '119', name: '사회/정치' },
      { id: '120', name: '영화' },
      { id: '121', name: '드라마' },
      { id: '122', name: '여학/외국어' },
      { id: '123', name: '문학/책' },
      { id: '124', name: '반려동물' },
      { id: '125', name: '음악' },
      { id: '126', name: '공연/전시' },
      { id: '127', name: '쫄은글/이미지' },
      { id: '128', name: '원예/재배' },
      { id: '129', name: '사진' },
      { id: '130', name: '만화/애니' },
      { id: '131', name: '미술/디자인' }
    ];

    // 현재 페이지가 트렌드 페이지인지 확인
    if (!location.href.includes('trends.naver.com')) {
      return [];
    }

    // 각 카테고리에서 키워드 수집
    for (const cat of categories) {
      try {
        const url = `https://trends.naver.com/trends/keywordsChartList.naver?period=DAILY&categoryId=${cat.id}`;
        const res = await fetch(url, {
          credentials: 'include',
          headers: { 'Accept': 'application/json' }
        });

        if (!res.ok) continue;

        const data = await res.json();
        const items = data.keywordList || [];

        for (const item of items) {
          const rank = item.rank || 999;
          const isNew = item.isNew || false;
          const riseRank = item.rankingChange || 0;

          if (rank > maxRank) continue;
          if (newOnly && !isNew) continue;
          if (riseRank < minRiseRank) continue;

          const keyword = item.keyword;
          if (!keyword) continue;

          // 중복 제거
          if (!results.find(r => r.keyword === keyword)) {
            results.push({
              keyword,
              isNew,
              rank,
              riseRank,
              category: cat.name,
              collectedAt: Date.now()
            });
          }
        }
      } catch (e) {
        // 카테고리별 실패는 무시하고 계속
        console.warn(`카테고리 ${cat.name} 수집 실패:`, e);
      }
    }
  } catch (e) {
    console.error('트렌드 수집 실패:', e);
  }

  return results;
}
