/* ===== js/story.js ===== */
/* story.js - 월말 결산 카드. 외부 라이브러리 없이 canvas 에 직접 그려 png 로 내려받는다. */
FILEV.story = CONFIG.APP_VERSION;

function storyLines(ym) {
  const st = monthStat(ym), prev = monthStat(shiftYM(ym, -1));
  const rs = monthRows(ym), outs = rs.filter(isOut);
  const bigs = byKey(outs, r => r.big || "기타");
  const top = outs.slice().sort((a, b) => b.mine - a.mine)[0];
  const d = prev.out ? (st.out - prev.out) / prev.out : null;
  return {
    title: ym.slice(0, 4) + "년 " + (+ym.slice(5, 7)) + "월",
    out: st.out, inc: st.inc, left: st.left,
    rate: st.inc ? Math.round(st.left / st.inc * 100) : null,
    n: rs.length,
    delta: d == null ? "" : (d > 0 ? "지난달보다 " + Math.round(d * 100) + "% 더 썼습니다" : "지난달보다 " + Math.round(-d * 100) + "% 아꼈습니다"),
    refund: st.refund > 0 ? "돌려받은 돈 " + won(st.refund) + "원이 이미 빠져 있습니다" : "",
    bigs: bigs.slice(0, 4),
    top: top ? (top.place || top.sub) + " " + won(top.mine) + "원" : "",
  };
}

function openStory(ym) {
  const s = storyLines(ym);
  openModal(
    '<h2 style="font-size:16px;margin-bottom:2px">' + esc(s.title) + " 결산 카드</h2>" +
    '<p style="font-size:11.5px;color:var(--ink3);margin:0 0 14px">그림으로 내려받아 남겨 둘 수 있습니다.</p>' +
    '<canvas id="stCv" width="540" height="960" style="width:100%;border-radius:12px;border:1px solid var(--line)"></canvas>' +
    '<div style="display:flex;gap:8px;margin-top:14px">' +
    '<button class="btn" id="stDl">그림으로 받기</button>' +
    '<button class="btn ghost" id="stNo" style="max-width:96px">닫기</button></div>'
  );
  drawStory($("#stCv"), s);
  $("#stNo").onclick = () => closeModal(true);
  $("#stDl").onclick = () => {
    try {
      const a = document.createElement("a");
      a.download = "결산_" + ym + ".png";
      a.href = $("#stCv").toDataURL("image/png");
      a.click();
    } catch (e) { toast("이 브라우저에서는 저장이 막혀 있습니다"); }
  };
}

function drawStory(cv, s) {
  const g = cv.getContext("2d");
  if (!g) return;
  const W = cv.width, H = cv.height;
  const night = document.body.classList.contains("night");
  const bg = night ? "#0E1219" : "#1F3864", ink = "#FFFFFF", mut = night ? "#8B94A3" : "#B9C6DE";
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.fillStyle = "rgba(255,255,255,.05)"; g.fillRect(0, 0, W, 300);

  const F = (sz, w) => (w || 400) + " " + sz + 'px Pretendard, "Apple SD Gothic Neo", sans-serif';
  const M = (sz, w) => (w || 600) + " " + sz + 'px "IBM Plex Mono", monospace';

  g.fillStyle = mut; g.font = F(20, 500); g.fillText("주현 장부", 44, 80);
  g.fillStyle = ink; g.font = F(46, 700); g.fillText(s.title, 44, 140);
  g.fillStyle = mut; g.font = F(19, 400); g.fillText("한 달 결산", 44, 176);

  g.fillStyle = mut; g.font = F(18, 500); g.fillText("쓴 돈", 44, 250);
  g.fillStyle = ink; g.font = M(62, 700); g.fillText(won(s.out), 44, 316);
  g.font = F(20, 400); g.fillStyle = mut; g.fillText("원", 46 + g.measureText("").width + 0, 316);

  g.fillStyle = mut; g.font = F(18, 400);
  g.fillText(s.delta || "", 44, 360);
  if (s.refund) { g.font = F(16, 400); g.fillText(s.refund, 44, 388); }

  let y = 430;
  const line = (k, v) => {
    g.fillStyle = mut; g.font = F(19, 400); g.fillText(k, 44, y);
    g.fillStyle = ink; g.font = M(24, 600);
    const t = v; g.fillText(t, W - 44 - g.measureText(t).width, y);
    g.strokeStyle = "rgba(255,255,255,.12)"; g.beginPath(); g.moveTo(44, y + 16); g.lineTo(W - 44, y + 16); g.stroke();
    y += 56;
  };
  line("번 돈", won(s.inc));
  line("남은 돈", won(s.left));
  if (s.rate != null) line("저축률", s.rate + "%");
  line("기록", s.n + "건");

  y += 24;
  g.fillStyle = mut; g.font = F(18, 500); g.fillText("어디에 썼나", 44, y); y += 34;
  /* 음수 폭을 그대로 fillRect 에 주면 막대가 왼쪽으로 뒤집혀 그려진다. 절댓값에 색만 갈라 준다 */
  const mx = Math.max(1, ...s.bigs.map(b => Math.abs(b.mine)));
  for (const b of s.bigs) {
    const neg = b.mine < 0;
    g.fillStyle = ink; g.font = F(20, 600); g.fillText(b.key + (neg ? " (환불)" : ""), 44, y);
    g.font = M(19, 500); const t = won(b.mine);
    g.fillText(t, W - 44 - g.measureText(t).width, y);
    y += 14;
    g.fillStyle = "rgba(255,255,255,.14)"; g.fillRect(44, y, W - 88, 8);
    g.fillStyle = neg ? "#57D6A9" : "#E4788C";
    g.fillRect(44, y, (W - 88) * (Math.abs(b.mine) / mx), 8);
    y += 40;
  }

  if (s.top) {
    y += 12;
    g.fillStyle = mut; g.font = F(18, 500); g.fillText("가장 큰 한 건", 44, y); y += 34;
    g.fillStyle = ink; g.font = F(23, 600); g.fillText(s.top, 44, y);
  }

  g.fillStyle = mut; g.font = F(15, 400);
  g.fillText("금액은 모두 내 몫 기준입니다", 44, H - 52);
}
