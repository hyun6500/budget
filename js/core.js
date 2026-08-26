/* ===== js/core.js ===== */
/* core.js - 데이터 읽기와 집계.
   여기서만 원본 시트를 안다. 화면 파일은 이 함수들만 쓴다. */
const FILEV = window.FILEV || (window.FILEV = {});
FILEV.core = CONFIG.APP_VERSION;

const S = {
  future: [],
  people: { intro: [], love: [] },
  mailPresets: [],
  rows: [],          // 정규화된 기록
  meta: null,        // 분류표
  ym: "",            // 지금 보고 있는 달
  ready: false,
  tab: "month",
};

/* ---------- 작은 도구 ---------- */
/* ---------- 공휴일 ----------
   해마다 한 번만 서버에 묻고 기억해 둔다. 대체공휴일도 함께 온다. */
const HOL = { map: {}, asked: {} };
function holidayOf(date) { return HOL.map[date] || ""; }
async function ensureHolidays(y) {
  if (!y || HOL.asked[y]) return false;
  HOL.asked[y] = true;
  try {
    const j = await post("holidays", { y: y });
    Object.assign(HOL.map, j.days || {});
    return true;
  } catch (e) { return false; }
}

const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const el = (t, c, h) => { const n = document.createElement(t); if (c) n.className = c; if (h != null) n.innerHTML = h; return n; };
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));
const won = n => (Math.round(n || 0)).toLocaleString("ko-KR");
const wonS = n => { const v = Math.round(Math.abs(n || 0)); if (v >= 100000000) return (v / 100000000).toFixed(1).replace(/\.0$/, "") + "억"; if (v >= 10000) return (v / 10000).toFixed(v >= 1000000 ? 0 : 1).replace(/\.0$/, "") + "만"; return v.toLocaleString("ko-KR"); };
const pad2 = n => String(n).padStart(2, "0");
const todayISO = () => { const d = new Date(); return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); };
const ymOf = iso => (iso || "").slice(0, 7);
const yOf = iso => (iso || "").slice(0, 4);
const shiftYM = (ym, k) => { let y = +ym.slice(0, 4), m = +ym.slice(5, 7) + k; y += Math.floor((m - 1) / 12); m = ((m - 1) % 12 + 12) % 12 + 1; return y + "-" + pad2(m); };
const ymLabel = ym => ym.slice(2, 4) + "-" + ym.slice(5, 7);
const WD = ["일", "월", "화", "수", "목", "금", "토"];
const wdOf = iso => { const d = new Date(iso + "T00:00:00"); return isNaN(d) ? "" : WD[d.getDay()]; };

function toast(msg, ms) {
  const t = $("#toast"); t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, ms || 2200);
}

/* ---------- 시트 읽기 ---------- */
function normDate(v) {
  if (!v) return "";
  const s = String(v).trim();
  let m = s.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  if (m) return m[1] + "-" + pad2(m[2]) + "-" + pad2(m[3]);
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);            // 구글시트 로케일 대비
  if (m) return m[3] + "-" + pad2(m[1]) + "-" + pad2(m[2]);
  const d = new Date(s);
  if (!isNaN(d)) return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  return "";
}
/* ---------- 시각 ----------
   시트가 시각만 담을 때는 1899-12-30 을 기준일로 붙인 값으로 준다.
   서버가 걸러 보내지만, 옛 서버가 돌고 있을 때를 위해 여기서도 한 번 더 거른다.
   시각 꼴이 아니면 아예 버린다. 화면에 1899-12-31 을 내놓느니 비워 두는 편이 낫다. */
function hhmm(v) {
  const s = String(v == null ? "" : v).trim();
  if (!s) return "";
  if (/^\d{4}[-.\/]\d{1,2}[-.\/]\d{1,2}$/.test(s)) return "";      /* 날짜만 남은 것 */
  const m = s.match(/(오전|오후|AM|PM)?\s*(\d{1,2}):(\d{2})/i);
  if (!m) return "";
  let h = +m[2];
  const ap = (m[1] || "").toUpperCase();
  if ((ap === "오후" || ap === "PM") && h < 12) h += 12;
  if ((ap === "오전" || ap === "AM") && h === 12) h = 0;
  if (h < 0 || h > 23) return "";
  /* 1899 로 시작하는 ISO 값이면 시분만 살린다 */
  return pad2(h) + ":" + m[3];
}

function numOf(v) {
  if (typeof v === "number") return v;
  const t = String(v == null ? "" : v).replace(/[^0-9.-]/g, "");
  return t === "" || t === "-" ? 0 : parseFloat(t);
}

