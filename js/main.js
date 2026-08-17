/* ===== js/main.js ===== */
/* main.js - 켜기, 탭 옮기기, 달 고르기, 가리기와 밤 모드. */
FILEV.main = CONFIG.APP_VERSION;

const RENDER = { month: renderMonth, ledger: renderLedger, spend: renderSpend, asset: renderAsset, hall: renderHall, add: renderAdd };
const TITLE = { month: "이번 달", ledger: "원장", spend: "소비", asset: "자산", hall: "기록실", add: "입력" };
const DIRTY = { month: 1, ledger: 1, spend: 1, asset: 1, hall: 1, add: 1 };
const TABS = ["month", "ledger", "spend", "asset", "hall", "add"];

function goTab(t) {
  S.tab = t;
  $$("#tabbar button").forEach(b => b.classList.toggle("on", b.dataset.tab === t));
  TABS.forEach(k => { $("#p-" + k).hidden = k !== t; });
  $("#topTitle").textContent = TITLE[t];
  /* 달 탭 줄은 달을 고르는 화면에서만 */
  $("#tabstrip").hidden = !(t === "month" || t === "ledger" || (t === "spend" && SP.seg === "book"));
  $("#fab").hidden = (t === "add");
  if (DIRTY[t]) { RENDER[t](); DIRTY[t] = 0; }
  decorate($("#p-" + t));
  window.scrollTo({ top: 0, behavior: "instant" });
}
function renderAll() { Object.keys(DIRTY).forEach(k => DIRTY[k] = 1); RENDER[S.tab](); DIRTY[S.tab] = 0; decorate($("#p-" + S.tab)); }

/* 달 탭 줄 */
function paintTabs() {
  const strip = $("#tabstrip");
  const months = Array.from(new Set(S.rows.map(r => r.ym))).filter(Boolean).sort();
  if (!months.includes(S.ym)) { months.push(S.ym); months.sort(); }
  const maxOut = Math.max(1, ...months.map(m => monthStat(m).out));
  strip.innerHTML = months.map(m => {
    const st = monthStat(m);
    return '<button class="mtab' + (m === S.ym ? " on" : "") + '" data-ym="' + m + '">' + ymLabel(m) +
      '<i class="dot" style="width:100%;transform:scaleX(' + Math.max(.08, st.out / maxOut).toFixed(2) + ');transform-origin:left"></i></button>';
  }).join("");
  $$(".mtab", strip).forEach(b => b.onclick = () => {
    S.ym = b.dataset.ym; paintTabs();
    DIRTY.month = DIRTY.ledger = DIRTY.spend = DIRTY.hall = 1;
    RENDER[S.tab](); DIRTY[S.tab] = 0;
  });
  const on = $(".mtab.on", strip);
  if (on && on.scrollIntoView) on.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
}

function stamp() {
  const n = Object.keys(FILEV).length;
  const bad = Object.values(FILEV).some(v => v !== CONFIG.APP_VERSION);
  let s = CONFIG.APP_VERSION + " (" + n + "/" + n + ")";
  if (S.rows.length) s += " 가계부 " + won(S.rows.length) + "줄";
  if (A.data) s += " 자산 " + esc(A.data.asOf || "");
  if (bad) s += ' <span class="bad">구버전 파일이 섞였습니다</span>';
  if (S.server && S.server !== CONFIG.SERVER_EXPECTED)
    s += ' <span class="bad">서버 ' + esc(S.server) + " 불일치, Code.gs 를 새 버전으로 다시 배포하세요</span>";
  $("#stamp").innerHTML = s;
}

/* 가리기와 밤 모드는 이 기기에만 남는다 */
function loadPrefs() {
  try {
    if (localStorage.getItem("jh_hush") === "1") document.body.classList.add("hush");
    if (localStorage.getItem("jh_day") === "1") document.body.classList.add("day");
  } catch (e) { }
  paintPrefs();
  paintBarIcons();
}
function paintPrefs() {
  const h = document.body.classList.contains("hush"), d = document.body.classList.contains("day");
  const hb = $("#hushBtn"), db = $("#dayBtn");
  if (hb) { hb.textContent = h ? "가림" : "보임"; hb.classList.toggle("open", h); }
  if (db) { db.textContent = d ? "밤" : "낮"; db.classList.toggle("open", d); }
}
/* 하단 탭바 아이콘은 한 번만 그린다 */
function paintBarIcons() {
  $$("#tabbar button").forEach(b => {
    if (b.querySelector("svg")) return;
    b.insertAdjacentHTML("afterbegin", icon(b.dataset.ic));
  });
}

