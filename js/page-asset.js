/* ===== js/page-asset.js ===== */
/* page-asset.js - 자산. 두 번째 DB(자산 시트)를 읽기 전용으로 본다.
   현황 / 투자 / 수입원 셋. 가계부와 갱신 주기가 달라 어디에나 기준일과 시세 시각을 붙인다.
   2026-10 새 자산 시트로 바꾸면서 현황과 투자를 다시 짰다(v2.10).
   v2.11 에서 한눈에 보기, 사각형 지도, 꺼낼 수 있는 정도, 변화 분해, 종목 상세 창을 더했다. 수입원은 그대로다. */
FILEV.asset = CONFIG.APP_VERSION;

const AS = {
  seg: "now", basis: "valued", open: {}, allOpen: false, hold: "item", holdAll: false, closedAll: false,
  compose: "map",      /* 무엇으로 가지고 있나: map(사각형 지도) / list(트리 목록) */
  since: "first",      /* 왜 늘었나: first(첫 기록부터) / prev(지난 기록부터) */
  pnlView: "open",     /* 무엇에서 벌고 잃었나: open(보유 중) / closed(끝낸 거래) */
};
const ASSET_LIST_N = 10;   /* 보유 종목과 끝낸 거래는 이만큼만 먼저 보여 준다. 휴대폰에서 24줄이 이어지면 아래 카드에 닿기 어렵다 */
const TMAP_FOLD = 0.006;   /* 현황 지도에서 전체의 0.6% 보다 작은 항목은 무리마다 [그 밖] 한 칸으로 묶는다. 손가락으로 누를 수 없는 크기다 */
const HMAP_FOLD = 0.01;    /* 종목 지도는 1% */
const CONC_WARN = 0.3;     /* 한 종목이 증권 평가액의 30% 를 넘으면 쏠림 표시 */

/* 대분류 색. 그래프 칸 색은 style.css 의 --g-* (색약 검사를 통과한 값). 골드 계열은 투자 */
const GROUP_CLS = { "은행": "gb", "투자": "gi", "기타": "ge", "외화": "gx" };
const groupCls = name => GROUP_CLS[name] || "gx";
const groupColor = name => "var(--g-" + ({ gb: "bank", gi: "inv", ge: "etc", gx: "fx" }[groupCls(name)]) + ")";

const pctS = (v, d) => isNum(v) ? (v * 100).toFixed(d == null ? 1 : d) + "%" : "-";
const signWon = v => nz(v) === 0 ? "0" : (nz(v) > 0 ? "+" : "-") + won(Math.abs(nz(v)));
/** 반올림한 퍼센트. -0% 가 나오지 않게 */
const pctR = v => { const r = Math.round(nz(v) * 100); return (r === 0 ? 0 : r) + "%"; };
/** 부호를 붙인 반올림 퍼센트. +0% 가 아니라 0% */
const pctSign = v => { const r = Math.round(nz(v) * 100); return r === 0 ? "0%" : (r > 0 ? "+" : "") + r + "%"; };
const moreBtn = (id, n, open) => '<button class="btn ghost sm morebtn" id="' + id + '">' + (open ? "접기" : "전체 " + n + "개 보기") + "</button>";
const signCls = v => nz(v) > 0 ? "pos" : nz(v) < 0 ? "neg" : "";
/** 1억 145만 같은 꼴. 만 아래는 반올림한다. 1만이 안 되면 원 단위 그대로 */
function manS(v) {
  const n = Math.round(Math.abs(nz(v)));
  if (n < 10000) return won(n);
  let e = Math.floor(n / 1e8), m = Math.round((n - e * 1e8) / 1e4);
  if (m >= 10000) { e++; m -= 10000; }
  return (e ? e + "억" : "") + (e && m ? " " : "") + (m ? m.toLocaleString("ko-KR") + "만" : "");
}
const signMan = v => Math.round(nz(v)) === 0 ? "0" : (nz(v) > 0 ? "+" : "-") + manS(v);
const shortD = d => String(d || "").slice(2, 10).replace(/-/g, ".");
/** 현지 통화 값. 원화가 아닌 것은 소수 둘째 자리까지 */
function localPrice(v, cur) {
  if (!isNum(v)) return "-";
  if (!cur || cur === "KRW") return won(v) + "원";
  return (Math.round(v * 100) / 100).toLocaleString("ko-KR", { maximumFractionDigits: 2 }) + " " + esc(cur);
}
/** 수익률 칸 색. 손실 셋, 본전 근처(2% 안), 이익 셋 */
function retCls(r) {
  if (!isNum(r)) return "r0";
  if (r <= -0.3) return "rn3"; if (r <= -0.1) return "rn2"; if (r < -0.02) return "rn1";
  if (r <= 0.02) return "r0"; if (r < 0.1) return "rp1"; if (r < 0.3) return "rp2"; return "rp3";
}
const RSCALE = '<div class="rscale"><span>손실</span><i class="sw rn3"></i><i class="sw rn2"></i><i class="sw rn1"></i>' +
  '<i class="sw r0"></i><i class="sw rp1"></i><i class="sw rp2"></i><i class="sw rp3"></i><span>이익</span></div>';
/** 사각형 지도의 가로세로 비. 휴대폰은 높게(글씨가 들어갈 칸이 많게), 넓은 화면은 낮게 */
function tmRatio() {
  const b = $("#assetBody"), w = (b && b.clientWidth) || 360;
  return Math.max(1.2, Math.min(2.4, (w - 34) / 250));
}
const kpi = (l, v, s, cls, extra) => '<div class="kpi"><span class="l">' + l + '</span><span class="v' + (cls ? " " + cls : "") + '">' + v + "</span>" +
  (s ? '<span class="s">' + s + "</span>" : "") + (extra || "") + "</div>";

async function loadAssets() {
  if (A.loaded || A.denied) return;
  if (CONFIG.ASSET_NEEDS_AUTH && !authAlive()) return;
  try {
    const j = await post("assets", { token: AUTH.token });
    A.data = j.assets || null; A.reason = j.reason || ""; A.loaded = true;
  } catch (e) { A.denied = true; A.reason = e.message; toast("자산을 읽지 못했습니다: " + e.message); }
}

function renderAsset() {
  const box = $("#p-asset");

  if (CONFIG.ASSET_NEEDS_AUTH && !authAlive()) {
    box.innerHTML = '<div class="card"><div class="locked">자산은 잠겨 있습니다.<br>' +
      "가계부와 달리 이 화면은 비밀번호를 넣어야 열립니다.<br>10분이 지나면 다시 잠깁니다." +
      '<button class="btn" id="asUnlock">잠금 풀기</button></div></div>';
    $("#asUnlock").onclick = async () => { if (await ensureAuth()) { await loadAssets(); renderAsset(); } };
    return;
  }
  if (!A.loaded) {
    box.innerHTML = '<div class="card"><div class="skel" style="width:40%"></div>' +
      '<div class="skel" style="height:38px;margin:12px 0"></div><div class="skel" style="width:70%"></div></div>';
    loadAssets().then(() => renderAsset());
    return;
  }
  if (!A.data) {
    box.innerHTML = A.reason === "not_configured"
      ? '<div class="card"><div class="locked">자산 시트가 아직 이어져 있지 않습니다.<br><br>' +
        "가계부 Apps Script 의 [프로젝트 설정 > 스크립트 속성] 에서<br><b>PORTFOLIO_ID</b> 에 자산 시트 ID 를 넣어 주세요.<br>" +
        "시트 주소의 /d/ 와 /edit 사이 문자열입니다. 가계부 시트 ID 가 아닙니다.<br><br>" +
        "넣은 뒤 편집기에서 checkPortfolio() 를 한 번 실행하면<br>어느 시트를 읽는지 확인할 수 있습니다.</div></div>"
      : '<div class="card"><div class="empty">자산 시트를 읽지 못했습니다.' +
        (A.reason ? "<br>" + esc(A.reason) : "") + "<br>시트 공유 권한을 확인해 주세요.</div></div>";
    return;
  }

  box.innerHTML = segHTML([["now", "현황"], ["inv", "투자"], ["inc", "수입원"]], AS.seg, "as") +
    '<div id="assetBody"></div>';
  $$("[data-as]", box).forEach(b => b.onclick = () => { AS.seg = b.dataset.as; renderAsset(); });

  if (AS.seg === "inc") assetIncome();
  else {
    const stop = assetNotice();
    if (stop) { $("#assetBody").innerHTML = stop; }
    else if (AS.seg === "inv") assetInvest();
    else assetNow();
  }
  decorate(box);
}

