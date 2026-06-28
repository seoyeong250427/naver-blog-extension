// 황금키워드 도구 메인 스크립트 - Electron 버전

// ── 페르소나 프롬프트 (모바일 최적화 네이버 블로그 형식) ──────────────
const PERSONAS = {
  trend: {
    label: '트렌드 정보형',
    buildPrompt: (kws) => `
너는 네이버 블로그 트렌드 정보형 글쓰기 전문가다.
메인 키워드: "${kws[0]}"
연관 키워드: ${kws.slice(1).join(', ') || '없음'}

다음 규칙을 반드시 지켜라:

[제목 규칙]
- 메인 키워드를 제목에 1번 포함
- 20자 이내, 클릭을 유도하는 제목
- 형식: 제목: (제목 내용)

[본문 규칙]
- 총 1500자 내외로 작성
- 메인 키워드를 본문에 자연스럽게 4~5회 포함
- 모바일 가독성을 위해 짧은 단문으로 작성 (한 문장 20자 이내)
- 각 문장은 가운데 정렬처럼 단독 줄로 배치
- 단락 사이 빈 줄 삽입
- 강조할 내용 앞에 이모지 사용 (✅ 💡 🔥 ⭐ 👉 📌 등)
- 구조: 도입(2~3줄) → 핵심정보 3~4항목(소제목+내용) → 마무리(2~3줄)

[해시태그 규칙]
- 본문 맨 마지막에 해시태그 15~20개
- 메인 키워드 → 연관 키워드 → 확장 키워드 순서
- 한 줄에 5개씩 줄바꿈

출력 예시 형식:
제목: [제목]

[본문 내용]

#태그1 #태그2 #태그3 #태그4 #태그5
#태그6 #태그7 ...
`
  },
  food: {
    label: '맛집 정보형',
    buildPrompt: (kws) => `
너는 솔직하고 따뜻한 맛집 리뷰 블로거다.
메인 키워드: "${kws[0]}"
연관 키워드: ${kws.slice(1).join(', ') || '없음'}

[제목 규칙]
- 키워드 포함, 20자 이내
- 형식: 제목: (제목 내용)

[본문 규칙]
- 총 1500자 내외
- 키워드 본문에 4~5회 자연스럽게 포함
- 모바일 단문 스타일 (한 줄 20자 이내, 각 문장 독립된 줄)
- 이모지로 섹션 구분: 🏪 첫인상 → 🍽️ 메뉴 → ✨ 맛 → 📍 위치/가격 → 💕 재방문
- 해시태그 15~20개

출력 형식:
제목: ...

본문...

#해시태그들
`
  },
  travel: {
    label: '여행 감성형',
    buildPrompt: (kws) => `
너는 감성적인 여행 블로거다.
메인 키워드: "${kws[0]}"
연관 키워드: ${kws.slice(1).join(', ') || '없음'}

[제목 규칙]
- 키워드 포함, 감성적인 20자 이내
- 형식: 제목: (제목 내용)

[본문 규칙]
- 총 1500자 내외
- 키워드 4~5회 포함
- 모바일 단문, 감성적 표현
- 이모지: ✈️ 도입 → 🗺️ 볼거리 → ☕ 맛집/카페 → 💡 팁 → 🌅 마무리
- 해시태그 15~20개

출력 형식:
제목: ...

본문...

#해시태그들
`
  },
  cafe: {
    label: '카페 감성형',
    buildPrompt: (kws) => `
너는 감성 카페 소개 블로거다.
메인 키워드: "${kws[0]}"
연관 키워드: ${kws.slice(1).join(', ') || '없음'}

[제목 규칙]
- 키워드 포함, 감성적인 20자 이내
- 형식: 제목: (제목 내용)

[본문 규칙]
- 총 1500자 내외
- 키워드 4~5회 포함
- 모바일 단문 스타일
- 이모지: ☕ 분위기 → ✨ 인테리어 → 🧁 메뉴 → 📍 위치/가격 → 💕 재방문
- 해시태그 15~20개

출력 형식:
제목: ...

본문...

#해시태그들
`
  },
  it: {
    label: 'IT/가젯 정보형',
    buildPrompt: (kws) => `
너는 IT 제품 리뷰 전문 블로거다.
메인 키워드: "${kws[0]}"
연관 키워드: ${kws.slice(1).join(', ') || '없음'}

[제목 규칙]
- 키워드 포함, 클릭 유도 20자 이내
- 형식: 제목: (제목 내용)

[본문 규칙]
- 총 1500자 내외
- 키워드 4~5회 포함
- 모바일 단문
- 이모지: 📱 개요 → ⚡ 기능 → ✅ 장점 → ❌ 단점 → 💰 가격/추천
- 해시태그 15~20개

출력 형식:
제목: ...

본문...

#해시태그들
`
  },
  daily: {
    label: '일상/브이로그',
    buildPrompt: (kws) => `
너는 친근한 일상 블로거다.
메인 키워드: "${kws[0]}"
연관 키워드: ${kws.slice(1).join(', ') || '없음'}

[제목 규칙]
- 키워드 포함, 공감 가는 20자 이내
- 형식: 제목: (제목 내용)

[본문 규칙]
- 총 1500자 내외
- 키워드 4~5회 포함
- 친구에게 말하듯 짧은 단문
- 이모지로 감정 표현 😊 🥰 😅 💪 💭 🌙
- 해시태그 15~20개

출력 형식:
제목: ...

본문...

#해시태그들
`
  }
};

