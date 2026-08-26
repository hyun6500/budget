/* ===== js/page-refund.js ===== */
/* page-refund.js - 환불과 지우기.
   환불은 원래 줄을 고치지 않는다. 돈이 돌아온 날에 음수 지출 줄을 새로 적는다.
   그래야 원본이 남고, 카드 명세서의 취소 전표와 한 장씩 짝이 맞는다. */
FILEV.refund = CONFIG.APP_VERSION;

/* 창이 이미 열려 있으면 속만 갈아 끼운다.
   openModal 을 겹쳐 부르면 뒤로가기 걸음이 두 번 쌓여 한 번 눌러서는 안 닫힌다. */
function swapModal(html, onClose) {
  const md = $("#modal");
  if (md && !md.hidden) { $("#modalBody").innerHTML = html; return; }
  openModal(html, onClose);
}

/** 앱이 들고 있는 줄을 서버가 받는 모양으로 바꾼다.
    시각, 할인, 할인수단까지 다 실어야 고칠 때 그 칸들이 날아가지 않는다. */
function rowPayload(r) {
  return {
    date: r.date, amt: r.amt, sub: r.sub, place: r.place, detail: r.detail,
    share: r.share, pay: r.pay, situ: r.situ, treat: r.treat, theme: r.theme,
    once: r.once, with: r.with, memo: r.memo, event: r.event || "",
    time: r.time || "", disc: r.disc || 0, discBy: r.discBy || "",
  };
}

const RF = { mode: "part", markSrc: true };