/** 현황과 투자를 그릴 수 없을 때의 안내. 그릴 수 있으면 빈 글자 */
function assetNotice() {
  if (!assetNew()) {
    return '<div class="card"><div class="locked">서버가 아직 예전 판입니다.<br><br>' +
      "새 자산 시트 화면은 서버 VERSION " + esc(CONFIG.SERVER_EXPECTED) + " 이 보내는 자료로 그립니다.<br>" +
      "Code.gs 를 [배포 관리 > 연필 > 버전: 새 버전 > 배포] 로 다시 배포해 주세요.<br>" +
      "수입원 탭은 지금도 볼 수 있습니다.</div></div>";
  }
  if (A.reason === "no_link") {
    return '<div class="card"><div class="locked">자산 시트 구조가 바뀌었습니다.<br><br>' + esc(A.data.detail || "") +
      "<br><br>지금 읽는 시트: <b>" + esc(A.data.sheet || "") + "</b><br>" +
      "[프로젝트 설정 > 스크립트 속성] 의 PORTFOLIO_ID 를 새 자산 시트 ID 로 바꿔 주세요.<br>" +
      "편집기에서 checkPortfolio() 를 실행하면 어느 시트를 읽는지 보입니다.</div></div>";
  }
  return "";
}

/** 맨 위 띠. 시세 기준 시각과 api_version 이 다를 때의 경고 */
function assetTopBars() {
  let s = "";
  if (A.reason === "api_mismatch")
    s += '<div class="pricebar stale"><span class="dot"></span><span><b>자산 시트 구조가 바뀌었습니다.</b> ' +
      esc(A.data.detail || "") + ". 숫자가 어긋날 수 있습니다.</span></div>";
  const p = priceAge();
  if (p.text) {
    const tail = p.days == null ? "" : p.stale
      ? "<b>" + p.days + "일째 그대로입니다.</b> 자산 시트의 6.시세 스크립트(평일 17~18시)가 도는지 확인해 주세요."
      : (p.days <= 0 ? "오늘 값" : p.days + "일 전 값");
    s += '<div class="pricebar' + (p.stale ? " stale" : "") + '"><span class="dot"></span>' +
      "<span>시세 <b>" + esc(p.text) + "</b> 기준</span><span class=\"t\">" + tail + "</span></div>";
  }
  return s;
}

