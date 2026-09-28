/* ===== js/charts.js ===== */
/* charts.js - 쌓은 막대, 갈라지는 막대, 산점도, 만기 타임라인. */
FILEV.charts = CONFIG.APP_VERSION;
/* ---------- 쌓은 막대 ----------
   달마다 대분류를 위로 쌓는다. keys 는 위에서부터의 순서다. */
function stackHTML(months, keys, getter, opt) {
  const o = opt || {};
  if (!months.length) return '<div class="empty">그릴 값이 없습니다.</div>';
  const data = months.map(m => {
    const vals = keys.map(k => getter(m, k) || 0);
    return { m, vals, tot: vals.reduce((a, b) => a + b, 0) };
  });
  /* 환불이 섞이면 조각이 음수가 된다. 음수 조각에 그대로 height 를 주면 SVG 가 그리지 못한다.
     그래서 위로 쌓는 더미와 아래로 쌓는 더미를 갈라 0 선 양쪽에 그린다 */
  const maxV = Math.max(1, ...data.map(d => d.vals.reduce((a, b) => a + Math.max(0, b), 0)));
  const minV = Math.min(0, ...data.map(d => d.vals.reduce((a, b) => a + Math.min(0, b), 0)));
  const span = maxV - minV;
  const W = 320, H = o.h || 170, pl = 4, pr = 4, pt = 10, pb = 18;
  const plot = H - pt - pb;
  const zero = pt + plot * (maxV / span);
  const iw = (W - pl - pr) / data.length;
  let s = '<svg class="spark tall" viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none" role="img">';
  [0, .5, 1].forEach(g => { const y = pt + plot * g; s += '<line class="grid" x1="0" y1="' + y + '" x2="' + W + '" y2="' + y + '"/>'; });
  if (minV < 0) s += '<line class="grid" x1="0" y1="' + zero.toFixed(1) + '" x2="' + W + '" y2="' + zero.toFixed(1) + '" stroke="var(--ink3)"/>';
  data.forEach((d, i) => {
    let up = 0, dn = 0;
    const x = pl + i * iw + iw * .16, w = iw * .68;
    d.vals.forEach((v, ki) => {
      if (!v) return;
      const h = plot * (Math.abs(v) / span);
      let y;
      if (v > 0) { up += h; y = zero - up; } else { y = zero + dn; dn += h; }
      s += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + w.toFixed(1) +
        '" height="' + h.toFixed(1) + '" fill="' + colorOf(keys[ki]) + '" opacity="' + (v > 0 ? ".92" : ".55") +
        '"><title>' + esc(d.m + " " + keys[ki] + " " + won(v) + (v < 0 ? " (돌려받음)" : "")) + "</title></rect>";
    });
  });
  const step = Math.max(1, Math.ceil(data.length / 8));
  data.forEach((d, i) => {
    if (i % step && i !== data.length - 1) return;
    s += '<text class="lab" x="' + (pl + i * iw + iw / 2).toFixed(1) + '" y="' + (H - 5) +
      '" text-anchor="middle">' + esc(d.m.slice(2).replace("-", ".")) + "</text>";
  });
  s += "</svg>";
  return s + '<div class="legend">' + keys.map(k =>
    '<span><i style="background:' + colorOf(k) + '"></i>' + esc(k) + "</span>").join("") + "</div>";
}

/* ---------- 좌우로 갈라지는 막대 (손익) ---------- */
function divergeBars(items, opt) {
  const o = opt || {};
  if (!items.length) return '<div class="empty">그릴 값이 없습니다.</div>';
  const mx = Math.max(1, ...items.map(i => Math.abs(i.v)));
  return '<div class="dvg">' + items.map(i => {
    const p = Math.abs(i.v) / mx * 50;
    const pos = i.v >= 0;
    return '<div class="dv"><div class="k">' + esc(i.key) + "</div>" +
      '<div class="track"><i style="' + (pos ? "left:50%" : "right:50%") + ";width:" + p.toFixed(1) + "%;background:" +
      (pos ? "var(--jade)" : "var(--coral)") + '"></i><b class="mid"></b></div>' +
      '<div class="v" style="color:' + (pos ? "var(--jade)" : "var(--coral)") + '">' +
      (pos ? "+" : "-") + won(Math.abs(i.v)) + (o.sub ? '<em>' + esc(o.sub(i)) + "</em>" : "") + "</div></div>";
  }).join("") + "</div>";
}

