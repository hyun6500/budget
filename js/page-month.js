/* page-month.js - 이번 달 한 장. 알림, 히어로, 견줌, 대분류, 달력, 큰 지출. */
FILEV.month = CONFIG.APP_VERSION;

function renderMonth() {
  const ym = S.ym, rs = monthRows(ym);
  const now = monthStat(ym), prev = monthStat(shiftYM(ym, -1)), last = monthStat(shiftYM(ym, -12));
  const avg = avgOutOfYear(yOf(ym + "-01"));
  const box = $("#p-month");

  /* 알림 */
  let alerts = "";
  const rec = recurring(ym);
  if (rec.length) {
    alerts += rec.slice(0, 4).map(function (r) {
      return '<div class="alert"><div class="k">빠진 듯</div><div class="b">' +
        "이번 달에 <b>" + esc(r.place || r.sub) + "</b> 기록이 아직 없습니다. " +
        "지난 석 달은 매달 " + r.day + "일 무렵 평균 " + won(r.avg) + "원이었습니다." +
        '<br><button class="mk-rec" data-sub="' + esc(r.sub) + '" data-place="' + esc(r.place) +
        '" data-amt="' + r.avg + '" data-day="' + r.day + '">이 내용으로 적기</button>' +
        "</div></div>";
    }).join("");
  }
  const need = rs.filter(r => r.검수).length;
  if (need) alerts += '<div class="alert"><div class="k">검수</div><div class="b">이 달에 손볼 줄이 <b>' + need + "건</b> 있습니다. 장부 탭에서 붉게 표시됩니다.</div></div>";

  /* 히어로 */
  const hero =
    '<div class="card hero">' +
    '<span class="eyebrow">' + ym.slice(0, 4) + "년 " + (+ym.slice(5, 7)) + "월 지출</span>" +
    '<div class="big">' + won(now.out) + '<span class="won">원</span></div>' +
    '<div class="sub">' +
    "<span>전액 <b>" + won(now.outFull) + "</b></span>" +
    "<span>수입 <b>" + won(now.inc) + "</b></span>" +
    "<span>이체 저축 <b>" + won(now.mov) + "</b></span>" +
    "<span>남은 돈 <b>" + won(now.left) + "</b></span>" +
    "<span>" + now.n + "건</span></div></div>";

  /* 견줌 */
  const cmp = [
    { k: "지난달", v: prev.out, d: pct(now.out, prev.out) },
    { k: "작년 같은 달", v: last.out, d: pct(now.out, last.out) },
    { k: "올해 월평균", v: avg, d: pct(now.out, avg) },
  ];
  const mx = Math.max(now.out, ...cmp.map(c => c.v), 1);
  const cmpCard =
    '<div class="card"><div class="sec"><h2>무엇과 견주면</h2><span class="hint">채운 부분이 이번 달</span></div>' +
    '<div class="rows">' +
    '<div class="row"><div class="nm">이번 달</div><div class="amt">' + won(now.out) + "</div>" +
    '<div class="bar"><div class="dbar"><i class="mine" style="width:' + (now.out / mx * 100).toFixed(1) + '%;background:var(--navy)"></i></div></div></div>' +
    cmp.map(c =>
      '<div class="row"><div class="nm">' + c.k + "</div>" +
      '<div class="amt">' + won(c.v) + " " + deltaBadge(c.d, false) + "</div>" +
      '<div class="bar"><div class="dbar"><i class="mine" style="width:' + (c.v / mx * 100).toFixed(1) + '%;background:#C3CBD9"></i></div></div></div>'
    ).join("") + "</div></div>";

  /* 대분류 */
  const outs = rs.filter(isOut);
  const bigs = byKey(outs, r => r.big || "기타");
  const prevBig = {}; byKey(monthRows(shiftYM(ym, -1)).filter(isOut), r => r.big || "기타").forEach(b => prevBig[b.key] = b.mine);
  const bigCard =
    '<div class="card"><div class="sec"><h2>어디에 썼나</h2><span class="hint">지난달 대비</span></div>' +
    '<div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">' + donut(bigs.slice(0, 8)) +
    '<div style="flex:1;min-width:190px">' + rankList(bigs.slice(0, 8), bigs[0] && bigs[0].mine, {
      color: it => colorOf(it.key),
      extra: it => { const d = pct(it.mine, prevBig[it.key]); return d == null ? "새로" : (d > 0 ? "+" : "") + Math.round(d * 100) + "%"; },
    }) + "</div></div></div>";

  /* 달력 */
  const calCard = '<div class="card"><div class="sec"><h2>날마다</h2><span class="hint">칸이 찰수록 많이 쓴 날</span></div>' + calendar(ym, rs) + "</div>";

  /* 큰 지출 */
  const top = outs.slice().sort((a, b) => b.mine - a.mine).slice(0, 6);
  const topCard = '<div class="card"><div class="sec"><h2>큰 지출</h2><span class="hint">내 몫 기준</span></div>' +
    (top.length ? '<div class="rows">' + top.map(r =>
      '<div class="row"><div class="nm">' + esc(r.place || r.sub) + "</div>" +
      '<div class="amt">' + won(r.mine) + "</div>" +
      '<div class="meta"><span>' + r.date.slice(5).replace("-", "/") + "</span><span>" + esc(r.sub) + "</span>" +
      (r.detail ? "<span>" + esc(r.detail) + "</span>" : "") +
      (r.amt > r.mine ? "<span>전액 " + won(r.amt) + "</span>" : "") + "</div></div>"
    ).join("") + "</div>" : '<div class="empty">이 달 지출 기록이 없습니다.</div>') + "</div>";

  box.innerHTML = alerts + hero + cmpCard + bigCard + calCard + topCard;

  $$(".mk-rec", box).forEach(b => b.onclick = () => {
    goTab("add");
    setTimeout(() => prefillAdd({
      date: S.ym + "-" + pad2(Math.min(28, +b.dataset.day)),
      sub: b.dataset.sub, place: b.dataset.place, amt: b.dataset.amt,
    }), 60);
  });
}