/* ---------- 1) 현황 ---------- */
function assetNow() {
  const box = $("#assetBody");
  const val = AS.basis !== "principal";
  const gap = assetGap();
  const nowP = assetNowPoint(), prevP = assetPrevPoint();
  const nw = netWorthSeries();
  const firstP = nw.real[0] || null;
  const curV = val ? assetValued() : assetTotal();

  /* 지금 값이 앞 기록보다 얼마나 달라졌나. 손익 반영 기준인데 그 기록에 손익 반영 값이 없으면 견주지 않는다(기준이 섞인다) */
  const chg = (p, label) => {
    if (!p || p.d >= nowP.d) return "";
    const base = val ? p.valued : p.v;
    if (!isNum(base)) return "";
    const d = curV - base;
    return '<span class="chg ' + signCls(d) + '" data-tip="' + esc(signWon(d) + "원\n" + p.d + " " + (val ? "투자 손익 반영" : "원금") + " " + won(base) + "원에서") + '">' +
      signMan(d) + "<em>" + label + "</em></span>";
  };
  const chgs = [chg(prevP, shortD(prevP && prevP.d) + " 기록보다"), firstP && prevP && firstP.d !== prevP.d ? chg(firstP, "첫 기록(" + shortD(firstP.d) + ")보다") : ""].join("");

  const hero = '<div class="card hero gold">' +
    '<div class="herohead"><span class="eyebrow">순자산 (' + (val ? "투자 손익 반영" : "원금 기준") + ")</span>" +
    '<div class="mini"><button class="chip' + (val ? " on" : "") + '" data-basis="valued">손익 반영</button>' +
    '<button class="chip' + (val ? "" : " on") + '" data-basis="principal">원금</button></div></div>' +
    '<div class="big">' + won(curV) + '<span class="won">원</span></div>' +
    (chgs ? '<div class="chgs">' + chgs + "</div>" : "") +
    '<div class="sub"><span>원금 <b>' + won(assetTotal()) + "</b></span>" +
    "<span>투자 손익 반영 <b>" + won(assetValued()) + "</b></span>" +
    '<span>차이 <b class="' + signCls(gap) + '">' + (gap >= 0 ? "+" : "-") + wonS(Math.abs(gap)) + "</b></span>" +
    "<span>기준 <b>" + esc(assetAsOf()) + "</b></span></div>" +
    '<p class="foot">원금은 넣은 돈입니다. 투자 손익 반영은 증권 잔고와 VC 를 시트의 지금 값으로 친 것입니다. 가계부는 원금 쪽과 맞물립니다.</p></div>';

  /* 한눈에 보기 */
  const lq = liquidity(), lm = ledgerMonthly(12), pace = assetPace();
  const cash = lq.tiers[0].v;
  const months = lm.out > 0 ? cash / lm.out : null;
  const tiles = [
    kpi("바로 꺼낼 수 있는 돈", manS(cash), months != null ? "생활비 <b>" + Math.round(months) + "달치</b>" : "가계부 지출이 없어 못 셈"),
    pace ? kpi("한 달에 느는 돈", signMan(pace.perMonth), "원금 기준, 기록 " + Math.round(pace.days / 30.44) + "달", signCls(pace.perMonth)) : "",
    kpi("투자 손익", signMan(gap), "손익 반영 - 원금", signCls(gap)),
    pace && pace.monthsLeft != null ? kpi(manS(pace.target) + "까지", "약 " + Math.max(1, Math.round(pace.monthsLeft)) + "달",
      esc(pace.when.slice(0, 4)) + "년 " + (+pace.when.slice(5, 7)) + "월쯤, " + manS(pace.left) + " 남음") : "",
  ].filter(Boolean);
  const kpiCard = '<div class="card"><div class="sec"><h2>한눈에 보기</h2><span class="hint">' + esc(assetAsOf()) + " 기준</span></div>" +
    '<div class="kpis four">' + tiles.join("") + "</div>" +
    '<p class="foot">' +
    (months != null ? "생활비는 가계부 최근 " + lm.n + "달(" + esc(lm.from) + " ~ " + esc(lm.to) + ") 평균 지출 " + won(lm.out) + "원(내 몫)입니다. " : "") +
    (pace ? "한 달에 느는 돈은 7.자산기록 첫 기록(" + esc(pace.from) + ")과 끝 기록(" + esc(pace.to) + ")의 원금 차이를 달 수로 나눈 값이고, " +
      "목표까지 남은 달은 그 속도를 그대로 늘인 어림입니다. 투자 손익은 넣지 않았습니다." : "") + "</p></div>";

  /* 무엇으로 가지고 있나. 지도(넓이 = 금액) 와 목록(트리) */
  const top = assetTop();
  const amt = n => val ? nz(n.valued) : nz(n.principal);
  const sumTop = curV || top.reduce((s, n) => s + amt(n), 0) || 1;
  const legend = '<div class="legend">' + top.map(n =>
    '<span><i style="background:' + groupColor(n.name) + '"></i>' + esc(n.name) + " " + (amt(n) / sumTop * 100).toFixed(1) + "%</span>").join("") + "</div>";
  let composeBody;
  if (AS.compose === "list") {
    composeBody = '<div class="stackbar">' + top.map(n =>
      '<i style="width:' + (amt(n) / sumTop * 100).toFixed(2) + "%;background:" + groupColor(n.name) + '"></i>').join("") + "</div>" + legend +
      '<div class="ledopt" style="margin:12px 0 4px"><button class="chip' + (AS.allOpen ? " on" : "") + '" id="asAll">' +
      (AS.allOpen ? "항목 접기" : "항목 모두 펴기") + '</button><span class="ledcount">중분류를 누르면 항목이 펴집니다</span></div>' +
      treeHTML(assetTree(), val);
  } else {
    const groups = top.map(g => {
      const items = [], small = [];
      for (const s of g.kids) for (const it of (s.lv === 2 ? s.kids : [s])) {
        const v = amt(it);
        if (v <= 0) continue;
        const path = g.name + (s.lv === 2 ? " > " + s.name : "");
        const rec = { name: it.name, v, path, rate: it.rate, memo: it.memo, due: it.due };
        (v / sumTop < TMAP_FOLD ? small : items).push(rec);
      }
      const cells = items.map(it => ({
        name: it.name, v: it.v, label: pctS(it.v / sumTop),
        tip: won(it.v) + "원 (" + pctS(it.v / sumTop) + ")\n" + it.name + "\n" + it.path +
          (it.rate ? "\n이율 " + it.rate : "") + (it.due ? "\n만기 " + it.due : "") + (it.memo ? "\n" + it.memo : ""),
      }));
      if (small.length) {
        const sv = small.reduce((t, x) => t + x.v, 0);
        cells.push({ name: "그 밖 " + small.length + "개", v: sv, label: pctS(sv / sumTop),
          tip: won(sv) + "원 (" + pctS(sv / sumTop) + ")\n" + g.name + "의 작은 항목 " + small.length + "개\n" +
            small.map(x => x.name + " " + won(x.v)).join("\n") });
      }
      return { key: g.name, cls: groupCls(g.name), items: cells };
    });
    composeBody = treemapHTML(groups, { ratio: tmRatio(), label: "자산 지도. 넓이가 금액" }) + legend;
  }
  const compose = '<div class="card"><div class="sec"><h2>무엇으로 가지고 있나</h2>' +
    '<span class="hint">' + esc(assetAsOf()) + " 기준</span></div>" +
    '<div class="chips"><button class="chip' + (AS.compose !== "list" ? " on" : "") + '" data-compose="map">지도</button>' +
    '<button class="chip' + (AS.compose === "list" ? " on" : "") + '" data-compose="list">목록</button></div>' +
    composeBody +
    '<p class="foot">' + (AS.compose === "list"
      ? "비중은 고른 기준의 총자산에 대한 몫입니다. 원금 기준은 시트가 계산한 값 그대로입니다."
      : "사각형 넓이가 금액입니다. 칸을 누르면 금액과 비고가 뜹니다. 전체의 " + (TMAP_FOLD * 100).toFixed(1) +
        "% 보다 작은 항목은 무리마다 [그 밖] 한 칸으로 묶었습니다. 이름과 비고까지 보려면 [목록].") + "</p></div>";

  /* 얼마나 빨리 꺼낼 수 있나 */
  const lqParts = lq.tiers.map((t, i) => Object.assign({ cls: "lq" + i }, t)).concat(lq.other.v ? [Object.assign({ cls: "lqx" }, lq.other)] : []).filter(t => t.v);
  const lqTot = lq.total || 1;
  const lqCard = lqParts.length
    ? '<div class="card"><div class="sec"><h2>얼마나 빨리 꺼낼 수 있나</h2><span class="hint">투자 손익 반영 값</span></div>' +
      '<div class="lqbar" role="img" aria-label="꺼낼 수 있는 정도별 비중">' + lqParts.map(t =>
        '<i class="' + t.cls + '" style="width:' + (t.v / lqTot * 100).toFixed(2) + '%" data-tip="' +
        esc(won(t.v) + "원 (" + pctS(t.v / lqTot) + ")\n" + t.name) + '"></i>').join("") + "</div>" +
      '<div class="rows">' + lqParts.map(t => {
        const names = t.items.slice().sort((a, b) => b.v - a.v);
        return '<div class="row"><div class="nm"><span class="sw ' + t.cls + '"></span>' + esc(t.name) + "</div>" +
          '<div class="amt">' + won(t.v) + "</div>" +
          '<div class="meta"><span>' + pctS(t.v / lqTot) + "</span><span>" + esc(t.note) + '</span><span class="wrap">' +
          names.slice(0, 4).map(x => esc(x.name)).join(", ") + (names.length > 4 ? " 외 " + (names.length - 4) : "") + "</span></div></div>";
      }).join("") + "</div>" +
      (months != null ? '<p class="foot">바로 꺼낼 수 있는 돈 ' + won(cash) + "원은 최근 " + lm.n + "달 평균 지출의 <b>" + months.toFixed(1) + "달치</b>입니다.</p>" : "") +
      '<p class="foot">나누는 규칙은 시트에 칸이 없어 앱이 정했습니다. 중분류와 항목 이름으로 나눕니다. ' +
      "입출금, 파킹, 외화는 바로 / 증권은 팔면 이틀 / 예적금, 청약, 포인트, 상품권은 기한이 있음 / 연금(IRP), 출자금, VC, 전세금은 오래 묶임." +
      (lq.other.v ? " 어느 규칙에도 맞지 않는 항목은 [나누지 못한 것] 으로 따로 둡니다." : "") + "</p></div>"
    : "";

  /* 왜 늘었나. 가계부 저축 + 기록 밖 + 투자 손익 = 변화 ([두 장부가 맞나] 를 여기에 합쳤다) */
  let wfCard = "";
  if (firstP) {
    const usePrev = AS.since === "prev" && prevP && prevP.d < nowP.d;
    const a = usePrev ? prevP : firstP;
    if (a.d < nowP.d) {
      const c = assetChange(a, nowP);
      const bars = [{ key: "가계부 저축", v: c.flow, s: "수입 - 지출" }, { key: "기록 밖", v: c.resid, s: "가계부에 없는 돈" }];
      if (c.hasV) bars.push({ key: "투자 손익", v: c.invest, s: "평가손익 변화" });
      const ratio = Math.abs(c.resid) / Math.max(1, Math.abs(c.dp));
      wfCard = '<div class="card"><div class="sec"><h2>왜 늘었나</h2><span class="hint">' + esc(a.d) + " ~ " + esc(nowP.d) + "</span></div>" +
        '<div class="chips"><button class="chip' + (usePrev ? "" : " on") + '" data-since="first">첫 기록부터</button>' +
        (prevP && prevP.d !== firstP.d ? '<button class="chip' + (usePrev ? " on" : "") + '" data-since="prev">지난 기록부터</button>' : "") + "</div>" +
        '<div class="trio"><div><span>' + shortD(a.d) + "</span><b>" + manS(c.start) + "</b></div>" +
        "<div><span>" + shortD(nowP.d) + "</span><b>" + manS(c.end) + "</b></div>" +
        '<div><span>변화</span><b class="' + signCls(c.change) + '">' + signMan(c.change) + "</b></div></div>" +
        divergeBars(bars.map(b => ({ key: b.key, v: b.v, s: b.s })), { sub: i => i.s }) +
        '<p class="foot">세 막대를 더하면 변화가 됩니다' + (c.hasV ? " (투자 손익 반영 기준)" : " (원금 기준. 이 기록에는 손익 반영 값이 없음)") + ". " +
        "가계부는 " + esc(a.d) + " 다음 날부터 " + esc(nowP.d) + "까지 " + won(c.n) + "줄입니다. " +
        "기록 밖은 원금 증가(" + signWon(c.dp) + ")에서 가계부 저축을 뺀 값으로, 이자나 손으로 옮긴 돈처럼 가계부에 없는 돈입니다. " +
        '이번에는 원금 증가의 <b style="color:' + (ratio < 0.1 ? "var(--in)" : "var(--warn)") + '">' + Math.round(ratio * 100) + "%</b>" +
        (ratio < 0.1 ? "로 10% 안쪽이라 가계부가 자산 흐름을 거의 다 설명합니다." : "로 10% 를 넘습니다. 기록에서 빠진 돈이 있는지 보세요.") + "</p></div>";
    }
  }

  /* 순자산 곡선 */
  const series = [];
  if (nw.est.length) series.push({ name: "가계부 역산", color: "var(--ink3)", dash: true, w: 1.6, pts: nw.est.map(p => ({ t: p.d, y: p.v })) });
  if (nw.real.length) series.push({ name: "원금 기준", color: "var(--gold)", dot: true, w: 2.4, pts: nw.real.map(p => ({ t: p.d, y: p.v })) });
  const vals = nw.real.filter(p => p.valued != null);
  if (vals.length) series.push({ name: "투자 손익 반영", color: "var(--navy)", dot: true, w: 1.8, pts: vals.map(p => ({ t: p.d, y: p.valued })) });
  const curve = series.length
    ? '<div class="card"><div class="sec"><h2>모아 온 길</h2><span class="hint">눌러서 값 보기</span></div>' +
      timeChart(series, { h: 175, label: "순자산 곡선" }) +
      '<div class="legend"><span><i style="background:var(--gold)"></i>원금 기준 ' + nw.real.length + "개</span>" +
      (vals.length ? '<span><i style="background:var(--navy)"></i>투자 손익 반영 ' + vals.length + "개</span>" : "") +
      (nw.est.length ? '<span><i style="background:var(--ink3)"></i>가계부 역산 ' + nw.est.length + "달</span>" : "") + "</div>" +
      '<p class="foot">가로는 날짜 간격 그대로입니다. 실선은 7.자산기록의 기록입니다. 점선은 첫 기록(' + esc(nw.anchor ? nw.anchor.d : "") + ")에서 달마다 " +
      "(수입 - 지출)을 빼며 " + BACKFILL_MONTHS + "달만 거꾸로 되짚은 추정입니다. 투자 손익과 기록 밖의 돈이 담기지 않아 " +
      "거슬러 올라갈수록 오차가 쌓입니다. 값보다 모양을 보는 그림입니다.</p></div>"
    : "";

  /* 예적금 만기 */
  const mt = maturities(), nd = depositsNoDue();
  let mtCard = "";
  if (mt.length) {
    mtCard = '<div class="card"><div class="sec"><h2>예적금 만기</h2><span class="hint">오늘 ' + todayISO() + "</span></div>" +
      '<div style="overflow-x:auto"><table class="tbl"><thead><tr>' +
      "<th>이름</th><th>금액</th><th>이율</th><th>만기</th><th>남은 날</th></tr></thead><tbody>" +
      mt.map(m => '<tr><td class="nm">' + esc(m.name) + '</td><td class="n">' + won(m.amt) +
        '</td><td class="n">' + esc(m.rate || "-") + "</td><td>" + esc(m.due) +
        '</td><td class="n ' + (m.days != null && m.days <= 45 ? "neg" : "") + '">' +
        (m.days == null ? "-" : m.days >= 0 ? m.days + "일" : (-m.days) + "일 지남") + "</td></tr>").join("") +
      "</tbody></table></div>" +
      '<div style="height:14px"></div>' + timelineHTML(mt) +
      '<p class="foot">0.자산 세부 항목의 만기일(K열)을 읽습니다. 45일 안으로 들어오면 홈 알림에도 뜹니다.</p></div>';
  } else if (nd.length) {
    mtCard = '<div class="card"><div class="sec"><h2>예적금 만기</h2><span class="hint">만기일 비어 있음</span></div>' +
      '<div class="rows">' + nd.map(m =>
        '<div class="row"><div class="nm">' + esc(m.name) + '</div><div class="amt">' + won(m.amt) + "</div>" +
        '<div class="meta">' + (m.rate ? "<span>이율 " + esc(m.rate) + "</span>" : "") + "<span>" + esc(m.note) + "</span></div></div>").join("") +
      "</div>" +
      '<p class="foot">만기일 칸이 비어 있어 남은 날을 셀 수 없습니다. 0.자산 세부 항목의 만기일(K열)에 날짜를 적으면 ' +
      "여기에 남은 날이 뜨고, 45일 안으로 들어오면 홈 알림에도 뜹니다. 비고의 글자는 읽지 않습니다.</p></div>";
  }

  const cb = '<div class="card tight"><div class="sec" style="margin-bottom:6px"><h2>카드 캐시백</h2></div>' +
    '<p class="foot" style="margin:0">캐시백은 별도 앱이 정본입니다. 두 곳에서 관리하면 어긋나므로 여기서는 잇기만 합니다. ' +
    '<a href="' + CONFIG.CARD_APP_URL + '" style="color:var(--navy);font-weight:700">캐시백 앱 열기</a></p></div>';

  const warn = (A.data.warn || []).length
    ? '<div class="card tight"><div class="sec" style="margin-bottom:6px"><h2>시트에서 확인할 것</h2>' +
      '<span class="hint">서버가 남긴 말 ' + A.data.warn.length + "건</span></div>" +
      '<div class="rows">' + A.data.warn.map(w => '<div class="row"><div class="nm" style="white-space:normal;font-weight:500;font-size:12.5px">' +
        esc(w) + "</div></div>").join("") + "</div></div>"
    : "";

  box.innerHTML = assetTopBars() + hero + kpiCard + compose + lqCard + wfCard + curve + mtCard + cb + warn;
  const redraw = () => { assetNow(); decorate($("#p-asset")); };
  $$("[data-basis]", box).forEach(b => b.onclick = () => { AS.basis = b.dataset.basis; redraw(); });
  $$("[data-compose]", box).forEach(b => b.onclick = () => { AS.compose = b.dataset.compose; redraw(); });
  $$("[data-since]", box).forEach(b => b.onclick = () => { AS.since = b.dataset.since; redraw(); });
  $$("[data-tk]", box).forEach(r => r.onclick = () => { AS.open[r.dataset.tk] = !AS.open[r.dataset.tk]; redraw(); });
  const all = $("#asAll", box);
  if (all) all.onclick = () => { AS.allOpen = !AS.allOpen; if (!AS.allOpen) AS.open = {}; redraw(); };
  decorate(box);
}


