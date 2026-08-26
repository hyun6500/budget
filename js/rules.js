/* ===== js/rules.js ===== */
/* rules.js - 예외를 어떻게 적는지 한곳에 모은 곳.
   같은 표를 두 군데서 쓴다. 하나는 입력 화면 아래의 설명, 하나는 적는 동안 뜨는 안내.
   규칙을 고칠 일이 생기면 이 배열만 고치면 두 곳이 함께 바뀐다. */
FILEV.rules = CONFIG.APP_VERSION;

const RULES = [
  {
    key: "용돈", title: "현금으로 드린 용돈",
    how: "소분류 [용돈] + [대접] 에 받는 사람",
    note: "물건을 사드린 것은 [선물] 입니다. 함께 먹은 밥은 업종을 그대로 두고 [대접] 만 적습니다. 연간요약에서 셋이 한 표로 합쳐집니다.",
    on: v => v.sub === "용돈",
    need: v => !v.treat ? { field: "treat", msg: "누구에게 드린 용돈인지 [대접] 을 골라 주세요" } : null,
  },
  {
    key: "선물", title: "물건으로 드린 선물",
    how: "소분류 [선물] + [대접] 에 받는 사람",
    note: "업종(가전, 의류)이 아니라 [선물] 로 넣습니다. 여행지에서 산 것은 [여행 선물] 입니다. " +
      "예전에는 상황에 [선물용] 을 함께 적었지만 204건 전부가 소분류 [선물] 이라 정보를 더하지 않아 없앴습니다.",
    on: v => v.sub === "선물" || v.sub === "여행 선물",
    need: v => !v.treat ? { field: "treat", msg: "누구에게 준 선물인지 [대접] 을 골라 주세요" } : null,
  },
  {
    key: "대접", title: "함께 먹은 밥과 커피",
    how: "업종은 그대로 + [대접] 에 함께한 사람",
    note: "밥과 커피는 선물이 아니라 대접이라 [한식], [카페] 같은 업종을 그대로 둡니다. 옛 가계부의 엄빠, 보은이 여기에 해당합니다.",
    on: v => !!v.treat && v.sub !== "용돈" && v.sub !== "선물" && v.sub !== "여행 선물",
    need: () => null,
  },
  {
    key: "보은", title: "신세를 갚는 자리",
    how: "테마 [보은] + [대접] 에 그 사람",
    note: "업종은 그대로 둡니다. 왜 그 자리였는지는 [테마] 가 알려 줍니다. " +
      "예전에는 상황 칸에 적었지만, 상황은 끼니만 담는 칸으로 좁혔습니다.",
    on: v => v.theme === "보은",
    need: v => !v.treat ? { field: "treat", msg: "누구에게 갚는 자리인지 [대접] 을 골라 주세요" } : null,
  },
  {
    key: "소개팅", title: "소개팅",
    how: "테마 [소개팅] + [동행] 에 상대 이름 + [대접] 은 비움",
    note: "이름은 [소개팅 이력] 시트의 동행 이름과 한 글자도 다르지 않아야 집계됩니다. 연애가 시작되면 그때부터는 [데이트] 로 바꿉니다.",
    on: v => v.theme === "소개팅",
    need: v => !v.with ? { field: "with", msg: "[동행] 에 상대 이름을 적어 주세요" }
      : v.treat ? { field: "treat", msg: "소개팅은 [대접] 을 비웁니다. 연애가 시작되면 [연인] 으로 바꾸세요" } : null,
  },
  {
    key: "데이트", title: "연애 중 데이트",
    how: "테마 [데이트] + [대접] 연인 + [동행] 에 상대 이름",
    note: "소개팅과 연애 기간이 겹치는 사람은 연애 쪽으로만 넣습니다. 양쪽에 넣으면 같은 돈을 두 번 세게 됩니다. 실제로 옛 시트에서 그렇게 새고 있었습니다.",
    on: v => v.theme === "데이트",
    fill: v => (!v.treat ? { treat: "연인" } : null),
    need: v => !v.with ? { field: "with", msg: "[동행] 에 상대 이름을 적어 주세요" }
      : (v.treat !== "연인" ? { field: "treat", msg: "[대접] 을 [연인] 으로 골라 주세요" } : null),
  },
  {
    key: "반반", title: "둘이 반씩 낸 것",
    how: "[금액] 은 전액 그대로 + [누구 몫] 을 반반으로",
    note: "미리 나눠서 적지 마세요. 전액을 두고 비율로 나눠야 나중에 비율이 바뀌어도 되돌릴 수 있습니다. [내 몫] 은 저절로 계산됩니다.",
    on: v => /반반|넷이서|셋이서/.test(v.share || ""),
    need: v => (v.share === "연인과 반반" && !v.with) ? { field: "with", msg: "[동행] 에 상대 이름을 적어 주세요" } : null,
  },
  {
    key: "가족여행", title: "가족이 함께 다녀온 여행",
    how: "[금액] 전액 + [누구 몫] 가족 넷이서 + 테마 [여행]",
    note: "가족계금으로 다녀온 여행입니다. 결제는 한 사람이 해도 부담은 넷이 나눕니다.",
    on: v => v.share === "가족 넷이서",
    need: () => null,
  },
  {
    key: "여행", title: "여행에 딸린 지출",
    how: "테마 [여행] + [건] 에 여행 이름. 소분류는 무엇이든 됩니다",
    note: "여행예약과 항공은 [여행] 대분류를 쓰고, 여행계 납입은 [계좌이체], 여행지에서 먹은 밥은 그냥 [식비] 입니다. " +
      "무엇을 샀나(소분류)와 어떤 일에 딸렸나(테마)는 다른 질문이라 서로를 얽매지 않습니다. " +
      "예전 규칙은 소분류를 여행 아래로 강제했는데, 실제 기록 262건 중 141건이 그 규칙을 어기고 있었습니다.",
    on: v => v.theme === "여행",
    need: () => null,
  },
  {
    key: "건", title: "여행 한 번을 하나로 묶기",
    how: "테마 [여행] + [건] 에 그 여행 이름. 예: 통영 3박4일",
    note: "테마는 어떤 종류의 일이냐에 답하고, [건] 은 그중 어느 일이냐에 답합니다. " +
      "이름을 달아야 여행 하나만 따로 뜯어보고 다른 여행과 견줄 수 있습니다. " +
      "날짜가 이미 이름을 단 여행 기간 안이면 앱이 저절로 채워 줍니다. " +
      "여행계 납입 같은 이체는 특정 여행에 딸린 것이 아니라 이름을 달지 않습니다. " +
      "여행 말고도 이사나 결혼 준비처럼 시작과 끝이 있는 일이면 무엇이든 묶을 수 있습니다.",
    on: v => v.theme === "여행" || !!(v.event || "").trim(),
    need: v => (v.theme === "여행" && v.kind !== "이체" && !(v.event || "").trim())
      ? { field: "event", msg: "어느 여행인지 [건] 에 이름을 적어 주세요. 지난 이름은 칸을 누르면 뜹니다" } : null,
  },
  {
    key: "이체", title: "저축과 계좌이체",
    how: "소분류를 저축, 투자, 계좌이체, 대출 상환 중에서",
    note: "소비가 아니라 지출 합계에서 빠집니다. 생활비통장 납입과 여행계 납입이 여기 들어갑니다. 그 돈으로 산 것은 따로 적히므로, 여기까지 지출로 세면 두 번 셈이 됩니다.",
    on: v => v.kind === "이체",
    need: () => null,
  },
  {
    key: "일시성", title: "한 번으로 끝나는 큰 지출",
    how: "[일시성] 을 Y 로",
    note: "추이를 볼 때 걸러 내기 위한 표시입니다. 명절 용돈처럼 해마다 되풀이되는 것은 Y 가 아닙니다.",
    on: v => v.once === "Y",
    need: () => null,
  },
  {
    key: "환불", title: "돌려받은 돈 (환불)",
    how: "돌려받은 날짜로 [금액] 을 음수로 + 상황 [환불] + [세부내역] 에 원래 줄 번호",
    note: "원래 결제 줄은 금액을 고치지 않습니다. 돈이 돌아온 날에 따로 한 줄을 적습니다. " +
      "환불은 번 돈이 아니라 쓴 돈의 취소라서 [구분] 은 지출 그대로 두고 금액만 음수로 둡니다. " +
      "수입으로 넣으면 저축률이 거짓이 됩니다. 소분류와 장소는 원래 줄과 똑같이 두어야 같은 갈래에서 빠집니다.",
    on: v => (v.amt || 0) < 0 || v.situ === "환불",
    need: v => (v.amt || 0) >= 0
      ? { field: "amt", msg: "환불은 [금액] 을 돌려받은 만큼 음수로 적습니다 (예: -110000)" }
      : (!/no\s*\.?\s*\d+/.test(v.detail || "") && !/no\s*\.?\s*\d+/.test(v.memo || "")
        ? { field: "detail", msg: "[세부내역] 이나 [메모] 에 원래 줄 번호를 남겨 주세요 (예: no.8976 환불)" } : null),
  },
  {
    key: "남이낸것", title: "남이 낸 것",
    how: "[누구 몫] 을 남이 낸 것으로 (부담률 0)",
    note: "기록은 남기되 내 지출에서는 빠집니다. 상대가 사준 밥을 남겨 두고 싶을 때 씁니다.",
    on: v => v.share === "남이 낸 것",
    need: () => null,
  },
];

