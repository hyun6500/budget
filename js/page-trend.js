/* page-trend.js - 흐름. 올해와 최근 열두 달을 오간다. */
FILEV.trend = CONFIG.APP_VERSION;

const TR = { mode: "12" };   // "12" 최근 열두 달, 또는 연도 문자열

function renderTrend() {
  const box = $("#p-trend");
  const years = Array.from(new Set(S.rows.map(r => r.y))).filter(Boolean).sort().reverse();
  if (TR.mode !== "12" && !years.includes(TR.mode)) TR.mode = "12";

  const months = TR.mode === "12"
    ? Array.from({ length: 12 }, (_, i) => shiftYM(S.ym, -(11 - i)))
    : Array.from({ length: 12 }, (_, i) => TR.mode + "-" + pad2(i + 1));

  const stats = months.map(m => { const s = monthStat(m); return { ym: m, out: s.out, inc: s.inc, mov: s.mov, n: s.n, hi: m === S.ym }; });
  const used = stats.filter(s => s.n);
  const totOut = used.reduce((a, s) => a + s.out, 0);
  const totIn = used.reduce((a, s) => a + s.inc, 0);
  const avgOut = used.length ? totOut / used.length : 0;

  const chips = '<div class="chips">' +
    '<button class="chip' + (TR.mode === "12" ? " on" : "") + '" data-m="12">최근 열두 달</button>' +
    years.slice(0, 10).map(y => '<button class="chip' + (TR.mode === y ? " on" : "") + '" data-m="' + y + '">' + y + "년</button>").join("") +
    "</div>";

  const head =
    '<div class="card hero"><span class="eyebrow">' + (TR.mode === "12" ? "최근 열두 달" : TR.mode + "년") + " 지출</span>" +
    '<div class="big">' + won(totOut) + '<span class="won">원</span></div>' +
    '<div class="sub"><span>수입 <b>' + won(totIn) + "</b></span>" +
    "<span>달 평균 <b>" + won(avgOut) + "</b></span>" +
    "<span>기록된 달 <b>" + used.length + "</b></span>" +
    "<span>저축률 <b>" + (totIn ? Math.round((totIn - totOut) / totIn * 100) : 0) + "%</b></span></div></div>";

  const chart =
    '<div class="card"><div class="sec"><h2>달마다</h2><span class="hint">막대는 지출, 선은 수입</span></div>' +
    sparkMonths(stats, { line: true }) +
    '<div class="legend"><span><i style="background:var(--out)"></i>지출</span>' +
    '<span><i style="background:var(--navy)"></i>보고 있는 달</span>' +
    '<span><i style="background:var(--in)"></i>수입</span></div></div>';

  /* 달 표 */
  const rowsHtml = stats.map((s, i) => {
    const p = i ? stats[i - 1] : null;
    const d = p && p.out ? pct(s.out, p.out) : null;
    return '<div class="row"><div class="nm"><span class="num" style="font-size:12px;color:var(--ink3)">' + ymLabel(s.ym) + "</span> " +
      (s.n ? s.n + "건" : '<span style="color:var(--ink3)">기록 없음</span>') + "</div>" +
      '<div class="amt">' + (s.n ? won(s.out) + " " + deltaBadge(d, false) : "") + "</div>" +
      '<div class="bar">' + dbar(s.out, s.out, Math.max(1, ...stats.map(x => x.out))) + "</div></div>";
  }).join("");
  const table = '<div class="card"><div class="sec"><h2>달별 표</h2><span class="hint">전월 대비</span></div><div class="rows">' + rowsHtml + "</div></div>";

  /* 대분류 흐름 */
  const rs = S.rows.filter(r => months.includes(r.ym) && isOut(r));
  const bigs = byKey(rs, r => r.big || "기타").slice(0, 8);
  const bigCard = '<div class="card"><div class="sec"><h2>대분류 흐름</h2><span class="hint">이 구간 합계와 달 평균</span></div>' +
    rankList(bigs, bigs[0] && bigs[0].mine, {
      color: it => colorOf(it.key),
      extra: it => "달 평균 " + won(Math.round(it.mine / Math.max(1, used.length))),
    }) + "</div>";

  /* 소분류 상위 */
  const subs = byKey(rs, r => r.sub).slice(0, 12);
  const subCard = '<div class="card"><div class="sec"><h2>소분류 순위</h2><span class="hint">건당 평균</span></div>' +
    rankList(subs, subs[0] && subs[0].mine, { extra: it => "건당 " + won(Math.round(it.mine / it.n)) }) + "</div>";

  /* 자주 간 곳 */
  const places = byKey(rs, r => (r.place || "").trim()).slice(0, 10);
  const placeCard = '<div class="card"><div class="sec"><h2>자주 간 곳</h2><span class="hint">이 구간</span></div>' +
    rankList(places, places[0] && places[0].mine, { extra: it => "건당 " + won(Math.round(it.mine / it.n)) }) + "</div>";

  box.innerHTML = chips + head + chart + table + bigCard + subCard + placeCard;
  $$(".chip", box).forEach(c => c.onclick = () => { TR.mode = c.dataset.m; renderTrend(); });
}
