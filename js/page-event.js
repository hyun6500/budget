/* ===== js/page-event.js ===== */
/* page-event.js - 건. 여러 줄을 하나의 일로 묶고, 묶인 일끼리 견준다.
   날짜만으로는 여행을 못 가른다. 예약이 몇 달 앞서고, 두 여행이 붙어 한 덩어리가 되기도 한다.
   그래서 앱은 후보만 내밀고 이름은 사람이 단다. 대신 스무 줄을 한 번에 단다. */
FILEV.event = CONFIG.APP_VERSION;

const EV = { gap: 7, pick: new Set(), name: "", only: true };

/* ---------- 후보 뭉치 만들기 ----------
   이름이 아직 없는 여행 줄을 날짜 간격으로 잘라 덩어리를 만든다. 어디까지나 후보다. */
function eventCandidates(gap) {
  const g = gap == null ? EV.gap : gap;
  const rs = S.rows
    .filter(r => (r.theme === "여행" || r.big === "여행") && !(r.event || "").trim())
    .filter(r => r.sub !== "계좌이체")        /* 여행계 납입은 사건이 아니라 매달 붓는 적금 */
    .slice().sort((a, b) => a.date < b.date ? -1 : 1);
  const out = [];
  let cur = [];
  for (const r of rs) {
    if (cur.length && (new Date(r.date) - new Date(cur[cur.length - 1].date)) / 86400000 > g) {
      out.push(cur); cur = [];
    }
    cur.push(r);
  }
  if (cur.length) out.push(cur);
  return out.map(c => ({
    rows: c, from: c[0].date, to: c[c.length - 1].date, n: c.length,
    mine: c.reduce((a, r) => a + r.mine, 0),
    who: Array.from(new Set(c.map(r => (r.with || "").trim()).filter(Boolean))),
    places: Array.from(new Set(c.map(r => (r.place || "").trim()).filter(Boolean))),
  })).sort((a, b) => a.from < b.from ? 1 : -1);
}

/** 이름 없는 여행 줄이 몇 개나 남았나 */
function untaggedCount() {
  return S.rows.filter(r => (r.theme === "여행" || r.big === "여행") &&
    !(r.event || "").trim() && r.sub !== "계좌이체").length;
}

/* ---------- 묶기 화면 ---------- */
function openGrouper(seed) {
  EV.pick = new Set((seed && seed.rows || []).map(r => r.no));
  EV.name = "";

  const paint = () => {
    const cands = eventCandidates();
    const picked = S.rows.filter(r => EV.pick.has(r.no));
    const sum = picked.reduce((a, r) => a + r.mine, 0);
    const ds = picked.map(r => r.date).sort();

    return '<h2 style="font-size:16px;margin-bottom:2px">여행 묶기</h2>' +
      '<p style="font-size:11.5px;color:var(--ink3);margin:0 0 12px">' +
      "날짜가 붙은 줄을 덩어리로 묶어 두었습니다. 맞는 덩어리를 누르고 이름을 지어 주세요. " +
      "예약은 여행보다 몇 달 앞서므로 아래 목록에서 따로 골라 더하시면 됩니다.</p>" +

      '<div class="fl"><span>이 여행의 이름<em>*</em></span>' +
      '<input id="ev_name" list="dl_ev2" placeholder="통영 3박4일" value="' + esc(EV.name) + '">' +
      '<datalist id="dl_ev2">' + eventNames().map(n => '<option value="' + esc(n) + '"></option>').join("") +
      "</datalist></div>" +

      (picked.length
        ? '<div class="rfprev"><div class="t">고른 줄 ' + picked.length + "건</div>" +
          '<div class="rows"><div class="row"><div class="nm">' +
          esc(ds[0]) + " ~ " + esc(ds[ds.length - 1]) + '</div><div class="amt">' + won(sum) + "</div></div></div></div>"
        : '<div class="rfprev"><div class="t">아직 고른 줄이 없습니다</div></div>') +

      '<div class="chips" style="margin-top:12px">' +
      [3, 7, 14].map(g => '<button class="chip' + (EV.gap === g ? " on" : "") + '" data-gap="' + g +
        '">간격 ' + g + "일</button>").join("") + "</div>" +

      '<div class="evlist">' + cands.slice(0, 40).map((c, i) => {
        const on = c.rows.every(r => EV.pick.has(r.no));
        return '<div class="evc' + (on ? " on" : "") + '" data-ec="' + i + '">' +
          '<div class="d">' + esc(c.from) + " ~ " + esc(c.to) + '<b>' + won(c.mine) + "</b></div>" +
          '<div class="m">' + c.n + "건" + (c.who.length ? " / " + esc(c.who.join(", ")) : "") +
          " / " + esc(c.places.slice(0, 3).join(", ")) + (c.places.length > 3 ? " 외" : "") + "</div></div>";
      }).join("") + "</div>" +

      '<div style="display:flex;gap:8px;margin-top:14px">' +
      '<button class="btn" id="ev_go"' + (picked.length && EV.name.trim() ? "" : " disabled") + ">" +
      (picked.length ? "이 " + picked.length + "건에 이름 달기" : "줄을 먼저 고르세요") + "</button>" +
      '<button class="btn ghost" id="ev_no" style="max-width:96px">닫기</button></div>';
  };

  const bind = () => {
    const cands = eventCandidates();
    $$("[data-gap]", $("#modalBody")).forEach(b => b.onclick = () => { EV.gap = +b.dataset.gap; redraw(); });
    $$("[data-ec]", $("#modalBody")).forEach(b => b.onclick = () => {
      const c = cands[+b.dataset.ec];
      const on = c.rows.every(r => EV.pick.has(r.no));
      c.rows.forEach(r => on ? EV.pick.delete(r.no) : EV.pick.add(r.no));
      /* 이름을 아직 안 지었으면 기간으로 미리 채워 준다 */
      const nm = $("#ev_name");
      if (nm && !nm.value.trim() && !on) {
        const nights = Math.round((new Date(c.to) - new Date(c.from)) / 86400000);
        EV.name = c.from.slice(0, 7).replace("-", ".") + " " + (nights > 0 ? nights + "박" + (nights + 1) + "일" : "당일");
      } else if (nm) EV.name = nm.value;
      redraw();
    });
    const nm = $("#ev_name");
    if (nm) nm.oninput = () => {
      EV.name = nm.value;
      const b = $("#ev_go");
      if (b) b.disabled = !(EV.pick.size && EV.name.trim());
    };
    $("#ev_no").onclick = () => closeModal(true);
    const go = $("#ev_go");
    if (go && !go.disabled) go.onclick = () => tagEvent(Array.from(EV.pick), EV.name.trim());
  };
  const redraw = () => { $("#modalBody").innerHTML = paint(); bind(); };

  swapModal(paint());
  bind();
}

