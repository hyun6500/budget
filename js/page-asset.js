/* ===== js/page-asset.js ===== */
/* page-asset.js - 자산. 두 번째 DB(종합 자산 포트폴리오)를 읽기 전용으로 본다.
   현황 / 투자 / 수입원 셋. 가계부와 갱신 주기가 달라 어디에나 기준일을 붙인다. */
FILEV.asset = CONFIG.APP_VERSION;

const AS = { seg: "now" };

async function loadAssets() {
  if (A.loaded || A.denied) return;
  if (CONFIG.ASSET_NEEDS_AUTH && !authAlive()) return;
  try {
    const j = await post("assets", { token: AUTH.token });
    A.data = j.assets || null; A.reason = j.reason || ""; A.loaded = true;
  } catch (e) { A.denied = true; A.reason = e.message; toast("자산을 읽지 못했습니다: " + e.message); }
}

function renderAsset() {
  const box = $("#p-asset");

  if (CONFIG.ASSET_NEEDS_AUTH && !authAlive()) {
    box.innerHTML = '<div class="card"><div class="locked">자산은 잠겨 있습니다.<br>' +
      "가계부와 달리 이 화면은 비밀번호를 넣어야 열립니다.<br>10분이 지나면 다시 잠깁니다." +
      '<button class="btn" id="asUnlock">잠금 풀기</button></div></div>';
    $("#asUnlock").onclick = async () => { if (await ensureAuth()) { await loadAssets(); renderAsset(); } };
    return;
  }
  if (!A.loaded) {
    box.innerHTML = '<div class="card"><div class="skel" style="width:40%"></div>' +
      '<div class="skel" style="height:38px;margin:12px 0"></div><div class="skel" style="width:70%"></div></div>';
    loadAssets().then(() => renderAsset());
    return;
  }
  if (!A.data) {
    box.innerHTML = A.reason === "not_configured"
      ? '<div class="card"><div class="locked">자산 시트가 아직 이어져 있지 않습니다.<br><br>' +
        "Apps Script 편집기에서<br>[프로젝트 설정] > [스크립트 속성] > [속성 추가]<br>" +
        "속성 <b>PORTFOLIO_ID</b> 에 포트폴리오 시트 ID 를 넣어 주세요.<br>" +
        "시트 주소의 /d/ 와 /edit 사이 문자열입니다.<br><br>" +
        "넣은 뒤 checkPortfolio() 를 한 번 실행하면 제대로 읽히는지 확인할 수 있습니다.</div></div>"
      : '<div class="card"><div class="empty">자산 시트를 읽지 못했습니다.' +
        (A.reason ? "<br>" + esc(A.reason) : "") + "<br>시트 공유 권한을 확인해 주세요.</div></div>";
    return;
  }

  box.innerHTML = segHTML([["now", "현황"], ["inv", "투자"], ["inc", "수입원"]], AS.seg, "as") +
    '<div id="assetBody"></div>';
  $$("[data-as]", box).forEach(b => b.onclick = () => { AS.seg = b.dataset.as; renderAsset(); });

  if (AS.seg === "inv") assetInvest();
  else if (AS.seg === "inc") assetIncome();
  else assetNow();
  decorate(box);
}

