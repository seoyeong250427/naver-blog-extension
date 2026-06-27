// 네이버 트렌드 페이지 content script - 카테고리별 키워드 수집

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_TREND_KEYWORDS') {
    collectFromTrendsPage(msg.options).then(sendResponse);
    return true;
  }
});

async function collectFromTrendsPage(options) {
  const { newOnly = true, maxRank = 20 } = options;

  const categories = [
    { id: '100', name: '비즈니스/경제' }, { id: '101', name: '맛집' },
    { id: '102', name: '세계여행' },      { id: '103', name: '패션/미용' },
    { id: '104', name: '상품리뷰' },      { id: '105', name: '육아/결혼' },
    { id: '106', name: '일상/생각' },     { id: '107', name: '국내여행' },
    { id: '108', name: '건강/의학' },     { id: '109', name: '요리/레시피' },
    { id: '110', name: '교육/학문' },     { id: '111', name: 'IT/컴퓨터' },
    { id: '112', name: '인테리어/DIY' },  { id: '113', name: '자동차' },
    { id: '114', name: '스타/연예인' },   { id: '115', name: '방송' },
    { id: '116', name: '취미' },          { id: '117', name: '스포츠' },
    { id: '118', name: '게임' },          { id: '119', name: '사회/정치' },
    { id: '120', name: '영화' },          { id: '121', name: '드라마' },
    { id: '122', name: '여학/외국어' },   { id: '123', name: '문학/책' },
    { id: '124', name: '반려동물' },      { id: '125', name: '음악' },
    { id: '126', name: '공연/전시' },     { id: '127', name: '쫄은글/이미지' },
    { id: '128', name: '원예/재배' },     { id: '129', name: '사진' },
    { id: '130', name: '만화/애니' },     { id: '131', name: '미술/디자인' }
  ];

  const results = [];
  const seen = new Set();

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
        if (item.rank > maxRank) continue;
        if (newOnly && !item.isNew) continue;
        if (!item.keyword || seen.has(item.keyword)) continue;

        seen.add(item.keyword);
        results.push({
          keyword: item.keyword,
          isNew: item.isNew || false,
          rank: item.rank || results.length + 1,
          riseRank: item.rankingChange || 0,
          category: cat.name,
          collectedAt: Date.now()
        });
      }
    } catch(e) {
      continue;
    }

    await new Promise(r => setTimeout(r, 100));
  }

  return results;
}