// ── 상태 ──────────────────────────────────────────────────────────────
const S = {
  keywords: [],
  publishedKeywords: [],
  writeHistory: {},
  settings: {},
  accounts: [],
  sortCol: 'rank',
  sortDir: 'asc',
  selectedIds: new Set(),
  writeKeywords: [],
  photos: [],
  currentPersona: 'trend',
  autoTimer: null,
  autoOn: false
};

// ── 초기화 ────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadAll();
  initTabs();
  initKeywordTab();
  initWriteTab();
  initSettingsTab();
  renderTable();
  renderAccountSelect();
  updateHeader();
  loadSettingsUI();
  renderHistory();
  initAutoCollect();
});

async function loadAll() {
  try {
    const data = await window.electronAPI.loadData();
    S.keywords          = data.keywords          || [];
    S.settings          = data.settings          || {};
    S.accounts          = data.accounts          || [];
    S.publishedKeywords = data.publishedKeywords || [];
    S.writeHistory      = data.writeHistory      || {};
  } catch(e) {
    console.error('데이터 로드 실패:', e);
  }
}

async function persist(keys) {
  const data = {};
  keys.forEach(k => { data[k] = S[k]; });
  try {
    await window.electronAPI.saveData(data);
  } catch(e) {
    console.error('저장 실패:', e);
  }
}

function updateHeader() {
  document.getElementById('headerCount').textContent = `${S.keywords.length}개 수집`;
}

// ── 탭 ────────────────────────────────────────────────────────────────
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
      if (btn.dataset.tab === 'history') renderHistory();
    });
  });
  document.getElementById('goSettings').addEventListener('click', () => {
    document.querySelector('[data-tab="settings"]').click();
  });
}

// ── 자동수집 ──────────────────────────────────────────────────────────
function initAutoCollect() {
  document.getElementById('autoBtn').addEventListener('click', toggleAutoCollect);
  if (S.settings.autoOn) { S.autoOn = true; startAutoCollect(); }
}

function toggleAutoCollect() {
  S.autoOn = !S.autoOn;
  S.settings.autoOn = S.autoOn;
  persist(['settings']);
  if (S.autoOn) startAutoCollect(); else stopAutoCollect();
}

function startAutoCollect() {
  const btn = document.getElementById('autoBtn');
  btn.textContent = '⏰ 자동수집 끄기';
  btn.classList.add('on');
  document.getElementById('autoDot').classList.add('active');
  document.getElementById('autoStatusText').textContent = '자동수집 켜짐';
  document.getElementById('autoBanner').classList.add('show');
  scheduleNextCollect();
}

function stopAutoCollect() {
  const btn = document.getElementById('autoBtn');
  btn.textContent = '⏰ 자동수집 켜기';
  btn.classList.remove('on');
  document.getElementById('autoDot').classList.remove('active');
  document.getElementById('autoStatusText').textContent = '자동수집 꺼짐';
  document.getElementById('autoBanner').classList.remove('show');
  if (S.autoTimer) { clearTimeout(S.autoTimer); S.autoTimer = null; }
}

