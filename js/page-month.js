/* ===== js/page-month.js ===== */
/* page-month.js - 이번 달 한 장. 알림, 읽어 주는 말, 히어로, 견줌, 대분류, 달력, 큰 지출. */
FILEV.month = CONFIG.APP_VERSION;

const MO = { alertsOpen: false };

function renderMonth() {
  const ym = S.ym, rs = monthRows(ym);
  const now = monthStat(ym), prev = monthStat(shiftYM(ym, -1)), last = monthStat(shiftYM(ym, -12));
  const avg = avgOutOfYear(yOf(ym + "-01"));
  const box = $("#p-month");

  /* 알림 */
  const AL = buildAlerts(ym);
  let alerts = alertsHTML(AL, MO.alertsOpen);
  if (!AL.length && DISMISS.count())
    alerts = '<div id="alertBox"><button class="btn ghost sm" id="alertBack" style="width:100%;margin-bottom:8px">' +
      "숨긴 알림 " + DISMISS.count() + "건 되살리기</button></div>";

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

  /* 읽어 주는 말 */
  const ins = INSIGHT.build(ym);
  const insCard = ins.length
    ? '<div class="card"><div class="sec"><h2>읽어 보면</h2><span class="hint">규칙으로 찾은 신호</span></div>' +
      '<div class="ins">' + ins.map(i =>
        '<div class="i"><span class="k ' + i.kind + '">' + esc(i.tag) + "</span><div>" + i.html + "</div></div>").join("") +
      "</div></div>"
    : "";

  /* 자산 한 줄 */
  let assetLine = "";
  if (A.data) {
    const gap = assetGap();
    assetLine =
      '<div class="card tight"><div class="sec" style="margin-bottom:8px"><h2>지금 가진 것</h2>' +
      '<span class="hint">' + esc(A.data.asOf || "") + " 기준</span></div>" +
      '<div class="rows">' +
      '<div class="row"><div class="nm">모은 돈 (원금)</div><div class="amt">' + won(assetTotal()) + "</div></div>" +
      '<div class="row"><div class="nm">지금 값 (평가)</div><div class="amt" style="color:' +
      (gap >= 0 ? "var(--in)" : "var(--out)") + '">' + won(assetValued()) +
      " (" + (gap >= 0 ? "+" : "-") + wonS(Math.abs(gap)) + ")</div></div></div>" +
      '<p class="foot">자산 탭에서 자세히 봅니다. 가계부와 갱신 주기가 달라 기준일을 함께 적습니다.</p></div>';
  }

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
      '<div class="bar"><div class="dbar"><i class="mine" style="width:' + (c.v / mx * 100).toFixed(1) + '%;background:var(--line)"></i></div></div></div>'
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

  const storyBtn = '<div class="card tight"><button class="btn ghost" id="storyBtn">이 달 결산 카드 만들기</button></div>';

  box.innerHTML = alerts + hero + insCard + assetLine + cmpCard + bigCard + calCard + topCard + storyBtn;

  const show = MO.alertsOpen ? AL : AL.slice(0, 2);
  $$("[data-ago]", box).forEach(b => b.onclick = () => show[+b.dataset.ago].act.go());
  $$("[data-askip]", box).forEach(b => b.onclick = () => { DISMISS.skip(b.dataset.askip, ym); renderMonth(); });
  $$("[data-amute]", box).forEach(b => b.onclick = () => {
    DISMISS.mute(b.dataset.amute);
    toast("이 갈래를 껐습니다. 아래 [숨긴 알림 되살리기] 로 되돌립니다");
    renderMonth();
  });
  const more = $("#alertMore", box);
  if (more) more.onclick = () => { MO.alertsOpen = !MO.alertsOpen; renderMonth(); };
  const back = $("#alertBack", box);
  if (back) back.onclick = () => { DISMISS.reset(); toast("숨긴 알림을 모두 되살렸습니다"); renderMonth(); };
  $("#storyBtn").onclick = () => openStory(S.ym);
}
