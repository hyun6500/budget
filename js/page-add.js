/* ===== js/page-add.js ===== */
/* page-add.js - 기록 더하기.
   손으로 적어도 되고, 카드사나 토스 알림 화면을 올리거나 글을 붙여 넣어도 된다. */
FILEV.add = CONFIG.APP_VERSION;

const ADD = { shots: [], cands: [], queue: [], qTotal: 0, sugg: null, mailIds: [] };

/** 분류표에 적힌 차례 그대로의 대분류 목록 */
function bigList() {
  const out = [];
  ((S.meta && S.meta.subs) || []).forEach(s => { if (s.big && out.indexOf(s.big) < 0) out.push(s.big); });
  return out;
}
function bigOf(sub) {
  const m = ((S.meta && S.meta.subs) || []).find(s => s.sub === sub);
  return m ? m.big : "";
}
/** 대분류가 정해져 있으면 그 아래만, 비어 있으면 전부.
    전부일 때만 괄호로 대분류를 붙인다. 이미 좁혀 놓았으면 군더더기다. */
function subOptions(sel, big) {
  const list = ((S.meta && S.meta.subs) || []).filter(s => !big || s.big === big);
  return list.map(s => '<option value="' + esc(s.sub) + '"' + (s.sub === sel ? " selected" : "") + ">" +
    esc(s.sub) + (big ? "" : " (" + esc(s.big) + ")") + "</option>").join("");
}
/** 대분류를 고르면 소분류 목록을 그 아래로 좁힌다. 고르던 값이 그 안에 없으면 비운다 */
function paintSubs(R) {
  const bg = $("#f_big", R), sb = $("#f_sub", R);
  if (!sb) return;
  const keep = sb.value;
  const big = bg ? bg.value : "";
  sb.innerHTML = '<option value=""></option>' + subOptions(keep, big);
  sb.value = Array.from(sb.options).some(o => o.value === keep) ? keep : "";
}
/** 소분류를 고르면 그것이 딸린 대분류를 저절로 채운다.
    대분류를 비워 둔 채 전체 목록에서 골랐을 때를 위한 것이다. */
function syncBig(R) {
  const sb = $("#f_sub", R), bg = $("#f_big", R);
  if (!sb || !bg) return;
  const b = bigOf(sb.value);
  if (b && bg.value !== b) { bg.value = b; paintSubs(R); }
}
function optList(arr, sel) {
  return '<option value=""></option>' + (arr || []).map(v =>
    '<option value="' + esc(v) + '"' + (v === sel ? " selected" : "") + ">" + esc(v) + "</option>").join("");
}

function formHTML(v) {
  v = v || {};
  const M = S.meta || {};
  return '<div class="form">' +
    '<div class="grid2">' +
    '<div class="fl"><span>날짜<em>*</em></span><input type="date" id="f_date" value="' + esc(v.date || todayISO()) + '"></div>' +
    '<div class="fl"><span>금액<em>*</em></span><input class="money" id="f_amt" inputmode="numeric" placeholder="0" value="' + (v.amt || "") + '"></div>' +
    "</div>" +
    '<div class="grid2">' +
    '<div class="fl"><span>결제 시각</span><input type="time" id="f_time" value="' + esc(v.time || "") + '"></div>' +
    '<div class="fl"><span>할인</span><input id="f_disc" inputmode="numeric" placeholder="0" value="' + (v.disc || "") + '"></div>' +
    "</div>" +
    '<div class="fl" id="fl_discBy"><span>할인수단</span><input id="f_discBy" list="dl_discBy" autocomplete="off" ' +
    'placeholder="포인트나 쿠폰 이름 (예: 쿠팡 포인트, 상품권)" value="' + esc(v.discBy || "") + '">' +
    '<datalist id="dl_discBy">' + knownDiscBy().map(n => '<option value="' + esc(n) + '"></option>').join("") +
    "</datalist>" +
    '<span style="font-size:11px;color:var(--ink3)" id="f_realHint"></span></div>' +
    '<div class="grid2">' +
    '<div class="fl"><span>대분류</span><select id="f_big"><option value="">전체</option>' +
    bigList().map(b => '<option value="' + esc(b) + '"' + (b === (v.big || bigOf(v.sub)) ? " selected" : "") + ">" +
      esc(b) + "</option>").join("") + "</select></div>" +
    '<div class="fl" id="fl_sub"><span>소분류<em>*</em></span><select id="f_sub"><option value=""></option>' +
    subOptions(v.sub, v.big || bigOf(v.sub)) + "</select></div>" +
    "</div>" +
    '<div style="font-size:11px;color:var(--ink3);margin-top:-6px" id="f_bigHint"></div>' +
    '<div class="fl"><span>장소<em>*</em></span><input id="f_place" placeholder="어디서 썼나요" value="' + esc(v.place || "") + '"></div>' +
    '<div class="fl"><span>세부내역</span><input id="f_detail" placeholder="무엇을 샀나요" value="' + esc(v.detail || "") + '"></div>' +
    '<div class="grid2">' +
    '<div class="fl" id="fl_share"><span>누구 몫</span><select id="f_share">' + optList((M.shares || []).map(s => s.name), v.share || "내 몫 전부") + "</select></div>" +
    '<div class="fl"><span>결제수단</span><select id="f_pay">' + optList(M.pays, v.pay) + "</select></div>" +
    "</div>" +
    '<div class="grid2">' +
    '<div class="fl" id="fl_situ"><span>상황<i>끼니</i></span><select id="f_situ">' + optList(M.situs, v.situ) + "</select></div>" +
    '<div class="fl" id="fl_theme"><span>테마<i>맥락</i></span><select id="f_theme">' + optList(M.themes, v.theme) + "</select></div>" +
    "</div>" +
    '<div class="fl" id="fl_event"><span>건<i>어느 일</i></span>' +
    '<input id="f_event" list="dl_event" autocomplete="off" placeholder="통영 3박4일" value="' + esc(v.event || "") + '">' +
    '<datalist id="dl_event">' + eventNames().map(n => '<option value="' + esc(n) + '"></option>').join("") +
    "</datalist>" +
    '<span style="font-size:11px;color:var(--ink3)" id="f_evHint"></span></div>' +

    '<div class="grid2">' +
    '<div class="fl" id="fl_with"><span>동행</span><input id="f_with" list="dl_with" autocomplete="off" value="' +
    esc(v.with || "") + '">' +
    '<datalist id="dl_with">' + knownNames().map(n => '<option value="' + esc(n) + '"></option>').join("") +
    "</datalist></div>" +
    '<div class="fl"><span>메모</span><input id="f_memo" value="' + esc(v.memo || "") + '"></div>' +
    "</div>" +

    /* 대접은 9,064줄 중 337줄에서만 손을 탄다. 늘 펴 두면 96%의 입력에서 자리만 차지한다.
       걸리는 조건이면 저절로 펴지고, 아닐 때도 링크로 언제든 열 수 있다. 없애는 것이 아니라 접는 것이다. */
    '<div class="fold" id="fold_more">' +
    '<button type="button" class="foldbtn" id="moreBtn">대접과 일시성 적기</button>' +
    '<div class="foldbody" id="moreBody" hidden>' +
    '<div class="grid2">' +
    '<div class="fl" id="fl_treat"><span>대접<i>누구에게</i></span><select id="f_treat">' + optList(M.treats, v.treat) + "</select></div>" +
    '<div class="fl"><span>일시성</span><select id="f_once"><option value=""></option><option value="Y"' +
    (v.once === "Y" ? " selected" : "") + ">Y</option></select></div>" +
    "</div></div></div>" +
    '<div id="f_sugg"></div><div id="f_rules"></div></div>';
}