function rowsFromTable(head, body) {
  const ix = {}; head.forEach((h, i) => { ix[String(h || "").trim()] = i; });
  const g = (r, k) => { const i = ix[k]; return i == null ? "" : String(r[i] == null ? "" : r[i]).trim(); };
  const out = [];
  for (const r of body) {
    const date = normDate(g(r, "날짜"));
    const amt = numOf(g(r, "금액"));
    const sub = g(r, "소분류");
    if (!date || (!amt && !sub)) continue;
    const rate = (() => { const t = g(r, "부담률"); if (!t) return 1; const v = numOf(t); return t.includes("%") ? v / 100 : (v > 1.5 ? v / 100 : v); })();
    const disc = Math.max(0, Math.min(amt, numOf(g(r, "할인"))));
    const real = amt - disc;                       /* 할인을 뺀, 실제로 나간 돈 */
    const mine = numOf(g(r, "내 몫")) || Math.round(real * (rate || 1));
    out.push({
      no: numOf(g(r, "no")), 검수: g(r, "검수"), date, sub, big: g(r, "대분류"),
      kind: g(r, "구분") || "지출", amt, share: g(r, "누구 몫") || "내 몫 전부",
      rate: rate || 1, mine, place: g(r, "장소"), detail: g(r, "세부내역"),
      situ: g(r, "상황"), once: g(r, "일시성"), treat: g(r, "대접"), theme: g(r, "테마"),
      with: g(r, "동행"), pay: g(r, "결제수단"), memo: g(r, "메모"),
      time: hhmm(g(r, "시각")), disc, discBy: g(r, "할인수단"), real,
      event: g(r, "건"),
      ym: ymOf(date), y: yOf(date),
    });
  }
  /* 같은 날짜 안의 차례는 no 가 아니라 시트에 놓인 차례를 따른다.
     그래야 [원장]에서 위아래로 옮겨도 no 를 건드리지 않고 순서가 바뀐다 */
  out.forEach((r, i) => { if (r.seq === undefined) r.seq = i; });
  out.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.seq - b.seq);
  /* 아직 오지 않은 달은 화면에 내지 않는다. 지우지는 않고 따로 담아 둔다.
     11월 기록을 8월에 미리 적어 두어도 8월 화면이 흔들리지 않게 하려는 것이다. */
  const cur = ymOf(todayISO());
  S.future = out.filter(r => r.ym > cur);
  return out.filter(r => r.ym <= cur);
}

async function post(action, payload) {
  if (!CONFIG.APPS_SCRIPT_URL) throw new Error("APPS_SCRIPT_URL 이 비어 있습니다");
  if (/\/macros\/library\//.test(CONFIG.APPS_SCRIPT_URL))
    throw new Error("라이브러리 주소가 들어 있습니다. 웹 앱 주소(/exec 로 끝나는 것)를 넣어 주세요");
  const res = await fetch(CONFIG.APPS_SCRIPT_URL, {
    method: "POST", redirect: "follow",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(Object.assign({ action }, payload || {})),
  });
  const j = await res.json();
  if (!j.ok) throw new Error(j.error || "서버가 거절했습니다");
  return j;
}

/** 서버가 돌려준 한 줄을 앱이 쓰는 모양으로 바꾼다. 통째로 다시 읽지 않기 위해서다. */
function rowFromValues(head, arr) {
  const list = rowsFromTable(head, [arr]);
  return list.length ? list[0] : null;
}

/* ---------- 저장한 것을 그 자리에서 반영 ----------
   9천 줄을 다시 받아 오면 몇 초가 걸린다. 방금 쓴 줄만 갈아 끼우고
   시트와의 어긋남은 다음에 켤 때 저절로 맞춰진다. */
function patchAdd(head, values) {
  const r = rowFromValues(head, values);
  if (!r) return null;
  const same = S.rows.filter(x => x.date === r.date);
  r.seq = same.length ? Math.max.apply(null, same.map(x => x.seq)) + 0.5 : (S.rows.length ? S.rows[S.rows.length - 1].seq + 0.5 : 0);
  if (r.ym > ymOf(todayISO())) { S.future.push(r); return r; }
  S.rows.push(r);
  S.rows.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.seq - b.seq);
  cacheDrop();
  return r;
}
function patchUpdate(head, values, no) {
  const r = rowFromValues(head, values);
  if (!r) return null;
  const i = S.rows.findIndex(x => x.no === +no);
  if (i < 0) return null;
  r.seq = S.rows[i].seq;
  S.rows[i] = r;
  S.rows.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.seq - b.seq);
  cacheDrop();
  return r;
}
function patchDel(no) {
  const i = S.rows.findIndex(x => x.no === +no);
  if (i >= 0) S.rows.splice(i, 1);
  cacheDrop();
}
function patchMove(no, dir) {
  const i = S.rows.findIndex(x => x.no === +no);
  if (i < 0) return;
  const j = dir === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= S.rows.length) return;
  if (S.rows[j].date !== S.rows[i].date) return;
  const a = S.rows[i].seq;
  S.rows[i].seq = S.rows[j].seq;
  S.rows[j].seq = a;
  S.rows.sort((x, y) => x.date < y.date ? -1 : x.date > y.date ? 1 : x.seq - y.seq);
  cacheDrop();
}