/** 자산 구성 트리. 대분류와 중분류는 늘 보이고, 항목은 중분류를 누르면 펴진다 */
function treeHTML(nodes, val) {
  let h = '<div class="atree"><div class="ath"><span>이름</span><span>' + (val ? "투자 손익 반영" : "원금") + "</span><span>비중</span></div>";
  nodes.forEach((g, gi) => {
    h += atreeRow(g, 1, "", val, 0);
    g.kids.forEach((s, si) => {
      if (s.lv !== 2) { h += atreeRow(s, 3, "", val, 0); return; }
      const key = "g" + gi + "s" + si;
      h += atreeRow(s, 2, key, val, s.kids.length);
      if (AS.allOpen || AS.open[key]) s.kids.forEach(it => { h += atreeRow(it, 3, "", val, 0); });
    });
  });
  return h + "</div>";
}
function atreeRow(n, lv, key, val, nKids) {
  const main = val ? nz(n.valued) : nz(n.principal);
  const diff = nz(n.valued) - nz(n.principal);
  const sub = [];
  if (Math.abs(diff) >= 1)
    sub.push((val ? "원금 " + won(n.principal) : "평가 " + won(n.valued)) +
      ' <em class="' + signCls(diff) + '">' + (diff >= 0 ? "+" : "-") + wonS(Math.abs(diff)) + "</em>");
  if (n.rate) sub.push("이율 " + esc(n.rate));
  if (n.due) sub.push("만기 " + esc(n.due));
  if (n.memo) sub.push(esc(n.memo));
  const can = lv === 2 && nKids > 0;
  const open = can && (AS.allOpen || AS.open[key]);
  /* 비중. 원금 기준은 시트 값 그대로, 손익 반영 기준은 투자 손익 반영 총자산에 대한 몫 */
  const w = val ? (assetValued() ? nz(n.valued) / assetValued() : null) : n.weight;
  return '<div class="atr l' + lv + (main === 0 && !nz(n.principal) ? " zero" : "") + (can ? " can" : "") + '"' +
    (can ? ' data-tk="' + key + '"' : "") + ">" +
    '<div class="an">' + (can ? '<span class="caret">' + (open ? "-" : "+") + "</span>" : "") + esc(n.name) +
    (can ? ' <span class="cnt">' + nKids + "</span>" : "") + "</div>" +
    '<div class="aa">' + won(main) + '</div><div class="aw">' + pctS(w) + "</div>" +
    (sub.length ? '<div class="as">' + sub.join(" / ") + "</div>" : "") + "</div>";
}