function scheduleNextCollect() {
  const now = new Date();
  const [h, m] = (S.settings.sAutoTime || '06:00').split(':').map(Number);
  const target = new Date(now);
  target.setHours(h, m, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);

  const ms = target - now;
  document.getElementById('nextCollectTime').textContent =
    `${target.getMonth()+1}/${target.getDate()} ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;

  S.autoTimer = setTimeout(async () => {
    setStatus('⏰ 자동수집 시작...');
    await collectTrends();
    const interval = parseInt(S.settings.sAutoInterval || 0);
    if (interval > 0) setTimeout(() => scheduleNextCollect(), interval * 60 * 1000);
    else scheduleNextCollect();
  }, ms);

  document.getElementById('closeBanner').addEventListener('click', () => {
    document.getElementById('autoBanner').classList.remove('show');
  }, { once: true });
}

// ── 키워드 탭 ─────────────────────────────────────────────────────────
function initKeywordTab() {
  document.getElementById('collectBtn').addEventListener('click', collectTrends);
  document.getElementById('analyzeBtn').addEventListener('click', analyzeAll);
  document.getElementById('clearBtn').addEventListener('click', clearKeywords);
  document.getElementById('checkAll').addEventListener('change', toggleCheckAll);
  document.getElementById('writeSelectedBtn').addEventListener('click', goWriteSelected);

  ['fMinSearch','fMinGold','fMaxDoc','fNewOnly'].forEach(id => {
    document.getElementById(id).addEventListener('input', renderTable);
    document.getElementById(id).addEventListener('change', renderTable);
  });

  document.querySelectorAll('th[data-col]').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (S.sortCol === col) S.sortDir = S.sortDir==='asc'?'desc':'asc';
      else { S.sortCol = col; S.sortDir = col==='keyword'?'asc':'desc'; }
      renderTable();
    });
  });

  updateAnalyzeBtn();
}

function updateAnalyzeBtn() {
  const ok = !!(S.settings.naverAccessLicense && S.settings.naverSecretKey) && S.keywords.length > 0;
  document.getElementById('analyzeBtn').disabled = !ok;
}

async function collectTrends() {
  const btn = document.getElementById('collectBtn');
  btn.innerHTML = '<span class="spinner"></span> 수집 중...';
  btn.disabled = true;
  setStatus('네이버 트렌드 32개 카테고리에서 키워드 수집 중...');

  try {
    const res = await window.electronAPI.collectTrends({
      clientId: S.settings.naverClientId || '',
      clientSecret: S.settings.naverClientSecret || '',
      maxRank: parseInt(S.settings.sMaxRank || 20),
      newOnly: document.getElementById('fNewOnly').checked
    });

    if (res.success && res.data.length > 0) {
      const keywords = res.data;
      const existMap     = new Map(S.keywords.map(k => [k.keyword, k]));
      const publishedSet = new Set(S.publishedKeywords.map(p => typeof p==='string' ? p : p.keyword));
      let newCount = 0;

      for (const nk of keywords) {
        if (!existMap.has(nk.keyword)) {
          existMap.set(nk.keyword, {
            ...nk, pc:null, mobile:null, total:null,
            docCount:null, goldIndex:null,
            adPc1:null, adPc2:null, adMobile1:null, adMobile2:null,
            published: publishedSet.has(nk.keyword)
          });
          newCount++;
        }
      }

      S.keywords = [...existMap.values()];
      await persist(['keywords']);
      updateLastCollected();
      updateAnalyzeBtn();
      renderTable();
      updateHeader();
      setStatus(`✅ ${keywords.length}개 수집 완료 (신규 ${newCount}개).`);
    } else if (res.error === 'LOGIN_REQUIRED') {
      setStatus('⚠️ 네이버 로그인이 필요합니다. 로그인 후 다시 수집하세요.');
      const loginRes = await window.electronAPI.naverLogin();
      if (loginRes.success) {
        setStatus('✅ 로그인 완료. 수집 버튼을 다시 눌러주세요.');
      }
    } else {
      setStatus('⚠️ ' + (res.error || '키워드를 가져오지 못했습니다.'));
    }
  } catch(e) {
    setStatus('❌ 수집 오류: ' + e.message);
  }

  btn.textContent = '🔄 트렌드 키워드 수집';
  btn.disabled = false;
}

async function analyzeAll() {
  const { naverCustomerId:cid, naverAccessLicense:lic, naverSecretKey:sec } = S.settings;
  if (!lic || !sec) { showToast('네이버 광고 API 키를 설정에서 입력하세요.', true); return; }

  const targets = S.keywords.filter(k => k.total === null && !k.published);
  if (!targets.length) { showToast('분석할 키워드가 없습니다.'); return; }

  const btn = document.getElementById('analyzeBtn');
  btn.disabled = true;
  const bar = document.getElementById('progressBar');

  for (let i = 0; i < targets.length; i++) {
    const kw = targets[i];
    bar.style.width = `${Math.round(((i+1)/targets.length)*100)}%`;
    setStatus(`📊 분석 중 (${i+1}/${targets.length}): ${kw.keyword}`);
    try {
      const r = await window.electronAPI.analyzeKeywords({
        keywords: [{ keyword: kw.keyword, naverClientId: S.settings.naverClientId||'', naverClientSecret: S.settings.naverClientSecret||'' }],
        customerId: S.settings.naverCustomerId || '',
        apiKey: S.settings.naverAccessLicense || '',
        secretKey: S.settings.naverSecretKey || ''
      });
      if (r.success && r.data[0]) { const idx = S.keywords.findIndex(k=>k.keyword===kw.keyword); if (idx!==-1) Object.assign(S.keywords[idx], r.data[0]); }
    } catch(e) {}
    if (i < targets.length-1) await delay(350);
  }

  await persist(['keywords']);
  bar.style.width = '0%';
  btn.disabled = false;
  setStatus('✅ 광고/조회수 분석 완료.');
  renderTable();
}

function clearKeywords() {
  if (!confirm('수집된 키워드를 전부 삭제할까요?')) return;
  S.keywords = []; S.selectedIds.clear();
  persist(['keywords']);
  renderTable(); updateHeader(); setStatus('초기화 완료.');
}

function toggleCheckAll(e) {
  getFilteredSorted().forEach(kw => {
    if (kw.published) return;
    kw.selected = e.target.checked;
    if (e.target.checked) S.selectedIds.add(kw.keyword); else S.selectedIds.delete(kw.keyword);
  });
  renderTable();
}

function goWriteSelected() {
  const sel = S.keywords.filter(k => S.selectedIds.has(k.keyword));
  if (!sel.length) return;
  S.writeKeywords = sel.map(k => k.keyword);
  renderWriteKwTags();
  document.querySelector('[data-tab="write"]').click();
  showToast(`${sel.length}개 키워드 전달 완료.`);
}

function getFilteredSorted() {
  const minSearch = parseFloat(document.getElementById('fMinSearch').value) || 0;
  const minGold   = parseFloat(document.getElementById('fMinGold').value)   || 0;
  const maxDoc    = parseFloat(document.getElementById('fMaxDoc').value)     || 0;
  const newOnly   = document.getElementById('fNewOnly').checked;

  let list = S.keywords.filter(kw => {
    if (newOnly && !kw.isNew) return false;
    if (kw.total     !== null && kw.total     < minSearch) return false;
    if (kw.goldIndex !== null && kw.goldIndex < minGold)   return false;
    if (maxDoc > 0 && kw.docCount !== null && kw.docCount > maxDoc) return false;
    return true;
  });

  list.sort((a,b) => {
    if (a.published && !b.published) return 1;
    if (!a.published && b.published) return -1;
    let va = a[S.sortCol], vb = b[S.sortCol];
    if (va==null) return 1; if (vb==null) return -1;
    if (typeof va==='string') return S.sortDir==='asc' ? va.localeCompare(vb,'ko') : vb.localeCompare(va,'ko');
    return S.sortDir==='asc' ? va-vb : vb-va;
  });

  return list;
}

function renderTable() {
  const tbody = document.getElementById('kwBody');
  const list  = getFilteredSorted();
  const publishedSet = new Set(S.publishedKeywords.map(p => typeof p==='string' ? p : p.keyword));

  document.querySelectorAll('th[data-col]').forEach(th => {
    th.classList.remove('sort-asc','sort-desc');
    if (th.dataset.col===S.sortCol) th.classList.add(S.sortDir==='asc'?'sort-asc':'sort-desc');
  });

  document.getElementById('resultCount').textContent = list.length;
  document.getElementById('totalCount').textContent  = S.keywords.length;

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="13"><div class="empty-state"><div class="icon">📭</div><p>수집된 키워드가 없습니다.</p><small>트렌드 키워드 수집 버튼을 눌러 시작하세요.</small></div></td></tr>`;
    updateSelectedBar(); return;
  }

  tbody.innerHTML = list.map(kw => {
    const isPub   = publishedSet.has(kw.keyword);
    const checked = S.selectedIds.has(kw.keyword);
    const gcls    = goldClass(kw.goldIndex);
    const newB    = kw.isNew ? '<span class="badge-new">NEW</span>' : '';
    const pubB    = isPub    ? '<span class="badge-pub">발행완료</span>' : '';

    return `<tr class="${checked?'selected':''} ${isPub?'published-row':''}" data-kw="${esc(kw.keyword)}">
      <td><input type="checkbox" ${checked?'checked':''} ${isPub?'disabled':''}></td>
      <td class="${isPub?'published-kw':''}">${esc(kw.keyword)}${newB}${pubB}</td>
      <td>${esc(kw.category||'-')}</td>
      <td>${kw.rank??'-'}</td>
      <td>${fmt(kw.pc)}</td>
      <td>${fmt(kw.mobile)}</td>
      <td>${fmt(kw.total)}</td>
      <td>${fmt(kw.docCount)}</td>
      <td class="${gcls}">${kw.goldIndex!=null?kw.goldIndex.toFixed(1):'-'}</td>
      <td>${fmt(kw.adPc1)}</td>
      <td>${fmt(kw.adPc2)}</td>
      <td>${fmt(kw.adMobile1)}</td>
      <td>${fmt(kw.adMobile2)}</td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('tr[data-kw]').forEach(tr => {
    const kw = tr.dataset.kw;
    const cb = tr.querySelector('input[type="checkbox"]');
    if (!cb || cb.disabled) return;
    const toggle = () => {
      if (S.selectedIds.has(kw)) { S.selectedIds.delete(kw); tr.classList.remove('selected'); cb.checked=false; }
      else { S.selectedIds.add(kw); tr.classList.add('selected'); cb.checked=true; }
      updateSelectedBar();
    };
    cb.addEventListener('change', toggle);
    tr.addEventListener('click', e => { if (e.target.tagName!=='INPUT') toggle(); });
  });

  updateSelectedBar();
}

function updateSelectedBar() {
  const cnt = S.selectedIds.size;
  document.getElementById('selectedBar').classList.toggle('show', cnt>0);
  if (cnt>0) document.getElementById('selectedCount').textContent = `${cnt}개 선택`;
}

function updateLastCollected() {
  const now = new Date();
  document.getElementById('lastCollected').textContent =
    `최근 수집 ${now.getFullYear()}. ${now.getMonth()+1}. ${now.getDate()}. ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
}

function goldClass(v) {
  if (v==null) return '';
  if (v>=200) return 'gold-high';
  if (v>=50)  return 'gold-mid';
  return 'gold-low';
}
function fmt(v) { if (v==null) return '-'; return Number(v).toLocaleString('ko-KR'); }
function setStatus(msg) { document.getElementById('statusMsg').textContent = msg; }

// ── 작성 기록 탭 ──────────────────────────────────────────────────────
function renderHistory() {
  const wrap  = document.getElementById('historyWrap');
  const dates = Object.keys(S.writeHistory).sort().reverse();

  if (!dates.length) {
    wrap.innerHTML = '<div class="history-empty">📝 아직 작성 기록이 없습니다.</div>';
    return;
  }

  wrap.innerHTML = dates.map(date => {
    const items = S.writeHistory[date] || [];
    return `<div class="history-day">
      <div class="history-day-title">📅 ${date} <span class="history-day-count">${items.length}건</span></div>
      <div class="history-kw-list">
        ${items.map(it => `<div class="history-kw" title="${esc(it.title||'')}">${esc(it.keyword)}<span style="font-size:10px;color:#9ca3af;margin-left:4px;">${it.time||''}</span></div>`).join('')}
      </div>
    </div>`;
  }).join('');
}

function recordWriteHistory(keyword, title) {
  const now  = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const time = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  if (!S.writeHistory[date]) S.writeHistory[date] = [];
  S.writeHistory[date].push({ keyword, title, time });
  persist(['writeHistory']);
}

function markPublished(keyword, title) {
  const pub = typeof S.publishedKeywords[0]==='string' ? S.publishedKeywords.map(k=>({keyword:k,title:'',date:''})) : S.publishedKeywords;
  if (!pub.find(p=>p.keyword===keyword)) {
    pub.push({ keyword, title, date: new Date().toISOString() });
    S.publishedKeywords = pub;
  }
  const idx = S.keywords.findIndex(k=>k.keyword===keyword);
  if (idx!==-1) S.keywords[idx].published = true;
  persist(['publishedKeywords','keywords']);
}

// ── 글쓰기 탭 ─────────────────────────────────────────────────────────
function initWriteTab() {
  document.querySelectorAll('.persona-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.persona-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      S.currentPersona = btn.dataset.p;
    });
  });

  const kwInput = document.getElementById('writeKwInput');
  document.getElementById('addKwBtn').addEventListener('click', ()=>{ addWriteKw(kwInput.value.trim()); kwInput.value=''; });
  kwInput.addEventListener('keydown', e=>{ if(e.key==='Enter'){ addWriteKw(kwInput.value.trim()); kwInput.value=''; } });

  const uploadArea = document.getElementById('uploadArea');
  const photoInput = document.getElementById('photoInput');
  uploadArea.addEventListener('click', e=>{ if(e.target!==photoInput) photoInput.click(); });
  photoInput.addEventListener('change', e=>addPhotos(e.target.files));
  uploadArea.addEventListener('dragover', e=>{ e.preventDefault(); uploadArea.classList.add('dragover'); });
  uploadArea.addEventListener('dragleave', ()=>uploadArea.classList.remove('dragover'));
  uploadArea.addEventListener('drop', e=>{ e.preventDefault(); uploadArea.classList.remove('dragover'); addPhotos(e.dataTransfer.files); });

  document.getElementById('generateBtn').addEventListener('click', generatePost);
  document.getElementById('regenBtn').addEventListener('click', generatePost);
  document.getElementById('copyBtn').addEventListener('click', ()=>{
    navigator.clipboard.writeText(document.getElementById('resultArea').textContent)
      .then(()=>showToast('클립보드에 복사됐습니다.'));
  });
  document.getElementById('publishBtn').addEventListener('click', publishToNaver);

  document.getElementById('resultArea').addEventListener('input', ()=>{
    const len = document.getElementById('resultArea').textContent.length;
    document.getElementById('charCount').textContent = `${len.toLocaleString()}자`;
  });
}

