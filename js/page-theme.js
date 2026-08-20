/* ===== js/page-theme.js ===== */
/* page-theme.js - 카테고리를 가로지르는 주제. 여행, 부모님, 용돈, 연인, 소개팅, 동생, 일시성. */
FILEV.theme = CONFIG.APP_VERSION;

const TH = { id: "여행", span: "all" };

function renderTheme() {
  const box = $("#hallBody");
  const chips = '<div class="chips">' + THEMES.map(t =>
    '<button class="chip' + (TH.id === t.id ? " on" : "") + '" data-t="' + t.id + '">' + t.name + "</button>").join("") + "</div>";

  const t = THEMES.find(x => x.id === TH.id);
  let rs = themeRows(TH.id);
  const spanChips = '<div class="chips">' +
    [["all", "전체 기간"], ["y", "올해"], ["12", "최근 열두 달"]].map(([k, n]) =>
      '<button class="chip' + (TH.span === k ? " on" : "") + '" data-s="' + k + '">' + n + "</button>").join("") + "</div>";
  if (TH.span === "y") rs = rs.filter(r => r.y === yOf(S.ym + "-01"));
  if (TH.span === "12") { const ms = Array.from({ length: 12 }, (_, i) => shiftYM(S.ym, -(11 - i))); rs = rs.filter(r => ms.includes(r.ym)); }

  const mine = rs.reduce((a, r) => a + r.mine, 0);
  const full = rs.reduce((a, r) => a + r.amt, 0);
  const yrs = byKey(rs, r => r.y).sort((a, b) => a.key < b.key ? -1 : 1);
  const subs = byKey(rs, r => r.sub).slice(0, 10);
  const who = byKey(rs, r => r.treat).slice(0, 8);
  const withWho = byKey(rs, r => (r.with || "").trim()).slice(0, 12);
  const top = rs.slice().sort((a, b) => b.mine - a.mine).slice(0, 10);

  const head =
    '<div class="card hero"><span class="eyebrow">' + esc(t.name) + "</span>" +
    '<div class="big">' + won(mine) + '<span class="won">원</span></div>' +
    '<div class="sub"><span>전액 <b>' + won(full) + "</b></span><span>" + rs.length + "건</span>" +
    (rs.length ? "<span>" + rs[0].date.slice(0, 7) + " 부터 " + rs[rs.length - 1].date.slice(0, 7) + "</span>" : "") +
    "</div>" +
    '<p style="font-size:11.5px;color:var(--ink3);margin:10px 0 0">' + esc(t.desc) + "</p></div>";

  if (!rs.length) { box.innerHTML = chips + spanChips + head + '<div class="card"><div class="empty">이 주제로 잡힌 기록이 없습니다.<br>입력할 때 테마 칸을 적어 두면 여기에 모입니다.</div></div>'; bindTheme(box); return; }

  const byYear = '<div class="card"><div class="sec"><h2>해마다</h2></div>' +
    sparkMonths(yrs.map(y => ({ ym: y.key + "-01", label: y.key.slice(2), out: y.mine })), {}) +
    '<div class="rows" style="margin-top:12px">' + yrs.slice().reverse().map(y =>
      '<div class="row"><div class="nm">' + y.key + "년</div><div class=\"amt\">" + won(y.mine) + "</div>" +
      '<div class="meta"><span>' + y.n + "건</span></div></div>").join("") + "</div></div>";

  const subCard = '<div class="card"><div class="sec"><h2>무엇에</h2></div>' +
    rankList(subs, subs[0].mine, { extra: it => "건당 " + won(Math.round(it.mine / it.n)) }) + "</div>";

  const whoCard = who.length ? '<div class="card"><div class="sec"><h2>누구에게</h2></div>' + rankList(who, who[0].mine, {}) + "</div>" : "";
  const withCard = withWho.length ? '<div class="card"><div class="sec"><h2>누구와</h2>' +
    '<span class="hint">동행 칸에 적힌 사람</span></div>' +
    rankList(withWho, withWho[0].mine, {}) + "</div>" : "";

  const topCard = '<div class="card"><div class="sec"><h2>큰 기록</h2></div><div class="rows">' + top.map(r =>
    '<div class="row"><div class="nm">' + esc(r.place || r.sub) + "</div>" +
    '<div class="amt">' + won(r.mine) + "</div>" +
    '<div class="meta"><span>' + r.date + "</span><span>" + esc(r.sub) + "</span>" +
    (r.detail ? "<span>" + esc(r.detail) + "</span>" : "") + "</div></div>").join("") + "</div></div>";

  const romance = (TH.id === "소개팅" || TH.id === "연인") ? romanceHTML(TH.id) : "";
  /* 여행은 사람이 아니라 사건 단위로 뜯어본다. 소개팅을 이름으로 뜯어보는 것과 같은 자리 */
  const events = TH.id === "여행" ? eventsHTML() : "";
  const giving = (TH.id === "용돈" || TH.id === "부모님") ? givingHTML(TH.id) : "";
  box.innerHTML = chips + spanChips + head + events + romance + giving + byYear + withCard + subCard + whoCard + topCard;
  decorate(box);
  bindTheme(box);
  const g = $("#evGroup", box);
  if (g) g.onclick = () => openGrouper();
  $$("[data-ev]", box).forEach(b => b.onclick = () => openEventDetail(b.dataset.ev));
}