/* ---------- 2) 투자 ---------- */
function assetInvest() {
  const box = $("#assetBody");
  const m = assetMeta();
  const accs = assetAccounts();
  const tot = accs.find(a => a.kind === "total");

  const hero = '<div class="card hero gold"><span class="eyebrow">증권 계좌 (내 계좌 합계)</span>' +
    '<div class="big">' + won(nz(m.sec_balance)) + '<span class="won">원</span></div>' +
    '<div class="sub"><span>원금(순입금) <b>' + won(nz(m.sec_principal)) + "</b></span>" +
    '<span>손익 <b class="' + signCls(m.sec_pnl) + '">' + signWon(m.sec_pnl) + "</b></span>" +
    '<span>수익률 <b class="' + signCls(m.sec_return) + '">' + pctS(m.sec_return) + "</b></span>" +
    "<span>예수금 <b>" + won(nz(m.sec_cash)) + "</b></span></div>" +
    '<p class="foot">손익 = 총 잔고 - 순입금입니다. 실현손익과 배당이 들어 있습니다. 엄마 계좌는 넣지 않았습니다. ' +
    "환율 USD " + (isNum(m.usd_krw) ? m.usd_krw.toLocaleString("ko-KR", { maximumFractionDigits: 2 }) : "-") + "원, JPY " +
    (isNum(m.jpy_krw) ? m.jpy_krw.toLocaleString("ko-KR", { maximumFractionDigits: 4 }) : "-") + "원 (시트 6.시세)</p></div>";

  /* 한눈에 보기. 쏠림과 통화와 누적 성과 */
  const st = holdingStats();
  const L = lotStat();
  const realized = tot && isNum(tot.realized) ? tot.realized : L.pnl;
  const divTot = tot && isNum(tot.dividend) ? tot.dividend : 0;
  const meter = (w, warn) => '<div class="meter' + (warn ? " warn" : "") + '"><i style="width:' + Math.min(100, w * 100).toFixed(1) + '%"></i></div>';
  const topWarn = st.topW > CONC_WARN;
  const kpiCard = st.hs.length
    ? '<div class="card"><div class="sec"><h2>한눈에 보기</h2><span class="hint">보유 ' + st.hs.length + "종목</span></div>" +
      '<div class="kpis four">' +
      kpi("가장 큰 종목" + (topWarn ? '<span class="flag">30% 넘음</span>' : ""), pctS(st.topW), esc(st.top.name) + " " + manS(st.top.value), "", meter(st.topW, topWarn)) +
      kpi("상위 5종목", pctS(st.top5W), st.theme ? "테마 1위 " + esc(st.theme.key) + " " + pctS(st.themeW) : "", "", meter(st.top5W)) +
      kpi("원화 밖", pctS(st.foreignW), st.foreign.length ? st.foreign.map(f => esc(f.cur) + " " + pctS(f.w)).join(", ") : "모두 원화") +
      kpi("실현 + 배당", signMan(realized + divTot), "실현 " + signMan(realized) + ", 배당 " + manS(divTot), signCls(realized + divTot)) +
      "</div>" +
      '<p class="foot">비중은 보유 종목 평가액 합(' + won(st.tv) + "원)에 대한 몫입니다. 실현과 배당은 계좌 합계의 누적 값입니다. " +
      "한 종목이 " + Math.round(CONC_WARN * 100) + "% 를 넘으면 쏠림으로 표시합니다(앱이 정한 선).</p></div>"
    : "";

  /* 종목 지도. 넓이 = 평가액, 색 = 수익률 */
  let hmapCard = "";
  if (st.hs.length) {
    const big = st.hs.filter(h => nz(h.value) / (st.tv || 1) >= HMAP_FOLD);
    const small = st.hs.filter(h => nz(h.value) / (st.tv || 1) < HMAP_FOLD && nz(h.value) > 0);
    const cells = big.map(h => ({
      name: h.name, v: nz(h.value), cls: retCls(h["return"]), label: pctSign(h["return"]), open: String(h.ticker),
      tip: won(h.value) + "원 (" + pctS(nz(h.value) / st.tv) + ")\n" + h.name + "\n손익 " + signWon(h.pnl) + " (" + pctS(h["return"]) + ")",
    }));
    if (small.length) {
      const sv = small.reduce((t, h) => t + nz(h.value), 0), sc = small.reduce((t, h) => t + nz(h.cost), 0), sp = small.reduce((t, h) => t + nz(h.pnl), 0);
      cells.push({ name: "그 밖 " + small.length + "종목", v: sv, cls: retCls(sc ? sp / sc : 0), label: pctS(sv / st.tv),
        tip: won(sv) + "원 (" + pctS(sv / st.tv) + ")\n" + "비중 " + (HMAP_FOLD * 100) + "% 아래 " + small.length + "종목\n" +
          small.map(h => h.name + " " + pctSign(h["return"])).join("\n") });
    }
    hmapCard = '<div class="card"><div class="sec"><h2>종목 지도</h2><span class="hint">넓이는 평가액, 색은 수익률</span></div>' +
      treemapHTML([{ key: "all", items: cells }], { ratio: tmRatio(), label: "종목 지도. 넓이가 평가액, 색이 수익률" }) + RSCALE +
      '<p class="foot">칸을 누르면 그 종목의 매수 기록과 묶음이 열립니다. 색은 손실 -30% 아래, -10%, -2%, 본전 근처(2% 안), +2%, +10%, +30% 위로 나눴고 ' +
      "칸 안의 숫자가 수익률입니다. 비중 " + (HMAP_FOLD * 100) + "% 아래 종목은 [그 밖] 한 칸으로 묶었습니다.</p></div>";
  }

  /* 계좌별 */
  const accRow = a => {
    const ref = a.kind === "reference";
    return '<div class="row' + (ref ? " ref" : a.kind === "total" ? " tot" : "") + '"><div class="nm">' + esc(a.account) +
    '</div><div class="amt">' + won(nz(a.balance)) + "</div>" +
    '<div class="meta">' + (ref
      ? "<span>매수금액 " + won(nz(a.cost)) + "</span><span>평가 " + won(nz(a.value)) + '</span><span class="' + signCls(a.unrealized) + '">평가손익 ' +
        signWon(a.unrealized) + "</span><span>원금 기록 없음, 내 합계에 넣지 않음</span>"
      : "<span>원금 " + won(nz(a.principal)) + '</span><span class="' + signCls(a.pnl) + '">손익 ' + signWon(a.pnl) + " (" + pctS(a.return) + ")</span>" +
        '<span class="' + signCls(a.unrealized) + '">평가손익 ' + signWon(a.unrealized) + "</span>" +
        '<span class="' + signCls(a.realized) + '">실현 ' + signWon(a.realized) + "</span><span>배당 " + won(nz(a.dividend)) + "</span>" +
        "<span>예수금 " + won(nz(a.cash)) + "</span>") +
    "</div></div>";
  };
  const mine = accs.filter(a => a.kind === "account"), refs = accs.filter(a => a.kind === "reference");
  const accCard = '<div class="card"><div class="sec"><h2>계좌별 현황</h2><span class="hint">잔고 = 평가액 + 예수금</span></div>' +
    '<div class="rows">' + mine.map(accRow).join("") + (tot ? accRow(tot) : "") + "</div>" +
    (refs.length ? '<div class="rows" style="margin-top:14px">' + refs.map(accRow).join("") + "</div>" : "") + "</div>";

  /* 보유 종목 */
  const hs = assetHoldings();
  const holdChips = '<div class="chips">' + [["item", "종목 " + hs.length], ["theme", "테마"], ["asset_class", "자산군"]].map(([k, n]) =>
    '<button class="chip' + (AS.hold === k ? " on" : "") + '" data-hold="' + k + '">' + n + "</button>").join("") + "</div>";
  let holdBody;
  if (AS.hold === "item") {
    const show = AS.holdAll ? hs : hs.slice(0, ASSET_LIST_N);
    holdBody = '<div class="rows">' + show.map(h =>
      '<div class="row hold" data-open="' + esc(String(h.ticker)) + '" tabindex="0"><div class="nm">' + esc(h.name) + ' <span class="tk">' + esc(h.ticker || "") + "</span></div>" +
      '<div class="amt">' + won(nz(h.value)) + "</div>" +
      '<div class="bar"><div class="dbar gold"><i class="mine" style="width:' + Math.min(100, nz(h.weight) * 100).toFixed(1) + '%"></i></div></div>' +
      '<div class="meta"><span>' + pctS(h.weight) + '</span><span class="' + signCls(h.pnl) + '">' + signWon(h.pnl) + " (" + pctS(h["return"]) + ")</span>" +
      "<span>" + won(nz(h.qty)) + "주</span><span>평단 " + won(nz(h.avg_cost)) + "원</span>" +
      "<span>현재가 " + localPrice(h.price, h.currency) + "</span>" +
      (nz(h.dividend) ? "<span>배당 " + won(h.dividend) + "</span>" : "") +
      "<span>" + esc(h.theme || "") + "</span></div></div>").join("") + "</div>" +
      (hs.length > ASSET_LIST_N ? moreBtn("asHoldAll", hs.length, AS.holdAll) : "");
  } else {
    const gs = holdingGroups(AS.hold);
    holdBody = '<div class="rows">' + gs.map(g =>
      '<div class="row hold"><div class="nm">' + esc(g.key) + ' <span class="tk">' + g.n + "종목</span></div>" +
      '<div class="amt">' + won(g.value) + "</div>" +
      '<div class="bar"><div class="dbar gold"><i class="mine" style="width:' + Math.min(100, g.weight * 100).toFixed(1) + '%"></i></div></div>' +
      '<div class="meta"><span>' + pctS(g.weight) + '</span><span class="' + signCls(g.pnl) + '">' + signWon(g.pnl) + " (" + pctS(g.ret) + ")</span>" +
      '<span class="wrap">' + g.items.slice(0, 4).map(i => esc(i.name)).join(", ") + (g.items.length > 4 ? " 외" : "") + "</span></div></div>").join("") + "</div>";
  }
  const hv = hs.reduce((s, h) => s + nz(h.value), 0);
  const holdCard = '<div class="card"><div class="sec"><h2>들고 있는 것</h2><span class="hint">평가액 큰 순, 합 <b class="hv">' + won(hv) + "</b>원</span></div>" +
    holdChips + holdBody +
    '<p class="foot">내 계좌 보유분만, 평가액 큰 순입니다. 평단은 매수 묶음 기준 원화, 현재가는 현지 통화입니다. ' +
    (AS.hold === "item" ? "종목을 누르면 상세가 열립니다. " : "") +
    "묶어 볼 때의 수익률은 손익 합을 매수금액 합으로 나눈 값입니다.</p></div>";

  /* 무엇에서 벌고 잃었나. 보유 중(평가손익) / 끝낸 거래(실현손익) */
  let pnlBars = [], pnlFoot = "";
  if (AS.pnlView === "closed") {
    const byName = new Map();
    for (const x of L.closed) {
      const k = x.name || x.ticker || "기타";
      const o = byName.get(k) || { key: k, v: 0, cost: 0 };
      o.v += nz(x.pnl); o.cost += nz(x.cost); byName.set(k, o);
    }
    pnlBars = Array.from(byName.values()).filter(o => o.v)
      .sort((a, b) => Math.abs(b.v) - Math.abs(a.v)).slice(0, 14).sort((a, b) => b.v - a.v)
      .map(o => Object.assign(o, { ret: o.cost ? o.v / o.cost : 0 }));
    pnlFoot = "끝낸 묶음 " + L.n + "건을 종목마다 더했습니다. 손익이 큰 14종목까지. 합 " + signWon(L.pnl) + "원.";
  } else {
    const byAbs = st.hs.filter(h => nz(h.pnl)).slice().sort((a, b) => Math.abs(nz(b.pnl)) - Math.abs(nz(a.pnl)));
    const head = byAbs.slice(0, 7), rest = byAbs.slice(7);
    pnlBars = head.map(h => ({ key: h.name, v: nz(h.pnl), ret: h["return"] })).sort((a, b) => b.v - a.v);
    if (rest.length) {      /* 묶은 줄은 맨 아래. 크기 순에 섞이면 한 종목처럼 읽힌다 */
      const rp = rest.reduce((t, h) => t + nz(h.pnl), 0), rc = rest.reduce((t, h) => t + nz(h.cost), 0);
      pnlBars.push({ key: "나머지 " + rest.length + "종목", v: rp, ret: rc ? rp / rc : 0 });
    }
    const worst = st.hs.slice().sort((a, b) => nz(a.pnl) - nz(b.pnl))[0];
    pnlFoot = "보유 종목 평가손익 합은 " + signWon(st.pnl) + "원입니다." +
      (worst && nz(worst.pnl) < 0 && st.pnl < 0 ? " 그중 " + esc(worst.name) + " 한 종목이 " + signWon(worst.pnl) + "원(" + Math.round(nz(worst.pnl) / st.pnl * 100) + "%)입니다." : "") +
      " 손익 크기 순 7종목까지 따로, 나머지는 묶었습니다.";
  }
  const pnlCard = '<div class="card"><div class="sec"><h2>무엇에서 벌고 잃었나</h2><span class="hint">' + (AS.pnlView === "closed" ? "실현손익" : "평가손익") + "</span></div>" +
    '<div class="chips"><button class="chip' + (AS.pnlView !== "closed" ? " on" : "") + '" data-pnl="open">보유 중</button>' +
    '<button class="chip' + (AS.pnlView === "closed" ? " on" : "") + '" data-pnl="closed">끝낸 거래</button></div>' +
    (pnlBars.length ? divergeBars(pnlBars, { sub: i => pctR(i.ret) }) : '<div class="empty">없습니다.</div>') +
    '<p class="foot">' + pnlFoot + "</p></div>";

  /* 넣은 돈과 지금 잔고 */
  const dep = depositSteps();
  let depCard = "";
  if (dep.length >= 2) {
    const asof = assetAsOf() || todayISO();
    const last = dep[dep.length - 1];
    const line = dep.concat(last.d < asof ? [{ d: asof, v: last.v }] : []);
    const hb = ((A.data && A.data.history) || []).filter(h => h.d && isNum(h.sec_balance));
    const series = [{ name: "넣은 돈 누적", step: true, color: "var(--gold)", w: 2, pts: line.map(p => ({ t: p.d, y: p.v })) }];
    if (hb.length >= 2) series.push({ name: "증권 잔고", color: "var(--navy)", w: 1.8, dot: true, pts: hb.map(h => ({ t: h.d, y: h.sec_balance })) });
    else if (isNum(m.sec_balance)) series.push({ name: "지금 잔고", color: "var(--navy)", dot: true, r: 4, pts: [{ t: asof, y: m.sec_balance }] });
    const ys = (A.data.years || []);
    const thisY = ys.find(y => String(y.year) === yOf(asof));
    const netSum = ys.reduce((s, y) => s + nz(y.net), 0);
    const diffP = isNum(m.sec_principal) ? Math.round(last.v - m.sec_principal) : null;
    depCard = '<div class="card"><div class="sec"><h2>넣은 돈과 지금 잔고</h2><span class="hint">눌러서 값 보기</span></div>' +
      '<div class="trio"><div><span>넣은 돈(순입금)</span><b>' + manS(last.v) + "</b></div>" +
      "<div><span>지금 잔고</span><b>" + manS(m.sec_balance) + "</b></div>" +
      '<div><span>차이</span><b class="' + signCls(nz(m.sec_balance) - last.v) + '">' + signMan(nz(m.sec_balance) - last.v) + "</b></div></div>" +
      timeChart(series, { h: 170, label: "증권 계좌에 넣은 돈 누적과 잔고" }) +
      '<div class="legend"><span><i style="background:var(--gold)"></i>넣은 돈 누적 (입금 - 출금)</span>' +
      '<span><i style="background:var(--navy)"></i>' + (hb.length >= 2 ? "증권 잔고 (7.자산기록)" : "지금 잔고") + "</span></div>" +
      '<p class="foot">1-2.입출금배당의 입금과 출금 ' + won(((A.data.cash) || []).filter(c => c.kind === "입금" || c.kind === "출금").length) + "줄을 날짜순으로 쌓았습니다. 배당은 넣은 돈이 아니라 뺐습니다." +
      (thisY && netSum ? " " + esc(String(thisY.year)) + "년에 넣은 돈은 " + manS(thisY.net) + "으로 누적의 " + pctR(nz(thisY.net) / netSum) + "입니다." : "") +
      (diffP ? " 시트의 순입금(" + won(m.sec_principal) + "원)과 " + won(Math.abs(diffP)) + "원 다릅니다. 입출금 줄을 확인해 보세요." : "") +
      (hb.length >= 2 ? "" : " 7.자산기록에 증권 잔고가 쌓이면 잔고도 선으로 그립니다.") + "</p></div>";
  }

  /* 투자 성적표 */
  const ys = (A.data.years || []).slice().sort((a, b) => a.year - b.year);
  const yTot = k => ys.reduce((s, y) => s + nz(y[k]), 0);
  const report = '<div class="card"><div class="sec"><h2>매매 성적표</h2><span class="hint">끝낸 묶음과 해마다</span></div>' +
    '<div class="rows">' +
    '<div class="row"><div class="nm">실현손익</div><div class="amt ' + signCls(realized) + '">' + signWon(realized) + "</div></div>" +
    '<div class="row"><div class="nm">배당</div><div class="amt pos">+' + won(divTot) + "</div></div>" +
    '<div class="row"><div class="nm">끝낸 묶음</div><div class="amt">' + L.n + "건, 이긴 것 " + L.win + " (" + Math.round(L.winRate * 100) + "%)</div></div>" +
    "</div>" +
    '<div style="height:14px"></div>' +
    barsHTML(ys.map(y => ({ key: String(y.year).slice(2), mine: nz(y.realized) + nz(y.dividend), color: (nz(y.realized) + nz(y.dividend)) >= 0 ? "var(--jade)" : "var(--coral)" })), { h: 120 }) +
    '<div style="overflow-x:auto;margin-top:12px"><table class="tbl"><thead><tr>' +
    "<th>해</th><th>실현손익</th><th>배당</th><th>순입금</th></tr></thead><tbody>" +
    ys.slice().reverse().map(y => "<tr><td>" + y.year + '</td><td class="n ' + signCls(y.realized) + '">' + signWon(y.realized) +
      '</td><td class="n">' + won(nz(y.dividend)) + '</td><td class="n">' + won(nz(y.net)) + "</td></tr>").join("") +
    '<tr class="sumr"><td>합계</td><td class="n ' + signCls(yTot("realized")) + '">' + signWon(yTot("realized")) + '</td><td class="n">' + won(yTot("dividend")) +
    '</td><td class="n">' + won(yTot("net")) + "</td></tr>" +
    "</tbody></table></div>" +
    '<p class="foot">막대는 그해 실현손익 + 배당입니다. 순입금은 입금 - 출금입니다. 1-1.매매기록과 1-2.입출금배당에서 시트가 계산한 값입니다.</p></div>';

  /* 끝낸 묶음 */
  const closed = L.closed.slice().sort((a, b) => (b.sell_date || "") < (a.sell_date || "") ? -1 : 1);
  const closedShow = AS.closedAll ? closed : closed.slice(0, ASSET_LIST_N);
  const closedCard = '<div class="card"><div class="sec"><h2>끝낸 거래</h2><span class="hint">매도일 최근 순, ' + closed.length + "건</span></div>" +
    (closed.length ? '<div class="rows">' + closedShow.map(x =>
      '<div class="row"><div class="nm">' + esc(x.name || x.ticker) + ' <span class="tk">' + esc(x.account || "") + "</span></div>" +
      '<div class="amt ' + signCls(x.pnl) + '">' + signWon(x.pnl) + "</div>" +
      '<div class="meta"><span class="' + signCls(x.ret) + '">' + pctS(x.ret) + "</span><span>" + esc(x.sell_date || "") + " 매도</span>" +
      "<span>" + (isNum(x.days) ? won(x.days) + "일 보유" : "") + "</span><span>매수 " + won(nz(x.cost)) + "</span></div>" +
      (x.memo ? '<div class="meta lotmemo">' + esc(x.memo) + "</div>" : "") + "</div>").join("") + "</div>" +
      (closed.length > ASSET_LIST_N ? moreBtn("asClosedAll", closed.length, AS.closedAll) : "")
      : '<div class="empty">없습니다.</div>') + "</div>";

  /* 보유일과 수익률 */
  const sc = L.closed.filter(x => isNum(x.days) && isNum(x.ret))
    .map(x => ({ x: x.days, y: x.ret, r: 3 + Math.min(6, Math.sqrt(nz(x.cost) / 3000000)),
      t: pctSign(x.ret) + " " + (x.name || "") + "\n" + won(x.days) + "일 보유, " + (x.sell_date || "") + " 매도\n손익 " + signWon(x.pnl) + "원" }));
  const scCard = sc.length >= 4
    ? '<div class="card"><div class="sec"><h2>오래 들수록 나았나</h2><span class="hint">가로는 보유일, 점 크기는 매수금액</span></div>' +
      scatterHTML(sc, { h: 180, xmin: "0일", xmax: Math.max(...sc.map(p => p.x)) + "일" }) +
      '<p class="foot">오른쪽 위로 갈수록 오래 들고 많이 번 거래입니다. 점선은 본전입니다. 점을 누르면 종목과 손익이 뜹니다.</p></div>'
    : "";

  /* 배당 */
  const dv = dividendsBy();
  const dvCard = dv.length
    ? '<div class="card"><div class="sec"><h2>배당 받은 곳</h2><span class="hint">1-2.입출금배당</span></div>' +
      rankList(dv.slice(0, 8), dv[0].mine, { noIcon: true, unit: "번", color: () => "var(--jade)" }) + "</div>"
    : "";

  /* VC */
  const vc = (A.data.vc || []).filter(v => isNum(v.cost) || isNum(v.value));
  const vcCard = vc.length
    ? '<div class="card"><div class="sec"><h2>비상장</h2><span class="hint">5.VC투자</span></div>' +
      '<div class="rows">' + vc.map(v => {
        const done = /^\d{4}-\d{2}-\d{2}$/.test(v.sell || "");
        return '<div class="row' + (done ? " ref" : "") + '"><div class="nm">' + esc(v.name) +
          (v.currency === "USD" ? ' <span class="tk">달러</span>' : "") + '</div><div class="amt">' + won(nz(v.value)) + "</div>" +
          '<div class="meta"><span>투입 ' + won(nz(v.cost)) + '</span><span class="' + signCls(v.pnl) + '">' + signWon(v.pnl) +
          " (" + pctR(v.ret) + ")</span>" + (done ? "<span>" + esc(v.sell) + " 끝남</span>" : "<span>보유 중</span>") + "</div></div>";
      }).join("") + "</div>" +
      '<p class="foot">비상장은 마지막 라운드 가치라 언제든 달라집니다. 팔기 전까지는 숫자일 뿐입니다. ' +
      "달러로 산 것은 시트의 원화 칸(적용 환율을 곱한 값)을 씁니다. 끝난 것은 흐리게 보입니다.</p></div>"
    : "";

  box.innerHTML = assetTopBars() + hero + kpiCard + hmapCard + accCard + holdCard + pnlCard + depCard + report + closedCard + scCard + dvCard + vcCard;
  const redraw = () => { assetInvest(); decorate($("#p-asset")); };
  $$("[data-hold]", box).forEach(b => b.onclick = () => { AS.hold = b.dataset.hold; redraw(); });
  $$("[data-pnl]", box).forEach(b => b.onclick = () => { AS.pnlView = b.dataset.pnl; redraw(); });
  $$("[data-open]", box).forEach(el => el.onclick = () => openHolding(el.dataset.open));
  const ha = $("#asHoldAll", box); if (ha) ha.onclick = () => { AS.holdAll = !AS.holdAll; redraw(); };
  const ca = $("#asClosedAll", box); if (ca) ca.onclick = () => { AS.closedAll = !AS.closedAll; redraw(); };
  decorate(box);
}

