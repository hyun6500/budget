/* ===== js/core-asset.js ===== */
/* core-asset.js - 자산(두 번째 DB) 저장고, 읽어 주는 말, 물가지수, 고정비.
   core.js 다음에 와야 한다. */
FILEV.coreAsset = CONFIG.APP_VERSION;
/* ---------- 자산 (두 번째 DB. 읽기 전용) ----------
   2026-10 부터 새 자산 시트([@] 보유 자산 정리 (NEW))를 읽는다.
   서버가 [_앱연동] 블록(meta, accounts, holdings, tree, years)과
   매매기록(lots), 입출금배당(cash), 자산기록(history)을 보내 준다.
   현재가, 환율, 평가액, 손익은 시트가 계산한 값을 그대로 쓴다. 앱에서 다시 계산하지 않는다.
   시세와 환율이 시트에만 있어서, 두 곳에서 계산하면 숫자가 어긋난다. 여기서는 묶어 더하기만 한다. */
const A = { data: null, loaded: false, denied: false, reason: "" };

const nz = v => (typeof v === "number" && isFinite(v)) ? v : 0;
const isNum = v => typeof v === "number" && isFinite(v);
function assetMeta() { return (A.data && A.data.meta) || {}; }
/** 새 서버(VERSION 8)가 보낸 자료인가. 예전 서버면 meta 칸과 api 칸이 아예 없다.
    새 서버가 예전 자산 시트를 읽으면 meta 는 비고 api 는 빈 글자다. 그때는 reason 이 no_link 로 온다 */
function assetNew() { return !!(A.data && A.data.meta && typeof A.data.api === "string"); }

/** 원금 기준 총자산. 가계부와 맞물리는 쪽 */
function assetTotal() {
  const m = assetMeta();
  return isNum(m.total_principal) ? m.total_principal : (A.data ? nz(A.data.total) : 0);
}
/** 투자 손익 반영 총자산. 증권 잔고와 VC 를 지금 값으로 친 것 */
function assetValued() {
  const m = assetMeta();
  return isNum(m.total_valued) ? m.total_valued : (A.data ? (nz(A.data.valued) || nz(A.data.total)) : 0);
}
function assetGap() { return assetValued() - assetTotal(); }   /* 평가손익 */
/** 자산 숫자의 기준일. 가계부와 갱신 주기가 달라 어디에나 붙인다 */
function assetAsOf() {
  const m = assetMeta();
  return String(m.asset_updated || m.last_record || (A.data && A.data.asOf) || "");
}

/** 시세 기준 시각과, 오늘까지 며칠째 그대로인지. 시세는 자산 시트의 스크립트가 평일 저녁에 적는다 */
const PRICE_STALE_DAYS = 3;
function priceAge() {
  const text = String(assetMeta().price_as_of || "");
  const d = normDate(text);
  if (!d) return { text, date: "", days: null, stale: false };
  const days = Math.round((new Date(todayISO() + "T00:00:00") - new Date(d + "T00:00:00")) / 86400000);
  return { text, date: d, days, stale: days > PRICE_STALE_DAYS };
}

/** 자산 구성 트리를 대분류 > 중분류 > 항목 으로 묶는다. 시트가 그 차례대로 내보낸다 */
function assetTree() {
  const out = [];
  let g = null, s = null;
  for (const t of ((A.data && A.data.tree) || [])) {
    const lv = Number(t.level);
    const node = Object.assign({}, t, { lv, kids: [] });
    if (lv === 1) { node.name = t.group || ""; out.push(node); g = node; s = null; }
    else if (lv === 2) { node.name = t.subgroup || ""; (g ? g.kids : out).push(node); s = node; }
    else { node.name = t.item || ""; ((s || g) ? (s || g).kids : out).push(node); }
  }
  return out;
}
/** 대분류. 0원인 것(외화)은 뺀다 */
function assetTop() { return assetTree().filter(n => nz(n.principal) || nz(n.valued)); }

