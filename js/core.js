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
   해마다 한 번만 서버에 묻는다. 대체공휴일도 함께 온다.
   예전에는 켤 때마다 다시 물었다. 지난 해의 공휴일은 바뀌지 않는데도
   앱을 열 때마다 왕복이 한 번 더 있었다. 기기에 담아 두고 지난 해는 다시 묻지 않는다. */
const HOL_KEY = "jh_hol_v1";
const HOL = { map: {}, asked: {} };
function holidayOf(date) { return HOL.map[date] || ""; }
function holLoad() {
  try {
    const j = JSON.parse(localStorage.getItem(HOL_KEY) || "null");
    if (!j || !j.map) return;
    const thisY = +todayISO().slice(0, 4);
    Object.assign(HOL.map, j.map);
    /* 올해와 내년은 아직 고시가 늦게 나올 수 있으니 하루 지나면 다시 묻는다.
       지난 해는 한 번 받으면 끝이다 */
    const fresh = (Date.now() - (j.at || 0)) < 86400000;
    (j.years || []).forEach(y => { if (+y < thisY || fresh) HOL.asked[y] = true; });
  } catch (e) { }
}
function holSave() {
  try {
    localStorage.setItem(HOL_KEY, JSON.stringify({
      at: Date.now(), map: HOL.map, years: Object.keys(HOL.asked),
    }));
  } catch (e) { }
}
async function ensureHolidays(y) {
  if (!y || HOL.asked[y]) return false;
  HOL.asked[y] = true;
  try {
    const j = await post("holidays", { y: y }, { tries: 2, timeout: 20000 });
    Object.assign(HOL.map, j.days || {});
    holSave();
    return true;
  } catch (e) { HOL.asked[y] = false; return false; }
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
    /* 부담률 0 은 [남이 낸 것] 이다. 빈칸일 때만 1 로 본다.
       예전에는 0 을 빈칸과 똑같이 보아 1 로 되돌려 놓았다.
       그래서 남이 사준 11,000원짜리가 내 지출로 그대로 잡히고 있었다 */
    const rateTxt = g(r, "부담률");
    let rate = 1;
    if (rateTxt !== "") {
      const rv = numOf(rateTxt);
      rate = rateTxt.indexOf("%") >= 0 ? rv / 100 : (rv > 1.5 ? rv / 100 : rv);
      if (!isFinite(rate) || rate < 0) rate = 1;
    }
    const disc = Math.max(0, Math.min(amt, numOf(g(r, "할인"))));
    const real = amt - disc;                       /* 할인을 뺀, 실제로 나간 돈 */
    /* 내 몫도 같다. 0 을 빈칸으로 보면 시트가 0 이라고 적어 준 것을 앱이 무시한다 */
    const mineTxt = g(r, "내 몫");
    const mine = mineTxt !== "" ? numOf(mineTxt) : Math.round(real * rate);
    out.push({
      no: numOf(g(r, "no")), 검수: g(r, "검수"), date, sub, big: g(r, "대분류"),
      kind: g(r, "구분") || "지출", amt, share: g(r, "누구 몫") || "내 몫 전부",
      rate: rate, mine, place: g(r, "장소"), detail: g(r, "세부내역"),
      situ: g(r, "상황"), once: g(r, "일시성"), treat: g(r, "대접"), theme: g(r, "테마"),
      with: g(r, "동행"), pay: g(r, "결제수단"), memo: g(r, "메모"),
      time: hhmm(g(r, "시각")), disc, discBy: g(r, "할인수단"), real,
      event: g(r, "건"),
      /* 나눈 축. [누구 몫] 하나가 구성과 인원 두 질문을 담고 있던 것을 푼 것이다.
         옛 줄은 이 칸이 비어 있으므로 분류표 사전에서 되짚는다 */
      group: g(r, "구성"), people: numOf(g(r, "인원")),
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

/* ---------- 서버에 묻기 ----------
   예전에는 fetch 한 뒤 바로 res.json() 을 불렀다.
   구글이 JSON 이 아니라 오류 화면(HTML)을 돌려줄 때가 있는데 그러면
   [Unexpected token '<', "<!DOCTYPE "... is not valid JSON] 이 그대로 화면에 떴다.
   이 말은 무엇을 해야 하는지 알려 주지 않는다. 게다가 그 HTML 은 거의 다
   잠깐 스쳐 가는 것이라 한 번 더 물으면 대개 제대로 온다. 그래서 세 가지를 더했다.
   1) 글로 먼저 받아 보고 JSON 인지 본다  2) 스쳐 가는 실패는 조용히 다시 묻는다
   3) 서버가 아예 대답을 안 하면 기다리다 끊는다 */
const NET = { inflight: new Map(), lastErr: "" };

const sleep = ms => new Promise(r => setTimeout(r, ms));

function netError(msg, retryable, kind) {
  const e = new Error(msg);
  e.retryable = !!retryable;
  e.kind = kind || "";
  return e;
}

function checkUrl() {
  const u = CONFIG.APPS_SCRIPT_URL;
  if (!u) throw netError("APPS_SCRIPT_URL 이 비어 있습니다", false, "url");
  if (/\/macros\/library\//.test(u))
    throw netError("라이브러리 주소가 들어 있습니다. 웹 앱 주소(/exec 로 끝나는 것)를 넣어 주세요", false, "url");
  return u;
}

async function postOnce(action, payload, ms) {
  const url = checkUrl();
  let ctl = null, timer = 0;
  if (typeof AbortController === "function") {
    ctl = new AbortController();
    timer = setTimeout(() => { try { ctl.abort(); } catch (e) { } }, ms);
  }
  let res;
  try {
    res = await fetch(url, {
      method: "POST", redirect: "follow",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(Object.assign({ action }, payload || {})),
      signal: ctl ? ctl.signal : undefined,
    });
  } catch (e) {
    if (e && e.name === "AbortError")
      throw netError("서버가 " + Math.max(1, Math.round(ms / 1000)) + "초 안에 대답하지 않았습니다", true, "timeout");
    throw netError("서버에 닿지 못했습니다 (" + String(e && e.message || e) + ")", true, "net");
  } finally { if (timer) clearTimeout(timer); }

  /* 글로 먼저 받는다. JSON 이 아니어도 무엇이 왔는지 볼 수 있어야 한다 */
  let text;
  try { text = await res.text(); }
  catch (e) { throw netError("대답을 받다가 끊겼습니다", true, "cut"); }

  const head = (text || "").slice(0, 400);
  const looksHTML = /^\s*(<!DOCTYPE|<html|<HTML|<\?xml)/.test(head);

  if (looksHTML) {
    if (/accounts\.google\.com|ServiceLogin|계정에 로그인|Sign in/i.test(head))
      throw netError(
        "구글 로그인 화면이 왔습니다. 배포의 액세스 권한이 [모든 사용자] 가 아닙니다",
        false, "login");
    if (/quota|Too many|한도|초과/i.test(head))
      throw netError("구글 앱스 스크립트 하루 한도에 걸렸습니다. 잠시 뒤 다시 열어 주세요", false, "quota");
    /* 나머지 HTML 은 구글 쪽이 잠깐 미끄러진 것이다. 다시 물어 볼 값어치가 있다 */
    throw netError("구글이 자료 대신 오류 화면을 보냈습니다", true, "html");
  }
  if (!res.ok)
    throw netError("서버가 " + res.status + " 로 답했습니다", res.status >= 500 || res.status === 429, "http");
  if (!text || !text.trim())
    throw netError("서버가 빈 대답을 보냈습니다", true, "empty");

  let j;
  try { j = JSON.parse(text); }
  catch (e) { throw netError("서버 대답을 읽지 못했습니다", true, "parse"); }

  if (!j || !j.ok) throw netError(String((j && j.error) || "서버가 거절했습니다"), false, "deny");
  return j;
}

/** 스쳐 가는 실패는 조용히 다시 묻는다. 읽기만 다시 묻고 쓰기는 한 번만 보낸다 */
const WRITE = { add: 1, update: 1, del: 1, move: 1, reorder: 1, person: 1, tagEvent: 1, mailDone: 1, histSync: 1 };

async function post(action, payload, opt) {
  const o = opt || {};
  const isWrite = !!WRITE[action];
  const tries = o.tries || (isWrite ? 1 : 3);
  const ms = o.timeout || (action === "rows" ? 90000 : 45000);

  /* 같은 읽기가 겹쳐 들어오면 한 번만 보낸다. 켤 때 rows 가 두 번 나가던 것을 막는다 */
  const key = isWrite ? null : action + "|" + JSON.stringify(payload || {});
  if (key && NET.inflight.has(key)) return NET.inflight.get(key);

  const run = (async () => {
    let last;
    for (let i = 0; i < tries; i++) {
      try {
        const j = await postOnce(action, payload, ms);
        NET.lastErr = "";
        return j;
      } catch (e) {
        last = e;
        if (!e.retryable || i === tries - 1) break;
        await sleep(700 * Math.pow(2, i) + Math.floor(Math.random() * 400));
      }
    }
    NET.lastErr = last ? last.message : "";
    throw last;
  })();

  if (key) {
    NET.inflight.set(key, run);
    run.catch(() => { }).then(() => NET.inflight.delete(key));
  }
  return run;
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
  /* 서버가 시트 맨 아래에 붙였으니 담아 둔 원본에도 맨 아래에 붙인다 */
  if (S.raw && S.raw.head) S.raw.body.push(values);
  cacheSave();
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
  const k = rawIndexOf(no);
  if (k >= 0) S.raw.body[k] = values;
  cacheSave();
  return r;
}
function patchDel(no) {
  const i = S.rows.findIndex(x => x.no === +no);
  if (i >= 0) S.rows.splice(i, 1);
  const k = rawIndexOf(no);
  if (k >= 0) S.raw.body.splice(k, 1);
  cacheSave();
}
function patchMove(no, dir) {
  const i = S.rows.findIndex(x => x.no === +no);
  if (i < 0) return;
  const j = dir === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= S.rows.length) return;
  if (S.rows[j].date !== S.rows[i].date) return;
  const noB = S.rows[j].no;
  const a = S.rows[i].seq;
  S.rows[i].seq = S.rows[j].seq;
  S.rows[j].seq = a;
  S.rows.sort((x, y) => x.date < y.date ? -1 : x.date > y.date ? 1 : x.seq - y.seq);
  patchRawSwap(+no, noB);
  cacheSave();
}
/** 담아 둔 원본에서 두 줄의 자리를 맞바꾼다. seq 는 원본에 놓인 차례이므로 원본도 같이 움직여야 한다 */
function patchRawSwap(noA, noB) {
  const a = rawIndexOf(noA), b = rawIndexOf(noB);
  if (a < 0 || b < 0 || a === b) return;
  const t = S.raw.body[a]; S.raw.body[a] = S.raw.body[b]; S.raw.body[b] = t;
}
/** 하루치 차례를 통째로 다시 놓는다. 원장의 [이대로 저장] 이 쓴다 */
function patchRawOrder(nos) {
  if (!S.raw || !S.raw.head) return;
  const idx = nos.map(rawIndexOf);
  if (idx.some(i => i < 0)) return;
  const spots = idx.slice().sort((a, b) => a - b);
  const taken = idx.map(i => S.raw.body[i]);
  spots.forEach((p, k) => { S.raw.body[p] = taken[k]; });
}
/** 여러 줄의 한 칸만 고친다. 건 이름 붙이기가 쓴다 */
function patchRawField(nos, col, val) {
  if (!S.raw || !S.raw.head) return;
  const c = S.raw.head.indexOf(col);
  if (c < 0) return;
  nos.forEach(no => { const i = rawIndexOf(no); if (i >= 0) S.raw.body[i][c] = val; });
}

/* ---------- 지난번 자료를 기기에 담아 둔다 ----------
   앱을 켤 때 시트를 다 읽기 전에 지난번 것으로 먼저 그려 준다.
   그 뒤 새 자료가 오면 조용히 다시 그린다.

   예전에는 한 줄만 고쳐도 cacheDrop() 으로 담아 둔 것을 통째로 버렸다.
   가계부는 거의 날마다 적는 것이라, 사실상 켤 때마다 담아 둔 것이 없는 채로
   시트를 다 읽을 때까지 빈 화면을 보고 있어야 했다. 이것이 [너무 오래 걸린다] 의 정체다.
   이제는 버리지 않고 방금 고친 줄을 담아 둔 것에도 똑같이 반영한다.
   시트와 조금 어긋나더라도 켤 때 뒤에서 도는 loadAll 이 곧 바로잡는다. */
const CACHE_KEY = "jh_rows_v1";
let CACHE_T = 0;

/** 담아 둘 값어치가 있는 줄인가. rowsFromTable 이 버리는 줄은 담지도 않는다.
    시트 맨 아래에 자료 없이 수식만 남은 줄이 이천 줄 넘게 있어서 그냥 담으면 그만큼 낭비다 */
function keepBody(head, body) {
  const ix = {}; head.forEach((h, i) => { ix[String(h || "").trim()] = i; });
  const di = ix["날짜"];
  if (di == null) return body;
  return body.filter(r => !!normDate(String(r[di] == null ? "" : r[di]).trim()));
}

function cacheSave() {
  if (!S.raw || !S.raw.head) return;
  clearTimeout(CACHE_T);
  /* 담는 일로 첫 그림을 막지 않는다. 9천 줄을 글로 바꾸는 데 시간이 걸린다 */
  CACHE_T = setTimeout(() => {
    try {
      const s = JSON.stringify({
        at: S.raw.at || Date.now(), head: S.raw.head, body: S.raw.body,
        meta: S.meta, people: S.people, mailPresets: S.mailPresets, version: S.server,
      });
      if (s.length > 4200000) return;          /* 너무 크면 담지 않는다 */
      localStorage.setItem(CACHE_KEY, s);
    } catch (e) { }
  }, 0);
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
function cacheDrop() { try { clearTimeout(CACHE_T); localStorage.removeItem(CACHE_KEY); } catch (e) { } }

/** 담아 둔 원본에서 no 로 줄을 찾는다 */
function rawIndexOf(no) {
  if (!S.raw || !S.raw.head) return -1;
  const i = S.raw.head.indexOf("no");
  if (i < 0) return -1;
  return S.raw.body.findIndex(r => numOf(r[i]) === +no);
}

/** 자료를 앱에 앉힌다. */
function seatData(j) {
  const head = j.head || [];
  const body = keepBody(head, j.body || []);
  S.raw = { head, body, at: j.at || Date.now() };
  S.rows = rowsFromTable(head, body);
  S.meta = j.meta || null;
  S.people = j.people || { intro: [], love: [] };
  S.mailPresets = j.mailPresets || [];
  S.server = j.version || "";
  S.ready = true;
}

/** fresh 가 참이면 서버가 담아 둔 것을 건너뛰고 시트를 새로 읽는다. [갱신] 단추가 쓴다 */
async function loadAll(fresh) {
  const j = await post("rows", fresh ? { fresh: true } : {});
  S.from = j.from || "";
  j.at = Date.now();
  seatData(j);
  cacheSave();
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

/* ---------- 누구 몫 사전 ----------
   분류표가 [누구 몫][구성][인원] 세 칸짜리 표를 함께 보내 준다.
   앱은 구성과 인원으로 고르고, 시트에 들어가는 이름은 여기서 찾는다. */
function shareOf(name) {
  const list = (S.meta && S.meta.shares) || [];
  return list.find(x => x.name === name) || null;
}
function shareName(group, people) {
  const list = (S.meta && S.meta.shares) || [];
  const hit = list.find(x => x.group === group && Number(x.people) === Number(people));
  return hit ? hit.name : "";
}
/** 한 줄의 구성과 인원. 칸이 비어 있으면 누구 몫에서 되짚는다 */
function groupOf(r) {
  if (r.group) return { group: r.group, people: r.people || 0 };
  const s = shareOf(r.share);
  return s ? { group: s.group, people: s.people } : { group: "", people: 0 };
}

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
  const kind = who.includes("가족") || share.some(s => /^가족/.test(s)) ? "가족"
    : share.some(s => /^연인/.test(s)) || rs.some(r => r.theme === "데이트" || r.treat === "연인") ? "연인"
      : who.includes("동생") || share.some(s => /^동생/.test(s)) ? "동생"
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
  { id: "연인", name: "연인", desc: "테마가 데이트이거나 대접이 연인, 또는 둘이 반씩 나눈 기록", f: r => r.theme === "데이트" || r.treat === "연인" || /^연인/.test(r.share) },
  { id: "소개팅", name: "소개팅", desc: "테마를 소개팅으로 적어 둔 기록. 동행 칸에 상대 이름이 들어갑니다", f: r => r.theme === "소개팅" },
  { id: "동생", name: "동생", desc: "동생과 반씩 나눈 살림과 동생에게 쓴 기록", f: r => r.treat === "동생" || /^동생/.test(r.share) },
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
