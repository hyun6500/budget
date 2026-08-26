/* ===== js/page-ledger.js ===== */
/* page-ledger.js - 원장. 옛 가계부 시트의 월별 탭 그대로,
   그 달의 모든 날짜를 하루도 빠짐없이 세로로 세운다. 쓴 날도 안 쓴 날도 보인다. */
FILEV.ledger = CONFIG.APP_VERSION;

const LG = { dense: false, hideEmpty: false, stick: true };

/* ---------- 분류 칸 아래의 작은 글씨 ----------
   테마만 있으면 "소개팅" 이라고만 뜨고 누구와였는지는 줄을 눌러야 알 수 있었다.
   테마 뒤에 동행 이름을 이어 붙인다. 여행이면 어느 여행이었는지도 함께 붙인다. */
function tagsOf(r) {
  const bits = [];
  if (r.situ) bits.push(esc(r.situ));
  if (r.treat) bits.push(esc(r.treat));
  if (r.theme) bits.push(esc(r.theme) + (r.with ? " " + esc(r.with) : ""));
  else if (r.with) bits.push(esc(r.with));
  if (r.event) bits.push('<b class="evtag">' + esc(r.event) + "</b>");
  if (!bits.length) return "";
  return '<span class="tags">' + bits.join(" ") + "</span>";
}

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
  /* 환불이 더 큰 날은 음수가 된다. 막대 길이는 절댓값으로 잡는다 */
  const maxDayOut = Math.max(1, ...Array.from({ length: lastDay }, (_, i) => Math.abs(dayOut(i + 1))));

  /* 머리 띠. 옛 시트의 첫 줄을 옮긴 것 */
  const strip =
    '<div class="card tight ledhead">' +
    (A.data ? '<div class="lh"><span>보유 자산</span><b class="num" style="color:var(--gold)">' + won(assetTotal()) + "</b></div>" : "") +
    '<div class="lh"><span>수입</span><b class="num" style="color:var(--jade)">' + won(st.inc) + "</b></div>" +
    '<div class="lh"><span>지출</span><b class="num" style="color:var(--coral)">' + won(st.out) + "</b></div>" +
    (st.refund > 0 ? '<div class="lh"><span>돌려받음</span><b class="num" style="color:var(--jade)">' +
      won(st.refund) + "</b></div>" : "") +
    '<div class="lh"><span>남은 돈</span><b class="num">' + won(st.left) + "</b></div>" +
    "</div>";

  const opts =
    '<div class="ledopt">' +
    '<button class="chip' + (LG.hideEmpty ? " on" : "") + '" id="lgEmpty">빈 날 접기</button>' +
    '<button class="chip' + (LG.dense ? " on" : "") + '" id="lgDense">좁게</button>' +
    '<button class="chip' + (LG.stick ? " on" : "") + '" id="lgStick">머리글 고정</button>' +
    '<span class="ledcount">' + rs.length + "줄 / " + lastDay + "일</span></div>";

  /* 본문 */
  let body = "";
  for (let d = 1; d <= lastDay; d++) {
    const date = ym + "-" + pad2(d);
    const wd = new Date(date + "T00:00:00").getDay();
    const list = byDay.get(d) || [];
    if (LG.hideEmpty && !list.length) continue;
    const hol = holidayOf(date);
    const wcls = (hol || wd === 0) ? " sun" : wd === 6 ? " sat" : "";
    const isToday = date === todayISO();
    const dOut = dayOut(d);

    const dayCell =
      '<td class="dcell' + wcls + (isToday ? " today" : "") + '" rowspan="' + Math.max(1, list.length) + '">' +
      '<div class="dn">' + pad2(d) + '<span class="dw">' + WD[wd] + "</span></div>" +
      (hol ? '<div class="dhol" title="' + esc(hol) + '">' + esc(hol) + "</div>" : "") +
      (dOut ? '<div class="dsum' + (dOut < 0 ? " neg" : "") + '">' + won(dOut) + "</div>" +
        '<div class="dbarmini' + (dOut < 0 ? " neg" : "") + '"><i style="width:' +
        (Math.abs(dOut) / maxDayOut * 100).toFixed(1) + '%"></i></div>' : "") +
      "</div>";

    if (!list.length) {
      body += '<tr class="newday empty-day" data-add="' + date + '">' + dayCell +
        '<td colspan="5" class="none">기록 없음</td></tr>';
      continue;
    }
    list.forEach((r, i) => {
      const inK = isIn(r), movK = isMov(r), rf = isRefund(r);
      /* 표에 크게 뜨는 숫자는 실제로 내 주머니에서 나간 돈이다.
         영수증 전액과 할인과 부담률은 그 아래 작은 글씨로 내린다.
         전액을 크게 두면 "이 달에 얼마 썼나" 를 표에서 바로 읽을 수 없다 */
      const side = [];
      if (r.amt !== r.mine) side.push("전액 " + won(r.amt));
      if (r.disc) side.push("할인 " + won(r.disc) + (r.discBy ? " " + esc(r.discBy) : ""));
      if (r.rate < 1) side.push("부담 " + Math.round(r.rate * 100) + "%" +
        (r.share && r.share !== "내 몫 전부" ? " " + esc(r.share) : ""));
      body += '<tr class="' + (i === 0 ? "newday" : "") + (r.검수 ? " need" : "") + (rf ? " rfrow" : "") +
        '" data-no="' + r.no + '">' +
        (i === 0 ? dayCell : "") +
        '<td class="money in">' + (inK ? won(r.mine) : "") + "</td>" +
        '<td class="money ' + (rf ? "rf" : movK ? "mov" : "out") + '">' + (inK ? "" : won(r.mine)) + "</td>" +
        '<td class="pl">' + (rf ? '<span class="rfchip">환불</span>' : "") + esc(r.place || "") +
        (r.time ? '<span class="rate">' + esc(r.time) + "</span>" : "") + "</td>" +
        '<td class="de">' + esc(r.detail || "") +
        (side.length ? '<span class="disc">' + side.join(" / ") + "</span>" : "") + "</td>" +
        '<td class="cat"><span class="catchip" style="background:' + colorOf(r.big || "기타") + '22;color:' +
        colorOf(r.big || "기타") + '">' + esc(r.sub || "") + "</span>" +
        tagsOf(r) +
        "</td></tr>";
    });
  }

  const table =
    '<div class="card tight"><div class="sec"><h2>' + y + "년 " + mo + "월 원장</h2>" +
    '<span class="hint">줄을 누르면 고칩니다</span></div>' + opts +
    '<div class="scrollx' + (LG.stick ? " ledwrap" : "") + '"><table class="led' + (LG.dense ? " dense" : "") + '"><thead><tr>' +
    "<th>날짜</th><th>수입</th><th>지출</th><th>장소</th><th>세부내역</th><th>분류</th>" +
    "</tr></thead><tbody>" + body +
    '<tr class="sumrow"><td>합계</td>' +
    '<td class="money in">' + won(st.inc) + "</td>" +
    '<td class="money out">' + won(st.out + st.mov) + "</td>" +
    '<td colspan="3" class="de">영수증 전액 ' + won(sumAmt(rs, isOut) + sumAmt(rs, isMov)) +
    " / 이체 저축 " + won(st.mov) +
    (st.refund > 0 ? " / 돌려받음 " + won(st.refund) + " (" + st.refundN + "건, 지출에서 이미 빠짐)" : "") + "</td></tr>" +
    "</tbody></table></div>" +
    '<p class="foot">표의 금액은 <b>할인과 분담을 빼고 실제로 나간 내 몫</b>입니다. ' +
    "영수증 전액과 할인, 부담률은 세부내역 아래 작은 글씨에 있습니다. " +
    "날짜 칸의 숫자도 같은 기준이라 세로로 더하면 합계와 맞습니다. " +
    "빈 날을 누르면 그 날짜로 새 줄을 적고, 줄을 꾹 누르면 베끼기와 순서 바꾸기가 뜹니다.</p></div>";

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
  /* 머리글과 합계를 붙박아 두려면 표가 제 스크롤 상자를 가져야 한다.
     상자 안에서 또 스크롤하는 것이 손에 안 맞을 수 있어 끌 수 있게 두었다 */
  $("#lgStick").onclick = () => { LG.stick = !LG.stick; renderLedger(); };
  /* 짧게 누르면 고치기, 꾹 누르면 그날 안에서 순서 바꾸기 */
  $$("tbody tr[data-no]", box).forEach(tr => {
    const no = +tr.dataset.no;
    let timer = null, long = false;
    const start = () => { long = false; timer = setTimeout(() => { long = true; openRowMenu(no); }, 480); };
    const stop = () => { if (timer) clearTimeout(timer); timer = null; };
    tr.addEventListener("touchstart", start, { passive: true });
    tr.addEventListener("touchend", stop);
    tr.addEventListener("touchmove", stop);
    tr.addEventListener("mousedown", start);
    tr.addEventListener("mouseup", stop);
    tr.addEventListener("mouseleave", stop);
    tr.onclick = () => {
      if (long) { long = false; return; }
      const r = S.rows.find(x => x.no === no);
      if (r) openEdit(r);
    };
  });
  $$("tbody tr[data-add]", box).forEach(tr => tr.onclick = () => {
    goTab("add");
    setTimeout(() => prefillAdd({ date: tr.dataset.add }), 60);
  });
}


