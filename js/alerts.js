/* ===== js/alerts.js ===== */
/* alerts.js - 이번 달 화면 맨 위에 뜨는 알림.
   규칙마다 하나씩 만들고, 넘긴 것은 기억해 다시 띄우지 않는다.
   알림이 늘어날수록 화면을 먹으므로 두 개만 펴 두고 나머지는 접는다. */
FILEV.alerts = CONFIG.APP_VERSION;

/* 숨긴 알림.
   영영 지우는 길은 두지 않는다. 지금은 필요 없어도 나중에 다시 볼 일이 생기고,
   그때 되살릴 방법이 없으면 아쉬워진다. 그래서 둘 다 되돌릴 수 있게 했다.
     넘기기 - 이 달 동안만 숨긴다. 다음 달이면 저절로 돌아온다
     끄기   - 그 갈래를 계속 숨긴다. [숨긴 알림 되살리기] 로 언제든 되돌린다 */
const DISMISS = (() => {
  let m = {};
  try { m = JSON.parse(localStorage.getItem("jh_dismiss") || "{}"); } catch (e) { m = {}; }
  const save = () => { try { localStorage.setItem("jh_dismiss", JSON.stringify(m)); } catch (e) { } };
  return {
    skip: (k, ym) => { m["m:" + k + "@" + ym] = 1; save(); },
    mute: kind => { m["k:" + kind] = 1; save(); },
    off: (k, kind, ym) => !!(m["k:" + kind] || m["m:" + k + "@" + ym]),
    count: () => Object.keys(m).length,
    muted: () => Object.keys(m).filter(x => x.indexOf("k:") === 0).map(x => x.slice(2)),
    reset: () => { m = {}; save(); },
  };
})();