/* ---------- 지난번 자료를 기기에 담아 둔다 ----------
   앱을 켤 때 시트를 다 읽기 전에 지난번 것으로 먼저 그려 준다.
   그 뒤 새 자료가 오면 조용히 다시 그린다. */
const CACHE_KEY = "jh_rows_v1";
function cacheSave(j) {
  try {
    const s = JSON.stringify({ at: Date.now(), head: j.head, body: j.body, meta: j.meta, people: j.people, mailPresets: j.mailPresets, version: j.version });
    if (s.length > 4200000) return;          /* 너무 크면 담지 않는다 */
    localStorage.setItem(CACHE_KEY, s);
  } catch (e) { }
}
function cacheLoad() {
  try {
    const s = localStorage.getItem(CACHE_KEY);
    if (!s) return null;
    const j = JSON.parse(s);
    if (!j || !j.head || !j.body) return null;
    return j;
  } catch (e) { return null; }
}
function cacheDrop() { try { localStorage.removeItem(CACHE_KEY); } catch (e) { } }

/** 자료를 앱에 앉힌다. */
function seatData(j) {
  S.rows = rowsFromTable(j.head, j.body);
  S.meta = j.meta || null;
  S.people = j.people || { intro: [], love: [] };
  S.mailPresets = j.mailPresets || [];
  S.server = j.version || "";
  S.ready = true;
}

async function loadAll() {
  const j = await post("rows", {});
  seatData(j);
  cacheSave(j);
}

/* ---------- 집계 ---------- */
const isOut = r => r.kind === "지출";
const isIn = r => r.kind === "수입";
const isMov = r => r.kind === "이체";
/* ---------- 환불 ----------
   환불은 번 돈이 아니라 쓴 돈의 취소다. 그래서 구분을 새로 만들지 않고
   금액을 음수로 둔 지출 줄로 적는다. 옛 줄 열 개(아이허브, 크로스핏)가 이미 그 꼴이다.
   가려내는 기준은 상황 칸이 아니라 금액의 부호다. 상황을 안 적어도 걸린다. */
const isRefund = r => (r.amt || 0) < 0 || (r.mine || 0) < 0;
/** 그래프에 올릴 값. 음수는 따로 세므로 여기서 뺀다 */
const plusOnly = r => !isRefund(r);

function monthRows(ym) { return S.rows.filter(r => r.ym === ym); }
function sumMine(rs, f) { return rs.reduce((a, r) => a + ((!f || f(r)) ? r.mine : 0), 0); }
function sumAmt(rs, f) { return rs.reduce((a, r) => a + ((!f || f(r)) ? r.amt : 0), 0); }

function monthStat(ym) {
  const rs = monthRows(ym);
  return {
    ym, n: rs.length,
    out: sumMine(rs, isOut), outFull: sumAmt(rs, isOut),
    inc: sumMine(rs, isIn), mov: sumMine(rs, isMov),
    /* 돌려받은 돈. out 에는 이미 음수로 반영되어 있고, 이 값은 왜 줄었는지 보여 주려고 따로 센다 */
    refund: -sumMine(rs, r => isOut(r) && isRefund(r)),
    refundN: rs.filter(r => isOut(r) && isRefund(r)).length,
    get left() { return this.inc - this.out; },
    get rate() { return this.inc ? (this.inc - this.out) / this.inc : 0; },
  };
}

/** 이 달까지 실제로 기록이 있는 달들 (평균 계산용) */
function activeMonths(year) {
  const set = new Set(S.rows.filter(r => !year || r.y === year).map(r => r.ym));
  return Array.from(set).sort();
}
function avgOutOfYear(year) {
  const ms = activeMonths(year); if (!ms.length) return 0;
  return ms.reduce((a, m) => a + monthStat(m).out, 0) / ms.length;
}