/* ---------- 꾹 누르면 뜨는 차림표 ----------
   예전에는 꾹 누르면 곧장 순서 바꾸기였다. 베끼기가 더 자주 쓰일 일이라 한 겹을 두었다. */
function openRowMenu(no) {
  const r = S.rows.find(x => x.no === +no);
  if (!r) return;
  const same = S.rows.filter(x => x.date === r.date).length;
  const next = nextDateFor(r);
  const key = (r.sub || "") + "|" + (r.place || "").trim();
  const seen = S.rows.filter(x => (x.sub || "") + "|" + (x.place || "").trim() === key).length;

  openModal(
    '<h2 style="font-size:16px;margin-bottom:2px">' + esc(r.place || r.sub || "이름 없음") + "</h2>" +
    '<p style="font-size:11.5px;color:var(--ink3);margin:0 0 14px">' +
    esc(r.date) + " / " + won(r.mine) + "원" + (r.amt !== r.mine ? " (전액 " + won(r.amt) + ")" : "") +
    " / " + esc(r.sub || "") + "</p>" +
    '<div class="form">' +
    '<button class="btn" id="rmCopy">이 줄로 새로 적기</button>' +
    '<span style="font-size:11px;color:var(--ink3);margin:-6px 0 4px">' +
    (seen > 1 ? "이 내용으로 " + seen + "번 적으셨습니다. 날짜는 <b>" + esc(next) + "</b> 로 내밀겠습니다"
      : "날짜는 오늘로 두고 나머지를 그대로 베낍니다") + "</span>" +
    '<button class="btn ghost" id="rmEdit">고치기</button>' +
    '<button class="btn ghost" id="rmMove"' + (same < 2 ? " disabled" : "") + ">순서 바꾸기" +
    (same < 2 ? " (그날 기록이 하나뿐입니다)" : "") + "</button>" +
    '<button class="btn ghost" id="rmNo">닫기</button></div>'
  );
  $("#rmCopy").onclick = () => { closeModal(true); copyToAdd(r, next); };
  $("#rmEdit").onclick = () => openEdit(r);
  $("#rmNo").onclick = () => closeModal(true);
  const mv = $("#rmMove");
  if (mv && !mv.disabled) mv.onclick = () => { closeModal(true); setTimeout(() => openMove(no), 80); };
}

