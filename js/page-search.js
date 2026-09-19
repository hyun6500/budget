/* ===== js/page-search.js ===== */
/* page-search.js - 찾기. 9천 줄을 말로 뒤진다.
   결과를 요약해서 보여 주고, 줄을 누르면 그 달의 원장으로 건너가 그 줄을 짚어 준다.
   원장은 달 단위라 "그때 그거 얼마였지" 를 찾으려면 달을 짐작해야 했다. 그 짐작을 없애는 화면이다. */
FILEV.search = CONFIG.APP_VERSION;

const SR = { q: "", span: "all", kind: "", sort: "date", more: false, t: null };

const SR_SPAN = [["all", "전체"], ["y3", "최근 3년"], ["y1", "최근 1년"], ["m6", "최근 6달"]];
const SR_KIND = [["", "모두"], ["지출", "지출"], ["수입", "수입"], ["이체", "이체"]];
const SR_SORT = [["date", "최신순"], ["old", "오래된순"], ["amt", "금액순"]];
const SR_CUT = 60;

/** 한 줄을 말뭉치로 편다. 여기 있는 것은 전부 찾을 수 있다 */
function srHay(r) {
  return [r.date, r.place, r.detail, r.memo, r.sub, r.big, r.with, r.event,
  r.treat, r.theme, r.situ, r.pay, r.discBy, r.share, r.group, "no." + r.no].join(" ").toLowerCase();
}

function srFrom(span) {
  if (span === "all") return "";
  const d = new Date();
  if (span === "y3") d.setFullYear(d.getFullYear() - 3);
  else if (span === "y1") d.setFullYear(d.getFullYear() - 1);
  else d.setMonth(d.getMonth() - 6);
  return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
}