/* 지금 보고 있는 폼. 고치기 창이 열려 있으면 그 안을 본다.
   두 폼이 동시에 화면에 있을 수 있어서, 범위를 정해 두지 않으면 엉뚱한 칸을 읽는다. */
function fscope() {
  const md = $("#modal");
  return (md && !md.hidden) ? $("#modalBody") : $("#p-add");
}

function readForm() {
  const R = fscope();
  const g = id => { const n = $(id, R); return n ? n.value : ""; };
  const sub = g("#f_sub").trim();
  const m = (S.meta && S.meta.subs || []).find(s => s.sub === sub);
  return {
    date: g("#f_date"), amt: numOf(g("#f_amt")), sub,
    big: m ? m.big : "", kind: m ? m.kind : "지출",
    place: g("#f_place").trim(), detail: g("#f_detail").trim(),
    share: g("#f_share"), pay: g("#f_pay"), situ: g("#f_situ"),
    treat: g("#f_treat"), theme: g("#f_theme"), once: g("#f_once"), event: g("#f_event"),
    kind: (((S.meta && S.meta.subs) || []).find(x => x.sub === g("#f_sub")) || {}).kind || "지출",
    with: g("#f_with").trim(), memo: g("#f_memo").trim(),
    time: g("#f_time"), disc: numOf(g("#f_disc")), discBy: g("#f_discBy").trim(),
  };
}
function validate(v) {
  if (!v.date) return "날짜를 골라 주세요";
  if (!v.amt) return "금액을 넣어 주세요";
  if (!v.sub) return "소분류를 골라 주세요";
  if (!v.place) return "장소를 넣어 주세요";
  if (v.amt < 0 && v.disc) return "환불 줄에는 할인을 적지 않습니다";
  if (v.amt > 0 && v.disc && v.disc > v.amt) return "할인이 금액보다 큽니다";
  if (v.disc && !v.discBy) return "무엇으로 할인받았는지 [할인수단] 을 적어 주세요";
  const R = ruleCheck(v);
  if (R.errors.length) return R.errors[0].msg;
  return "";
}
function bindBigHint() {
  const R = fscope();
  const f = () => {
    const sub = $("#f_sub", R) ? $("#f_sub", R).value : "";
    const m = (S.meta && S.meta.subs || []).find(s => s.sub === sub);
    const bgv = $("#f_big", R) ? $("#f_big", R).value : "";
    const h = $("#f_bigHint", R);
    if (h) h.textContent = m ? m.big + " / " + m.kind
      : bgv ? bgv + " 아래 소분류만 보입니다"
        : "대분류를 고르면 소분류가 그 아래만 뜹니다. 비워 두면 전체에서 고르고, 고르면 대분류가 저절로 채워집니다";
    paintRules();
  };
  ["#f_situ", "#f_treat", "#f_theme", "#f_share", "#f_once", "#f_time"].forEach(id => {
    const n = $(id, R); if (n) n.onchange = f;
  });
  const ev = $("#f_event", R);
  if (ev) ev.oninput = f;
  const dt = $("#f_date", R);
  if (dt) dt.onchange = () => { autoEvent(R); f(); };
  const bg = $("#f_big", R);
  if (bg) bg.onchange = () => { paintSubs(R); f(); };
  const sb = $("#f_sub", R);
  if (sb) sb.onchange = () => { syncBig(R); f(); };
  ["#f_amt", "#f_disc"].forEach(id => { const n = $(id, R); if (n) n.oninput = paintReal; });
  const w = $("#f_with", R); if (w) w.oninput = paintRules;
  const mb = $("#moreBtn", R);
  if (mb) mb.onclick = () => {
    const body = $("#moreBody", R);
    body.hidden = !body.hidden;
    if (body.hidden) body.dataset.shut = "1"; else delete body.dataset.shut;
    paintFold(readForm());
  };
  const pl = $("#f_place", R);
  if (pl) pl.onchange = () => { runSuggest(true); paintRules(); };
  const am = $("#f_amt", R);
  if (am) am.onchange = () => runSuggest(false);
  f();
}