function addWriteKw(kw) {
  if (!kw || S.writeKeywords.includes(kw)) return;
  S.writeKeywords.push(kw);
  renderWriteKwTags();
}

function renderWriteKwTags() {
  const c = document.getElementById('writeKwTags');
  c.innerHTML = S.writeKeywords.map(kw=>`<span class="kw-tag">${esc(kw)}<button data-kw="${esc(kw)}">✕</button></span>`).join('');
  c.querySelectorAll('button').forEach(btn=>{
    btn.addEventListener('click', ()=>{ S.writeKeywords=S.writeKeywords.filter(k=>k!==btn.dataset.kw); renderWriteKwTags(); });
  });
}

function addPhotos(files) {
  Array.from(files).filter(f=>['image/jpeg','image/png','image/webp'].includes(f.type)).forEach(f=>S.photos.push(f));
  renderPhotoGrid();
}

function renderPhotoGrid() {
  const grid = document.getElementById('photoGrid');
  const ph   = document.getElementById('uploadPlaceholder');
  if (!S.photos.length) { ph.style.display='block'; grid.innerHTML=''; return; }
  ph.style.display = 'none';
  grid.innerHTML = S.photos.map((f,i)=>`<div class="photo-thumb"><img src="${URL.createObjectURL(f)}"><button class="rm" data-i="${i}">✕</button></div>`).join('');
  grid.querySelectorAll('.rm').forEach(btn=>{
    btn.addEventListener('click', e=>{ e.stopPropagation(); S.photos.splice(+btn.dataset.i,1); renderPhotoGrid(); });
  });
}