/* ---------- 사람 되짚기 ----------
   주선자와 소개 루트는 가계부 [입력] 시트의 칸이 아니라 [소개팅 이력] 시트에
   사람당 한 번 적는 값이다. 메모에 적으면 축이 섞이고 같은 것이 두 곳에 생긴다.
   그래서 앱은 이름으로 그 표를 되짚어 보여 주기만 하고, 없는 이름이면 그 표에 더한다. */
function findPerson(name) {
  const n = String(name || "").trim();
  if (!n) return null;
  const P = S.people || { intro: [], love: [] };
  const hit = (P.love || []).find(x => x.with === n || x.name === n);
  if (hit) return Object.assign({ kind: "연애" }, hit);
  const h2 = (P.intro || []).find(x => x.with === n || x.name === n);
  return h2 ? Object.assign({ kind: "소개팅" }, h2) : null;
}
/** 동행 칸 자동 완성에 쓸 이름들 */
function knownNames() {
  const P = S.people || { intro: [], love: [] };
  const s = new Set();
  (P.intro || []).concat(P.love || []).forEach(x => { if (x.with) s.add(x.with); else if (x.name) s.add(x.name); });
  S.rows.forEach(r => { if (r.with) r.with.split(/[,;\/]/).forEach(n => { const t = n.trim(); if (t) s.add(t); }); });
  return Array.from(s).sort();
}
/** 이력에 이미 있는 주선자들 */
function knownMakers() {
  const P = S.people || { intro: [], love: [] };
  const s = new Set();
  (P.intro || []).concat(P.love || []).forEach(x => { if (x.maker) s.add(x.maker); });
  return Array.from(s).sort();
}
const INTRO_ROUTES = ["앱", "지인 소개", "SNS", "모임", "직접", "기타"];