/* ---------- 흩뿌린 점 ---------- */
function scatterHTML(pts, opt) {
  const o = opt || {};
  if (!pts.length) return '<div class="empty">그릴 값이 없습니다.</div>';
  const W = 320, H = o.h || 170, pl = 26, pr = 6, pt = 10, pb = 20;
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const x0 = 0, x1 = Math.max(1, ...xs);
  const y0 = Math.min(0, ...ys), y1 = Math.max(0.01, ...ys);
  const X = v => pl + (W - pl - pr) * ((v - x0) / (x1 - x0 || 1));
  const Y = v => pt + (H - pt - pb) * (1 - (v - y0) / (y1 - y0 || 1));
  let s = '<svg class="spark tall" viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none" role="img">';
  [0, .5, 1].forEach(g => { const y = pt + (H - pt - pb) * g; s += '<line class="grid" x1="' + pl + '" y1="' + y + '" x2="' + W + '" y2="' + y + '"/>'; });
  if (y0 < 0 && y1 > 0) s += '<line x1="' + pl + '" y1="' + Y(0).toFixed(1) + '" x2="' + W + '" y2="' + Y(0).toFixed(1) + '" stroke="var(--ink3)" stroke-width="1" stroke-dasharray="3 3"/>';
  pts.forEach(p => {
    s += '<circle cx="' + X(p.x).toFixed(1) + '" cy="' + Y(p.y).toFixed(1) + '" r="' + (p.r || 3.4) +
      '" fill="' + (p.y >= 0 ? "var(--jade)" : "var(--coral)") + '" opacity=".8"><title>' + esc(p.t || "") + "</title></circle>";
  });
  s += '<text class="lab" x="' + pl + '" y="' + (H - 5) + '">' + esc(o.xmin || "0") + "</text>";
  s += '<text class="lab" x="' + (W - pr) + '" y="' + (H - 5) + '" text-anchor="end">' + esc(o.xmax || String(Math.round(x1))) + "</text>";
  s += '<text class="lab" x="0" y="' + (pt + 4) + '">' + Math.round(y1 * 100) + "%</text>";
  s += '<text class="lab" x="0" y="' + (H - pb) + '">' + Math.round(y0 * 100) + "%</text>";
  return s + "</svg>";
}

/* ---------- 만기 타임라인 ---------- */
function timelineHTML(items) {
  if (!items.length) return "";
  const mx = Math.max(1, ...items.map(i => i.days == null ? 0 : Math.max(0, i.days)));
  const amx = Math.max(1, ...items.map(i => i.amt || 0));
  return '<div class="tline">' + items.map(i => {
    const d = i.days == null ? null : Math.max(0, i.days);
    const left = d == null ? 0 : d / mx * 88;
    const w = 6 + (i.amt || 0) / amx * 10;
    const soon = d != null && d <= 45;
    return '<div class="tl"><div class="k">' + esc(i.name) + "</div>" +
      '<div class="track"><i style="left:' + left.toFixed(1) + "%;width:" + w.toFixed(1) + "%;background:" +
      (soon ? "var(--coral)" : "var(--gold)") + '"></i></div>' +
      '<div class="v">' + (d == null ? "-" : d + "일") + "</div></div>";
  }).join("") + '<div class="tlfoot"><span>오늘</span><span>' + mx + "일 뒤</span></div></div>";
}

/* ---------- 늘어난 글씨와 점 되돌리기 ----------
   그래프는 viewBox 가 320 폭으로 정해져 있고 preserveAspectRatio="none" 으로 칸에 맞춰 늘린다.
   막대와 선은 늘어나도 되지만, 안에 든 글씨와 점도 같이 늘어나 넓은 화면에서
   "25-10" 이 가로로 네 배 퍼져 보였다. 모양은 그대로 두고 글씨와 점만 늘어난 만큼 되돌린다.
   가로 배율 sx 와 세로 배율 sy 가 다르면, 글씨를 제 x 자리를 축으로 가로로 sy/sx 배 한다. */
function unstretch(svg) {
  const vb = svg.viewBox && svg.viewBox.baseVal;
  if (!vb || !vb.width || !vb.height) return;
  const w = svg.clientWidth, h = svg.clientHeight;
  if (!w || !h) return;                             /* 숨어 있는 판. 보일 때 다시 온다 */
  const k = (h / vb.height) / (w / vb.width);
  const tf = x => Math.abs(k - 1) < 0.01 ? "" :
    "translate(" + x + " 0) scale(" + k.toFixed(4) + " 1) translate(" + (-x) + " 0)";
  svg.querySelectorAll("text").forEach(t => {
    const v = tf(+t.getAttribute("x") || 0);
    if (v) t.setAttribute("transform", v); else t.removeAttribute("transform");
  });
  svg.querySelectorAll("circle").forEach(c => {
    const v = tf(+c.getAttribute("cx") || 0);
    if (v) c.setAttribute("transform", v); else c.removeAttribute("transform");
  });
}
const UNSTRETCH_RO = typeof ResizeObserver === "function"
  ? new ResizeObserver(es => es.forEach(e => unstretch(e.target))) : null;
/** 상자 안의 늘어나는 그래프를 전부 맞추고, 폭이 바뀔 때마다 다시 맞추게 걸어 둔다 */
function unstretchAll(box) {
  (box || document).querySelectorAll('svg[preserveAspectRatio="none"]').forEach(svg => {
    unstretch(svg);
    if (!svg.dataset.us) { svg.dataset.us = "1"; if (UNSTRETCH_RO) UNSTRETCH_RO.observe(svg); }
  });
}