function byKey(rs, keyFn, valFn) {
  const m = new Map();
  for (const r of rs) {
    const k = keyFn(r); if (!k) continue;
    const o = m.get(k) || { key: k, n: 0, mine: 0, amt: 0 };
    o.n++; o.mine += (valFn ? valFn(r) : r.mine); o.amt += r.amt; m.set(k, o);
  }
  return Array.from(m.values()).sort((a, b) => b.mine - a.mine);
}

function pct(now, before) {
  if (!before) return null;
  return (now - before) / before;
}

/* ---------- 고정 지출 감지 (메인탭 알림) ----------
   최근 3개 달에서 같은 소분류+장소가 매달 나왔으면 정기 항목으로 본다.
   이번 달에 아직 안 보이고, 늘 나오던 날 + 유예일이 지났으면 알린다. */
function recurring(ym, graceDays) {
  const grace = graceDays == null ? 3 : graceDays;
  const prev = [shiftYM(ym, -1), shiftYM(ym, -2), shiftYM(ym, -3)];
  const seen = new Map();
  prev.forEach((m, i) => {
    for (const r of monthRows(m)) {
      if (!isOut(r) && !isMov(r)) continue;
      if (isRefund(r)) continue;            /* 환불 줄은 정기 항목 판정에서 뺀다 */
      const key = (r.sub || "") + "|" + (r.place || "").trim();
      if (!key.trim() || key === "|") continue;
      const o = seen.get(key) || { key, sub: r.sub, place: r.place, months: new Set(), days: [], amts: [], last: r, situ: "" };
      o.months.add(m); o.days.push(+r.date.slice(8, 10)); o.amts.push(r.mine); o.last = r;
      if (r.situ === "정기결제") o.situ = "정기결제";
      seen.set(key, o);
    }
  });
  const cur = monthRows(ym);
  const has = new Set(cur.map(r => (r.sub || "") + "|" + (r.place || "").trim()));
  const today = todayISO();
  const out = [];
  for (const o of seen.values()) {
    if (o.months.size < 3) continue;            // 세 달 내리 나온 것만
    if (has.has(o.key)) continue;
    // 금액이 들쭉날쭉하면 고정 지출이 아니라 우연히 겹친 것이다
    const mean = o.amts.reduce((a, b) => a + b, 0) / o.amts.length;
    if (!mean) continue;
    const sd = Math.sqrt(o.amts.reduce((a, b) => a + (b - mean) * (b - mean), 0) / o.amts.length);
    const steady = o.situ === "정기결제" || sd / mean <= 0.45;
    if (!steady) continue;
    const day = Math.round(o.days.reduce((a, b) => a + b, 0) / o.days.length);
    const due = ym + "-" + pad2(Math.min(28, day));
    const dl = new Date(due + "T00:00:00"); dl.setDate(dl.getDate() + grace);
    const dueGrace = dl.getFullYear() + "-" + pad2(dl.getMonth() + 1) + "-" + pad2(dl.getDate());
    if (today < dueGrace) continue;             // 아직 기다려 볼 때
    const avg = Math.round(o.amts.reduce((a, b) => a + b, 0) / o.amts.length);
    out.push({ sub: o.sub, place: o.place, day, due, avg, sample: o.last });
  }
  return out.sort((a, b) => b.avg - a.avg);
}

/* ---------- 건 ----------
   테마는 어떤 종류의 일이냐(여행), 건은 그중 어느 일이냐(통영 3박4일)에 답한다.
   두 축이 따로 있으므로 한 줄이 테마 데이트이면서 건 강릉 2박3일 일 수 있다.
   연인과 간 여행은 연애 집계와 여행 집계 양쪽에 동시에 잡힌다. */
function eventRows(name) { return S.rows.filter(r => (r.event || "").trim() === name); }

/** 지금까지 쓴 건 이름들. 최근 것이 앞에 온다 */
function eventNames() {
  const m = new Map();
  for (const r of S.rows) {
    const k = (r.event || "").trim();
    if (!k) continue;
    const o = m.get(k) || { name: k, last: r.date };
    if (r.date > o.last) o.last = r.date;
    m.set(k, o);
  }
  return Array.from(m.values()).sort((a, b) => a.last < b.last ? 1 : -1).map(x => x.name);
}