/* ---------- 환불 창 ---------- */
function openRefund(r) {
  RF.mode = "part";
  RF.markSrc = true;

  const paint = () => {
    const full = Math.abs(r.amt || 0);
    const back = RF.mode === "part" ? "" : full;      /* 전액환불과 취소 후 재결제는 전액이 돌아온다 */
    const lock = RF.mode !== "part";

    const head =
      '<h2 style="font-size:16px;margin-bottom:2px">환불 적기</h2>' +
      '<p style="font-size:11.5px;color:var(--ink3);margin:0 0 12px">' +
      "no " + r.no + " / " + esc(r.date) + " / " + esc(r.place || r.sub) + " / " + won(r.amt) + "원" +
      "<br>원래 줄의 금액은 고치지 않습니다. 돌려받은 날에 음수 줄을 새로 적습니다.</p>";

    const seg = segHTML([
      ["part", "부분환불"], ["all", "전액환불"], ["redo", "취소 후 재결제"],
    ], RF.mode, "rf");

    const why =
      '<p class="foot" style="margin:10px 0 0">' +
      (RF.mode === "part"
        ? "원래 결제는 살아 있고 일부만 돌려받은 경우입니다. 돌려받은 만큼 음수 줄 <b>한 개</b>가 생깁니다."
        : RF.mode === "all"
          ? "전액을 돌려받고 끝난 경우입니다. 원래 금액만큼 음수 줄 <b>한 개</b>가 생깁니다."
          : "전액을 취소하고 그 자리에서 다시 결제한 경우입니다. 취소 줄과 새 결제 줄 <b>두 개</b>가 생깁니다. " +
            "차액 한 줄로 줄이지 않는 까닭은 카드 명세서에 취소 전표와 새 승인 전표가 따로 찍히기 때문입니다.") +
      "</p>";

    const form =
      '<div class="form" style="margin-top:14px">' +
      '<div class="grid2">' +
      '<div class="fl"><span>돌려받은 날<em>*</em></span><input type="date" id="rf_date" value="' + todayISO() + '"></div>' +
      '<div class="fl" id="rfl_back"><span>돌려받은 금액<em>*</em></span>' +
      '<input class="money" id="rf_back" inputmode="numeric" placeholder="0" value="' + back + '"' +
      (lock ? " readonly" : "") + "></div>" +
      "</div>" +
      '<div class="fl"><span>어디로 돌려받았나</span><select id="rf_pay">' +
      optList((S.meta && S.meta.pays) || [], r.pay || "") + "</select>" +
      '<span style="font-size:11px;color:var(--ink3)">보통 결제한 수단으로 돌아옵니다. 원래 줄은 ' +
      (r.pay ? esc(r.pay) : "비어 있습니다") + "</span></div>" +

      (RF.mode === "redo"
        ? '<div style="border-top:1px solid var(--line2);margin:4px 0 2px"></div>' +
          '<div class="grid2">' +
          '<div class="fl"><span>다시 결제한 날<em>*</em></span><input type="date" id="rf_ndate" value="' + todayISO() + '"></div>' +
          '<div class="fl" id="rfl_new"><span>다시 결제한 금액<em>*</em></span>' +
          '<input class="money" id="rf_new" inputmode="numeric" placeholder="0"></div>' +
          "</div>" +
          '<div class="fl"><span>새 결제의 세부내역</span><input id="rf_ndetail" value="' + esc(r.detail || "") + '"></div>'
        : "") +

      '<label class="rfcheck"><input type="checkbox" id="rf_mark"' + (RF.markSrc ? " checked" : "") + ">" +
      "<span>원래 줄 메모에 흔적 남기기<b>" +
      "나중에 " + esc(r.date.slice(0, 7)) + " 을 다시 볼 때 왜 이 금액인지 알 수 있습니다. 금액은 건드리지 않습니다</b></span></label>" +
      '<div id="rf_prev"></div>' +
      "</div>" +

      '<div style="display:flex;gap:8px;margin-top:16px">' +
      '<button class="btn" id="rf_go">이대로 적기</button>' +
      '<button class="btn ghost" id="rf_no" style="max-width:96px">뒤로</button></div>';

    return '<div class="card" style="background:none;border:0;padding:0;box-shadow:none;animation:none">' +
      head + seg + why + form + "</div>";
  };

  /* 무엇이 어떻게 바뀌는지 미리 보여 준다. 숫자를 눈으로 본 뒤에 누르게 한다 */
  const preview = () => {
    const box = $("#rf_prev");
    if (!box) return;
    const back = Math.abs(numOf($("#rf_back") ? $("#rf_back").value : 0));
    const nw = RF.mode === "redo" ? Math.abs(numOf($("#rf_new") ? $("#rf_new").value : 0)) : 0;
    const rdate = $("#rf_date") ? $("#rf_date").value : todayISO();
    const ndate = $("#rf_ndate") ? $("#rf_ndate").value : rdate;
    if (!back) { box.innerHTML = ""; return; }

    const srcYM = ymOf(r.date), rYM = ymOf(rdate), nYM = ymOf(ndate);
    const rate = r.rate || 1;
    const net = Math.round((Math.abs(r.amt) - back + nw) * rate);

    const lines = [
      ["원래 줄 (그대로 둠)", r.date, won(r.amt), ""],
      [RF.mode === "redo" ? "취소 줄 (새로 적음)" : "환불 줄 (새로 적음)", rdate, won(-back), "neg"],
    ];
    if (RF.mode === "redo" && nw) lines.push(["새 결제 줄 (새로 적음)", ndate, won(nw), ""]);

    const months = {};
    months[srcYM] = (months[srcYM] || 0) + Math.round(r.mine);
    months[rYM] = (months[rYM] || 0) - Math.round(back * rate);
    if (nw) months[nYM] = (months[nYM] || 0) + Math.round(nw * rate);

    box.innerHTML =
      '<div class="rfprev"><div class="t">이렇게 됩니다</div>' +
      '<div class="rows">' + lines.map(([k, d, v, c]) =>
        '<div class="row"><div class="nm">' + esc(k) + "</div>" +
        '<div class="amt"' + (c === "neg" ? ' style="color:var(--in)"' : "") + ">" + v + "</div>" +
        '<div class="meta"><span>' + esc(d) + "</span></div></div>").join("") + "</div>" +
      '<div class="t" style="margin-top:12px">달마다 내 몫이 이만큼 움직입니다</div>' +
      '<div class="rows">' + Object.keys(months).sort().map(m =>
        '<div class="row"><div class="nm">' + esc(m) + "</div>" +
        '<div class="amt"' + (months[m] < 0 ? ' style="color:var(--in)"' : "") + ">" +
        (months[m] > 0 ? "+" : "") + won(months[m]) + "</div></div>").join("") + "</div>" +
      '<p class="foot" style="margin:10px 0 0">이 결제로 실제로 부담한 돈은 <b class="num">' + won(net) +
      "</b>원이 됩니다." +
      (back > Math.abs(r.amt) ? ' <b style="color:var(--coral)">돌려받은 금액이 원래 금액보다 큽니다. 맞는지 보세요.</b>' : "") +
      "</p></div>";
  };

  const bind = () => {
    $$("[data-rf]", $("#modalBody")).forEach(b => b.onclick = () => { RF.mode = b.dataset.rf; redraw(); });
    ["#rf_back", "#rf_new"].forEach(id => { const n = $(id); if (n) n.oninput = preview; });
    ["#rf_date", "#rf_ndate"].forEach(id => { const n = $(id); if (n) n.onchange = preview; });
    const mk = $("#rf_mark"); if (mk) mk.onchange = () => { RF.markSrc = mk.checked; };
    $("#rf_no").onclick = () => openEdit(r);
    $("#rf_go").onclick = () => submitRefund(r);
    preview();
  };
  const redraw = () => { $("#modalBody").innerHTML = paint(); bind(); };

  swapModal(paint());
  bind();
}