/** 할인을 뺀 실제 결제액을 칸 아래에 적어 준다. */
function paintReal() {
  const R = fscope();
  const el = $("#f_realHint", R);
  if (!el) return;
  const amt = numOf($("#f_amt", R) ? $("#f_amt", R).value : "");
  const disc = numOf($("#f_disc", R) ? $("#f_disc", R).value : "");
  if (amt < 0) {
    el.innerHTML = "금액이 음수입니다. <b>돌려받은 " + won(-amt) +
      "원</b>으로 잡히고 그만큼 지출에서 빠집니다. 할인 칸은 쓰지 않습니다.";
    return;
  }
  if (!disc) { el.textContent = ""; return; }
  const real = Math.max(0, amt - disc);
  el.innerHTML = "영수증 " + won(amt) + "원 중 " + won(disc) + "원을 할인받아 <b>실제 결제 " +
    won(real) + "원</b>입니다. 통계에는 실제 결제액이 들어갑니다.";
}

/** 지난 기록에서 배운 것을 칸에 채우고 한 줄로 알려 준다. */
function runSuggest(fill) {
  const R = fscope();
  const box = $("#f_sugg", R);
  if (!box) return;
  const place = $("#f_place", R) ? $("#f_place", R).value.trim() : "";
  const amt = numOf($("#f_amt", R) ? $("#f_amt", R).value : "");
  const time = $("#f_time", R) ? $("#f_time", R).value : "";
  const sub = $("#f_sub", R) ? $("#f_sub", R).value : "";
  const sg = suggestFor(place, amt);
  ADD.sugg = sg;
  box.innerHTML = suggestHTML(sg, { time, sub });
  if (fill) {
    const done = applySuggest(sg, R, { time, sub });
    if (done.length) { bindBigHint(); toast("지난 기록으로 채웠습니다: " + done.join(", ")); }
  }
  paintReal();
  paintRules();
}

/* ---------- 어느 칸이 왜 필수인지 칸 옆에 붙인다 ----------
   붉게 칠하는 것은 다 적고 나서의 일이다. 고르는 순간 무엇이 더 필요한지 알아야 한다. */
function paintDemands(v, chk) {
  const R = fscope();
  const want = ruleDemands(v);
  const bad = {};
  (chk.errors || []).forEach(e => { bad[e.field] = 1; });
  ["treat", "with", "event"].forEach(f => {
    const fl = $("#fl_" + f, R);
    if (!fl) return;
    const lab = fl.querySelector("span");
    if (!lab) return;
    let tag = lab.querySelector("b.req");
    if (want[f]) {
      if (!tag) { tag = document.createElement("b"); tag.className = "req"; lab.appendChild(tag); }
      tag.textContent = want[f] + "에 필수";
      tag.classList.toggle("miss", !!bad[f]);
    } else if (tag) tag.remove();
  });
  /* 접힌 칸 안에 필수가 생기면 단추에 표시한다. 접힌 채로는 안이 안 보인다 */
  const btn = $("#moreBtn", R), body = $("#moreBody", R);
  if (btn && body && body.hidden) {
    btn.textContent = want.treat ? "대접 필요 - 눌러서 펴기" : "대접과 일시성 적기";
    btn.classList.toggle("warn", !!want.treat);
  }
}

/* ---------- 건을 날짜로 짚어 준다 ----------
   이미 이름을 달아 둔 여행 기간 안의 날짜면 그 이름을 그대로 넣어 준다.
   여행 하루하루의 지출을 적을 때 이름을 스무 번 다시 치게 할 이유가 없다. */
function autoEvent(scope) {
  const R = scope || fscope();
  const ev = $("#f_event", R), dt = $("#f_date", R);
  if (!ev || !dt || ev.value.trim()) return;
  const hit = eventForDate(dt.value);
  if (hit) { ev.value = hit; ev.dataset.auto = "1"; }
}
function paintEventHint(v) {
  const R = fscope();
  const h = $("#f_evHint", R);
  if (!h) return;
  const nm = (v.event || "").trim();
  if (!nm) {
    h.textContent = v.theme === "여행"
      ? "여행 이름을 적으면 그 여행 하나만 따로 뜯어볼 수 있습니다. 예: 통영 3박4일"
      : "시작과 끝이 있는 일에 이름을 답니다. 안 적어도 됩니다";
    h.style.color = "var(--ink3)";
    return;
  }
  const st = eventStat(nm);
  const auto = $("#f_event", R) && $("#f_event", R).dataset.auto === "1";
  h.textContent = st
    ? (auto ? "날짜로 짚었습니다. " : "") + st.from + " ~ " + st.to +
      " / " + st.n + "건 / " + won(st.mine) + "원 / " + st.kind
    : "새 이름입니다. 이 줄부터 이 이름으로 묶입니다";
  h.style.color = st ? "var(--sky)" : "var(--gold)";
}

/* 대접 칸을 펴야 하는가. 규칙이 대접을 요구하거나, 이미 값이 있거나, 함께한 사람이 적혀 있으면 편다 */
function treatWanted(v) {
  if (v.treat) return true;
  if (v.sub === "용돈" || v.sub === "선물" || v.sub === "여행 선물") return true;
  if (v.theme === "데이트" || v.theme === "보은") return true;
  if (v.with && v.theme !== "소개팅") return true;
  return false;
}
/** 접힌 칸을 펴고 접는다. 사람이 손으로 편 뒤에는 다시 접지 않는다 */
function paintFold(v) {
  const R = fscope();
  const body = $("#moreBody", R), btn = $("#moreBtn", R);
  if (!body || !btn) return;
  const want = treatWanted(v) || $("#f_once", R) && $("#f_once", R).value;
  if (want && body.hidden && !body.dataset.shut) body.hidden = false;
  btn.textContent = body.hidden ? "대접과 일시성 적기" : "대접과 일시성 접기";
  btn.classList.toggle("on", !body.hidden);
}