/** 찾은 줄. 띄어쓰기로 나눈 낱말이 모두 들어 있어야 걸린다 */
function srFind() {
  const q = SR.q.trim().toLowerCase();
  const words = q.split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  /* no.1234 나 #1234 는 곧장 그 줄 하나로 */
  const only = q.match(/^(?:no\.?\s*|#)(\d+)$/);
  if (only) return S.rows.filter(r => r.no === +only[1]);
  const from = srFrom(SR.span);
  let out = S.rows.filter(r => {
    if (from && r.date < from) return false;
    if (SR.kind && r.kind !== SR.kind) return false;
    const h = srHay(r);
    for (const w of words) {
      if (h.indexOf(w) >= 0) continue;
      /* 숫자만 친 것은 금액으로도 본다. 13000 으로 13,000원짜리를 찾을 수 있게 */
      if (/^\d{3,}$/.test(w) && String(Math.abs(r.amt)).indexOf(w) >= 0) continue;
      return false;
    }
    return true;
  });
  if (SR.sort === "amt") out = out.slice().sort((a, b) => Math.abs(b.mine) - Math.abs(a.mine));
  else if (SR.sort === "old") out = out.slice();
  else out = out.slice().reverse();
  return out;
}

function srSummary(rs) {
  const out = rs.filter(isOut), inc = rs.filter(isIn), mov = rs.filter(isMov);
  const mine = out.reduce((a, r) => a + r.mine, 0);
  const full = out.reduce((a, r) => a + r.amt, 0);
  const ds = rs.map(r => r.date).sort();
  const months = new Set(rs.map(r => r.ym)).size;
  const rf = out.filter(isRefund);

  const subs = byKey(out, r => r.sub).slice(0, 5);
  const places = byKey(out, r => (r.place || "").trim()).slice(0, 5);
  const yrs = Array.from(new Set(rs.map(r => r.y))).sort();
  const bars = yrs.map(y => ({
    key: y.slice(2), mine: rs.filter(r => r.y === y && isOut(r)).reduce((a, r) => a + r.mine, 0),
  }));

  const head =
    '<div class="card"><div class="sec"><h2>찾은 것</h2>' +
    '<span class="hint">' + rs.length + "줄</span></div>" +
    '<div class="rows">' +
    '<div class="row"><div class="nm">쓴 돈 (내 몫)</div><div class="amt">' + won(mine) + "</div></div>" +
    (full !== mine ? '<div class="row"><div class="nm">영수증 전액</div><div class="amt">' + won(full) + "</div></div>" : "") +
    (inc.length ? '<div class="row"><div class="nm">수입</div><div class="amt" style="color:var(--jade)">' +
      won(inc.reduce((a, r) => a + r.mine, 0)) + "</div></div>" : "") +
    (mov.length ? '<div class="row"><div class="nm">이체 저축</div><div class="amt" style="color:var(--sky)">' +
      won(mov.reduce((a, r) => a + r.mine, 0)) + "</div></div>" : "") +
    (out.length ? '<div class="row"><div class="nm">한 건에</div><div class="amt">' +
      won(Math.round(mine / out.length)) + "</div></div>" : "") +
    (months > 1 ? '<div class="row"><div class="nm">기록이 있는 달</div><div class="amt">' + months + "달</div></div>" +
      '<div class="row"><div class="nm">그 달들 평균</div><div class="amt">' + won(Math.round(mine / months)) + "</div></div>" : "") +
    (ds.length ? '<div class="row"><div class="nm">처음과 마지막</div><div class="amt" style="font-size:13px">' +
      esc(ds[0]) + " ~ " + esc(ds[ds.length - 1]) + "</div></div>" : "") +
    (rf.length ? '<div class="row"><div class="nm">돌려받은 것</div><div class="amt" style="color:var(--jade)">' +
      rf.length + "건 " + won(-rf.reduce((a, r) => a + r.mine, 0)) + "</div></div>" : "") +
    "</div></div>";

  const year = bars.length > 1
    ? '<div class="card"><div class="sec"><h2>해마다</h2><span class="hint">지출 내 몫</span></div>' +
    barsHTML(bars, { h: 110 }) + "</div>"
    : "";

  const top = (subs.length > 1 || places.length > 1)
    ? '<div class="card"><div class="sec"><h2>어디에 썼나</h2><span class="hint">상위 다섯</span></div>' +
    (subs.length > 1 ? '<p class="foot" style="margin:0 0 8px">소분류</p>' +
      rankList(subs, subs[0].mine, { color: it => colorOf(bigOf(it.key) || "기타") }) : "") +
    (places.length > 1 ? '<p class="foot" style="margin:12px 0 8px">장소</p>' +
      rankList(places, places[0].mine, { noIcon: true }) : "") +
    "</div>"
    : "";

  return head + year + top;
}

function srRowsHTML(rs) {
  const show = SR.more ? rs : rs.slice(0, SR_CUT);
  const body = show.map(r => {
    const rf = isRefund(r);
    const side = [];
    if (r.amt !== r.mine) side.push("전액 " + won(r.amt));
    if (r.disc) side.push("할인 " + won(r.disc));
    if (r.rate < 1) side.push("부담 " + Math.round(r.rate * 100) + "%");
    return '<tr data-go="' + r.no + '">' +
      '<td class="sd">' + esc(r.date.slice(2)) + '<span>' + wdOf(r.date) + "</span></td>" +
      '<td class="money ' + (rf ? "rf" : isIn(r) ? "in" : isMov(r) ? "mov" : "out") + '">' + won(r.mine) + "</td>" +
      '<td class="pl">' + (rf ? '<span class="rfchip">환불</span>' : "") + esc(r.place || "") +
      '<span class="de">' + esc(r.detail || "") +
      (side.length ? " / " + esc(side.join(" / ")) : "") + "</span></td>" +
      '<td class="cat"><span class="catchip" style="background:' + colorOf(r.big || "기타") + '22;color:' +
      colorOf(r.big || "기타") + '">' + esc(r.sub || "") + "</span>" +
      (typeof tagsOf === "function" ? tagsOf(r) : "") + "</td></tr>";
  }).join("");

  return '<div class="card tight"><div class="sec"><h2>줄</h2>' +
    '<span class="hint">누르면 그 달 원장으로</span></div>' +
    '<div class="scrollx"><table class="led srtbl"><tbody>' + body + "</tbody></table></div>" +
    (rs.length > show.length
      ? '<button class="btn ghost sm" id="srMore" style="width:100%;margin-top:10px">나머지 ' +
      (rs.length - show.length) + "줄 더 보기</button>"
      : "") +
    "</div>";
}

function paintSearch() {
  const box = $("#srOut");
  if (!box) return;
  const chips = $("#srChips");
  if (chips) {
    chips.innerHTML =
      segHTML(SR_SPAN, SR.span, "srspan") +
      segHTML(SR_KIND, SR.kind, "srkind") +
      segHTML(SR_SORT, SR.sort, "srsort");
    $$("[data-srspan]", chips).forEach(b => b.onclick = () => { SR.span = b.dataset.srspan; SR.more = false; paintSearch(); });
    $$("[data-srkind]", chips).forEach(b => b.onclick = () => { SR.kind = b.dataset.srkind; SR.more = false; paintSearch(); });
    $$("[data-srsort]", chips).forEach(b => b.onclick = () => { SR.sort = b.dataset.srsort; paintSearch(); });
  }

  if (!SR.q.trim()) {
    box.innerHTML = '<div class="card"><p class="foot" style="margin:0">' +
      "장소, 세부내역, 메모, 소분류, 동행, 건, 결제수단을 한꺼번에 뒤집니다. " +
      "띄어쓰기로 여러 낱말을 넣으면 <b>모두 들어 있는 줄</b>만 찾습니다. " +
      "숫자만 넣으면 금액으로도 찾고, <b>no.8377</b> 처럼 넣으면 그 줄 하나로 갑니다." +
      "</p><div class=\"chips\" style=\"margin-top:10px\">" +
      ["스타벅스", "여행 항공", "엄마 용돈", "쿠팡"].map(w =>
        '<button class="chip" data-srq="' + esc(w) + '">' + esc(w) + "</button>").join("") +
      "</div></div>";
    $$("[data-srq]", box).forEach(b => b.onclick = () => {
      SR.q = b.dataset.srq;
      const i = $("#srQ"); if (i) i.value = SR.q;
      paintSearch();
    });
    return;
  }

  const rs = srFind();
  if (!rs.length) {
    box.innerHTML = '<div class="card"><div class="empty">찾은 것이 없습니다. ' +
      "낱말을 줄이거나 기간을 넓혀 보세요.</div></div>";
    return;
  }
  box.innerHTML = srSummary(rs) + srRowsHTML(rs);
  decorate(box);
  const mb = $("#srMore", box);
  if (mb) mb.onclick = () => { SR.more = true; paintSearch(); };
  $$("tr[data-go]", box).forEach(tr => tr.onclick = () => jumpToRow(+tr.dataset.go));
}

function renderSearch() {
  const box = $("#p-search");
  box.innerHTML =
    '<div class="addClose"><button id="srBack">닫기</button></div>' +
    '<div class="card"><div class="sec"><h2>찾기</h2>' +
    '<span class="hint">가계부 ' + won(S.rows.length) + "줄</span></div>" +
    '<div class="fl"><input id="srQ" placeholder="스타벅스, 엄마 용돈, no.8377" ' +
    'autocomplete="off" value="' + esc(SR.q) + '"></div>' +
    '<div id="srChips" style="margin-top:10px"></div></div>' +
    '<div id="srOut"></div>';

  $("#srBack").onclick = () => goTab(LASTTAB === "search" ? "month" : LASTTAB);
  const i = $("#srQ");
  i.oninput = () => {
    SR.q = i.value; SR.more = false;
    clearTimeout(SR.t);
    SR.t = setTimeout(paintSearch, 140);
  };
  paintSearch();
  setTimeout(() => { try { i.focus(); } catch (e) { } }, 40);
}