async function submitRefund(r) {
  const back = Math.abs(numOf($("#rf_back").value));
  const rdate = $("#rf_date").value;
  const pay = $("#rf_pay") ? $("#rf_pay").value : "";
  const redo = RF.mode === "redo";
  const nw = redo ? Math.abs(numOf($("#rf_new").value)) : 0;
  const ndate = redo ? $("#rf_ndate").value : "";
  const ndetail = redo ? $("#rf_ndetail").value.trim() : "";

  if (!rdate) return toast("돌려받은 날을 골라 주세요");
  if (!back) return toast("돌려받은 금액을 넣어 주세요");
  if (redo && !nw) return toast("다시 결제한 금액을 넣어 주세요");
  if (redo && !ndate) return toast("다시 결제한 날을 골라 주세요");
  if (!await ensureAuth()) return;

  const b = $("#rf_go");
  if (b) { b.disabled = true; b.textContent = "적는 중"; }

  /* 음수 줄. 갈래를 정하는 칸은 원래 줄에서 그대로 베낀다 */
  const neg = refundRowFrom(r, {
    date: rdate, amt: back, pay: pay,
    label: redo ? "전액 취소" : (back >= Math.abs(r.amt) ? "전액 환불" : "부분 환불"),
    detail: (redo ? "전액 취소 no." : "환불 no.") + r.no + " " + (r.detail || ""),
    memo: r.date + " no." + r.no + " 결제분 " + (redo ? "전액 취소" : back >= Math.abs(r.amt) ? "전액 환불" : "부분 환불"),
  });

  try {
    const j1 = await post("add", { token: AUTH.token, row: neg });
    if (j1.head && j1.values) patchAdd(j1.head, j1.values);
    let newNo = null;

    if (redo) {
      const fresh = Object.assign(rowPayload(r), {
        date: ndate, amt: nw, pay: pay || r.pay || "",
        detail: ndetail || r.detail || "",
        memo: "no." + r.no + " 취소 후 재결제",
        time: "", disc: 0, discBy: "",
      });
      const j2 = await post("add", { token: AUTH.token, row: fresh });
      if (j2.head && j2.values) patchAdd(j2.head, j2.values);
      newNo = j2.no;
    }

    if (RF.markSrc) {
      const tail = rdate + " " + (redo ? "전액 취소 후 재결제" : back >= Math.abs(r.amt) ? "전액 환불" : "부분 환불 " + won(back)) +
        " (no." + j1.no + (newNo ? ", no." + newNo : "") + ")";
      const src = Object.assign(rowPayload(r), {
        memo: (r.memo ? r.memo + " / " : "") + tail,
      });
      const j3 = await post("update", { token: AUTH.token, no: r.no, row: src });
      if (j3.head && j3.values) patchUpdate(j3.head, j3.values, r.no);
    }

    closeModal(true);
    S.ym = ymOf(rdate);
    paintTabs(); renderAll(); goTab("ledger");
    toast(redo ? "취소와 재결제 두 줄을 적었습니다" : "환불 줄을 적었습니다");
  } catch (e) {
    if (b) { b.disabled = false; b.textContent = "이대로 적기"; }
    toast("실패: " + e.message);
  }
}

