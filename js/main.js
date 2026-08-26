/* ===== js/main.js ===== */
/* main.js - 켜기, 탭 옮기기, 달 고르기, 가리기와 밤 모드. */
FILEV.main = CONFIG.APP_VERSION;

const RENDER = { month: renderMonth, ledger: renderLedger, spend: renderSpend, asset: renderAsset, hall: renderHall, add: renderAdd };
const TITLE = { month: "이번 달", ledger: "원장", spend: "소비", asset: "자산", hall: "기록실", add: "입력" };
const DIRTY = { month: 1, ledger: 1, spend: 1, asset: 1, hall: 1, add: 1 };
const TABS = ["month", "ledger", "spend", "asset", "hall", "add"];
const BARTABS = ["month", "ledger", "spend", "asset", "hall"];
let LASTTAB = "month";   /* 입력을 닫으면 돌아갈 곳 */

const NAV = { skip: false };
function goTab(t, viaPop) {
  if (t === "add" && S.tab !== "add") LASTTAB = S.tab;
  const changed = S.tab !== t;
  S.tab = t;
  /* 기기의 뒤로가기가 앱 안에서 한 걸음 물러나게 한다 */
  if (!viaPop && changed) { try { history.pushState({ tab: t }, ""); } catch (e) { } }
  $$("#tabbar button").forEach(b => b.classList.toggle("on", b.dataset.tab === t));
  TABS.forEach(k => { $("#p-" + k).hidden = k !== t; });
  paintTitle();
  /* 달 탭 줄은 없앴다. 제목 자체가 달을 고르는 단추다 */
  $("#tabstrip").hidden = true;
  $("#fab").hidden = (t === "add");
  if (DIRTY[t]) { RENDER[t](); DIRTY[t] = 0; }
  decorate($("#p-" + t));
  window.scrollTo({ top: 0, behavior: "instant" });
}
function renderAll() { Object.keys(DIRTY).forEach(k => DIRTY[k] = 1); RENDER[S.tab](); DIRTY[S.tab] = 0; decorate($("#p-" + S.tab)); }

/* ---------- 달 고르기 ----------
   예전에는 화면 맨 위에 달 탭이 백 개 넘게 가로로 깔려 있었다.
   늘 보는 것은 이번 달 하나인데 띠 하나를 통째로 먹고 있었다.
   제목을 눌러 여는 창으로 옮겼다. 창에서는 좁은 띠보다 넓게 보여 줄 수 있다. */
const MONTHTABS = ["month", "ledger"];
function monthPickable() {
  return MONTHTABS.includes(S.tab) || (S.tab === "spend" && typeof SP !== "undefined" && SP.seg === "book");
}
function paintTitle() {
  const t = $("#topTitle");
  if (!t) return;
  if (monthPickable()) {
    t.innerHTML = esc(S.ym.slice(0, 4)) + "년 " + (+S.ym.slice(5, 7)) + "월<i>달 고르기</i>";
    t.classList.add("mpick");
    t.onclick = () => openMonthPick();
  } else {
    t.textContent = TITLE[S.tab];
    t.classList.remove("mpick");
    t.onclick = null;
  }
}
/* 이름은 그대로 두었다. 여기저기서 부르고 있어서다 */
function paintTabs() { paintTitle(); }

function pickMonth(ym) {
  S.ym = ym;
  paintTitle();
  DIRTY.month = DIRTY.ledger = DIRTY.spend = DIRTY.hall = 1;
  RENDER[S.tab](); DIRTY[S.tab] = 0;
  decorate($("#p-" + S.tab));
  ensureHolidays(+S.ym.slice(0, 4)).then(got => {
    if (got) { DIRTY.month = DIRTY.ledger = 1; RENDER[S.tab](); DIRTY[S.tab] = 0; }
  });
}

