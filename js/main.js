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
    showConnError(e);
    stamp(); return;
  }
  const months = Array.from(new Set(S.rows.map(r => r.ym))).sort();
  const cur = ymOf(todayISO());
  S.ym = months.includes(cur) ? cur : (months[months.length - 1] || cur);
  paintTabs();
  goTab("month");
  stamp();
}

/* ---------- 못 닿았을 때 ----------
   그냥 실패했다고만 하면 어디를 봐야 할지 알 수 없다.
   지금 쓰고 있는 주소를 그대로 보여 주고, 한 번에 열어 볼 수 있게 한다. */
function showConnError(e) {
  const url = CONFIG.APPS_SCRIPT_URL || "";
  const msg = String(e && e.message || e);
  const empty = !url;
  const fetchFail = /Failed to fetch|NetworkError|Load failed/i.test(msg);

  const tips = empty
    ? ["<b>js/config.js 의 APPS_SCRIPT_URL 이 비어 있습니다.</b> 배포 관리에서 웹 앱 URL 을 복사해 넣어 주세요."]
    : fetchFail
      ? [
        "<b>아래 주소를 새 탭에서 열어 보세요.</b> JSON 이 보이면 서버는 살아 있는 것이고, 문제는 주소가 다르거나 낡은 것입니다. 로그인 화면이 뜨면 배포의 액세스 권한이 '모든 사용자' 가 아닙니다.",
        "<b>배포가 여럿이면 주소가 어긋나기 쉽습니다.</b> [배포 > 배포 관리] 에서 <b>활성</b> 배포의 웹 앱 URL 을 복사해, 아래 주소와 글자 하나까지 같은지 보세요. 보관처리된 배포의 주소는 응답하지 않습니다.",
        "<b>브라우저가 옛 config.js 를 들고 있을 수 있습니다.</b> 새로고침을 세게 해 주세요. (윈도우 Ctrl+Shift+R, 맥 Cmd+Shift+R)",
        "<b>파일을 두 번 누르지 말고</b> GitHub Pages 주소로 여세요. file:// 로 열면 막힙니다.",
      ]
      : ["서버가 대답은 했지만 거절했습니다. Apps Script 실행 기록에서 오류를 보실 수 있습니다."];

  $("#p-month").innerHTML =
    '<div class="card"><h2 style="font-size:15px;margin-bottom:10px">아직 시트에 닿지 못했습니다</h2>' +
    '<div style="font-size:12.5px;color:var(--ink3);margin-bottom:6px">앱이 쓰고 있는 주소</div>' +
    '<div style="font-family:var(--mono);font-size:11px;word-break:break-all;background:var(--soft);' +
    'border:1px solid var(--line);border-radius:10px;padding:10px;line-height:1.5">' +
    (url ? esc(url) : "(비어 있음)") + "</div>" +
    (url ? '<a class="btn" id="openExec" href="' + esc(url) + '" target="_blank" rel="noopener" ' +
      'style="display:block;text-align:center;text-decoration:none;margin-top:10px">이 주소를 새 탭에서 열어 보기</a>' : "") +
    '<div style="font-size:11px;color:var(--ink3);margin-top:14px">브라우저가 알려 준 것</div>' +
    '<div style="font-size:12px;color:var(--out);font-weight:600;margin-top:2px">' + esc(msg) + "</div>" +
    '<div style="height:14px"></div>' +
    '<div class="ins">' + tips.map((t, i) =>
      '<div class="i"><span class="k">' + (i + 1) + '</span><div>' + t + "</div></div>").join("") +
    "</div></div>";
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