/* ---------- 지우기 ----------
   confirm 창은 무엇을 지우는지 보여 주지 못한다. 지우기 전에 그 줄을 한 번 더 보여 준다.
   그리고 환불로 적어야 할 것을 지워 없애지 않게 갈림길을 먼저 알려 준다. */
function openDelete(r) {
  const html =
    '<h2 style="font-size:16px;margin-bottom:2px">이 줄을 지웁니다</h2>' +
    '<p style="font-size:11.5px;color:var(--ink3);margin:0 0 12px">되돌릴 수 없습니다. ' +
    "지운 no 는 다시 쓰이지 않으므로 원본보관 시트와의 짝은 그대로 유지됩니다.</p>" +
    '<div class="rfprev"><div class="t">지울 줄</div><div class="rows">' +
    '<div class="row"><div class="nm">' + esc(r.place || r.sub || "이름 없음") + "</div>" +
    '<div class="amt">' + won(r.amt) + "</div>" +
    '<div class="meta"><span>no ' + r.no + "</span><span>" + esc(r.date) + "</span>" +
    "<span>" + esc(r.sub || "") + "</span>" +
    (r.detail ? "<span>" + esc(r.detail) + "</span>" : "") +
    (r.rate < 1 ? "<span>내 몫 " + won(r.mine) + "</span>" : "") + "</div></div>" +
    "</div></div>" +
    (r.amt > 0
      ? '<div class="rhint bad" style="margin-top:12px"><b>먼저 갈라 보세요</b><span>' +
        "<b>잘못 적은 줄</b>이면 지우는 것이 맞습니다. " +
        "<b>실제로 돈이 오갔는데 나중에 돌려받은 것</b>이라면 지우지 말고 [환불 적기] 를 쓰세요. " +
        "지워 버리면 그 달에 실제로 나갔던 돈의 자취가 사라져 카드 명세서와 어긋납니다.</span></div>" +
        '<button class="btn ghost sm" id="dlToRefund" style="width:100%;margin-top:8px">환불 적기로 가기</button>'
      : "") +
    '<div style="display:flex;gap:8px;margin-top:16px">' +
    '<button class="btn" id="dlGo" style="background:var(--coral)">지웁니다</button>' +
    '<button class="btn ghost" id="dlNo" style="max-width:96px">뒤로</button></div>';

  swapModal(html);
  const back = $("#dlToRefund");
  if (back) back.onclick = () => openRefund(r);
  $("#dlNo").onclick = () => openEdit(r);
  $("#dlGo").onclick = async () => {
    if (!await ensureAuth()) return;
    const b = $("#dlGo");
    if (b) { b.disabled = true; b.textContent = "지우는 중"; }
    try {
      await post("del", { token: AUTH.token, no: r.no });
      closeModal(true);
      patchDel(r.no); paintTabs(); renderAll();
      toast("지웠습니다");
    } catch (e) {
      if (b) { b.disabled = false; b.textContent = "지웁니다"; }
      toast("실패: " + e.message);
    }
  };
}
