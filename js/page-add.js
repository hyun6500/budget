/* ===== js/page-add.js ===== */
/* page-add.js - 기록 더하기.
   손으로 적어도 되고, 카드사나 토스 알림 화면을 올리거나 글을 붙여 넣어도 된다. */
FILEV.add = CONFIG.APP_VERSION;

const ADD = { shots: [], cands: [] };

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
    '<div class="fl"><span>소분류<em>*</em></span><select id="f_sub"><option value=""></option>' + subOptions(v.sub) + "</select>" +
    '<span style="font-size:11px;color:var(--ink3)" id="f_bigHint"></span></div>' +
    '<div class="fl"><span>장소<em>*</em></span><input id="f_place" placeholder="어디서 썼나요" value="' + esc(v.place || "") + '"></div>' +
    '<div class="fl"><span>세부내역</span><input id="f_detail" placeholder="무엇을 샀나요" value="' + esc(v.detail || "") + '"></div>' +
    '<div class="grid2">' +
    '<div class="fl"><span>누구 몫</span><select id="f_share">' + optList((M.shares || []).map(s => s.name), v.share || "내 몫 전부") + "</select></div>" +
    '<div class="fl"><span>결제수단</span><select id="f_pay">' + optList(M.pays, v.pay) + "</select></div>" +
    "</div>" +
    '<div class="grid2">' +
    '<div class="fl"><span>상황</span><select id="f_situ">' + optList(M.situs, v.situ) + "</select></div>" +
    '<div class="fl"><span>대접</span><select id="f_treat">' + optList(M.treats, v.treat) + "</select></div>" +
    "</div>" +
    '<div class="grid2">' +
    '<div class="fl"><span>테마</span><select id="f_theme">' + optList(M.themes, v.theme) + "</select></div>" +
    '<div class="fl"><span>일시성</span><select id="f_once"><option value=""></option><option value="Y"' + (v.once === "Y" ? " selected" : "") + ">Y</option></select></div>" +
    "</div>" +
    '<div class="grid2">' +
    '<div class="fl"><span>동행</span><input id="f_with" value="' + esc(v.with || "") + '"></div>' +
    '<div class="fl"><span>메모</span><input id="f_memo" value="' + esc(v.memo || "") + '"></div>' +
    "</div></div>";
}

function readForm() {
  const sub = $("#f_sub").value.trim();
  const m = (S.meta && S.meta.subs || []).find(s => s.sub === sub);
  return {
    date: $("#f_date").value, amt: numOf($("#f_amt").value), sub,
    big: m ? m.big : "", kind: m ? m.kind : "지출",
    place: $("#f_place").value.trim(), detail: $("#f_detail").value.trim(),
    share: $("#f_share").value, pay: $("#f_pay").value, situ: $("#f_situ").value,
    treat: $("#f_treat").value, theme: $("#f_theme").value, once: $("#f_once").value,
    with: $("#f_with").value.trim(), memo: $("#f_memo").value.trim(),
  };
}
function validate(v) {
  if (!v.date) return "날짜를 골라 주세요";
  if (!v.amt) return "금액을 넣어 주세요";
  if (!v.sub) return "소분류를 골라 주세요";
  if (!v.place) return "장소를 넣어 주세요";
  return "";
}
function bindBigHint() {
  const f = () => {
    const m = (S.meta && S.meta.subs || []).find(s => s.sub === $("#f_sub").value);
    $("#f_bigHint").textContent = m ? m.big + " / " + m.kind : "";
  };
  $("#f_sub").onchange = f; f();
}