async function tagEvent(nos, name) {
  if (!await ensureAuth()) return;
  const b = $("#ev_go");
  if (b) { b.disabled = true; b.textContent = "다는 중"; }
  try {
    const j = await post("tagEvent", { token: AUTH.token, nos, name });
    nos.forEach(no => { const r = S.rows.find(x => x.no === +no); if (r) r.event = name; });
    cacheDrop();
    closeModal(true);
    renderAll();
    toast(j.n + "건을 " + name + " 으로 묶었습니다");
  } catch (e) {
    if (b) { b.disabled = false; b.textContent = "이름 달기"; }
    toast("실패: " + e.message);
  }
}

/* ---------- 건별로 뜯어보기 ----------
   소개팅과 연애를 사람 이름으로 뜯어보듯 여행은 건 이름으로 뜯어본다. */
function eventsHTML() {
  const evs = allEvents();
  const left = untaggedCount();
  const head =
    '<div class="card"><div class="sec"><h2>여행 하나씩</h2>' +
    '<span class="hint">' + evs.length + "번</span></div>" +
    (left
      ? '<div class="rhint"><b>아직 이름이 없는 줄</b><span>여행으로 잡히는데 어느 여행인지 모르는 줄이 <b>' +
        left + "건</b> 있습니다. 묶어 두면 여행끼리 견줄 수 있습니다.</span></div>" +
        '<button class="btn" id="evGroup" style="margin-top:10px">여행 묶기</button>'
      : '<button class="btn ghost sm" id="evGroup" style="width:100%">여행 묶기 창 열기</button>') +
    "</div>";

  if (!evs.length) return head;

  /* 동행 갈래별 평균. 가족 여행이 연인 여행보다 비싼지 같은 것 */
  const byKind = new Map();
  evs.forEach(e => {
    const o = byKind.get(e.kind) || { key: e.kind, n: 0, mine: 0, amt: 0, nights: 0 };
    o.n++; o.mine += e.mine; o.amt += e.amt; o.nights += e.nights; byKind.set(e.kind, o);
  });
  const kinds = Array.from(byKind.values()).sort((a, b) => b.mine / b.n - a.mine / a.n);
  const kindCard =
    '<div class="card"><div class="sec"><h2>누구와 갔나</h2><span class="hint">여행 한 번 평균</span></div>' +
    rankList(kinds.map(k => ({ key: k.key, mine: Math.round(k.mine / k.n), amt: 0, n: k.n })),
      Math.round(kinds[0].mine / kinds[0].n), {
      noIcon: true, color: () => "var(--gold)",
      extra: it => {
        const k = byKind.get(it.key);
        return it.n + "번 / 합계 " + wonS(k.mine) + " / 하루 " +
          won(Math.round(k.mine / Math.max(1, k.nights + k.n))) ;
      },
    }) +
    '<p class="foot">평균은 여행 한 번에 쓴 내 몫입니다. 하루 값은 박수로 나눈 것입니다.</p></div>';

  /* 여행끼리 나란히 */
  const mx = Math.max(...evs.map(e => e.mine));
  const listCard =
    '<div class="card"><div class="sec"><h2>여행끼리</h2><span class="hint">최근 순. 누르면 자세히</span></div>' +
    '<div class="rows">' + evs.map(e =>
      '<div class="row evrow" data-ev="' + esc(e.name) + '" style="cursor:pointer">' +
      '<div class="nm">' + esc(e.name) + ' <span class="rfchip" style="color:var(--gold);background:rgba(212,175,55,.15)">' +
      esc(e.kind) + "</span></div>" +
      '<div class="amt">' + won(e.mine) + "</div>" +
      '<div class="bar"><div class="dbar"><i class="mine" style="width:' +
      (e.mine / mx * 100).toFixed(1) + '%;background:var(--gold)"></i></div></div>' +
      '<div class="meta"><span>' + esc(e.from.slice(2)) + "</span>" +
      "<span>" + (e.nights ? e.nights + "박" + (e.nights + 1) + "일" : "당일") + "</span>" +
      "<span>" + e.n + "건</span><span>하루 " + won(e.perDay) + "</span>" +
      (e.who.length ? "<span>" + esc(e.who.join(", ")) + "</span>" : "") + "</div></div>").join("") +
    "</div></div>";

  return head + kindCard + listCard;
}