/** 예적금 만기. 0.자산 세부 항목의 만기일(K열)이 적힌 것만 */
function maturities() {
  const out = [];
  for (const t of ((A.data && A.data.tree) || [])) {
    if (Number(t.level) !== 3 || !t.due) continue;
    const due = normDate(String(t.due));
    const days = due ? Math.round((new Date(due + "T00:00:00") - new Date(todayISO() + "T00:00:00")) / 86400000) : null;
    out.push({ name: t.item || "", amt: nz(t.valued) || nz(t.principal), rate: t.rate || "", note: t.memo || "", due: due || String(t.due), days });
  }
  return out.sort((a, b) => (a.days == null ? 9e9 : a.days) - (b.days == null ? 9e9 : b.days));
}
/** 만기일이 아직 비어 있는 예적금. [예적금] 중분류 아래에서 비고에 [만기] 가 적힌 것 */
function depositsNoDue() {
  const out = [];
  let sub = "";
  for (const t of ((A.data && A.data.tree) || [])) {
    const lv = Number(t.level);
    if (lv === 1) sub = "";
    else if (lv === 2) sub = t.subgroup || "";
    else if (lv === 3 && /예적금|예금|적금/.test(sub) && !t.due && /만기/.test(t.memo || ""))
      out.push({ name: t.item || "", amt: nz(t.principal), rate: t.rate || "", note: t.memo || "" });
  }
  return out;
}

/** 순자산 곡선.
   7.자산기록의 기록(원금 기준, 투자 손익 반영)을 그대로 쓰고,
   그 앞 구간은 가계부의 (수입 - 지출)을 첫 기록(first_record)에서 거꾸로 빼서 되짚는다.
   되짚은 값은 추정이므로 화면에서 점선으로 구분한다. */