async function generatePost() {
  if (!S.writeKeywords.length) { showToast('키워드를 입력하세요.', true); return; }
  const aiModel = document.getElementById('aiModel').value;
  const apiKey  = aiModel==='claude' ? S.settings.claudeApiKey : S.settings.openaiApiKey;
  if (!apiKey) { showToast(`${aiModel==='claude'?'Claude':'OpenAI'} API 키를 설정에서 입력하세요.`, true); return; }

  const btn = document.getElementById('generateBtn');
  btn.innerHTML = '<span class="spinner"></span> 생성 중...';
  btn.disabled = true;

  try {
    const persona  = PERSONAS[S.currentPersona];
    const sysPrompt = persona.buildPrompt(S.writeKeywords);
    const ref      = document.getElementById('refText').value.trim();
    const photos   = await Promise.all(S.photos.slice(0,4).map(fileToBase64));
    const userText = ref ? `추가 참고 정보: ${ref}` : '위 지침에 따라 네이버 블로그 글을 작성해줘.';

    let result;
    if (aiModel==='claude') result = await callClaude(apiKey, sysPrompt, userText, photos);
    else result = await callOpenAI(apiKey, sysPrompt, userText);

    const area = document.getElementById('resultArea');
    area.textContent = result;
    document.getElementById('charCount').textContent = `${result.length.toLocaleString()}자`;

    const title = result.split('\n').find(l=>l.startsWith('제목:'))?.replace('제목:','').trim() || S.writeKeywords[0];
    recordWriteHistory(S.writeKeywords[0], title);

  } catch(e) {
    showToast('생성 실패: ' + e.message, true);
  }

  btn.textContent = '🤖 글 생성하기';
  btn.disabled = false;
}