/* ---------- 종목 상세 창 ----------
   종목 지도의 칸이나 [들고 있는 것] 의 줄을 누르면 열린다.
   매수 기록 점그림(언제 얼마에 샀나), 평단과 현재가, 들고 있는 묶음, 판 묶음, 배당 */
function openHolding(tk) {
  const h = assetHoldings().find(x => String(x.ticker) === String(tk));
  if (!h) return;
  const cur = h.currency || "KRW";
  const lots = lotsOf(tk).slice().sort((a, b) => (a.buy_date || "") < (b.buy_date || "") ? -1 : 1);
  const open = lots.filter(l => l.status !== "매도"), closed = lots.filter(l => l.status === "매도");
  const paid = lots.filter(l => nz(l.buy_price) > 0 && /^\d{4}-\d{2}-\d{2}/.test(l.buy_date || ""));
  const free = open.filter(l => !(nz(l.buy_price) > 0));
  const freeQty = free.reduce((s, l) => s + nz(l.qty), 0);
  /* 평단. 원화 종목은 시트 값(무상 주식을 0원으로 친 값), 외화 종목은 들고 있는 묶음의 현지 매수가를 수량으로 가중 평균 */
  const oq = open.reduce((s, l) => s + nz(l.qty), 0);
  const avgLocal = cur === "KRW" ? nz(h.avg_cost) : (oq ? open.reduce((s, l) => s + nz(l.qty) * nz(l.buy_price), 0) / oq : null);
  const gapPct = isNum(avgLocal) && avgLocal > 0 && isNum(h.price) ? h.price / avgLocal - 1 : null;
  const maxQ = Math.max(1, ...paid.map(l => nz(l.qty)));
  const pts = paid.map(l => ({
    t: l.buy_date, y: l.buy_price, r: 3 + 6 * Math.sqrt(nz(l.qty) / maxQ),
    color: l.status === "매도" ? "var(--ink3)" : "var(--gold)",
    tip: localPrice(l.buy_price, cur) + " x " + won(l.qty) + "주\n" + l.buy_date + " " + (l.acquire || "매수") +
      (l.status === "매도" ? "\n" + (l.sell_date || "") + " 매도, 손익 " + signWon(l.pnl) + "원" : "\n들고 있음, 손익 " + signWon(l.pnl) + "원"),
  }));
  const refs = [
    isNum(h.price) ? { y: h.price, color: "var(--navy)" } : null,
    isNum(avgLocal) && avgLocal > 0 ? { y: avgLocal, color: "var(--ink2)", dash: true } : null,
  ].filter(Boolean);
  const refN = refLotsOf(tk);
  const dv = dividendsOf(h);
  const dvBy = new Map();
  dv.forEach(c => { const y = String(c.year || yOf(c.date)); dvBy.set(y, (dvBy.get(y) || 0) + nz(c.amount)); });
  const closedPnl = closed.reduce((s, l) => s + nz(l.pnl), 0);
  const lotRow = l => '<div class="row"><div class="nm">' + esc(l.status === "매도" ? (l.sell_date || "") + " 매도" : (l.buy_date || "")) +
    (l.acquire && l.acquire !== "매수" ? ' <span class="tk">' + esc(l.acquire) + "</span>" : "") + ' <span class="tk">' + esc(l.account || "") + "</span></div>" +
    '<div class="amt ' + signCls(l.pnl) + '">' + signWon(l.pnl) + "</div>" +
    '<div class="meta"><span>' + won(nz(l.qty)) + "주</span><span>매수가 " + localPrice(l.buy_price, cur) + "</span>" +
    (l.status === "매도" ? "<span>매도가 " + localPrice(l.sell_price, cur) + "</span><span>" + esc(l.buy_date || "") + " 매수</span>" : "") +
    '<span class="' + signCls(l.ret) + '">' + pctS(l.ret) + "</span>" + (isNum(l.days) ? "<span>" + won(l.days) + "일</span>" : "") + "</div>" +
    (l.memo ? '<div class="meta lotmemo">' + esc(l.memo) + "</div>" : "") + "</div>";

  const html = '<div class="hd">' +
    '<div class="hdtop"><h3>' + esc(h.name) + '</h3><span class="tk">' + esc(h.ticker || "") + "</span></div>" +
    '<div class="hdtags">' + [h.theme, h.asset_class, cur].filter(Boolean).map(esc).join(" / ") + "</div>" +
    '<div class="kpis">' +
    kpi("평가액", manS(h.value), pctS(h.weight) + " (보유 종목 중)") +
    kpi("손익", signMan(h.pnl), pctS(h["return"]), signCls(h.pnl)) +
    kpi("들고 있는 수량", won(nz(h.qty)) + "주", open.length + "묶음" + (freeQty ? ", 무상 " + won(freeQty) + "주 포함" : "")) +
    kpi("배당 누적", manS(nz(h.dividend) || dv.reduce((s, c) => s + nz(c.amount), 0)), dvBy.size ? dvBy.size + "개 해" : "없음") +
    "</div>" +
    (gapPct != null ? '<p class="foot">현재가 ' + localPrice(h.price, cur) + "는 평단 " + localPrice(avgLocal, cur) + "보다 <b class=\"" + signCls(gapPct) + '">' +
      Math.abs(Math.round(gapPct * 100)) + "% " + (gapPct >= 0 ? "위" : "아래") + "</b>입니다.</p>" : "") +
    (paid.length ? '<div class="sec"><h2>언제 얼마에 샀나</h2><span class="hint">점 크기는 수량</span></div>' +
      dotTimeChart(pts, refs, { h: 190, fmt: v => cur === "KRW" ? wonS(v) : (Math.round(v * 100) / 100).toLocaleString("ko-KR"), label: h.name + " 매수 기록" }) +
      '<div class="legend"><span><i style="background:var(--gold)"></i>들고 있는 묶음</span>' +
      (closed.length ? '<span><i style="background:var(--ink3)"></i>판 묶음</span>' : "") +
      (refs[0] ? '<span><i style="background:var(--navy)"></i>현재가 ' + localPrice(h.price, cur) + "</span>" : "") +
      (isNum(avgLocal) && avgLocal > 0 ? '<span><i style="background:var(--ink2)"></i>평단 ' + localPrice(avgLocal, cur) + " (점선)</span>" : "") + "</div>" : "") +
    (open.length ? '<div class="sec"><h2>들고 있는 묶음</h2><span class="hint">' + open.length + "개, 매수일 순</span></div>" +
      '<div class="rows">' + open.map(lotRow).join("") + "</div>" : "") +
    (closed.length ? '<div class="sec"><h2>판 묶음</h2><span class="hint">' + closed.length + "개, 합 " + signWon(closedPnl) + "</span></div>" +
      '<div class="rows">' + closed.slice().sort((a, b) => (b.sell_date || "") < (a.sell_date || "") ? -1 : 1).map(lotRow).join("") + "</div>" : "") +
    (dvBy.size ? '<div class="sec"><h2>배당</h2><span class="hint">1-2.입출금배당</span></div>' +
      '<div class="rows">' + Array.from(dvBy.entries()).sort((a, b) => b[0] < a[0] ? -1 : 1).map(([y, v]) =>
        '<div class="row"><div class="nm">' + esc(y) + '년</div><div class="amt pos">+' + won(v) + "</div></div>").join("") + "</div>" : "") +
    '<p class="foot">1-1.매매기록과 1-2.입출금배당의 값입니다. 손익과 수익률은 시트가 계산한 값 그대로입니다.' +
    (free.length ? " 무상증자처럼 매수가가 0 인 묶음 " + free.length + "개(" + won(freeQty) + "주)는 점그림에서 뺐고 목록에는 있습니다." : "") +
    (refN.length ? " 참고용 계좌(" + esc(Array.from(new Set(refN.map(l => l.account))).join(", ")) + ")의 같은 종목 묶음 " + refN.length + "개(" +
      won(refN.reduce((t, l) => t + nz(l.qty), 0)) + "주)는 내 보유가 아니라 뺐습니다." : "") + "</p>" +
    '<button class="btn ghost" id="hdClose" style="margin-top:14px">닫기</button></div>';
  openModal(html);
  const c = $("#hdClose"); if (c) c.onclick = () => closeModal();
}

