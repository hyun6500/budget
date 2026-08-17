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
    note: "업종(가전, 의류)이 아니라 [선물] 로 넣습니다. 여행지에서 산 것은 [여행 선물] 입니다. 소분류 이름이 겹치면 조회가 엉키기 때문에 이름을 갈라 두었습니다.",
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
    how: "상황 [보은] + [대접] 에 그 사람",
    note: "업종은 그대로 둡니다. 왜 그 자리였는지는 [상황] 이 알려 줍니다.",
    on: v => v.situ === "보은",
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
    key: "여행", title: "여행 중에 쓴 돈",
    how: "업종이 아니라 [여행] 대분류 아래의 소분류로 + 상황 [여행 중]",
    note: "여행지 카페는 [카페] 가 아니라 여행 아래의 음료 소분류입니다. 여행은 그 자체가 하나의 사건이라 따로 묶는 편이 실제로 쓸모 있었습니다.",
    on: v => v.situ === "여행 중" || v.theme === "여행",
    need: v => (v.situ === "여행 중" && v.big && v.big !== "여행")
      ? { field: "sub", msg: "여행 중이라면 [여행] 대분류 아래의 소분류로 골라 주세요" } : null,
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
    key: "남이낸것", title: "남이 낸 것",
    how: "[누구 몫] 을 남이 낸 것으로 (부담률 0)",
    note: "기록은 남기되 내 지출에서는 빠집니다. 상대가 사준 밥을 남겨 두고 싶을 때 씁니다.",
    on: v => v.share === "남이 낸 것",
    need: () => null,
  },
];

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
