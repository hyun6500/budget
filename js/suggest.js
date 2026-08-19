/* ===== js/suggest.js ===== */
/* suggest.js - 지난 기록에서 배워 입력칸을 미리 채운다.
   따로 학습을 돌리지 않는다. 앱을 켤 때마다 시트를 통째로 읽으므로,
   줄이 쌓일수록 이 추천이 저절로 좋아진다. 지금은 9천 줄이 재료다. */
FILEV.suggest = CONFIG.APP_VERSION;

/** 가맹점 이름을 견줄 수 있게 다듬는다. 지점명과 괄호와 띄어쓰기를 털어 낸다. */
function normPlace(s) {
  return String(s || "")
    .normalize("NFKC")
    .replace(/\(.*?\)/g, " ")
    .replace(/[0-9]+호점|[0-9]+점/g, " ")
    .replace(/주식회사|\\(주\\)/g, " ")
    .replace(/\u321C/g, " ")   /* 원문자 주. 기본 키보드에 없어 코드로 적는다 */
    .replace(/[^0-9A-Za-z가-힣]+/g, "")
    .toLowerCase();
}

/** 그 장소에서 예전에 무엇으로 적었나. 최근 것에 무게를 더 준다. */
function suggestFor(place, amt) {
  const key = normPlace(place);
  if (!key || key.length < 2) return null;

  let hits = S.rows.filter(r => normPlace(r.place) === key);
  if (!hits.length) {
    /* 똑같지 않으면 앞뒤로 품은 이름까지 찾아본다 */
    hits = S.rows.filter(r => {
      const k = normPlace(r.place);
      return k.length >= 2 && (k.indexOf(key) === 0 || key.indexOf(k) === 0);
    });
  }
  if (!hits.length) return null;

  const today = new Date(todayISO());
  const weight = r => {
    const days = Math.max(0, (today - new Date(r.date)) / 86400000);
    return 1 / (1 + days / 540);        /* 한 해 반이 지나면 무게가 반쯤 */
  };
  const top = field => {
    const m = new Map();
    for (const r of hits) {
      const v = r[field];
      if (!v) continue;
      m.set(v, (m.get(v) || 0) + weight(r));
    }
    if (!m.size) return null;
    const arr = Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
    const sum = arr.reduce((a, x) => a + x[1], 0);
    return { v: arr[0][0], share: arr[0][1] / sum, alts: arr.slice(1, 3).map(x => x[0]) };
  };

  const amts = hits.map(r => r.amt).sort((a, b) => a - b);
  const med = amts[Math.floor(amts.length / 2)];
  const near = amt ? Math.abs(amt - med) / Math.max(1, med) : null;

  return {
    n: hits.length,
    last: hits[hits.length - 1],
    sub: top("sub"), pay: top("pay"), situ: top("situ"),
    share: top("share"), treat: top("treat"), theme: top("theme"),
    detail: top("detail"),
    median: med,
    odd: (near != null && near > 1.5 && hits.length >= 3) ? med : null,
  };
}

/* ---------- 시각으로 끼니를 짚는다 ----------
   18시 12분에 밥을 먹었는데 상황이 점심으로 잡히면 곤란하다.
   장소의 지난 버릇보다 그날 그 시각이 우선이다. */
const MEAL_SUBS = /^(구내식당|치킨|피자\/버거|분식|한식|고기\/구이|일식|중식|양식|아시안|뷔페|도시락|식당기타|배달앱|카페|베이커리|디저트|주점|유흥)$/;
function situByTime(time, sub) {
  const m = String(time || "").match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = +m[1];
  const eat = MEAL_SUBS.test(sub || "");
  if (h >= 5 && h < 10) return eat ? "아침" : null;
  if (h >= 10 && h < 15) return eat ? "점심" : null;
  if (h >= 16 && h < 21) return eat ? "저녁" : null;
  if (h >= 21 || h < 4) return eat ? "야식" : null;
  return eat ? "간식" : null;
}

/** 추천을 칸에 넣는다. 비어 있는 칸만 건드린다. */
function applySuggest(sg, scope, ctx) {
  const R = scope || fscope();
  const done = [];
  /* 시각이 있으면 끼니는 그쪽을 따른다 */
  if (ctx && ctx.time) {
    const subNow = $("#f_sub", R) ? $("#f_sub", R).value : "";
    const guess = situByTime(ctx.time, subNow || (sg && sg.sub ? sg.sub.v : ""));
    const n = $("#f_situ", R);
    if (guess && n && !n.value && Array.from(n.options).some(x => x.value === guess)) {
      n.value = guess;
      done.push("상황 " + guess + " (" + ctx.time + ")");
    }
  }
  if (!sg) return done;
  const put = (id, o, label) => {
    if (!o || o.share < 0.4) return;
    const n = $(id, R);
    if (!n || n.value) return;
    /* 목록에 없는 값은 넣지 않는다 */
    if (n.tagName === "SELECT" && !Array.from(n.options).some(x => x.value === o.v)) return;
    n.value = o.v;
    done.push(label + " " + o.v + " (" + Math.round(o.share * 100) + "%)");
  };
  put("#f_sub", sg.sub, "소분류");
  put("#f_pay", sg.pay, "결제수단");
  put("#f_situ", sg.situ, "상황");
  put("#f_share", sg.share, "누구 몫");
  put("#f_treat", sg.treat, "대접");
  return done;
}

/** 추천을 말로 풀어 준다. */
function suggestHTML(sg, ctx) {
  const pre = [];
  if (ctx && ctx.time) {
    const g = situByTime(ctx.time, ctx.sub || (sg && sg.sub ? sg.sub.v : ""));
    if (g) pre.push('<div class="rhint"><b>결제 시각</b><span>' + esc(ctx.time) +
      " 이니 상황은 <b>" + esc(g) + "</b> 로 봅니다. 장소의 지난 버릇보다 그날 그 시각을 먼저 봅니다.</span></div>");
  }
  if (!sg) return pre.join("");
  const bits = [];
  const say = (o, name) => { if (o && o.share >= 0.3) bits.push(name + " <b>" + esc(o.v) + "</b> " + Math.round(o.share * 100) + "%"); };
  say(sg.sub, "소분류"); say(sg.pay, "결제수단"); say(sg.situ, "상황"); say(sg.treat, "대접");
  if (!bits.length) return pre.join("");
  return pre.join("") + '<div class="rhint"><b>지난 기록</b><span>이 곳에서 <b>' + sg.n + "번</b> 썼습니다. " + bits.join(" / ") +
    ". 보통 " + won(sg.median) + "원." +
    (sg.odd ? ' <b style="color:var(--coral)">이번 금액은 평소와 많이 다릅니다.</b>' : "") +
    "</span></div>";
}