/** 건 하나의 됨됨이. 기간과 박수는 적어 둔 줄에서 저절로 나온다 */
function eventStat(name) {
  const rs = eventRows(name);
  if (!rs.length) return null;
  const ds = rs.map(r => r.date).sort();
  /* 예약은 여행보다 몇 달 앞선다. 현지에서 쓴 날만으로 기간을 잡아야 박수가 맞는다 */
  const onSite = rs.filter(r => r.sub !== "여행예약" && r.sub !== "항공" && r.sub !== "계좌이체");
  const od = (onSite.length ? onSite : rs).map(r => r.date).sort();
  const nights = Math.max(0, Math.round((new Date(od[od.length-1]) - new Date(od[0])) / 86400000));
  const who = Array.from(new Set(rs.map(r => (r.with || "").trim()).filter(Boolean)));
  const share = Array.from(new Set(rs.map(r => r.share).filter(s => s && s !== "내 몫 전부")));
  const kind = who.includes("가족") || share.includes("가족 넷이서") ? "가족"
    : share.includes("연인과 반반") || rs.some(r => r.theme === "데이트" || r.treat === "연인") ? "연인"
      : who.includes("동생") || share.includes("동생과 반반") ? "동생"
        : who.length ? "지인" : "혼자";
  return {
    name, n: rs.length, rows: rs,
    mine: rs.reduce((a, r) => a + r.mine, 0), amt: rs.reduce((a, r) => a + r.amt, 0),
    from: od[0], to: od[od.length - 1], first: ds[0], nights, kind, who,
    perDay: Math.round(rs.reduce((a, r) => a + r.mine, 0) / Math.max(1, nights + 1)),
  };
}
function allEvents() { return eventNames().map(eventStat).filter(Boolean); }

/** 이 날짜를 품는 건이 이미 있나. 입력할 때 저절로 채워 주려는 것 */
function eventForDate(date) {
  if (!date) return "";
  for (const e of allEvents()) {
    if (date >= e.from && date <= e.to) return e.name;
  }
  return "";
}

/* ---------- 테마 ----------
   업종 칸을 건드리지 않고, 이미 적어 둔 축들을 엮어서 본다. */
const THEMES = [
  { id: "여행", name: "여행", desc: "여행 대분류와 테마가 여행인 기록", f: r => r.big === "여행" || r.theme === "여행" },
  { id: "부모님", name: "부모님", desc: "대접이 부모님인 기록. 용돈과 물건 선물이 함께 잡힙니다", f: r => r.treat === "부모님" },
  { id: "용돈", name: "용돈", desc: "소분류가 용돈인 기록", f: r => r.sub === "용돈" },
  { id: "연인", name: "연인", desc: "테마가 데이트이거나 대접이 연인, 또는 둘이 반씩 나눈 기록", f: r => r.theme === "데이트" || r.treat === "연인" || r.share === "연인과 반반" },
  { id: "소개팅", name: "소개팅", desc: "테마를 소개팅으로 적어 둔 기록. 동행 칸에 상대 이름이 들어갑니다", f: r => r.theme === "소개팅" },
  { id: "동생", name: "동생", desc: "동생과 반씩 나눈 살림과 동생에게 쓴 기록", f: r => r.treat === "동생" || r.share === "동생과 반반" },
  { id: "일시성", name: "일시성", desc: "한 번으로 끝나는 큰 지출로 표시해 둔 기록", f: r => r.once === "Y" },
  { id: "환불", name: "환불", desc: "돌려받은 돈. 금액이 음수인 줄입니다. 원래 결제 줄은 그대로 두고 돌려받은 날에 따로 적습니다", f: r => isRefund(r) },
];
function themeRows(id) { const t = THEMES.find(x => x.id === id); return t ? S.rows.filter(r => isOut(r) && t.f(r)) : []; }

/* ---------- 색 ---------- */
const BIGCOLOR = {
  "식비": "#F2A65A", "카페/간식": "#F6C177", "배달": "#E8833A", "술/유흥": "#D9744F",
  "교통": "#7FB4F2", "여행": "#A78BFA", "공과금": "#94A3B8", "통신": "#6FA8EA", "주거": "#8492AD",
  "의료/건강": "#57D6A9", "뷰티/미용": "#7FD6C0", "운동": "#3FBF97",
  "편의점/마트": "#E6C97F", "온라인쇼핑": "#D8B45E", "패션/잡화": "#F27BA0",
  "문화/여가": "#8F7AE8", "교육": "#9B8BF0", "경조/선물": "#E48BC0",
  "금융/세금": "#8FD3E8", "이체/저축": "#7FB4F2", "생활서비스": "#9AA6BC", "반려동물": "#A3D977",
  "수입": "#57D6A9", "기타": "#6B7280",
};
const colorOf = b => BIGCOLOR[b] || "#98A2B3";