function openMonthPick() {
  const cur = ymOf(todayISO());
  const ys = Array.from(new Set(S.rows.map(r => r.y))).filter(Boolean).sort().reverse();
  if (!ys.includes(cur.slice(0, 4))) ys.unshift(cur.slice(0, 4));
  const allYM = Array.from(new Set(S.rows.map(r => r.ym))).filter(Boolean);
  const maxOut = Math.max(1, ...(allYM.length ? allYM.map(m => monthStat(m).out) : [1]));

  const paint = () => '<h2 style="font-size:16px;margin-bottom:2px">달 고르기</h2>' +
    '<p style="font-size:11.5px;color:var(--ink3);margin:0 0 12px">막대 높이가 그 달 지출입니다. 기록이 없는 달은 흐립니다.</p>' +
    '<div style="display:flex;gap:8px;margin-bottom:12px">' +
    '<button class="btn ghost sm" data-jump="' + shiftYM(S.ym, -1) + '">지난달</button>' +
    '<button class="btn ghost sm" data-jump="' + cur + '">이번 달</button>' +
    '<button class="btn ghost sm" data-jump="' + shiftYM(S.ym, 1) + '">다음 달</button></div>' +
    '<div class="mpwrap">' + ys.map(y => {
      const cells = Array.from({ length: 12 }, (_, i) => {
        const m = y + "-" + pad2(i + 1);
        const st = monthStat(m);
        const has = st.n > 0;
        const h = has ? Math.max(6, Math.round(st.out / maxOut * 34)) : 0;
        return '<button class="mp' + (m === S.ym ? " on" : "") + (m === cur ? " now" : "") +
          (has ? "" : " off") + '" data-mp="' + m + '">' +
          '<i style="height:' + h + 'px"></i>' +
          '<b>' + (i + 1) + '</b>' +
          '<em>' + (has ? wonS(st.out) : "") + "</em></button>";
      }).join("");
      return '<div class="mpy"><div class="yl">' + y + "</div>" +
        '<div class="mpg">' + cells + "</div></div>";
    }).join("") + "</div>" +
    '<button class="btn ghost" id="mpNo" style="margin-top:12px">닫기</button>';

  openModal(paint());
  const body = $("#modalBody");
  $$("[data-mp]", body).forEach(b => b.onclick = () => {
    if (b.classList.contains("off") && b.dataset.mp !== ymOf(todayISO())) return;
    closeModal(true); pickMonth(b.dataset.mp);
  });
  $$("[data-jump]", body).forEach(b => b.onclick = () => { closeModal(true); pickMonth(b.dataset.jump); });
  $("#mpNo").onclick = () => closeModal(true);
  const on = $(".mp.on", body);
  if (on && on.scrollIntoView) on.scrollIntoView({ block: "center" });
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

  /* 지난번 자료가 기기에 있으면 그걸로 먼저 그린다. 기다리는 시간이 없어진다 */
  const cached = cacheLoad();
  let painted = false;
  if (cached) {
    try {
      seatData(cached);
      const months = Array.from(new Set(S.rows.map(r => r.ym))).sort();
      const cur = ymOf(todayISO());
      S.ym = months.includes(cur) ? cur : (months[months.length - 1] || cur);
      paintTabs(); goTab("month"); stamp();
      showStale(cached.at);
      painted = true;
    } catch (e) { painted = false; }
  }
  if (!painted) {
    $("#p-month").innerHTML = '<div class="card"><div class="skel" style="width:40%"></div>' +
      '<div class="skel" style="height:38px;margin:12px 0"></div>' +
      '<div class="skel" style="width:70%"></div></div>';
  }

  try {
    await loadAll();
  } catch (e) {
    if (painted) { toast("새 자료를 못 받았습니다. 지난번 것을 보고 있습니다"); return; }
    showConnError(e); stamp(); return;
  }

  const months = Array.from(new Set(S.rows.map(r => r.ym))).sort();
  const cur = ymOf(todayISO());
  if (!painted || !months.includes(S.ym)) S.ym = months.includes(cur) ? cur : (months[months.length - 1] || cur);
  paintTabs();
  if (painted) { renderAll(); hideStale(); } else { goTab("month"); }
  stamp();
  ensureHolidays(+S.ym.slice(0, 4)).then(got => {
    if (got) { DIRTY.month = DIRTY.ledger = 1; RENDER[S.tab](); DIRTY[S.tab] = 0; }
  });
}