async function callClaude(key, system, userText, photos) {
  const content = [];
  photos.forEach(({ base64, mediaType }) => content.push({ type:'image', source:{ type:'base64', media_type:mediaType, data:base64 } }));
  content.push({ type:'text', text:userText });
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method:'POST',
    headers:{ 'Content-Type':'application/json', 'x-api-key':key, 'anthropic-version':'2023-06-01' },
    body: JSON.stringify({ model:'claude-sonnet-4-6', max_tokens:2500, system, messages:[{ role:'user', content }] })
  });
  if (!r.ok) { const e=await r.json().catch(()=>({})); throw new Error(e.error?.message||`API ${r.status}`); }
  return (await r.json()).content[0].text;
}

async function callOpenAI(key, system, userText) {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method:'POST',
    headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer '+key },
    body: JSON.stringify({ model:'gpt-4o', max_tokens:2500, messages:[{ role:'system', content:system },{ role:'user', content:userText }] })
  });
  if (!r.ok) { const e=await r.json().catch(()=>({})); throw new Error(e.error?.message||`API ${r.status}`); }
  return (await r.json()).choices[0].message.content;
}

async function publishToNaver() {
  const accountId = document.getElementById('accountSelect').value;
  if (!accountId) { showToast('발행 계정을 선택하세요.', true); return; }
  const content = document.getElementById('resultArea').textContent;
  if (!content.trim()) { showToast('발행할 글이 없습니다.', true); return; }
  const keyword = S.writeKeywords[0] || '';
  const title   = content.split('\n').find(l=>l.startsWith('제목:'))?.replace('제목:','').trim() || keyword;
  await window.electronAPI.openExternal(`https://blog.naver.com/${accountId}/postwrite`);
  markPublished(keyword, title);
  renderTable();
  showToast('브라우저에서 네이버 블로그 에디터를 열었습니다. 내용을 붙여넣기 후 발행하세요.');
}

