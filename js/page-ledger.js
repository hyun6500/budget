/* ===== js/page-ledger.js ===== */
/* page-ledger.js - 원장. 옛 가계부 시트의 월별 탭 그대로,
   그 달의 모든 날짜를 하루도 빠짐없이 세로로 세운다. 쓴 날도 안 쓴 날도 보인다. */
FILEV.ledger = CONFIG.APP_VERSION;

const LG = { dense: false, hideEmpty: false };

function renderLedger() {
  const ym = S.ym, box = $("#p-ledger");
  const rs = monthRows(ym);
  const st = monthStat(ym);
  const y = +ym.slice(0, 4), mo = +ym.slice(5, 7);
  const lastDay = new Date(y, mo, 0).getDate();

  /* 날짜별로 모은다 */
  const byDay = new Map();
  for (const r of rs) {
    const d = +r.date.slice(8, 10);
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d).push(r);
  }
  const dayOut = d => (byDay.get(d) || []).reduce((a, r) => a + (isOut(r) ? r.mine : 0), 0);
  const maxDayOut = Math.max(1, ...Array.from({ length: lastDay }, (_, i) => dayOut(i + 1)));

  /* 머리 띠. 옛 시트의 첫 줄을 옮긴 것 */
  const strip =
    '<div class="card tight ledhead">' +
    (A.data ? '<div class="lh"><span>보유 자산</span><b class="num" style="color:var(--gold)">' + won(assetTotal()) + "</b></div>" : "") +
    '<div class="lh"><span>수입</span><b class="num" style="color:var(--jade)">' + won(st.inc) + "</b></div>" +
    '<div class="lh"><span>지출</span><b class="num" style="color:var(--coral)">' + won(st.out) + "</b></div>" +
    '<div class="lh"><span>남은 돈</span><b class="num">' + won(st.left) + "</b></div>" +
    "</div>";

  const opts =
    '<div class="ledopt">' +
    '<button class="chip' + (LG.hideEmpty ? " on" : "") + '" id="lgEmpty">빈 날 접기</button>' +
    '<button class="chip' + (LG.dense ? " on" : "") + '" id="lgDense">좁게</button>' +
    '<span class="ledcount">' + rs.length + "줄 / " + lastDay + "일</span></div>";

  /* 본문 */
  let body = "";
  for (let d = 1; d <= lastDay; d++) {
    const date = ym + "-" + pad2(d);
    const wd = new Date(date + "T00:00:00").getDay();
    const list = byDay.get(d) || [];
    if (LG.hideEmpty && !list.length) continue;
    const wcls = wd === 0 ? " sun" : wd === 6 ? " sat" : "";
    const isToday = date === todayISO();
    const dOut = dayOut(d);

    const dayCell =
      '<td class="dcell' + wcls + (isToday ? " today" : "") + '" rowspan="' + Math.max(1, list.length) + '">' +
      '<div class="dn">' + pad2(d) + '<span class="dw">' + WD[wd] + "</span></div>" +
      (dOut ? '<div class="dsum">' + won(dOut) + "</div>" +
        '<div class="dbarmini"><i style="width:' + (dOut / maxDayOut * 100).toFixed(1) + '%"></i></div>' : "") +
      "</div>";

    if (!list.length) {
      body += '<tr class="newday empty-day" data-add="' + date + '">' + dayCell +
        '<td colspan="5" class="none">기록 없음</td></tr>';
      continue;
    }
    list.forEach((r, i) => {
      const inK = isIn(r), movK = isMov(r);
      body += '<tr class="' + (i === 0 ? "newday" : "") + (r.검수 ? " need" : "") + '" data-no="' + r.no + '">' +
        (i === 0 ? dayCell : "") +
        '<td class="money in">' + (inK ? won(r.amt) : "") + "</td>" +
        '<td class="money ' + (movK ? "mov" : "out") + '">' + (inK ? "" : won(r.amt)) + "</td>" +
        '<td class="pl">' + esc(r.place || "") +
        (r.rate < 1 ? '<span class="rate">' + Math.round(r.rate * 100) + "%</span>" : "") + "</td>" +
        '<td class="de">' + esc(r.detail || "") + "</td>" +
        '<td class="cat"><span class="catchip" style="background:' + colorOf(r.big || "기타") + '22;color:' +
        colorOf(r.big || "기타") + '">' + esc(r.sub || "") + "</span>" +
        (r.situ || r.treat || r.theme ? '<span class="tags">' + [r.situ, r.treat, r.theme].filter(Boolean).map(esc).join(" ") + "</span>" : "") +
        "</td></tr>";
    });
  }

  const table =
    '<div class="card tight"><div class="sec"><h2>' + y + "년 " + mo + "월 원장</h2>" +
    '<span class="hint">줄을 누르면 고칩니다</span></div>' + opts +
    '<div class="scrollx"><table class="led' + (LG.dense ? " dense" : "") + '"><thead><tr>' +
    "<th>날짜</th><th>수입</th><th>지출</th><th>장소</th><th>세부내역</th><th>분류</th>" +
    "</tr></thead><tbody>" + body +
    '<tr class="sumrow"><td>합계</td>' +
    '<td class="money in">' + won(sumAmt(rs, isIn)) + "</td>" +
    '<td class="money out">' + won(sumAmt(rs, isOut) + sumAmt(rs, isMov)) + "</td>" +
    '<td colspan="3" class="de">내 몫 지출 ' + won(st.out) + " / 이체 저축 " + won(st.mov) + "</td></tr>" +
    "</tbody></table></div>" +
    '<p class="foot">표의 금액은 전액입니다. 장소 옆 퍼센트는 내가 부담한 몫이고, 날짜 칸의 작은 숫자는 그날 내 몫 지출입니다. ' +
    "빈 날을 누르면 그 날짜로 새 줄을 적습니다.</p></div>";

  /* 하루 흐름 */
  const days = Array.from({ length: lastDay }, (_, i) => ({
    key: String(i + 1), mine: dayOut(i + 1),
    color: [0, 6].includes(new Date(ym + "-" + pad2(i + 1) + "T00:00:00").getDay()) ? "var(--sky)" : "var(--coral)",
    hi: ym + "-" + pad2(i + 1) === todayISO(),
  }));
  const flow = '<div class="card"><div class="sec"><h2>날마다</h2><span class="hint">파란 막대가 주말</span></div>' +
    barsHTML(days, { h: 120 }) +
    '<div class="legend"><span>기록한 날 ' + byDay.size + "일</span><span>안 쓴 날 " + (lastDay - byDay.size) + "일</span>" +
    "<span>가장 많이 쓴 날 " + won(maxDayOut) + "</span></div></div>";

  box.innerHTML = strip + table + flow;
  decorate(box);

  $("#lgEmpty").onclick = () => { LG.hideEmpty = !LG.hideEmpty; renderLedger(); };
  $("#lgDense").onclick = () => { LG.dense = !LG.dense; renderLedger(); };
  $$("tbody tr[data-no]", box).forEach(tr => tr.onclick = () => {
    const r = S.rows.find(x => x.no === +tr.dataset.no);
    if (r) openEdit(r);
  });
  $$("tbody tr[data-add]", box).forEach(tr => tr.onclick = () => {
    goTab("add");
    setTimeout(() => prefillAdd({ date: tr.dataset.add }), 60);
  });
}
