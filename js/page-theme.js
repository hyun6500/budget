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

  box.innerHTML = chips + spanChips + head + byYear + withCard + subCard + whoCard + topCard;
  decorate(box);
  bindTheme(box);
}

function bindTheme(box) {
  $$("[data-t]", box).forEach(c => c.onclick = () => { TH.id = c.dataset.t; renderTheme(); });
  $$("[data-s]", box).forEach(c => c.onclick = () => { TH.span = c.dataset.s; renderTheme(); });
}