// ── 설정 탭 ───────────────────────────────────────────────────────────
function initSettingsTab() {
  document.getElementById('saveSettingsBtn').addEventListener('click', saveSettingsUI);
  document.getElementById('testNaverBtn').addEventListener('click', testNaverApi);
  document.getElementById('naverLoginBtn').addEventListener('click', async () => {
    const el = document.getElementById('naverLoginStatus');
    el.textContent = '로그인 창을 열고 있습니다...';
    const res = await window.electronAPI.naverLogin();
    if (res.success) {
      el.textContent = '✅ 로그인 완료. 이제 트렌드 키워드 수집이 가능합니다.';
      el.style.color = '#16a34a';
    } else {
      el.textContent = '❌ ' + (res.error || '로그인 실패');
      el.style.color = '#dc2626';
    }
  });
  document.getElementById('addAccountBtn').addEventListener('click', addAccount);
}

function loadSettingsUI() {
  const s = S.settings;
  ['sNaverCid','sNaverLic','sNaverSecret','sNaverClientId','sNaverClientSecret','sClaudeKey','sOpenaiKey','sAutoTime','sAutoInterval','sMaxRank','sMinRise'].forEach(id => {
    const key = { sNaverCid:'naverCustomerId', sNaverLic:'naverAccessLicense', sNaverSecret:'naverSecretKey', sNaverClientId:'naverClientId', sNaverClientSecret:'naverClientSecret', sClaudeKey:'claudeApiKey', sOpenaiKey:'openaiApiKey', sAutoTime:'sAutoTime', sAutoInterval:'sAutoInterval', sMaxRank:'sMaxRank', sMinRise:'sMinRise' }[id];
    if (s[key] != null) document.getElementById(id).value = s[key];
  });
  renderAccountList();
}

