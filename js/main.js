/* main.js - 켜기, 탭 옮기기, 달 고르기. */
FILEV.main = CONFIG.APP_VERSION;

const RENDER = { month: renderMonth, trend: renderTrend, book: renderBook, theme: renderTheme, add: renderAdd };
const TITLE = { month: "이번 달", trend: "추이", book: "장부", theme: "테마", add: "입력" };
const DIRTY = { month: 1, trend: 1, book: 1, theme: 1, add: 1 };

function goTab(t) {
  S.tab = t;
  $$("#tabbar button").forEach(b => b.classList.toggle("on", b.dataset.tab === t));
  ["month", "trend", "book", "theme", "add"].forEach(k => { $("#p-" + k).hidden = k !== t; });
  $("#topTitle").textContent = TITLE[t];
  $("#tabstrip").hidden = (t === "trend" || t === "theme" || t === "add");
  if (DIRTY[t]) { RENDER[t](); DIRTY[t] = 0; }
  window.scrollTo({ top: 0, behavior: "instant" });
}
function renderAll() { Object.keys(DIRTY).forEach(k => DIRTY[k] = 1); RENDER[S.tab](); DIRTY[S.tab] = 0; }

/* 달 탭 줄 */
function paintTabs() {
  const strip = $("#tabstrip");
  const months = Array.from(new Set(S.rows.map(r => r.ym))).filter(Boolean).sort();
  if (!months.includes(S.ym)) months.push(S.ym), months.sort();
  const maxOut = Math.max(1, ...months.map(m => monthStat(m).out));
  strip.innerHTML = months.map(m => {
    const st = monthStat(m);
    return '<button class="mtab' + (m === S.ym ? " on" : "") + '" data-ym="' + m + '">' + ymLabel(m) +
      '<i class="dot" style="width:100%;transform:scaleX(' + Math.max(.08, st.out / maxOut).toFixed(2) + ');transform-origin:left"></i></button>';
  }).join("");
  $$(".mtab", strip).forEach(b => b.onclick = () => {
    S.ym = b.dataset.ym; paintTabs();
    DIRTY.month = DIRTY.book = DIRTY.trend = 1;
    RENDER[S.tab](); DIRTY[S.tab] = 0;
  });
  const on = $(".mtab.on", strip);
  if (on) on.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
}

function stamp() {
  const n = Object.keys(FILEV).length;
  const bad = Object.values(FILEV).some(v => v !== CONFIG.APP_VERSION);
  let s = CONFIG.APP_VERSION + " (" + n + "/" + n + ")";
  if (bad) s += ' <span class="bad">구버전 파일이 섞였습니다</span>';
  if (S.server && S.server !== CONFIG.SERVER_EXPECTED)
    s += ' <span class="bad">서버 ' + esc(S.server) + " 불일치, Code.gs 를 새 버전으로 다시 배포하세요</span>";
  $("#stamp").innerHTML = s;
}

async function boot() {
  $("#p-month").innerHTML = '<div class="card"><div class="skel" style="width:40%"></div>' +
    '<div class="skel" style="height:38px;margin:12px 0"></div>' +
    '<div class="skel" style="width:70%"></div></div>';
  try {
    await loadAll();
  } catch (e) {
    $("#p-month").innerHTML = '<div class="card"><h2 style="font-size:15px;margin-bottom:8px">아직 시트에 닿지 못했습니다</h2>' +
      '<p style="font-size:13px;color:var(--ink2);line-height:1.6">js/config.js 의 APPS_SCRIPT_URL 을 채우고, ' +
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
$("#reloadBtn").onclick = async () => { toast("다시 읽는 중"); await loadAll(); paintTabs(); renderAll(); toast("최신입니다"); };
$("#lockBtn").onclick = () => { if (authAlive()) authLock(); else ensureAuth(); };
$("#modal").onclick = e => { if (e.target.id === "modal") closeModal(); };
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("#modal").hidden) closeModal(); });
document.addEventListener("visibilitychange", () => { if (!document.hidden) paintLock(); });

paintLock();
boot();