/* 이력 시트의 [구분] 칸에 들어가는 값. 서버의 PERSON_SRC 와 같아야 한다.
   지금 그 칸에는 인연찾기탭 112, 초기(21-04탭) 48, 신규 7 이 쓰이고 있다. */
const PERSON_SRC = "가계부 앱";

function knownJobs() {
  const P = S.people || { intro: [], love: [] };
  const s = new Set();
  (P.intro || []).concat(P.love || []).forEach(x => { if (x.job) s.add(x.job); });
  return Array.from(s).sort();
}
function knownDiscBy() {
  const s = new Set();
  S.rows.forEach(x => { if (x.discBy) s.add(x.discBy); });
  ["쿠팡 포인트", "네이버 포인트", "카카오페이 포인트", "상품권", "쿠폰", "기프티콘", "마일리지"]
    .forEach(x => s.add(x));
  return Array.from(s).sort();
}
function knownAreas() {
  const P = S.people || { intro: [], love: [] };
  const s = new Set();
  (P.intro || []).forEach(x => { if (x.area) s.add(x.area); });
  return Array.from(s).sort();
}

/* ---------- 환불 줄 만들기 ----------
   원래 줄에서 갈래를 정하는 칸(소분류, 장소, 누구 몫, 테마, 대접, 동행, 일시성)을 그대로 베낀다.
   그래야 돌려받은 돈이 원래 쓴 갈래에서 정확히 빠진다.
   할인과 할인수단은 베끼지 않는다. 환불 줄에는 할인이라는 것이 없다. */
