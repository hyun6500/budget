/* ===== js/page-add.js ===== */
/* page-add.js - 기록 더하기.
   손으로 적어도 되고, 카드사나 토스 알림 화면을 올리거나 글을 붙여 넣어도 된다. */
FILEV.add = CONFIG.APP_VERSION;

const ADD = { shots: [], cands: [], queue: [], qTotal: 0, sugg: null, mailIds: [] };

function subOptions(sel) {
  const list = (S.meta && S.meta.subs) || [];
  return list.map(s => '<option value="' + esc(s.sub) + '"' + (s.sub === sel ? " selected" : "") + ">" +
    esc(s.sub) + " (" + esc(s.big) + ")</option>").join("");
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
    '<div class="fl" id="fl_sub"><span>소분류<em>*</em></span><select id="f_sub"><option value=""></option>' + subOptions(v.sub) + "</select>" +
    '<span style="font-size:11px;color:var(--ink3)" id="f_bigHint"></span></div>' +
    '<div class="fl"><span>장소<em>*</em></span><input id="f_place" placeholder="어디서 썼나요" value="' + esc(v.place || "") + '"></div>' +
    '<div class="fl"><span>세부내역</span><input id="f_detail" placeholder="무엇을 샀나요" value="' + esc(v.detail || "") + '"></div>' +
    '<div class="grid2">' +
    '<div class="fl" id="fl_share"><span>누구 몫</span><select id="f_share">' + optList((M.shares || []).map(s => s.name), v.share || "내 몫 전부") + "</select></div>" +
    '<div class="fl"><span>결제수단</span><select id="f_pay">' + optList(M.pays, v.pay) + "</select></div>" +
    "</div>" +
    '<div class="grid2">' +
    '<div class="fl" id="fl_situ"><span>상황</span><select id="f_situ">' + optList(M.situs, v.situ) + "</select></div>" +
    '<div class="fl" id="fl_treat"><span>대접</span><select id="f_treat">' + optList(M.treats, v.treat) + "</select></div>" +
    "</div>" +
    '<div class="grid2">' +
    '<div class="fl" id="fl_theme"><span>테마</span><select id="f_theme">' + optList(M.themes, v.theme) + "</select></div>" +
    '<div class="fl"><span>일시성</span><select id="f_once"><option value=""></option><option value="Y"' + (v.once === "Y" ? " selected" : "") + ">Y</option></select></div>" +
    "</div>" +
    '<div class="grid2">' +
    '<div class="fl" id="fl_with"><span>동행</span><input id="f_with" list="dl_with" autocomplete="off" value="' +
    esc(v.with || "") + '">' +
    '<datalist id="dl_with">' + knownNames().map(n => '<option value="' + esc(n) + '"></option>').join("") +
    "</datalist></div>" +
    '<div class="fl"><span>메모</span><input id="f_memo" value="' + esc(v.memo || "") + '"></div>' +
    "</div>" +
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
    treat: g("#f_treat"), theme: g("#f_theme"), once: g("#f_once"),
    with: g("#f_with").trim(), memo: g("#f_memo").trim(),
  };
}
function validate(v) {
  if (!v.date) return "날짜를 골라 주세요";
  if (!v.amt) return "금액을 넣어 주세요";
  if (!v.sub) return "소분류를 골라 주세요";
  if (!v.place) return "장소를 넣어 주세요";
  const R = ruleCheck(v);
  if (R.errors.length) return R.errors[0].msg;
  return "";
}
function bindBigHint() {
  const R = fscope();
  const f = () => {
    const sub = $("#f_sub", R) ? $("#f_sub", R).value : "";
    const m = (S.meta && S.meta.subs || []).find(s => s.sub === sub);
    const h = $("#f_bigHint", R);
    if (h) h.textContent = m ? m.big + " / " + m.kind : "";
    paintRules();
  };
  ["#f_sub", "#f_situ", "#f_treat", "#f_theme", "#f_share", "#f_once"].forEach(id => {
    const n = $(id, R); if (n) n.onchange = f;
  });
  const w = $("#f_with", R); if (w) w.oninput = paintRules;
  const pl = $("#f_place", R);
  if (pl) pl.onchange = () => { runSuggest(true); paintRules(); };
  const am = $("#f_amt", R);
  if (am) am.onchange = () => runSuggest(false);
  f();
}

/** 지난 기록에서 배운 것을 칸에 채우고 한 줄로 알려 준다. */
function runSuggest(fill) {
  const R = fscope();
  const box = $("#f_sugg", R);
  if (!box) return;
  const place = $("#f_place", R) ? $("#f_place", R).value.trim() : "";
  const amt = numOf($("#f_amt", R) ? $("#f_amt", R).value : "");
  const sg = suggestFor(place, amt);
  ADD.sugg = sg;
  box.innerHTML = suggestHTML(sg);
  if (fill && sg) {
    const done = applySuggest(sg, R);
    if (done.length) { bindBigHint(); toast("지난 기록으로 채웠습니다: " + done.join(", ")); }
  }
  paintRules();
}

