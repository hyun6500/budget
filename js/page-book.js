/* ===== js/page-book.js ===== */
/* page-book.js - 옛 월별 탭 그대로. 날짜는 그날 첫 줄에만, 오른쪽에 통계 블록. */
FILEV.book = CONFIG.APP_VERSION;

function renderBook() {
  const ym = S.ym, rs = monthRows(ym);
  const box = $("#spendBody");
  if (!rs.length) { box.innerHTML = '<div class="card"><div class="empty">' + ym + " 기록이 없습니다.<br>아래 더하기 버튼으로 첫 줄을 적어 보세요.</div></div>"; return; }

  let lastDate = "", html = "";
  rs.forEach(r => {
    const isNew = r.date !== lastDate;
    const cls = isRefund(r) ? "rf" : r.kind === "수입" ? "in" : r.kind === "이체" ? "mov" : "out";
    html +=
      "<tr" + (isNew ? ' class="newday"' : "") + ' data-no="' + r.no + '">' +
      '<td class="dt">' + (isNew ? r.date.slice(5).replace("-", "/") + " " + wdOf(r.date) : "") + "</td>" +
      '<td class="money ' + (r.kind === "수입" ? "in" : "") + '">' + (r.kind === "수입" ? won(r.amt) : "") + "</td>" +
      '<td class="money ' + cls + '">' + (r.kind === "수입" ? "" : won(r.amt)) + "</td>" +
      '<td class="pl">' + (isRefund(r) ? '<span class="rfchip">환불</span>' : "") + esc(r.place) + (r.rate < 1 ? ' <span style="color:var(--ink3);font-size:10px">' + Math.round(r.rate * 100) + "%</span>" : "") + "</td>" +
      '<td class="de">' + esc(r.detail) + "</td>" +
      "<td>" + esc(r.sub) + "</td>" +
      '<td class="de">' + [r.situ, r.treat,
        r.theme ? r.theme + (r.with ? " " + r.with : "") : (r.with || ""),
        r.event, r.once === "Y" ? "일시성" : "", r.pay].filter(Boolean).map(esc).join(" ") + "</td>" +
      "</tr>";
    lastDate = r.date;
  });

  const st = monthStat(ym);
  const bigs = byKey(rs.filter(isOut), r => r.big || "기타");

  box.innerHTML =
    '<div class="card tight"><div class="sec"><h2>' + ym.slice(0, 4) + "년 " + (+ym.slice(5, 7)) + "월 원장</h2>" +
    '<span class="hint">' + rs.length + "줄</span></div>" +
    '<div class="scrollx"><table class="book"><thead><tr>' +
    "<th>날짜</th><th>수입</th><th>지출</th><th>장소</th><th>세부내역</th><th>소분류</th><th>표시</th>" +
    "</tr></thead><tbody>" + html + "</tbody></table></div>" +
    '<p style="font-size:11px;color:var(--ink3);margin:10px 0 0">금액은 전액입니다. 장소 옆의 퍼센트는 내가 부담한 몫입니다. 줄을 누르면 고칠 수 있습니다.</p></div>' +

    '<div class="card"><div class="sec"><h2>이 달 통계</h2><span class="hint">내 몫 기준</span></div>' +
    '<div class="rows">' +
    ['수입|' + st.inc, '지출|' + st.out].concat(st.refund > 0 ? ['돌려받음|' + st.refund] : [])
      .concat(['이체 저축|' + st.mov, '남은 돈|' + st.left]).map(t => {
      const [k, v] = t.split("|");
      return '<div class="row"><div class="nm">' + k + '</div><div class="amt">' + won(+v) + "</div></div>";
    }).join("") + "</div>" +
    '<div style="height:10px"></div>' +
    rankList(bigs, bigs[0] && bigs[0].mine, { color: it => colorOf(it.key) }) + "</div>";

  decorate(box);
  $$("tbody tr", box).forEach(tr => tr.onclick = () => {
    const r = S.rows.find(x => x.no === +tr.dataset.no);
    if (r) openEdit(r);
  });
}