function renderAdd() {
  const box = $("#p-add");
  box.innerHTML =
    '<div class="card"><div class="sec"><h2>화면이나 글로 넣기</h2><span class="hint">읽어서 채워 줍니다</span></div>' +
    '<div class="drop" id="drop">카드사나 토스 알림 화면을 여기에 끌어다 놓거나 눌러서 고르세요' +
    '<div class="thumbs" id="thumbs"></div></div>' +
    '<input type="file" id="pick" accept="image/*" multiple hidden>' +
    '<div class="fl" style="margin-top:10px"><span>또는 문자를 붙여 넣기</span>' +
    '<textarea id="pasteBox" placeholder="신한카드(1234) 12,000원 일시불 08/12 14:20 스타벅스 상암DMC"></textarea></div>' +
    '<button class="btn" id="readBtn" style="margin-top:10px">읽어 오기</button>' +
    '<div id="cands" style="margin-top:12px"></div></div>' +

    '<div class="card"><div class="sec"><h2>직접 적기</h2><span class="hint">별표는 꼭 필요합니다</span></div>' +
    formHTML({}) +
    '<button class="btn" id="saveBtn" style="margin-top:14px">기록 더하기</button></div>';

  bindBigHint();

  const drop = $("#drop"), pick = $("#pick");
  drop.onclick = () => pick.click();
  pick.onchange = e => addShots(e.target.files);
  ["dragenter", "dragover"].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add("hot"); }));
  ["dragleave", "drop"].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove("hot"); }));
  drop.addEventListener("drop", e => addShots(e.dataTransfer.files));
  document.onpaste = e => { if (S.tab === "add" && e.clipboardData && e.clipboardData.files.length) addShots(e.clipboardData.files); };

  $("#readBtn").onclick = doRead;
  $("#saveBtn").onclick = async () => {
    const v = readForm(); const bad = validate(v);
    if (bad) return toast(bad);
    if (!await ensureAuth()) return;
    const b = $("#saveBtn"); b.disabled = true; b.textContent = "넣는 중";
    try {
      await post("add", { token: AUTH.token, row: v });
      toast("적었습니다");
      await loadAll(); S.ym = ymOf(v.date); paintTabs(); renderAll();
      goTab("month");
    } catch (e) { toast("실패: " + e.message); }
    b.disabled = false; b.textContent = "기록 더하기";
  };
}

function prefillAdd(v) {
  const set = (id, val) => { const n = $(id); if (n && val != null) n.value = val; };
  set("#f_date", v.date); set("#f_amt", v.amt); set("#f_place", v.place);
  if (v.sub) { $("#f_sub").value = v.sub; }
  bindBigHint();
  $("#f_amt").focus();
}

async function addShots(files) {
  for (const f of Array.from(files || [])) {
    if (!f.type.startsWith("image/")) continue;
    if (ADD.shots.length >= 4) { toast("한 번에 넉 장까지"); break; }
    const b64 = await shrink(f, 1300);
    ADD.shots.push(b64);
  }
  $("#thumbs").innerHTML = ADD.shots.map(b => '<img src="data:image/jpeg;base64,' + b + '">').join("");
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
  box.innerHTML = '<div class="sec"><h2 style="font-size:13px">찾은 것 ' + ADD.cands.length + "건</h2>" +
    '<span class="hint">고르면 아래 칸이 채워집니다</span></div>' +
    ADD.cands.map(function (c, i) {
      return '<div class="cand"><div class="t"><b>' + esc(c.place || "장소 모름") +
        '</b><span class="amt">' + won(c.amt) + "원</span></div>" +
        '<div class="m">' + [c.date, c.pay, c.sub, c.detail].filter(Boolean).map(esc).join(" / ") + "</div>" +
        '<div class="act"><button class="btn sm" data-i="' + i + '">이 내용으로 채우기</button></div></div>';
    }).join("");
  $$("[data-i]", box).forEach(b => b.onclick = () => {
    const c = ADD.cands[+b.dataset.i];
    const set = (id, v) => { const n = $(id); if (n && v) n.value = v; };
    set("#f_date", c.date || todayISO()); set("#f_amt", c.amt || "");
    set("#f_place", c.place || ""); set("#f_detail", c.detail || "");
    if (c.sub && (S.meta.subs || []).some(s => s.sub === c.sub)) $("#f_sub").value = c.sub;
    if (c.pay && (S.meta.pays || []).includes(c.pay)) $("#f_pay").value = c.pay;
    bindBigHint();
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
    try { await post("update", { token: AUTH.token, no: r.no, row: v }); closeModal(true); toast("고쳤습니다"); await loadAll(); renderAll(); }
    catch (e) { toast("실패: " + e.message); }
  };
  $("#edDel").onclick = async () => {
    if (!confirm("이 줄을 지웁니다. 되돌릴 수 없습니다.")) return;
    if (!await ensureAuth()) return;
    try { await post("del", { token: AUTH.token, no: r.no }); closeModal(true); toast("지웠습니다"); await loadAll(); renderAll(); }
    catch (e) { toast("실패: " + e.message); }
  };
}