/* ---------- 1) 현황 ---------- */
function assetNow() {
  const box = $("#assetBody");
  const gap = assetGap();

  const hero = '<div class="card hero gold"><span class="eyebrow">모은 돈 (원금 기준)</span>' +
    '<div class="big">' + won(assetTotal()) + '<span class="won">원</span></div>' +
    '<div class="sub"><span>지금 값 <b>' + won(assetValued()) + "</b></span>" +
    "<span>평가손익 <b style=\"color:" + (gap >= 0 ? "var(--in)" : "var(--out)") + '">' +
    (gap >= 0 ? "+" : "-") + won(Math.abs(gap)) + "</b></span>" +
    "<span>기준 <b>" + esc(A.data.asOf || "") + "</b></span></div>" +
    '<p class="foot">원금은 넣은 돈, 지금 값은 시세를 반영한 값입니다. 가계부는 원금 쪽과 맞물립니다.</p></div>';

  /* 순자산 곡선 */
  const nw = netWorthSeries();
  const series = [];
  if (nw.est.length) series.push({ color: "var(--ink3)", dash: true, w: 1.6, pts: nw.est.map(p => ({ x: p.ym, y: p.v })) });
  if (nw.real.length) series.push({ color: "var(--gold)", dot: true, w: 2.4, pts: nw.real.map(p => ({ x: p.ym, y: p.v })) });
  const curve = series.length
    ? '<div class="card"><div class="sec"><h2>모아 온 길</h2><span class="hint">점선은 가계부로 되짚은 추정</span></div>' +
      lineChart(series, { h: 165, zero: false, label: x => x.slice(2).replace("-", ".") }) +
      '<div class="legend"><span><i style="background:var(--gold)"></i>실측 스냅샷 ' + nw.real.length + "개</span>" +
      '<span><i style="background:var(--ink3)"></i>가계부 역산 ' + nw.est.length + "달</span></div>" +
      '<p class="foot">가장 오래된 실측값(' + esc(nw.real[0] ? nw.real[0].d : "") + ')에서 달마다 (수입 - 지출)을 빼며 ' +
      BACKFILL_MONTHS + "달만 거꾸로 되짚은 것입니다. 투자 손익과 기록 밖의 돈이 담기지 않아 " +
      "거슬러 올라갈수록 오차가 쌓입니다. 그래서 3년으로 끊었고, 값보다 모양을 보는 그림입니다.</p></div>"
    : "";

  /* 실측과 가계부의 어긋남 */
  let check = "";
  if (nw.real.length >= 2) {
    const a = nw.real[0], b = nw.real[nw.real.length - 1];
    const rs = S.rows.filter(r => r.date >= a.d && r.date <= b.d);
    const flow = sumMine(rs, isIn) - sumMine(rs, isOut);
    const real = b.v - a.v;
    const diff = flow - real;
    check = '<div class="card"><div class="sec"><h2>두 장부가 맞나</h2>' +
      '<span class="hint">' + esc(a.d) + " ~ " + esc(b.d) + "</span></div>" +
      '<div class="rows">' +
      '<div class="row"><div class="nm">가계부 (수입 - 지출)</div><div class="amt">' + won(flow) + "</div></div>" +
      '<div class="row"><div class="nm">자산 시트 원금 증가</div><div class="amt">' + won(real) + "</div></div>" +
      '<div class="row"><div class="nm">어긋난 값</div><div class="amt" style="color:' +
      (Math.abs(diff) / Math.max(1, Math.abs(real)) < .1 ? "var(--in)" : "var(--warn)") + '">' +
      (diff >= 0 ? "+" : "-") + won(Math.abs(diff)) + " (" + (real ? Math.round(Math.abs(diff) / Math.abs(real) * 100) : 0) + "%)</div></div>" +
      "</div>" +
      '<p class="foot">두 파일은 서로를 검산합니다. 차이가 10% 안쪽이면 가계부가 자산 흐름을 거의 다 설명하고 있는 것입니다. ' +
      "차이가 커지면 기록에서 빠진 돈이 있다는 뜻입니다.</p></div>";
  }

  /* 구성 */
  const top = assetTop();
  const tot = assetTotal() || 1;
  const compose = '<div class="card"><div class="sec"><h2>무엇으로 가지고 있나</h2>' +
    '<span class="hint">' + esc(A.data.asOf || "") + " 기준</span></div>" +
    '<div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">' +
    donut(top.map(t => ({ key: t.name, mine: t.amt })), tot) +
    '<div style="flex:1;min-width:190px"><div class="rows">' + top.map(t =>
      '<div class="row"><div class="nm">' + esc(t.name) + "</div>" +
      '<div class="amt">' + won(t.amt) + "</div>" +
      '<div class="bar"><div class="dbar gold"><i class="mine" style="width:' + (t.amt / tot * 100).toFixed(1) + '%"></i></div></div>' +
      '<div class="meta"><span>' + (t.amt / tot * 100).toFixed(1) + "%</span></div></div>").join("") +
    "</div></div></div>" +
    '<div class="tree" style="margin-top:16px">' +
    (A.data.tree || []).filter(t => t.amt && t.name !== "1").map(t => treeRow(t, true)).join("") +
    "</div></div>";

  /* 예적금 만기 */
  const mt = maturities();
  const mtCard = mt.length
    ? '<div class="card"><div class="sec"><h2>예적금 만기</h2><span class="hint">오늘 ' + todayISO() + "</span></div>" +
      '<div style="overflow-x:auto"><table class="tbl"><thead><tr>' +
      "<th>이름</th><th>금액</th><th>금리</th><th>만기</th><th>남은 날</th></tr></thead><tbody>" +
      mt.map(m => {
        const soon = m.days != null && m.days <= 45;
        return '<tr><td class="nm">' + esc(m.name) + '</td><td class="n">' + won(m.amt) +
          '</td><td class="n">' + (m.rate ? (m.rate * 100).toFixed(2) + "%" : "-") + "</td><td>" + esc(m.due || m.note || "-") +
          '</td><td class="n ' + (soon ? (m.days < 0 ? "neg" : "neg") : "") + '">' +
          (m.days == null ? "-" : m.days >= 0 ? m.days + "일" : (-m.days) + "일 지남") + "</td></tr>";
      }).join("") + "</tbody></table></div>" +
      '<div style="height:14px"></div>' + timelineHTML(mt) +
      '<p class="foot">비고 칸의 "26년 8월 만기" 같은 표기를 그대로 읽습니다. 표기를 바꾸면 여기가 비게 되니 형식을 지켜 주세요.</p></div>'
    : "";

  const cb = '<div class="card tight"><div class="sec" style="margin-bottom:6px"><h2>카드 캐시백</h2></div>' +
    '<p class="foot" style="margin:0">캐시백은 별도 앱이 정본입니다. 두 곳에서 관리하면 어긋나므로 여기서는 잇기만 합니다. ' +
    '<a href="' + CONFIG.CARD_APP_URL + '" style="color:var(--navy);font-weight:700">캐시백 앱 열기</a></p></div>';

  box.innerHTML = hero + curve + check + compose + mtCard + cb;
  decorate(box);
}

