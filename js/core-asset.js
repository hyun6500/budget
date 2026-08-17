/* ===== js/core-asset.js ===== */
/* core-asset.js - 자산(두 번째 DB) 저장고, 읽어 주는 말, 물가지수, 고정비.
   core.js 다음에 와야 한다. */
FILEV.coreAsset = CONFIG.APP_VERSION;
/* ---------- 자산 (두 번째 DB. 읽기 전용) ----------
   가계부는 매일 쌓이고 자산 시트는 두 달에 한 번 갱신된다.
   그래서 자산 숫자는 반드시 기준일을 달고 보여 준다. */
const A = { data: null, loaded: false, denied: false, reason: "" };

function assetTotal() { return A.data ? (A.data.total || 0) : 0; }
function assetValued() { return A.data ? (A.data.valued || A.data.total || 0) : 0; }
function assetGap() { return assetValued() - assetTotal(); }   /* 평가손익 */

/** 자산 구성 트리에서 깊이 1 (은행 / 투자 / 기타) */
function assetTop() {
  if (!A.data) return [];
  return (A.data.tree || []).filter(t => t.depth === 1 && t.name !== "1" && t.amt);
}
function assetChildren(l2) {
  if (!A.data) return [];
  return (A.data.tree || []).filter(t => t.l2 === l2 && t.depth >= 2 && t.amt);
}

/** 예적금 만기. 비고의 "26년 8월 만기" 같은 표기를 날짜로 읽는다 */
function maturities() {
  if (!A.data) return [];
  const out = [];
  for (const d of (A.data.deposits || [])) {
    const m = String(d.note || "").match(/(\d{2})\s*년\s*(\d{1,2})\s*월\s*만기/);
    if (!m) { out.push({ name: d.name, amt: d.amt, rate: d.rate, note: d.note, due: "", days: null }); continue; }
    const y = 2000 + (+m[1]), mo = +m[2];
    const due = y + "-" + pad2(mo) + "-" + pad2(new Date(y, mo, 0).getDate());
    const days = Math.round((new Date(due + "T00:00:00") - new Date(todayISO() + "T00:00:00")) / 86400000);
    out.push({ name: d.name, amt: d.amt, rate: d.rate, note: d.note, due, days });
  }
  return out.sort((a, b) => (a.days == null ? 9e9 : a.days) - (b.days == null ? 9e9 : b.days));
}

/** 순자산 곡선.
   실측 스냅샷이 있는 구간은 실측을 쓰고,
   그 앞 구간은 가계부의 (수입 - 지출)을 앵커에서 거꾸로 빼서 되짚는다.
   되짚은 값은 추정이므로 화면에서 점선으로 구분한다. */
const BACKFILL_MONTHS = 36;   /* 되짚는 구간을 3년으로 끊는다. 더 멀리 가면 기록 밖의 돈이 다 쌓여 그림이 거짓말을 한다 */
function netWorthSeries() {
  if (!A.data || !(A.data.history || []).length) return { est: [], real: [] };
  const hist = A.data.history.slice().sort((a, b) => a.d < b.d ? -1 : 1);
  const anchor = hist[0];
  const anchorYM = ymOf(anchor.d);
  const ms = Array.from(new Set(S.rows.map(r => r.ym)))
    .filter(m => m && m < anchorYM && m <= ymOf(todayISO())).sort().slice(-BACKFILL_MONTHS);
  const est = [];
  let v = anchor.cost;
  for (let i = ms.length - 1; i >= 0; i--) {
    const st = monthStat(ms[i]);
    est.push({ ym: ms[i], v: Math.round(v) });
    v -= (st.inc - st.out);
  }
  est.reverse();
  return { est, real: hist.map(h => ({ ym: ymOf(h.d), d: h.d, v: h.cost, valued: h.valued })) };
}

/** 매매 원장 요약 */
function tradeStat() {
  const t = (A.data && A.data.trades) || [];
  const closed = t.filter(x => (x.block || "").indexOf("종료") >= 0);
  const open = t.filter(x => (x.block || "").indexOf("종료") < 0);
  const sum = (a, f) => a.reduce((s, x) => s + (f(x) || 0), 0);
  const win = closed.filter(x => (x.pnl || 0) > 0).length;
  return {
    closed, open,
    closedPnl: sum(closed, x => x.pnl), closedCost: sum(closed, x => x.cost),
    openCost: sum(open, x => x.cost),
    winRate: closed.length ? win / closed.length : 0, win, lose: closed.length - win,
  };
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

    /* 1. 대분류 급등, 급락 */
    for (const b of byKey(rs.filter(isOut), r => r.big || "기타")) {
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
    if (A.data && assetGap() < 0) {
      out.push({
        score: 48, kind: "up", tag: "평가손",
        html: "모은 돈은 <b>" + wonS(assetTotal()) + "</b>인데 지금 값은 <b>" + wonS(assetValued()) +
          "</b>입니다. 투자에서 <b>" + wonS(Math.abs(assetGap())) + "</b>이 빠져 있습니다. (" + esc(A.data.asOf || "") + " 기준)",
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
    if (!isOut(r) || !r.place || !r.mine) continue;
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
    if (!isOut(r)) continue;
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