function saveSettingsUI() {
  S.settings = {
    ...S.settings,
    naverCustomerId:    document.getElementById('sNaverCid').value.trim(),
    naverAccessLicense: document.getElementById('sNaverLic').value.trim(),
    naverSecretKey:     document.getElementById('sNaverSecret').value.trim(),
    naverClientId:      document.getElementById('sNaverClientId').value.trim(),
    naverClientSecret:  document.getElementById('sNaverClientSecret').value.trim(),
    claudeApiKey:       document.getElementById('sClaudeKey').value.trim(),
    openaiApiKey:       document.getElementById('sOpenaiKey').value.trim(),
    sAutoTime:          document.getElementById('sAutoTime').value,
    sAutoInterval:      parseInt(document.getElementById('sAutoInterval').value)||0,
    sMaxRank:           parseInt(document.getElementById('sMaxRank').value)||20,
    sMinRise:           parseInt(document.getElementById('sMinRise').value)||0
  };
  persist(['settings', 'accounts']);
  updateAnalyzeBtn();
  const msg = document.getElementById('saveMsg');
  msg.style.display = 'inline';
  setTimeout(()=>{ msg.style.display='none'; }, 2000);
  if (S.autoOn) { stopAutoCollect(); startAutoCollect(); }
}

async function testNaverApi() {
  const lic = document.getElementById('sNaverLic').value.trim();
  const sec = document.getElementById('sNaverSecret').value.trim();
  const cid = document.getElementById('sNaverCid').value.trim();
  const el  = document.getElementById('naverTestResult');

  if (!lic || !sec || !cid) {
    el.textContent='❌ Customer ID, Access License, Secret Key를 모두 입력하세요.';
    el.className='api-err';
    return;
  }

  el.textContent='테스트 중...'; el.className='';
  try {
    const r = await window.electronAPI.analyzeKeywords({
      keywords: [{ keyword: '다이어트', naverClientId: '', naverClientSecret: '' }],
      customerId: cid, apiKey: lic, secretKey: sec
    });
    if (r.success && r.data && r.data.length > 0) {
      el.textContent='✅ 연결 성공'; el.className='api-ok';
    } else if (r.success) {
      el.textContent='⚠️ 연결됐지만 데이터 없음. API 키를 확인하세요.'; el.className='api-err';
    } else {
      el.textContent='❌ ' + r.error; el.className='api-err';
    }
  } catch(e) { el.textContent='❌ ' + e.message; el.className='api-err'; }
}

function addAccount() {
  const id = document.getElementById('newAccountInput').value.trim();
  if (!id || S.accounts.includes(id)) return;
  S.accounts.push(id);
  document.getElementById('newAccountInput').value = '';
  renderAccountList(); renderAccountSelect();
  persist(['accounts']);
}

function renderAccountList() {
  const c = document.getElementById('accountList');
  c.innerHTML = S.accounts.map(id=>`<div class="account-item"><span>@${esc(id)}</span><button class="account-rm" data-id="${esc(id)}">🗑️ 삭제</button></div>`).join('');
  c.querySelectorAll('.account-rm').forEach(btn=>{
    btn.addEventListener('click', ()=>{ S.accounts=S.accounts.filter(a=>a!==btn.dataset.id); persist(['accounts']); renderAccountList(); renderAccountSelect(); });
  });
}

function renderAccountSelect() {
  const sel = document.getElementById('accountSelect');
  const cur = sel.value;
  sel.innerHTML = '<option value="">계정 선택</option>' + S.accounts.map(id=>`<option value="${esc(id)}"${id===cur?' selected':''}>${esc(id)}</option>`).join('');
}

// ── 유틸 ──────────────────────────────────────────────────────────────
function delay(ms) { return new Promise(r=>setTimeout(r,ms)); }
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function fileToBase64(file) {
  return new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res({base64:r.result.split(',')[1],mediaType:file.type}); r.onerror=rej; r.readAsDataURL(file); });
}

let _tt=null;
function showToast(msg,isErr=false) {
  const el=document.getElementById('toast'); el.textContent=msg; el.className=isErr?'err':''; el.style.display='block';
  clearTimeout(_tt); _tt=setTimeout(()=>{ el.style.display='none'; },2800);
}