/** 지금 걸리는 규칙을 폼 아래에 띄우고, 모자란 칸을 짚어 준다. */
function paintRules() {
  const R = fscope();
  /* 추천이나 후보가 소분류만 넣고 지나간 경우가 있다. 대분류 칸을 여기서 맞춰 둔다 */
  syncBig(R);
  const box = $("#f_rules", R);
  if (!box) return;
  const v = readForm();
  const chk = ruleCheck(v);

  /* 비어 있을 때만 채운다. 이미 적은 것을 덮지 않는다 */
  if (chk.fill) for (const k in chk.fill) {
    const n = $("#f_" + k, R);
    if (n && !n.value) n.value = chk.fill[k];
  }

  $$(".fl", R).forEach(x => x.classList.remove("need"));
  chk.errors.forEach(e => {
    const fl = $("#fl_" + e.field, R);
    if (fl) fl.classList.add("need");
    /* 접힌 칸이 모자라다고 하면 소용이 없다. 붉게 칠하기 전에 펴 준다 */
    if (e.field === "treat") { const b = $("#moreBody", R); if (b) { b.hidden = false; delete b.dataset.shut; } }
  });
  paintFold(v);
  paintEventHint(v);
  paintDemands(v, chk);

  let who = "";
  if ((v.theme === "소개팅" || v.theme === "데이트") && v.with) {
    const p = findPerson(v.with);
    who = p
      ? '<div class="rhint"><b>' + esc(p.kind) + "</b><span>" +
        esc(v.with) + " / " + esc([p.route, p.maker].filter(Boolean).join(" ") || "루트 미기재") +
        (p.first ? " / 첫 만남 " + esc(p.first) : "") + (p.n ? " / " + p.n + "번 만남" : "") +
        " (이력 시트에 있는 사람입니다)</span></div>"
      : '<div class="rhint bad"><b>새 이름</b><span>' + esc(v.with) + " 은 [" +
        (v.theme === "데이트" ? "연애 이력" : "소개팅 이력") + "] 시트에 없습니다. 주선자와 루트는 가계부가 아니라 그 시트에 사람당 한 번 적습니다. " +
        '<button class="btn sm" id="newPerson" style="margin-top:6px">이력에 더하기</button></span></div>';
  }

  if (!chk.hit.length && !who) { box.innerHTML = ""; return; }
  box.innerHTML = who + chk.hit.map(r => {
    const bad = chk.errors.find(e => e.key === r.key);
    return '<div class="rhint' + (bad ? " bad" : "") + '"><b>' + esc(r.title) + "</b>" +
      "<span>" + esc(bad ? bad.msg : r.how) + "</span></div>";
  }).join("");
  const np = $("#newPerson", R);
  if (np) np.onclick = () => openNewPerson(v.with, v.date, v.theme === "데이트" ? "love" : "intro");
}

/** 소개팅 이력에 사람을 더한다. 가계부 줄에는 이름만 남고, 루트와 주선자는 이력에 남는다. */
function openNewPerson(name, date, sheet) {
  const love = sheet === "love";
  const sn = love ? "연애 이력" : "소개팅 이력";
  openModal(
    '<h2 style="font-size:16px;margin-bottom:2px">' + sn + "에 더하기</h2>" +
    '<p style="font-size:11.5px;color:var(--ink3);margin:0 0 14px">' + esc(name) +
    " 을 [" + sn + "] 시트에 한 줄로 더합니다. 이 사람을 처음 적는 자리이니 아는 것을 다 채워 주세요. " +
    "지출 집계는 동행 이름으로 저절로 걸립니다. 모르는 칸은 <b>모름</b> 이라고 적으면 됩니다.</p>" +
    '<div class="form">' +
    '<div class="fl" id="npl_name"><span>이름<em>*</em></span><input id="np_name" value="' + esc(name) + '"></div>' +
    '<div class="grid2">' +
    '<div class="fl" id="npl_born"><span>년생<em>*</em></span><input id="np_born" inputmode="numeric" placeholder="1995"></div>' +
    '<div class="fl" id="npl_route"><span>' + (love ? "만남 루트" : "소개 루트") + '<em>*</em></span>' +
    '<select id="np_route"><option value=""></option>' +
    INTRO_ROUTES.map(x => "<option>" + esc(x) + "</option>").join("") + "</select></div>" +
    "</div>" +
    '<div class="fl" id="npl_maker"><span>주선자<em>*</em></span>' +
    '<input id="np_maker" list="dl_maker" autocomplete="off" placeholder="지인 이름이나 앱 이름 (예: 수철, 골드스푼, 틴더)">' +
    '<datalist id="dl_maker">' + knownMakers().map(n => '<option value="' + esc(n) + '"></option>').join("") + "</datalist></div>" +
    '<div class="fl" id="npl_job"><span>직업<em>*</em></span>' +
    '<input id="np_job" list="dl_job" autocomplete="off" placeholder="예: 간호사, 스타트업, 초등교사">' +
    '<datalist id="dl_job">' + knownJobs().map(n => '<option value="' + esc(n) + '"></option>').join("") + "</datalist></div>" +
    (love ? "" :
      '<div class="fl" id="npl_area"><span>지역</span>' +
      '<input id="np_area" list="dl_area" autocomplete="off" placeholder="예: 합정, 성수 (몰라도 됩니다)">' +
      '<datalist id="dl_area">' + knownAreas().map(n => '<option value="' + esc(n) + '"></option>').join("") + "</datalist></div>") +
    '<div class="fl"><span>' + (love ? "연애 시작일" : "첫 만남") + '</span><input id="np_date" type="date" value="' +
    esc(date || todayISO()) + '"></div>' +
    "</div>" +
    '<p class="foot">출처(구분 칸)에는 <b>' + esc(PERSON_SRC) + '</b> 이 자동으로 적힙니다. 이 앱에서 더한 줄이라는 표시입니다.</p>' +
    '<div style="display:flex;gap:8px;margin-top:16px">' +
    '<button class="btn" id="npSave">더하기</button>' +
    '<button class="btn ghost" id="npNo" style="max-width:96px">닫기</button></div>'
  );
  $("#npNo").onclick = () => closeModal(true);
  $("#npSave").onclick = async () => {
    const g = id => { const n = $(id); return n ? n.value.trim() : ""; };
    const need = [["npl_name", g("#np_name"), "이름"], ["npl_born", g("#np_born"), "년생"],
                  ["npl_route", g("#np_route"), "루트"], ["npl_maker", g("#np_maker"), "주선자"],
                  ["npl_job", g("#np_job"), "직업"]];
    $$(".fl", $("#modalBody")).forEach(x => x.classList.remove("need"));
    const bad = need.find(x => !x[1]);
    if (bad) { $("#" + bad[0]).classList.add("need"); return toast(bad[2] + "을 채워 주세요. 모르면 모름 이라고 적으세요"); }
    if (!await ensureAuth()) return;
    try {
      const j = await post("person", {
        token: AUTH.token, sheet: love ? "love" : "intro",
        name: g("#np_name"), born: g("#np_born"), route: g("#np_route"),
        maker: g("#np_maker"), job: g("#np_job"), area: g("#np_area"), date: g("#np_date"),
      });
      closeModal(true);
      toast(j.already ? "이미 있는 이름입니다" : "이력에 더했습니다");
      if (!j.already) {
        const box = love ? S.people.love : S.people.intro;
        box.push({ name: g("#np_name"), with: g("#np_name"), route: g("#np_route"),
                   maker: g("#np_maker"), job: g("#np_job"), area: g("#np_area"),
                   first: g("#np_date"), n: 0, mine: 0, cnt: 0 });
      }
      cacheDrop(); paintRules();
    } catch (e) { toast("실패: " + e.message); }
  };
}