/* ---------- 2) 투자 ---------- */
function assetInvest() {
  const box = $("#assetBody");
  const t = tradeStat();

  const hero = '<div class="card hero gold"><span class="eyebrow">매매 성적표</span>' +
    '<div class="big">' + (t.closedPnl >= 0 ? "+" : "-") + won(Math.abs(t.closedPnl)) + '<span class="won">원</span></div>' +
    '<div class="sub"><span>종료 <b>' + t.closed.length + "건</b></span>" +
    "<span>이긴 것 <b>" + t.win + " / " + t.closed.length + "</b></span>" +
    "<span>승률 <b>" + Math.round(t.winRate * 100) + "%</b></span>" +
    "<span>진행 <b>" + t.open.length + "건</b></span></div>" +
    '<p class="foot">종료한 거래의 실현 손익입니다. 진행 중인 것의 평가손익은 현황 탭의 지금 값에 들어 있습니다.</p></div>';

  const tbl = (rows, showRet) => '<div style="overflow-x:auto"><table class="tbl"><thead><tr>' +
    "<th>종목</th><th>구분</th><th>투입</th>" + (showRet ? "<th>손익</th><th>수익률</th><th>보유일</th>" : "<th>시작</th>") +
    "</tr></thead><tbody>" + rows.map(x =>
      '<tr><td class="nm">' + esc(x.name) + "</td><td>" + esc(x.tag || x.catv || "") + '</td><td class="n">' + won(x.cost) + "</td>" +
      (showRet
        ? '<td class="n ' + ((x.pnl || 0) >= 0 ? "pos" : "neg") + '">' + ((x.pnl || 0) >= 0 ? "+" : "-") + won(Math.abs(x.pnl || 0)) + "</td>" +
          '<td class="n ' + ((x.ret || 0) >= 0 ? "pos" : "neg") + '">' + ((x.ret || 0) * 100).toFixed(1) + "%</td>" +
          '<td class="n">' + (x.days || "-") + "</td>"
        : "<td>" + esc(x.start || "") + "</td>") +
      "</tr>").join("") + "</tbody></table></div>";

  const closed = t.closed.slice().sort((a, b) => (b.ret || 0) - (a.ret || 0));
  const closedCard = '<div class="card"><div class="sec"><h2>끝낸 거래</h2><span class="hint">수익률 순</span></div>' +
    (closed.length ? tbl(closed, true) : '<div class="empty">없습니다.</div>') + "</div>";

  const open = t.open.slice().sort((a, b) => (b.cost || 0) - (a.cost || 0));
  const openCard = '<div class="card"><div class="sec"><h2>들고 있는 것</h2>' +
    '<span class="hint">투입 ' + won(t.openCost) + "원</span></div>" +
    (open.length ? tbl(open, false) : '<div class="empty">없습니다.</div>') +
    '<p class="foot">현재가는 시트의 실시간 수식이 만든 값이라, 이 앱은 시트를 마지막으로 연 시점의 값을 봅니다. 장중 시세가 아닙니다.</p></div>';

  const vc = (A.data.vc || []).filter(v => v.cost);
  const vcCard = vc.length
    ? '<div class="card"><div class="sec"><h2>비상장</h2></div>' +
      '<div style="overflow-x:auto"><table class="tbl"><thead><tr><th>이름</th><th>투입</th><th>지금 값</th><th>수익률</th></tr></thead><tbody>' +
      vc.map(v => '<tr><td class="nm">' + esc(v.name) + '</td><td class="n">' + won(v.cost) +
        '</td><td class="n">' + won(v.value) + '</td><td class="n ' + ((v.ret || 0) >= 0 ? "pos" : "neg") + '">' +
        ((v.ret || 0) * 100).toFixed(0) + "%</td></tr>").join("") + "</tbody></table></div>" +
      '<p class="foot">비상장은 마지막 라운드 가치라 언제든 달라집니다. 팔기 전까지는 숫자일 뿐입니다.</p></div>'
    : "";

  /* 분류별 */
  const byTag = new Map();
  for (const x of (A.data.trades || [])) {
    const k = x.catv || x.cat || "기타";
    const o = byTag.get(k) || { key: k, mine: 0, amt: 0, n: 0 };
    o.mine += x.cost || 0; o.amt += x.cost || 0; o.n++; byTag.set(k, o);
  }
  const tags = Array.from(byTag.values()).sort((a, b) => b.mine - a.mine);
  const tagCard = tags.length
    ? '<div class="card"><div class="sec"><h2>무엇에 넣었나</h2><span class="hint">투입액 기준</span></div>' +
      '<div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">' + donut(tags.slice(0, 7)) +
      '<div style="flex:1;min-width:190px">' +
      rankList(tags, tags[0].mine, { color: it => colorOf(it.key), noIcon: true }) + "</div></div></div>"
    : "";

  /* 종목별 손익 */
  const pnlBars = closed.filter(x => x.pnl).slice(0, 14)
    .sort((x, y) => (y.pnl || 0) - (x.pnl || 0))
    .map(x => ({ key: x.name, v: x.pnl, ret: x.ret }));
  const pnlCard = pnlBars.length
    ? '<div class="card"><div class="sec"><h2>무엇에서 벌고 잃었나</h2><span class="hint">끝낸 거래</span></div>' +
      divergeBars(pnlBars, { sub: i => ((i.ret || 0) * 100).toFixed(0) + "%" }) + "</div>"
    : "";

  /* 보유일과 수익률 */
  const sc = closed.filter(x => x.days && x.ret != null)
    .map(x => ({ x: x.days, y: x.ret, r: 3 + Math.min(6, Math.sqrt((x.cost || 0) / 3000000)), t: x.name + " " + Math.round(x.ret * 100) + "%" }));
  const scCard = sc.length >= 4
    ? '<div class="card"><div class="sec"><h2>오래 들수록 나았나</h2><span class="hint">가로는 보유일, 점 크기는 투입액</span></div>' +
      scatterHTML(sc, { h: 180, xmin: "0일", xmax: Math.max(...sc.map(p => p.x)) + "일" }) +
      '<p class="foot">오른쪽 위로 갈수록 오래 들고 많이 번 거래입니다. 점선은 본전입니다.</p></div>'
    : "";

  box.innerHTML = hero + pnlCard + closedCard + scCard + openCard + vcCard + tagCard;
  decorate(box);
}