const BACKFILL_MONTHS = 36;   /* 되짚는 구간을 3년으로 끊는다. 더 멀리 가면 기록 밖의 돈이 다 쌓여 그림이 거짓말을 한다 */
function netWorthSeries() {
  const hist = ((A.data && A.data.history) || []).filter(h => h.d && isNum(h.principal))
    .slice().sort((a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : 0);
  if (!hist.length) return { est: [], real: [], anchor: null };
  const fr = assetMeta().first_record;
  const anchor = hist.find(h => h.d === fr) || hist[0];
  const anchorYM = ymOf(anchor.d);
  const ms = Array.from(new Set(S.rows.map(r => r.ym)))
    .filter(m => m && m < anchorYM && m <= ymOf(todayISO())).sort().slice(-BACKFILL_MONTHS);
  const est = [];
  let v = anchor.principal;
  for (let i = ms.length - 1; i >= 0; i--) {
    const st = monthStat(ms[i]);
    /* 그 달이 끝난 때의 값이라 다음 달 1일에 찍는다. 첫 기록 바로 앞 달은 첫 기록과 같은 점이 되어 선이 이어진다 */
    est.push({ d: shiftYM(ms[i], 1) + "-01", ym: ms[i], v: Math.round(v) });
    v -= (st.inc - st.out);
  }
  est.reverse();
  return {
    est, anchor,
    real: hist.map(h => ({ d: h.d, v: h.principal, valued: isNum(h.valued) ? h.valued : null })),
  };
}

/* ---------- 투자 ---------- */
function assetAccounts() { return (A.data && A.data.accounts) || []; }
function assetHoldings() { return (A.data && A.data.holdings) || []; }
/** 보유 종목을 테마나 자산군으로 묶는다. 평가액과 손익은 시트 값을 더하기만 하고, 묶음 수익률은 손익 합 / 매수금액 합 */
function holdingGroups(key) {
  const m = new Map();
  for (const h of assetHoldings()) {
    const k = h[key] || "기타";
    const o = m.get(k) || { key: k, n: 0, cost: 0, value: 0, pnl: 0, weight: 0, items: [] };
    o.n++; o.cost += nz(h.cost); o.value += nz(h.value); o.pnl += nz(h.pnl); o.weight += nz(h.weight); o.items.push(h);
    m.set(k, o);
  }
  return Array.from(m.values())
    .map(o => Object.assign(o, { ret: o.cost ? o.pnl / o.cost : null }))
    .sort((a, b) => b.value - a.value);
}
/** 참고용 계좌(엄마 CMA 처럼 accounts 의 kind 가 reference). 1-1 과 1-2 에는 이 계좌 줄도 섞여 있다.
    보유 종목(holdings)과 계좌 합계는 이미 이 계좌를 뺀 값이라, 묶음을 셀 때도 빼야 두 번 세지 않는다.
    보령은 1-1 에 엄마 CMA 묶음 4개(2,245주)가 있다 */
function refAccounts() { return new Set(assetAccounts().filter(a => a.kind === "reference").map(a => a.account)); }
const isMine = x => !refAccounts().has(x.account);
/** 내 계좌의 매매 묶음 */
function myLots() { return ((A.data && A.data.lots) || []).filter(isMine); }
/** 매매 성적표. 1-1 매매기록에서 매도된 묶음. 손익과 수익률은 시트 값 */
function lotStat() {
  const lots = myLots();
  const closed = lots.filter(l => l.status === "매도");
  const open = lots.filter(l => l.status !== "매도");
  const win = closed.filter(l => nz(l.pnl) > 0).length;
  return {
    closed, open, win, n: closed.length,
    pnl: closed.reduce((s, l) => s + nz(l.pnl), 0),
    cost: closed.reduce((s, l) => s + nz(l.cost), 0),
    winRate: closed.length ? win / closed.length : 0,
  };
}
/** 배당을 종목마다. 1-2 입출금배당의 [배당] 줄 */
function dividendsBy() {
  const m = new Map();
  for (const c of ((A.data && A.data.cash) || []).filter(isMine)) {
    if (c.kind !== "배당") continue;
    const k = c.name || c.ticker || "기타";
    const o = m.get(k) || { key: k, mine: 0, amt: 0, n: 0 };
    o.mine += nz(c.amount); o.amt += nz(c.amount); o.n++;
    m.set(k, o);
  }
  return Array.from(m.values()).sort((a, b) => b.mine - a.mine);
}

/* ---------- 한눈에 보기, 유동성, 변화 분해 (v2.11) ----------
   여기 숫자는 시트 값을 묶어 더하거나 나누기만 한다. 앱이 정한 규칙(유동성 단계)과
   어림(다음 1억까지)은 화면에 규칙과 근거를 함께 적는다. */

/** 지난 n 달 평균 지출과 수입. 이번 달은 아직 끝나지 않아 뺀다. 가계부 내 몫 기준 */
function ledgerMonthly(n) {
  const cur = ymOf(todayISO());
  const ms = Array.from(new Set(S.rows.map(r => r.ym))).filter(m => m && m < cur).sort().slice(-(n || 12));
  if (!ms.length) return { n: 0, out: 0, inc: 0, from: "", to: "" };
  let o = 0, i = 0;
  for (const m of ms) { const st = monthStat(m); o += st.out; i += st.inc; }
  return { n: ms.length, out: o / ms.length, inc: i / ms.length, from: ms[0], to: ms[ms.length - 1] };
}

/** 얼마나 빨리 꺼낼 수 있나. 시트에 이 칸이 없어 중분류와 항목 이름으로 앱이 나눈다.
    규칙은 위에서부터 먼저 맞는 것을 쓴다. 맞는 것이 없으면 [나누지 못한 것] 으로 따로 둔다 */
const LIQ_TIERS = [
  { key: "now", name: "바로 꺼낼 수 있는 돈", note: "입출금, 파킹, 외화 예금" },
  { key: "sell", name: "팔면 이틀", note: "증권 계좌. 값이 날마다 움직임" },
  { key: "term", name: "기한이 있는 돈", note: "예적금, 청약, 포인트와 상품권" },
  { key: "lock", name: "오래 묶인 돈", note: "연금, 비상장, 전세금, 출자금" },
];
const LIQ_RULES = [
  { item: /IRP|연금/, tier: 3 },
  { item: /출자금/, tier: 3 },
  { sub: /입출금|파킹|외화/, tier: 0 },
  { sub: /증권/, tier: 1 },
  { sub: /예적금|적금|예금|청약|포인트|상품권/, tier: 2 },
  { sub: /VC|비상장|전세|보증금/, tier: 3 },
];
function liquidity() {
  const tiers = LIQ_TIERS.map(t => Object.assign({}, t, { v: 0, items: [] }));
  const other = { key: "etc", name: "나누지 못한 것", note: "규칙에 맞는 이름이 없음", v: 0, items: [] };
  let total = 0;
  for (const g of assetTree()) {
    for (const s of g.kids) {
      const subName = s.lv === 2 ? s.name : g.name;
      for (const it of (s.lv === 2 ? s.kids : [s])) {
        const v = isNum(it.valued) ? it.valued : nz(it.principal);
        if (!v) continue;
        const rule = LIQ_RULES.find(r => (r.item && r.item.test(it.name || "")) || (r.sub && (r.sub.test(subName) || r.sub.test(g.name))));
        const box = rule ? tiers[rule.tier] : other;
        box.v += v; box.items.push({ name: it.name, sub: subName, v });
        total += v;
      }
    }
  }
  return { tiers, other, total };
}

/** 원금이 한 달에 느는 속도. 7.자산기록 첫 기록과 끝 기록 두 점의 기울기.
    다음 1억 단위까지 남은 달은 그 기울기를 그대로 늘인 어림이다 */
function assetPace() {
  const h = netWorthSeries().real;
  if (h.length < 2) return null;
  const a = h[0], b = h[h.length - 1];
  const days = (Date.parse(b.d) - Date.parse(a.d)) / 86400000;
  if (!(days >= 28)) return null;
  const perMonth = (b.v - a.v) / days * 30.44;
  const cur = assetTotal() || b.v;
  const target = Math.floor(cur / 1e8) * 1e8 + 1e8;
  const monthsLeft = perMonth > 0 ? (target - cur) / perMonth : null;
  let when = "";
  if (monthsLeft != null) {
    const d = new Date(todayISO() + "T00:00:00");
    d.setMonth(d.getMonth() + Math.round(monthsLeft));
    when = d.getFullYear() + "-" + pad2(d.getMonth() + 1);
  }
  return { from: a.d, to: b.d, days, perMonth, cur, target, left: target - cur, monthsLeft, when };
}

/** 지금 값. 7.자산기록 끝 줄보다 meta 가 더 새로울 수 있어 meta 를 쓴다 */
function assetNowPoint() { return { d: assetAsOf(), v: assetTotal(), valued: assetValued() }; }
/** 지금과 견줄 앞 기록. 끝 기록이 지금 값과 같은 날(또는 뒤)이면 그 앞 줄 */
function assetPrevPoint() {
  const h = netWorthSeries().real;
  if (!h.length) return null;
  const last = h[h.length - 1];
  const p = last.d >= assetAsOf() ? h[h.length - 2] : last;
  return p || null;
}

/** 두 때 사이에 순자산이 바뀐 까닭.
    손익 반영 순자산 변화 = 가계부 저축(수입 - 지출) + 기록 밖 차이 + 투자 손익 변화.
    a, b = { d, v(원금), valued }. 가계부는 a 다음 날부터 b 날까지 센다(두 구간이 겹치지 않게) */
function assetChange(a, b) {
  const rs = S.rows.filter(r => r.date > a.d && r.date <= b.d);
  const flow = sumMine(rs, isIn) - sumMine(rs, isOut);
  const dp = b.v - a.v;
  const hasV = isNum(a.valued) && isNum(b.valued);
  const invest = hasV ? (b.valued - b.v) - (a.valued - a.v) : null;
  const start = hasV ? a.valued : a.v, end = hasV ? b.valued : b.v;
  return { a, b, flow, dp, resid: dp - flow, invest, start, end, change: end - start, hasV, n: rs.length };
}

/** 보유 종목 쏠림. 평가액은 시트 값 */
function holdingStats() {
  const hs = assetHoldings().slice().sort((a, b) => nz(b.value) - nz(a.value));
  const tv = hs.reduce((s, h) => s + nz(h.value), 0);
  const share = v => tv ? v / tv : 0;
  const cur = new Map();
  for (const h of hs) { const k = h.currency || "KRW"; cur.set(k, (cur.get(k) || 0) + nz(h.value)); }
  const foreign = Array.from(cur.entries()).filter(([k]) => k !== "KRW")
    .map(([k, v]) => ({ cur: k, v, w: share(v) })).sort((a, b) => b.v - a.v);
  const themes = holdingGroups("theme");
  const loss = hs.reduce((s, h) => s + Math.min(0, nz(h.pnl)), 0);
  return {
    hs, tv, top: hs[0] || null, topW: hs[0] ? share(nz(hs[0].value)) : 0,
    top5W: share(hs.slice(0, 5).reduce((s, h) => s + nz(h.value), 0)),
    foreign, foreignW: foreign.reduce((s, f) => s + f.w, 0),
    theme: themes[0] || null, themeW: themes[0] ? share(themes[0].value) : 0,
    pnl: hs.reduce((s, h) => s + nz(h.pnl), 0), loss,
  };
}

/** 증권 계좌에 넣은 돈 누적. 1-2 입출금배당의 입금 - 출금. 배당은 넣은 돈이 아니라 뺀다. 같은 날은 한 점 */
function depositSteps() {
  const cs = ((A.data && A.data.cash) || []).filter(isMine)
    .filter(c => (c.kind === "입금" || c.kind === "출금") && /^\d{4}-\d{2}-\d{2}/.test(c.date || "") && isNum(c.amount))
    .slice().sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  const pts = [];
  let v = 0;
  for (const c of cs) {
    v += (c.kind === "입금" ? 1 : -1) * Math.abs(c.amount);
    const d = c.date.slice(0, 10);
    if (pts.length && pts[pts.length - 1].d === d) pts[pts.length - 1].v = v; else pts.push({ d, v });
  }
  return pts;
}

/** 한 종목의 매매 묶음과 배당. 묶음은 티커로, 배당은 1-2 에 티커가 비어 있는 줄이 많아 이름으로도 찾는다 */
function lotsOf(ticker) { return myLots().filter(l => String(l.ticker) === String(ticker)); }
/** 참고용 계좌의 같은 종목 묶음. 상세 창에서 뺐다고 알릴 때만 센다 */
function refLotsOf(ticker) { return ((A.data && A.data.lots) || []).filter(l => !isMine(l) && String(l.ticker) === String(ticker)); }
function dividendsOf(h) {
  return ((A.data && A.data.cash) || []).filter(isMine).filter(c => c.kind === "배당" &&
    ((c.ticker && String(c.ticker) === String(h.ticker)) || (c.name && c.name === h.name)));
}

/** 연봉 곡선. 계약 연봉이 적힌 단계만 */
function salarySteps() {
  return ((A.data && A.data.salary) || []).filter(s => s.base).map(s => ({
    company: s.company, date: s.date, base: s.base, raise: s.raise, reason: s.reason, note: s.note,
  }));
}

/** 사이드 인컴. 시트는 연도별 합계라 거래로 더하지 않고 그대로 보여 준다 */
function sideByYear() {
  const m = new Map();
  for (const x of ((A.data && A.data.side) || [])) {
    if (!x.year) continue;
    const o = m.get(x.year) || { year: x.year, total: 0, items: [] };
    o.total += x.total || 0; o.items.push(x); m.set(x.year, o);
  }
  return Array.from(m.values()).sort((a, b) => b.year - a.year);
}


/* ---------- 읽어 주는 말 (규칙 기반) ----------
   통계 신호를 찾아 한국어 문장으로 바꾼다. 점수가 높은 것 몇 개만 내보낸다. */
const INSIGHT = (() => {

  function bigAvg(big, exceptYM, n) {
    const ms = Array.from(new Set(S.rows.map(r => r.ym))).filter(m => m && m !== exceptYM && m < exceptYM).sort().slice(-(n || 12));
    if (!ms.length) return 0;
    let s = 0;
    for (const m of ms) s += sumMine(monthRows(m), r => isOut(r) && (r.big || "기타") === big);
    return s / ms.length;
  }

  /* 진행 중인 달이면 지난 날 비율만큼 평균을 깎아서 견준다 */
  function fraction(ym) {
    if (ym !== ymOf(todayISO())) return 1;
    const d = new Date(), last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return Math.min(1, d.getDate() / last);
  }

  function build(ym) {
    const out = [];
    const rs = monthRows(ym), now = monthStat(ym), prev = monthStat(shiftYM(ym, -1));
    const partial = ym === ymOf(todayISO());
    const frac = fraction(ym);

    /* 0. 이 달에 돌려받은 돈. 지출이 줄어 보이는 까닭을 먼저 밝힌다 */
    if (now.refund > 0) {
      out.push({
        score: 58, kind: "down", tag: "환불",
        html: "이 달에 <b>" + won(now.refund) + "원</b>을 돌려받았습니다 (" + now.refundN +
          "건). 위의 지출 금액은 이미 그만큼 빠진 값입니다.",
      });
    }

    /* 1. 대분류 급등, 급락 */
    for (const b of byKey(rs.filter(isOut), r => r.big || "기타")) {
      if (b.mine < 0) continue;        /* 환불이 더 큰 달은 늘고 줄고를 따질 자리가 아니다 */
      const avg = bigAvg(b.key, ym) * frac;
      if (avg < 20000 && b.mine < 30000) continue;
      if (!avg) continue;
      const d = (b.mine - avg) / avg;
      if (Math.abs(d) < 0.4 || Math.max(b.mine, avg) < 30000) continue;
      if (partial && d < 0) continue;   /* 아직 끝나지 않은 달의 "아꼈다"는 성급하다 */
      const top = rs.filter(r => isOut(r) && (r.big || "기타") === b.key).sort((x, y) => y.mine - x.mine)[0];
      const why = top && top.mine > b.mine * 0.4 ? " " + esc(top.place || top.sub) + "(" + won(top.mine) + "원)이 컸습니다." : "";
      out.push({
        score: Math.abs(d) * Math.min(b.mine, 500000) / 1000,
        kind: d > 0 ? "up" : "down",
        tag: d > 0 ? "늘었다" : "줄었다",
        html: d > 0
          ? (d >= 2
            ? "<b>" + esc(b.key) + "</b>가 평소의 <b>" + (d + 1).toFixed(1) + "배</b>입니다." + why
            : "<b>" + esc(b.key) + "</b>가 평소보다 <b>" + Math.round(d * 100) + "%</b> 늘었습니다." + why)
          : "<b>" + esc(b.key) + "</b>를 평소보다 <b>" + Math.round(-d * 100) + "%</b> 덜 썼습니다.",
      });
    }

    /* 2. 석 달 내리 줄어든 대분류 */
    const ms4 = [shiftYM(ym, -3), shiftYM(ym, -2), shiftYM(ym, -1), ym];
    for (const b of byKey(rs.filter(isOut), r => r.big || "기타")) {
      const seq = ms4.map(m => sumMine(monthRows(m), r => isOut(r) && (r.big || "기타") === b.key));
      if (seq.every(v => v > 10000) && seq[0] > seq[1] && seq[1] > seq[2] && seq[2] > seq[3]) {
        out.push({ score: 42, kind: "down", tag: "석 달", html: "<b>" + esc(b.key) + "</b>가 석 달 내리 줄고 있습니다." });
        break;
      }
    }

    /* 3. 올해 저축률과 역대 최고 */
    const y = ym.slice(0, 4);
    const yr = yearStat(y);
    if (yr.inc > 0) {
      const past = years().filter(k => k < y).map(k => yearStat(k)).filter(s => s.months >= 10 && s.inc > 0);
      const best = past.length ? Math.max(...past.map(s => (s.inc - s.out) / s.inc)) : 0;
      const rate = (yr.inc - yr.out) / yr.inc;
      if (past.length && rate > best)
        out.push({ score: 56, kind: "gold", tag: "최고", html: "올해 저축률 <b>" + Math.round(rate * 100) + "%</b>. 기록상 가장 높은 흐름입니다." });
      else if (past.length)
        out.push({ score: 20, kind: "", tag: "저축률", html: "올해 누적 저축률 <b>" + Math.round(rate * 100) + "%</b>. 역대 최고는 " + Math.round(best * 100) + "%입니다." });
    }

    /* 4. 전월 대비 총지출 */
    if (!partial && prev.out) {
      const d = (now.out - prev.out) / prev.out;
      if (Math.abs(d) >= 0.15)
        out.push({
          score: 30, kind: d > 0 ? "up" : "down", tag: d > 0 ? "전월" : "전월",
          html: d > 0 ? "총지출이 지난달보다 <b>" + Math.round(d * 100) + "%</b> 많습니다."
            : "총지출을 지난달보다 <b>" + Math.round(-d * 100) + "%</b> 줄였습니다.",
        });
    }

    /* 5. 숨은 절약 */
    const sv = rs.filter(r => SAVE_RE.test((r.memo || "") + " " + (r.detail || "")));
    if (sv.length >= 3)
      out.push({ score: 18, kind: "down", tag: "절약", html: "이 달에 할인이나 캐시백을 챙긴 기록이 <b>" + sv.length + "건</b> 있습니다." });

    /* 6. 자산이 붙어 있으면, 모은 돈과 남은 돈이 다르다는 것 */
    if (assetNew() && assetGap() < 0) {
      out.push({
        score: 48, kind: "up", tag: "평가손",
        html: "모은 돈은 <b>" + wonS(assetTotal()) + "</b>인데 지금 값은 <b>" + wonS(assetValued()) +
          "</b>입니다. 투자에서 <b>" + wonS(Math.abs(assetGap())) + "</b>이 빠져 있습니다. (" + esc(assetAsOf()) + " 기준)",
      });
    }

    /* 7. 예적금 만기. 가장 가까운 한 건만. 같은 날 여러 건이면 묶어서 한 줄로 */
    const near = maturities().filter(m => m.days != null && m.days <= 45 && m.days >= -120);
    if (near.length) {
      const due = near[0].due;
      const same = near.filter(m => m.due === due);
      const amt = same.reduce((a, m) => a + (m.amt || 0), 0);
      const nm = same.length > 1 ? same[0].name + " 외 " + (same.length - 1) + "건" : same[0].name;
      const d = same[0].days;
      out.push({
        score: 60, kind: "gold", tag: "만기",
        html: "<b>" + esc(nm) + " " + wonS(amt) + "</b>이 " + esc(due) +
          (d >= 0 ? " 만기입니다. " + d + "일 남았습니다." : " 만기였습니다. " + (-d) + "일 지났습니다.") +
          " 자산 탭에서 금리와 함께 봅니다.",
      });
    }

    out.sort((a, b) => b.score - a.score);
    return out.slice(0, 4);
  }
  return { build };
})();

const SAVE_RE = /(캐시백|페이백|할인|포인트|쿠폰|환급|서울사랑|온누리|상품권|적립|무료)/;

/* ---------- 연 단위 집계 ---------- */
function years() { return Array.from(new Set(S.rows.map(r => r.y))).filter(Boolean).sort(); }
function yearStat(y) {
  const rs = S.rows.filter(r => r.y === y);
  const ms = new Set(rs.map(r => r.ym));
  const inc = sumMine(rs, isIn), out = sumMine(rs, isOut);
  return { y, inc, out, mov: sumMine(rs, isMov), outFull: sumAmt(rs, isOut), months: ms.size, n: rs.length, left: inc - out };
}

/* ---------- 날마다 (잔디) ---------- */
function dayMap() {
  const m = new Map();
  for (const r of S.rows) if (isOut(r)) m.set(r.date, (m.get(r.date) || 0) + r.mine);
  return m;
}

/* ---------- 개인 물가지수 ----------
   같은 곳에서 되풀이해 산 것의 건당 평균이 해마다 어떻게 변했나.
   해가 셋 이상이고 해마다 세 번 이상 간 곳만 본다. */
function cpiItems(minYears, minPerYear) {
  const my = minYears || 3, mp = minPerYear || 3;
  const byPlace = new Map();
  for (const r of S.rows) {
    if (!isOut(r) || !r.place || !r.mine || r.mine < 0) continue;   /* 환불 줄은 건당 평균을 흔든다 */
    const p = r.place.trim(); if (!p) continue;
    const o = byPlace.get(p) || new Map();
    const y = o.get(r.y) || { n: 0, sum: 0 };
    y.n++; y.sum += r.mine; o.set(r.y, y); byPlace.set(p, o);
  }
  const out = [];
  for (const [p, ys] of byPlace) {
    const series = Array.from(ys.entries())
      .filter(([, v]) => v.n >= mp)
      .map(([y, v]) => ({ y, v: v.sum / v.n, n: v.n }))
      .sort((a, b) => a.y < b.y ? -1 : 1);
    if (series.length < my) continue;
    const first = series[0], last = series[series.length - 1];
    if (!first.v) continue;
    const sub = (S.rows.find(r => (r.place || "").trim() === p && isOut(r)) || {}).sub || "";
    out.push({ place: p, sub, series, change: (last.v - first.v) / first.v, n: series.reduce((a, s) => a + s.n, 0) });
  }
  return out.sort((a, b) => b.n - a.n);
}

/* ---------- 고정 지출 목록 ---------- */
function fixedCosts() {
  const ms = Array.from(new Set(S.rows.map(r => r.ym))).filter(m => m && m <= ymOf(todayISO())).sort().slice(-8);
  const map = new Map();
  for (const m of ms) for (const r of monthRows(m)) {
    if (!isOut(r) && !isMov(r)) continue;
    if (isRefund(r)) continue;                 /* 환불 줄은 고정비가 아니다 */
    const k = (r.place || "").trim(); if (!k) continue;
    const o = map.get(k) || { place: k, sub: r.sub, months: new Set(), sum: 0, n: 0 };
    o.months.add(m); o.sum += r.mine; o.n++; map.set(k, o);
  }
  return Array.from(map.values())
    .filter(o => o.months.size >= 6 && o.sum / o.months.size >= 3000)
    .map(o => ({ place: o.place, sub: o.sub, avg: o.sum / o.months.size, months: o.months.size, n: o.n }))
    .sort((a, b) => b.avg - a.avg);
}

/* ---------- 요일과 달의 버릇 ---------- */
function weekdayProfile(rs) {
  const sum = Array(7).fill(0), days = [new Set(), new Set(), new Set(), new Set(), new Set(), new Set(), new Set()];
  for (const r of rs) {
    if (!isOut(r) || isRefund(r)) continue;
    const d = new Date(r.date + "T00:00:00"); if (isNaN(d)) continue;
    sum[d.getDay()] += r.mine; days[d.getDay()].add(r.date);
  }
  return sum.map((v, i) => ({ key: WD[i], mine: days[i].size ? Math.round(v / days[i].size) : 0, n: days[i].size, amt: 0 }));
}
function monthProfile(rs) {
  const sum = Array(12).fill(0), seen = [];
  for (let i = 0; i < 12; i++) seen.push(new Set());
  for (const r of rs) {
    if (!isOut(r)) continue;
    const mi = +r.ym.slice(5, 7) - 1;
    sum[mi] += r.mine; seen[mi].add(r.ym);
  }
  return sum.map((v, i) => ({ key: (i + 1) + "월", mine: seen[i].size ? Math.round(v / seen[i].size) : 0, n: seen[i].size, amt: 0 }));
}