function renderAdd() {
  const box = $("#p-add");
  box.innerHTML =
    '<div id="addClose"><button id="addBack">닫기</button></div>' +
    '<div class="card"><div class="sec"><h2>화면이나 글로 넣기</h2><span class="hint">읽어서 채워 줍니다</span></div>' +
    '<div class="mailbar"><div class="mt">구글 메일에서 찾기</div>' +
    '<div class="chips" id="mailChips">' +
    ((S.mailPresets && S.mailPresets.length ? S.mailPresets : [{ key: "all", name: "모두", hint: "" }])
      .map(p => '<button class="chip" data-mp="' + esc(p.key) + '" title="' + esc(p.hint || "") + '">' +
        esc(p.name) + "</button>").join("")) + "</div>" +
    '<div class="mhint" id="mailHint">누르면 그 갈래의 메일을 읽어 후보를 만듭니다. 시트에는 확인한 뒤에만 들어갑니다.</div></div>' +
    '<div class="drop" id="drop">카드사나 토스 알림 화면을 여기에 끌어다 놓거나 눌러서 고르세요' +
    '<div class="thumbs" id="thumbs"></div></div>' +
    '<input type="file" id="pick" accept="image/*" multiple hidden>' +
    '<div class="fl" style="margin-top:10px"><span>또는 문자를 붙여 넣기</span>' +
    '<textarea id="pasteBox" placeholder="신한카드(1234) 12,000원 일시불 08/12 14:20 스타벅스 상암DMC"></textarea></div>' +
    '<button class="btn" id="readBtn" style="margin-top:10px">읽어 오기</button>' +
    '<div id="cands" style="margin-top:12px"></div></div>' +

    '<div class="card"><div class="sec"><h2>직접 적기</h2><span class="hint">별표는 꼭 필요합니다</span></div>' +
    formHTML({}) +
    '<div id="qBar"></div>' +
    '<button class="btn" id="saveBtn" style="margin-top:14px">기록 더하기</button></div>' +
    guideHTML();

  $("#addBack").onclick = () => closeAdd();
  $$("[data-mp]").forEach(b => b.onclick = () => pullMail(b.dataset.mp, b));
  /* 탭을 떠났다 와도 후보와 그림은 그대로 남는다. 비우는 것은 [닫기] 로만 한다 */
  paintShots();
  paintCands();
  if (ADD.queue.length) nextInQueueBar();
  bindBigHint();
  $("#guideToggle").onclick = () => {
    const b = $("#guideBody"), t = $("#guideToggle");
    b.hidden = !b.hidden;
    t.textContent = b.hidden ? "펼치기" : "접기";
  };

  const drop = $("#drop"), pick = $("#pick");
  drop.onclick = () => pick.click();
  pick.onchange = e => addShots(e.target.files);
  ["dragenter", "dragover"].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add("hot"); }));
  ["dragleave", "drop"].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove("hot"); }));
  drop.addEventListener("drop", e => addShots(e.dataTransfer.files));
  document.onpaste = e => { if (S.tab === "add" && e.clipboardData && e.clipboardData.files.length) addShots(e.clipboardData.files); };

  $("#readBtn").onclick = doRead;
  $("#saveBtn").onclick = () => submitAdd();
}

/** 이미 같은 것이 있나 본다. 날짜와 금액이 같으면 의심한다. */
function dupOf(v) {
  return S.rows.filter(r => r.date === v.date && Math.abs(r.amt - v.amt) < 1);
}

/** 같은 것이 있을 때 무엇을 할지 묻는다. over(덮어쓰기) / add(그냥 더하기) / skip */
function askDup(v, hits) {
  return new Promise(resolve => {
    openModal(
      '<h2 style="font-size:16px;margin-bottom:2px">이미 있는 것 같습니다</h2>' +
      '<p style="font-size:11.5px;color:var(--ink3);margin:0 0 14px">' + esc(v.date) +
      " 에 " + won(v.amt) + "원짜리 기록이 " + hits.length + "건 있습니다.</p>" +
      '<div class="rows">' + hits.map(r =>
        '<div class="row hasic"><div class="ic" style="background:' + colorOf(r.big || "기타") + '22;color:' +
        colorOf(r.big || "기타") + '">' + (icon(r.big) || "") + "</div>" +
        '<div class="nm">' + esc(r.place || r.sub) + "</div>" +
        '<div class="amt">' + won(r.amt) + "</div>" +
        '<div class="meta"><span>no ' + r.no + "</span><span>" + esc(r.sub) + "</span>" +
        (r.detail ? "<span>" + esc(r.detail) + "</span>" : "") + "</div></div>").join("") + "</div>" +
      '<div style="height:14px"></div>' +
      '<div style="display:flex;flex-direction:column;gap:8px">' +
      (hits.length === 1
        ? '<button class="btn" id="duOver">위의 것을 지금 내용으로 고치기</button>' : "") +
      '<button class="btn ghost" id="duAdd">그래도 새로 더하기</button>' +
      '<button class="btn ghost" id="duSkip">이번 건은 건너뛰기</button></div>'
    );
    const done = x => { closeModal(true); resolve(x); };
    const o = $("#duOver"); if (o) o.onclick = () => done({ act: "over", no: hits[0].no });
    $("#duAdd").onclick = () => done({ act: "add" });
    $("#duSkip").onclick = () => done({ act: "skip" });
  });
}