/* ---------- 3) 수입원 ---------- */
function assetIncome() {
  const box = $("#assetBody");
  const sal = salarySteps();

  const cur = sal.length ? sal[sal.length - 1] : null;
  const first = sal.length ? sal[0] : null;
  const grow = cur && first && first.base ? (cur.base - first.base) / first.base : 0;

  const hero = '<div class="card hero gold"><span class="eyebrow">지금 계약 연봉</span>' +
    '<div class="big">' + (cur ? won(cur.base) : "-") + '<span class="won">원</span></div>' +
    '<div class="sub">' + (cur ? "<span>" + esc(cur.company) + " <b>" + esc(cur.date) + "</b></span>" : "") +
    (first ? "<span>첫 연봉 대비 <b>+" + Math.round(grow * 100) + "%</b></span>" : "") +
    "<span>단계 <b>" + sal.length + "</b></span></div></div>";

  const curve = sal.length
    ? '<div class="card"><div class="sec"><h2>연봉 곡선</h2><span class="hint">계약 연봉이 바뀐 시점</span></div>' +
      lineChart([{ color: "var(--gold)", dot: true, w: 2.4, pts: sal.map(s => ({ x: s.date, y: s.base })) }],
        { h: 160, zero: false, label: x => x.slice(2, 7) }) +
      '<div style="overflow-x:auto;margin-top:12px"><table class="tbl"><thead><tr>' +
      "<th>회사</th><th>일시</th><th>계약 연봉</th><th>인상</th><th>사유</th></tr></thead><tbody>" +
      sal.slice().reverse().map(s =>
        '<tr><td class="nm">' + esc(s.company) + "</td><td>" + esc(s.date) + '</td><td class="n">' + won(s.base) +
        '</td><td class="n ' + ((s.raise || 0) > 0 ? "pos" : "") + '">' + (s.raise ? "+" + (s.raise * 100).toFixed(1) + "%" : "-") +
        "</td><td>" + esc(s.reason || "") + "</td></tr>").join("") +
      "</tbody></table></div></div>"
    : "";

  /* 사이드 인컴 */
  const side = sideByYear();
  const sideCard = side.length
    ? '<div class="card"><div class="sec"><h2>본업 밖의 수입</h2><span class="hint">자산 시트의 사이드잡</span></div>' +
      barsHTML(side.slice().reverse().map(s => ({ key: String(s.year).slice(2), mine: s.total, color: "var(--in)" })), {}) +
      '<div class="rows" style="margin-top:12px">' + side.map(s =>
        '<div class="row"><div class="nm">' + s.year + "년</div>" +
        '<div class="amt">' + won(s.total) + "</div>" +
        '<div class="meta">' + s.items.slice(0, 4).map(i =>
          "<span>" + esc(i.src) + " " + wonS(i.total) + "</span>").join("") + "</div></div>").join("") + "</div>" +
      '<p class="foot">이 값은 가계부 수입과 겹칩니다. 더하지 마세요. ' +
      "황금여행사분은 가계부에 급여로, 멘토링분은 부수입으로 이미 들어가 있습니다. " +
      "여기서는 그 수입이 어느 수입원에서 왔는지만 보는 표입니다.</p></div>"
    : "";

  /* 가계부 쪽 수입 */
  const ys = years().filter(y => y <= yOf(todayISO()));
  const incByYear = ys.map(y => {
    const rs = S.rows.filter(r => r.y === y && isIn(r));
    return { y, total: sumMine(rs), byS: byKey(rs, r => r.sub) };
  }).reverse();
  const ledgerCard = '<div class="card"><div class="sec"><h2>가계부에 적힌 수입</h2>' +
    '<span class="hint">이쪽이 실제로 들어온 돈</span></div>' +
    '<div style="overflow-x:auto"><table class="tbl"><thead><tr><th>해</th><th>합계</th><th>급여</th><th>부수입</th><th>그 밖</th></tr></thead><tbody>' +
    incByYear.map(r => {
      const g = k => (r.byS.find(x => x.key === k) || { mine: 0 }).mine;
      return "<tr><td>" + r.y + '</td><td class="n">' + won(r.total) + '</td><td class="n">' + won(g("급여")) +
        '</td><td class="n">' + won(g("부수입")) + '</td><td class="n">' + won(r.total - g("급여") - g("부수입")) + "</td></tr>";
    }).join("") + "</tbody></table></div>" +
    '<p class="foot">계약 연봉은 약속한 금액이고, 이 표는 통장에 들어온 금액입니다. 상여와 환급이 섞여 있어 둘은 다릅니다.</p></div>';

  /* 수입 구성이 해마다 어떻게 바뀌었나 */
  const ys2 = years().filter(y2 => y2 <= yOf(todayISO()));
  const incKeys = ["급여", "부수입", "환급/보상", "중고거래", "금융소득", "받은돈"];
  const incCache = new Map();
  const getInc = (y2, k) => {
    if (!incCache.has(y2)) {
      const o = {};
      for (const r of S.rows) if (r.y === y2 && isIn(r)) o[r.sub] = (o[r.sub] || 0) + r.mine;
      incCache.set(y2, o);
    }
    return incCache.get(y2)[k] || 0;
  };
  const mixCard = ys2.length
    ? '<div class="card"><div class="sec"><h2>수입이 어디서 왔나</h2><span class="hint">해마다 쌓아서</span></div>' +
      stackHTML(ys2, incKeys, getInc, { h: 175 }) + "</div>"
    : "";

  box.innerHTML = hero + curve + mixCard + sideCard + ledgerCard;
  decorate(box);
}