/* ---------- 3) 수입원 ---------- */
function assetIncome() {
  const box = $("#assetBody");
  const sal = salarySteps();

  const cur = sal.length ? sal[sal.length - 1] : null;
  const first = sal.length ? sal[0] : null;
  const grow = cur && first && first.base ? (cur.base - first.base) / first.base : 0;

  const hero = '<div class="card hero gold"><span class="eyebrow">지금 계약 연봉</span>' +
    '<div class="big">' + (cur ? won(cur.base) : "-") + '<span class="won">원</span></div>' +
    '<div class="sub">' + (cur ? "<span>" + esc(cur.company) + " <b>" + esc(cur.date) + "</b></span>" : "") +
    (first ? "<span>첫 연봉 대비 <b>+" + Math.round(grow * 100) + "%</b></span>" : "") +
    "<span>단계 <b>" + sal.length + "</b></span></div></div>";

  const curve = sal.length
    ? '<div class="card"><div class="sec"><h2>연봉 곡선</h2><span class="hint">계약 연봉이 바뀐 시점</span></div>' +
      lineChart([{ color: "var(--gold)", dot: true, w: 2.4, pts: sal.map(s => ({ x: s.date, y: s.base })) }],
        { h: 160, zero: false, label: x => x.slice(2, 7) }) +
      '<div style="overflow-x:auto;margin-top:12px"><table class="tbl"><thead><tr>' +
      "<th>회사</th><th>일시</th><th>계약 연봉</th><th>인상</th><th>사유</th></tr></thead><tbody>" +
      sal.slice().reverse().map(s =>
        '<tr><td class="nm">' + esc(s.company) + "</td><td>" + esc(s.date) + '</td><td class="n">' + won(s.base) +
        '</td><td class="n ' + ((s.raise || 0) > 0 ? "pos" : "") + '">' + (s.raise ? "+" + (s.raise * 100).toFixed(1) + "%" : "-") +
        "</td><td>" + esc(s.reason || "") + "</td></tr>").join("") +
      "</tbody></table></div></div>"
    : "";

  /* 사이드 인컴 */
  const side = sideByYear();
  const sideCard = side.length
    ? '<div class="card"><div class="sec"><h2>본업 밖의 수입</h2><span class="hint">자산 시트의 사이드잡</span></div>' +
      barsHTML(side.slice().reverse().map(s => ({ key: String(s.year).slice(2), mine: s.total, color: "var(--in)" })), {}) +
      '<div class="rows" style="margin-top:12px">' + side.map(s =>
        '<div class="row"><div class="nm">' + s.year + "년</div>" +
        '<div class="amt">' + won(s.total) + "</div>" +
        '<div class="meta">' + s.items.slice(0, 4).map(i =>
          "<span>" + esc(i.src) + " " + wonS(i.total) + "</span>").join("") + "</div></div>").join("") + "</div>" +
      '<p class="foot">이 값은 가계부 수입과 겹칩니다. 더하지 마세요. ' +
      "황금여행사분은 가계부에 급여로, 멘토링분은 부수입으로 이미 들어가 있습니다. " +
      "여기서는 그 수입이 어느 수입원에서 왔는지만 보는 표입니다.</p></div>"
    : "";

  /* 가계부 쪽 수입 */
  const ys = years().filter(y => y <= yOf(todayISO()));
  const incByYear = ys.map(y => {
    const rs = S.rows.filter(r => r.y === y && isIn(r));
    return { y, total: sumMine(rs), byS: byKey(rs, r => r.sub) };
  }).reverse();
  const ledgerCard = '<div class="card"><div class="sec"><h2>가계부에 적힌 수입</h2>' +
    '<span class="hint">이쪽이 실제로 들어온 돈</span></div>' +
    '<div style="overflow-x:auto"><table class="tbl"><thead><tr><th>해</th><th>합계</th><th>급여</th><th>부수입</th><th>그 밖</th></tr></thead><tbody>' +
    incByYear.map(r => {
      const g = k => (r.byS.find(x => x.key === k) || { mine: 0 }).mine;
      return "<tr><td>" + r.y + '</td><td class="n">' + won(r.total) + '</td><td class="n">' + won(g("급여")) +
        '</td><td class="n">' + won(g("부수입")) + '</td><td class="n">' + won(r.total - g("급여") - g("부수입")) + "</td></tr>";
    }).join("") + "</tbody></table></div>" +
    '<p class="foot">계약 연봉은 약속한 금액이고, 이 표는 통장에 들어온 금액입니다. 상여와 환급이 섞여 있어 둘은 다릅니다.</p></div>';

  /* 수입 구성이 해마다 어떻게 바뀌었나 */
  const ys2 = years().filter(y2 => y2 <= yOf(todayISO()));
  const incKeys = ["급여", "부수입", "환급/보상", "중고거래", "금융소득", "받은돈"];
  const incCache = new Map();
  const getInc = (y2, k) => {
    if (!incCache.has(y2)) {
      const o = {};
      for (const r of S.rows) if (r.y === y2 && isIn(r)) o[r.sub] = (o[r.sub] || 0) + r.mine;
      incCache.set(y2, o);
    }
    return incCache.get(y2)[k] || 0;
  };
  const mixCard = ys2.length
    ? '<div class="card"><div class="sec"><h2>수입이 어디서 왔나</h2><span class="hint">해마다 쌓아서</span></div>' +
      stackHTML(ys2, incKeys, getInc, { h: 175 }) + "</div>"
    : "";

  box.innerHTML = hero + curve + mixCard + sideCard + ledgerCard;
  decorate(box);
}