/** 지난번 자료를 보고 있다는 띠 */
function showStale(at) {
  const mins = Math.round((Date.now() - (at || 0)) / 60000);
  const when = mins < 60 ? mins + "분 전" : Math.round(mins / 60) + "시간 전";
  let el = $("#staleBar");
  if (!el) {
    el = document.createElement("div");
    el.id = "staleBar";
    $("#main").insertAdjacentElement("beforebegin", el);
  }
  el.innerHTML = '<span class="dot"></span>' + when + " 자료를 먼저 보여 드립니다. 새로 읽는 중입니다.";
  el.hidden = false;
}
function hideStale() { const el = $("#staleBar"); if (el) el.hidden = true; }

/* ---------- 못 닿았을 때 ----------
   그냥 실패했다고만 하면 어디를 봐야 할지 알 수 없다.
   지금 쓰고 있는 주소를 그대로 보여 주고, 한 번에 열어 볼 수 있게 한다. */
function showConnError(e) {
  const url = CONFIG.APPS_SCRIPT_URL || "";
  const msg = String(e && e.message || e);
  const empty = !url;
  const fetchFail = /Failed to fetch|NetworkError|Load failed/i.test(msg);

  const lib = /\/macros\/library\//.test(url);
  const noExec = url && !/\/exec$/.test(url);

  const tips = empty
    ? ["<b>js/config.js 의 APPS_SCRIPT_URL 이 비어 있습니다.</b> 배포 관리에서 웹 앱 URL 을 복사해 넣어 주세요."]
    : lib
      ? [
        "<b>이 주소는 웹 앱 주소가 아니라 라이브러리 주소입니다.</b> " +
        "주소에 <b>/macros/library/</b> 가 들어 있으면 그렇습니다. 이 주소로는 앱이 시트에 닿을 수 없습니다.",
        "[배포 > 배포 관리] 를 열면 오른쪽에 <b>웹 앱</b> 칸과 <b>라이브러리</b> 칸이 따로 있습니다. " +
        "<b>웹 앱</b> 칸 아래 URL 옆의 [복사] 를 눌러 주세요. 라이브러리 쪽 [복사] 를 누른 것 같습니다.",
        "맞는 주소는 <b>/exec</b> 로 끝납니다. " +
        "<b>https://script.google.com/macros/s/AKfycb.../exec</b> 모양입니다. 배포 ID 도 아닙니다.",
        "고친 뒤 GitHub 에 올리고 새로고침을 세게 해 주세요. (윈도우 Ctrl+Shift+R, 맥 Cmd+Shift+R)",
      ]
      : noExec
        ? [
          "<b>이 주소는 /exec 로 끝나지 않습니다.</b> 웹 앱 주소가 아닐 수 있습니다.",
          "[배포 > 배포 관리] 의 <b>웹 앱</b> 칸 아래 URL 옆 [복사] 로 가져온 주소여야 합니다. " +
          "배포 ID 나 라이브러리 주소가 아닙니다.",
          "맞는 모양은 <b>https://script.google.com/macros/s/AKfycb.../exec</b> 입니다.",
        ]
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
try { history.replaceState({ tab: "month" }, ""); } catch (e) { }
window.addEventListener("popstate", e => {
  if (NAV.skip) { NAV.skip = false; return; }
  const st = e.state || {};
  /* 창이 열려 있으면 창부터 닫는다 */
  if (!$("#modal").hidden && !st.m) { closeModal(true, true); return; }
  if (st.tab && st.tab !== S.tab) goTab(st.tab, true);
  else if (!st.tab && S.tab !== "month") goTab("month", true);
});
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