/** 같은 날 안에서 차례를 바꾼다.
    화면에서는 곧바로 바뀌고, [저장] 을 눌러야 시트에 간다.
    줄을 눌러 고를 수 있으므로 꾹 누른 것 말고 다른 줄도 옮길 수 있다. */
function openMove(no) {
  const r = S.rows.find(x => x.no === +no);
  if (!r) return;
  const base = S.rows.filter(x => x.date === r.date);
  if (base.length < 2) return toast("그날 기록이 하나뿐입니다");

  const MV = { list: base.slice(), pick: +no, date: r.date };
  const orig = base.map(x => x.no).join(",");

  const paint = () => {
    const at = MV.list.findIndex(x => x.no === MV.pick);
    const dirty = MV.list.map(x => x.no).join(",") !== orig;
    return '<h2 style="font-size:16px;margin-bottom:2px">순서 바꾸기</h2>' +
      '<p style="font-size:11.5px;color:var(--ink3);margin:0 0 12px">' + esc(MV.date) +
      " 안에서만 옮깁니다. 옮길 줄을 눌러 고른 뒤 위아래로 움직이세요. no 는 바뀌지 않습니다.</p>" +
      '<div class="rows">' + MV.list.map((x, k) =>
        '<div class="row mvrow' + (x.no === MV.pick ? " mv" : "") + '" data-mv="' + x.no + '">' +
        '<div class="nm">' + (k + 1) + ". " + esc(x.place || x.sub) + "</div>" +
        '<div class="amt">' + won(x.amt) + "</div>" +
        '<div class="meta"><span>' + esc(x.sub || "") + "</span>" +
        (x.time ? "<span>" + esc(x.time) + "</span>" : "") + "</div></div>").join("") + "</div>" +
      '<div style="display:flex;gap:8px;margin-top:14px">' +
      '<button class="btn ghost" id="mvUp"' + (at <= 0 ? " disabled" : "") + ">위로</button>" +
      '<button class="btn ghost" id="mvDn"' + (at >= MV.list.length - 1 ? " disabled" : "") + ">아래로</button>" +
      "</div>" +
      '<div style="display:flex;gap:8px;margin-top:8px">' +
      '<button class="btn" id="mvSave"' + (dirty ? "" : " disabled") + ">" +
      (dirty ? "이대로 저장" : "바뀐 것이 없습니다") + "</button>" +
      '<button class="btn ghost" id="mvNo" style="max-width:96px">' + (dirty ? "버리기" : "닫기") + "</button></div>";
  };

  const bind = () => {
    $$("[data-mv]", $("#modalBody")).forEach(el => el.onclick = () => {
      MV.pick = +el.dataset.mv; redraw();
    });
    const at = MV.list.findIndex(x => x.no === MV.pick);
    const swap = d => {
      const j = at + d;
      if (j < 0 || j >= MV.list.length) return;
      const t = MV.list[at]; MV.list[at] = MV.list[j]; MV.list[j] = t;
      redraw();
    };
    const u = $("#mvUp"), dn = $("#mvDn");
    if (u && !u.disabled) u.onclick = () => swap(-1);
    if (dn && !dn.disabled) dn.onclick = () => swap(1);
    $("#mvNo").onclick = () => closeModal(true);
    const sv = $("#mvSave");
    if (sv && !sv.disabled) sv.onclick = async () => {
      if (!await ensureAuth()) return;
      sv.disabled = true; sv.textContent = "저장 중";
      try {
        await post("reorder", { token: AUTH.token, date: MV.date, order: MV.list.map(x => x.no) });
        /* 화면에 이미 보이는 차례 그대로 앱에도 앉힌다 */
        const seqs = base.map(x => x.seq).slice().sort((a, b) => a - b);
        MV.list.forEach((x, k) => { const row = S.rows.find(y => y.no === x.no); if (row) row.seq = seqs[k]; });
        S.rows.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.seq - b.seq);
        cacheDrop();
        closeModal(true);
        DIRTY.month = DIRTY.ledger = DIRTY.spend = DIRTY.hall = 1;
        renderLedger();
        toast("차례를 저장했습니다");
      } catch (e) {
        sv.disabled = false; sv.textContent = "이대로 저장";
        toast("실패: " + e.message);
      }
    };
  };

  const redraw = () => { $("#modalBody").innerHTML = paint(); bind(); };
  openModal(paint());
  bind();
}