function buildAlerts(ym) {
  const out = [];
  const rs = monthRows(ym);
  const now = monthStat(ym);
  const isCur = ym === ymOf(todayISO());

  /* 1. 늘 나가던 것이 아직 안 보인다 */
  for (const r of recurring(ym).slice(0, 4)) {
    out.push({
      key: "rec:" + r.sub + ":" + r.place, tag: "빠진 듯",
      html: "<b>" + esc(r.place || r.sub) + "</b> 기록이 이 달에 아직 없습니다. 지난 석 달은 매달 " +
        r.day + "일 무렵 평균 " + won(r.avg) + "원이었습니다.",
      act: { label: "이 내용으로 적기", go: () => { goTab("add"); setTimeout(() => prefillAdd({ date: ym + "-" + pad2(Math.min(28, +r.day)), sub: r.sub, place: r.place, amt: r.avg }), 60); } },
    });
  }

  /* 2. 손볼 줄 */
  const need = rs.filter(r => r.검수);
  if (need.length) out.push({
    key: "check:" + ym, tag: "검수",
    html: "이 달에 손볼 줄이 <b>" + need.length + "건</b> 있습니다.",
    act: { label: "원장에서 보기", go: () => goTab("ledger") },
  });

  /* 3. 필수 값이 빈 줄. 이게 가장 급하다 */
  const holes = S.rows.filter(r => !r.sub || !r.place || !r.amt);
  if (holes.length) {
    const last = holes[holes.length - 1];
    out.unshift({
      key: "holes:" + holes.length, kind: "holes", tag: "채워야 함",
      html: "꼭 있어야 할 칸이 빈 줄이 <b>" + holes.length + "건</b> 있습니다. " +
        "(가장 마지막 " + esc(last.date) + " " + esc(last.place || last.sub || "이름 없음") + ") 그만큼 통계에서 빠집니다.",
      act: { label: "가장 마지막 것 고치기", go: () => { S.ym = last.ym; paintTabs(); openEdit(last); } },
    });
  }

  /* 4. 앞당겨 적어 둔 것 */
  if (S.future && S.future.length) {
    const f = S.future.slice().sort((a, b) => a.date < b.date ? -1 : 1);
    out.push({
      key: "future:" + f.length, tag: "앞당겨 적음",
      html: "아직 오지 않은 달에 적어 둔 기록이 <b>" + S.future.length + "건</b> 있습니다. 그 달이 되면 저절로 나타납니다. (가장 이른 것 " +
        esc(f[0].date) + " " + esc(f[0].place || f[0].sub) + ")",
    });
  }

  /* 5. 이 달의 씀씀이가 앞서간다 */
  if (isCur) {
    const d = new Date(), last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const frac = d.getDate() / last;
    const avg = avgOutOfYear(yOf(ym + "-01"));
    if (frac > 0.25 && avg > 0) {
      const pace = now.out / frac;
      if (pace > avg * 1.25) out.push({
        key: "pace:" + ym, tag: "빠릅니다",
        html: "이 속도면 이 달은 <b>" + won(Math.round(pace)) + "원</b>쯤 됩니다. 올해 월평균 " + won(avg) + "원보다 " +
          Math.round((pace / avg - 1) * 100) + "% 많습니다.",
        act: { label: "어디서 늘었나", go: () => { SP.seg = "trend"; goTab("spend"); } },
      });
    }
  }

  /* 6. 며칠째 안 적었다 */
  if (isCur) {
    const last = S.rows.length ? S.rows[S.rows.length - 1].date : "";
    if (last) {
      const gap = Math.round((new Date(todayISO()) - new Date(last)) / 86400000);
      if (gap >= 4) out.push({
        key: "gap:" + last, tag: "비었음",
        html: "마지막 기록이 <b>" + esc(last) + "</b>입니다. " + gap + "일째 비어 있습니다.",
        act: { label: "지금 적기", go: () => goTab("add") },
      });
    }
  }

  /* 7. 소개팅과 데이트인데 이력에 없는 이름 */
  const P = S.people || { intro: [], love: [] };
  if ((P.intro || []).length) {
    const known = new Set([].concat(P.intro, P.love).map(x => x.with || x.name).filter(Boolean));
    const miss = new Set();
    S.rows.forEach(r => {
      if (r.theme !== "소개팅" && r.theme !== "데이트") return;
      (r.with || "").split(/[,;\/]/).forEach(n => { const t = n.trim(); if (t && !known.has(t)) miss.add(t); });
    });
    if (miss.size) out.push({
      key: "noperson:" + Array.from(miss).sort().join(","), tag: "이력 없음",
      html: "이력 시트에 없는 이름이 <b>" + miss.size + "명</b> 있습니다. (" +
        esc(Array.from(miss).slice(0, 4).join(", ")) + (miss.size > 4 ? " 외" : "") +
        ") 그 사람 지출이 이력 시트에서 집계되지 않습니다.",
      act: { label: "기록실에서 보기", go: () => { HL.seg = "theme"; TH.mode = "소개팅"; goTab("hall"); } },
    });
  }

  /* 8. 자산 스냅샷이 오래됐다 */
  if (A.data && A.data.asOf) {
    const gap = Math.round((new Date(todayISO()) - new Date(A.data.asOf)) / 86400000);
    if (gap >= 45) out.push({
      key: "asset:" + A.data.asOf, tag: "자산 갱신",
      html: "자산 시트의 마지막 기록이 <b>" + esc(A.data.asOf) + "</b>입니다. " + gap +
        "일 지났습니다. 로그에 한 줄 더하면 순자산 곡선이 이어집니다.",
      act: { label: "자산 보기", go: () => { AS.seg = "now"; goTab("asset"); } },
    });
  }

  /* 9. 예적금 만기 */
  for (const m of maturities()) {
    if (m.days == null || m.days > 45 || m.days < -120) continue;
    out.push({
      key: "mat:" + m.name + ":" + m.due, tag: "만기",
      html: "<b>" + esc(m.name) + " " + wonS(m.amt) + "</b>이 " + esc(m.due) +
        (m.days >= 0 ? " 만기입니다. " + m.days + "일 남았습니다." : " 만기였습니다. " + (-m.days) + "일 지났습니다."),
      act: { label: "자산 보기", go: () => { AS.seg = "now"; goTab("asset"); } },
    });
  }

  /* 10. 규칙에 어긋난 줄 */
  const broke = S.rows.filter(r => {
    if (r.situ === "여행 중" && r.big && r.big !== "여행") return true;
    if ((r.sub === "용돈" || r.sub === "선물") && !r.treat) return true;
    if (r.theme === "데이트" && r.treat !== "연인") return true;
    return false;
  });
  if (broke.length) out.push({
    key: "broke:" + broke.length, tag: "규칙",
    html: "예외 규칙과 어긋난 줄이 <b>" + broke.length + "건</b> 있습니다. (여행 중인데 여행 분류가 아니거나, 용돈과 선물에 대접이 비었거나)",
  });

  out.forEach(a => { if (!a.kind) a.kind = a.key.split(":")[0]; });
  return out.filter(a => !DISMISS.off(a.key, a.kind, ym));
}

/** 알림 묶음을 그린다. 둘만 펴고 나머지는 접는다. */
function alertsHTML(list, open) {
  if (!list.length) return "";
  const show = open ? list : list.slice(0, 2);
  return '<div id="alertBox">' + show.map((a, i) =>
    '<div class="alert" data-ak="' + esc(a.key) + '"><div class="k">' + esc(a.tag) + "</div>" +
    '<div class="b">' + a.html +
    '<div class="aact">' +
    (a.act ? '<button class="go" data-ago="' + i + '">' + esc(a.act.label) + "</button>" : "") +
    '<button class="sk" data-askip="' + esc(a.key) + '">이 달은 넘기기</button>' +
    '<button class="cl" data-amute="' + esc(a.kind) + '">이 갈래 끄기</button>' +
    "</div></div></div>").join("") +
    (list.length > 2
      ? '<button class="btn ghost sm" id="alertMore" style="width:100%;margin-bottom:8px">' +
        (open ? "접기" : "알림 " + list.length + "건 모두 보기") + "</button>"
      : "") +
    (DISMISS.count()
      ? '<button class="btn ghost sm" id="alertBack" style="width:100%;margin-bottom:8px">' +
        "숨긴 알림 " + DISMISS.count() + "건 되살리기</button>"
      : "") + "</div>";
}