function refundRowFrom(r, opt) {
  const o = opt || {};
  const back = Math.abs(Number(o.amt) || 0);
  return {
    date: o.date || todayISO(),
    amt: -back,
    sub: r.sub, big: r.big, kind: r.kind || "지출",
    place: r.place, share: r.share || "내 몫 전부",
    pay: o.pay || r.pay || "",
    situ: hasSitu("환불") ? "환불" : (r.situ || ""),
    treat: r.treat || "", theme: r.theme || "", once: r.once || "",
    with: r.with || "",
    detail: o.detail || ("환불 no." + r.no + " " + (r.detail || "")).trim(),
    memo: o.memo || (r.date + " no." + r.no + " 결제분 " + (o.label || "환불")),
    time: "", disc: 0, discBy: "",
  };
}
/** 분류표 상황 목록에 그 값이 있나. 없으면 상황 칸을 건드리지 않는다 */
function hasSitu(v) {
  const list = (S.meta && S.meta.situs) || [];
  return list.indexOf(v) >= 0;
}

/* ---------- 앞질러 알려 주기 ----------
   지금 고른 것 때문에 앞으로 꼭 채워야 할 칸이 무엇인지, 아직 비어 있어도 미리 알려 준다.
   붉게 칠하고 저장을 막는 것은 마지막 수단이다. 그 전에 무엇이 왜 필요한지 보여야 한다. */
const FIELD_NAME = { treat: "대접", with: "동행", event: "건", sub: "소분류", amt: "금액", detail: "세부내역" };
function ruleDemands(v) {
  const out = {};
  for (const r of RULES) {
    let on = false;
    try { on = !!r.on(v); } catch (e) { on = false; }
    if (!on) continue;
    /* 그 칸을 일부러 비워 두고 물어보면 무엇이 걸리는지 알 수 있다 */
    for (const f of ["treat", "with", "event"]) {
      let n = null;
      try { n = r.need(Object.assign({}, v, { [f]: "" })); } catch (e) { n = null; }
      if (n && n.field === f) out[f] = r.title;
    }
  }
  return out;   /* { with: "소개팅", event: "여행 한 번을 하나로 묶기" } */
}

/** 지금 적고 있는 내용에 걸리는 규칙을 찾는다. */
function ruleCheck(v) {
  const hit = [], errors = [];
  let fill = null;
  for (const r of RULES) {
    let on = false;
    try { on = !!r.on(v); } catch (e) { on = false; }
    if (!on) continue;
    hit.push(r);
    if (r.fill) { const f = r.fill(v); if (f) fill = Object.assign(fill || {}, f); }
    const n = r.need(v);
    if (n) errors.push(Object.assign({ key: r.key }, n));
  }
  return { hit, errors, fill };
}

/** 입력 화면 아래에 붙는 설명. 접었다 폈다 한다. */
function guideHTML() {
  return '<div class="card"><div class="sec"><h2>예외는 이렇게 적습니다</h2>' +
    '<button class="btn sm ghost" id="guideToggle">펼치기</button></div>' +
    '<p class="foot" style="margin:0">업종, 상황, 대접, 테마, 부담을 각각 다른 칸에 두는 것이 이 장부의 뼈대입니다. ' +
    "헷갈리는 열두 가지를 모아 두었습니다.</p>" +
    '<div id="guideBody" hidden style="margin-top:14px">' +
    RULES.map(r =>
      '<div class="grule"><div class="t">' + esc(r.title) + "</div>" +
      '<div class="h">' + esc(r.how) + "</div>" +
      (r.note ? '<div class="n">' + esc(r.note) + "</div>" : "") + "</div>").join("") +
    "</div></div>";
}