/* ---------- 용돈과 대접을 사람으로 뜯어보기 ----------
   여행이 사건 단위라면 이쪽은 사람 단위다. 누구에게 얼마나, 얼마 만에 한 번씩. */
function givingHTML(which) {
  const rs = themeRows(which);
  if (!rs.length) return "";
  const who = byKey(rs, r => r.treat).filter(x => x.key);
  if (!who.length) return "";
  const gap = key => {
    const ds = rs.filter(r => r.treat === key).map(r => r.date).sort();
    if (ds.length < 2) return "";
    const days = (new Date(ds[ds.length - 1]) - new Date(ds[0])) / 86400000 / (ds.length - 1);
    return Math.round(days) + "일에 한 번";
  };
  const kindOf = key => {
    const sub = byKey(rs.filter(r => r.treat === key), r => r.sub);
    return sub.slice(0, 2).map(x => x.key).join(", ");
  };
  const noTreat = rs.filter(r => !r.treat).length;
  return '<div class="card"><div class="sec"><h2>누구에게</h2>' +
    '<span class="hint">사람마다 얼마나, 얼마 만에</span></div>' +
    rankList(who, who[0].mine, {
      noIcon: true, color: () => "var(--gold)",
      extra: it => "건당 " + won(Math.round(it.mine / it.n)) + (gap(it.key) ? " / " + gap(it.key) : "") +
        (kindOf(it.key) ? " / " + kindOf(it.key) : ""),
    }) +
    (noTreat
      ? '<div class="rhint bad" style="margin-top:10px"><b>대접이 빈 줄 ' + noTreat + "건</b><span>" +
        "누구에게 준 것인지 적혀 있지 않아 이 표에서 빠집니다.</span></div>"
      : "") + "</div>";
}

function bindTheme(box) {
  $$("[data-t]", box).forEach(c => c.onclick = () => { TH.id = c.dataset.t; renderTheme(); });
  $$("[data-s]", box).forEach(c => c.onclick = () => { TH.span = c.dataset.s; renderTheme(); });
}



/* ---------- 소개팅과 연애 인포그래픽 ----------
   가계부에는 없고 이력 시트에만 있는 것(소개 루트, 주선자, 연애로 이어졌나)을 끌어온다.
   두 장부를 이름으로 이어 붙여야 비로소 보이는 것들이다. */