/* ---------- 머리글 아이콘 ----------
   화면마다 문자열을 고치는 대신, 다 그린 뒤에 제목을 보고 앞에 붙인다. */
const HEAD_ICON = {
  "읽어 보면": "잎", "지금 가진 것": "자산", "무엇과 견주면": "그래프", "어디에 썼나": "그래프",
  "날마다": "달력", "큰 지출": "별", "달마다": "그래프", "달별 표": "달력",
  "대분류 흐름": "그래프", "소분류 순위": "그래프", "자주 간 곳": "지갑", "해마다": "달력",
  "내 물가": "그래프", "버릇": "시계", "매달 나가는 것": "시계", "이 달 통계": "그래프",
  "모아 온 길": "자산", "두 장부가 맞나": "자산", "무엇으로 가지고 있나": "자산",
  "예적금 만기": "시계", "카드 캐시백": "지갑", "매매 성적표": "그래프", "끝낸 거래": "그래프",
  "들고 있는 것": "지갑", "비상장": "별", "무엇에 넣었나": "그래프", "연봉 곡선": "그래프",
  "본업 밖의 수입": "수입", "가계부에 적힌 수입": "수입", "기록": "별",
  "가장 큰 지출 열 개": "별", "단골": "사람", "부모님께": "사람", "숨은 절약": "잎",
  "누구에게": "사람", "누구와": "사람", "무엇에": "그래프", "큰 기록": "별",
  "화면이나 글로 넣기": "더하기", "직접 적기": "더하기",
};
function decorate(box) {
  $$(".sec h2", box).forEach(h2 => {
    if (h2.querySelector("svg")) return;
    const t = h2.textContent.trim();
    const k = HEAD_ICON[t] || (/원장$/.test(t) ? "달력" : null);
    if (k) h2.insertAdjacentHTML("afterbegin", icon(k));
  });
}

async function boot() {
  loadPrefs();
  $("#p-month").innerHTML = '<div class="card"><div class="skel" style="width:40%"></div>' +
    '<div class="skel" style="height:38px;margin:12px 0"></div>' +
    '<div class="skel" style="width:70%"></div></div>';
  try {
    await loadAll();
  } catch (e) {
    $("#p-month").innerHTML = '<div class="card"><h2 style="font-size:15px;margin-bottom:8px">아직 시트에 닿지 못했습니다</h2>' +
      '<p style="font-size:13px;color:var(--ink2);line-height:1.6">config 의 APPS_SCRIPT_URL 을 채우고, ' +
      "Apps Script 를 새 버전으로 배포했는지 확인해 주세요.</p>" +
      '<p style="font-size:11.5px;color:var(--ink3);margin-top:10px">' + esc(e.message) + "</p></div>";
    stamp(); return;
  }
  const months = Array.from(new Set(S.rows.map(r => r.ym))).sort();
  const cur = ymOf(todayISO());
  S.ym = months.includes(cur) ? cur : (months[months.length - 1] || cur);
  paintTabs();
  goTab("month");
  stamp();
}

/* 붙이기 */
$$("#tabbar button").forEach(b => b.onclick = () => goTab(b.dataset.tab));
$("#fab").onclick = () => goTab("add");
$("#reloadBtn").onclick = async () => {
  toast("다시 읽는 중");
  A.loaded = false; A.denied = false; A.data = null;
  await loadAll(); paintTabs(); renderAll(); stamp(); toast("최신입니다");
};
$("#lockBtn").onclick = () => { if (authAlive()) authLock(); else ensureAuth(); };
$("#hushBtn").onclick = () => {
  document.body.classList.toggle("hush");
  try { localStorage.setItem("jh_hush", document.body.classList.contains("hush") ? "1" : "0"); } catch (e) { }
  paintPrefs();
};
$("#dayBtn").onclick = () => {
  document.body.classList.toggle("day");
  try { localStorage.setItem("jh_day", document.body.classList.contains("day") ? "1" : "0"); } catch (e) { }
  paintPrefs();
  renderAll();          /* 그래프의 색이 CSS 변수를 따르므로 다시 그린다 */
};
$("#modal").onclick = e => { if (e.target.id === "modal") closeModal(); };
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("#modal").hidden) closeModal(); });
document.addEventListener("visibilitychange", () => { if (!document.hidden) paintLock(); });

paintLock();
boot();