async function submitAdd() {
  const v = readForm(), bad = validate(v);
  if (bad) return toast(bad);
  if (!await ensureAuth()) return;

  let mode = { act: "add" };
  const hits = dupOf(v);
  if (hits.length) mode = await askDup(v, hits);
  if (mode.act === "skip") {
    if (nextInQueue()) toast("건너뛰었습니다");
    else toast("건너뛰었습니다");
    return;
  }

  const b = $("#saveBtn");
  if (b) { b.disabled = true; b.textContent = "넣는 중"; }
  try {
    const j = (mode.act === "over")
      ? await post("update", { token: AUTH.token, no: mode.no, row: v })
      : await post("add", { token: AUTH.token, row: v });
    /* 9천 줄을 다시 받지 않는다. 방금 쓴 줄만 갈아 끼운다 */
    if (j.head && j.values) {
      if (mode.act === "over") patchUpdate(j.head, j.values, mode.no);
      else patchAdd(j.head, j.values);
    } else {
      await loadAll();
    }
    S.ym = ymOf(v.date);
    paintTabs(); renderAll();
    /* 방금 넣은 것과 같은 후보에 표시를 남긴다 */
    const hit = ADD.cands.find(c => !c.done && c.date === v.date && Math.abs((c.amt || 0) - v.amt) < 1);
    if (hit) hit.done = true;

    const more = nextInQueue();
    const left = ADD.cands.filter(c => !c.done).length;
    paintCands();
    if (more) {
      toast(mode.act === "over" ? "고쳤습니다. 다음 건입니다" : "적었습니다. 다음 건입니다");
    } else if (left) {
      /* 아직 손대지 않은 후보가 남아 있으면 목록을 잃지 않게 입력 화면에 머문다 */
      toast("적었습니다. 아직 " + left + "건 남아 있습니다");
      clearForm();
    } else {
      markMailDone();
      clearAddSession();
      toast(mode.act === "over" ? "고쳤습니다" : "적었습니다");
      /* 적은 달의 원장을 바로 보여 준다. 아직 오지 않은 달이면 화면에 없으니 그대로 둔다 */
      if (ymOf(v.date) <= ymOf(todayISO())) goTab("ledger");
      else toast("아직 오지 않은 달이라 그 달이 되면 나타납니다");
    }
  } catch (e) { toast("실패: " + e.message); }
  if (b) { b.disabled = false; b.textContent = "기록 더하기"; }
}

/** 칸을 비운다. 날짜는 그대로 둔다. */
function clearForm() {
  const R = fscope();
  ["#f_amt", "#f_place", "#f_detail", "#f_with", "#f_memo", "#f_time", "#f_disc", "#f_discBy"]
    .forEach(id => { const n = $(id, R); if (n) n.value = ""; });
  ["#f_big", "#f_sub", "#f_situ", "#f_treat", "#f_theme", "#f_once", "#f_event"]
    .forEach(id => { const n = $(id, R); if (n) n.value = ""; });
  paintSubs(R);
  const sh = $("#f_share", R); if (sh) sh.value = "내 몫 전부";
  const sg = $("#f_sugg", R); if (sg) sg.innerHTML = "";
  bindBigHint();
}

/** 입력 화면을 닫는다. 남은 것이 있으면 한 번 물어본다. */
function closeAdd() {
  const left = ADD.cands.filter(c => !c.done).length + ADD.shots.length;
  if (!left) { clearAddSession(); goTab(LASTTAB || "month"); return; }
  openModal(
    '<h2 style="font-size:16px;margin-bottom:2px">닫으면 지워집니다</h2>' +
    '<p style="font-size:12.5px;color:var(--ink2);margin:0 0 14px;line-height:1.6">' +
    "아직 넣지 않은 후보 <b>" + ADD.cands.filter(c => !c.done).length + "건</b>과 올린 그림 <b>" +
    ADD.shots.length + "장</b>이 남아 있습니다.</p>" +
    '<div style="display:flex;flex-direction:column;gap:8px">' +
    '<button class="btn ghost" id="caKeep">그대로 두고 나가기</button>' +
    '<button class="btn" id="caDrop">비우고 닫기</button>' +
    '<button class="btn ghost" id="caNo" >여기 머물기</button></div>'
  );
  $("#caNo").onclick = () => closeModal(true);
  $("#caKeep").onclick = () => { closeModal(true); goTab(LASTTAB || "month"); };
  $("#caDrop").onclick = () => { closeModal(true); clearAddSession(); goTab(LASTTAB || "month"); };
}

/** 진행 띠만 다시 그린다. */
function nextInQueueBar() {
  const box = $("#qBar");
  if (!box || !ADD.queue.length) return;
  const done = ADD.qTotal - ADD.queue.length;
  box.innerHTML = '<div class="qbar"><b>' + done + " / " + ADD.qTotal + "</b>" +
    "<span>차례로 넣는 중입니다. 소분류를 골라 저장하면 다음 건이 올라옵니다.</span>" +
    '<button class="btn sm ghost" id="qStop">그만</button></div>';
  const st = $("#qStop");
  if (st) st.onclick = () => { ADD.queue = []; ADD.qTotal = 0; $("#qBar").innerHTML = ""; paintCands(); toast("차례 넣기를 멈췄습니다"); };
}

/** 대기줄에서 하나 꺼내 칸을 채운다. */
function nextInQueue() {
  const box = $("#qBar");
  if (!ADD.queue.length) {
    if (box) box.innerHTML = "";
    ADD.qTotal = 0;
    return false;
  }
  const c = ADD.queue.shift();
  fillFromCand(c);
  const done = ADD.qTotal - ADD.queue.length;
  if (box) box.innerHTML =
    '<div class="qbar"><b>' + done + " / " + ADD.qTotal + "</b>" +
    "<span>차례로 넣는 중입니다. 소분류를 골라 저장하면 다음 건이 올라옵니다.</span>" +
    '<button class="btn sm ghost" id="qStop">그만</button></div>';
  const st = $("#qStop");
  if (st) st.onclick = () => { ADD.queue = []; ADD.qTotal = 0; $("#qBar").innerHTML = ""; toast("차례 넣기를 멈췄습니다"); };
  return true;
}

