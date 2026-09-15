/* ===== js/page-spend.js ===== */
/* page-spend.js - 소비. 추이 / 분석 / 장부 셋을 한 탭에 담았다. */
FILEV.spend = CONFIG.APP_VERSION;

const SP = { seg: "trend" };

function renderSpend() {
  const box = $("#p-spend");
  box.innerHTML = segHTML([["trend", "추이"], ["ana", "분석"], ["book", "장부"]], SP.seg, "sp") +
    '<div id="spendBody"></div>';
  $$("[data-sp]", box).forEach(b => b.onclick = () => { SP.seg = b.dataset.sp; renderSpend(); });
  if (SP.seg === "trend") renderTrend();
  else if (SP.seg === "book") renderBook();
  else renderAnalysis();
  decorate(box);
}

function renderAnalysis() {
  const box = $("#spendBody");
  const ys = years().filter(y => y <= yOf(todayISO()));
  const outs = S.rows.filter(isOut);

  /* 잔디 */
  const grass = '<div class="card"><div class="sec"><h2>날마다</h2><span class="hint">진할수록 많이 쓴 날</span></div>' +
    heatHTML(dayMap(), 371) + "</div>";

  /* 해마다 */
  const yst = ys.map(y => yearStat(y));
  const yearCard = '<div class="card"><div class="sec"><h2>해마다</h2><span class="hint">내 몫 기준</span></div>' +
    barsHTML(yst.map(s => ({ key: s.y.slice(2), mine: s.out })), {}) +
    '<div style="overflow-x:auto"><table class="tbl" style="margin-top:12px"><thead><tr>' +
    "<th>해</th><th>수입</th><th>지출</th><th>남은 돈</th><th>저축률</th><th>달</th></tr></thead><tbody>" +
    yst.slice().reverse().map(s =>
      "<tr><td>" + s.y + '</td><td class="n">' + won(s.inc) + '</td><td class="n">' + won(s.out) +
      '</td><td class="n">' + won(s.left) + '</td><td class="n">' + (s.inc ? Math.round(s.left / s.inc * 100) + "%" : "-") +
      '</td><td class="n">' + s.months + "</td></tr>").join("") +
    "</tbody></table></div></div>";

  /* 개인 물가지수 */
  const cpi = cpiItems(3, 3).slice(0, 5);
  const pal = ["#B33A5A", "#0F7B6C", "#33518A", "#9A7B2E", "#7E8AA0"];
  const cpiCard = cpi.length
    ? '<div class="card"><div class="sec"><h2>내 물가</h2><span class="hint">되풀이해 간 곳의 건당 평균</span></div>' +
      lineChart(cpi.map((it, i) => ({
        color: pal[i], dot: true,
        pts: it.series.map(s => ({ x: s.y, y: Math.round(s.v / it.series[0].v * 100) })),
      })), { h: 160, zero: false }) +
      '<div class="rows" style="margin-top:12px">' + cpi.map((it, i) =>
        '<div class="row"><div class="nm"><i style="display:inline-block;width:9px;height:9px;border-radius:3px;background:' +
        pal[i] + ';margin-right:6px"></i>' + esc(it.place) + "</div>" +
        '<div class="amt" style="color:' + (it.change >= 0 ? "var(--out)" : "var(--in)") + '">' +
        (it.change >= 0 ? "+" : "") + Math.round(it.change * 100) + "%</div>" +
        '<div class="meta"><span>' + it.series[0].y + "년 " + won(Math.round(it.series[0].v)) + "원</span>" +
        "<span>" + it.series[it.series.length - 1].y + "년 " + won(Math.round(it.series[it.series.length - 1].v)) + "원</span>" +
        "<span>" + it.n + "건</span></div></div>").join("") + "</div>" +
      '<p class="foot">첫 해를 100으로 놓고 건당 평균이 어떻게 변했는지 봅니다. 같은 곳에서 사는 것이 해마다 달라지면 값도 흔들리니 참고로만 보세요.</p></div>'
    : "";

  /* 요일과 달의 버릇 */
  const wd = weekdayProfile(outs), mp = monthProfile(outs);
  const habit = '<div class="card"><div class="sec"><h2>버릇</h2><span class="hint">쓴 날 하루 평균 / 달 평균</span></div>' +
    '<div style="font-size:11.5px;color:var(--ink3);margin-bottom:4px">요일</div>' +
    barsHTML(wd.map(w => ({ key: w.key, mine: w.mine, hi: w.mine === Math.max(...wd.map(x => x.mine)) })), { h: 110 }) +
    '<div style="font-size:11.5px;color:var(--ink3);margin:14px 0 4px">달</div>' +
    barsHTML(mp.map(m => ({ key: m.key.replace("월", ""), mine: m.mine, color: "var(--navy2)" })), { h: 110 }) + "</div>";

  /* 고정 지출 */
  const fx = fixedCosts().slice(0, 12);
  const fxSum = fx.reduce((a, f) => a + f.avg, 0);
  const fxCard = '<div class="card"><div class="sec"><h2>매달 나가는 것</h2>' +
    '<span class="hint">최근 여덟 달 중 여섯 달 이상</span></div>' +
    (fx.length
      ? '<p class="foot" style="margin:0 0 10px">한 달에 <b class="num">' + won(Math.round(fxSum)) + "</b>원이 이 목록으로 나갑니다.</p>" +
        rankList(fx.map(f => ({ key: f.place, mine: Math.round(f.avg), amt: Math.round(f.avg), n: f.n })),
          Math.round(fx[0].avg), { extra: it => "" })
      : '<div class="empty">아직 잡히는 것이 없습니다.</div>') + "</div>";

  /* 대분류를 쌓아 올린 달마다 */
  const ms18 = Array.from(new Set(S.rows.map(r => r.ym)))
    .filter(m => m && m <= ymOf(todayISO())).sort().slice(-18);
  const topBigs = byKey(outs, r => r.big || "기타").slice(0, 6).map(b => b.key);
  const cache = new Map();
  const getBig = (m, k) => {
    if (!cache.has(m)) {
      const o = {};
      for (const r of monthRows(m)) if (isOut(r)) { const b = r.big || "기타"; o[b] = (o[b] || 0) + r.mine; }
      let etc = 0;
      for (const b in o) if (topBigs.indexOf(b) < 0) etc += o[b];
      o["그 밖"] = etc;
      cache.set(m, o);
    }
    return cache.get(m)[k] || 0;
  };
  const stack = '<div class="card"><div class="sec"><h2>쌓아 보면</h2>' +
    '<span class="hint">최근 ' + ms18.length + "달, 큰 여섯 갈래</span></div>" +
    stackHTML(ms18, topBigs.concat(["그 밖"]), getBig, { h: 180 }) + "</div>";

  /* 수입 지출 남은 돈 */
  const ms24 = Array.from(new Set(S.rows.map(r => r.ym)))
    .filter(m => m && m <= ymOf(todayISO())).sort().slice(-24);
  const sts = ms24.map(m => ({ m, s: monthStat(m) }));
  const three = '<div class="card"><div class="sec"><h2>들어오고 나간 것</h2>' +
    '<span class="hint">최근 ' + ms24.length + "달</span></div>" +
    lineChart([
      { color: "var(--jade)", w: 2.2, pts: sts.map(x => ({ x: x.m, y: x.s.inc })) },
      { color: "var(--coral)", w: 2.2, pts: sts.map(x => ({ x: x.m, y: x.s.out })) },
      { color: "var(--gold)", w: 1.6, dash: true, pts: sts.map(x => ({ x: x.m, y: Math.max(0, x.s.left) })) },
    ], { h: 175, label: x => x.slice(2).replace("-", ".") }) +
    '<div class="legend"><span><i style="background:var(--jade)"></i>수입</span>' +
    '<span><i style="background:var(--coral)"></i>지출</span>' +
    '<span><i style="background:var(--gold)"></i>남은 돈</span></div></div>';

  box.innerHTML = grass + three + stack + yearCard + cpiCard + habit + fxCard;
  decorate(box);
}