/** 지금 걸리는 규칙을 폼 아래에 띄우고, 모자란 칸을 짚어 준다. */
function paintRules() {
  const R = fscope();
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
  chk.errors.forEach(e => { const fl = $("#fl_" + e.field, R); if (fl) fl.classList.add("need"); });

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
    '<button class="btn ghost" id="mailBtn" style="margin-bottom:10px">구글 메일에서 영수증 찾기</button>' +
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

  $("#addBack").onclick = () => goTab(LASTTAB || "month");
  $("#mailBtn").onclick = () => pullMail();
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
    const more = nextInQueue();
    if (!more) markMailDone();
    if (more) {
      toast(mode.act === "over" ? "고쳤습니다. 다음 건입니다" : "적었습니다. 다음 건입니다");
    } else {
      toast(mode.act === "over" ? "고쳤습니다" : "적었습니다");
      /* 적은 달의 원장을 바로 보여 준다. 아직 오지 않은 달이면 화면에 없으니 그대로 둔다 */
      if (v.date <= todayISO() || ymOf(v.date) <= ymOf(todayISO())) goTab("ledger");
      else toast("아직 오지 않은 달이라 그 달이 되면 나타납니다");
    }
  } catch (e) { toast("실패: " + e.message); }
  if (b) { b.disabled = false; b.textContent = "기록 더하기"; }
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
  set("#f_amt", c.amt || "");
  set("#f_place", c.place || "");
  set("#f_detail", c.detail || "");
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
async function pullMail(days) {
  if (!await ensureAuth()) return;
  const b = $("#mailBtn");
  if (b) { b.disabled = true; b.textContent = "메일을 읽는 중"; }
  try {
    const j = await post("mail", { token: AUTH.token, days: days || 30 });
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
  if (b) { b.disabled = false; b.textContent = "구글 메일에서 영수증 찾기"; }
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
  if (!ADD.cands.length) { box.innerHTML = ""; return; }
  /* 같은 날이면 이른 시각이 먼저 오게. 시트에서도 그 차례로 쌓인다 */
  ADD.cands.sort((x, y) => {
    const a1 = (x.date || "") + " " + (x.time || "99:99");
    const b1 = (y.date || "") + " " + (y.time || "99:99");
    return a1 < b1 ? -1 : a1 > b1 ? 1 : 0;
  });
  box.innerHTML = '<div class="sec"><h2 style="font-size:13px">찾은 것 ' + ADD.cands.length + "건</h2>" +
    '<span class="hint">' + (ADD.cands.length > 1 ? "이른 시각부터 차례로" : "고르면 아래 칸이 채워집니다") + "</span></div>" +
    (ADD.cands.length > 1
      ? '<button class="btn ghost" id="qAll" style="margin-bottom:10px">' + ADD.cands.length +
        "건 차례로 넣기</button>" : "") +
    ADD.cands.map(function (c, i) {
      return '<div class="cand"><div class="t"><b>' + esc(c.place || "장소 모름") +
        '</b><span class="amt">' + won(c.amt) + "원</span></div>" +
        '<div class="m">' + [c.date, c.time, c.pay, c.sub, c.detail, c.src].filter(Boolean).map(esc).join(" / ") + "</div>" +
        '<div class="act"><button class="btn sm" data-i="' + i + '">이 내용으로 채우기</button></div></div>';
    }).join("");
  const qa = $("#qAll", box);
  if (qa) qa.onclick = () => {
    ADD.queue = ADD.cands.slice();
    ADD.qTotal = ADD.queue.length;
    nextInQueue();
  };
  $$("[data-i]", box).forEach(b => b.onclick = () => {
    const c = ADD.cands[+b.dataset.i];
    fillFromCand(c);
    $("#f_place").scrollIntoView({ behavior: "smooth", block: "center" });
    toast("채웠습니다. 남은 칸을 확인해 주세요");
  });
}

/* ---------- 고치기 ---------- */
function openEdit(r) {
  openModal(
    '<h2 style="font-size:16px;margin-bottom:2px">기록 고치기</h2>' +
    '<p style="font-size:11.5px;color:var(--ink3);margin:0 0 14px">no ' + r.no + " / " + esc(r.date) +
    (r.검수 ? ' <span style="color:var(--warn);font-weight:700">' + esc(r.검수) + "</span>" : "") + "</p>" +
    formHTML({
      date: r.date, amt: r.amt, sub: r.sub, place: r.place, detail: r.detail, share: r.share,
      pay: r.pay, situ: r.situ, treat: r.treat, theme: r.theme, once: r.once, with: r.with, memo: r.memo,
    }) +
    '<div style="display:flex;gap:8px;margin-top:16px">' +
    '<button class="btn" id="edSave">고치기</button>' +
    '<button class="btn ghost" id="edDel" style="max-width:96px">지우기</button></div>'
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
  $("#edDel").onclick = async () => {
    if (!confirm("이 줄을 지웁니다. 되돌릴 수 없습니다.")) return;
    if (!await ensureAuth()) return;
    try {
      await post("del", { token: AUTH.token, no: r.no });
      closeModal(true); toast("지웠습니다");
      patchDel(r.no); paintTabs(); renderAll();
    }
    catch (e) { toast("실패: " + e.message); }
  };
}