function fillFromCand(c) {
  const R = fscope();
  const set = (id, v) => { const n = $(id, R); if (n && v) n.value = v; };
  set("#f_date", c.date || todayISO());
  set("#f_time", c.time || "");
  set("#f_amt", c.amt || "");
  set("#f_place", c.place || "");
  set("#f_detail", c.detail || "");
  set("#f_disc", c.disc || "");
  set("#f_discBy", c.discBy || "");
  const sub = $("#f_sub", R), pay = $("#f_pay", R);
  if (sub) sub.value = (c.sub && (S.meta.subs || []).some(s => s.sub === c.sub)) ? c.sub : "";
  if (pay) pay.value = (c.pay && (S.meta.pays || []).includes(c.pay)) ? c.pay : "";
  bindBigHint();
  runSuggest(true);
  const amt = $("#f_amt", R);
  if (amt && amt.scrollIntoView) amt.scrollIntoView({ block: "center", behavior: "smooth" });
}

function prefillAdd(v) {
  const set = (id, val) => { const n = $(id); if (n && val != null) n.value = val; };
  set("#f_date", v.date); set("#f_amt", v.amt); set("#f_place", v.place);
  if (v.sub) { $("#f_sub").value = v.sub; }
  bindBigHint();
  $("#f_amt").focus();
}

/* ---------- 메일에서 영수증 긁어오기 ----------
   앱 결제 영수증처럼 메일로만 오는 것이 있다. 서버가 메일을 읽어 후보를 만들어 준다.
   시트에 넣는 것은 사람이 확인한 뒤에만 한다. */
async function pullMail(preset, btn) {
  if (!await ensureAuth()) return;
  const b = btn || null;
  const label = b ? b.textContent : "";
  if (b) { b.disabled = true; b.textContent = "읽는 중"; }
  const hint = $("#mailHint");
  if (hint) hint.textContent = "메일을 읽고 있습니다. 통수가 많으면 조금 걸립니다.";
  try {
    const j = await post("mail", { token: AUTH.token, days: 90, preset: preset || "all" });
    ADD.mailIds = j.ids || [];
    const items = (j.items || []).filter(x => x.amt);
    if (!items.length) {
      toast(j.n ? "메일 " + j.n + "통을 읽었지만 결제 건을 찾지 못했습니다" : "새 영수증 메일이 없습니다");
    } else {
      ADD.cands = items;
      paintCands();
      toast("메일 " + j.n + "통에서 " + items.length + "건을 찾았습니다");
    }
  } catch (e) { toast("실패: " + e.message); }
  if (b) { b.disabled = false; b.textContent = label; }
  if (hint) hint.textContent = "누르면 그 갈래의 메일을 읽어 후보를 만듭니다. 시트에는 확인한 뒤에만 들어갑니다.";
}

/** 다 넣은 뒤 그 메일에 이름표를 붙여 다시 안 걸리게 한다. */
async function markMailDone() {
  if (!ADD.mailIds || !ADD.mailIds.length) return;
  try {
    await post("mailDone", { token: AUTH.token, ids: ADD.mailIds });
    ADD.mailIds = [];
  } catch (e) { }
}

async function addShots(files) {
  for (const f of Array.from(files || [])) {
    if (!f.type.startsWith("image/")) continue;
    if (ADD.shots.length >= 4) { toast("한 번에 넉 장까지"); break; }
    const b64 = await shrink(f, 1300);
    ADD.shots.push(b64);
  }
  paintShots();
}

function paintShots() {
  const box = $("#thumbs");
  if (!box) return;
  box.innerHTML = ADD.shots.map((b, i) =>
    '<div class="th"><img src="data:image/jpeg;base64,' + b + '">' +
    '<button class="x" data-s="' + i + '" title="지우기">지움</button></div>').join("") +
    (ADD.shots.length > 1 ? '<button class="btn sm ghost" id="shotClear">모두 지우기</button>' : "");
  $$("[data-s]", box).forEach(b => b.onclick = e => {
    e.stopPropagation();
    ADD.shots.splice(+b.dataset.s, 1);
    paintShots();
  });
  const c = $("#shotClear");
  if (c) c.onclick = e => { e.stopPropagation(); ADD.shots = []; paintShots(); };
}
function shrink(file, max) {
  return new Promise(res => {
    const img = new Image(), fr = new FileReader();
    fr.onload = () => { img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      res(c.toDataURL("image/jpeg", .82).split(",")[1]);
    }; img.src = fr.result; };
    fr.readAsDataURL(file);
  });
}

async function doRead() {
  const text = $("#pasteBox").value.trim();
  if (!text && !ADD.shots.length) return toast("화면이나 글을 먼저 넣어 주세요");
  const b = $("#readBtn"); b.disabled = true; b.textContent = "읽는 중";
  try {
    const j = await post("parse", { text, shots: ADD.shots, today: todayISO() });
    ADD.cands = j.items || [];
    paintCands();
    if (!ADD.cands.length) toast("찾지 못했습니다. 직접 적어 주세요");
  } catch (e) { toast("읽기 실패: " + e.message); }
  b.disabled = false; b.textContent = "읽어 오기";
}