function romanceHTML(which) {
  const P = S.people || { intro: [], love: [] };
  const isIntro = which === "소개팅";
  const raw = isIntro ? (P.intro || []) : (P.love || []);
  /* 이력 시트에는 앱 과금도 한 줄씩 들어 있다. 사람 수에 섞이면 안 되니 갈라 둔다 */
  const apps = raw.filter(x => x.kind === "앱 과금");
  const list = raw.filter(x => x.kind !== "앱 과금");
  if (!list.length && !apps.length) return "";

  const spentOf = nm => {
    const rs = S.rows.filter(r => isOut(r) && (r.with || "").split(/[,;\/]/).map(x => x.trim()).indexOf(nm) >= 0);
    return { mine: rs.reduce((a, r) => a + r.mine, 0), n: rs.length };
  };

  /* 1) 한눈에 */
  const met = list.filter(x => x.n > 0 || x.first);
  const toLove = list.filter(x => (x.next || "").indexOf("연애") >= 0);
  const each = list.map(x => {
    const nm = x.with || x.name;
    return x.mine ? { mine: x.mine, cnt: x.cnt } : spentOf(nm);
  });
  const totalMine = each.reduce((a, x) => a + (x.mine || 0), 0);
  const totalCnt = each.reduce((a, x) => a + (x.n || x.cnt || 0), 0);
  const paidN = each.filter(x => x.mine > 0).length;
  const hero =
    '<div class="card"><div class="sec"><h2>' + (isIntro ? "소개팅 이력" : "연애 이력") + "</h2>" +
    '<span class="hint">이력 시트에서 끌어옴</span></div>' +
    '<div class="rows">' +
    '<div class="row"><div class="nm">' + (isIntro ? "만난 사람" : "만난 사람") + "</div>" +
    '<div class="amt">' + list.length + "명</div></div>" +
    (isIntro ? '<div class="row"><div class="nm">연애로 이어짐</div><div class="amt">' + toLove.length +
      "명 (" + Math.round(toLove.length / list.length * 100) + "%)</div></div>" : "") +
    '<div class="row"><div class="nm">쓴 돈</div><div class="amt">' + won(totalMine) + "</div></div>" +
    '<div class="row"><div class="nm">한 사람당</div><div class="amt">' +
    won(Math.round(totalMine / Math.max(1, paidN))) + "</div></div>" +
    '<div class="row"><div class="nm">돈을 쓴 사람</div><div class="amt">' + paidN + "명</div></div>" +
    (totalCnt ? '<div class="row"><div class="nm">건당</div><div class="amt">' +
      won(Math.round(totalMine / totalCnt)) + "</div></div>" : "") +
    "</div></div>";

  /* 1.5) 앱에 쓴 돈. 사람에게 쓴 돈과 나란히 놓아야 뜻이 있다 */
  const appTot = apps.reduce((a, x) => a + (x.mine || x.spent || 0), 0);
  const appCnt = apps.reduce((a, x) => a + (x.cnt || 0), 0);
  const viaApp = list.filter(x => x.route === "앱").length;
  const appCard = apps.length
    ? '<div class="card"><div class="sec"><h2>앱에 쓴 돈</h2>' +
      '<span class="hint">사람에게 쓴 돈과 별개</span></div>' +
      '<div class="rows">' + apps.slice().sort((a, b) => (b.mine || 0) - (a.mine || 0)).map(x =>
        '<div class="row"><div class="nm">' + esc(x.name) + "</div>" +
        '<div class="amt">' + won(x.mine || x.spent || 0) + "</div>" +
        '<div class="bar"><div class="dbar"><i class="mine" style="width:' +
        ((x.mine || 0) / Math.max(1, appTot) * 100).toFixed(1) + '%;background:var(--sky)"></i></div></div>' +
        '<div class="meta"><span>' + (x.cnt || 0) + "번 결제</span>" +
        (x.cnt ? "<span>한 번에 " + won(Math.round((x.mine || 0) / x.cnt)) + "</span>" : "") +
        (x.first ? "<span>" + esc(x.first) + " 부터</span>" : "") + "</div></div>").join("") +
      "</div>" +
      '<div class="rows" style="margin-top:12px;border-top:1px solid var(--line2);padding-top:12px">' +
      '<div class="row"><div class="nm">앱에 쓴 돈</div><div class="amt">' + won(appTot) + "</div></div>" +
      '<div class="row"><div class="nm">사람에게 쓴 돈</div><div class="amt">' + won(totalMine) + "</div></div>" +
      (viaApp ? '<div class="row"><div class="nm">앱으로 만난 사람</div><div class="amt">' + viaApp + "명</div></div>" +
        '<div class="row"><div class="nm">한 사람 만나는 데 든 앱 값</div><div class="amt">' +
        won(Math.round(appTot / viaApp)) + "</div></div>" : "") +
      "</div>" +
      '<p class="foot">앱 과금은 [소개팅 이력] 시트에 앱 이름으로 한 줄씩 들어 있고 구분이 앱 과금 입니다. ' +
      "위의 사람 수와 사람에게 쓴 돈에는 섞이지 않습니다.</p></div>"
    : "";

  /* 2) 어떻게 만났나 */
  const byRoute = new Map();
  list.forEach(x => {
    const k = x.route || "미기재";
    const o = byRoute.get(k) || { key: k, mine: 0, amt: 0, n: 0, love: 0 };
    o.n++; o.mine += x.mine || 0; o.amt += x.mine || 0;
    if ((x.next || "").indexOf("연애") >= 0) o.love++;
    byRoute.set(k, o);
  });
  const routes = Array.from(byRoute.values()).sort((a, b) => b.n - a.n);
  const routeCard =
    '<div class="card"><div class="sec"><h2>어떻게 만났나</h2><span class="hint">사람 수 기준</span></div>' +
    '<div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">' +
    donut(routes.map(r => ({ key: r.key, mine: r.n }))) +
    '<div style="flex:1;min-width:190px"><div class="rows">' + routes.map(r =>
      '<div class="row"><div class="nm">' + esc(r.key) + "</div>" +
      '<div class="amt">' + r.n + "명</div>" +
      '<div class="bar"><div class="dbar"><i class="mine" style="width:' +
      (r.n / routes[0].n * 100).toFixed(1) + "%;background:" + colorOf(r.key) + '"></i></div></div>' +
      '<div class="meta"><span>' + Math.round(r.n / list.length * 100) + "%</span>" +
      (isIntro ? "<span>연애로 " + r.love + "명 (" + Math.round(r.love / Math.max(1, r.n) * 100) + "%)</span>" : "") +
      (r.mine ? "<span>쓴 돈 " + wonS(r.mine) + "</span>" : "") + "</div></div>").join("") +
    "</div></div></div></div>";

  /* 3) 누가 이어 줬나 */
  const byMaker = new Map();
  list.forEach(x => {
    const k = (x.maker || "").trim();
    if (!k) return;
    const o = byMaker.get(k) || { key: k, mine: 0, amt: 0, n: 0, love: 0 };
    o.n++; o.mine += x.mine || 0; o.amt += x.mine || 0;
    if ((x.next || "").indexOf("연애") >= 0) o.love++;
    byMaker.set(k, o);
  });
  const makers = Array.from(byMaker.values()).sort((a, b) => b.n - a.n).slice(0, 12);
  const makerCard = makers.length
    ? '<div class="card"><div class="sec"><h2>누가 이어 줬나</h2><span class="hint">주선자와 앱</span></div>' +
      rankList(makers.map(m => ({ key: m.key, mine: m.n, amt: m.n, n: m.n, love: m.love, spent: m.mine })),
        makers[0].n, {
        val: it => it.n + "명", unit: "명", noIcon: true, color: () => "var(--sky)",
        extra: it => (it.love ? "연애 " + it.love + "명" : "") + (it.spent ? " 쓴 돈 " + wonS(it.spent) : ""),
      }) + "</div>"
    : "";

  /* 4) 해마다 */
  const byYear = new Map();
  list.forEach(x => {
    const y = (x.first || x.start || "").slice(0, 4);
    if (!y) return;
    const o = byYear.get(y) || { key: y, n: 0, love: 0 };
    o.n++; if ((x.next || "").indexOf("연애") >= 0) o.love++;
    byYear.set(y, o);
  });
  const yrs = Array.from(byYear.values()).sort((a, b) => a.key < b.key ? -1 : 1);
  const yearCard = yrs.length
    ? '<div class="card"><div class="sec"><h2>해마다 몇 명</h2><span class="hint">첫 만남 기준</span></div>' +
      barsHTML(yrs.map(y => ({ key: y.key.slice(2), mine: y.n, color: "var(--coral)" })), { h: 120 }) +
      '<div class="legend"><span>모두 ' + list.length + "명</span>" +
      (isIntro ? "<span>연애로 이어진 해 " + yrs.filter(y => y.love).length + "개</span>" : "") + "</div></div>"
    : "";

  /* 5) 몇 번 만났나 */
  const buckets = [["1번", x => x.n <= 1], ["2번", x => x.n === 2], ["3번", x => x.n === 3],
                   ["4-5번", x => x.n >= 4 && x.n <= 5], ["6번 이상", x => x.n >= 6]];
  const withN = list.filter(x => x.n > 0);
  const meetCard = withN.length
    ? '<div class="card"><div class="sec"><h2>몇 번 만났나</h2><span class="hint">' + withN.length + "명</span></div>" +
      barsHTML(buckets.map(([k, f]) => ({ key: k, mine: withN.filter(f).length, color: "var(--gold)" })), { h: 115 }) +
      '<p class="foot">한 번 보고 끝난 사람이 ' + withN.filter(x => x.n <= 1).length + "명, 세 번 넘게 본 사람이 " +
      withN.filter(x => x.n > 3).length + "명입니다.</p></div>"
    : "";

  /* 6) 사람별 */
  const rows = list.map(x => {
    const nm = x.with || x.name;
    const s = x.mine ? { mine: x.mine, n: x.cnt } : spentOf(nm);
    return { name: nm, route: x.route, maker: x.maker, first: x.first || x.start,
             met: x.n, mine: s.mine, cnt: s.n, next: x.next, days: x.days };
  }).filter(x => x.mine > 0).sort((a, b) => b.mine - a.mine).slice(0, 15);
  const tblCard = rows.length
    ? '<div class="card"><div class="sec"><h2>사람별</h2><span class="hint">쓴 돈 순 열다섯</span></div>' +
      '<div style="overflow-x:auto"><table class="tbl"><thead><tr>' +
      "<th>이름</th><th>루트</th><th>주선자</th><th>첫 만남</th>" +
      (isIntro ? "<th>만남</th>" : "<th>교제일</th>") + "<th>쓴 돈</th><th>건당</th></tr></thead><tbody>" +
      rows.map(x =>
        '<tr><td class="nm">' + esc(x.name) + ((x.next || "").indexOf("연애") >= 0 ? " (연애)" : "") + "</td>" +
        "<td>" + esc(x.route || "") + "</td><td>" + esc(x.maker || "") + "</td>" +
        "<td>" + esc(x.first || "") + '</td><td class="n">' + (isIntro ? (x.met || "") : (x.days || "")) + "</td>" +
        '<td class="n">' + won(x.mine) + '</td><td class="n">' + won(Math.round(x.mine / Math.max(1, x.cnt))) + "</td></tr>").join("") +
      "</tbody></table></div>" +
      '<p class="foot">이름이 [입력] 시트의 동행 칸과 똑같아야 이 표에 금액이 잡힙니다. 비어 있으면 이름을 맞춰 주세요.</p></div>'
    : "";

  return hero + appCard + routeCard + makerCard + yearCard + meetCard + tblCard;
}
