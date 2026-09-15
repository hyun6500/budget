/* ===== js/page-hall.js ===== */
/* page-hall.js - 기록실. 테마와 명예의 전당. */
FILEV.hall = CONFIG.APP_VERSION;

const HL = { seg: "theme" };

function renderHall() {
  const box = $("#p-hall");
  box.innerHTML = segHTML([["theme", "테마"], ["fame", "명예의 전당"]], HL.seg, "hl") +
    '<div id="hallBody"></div>';
  $$("[data-hl]", box).forEach(b => b.onclick = () => { HL.seg = b.dataset.hl; renderHall(); });
  if (HL.seg === "fame") renderFame();
  else renderTheme();
  decorate(box);
}

function renderFame() {
  const box = $("#hallBody");
  const all = S.rows.filter(r => r.date <= todayISO());
  const outs = all.filter(isOut);
  const first = all.length ? all[0].date : todayISO();
  const days = Math.max(1, Math.round((new Date(todayISO()) - new Date(first)) / 86400000) + 1);
  const places = byKey(outs, r => (r.place || "").trim());
  const totIn = sumMine(all, isIn), totOut = sumMine(all, isOut);

  const hero = '<div class="card hero"><span class="eyebrow">' + first.replace(/-/g, ".") + " 부터</span>" +
    '<div class="big">' + won(days) + '<span class="won">일째</span></div>' +
    '<div class="sub"><span>기록 <b>' + won(all.length) + "건</b></span>" +
    "<span>다녀간 곳 <b>" + won(places.length) + "곳</b></span>" +
    "<span>누적 수입 <b>" + wonS(totIn) + "</b></span>" +
    "<span>누적 지출 <b>" + wonS(totOut) + "</b></span>" +
    "<span>남은 몫 <b>" + wonS(totIn - totOut) + "</b></span></div></div>";

  /* 기록 */
  const dm = dayMap();
  const maxDay = Array.from(dm.entries()).sort((a, b) => b[1] - a[1])[0];
  const ms = Array.from(new Set(all.map(r => r.ym))).filter(m => m && m < ymOf(todayISO())).sort();
  let bestSave = null, worstOut = null;
  for (const m of ms) {
    const st = monthStat(m);
    if (st.inc >= 1000000) { const r = (st.inc - st.out) / st.inc; if (!bestSave || r > bestSave.r) bestSave = { ym: m, r, st }; }
    if (!worstOut || st.out > worstOut.out) worstOut = { ym: m, out: st.out };
  }
  const recCard = '<div class="card"><div class="sec"><h2>기록</h2><span class="hint">끝난 달만</span></div><div class="rows">' +
    [
      maxDay ? ["가장 많이 쓴 하루", maxDay[0] + " " + wdOf(maxDay[0]) + "요일", won(maxDay[1])] : null,
      worstOut ? ["가장 많이 쓴 달", worstOut.ym, won(worstOut.out)] : null,
      bestSave ? ["저축률이 가장 높던 달", bestSave.ym + " 수입 " + wonS(bestSave.st.inc), Math.round(bestSave.r * 100) + "%"] : null,
    ].filter(Boolean).map(([k, m, v]) =>
      '<div class="row"><div class="nm">' + esc(k) + '</div><div class="amt">' + esc(v) + "</div>" +
      '<div class="meta"><span>' + esc(m) + "</span></div></div>").join("") + "</div></div>";

  /* 큰 지출 열 개 */
  const top = outs.slice().sort((a, b) => b.mine - a.mine).slice(0, 10);
  const topCard = '<div class="card"><div class="sec"><h2>가장 큰 지출 열 개</h2><span class="hint">내 몫 기준</span></div>' +
    '<div class="rows">' + top.map((r, i) =>
      '<div class="row"><div class="nm"><span class="num" style="color:var(--ink3);font-size:11px;margin-right:6px">' +
      pad2(i + 1) + "</span>" + esc(r.place || r.sub) + "</div>" +
      '<div class="amt">' + won(r.mine) + "</div>" +
      '<div class="meta"><span>' + r.date + "</span><span>" + esc(r.sub) + "</span>" +
      (r.detail ? "<span>" + esc(r.detail) + "</span>" : "") + "</div></div>").join("") + "</div></div>";

  /* 단골 */
  const reg = places.filter(p => p.key && !/지하철|버스|생활비|여행계|후불/.test(p.key))
    .sort((a, b) => b.n - a.n).slice(0, 12);
  const regCard = '<div class="card"><div class="sec"><h2>단골</h2><span class="hint">간 횟수 순</span></div>' +
    rankList(reg.map(p => ({ key: p.key, mine: p.mine, amt: p.amt, n: p.n })), reg[0] && reg[0].mine,
      { extra: it => "건당 " + won(Math.round(it.mine / it.n)) }) + "</div>";

  /* 효도 */
  const par = outs.filter(r => r.treat === "부모님");
  const parY = byKey(par, r => r.y).sort((a, b) => a.key < b.key ? -1 : 1);
  const parCard = par.length
    ? '<div class="card"><div class="sec"><h2>부모님께</h2><span class="hint">대접 칸이 부모님인 기록</span></div>' +
      '<div class="hero" style="margin-bottom:12px"><div class="big" style="font-size:30px">' + won(sumMine(par)) +
      '<span class="won">원</span></div><div class="sub"><span>' + par.length + "건</span>" +
      "<span>용돈 <b>" + wonS(sumMine(par, r => r.sub === "용돈")) + "</b></span>" +
      "<span>선물 <b>" + wonS(sumMine(par, r => r.sub === "선물")) + "</b></span>" +
      "<span>함께 먹은 것 <b>" + wonS(sumMine(par, r => r.sub !== "용돈" && r.sub !== "선물")) + "</b></span></div></div>" +
      barsHTML(parY.map(y => ({ key: y.key.slice(2), mine: y.mine, color: "var(--gold)" })), { h: 120 }) +
      '<p class="foot">현금 용돈과 물건 선물과 함께한 밥이 한 표에서 합쳐집니다. 업종은 그대로 두고 대접 칸으로 모으기 때문입니다.</p></div>'
    : "";

  /* 숨은 절약 */
  /* 할인 칸에 적힌 것이 정본이다. 그 칸이 비어 있던 시절 것만 메모에서 줍는다 */
  const hard = all.filter(r => r.disc > 0);
  const soft = all.filter(r => !r.disc && SAVE_RE.test((r.memo || "") + " " + (r.detail || "")));
  const sv = hard.concat(soft);
  let svSum = hard.reduce((a, r) => a + r.disc, 0);
  for (const r of soft) {
    const m = ((r.memo || "") + " " + (r.detail || "")).match(/([\d,]{3,})\s*원?/);
    if (m) { const v = +m[1].replace(/,/g, ""); if (v >= 100 && v <= 500000) svSum += v; }
  }
  const svY = byKey(sv, r => r.y).sort((a, b) => a.key < b.key ? -1 : 1);
  const svCard = sv.length
    ? '<div class="card"><div class="sec"><h2>숨은 절약</h2><span class="hint">메모와 세부내역에서 찾은 것</span></div>' +
      '<div class="rows"><div class="row"><div class="nm">할인 캐시백을 챙긴 기록</div>' +
      '<div class="amt">' + won(sv.length) + "건</div></div>" +
      '<div class="row"><div class="nm">할인 칸에 적힌 것</div><div class="amt">' + won(hard.length) + "건 " +
      wonS(hard.reduce((a, r) => a + r.disc, 0)) + "</div></div>" +
      '<div class="row"><div class="nm">모두 더하면</div><div class="amt">' + won(svSum) + "</div></div></div>" +
      '<div style="height:10px"></div>' +
      barsHTML(svY.map(y => ({ key: y.key.slice(2), mine: y.n, color: "var(--in)" })), { h: 100 }) +
      '<p class="foot">할인 칸에 적은 것은 정확하고, 메모에서 주운 것은 어림값입니다. 앞으로는 할인 칸에 적으면 이 숫자가 정확해집니다. 막대는 건수입니다.</p></div>'
    : "";

  box.innerHTML = hero + recCard + topCard + regCard + parCard + svCard;
  decorate(box);
}