function paintCands() {
  const box = $("#cands");
  if (!box) return;
  if (!ADD.cands.length) { box.innerHTML = ""; return; }
  /* 같은 날이면 이른 시각이 먼저 오게. 시트에서도 그 차례로 쌓인다 */
  ADD.cands.sort((x, y) => {
    const a1 = (x.date || "") + " " + (x.time || "99:99");
    const b1 = (y.date || "") + " " + (y.time || "99:99");
    return a1 < b1 ? -1 : a1 > b1 ? 1 : 0;
  });
  const left = ADD.cands.filter(c => !c.done).length;
  box.innerHTML = '<div class="sec"><h2 style="font-size:13px">찾은 것 ' + ADD.cands.length + "건</h2>" +
    '<span class="hint">' + (left < ADD.cands.length ? "넣은 것 " + (ADD.cands.length - left) + "건 / 남은 것 " + left + "건"
      : left > 1 ? "이른 시각부터 차례로" : "고르면 아래 칸이 채워집니다") + "</span></div>" +
    (left > 1 ? '<button class="btn ghost" id="qAll" style="margin-bottom:10px">남은 ' + left +
      "건 차례로 넣기</button>" : "") +
    ADD.cands.map(function (c, i) {
      const dup = c.done ? null : dupOf({ date: c.date, amt: c.amt });
      const flag = c.done
        ? '<span class="cflag done">넣었음</span>'
        : (dup && dup.length ? '<span class="cflag dup">중복 의심</span>' : "");
      return '<div class="cand' + (c.done ? " off" : "") + '"><div class="t"><b>' + esc(c.place || "장소 모름") +
        "</b>" + flag + '<span class="amt">' + won(c.amt) + "원</span></div>" +
        '<div class="m">' + [c.date, c.time, c.pay, c.sub, c.detail, c.src].filter(Boolean).map(esc).join(" / ") + "</div>" +
        (dup && dup.length
          ? '<div class="m" style="color:var(--warn)">같은 날 같은 금액이 이미 ' + dup.length + "건 있습니다. (" +
            esc(dup.slice(0, 2).map(r => r.place || r.sub).join(", ")) + ")</div>"
          : "") +
        '<div class="act">' +
        (c.done ? "" : '<button class="btn sm" data-i="' + i + '">이 내용으로 채우기</button>') +
        '<button class="btn sm ghost" data-x="' + i + '">제외</button></div></div>';
    }).join("") +
    '<button class="btn ghost sm" id="candClear" style="width:100%;margin-top:8px">목록 비우기</button>';

  const qa = $("#qAll", box);
  if (qa) qa.onclick = () => {
    ADD.queue = ADD.cands.filter(c => !c.done);
    ADD.qTotal = ADD.queue.length;
    nextInQueue();
  };
  $$("[data-i]", box).forEach(b => b.onclick = () => {
    const c = ADD.cands[+b.dataset.i];
    ADD.queue = []; ADD.qTotal = 0;
    const q = $("#qBar"); if (q) q.innerHTML = "";
    fillFromCand(c);
    $("#f_place").scrollIntoView({ behavior: "smooth", block: "center" });
    toast("채웠습니다. 남은 칸을 확인해 주세요");
  });
  $$("[data-x]", box).forEach(b => b.onclick = () => {
    const c = ADD.cands[+b.dataset.x];
    ADD.cands.splice(+b.dataset.x, 1);
    ADD.queue = ADD.queue.filter(q => q !== c);
    ADD.qTotal = ADD.queue.length ? ADD.qTotal : 0;
    paintCands();
    toast("목록에서 뺐습니다");
  });
  const cc = $("#candClear", box);
  if (cc) cc.onclick = () => { clearAddSession(); toast("목록을 비웠습니다"); };
}

/** 후보와 그림을 한꺼번에 비운다. */
function clearAddSession() {
  ADD.cands = []; ADD.queue = []; ADD.qTotal = 0; ADD.shots = []; ADD.mailIds = [];
  paintCands(); paintShots();
  const q = $("#qBar"); if (q) q.innerHTML = "";
}

/* ---------- 고치기 ---------- */
function openEdit(r) {
  openModal(
    '<h2 style="font-size:16px;margin-bottom:2px">기록 고치기</h2>' +
    '<p style="font-size:11.5px;color:var(--ink3);margin:0 0 14px">no ' + r.no + " / " + esc(r.date) +
    (r.검수 ? ' <span style="color:var(--warn);font-weight:700">' + esc(r.검수) + "</span>" : "") + "</p>" +
    /* 시각, 할인, 할인수단을 빼먹으면 고칠 때마다 그 세 칸이 지워진다.
       칸이 없던 시절에 만든 목록이라 그동안 드러나지 않았다 */
    formHTML({
      date: r.date, amt: r.amt, sub: r.sub, place: r.place, detail: r.detail, share: r.share,
      pay: r.pay, situ: r.situ, treat: r.treat, theme: r.theme, once: r.once, with: r.with, memo: r.memo,
      time: r.time, disc: r.disc, discBy: r.discBy, event: r.event,
    }) +
    '<div style="display:flex;gap:8px;margin-top:16px">' +
    '<button class="btn" id="edSave">고치기</button>' +
    '<button class="btn ghost" id="edRefund">환불 적기</button></div>' +
    '<div style="display:flex;gap:8px;margin-top:8px">' +
    '<button class="btn ghost sm" id="edDel" style="width:100%">이 줄 지우기</button></div>' +
    '<p class="foot" style="margin:10px 0 0">돌려받은 돈은 <b>환불 적기</b> 로 새 줄을 만듭니다. ' +
    "이 줄의 금액을 손으로 낮추지 마세요. 원본이 사라지고 카드 명세서와 어긋납니다. " +
    "<b>이 줄 지우기</b> 는 애초에 잘못 적은 줄에만 씁니다.</p>"
  );
  bindBigHint();
  $("#edSave").onclick = async () => {
    const v = readForm(); const bad = validate(v);
    if (bad) return toast(bad);
    if (!await ensureAuth()) return;
    try {
      const j = await post("update", { token: AUTH.token, no: r.no, row: v });
      closeModal(true); toast("고쳤습니다");
      if (j.head && j.values) patchUpdate(j.head, j.values, r.no); else await loadAll();
      paintTabs(); renderAll();
    }
    catch (e) { toast("실패: " + e.message); }
  };
  /* confirm 창은 무엇을 지우는지 보여 주지 못한다. 그 줄을 한 번 더 보여 주는 창으로 옮겼다 */
  $("#edDel").onclick = () => openDelete(r);
  $("#edRefund").onclick = () => openRefund(r);
}