/** 여행 한 번을 통째로 뜯어보는 창 */
function openEventDetail(name) {
  const e = eventStat(name);
  if (!e) return;
  const subs = byKey(e.rows.filter(isOut), r => r.sub);
  const days = byKey(e.rows.filter(isOut), r => r.date).slice().sort((a, b) => a.key < b.key ? -1 : 1);
  const others = allEvents().filter(x => x.name !== name && x.kind === e.kind);
  const avg = others.length ? Math.round(others.reduce((a, x) => a + x.mine, 0) / others.length) : 0;

  swapModal(
    '<h2 style="font-size:16px;margin-bottom:2px">' + esc(e.name) + "</h2>" +
    '<p style="font-size:11.5px;color:var(--ink3);margin:0 0 12px">' +
    esc(e.from) + " ~ " + esc(e.to) + " / " + (e.nights ? e.nights + "박" + (e.nights + 1) + "일" : "당일") +
    " / " + esc(e.kind) + (e.who.length ? " / " + esc(e.who.join(", ")) : "") + "</p>" +

    '<div class="hero" style="margin-bottom:12px"><div class="big" style="font-size:30px">' +
    won(e.mine) + '<span class="won">원</span></div>' +
    '<div class="sub"><span>전액 <b>' + won(e.amt) + "</b></span>" +
    "<span>" + e.n + "건</span><span>하루 <b>" + won(e.perDay) + "</b></span>" +
    (avg ? "<span>같은 갈래 평균 <b>" + wonS(avg) + "</b></span>" : "") + "</div></div>" +

    (avg ? '<div class="rhint"><b>견주면</b><span>' + esc(e.kind) + " 여행 평균보다 <b>" +
      (e.mine >= avg ? won(e.mine - avg) + "원 많습니다" : won(avg - e.mine) + "원 적습니다") +
      "</b> (" + others.length + "번과 견줌)</span></div>" : "") +

    '<div class="sec" style="margin:14px 0 6px"><h2 style="font-size:13px">무엇에</h2></div>' +
    rankList(subs.slice(0, 10), subs[0] && subs[0].mine, { color: it => colorOf(bigOf(it.key)) }) +

    '<div class="sec" style="margin:14px 0 6px"><h2 style="font-size:13px">날마다</h2></div>' +
    barsHTML(days.map(d => ({ key: d.key.slice(5).replace("-", "/"), mine: d.mine, color: "var(--gold)" })), { h: 120 }) +

    '<div style="display:flex;gap:8px;margin-top:14px">' +
    '<button class="btn ghost" id="evEditName">이름 고치기</button>' +
    '<button class="btn ghost" id="evClose" style="max-width:96px">닫기</button></div>'
  );
  $("#evClose").onclick = () => closeModal(true);
  $("#evEditName").onclick = () => openRenameEvent(name);
}

/** 건 이름을 고치거나 뗀다 */
function openRenameEvent(name) {
  const e = eventStat(name);
  swapModal(
    '<h2 style="font-size:16px;margin-bottom:2px">이름 고치기</h2>' +
    '<p style="font-size:11.5px;color:var(--ink3);margin:0 0 12px">' + esc(name) + " 로 묶인 " +
    e.n + "건의 이름을 한 번에 바꿉니다. 비워 두고 저장하면 묶음이 풀립니다.</p>" +
    '<div class="fl"><span>새 이름</span><input id="rn_name" value="' + esc(name) + '"></div>' +
    '<div style="display:flex;gap:8px;margin-top:14px">' +
    '<button class="btn" id="rn_go">바꾸기</button>' +
    '<button class="btn ghost" id="rn_no" style="max-width:96px">뒤로</button></div>'
  );
  $("#rn_no").onclick = () => openEventDetail(name);
  $("#rn_go").onclick = () => tagEvent(e.rows.map(r => r.no), $("#rn_name").value.trim());
}
