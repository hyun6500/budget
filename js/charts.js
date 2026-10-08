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
    const cx = X(p.x).toFixed(1), cy = Y(p.y).toFixed(1);
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (p.r || 3.4) +
      '" fill="' + (p.y >= 0 ? "var(--jade)" : "var(--coral)") + '" opacity=".8" stroke="var(--solid)" stroke-width="1" pointer-events="none"/>';
    /* 손가락으로도 맞게 보이지 않는 큰 원을 겹친다. 누르면 값이 뜬다 */
    s += '<circle class="hitc" cx="' + cx + '" cy="' + cy + '" r="' + Math.max(9, (p.r || 3.4) + 4).toFixed(1) + '" data-tip="' + esc(p.t || "") + '"/>';
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

/* ---------- 날짜 축 꺾은선 ----------
   lineChart 는 점을 같은 간격으로 놓는다. 자산 기록은 수기로 옮긴 9줄이 띄엄띄엄 있다가
   이제 평일마다 쌓이므로, 날짜 간격대로 놓아야 그림의 기울기가 맞다.
   series = [{ color, w, dash, dot, pts: [{ t: "yyyy-mm-dd", y }] }] */
function timeChart(series, opt) {
  const o = opt || {};
  const ok = p => p && /^\d{4}-\d{2}-\d{2}/.test(p.t || "") && typeof p.y === "number" && isFinite(p.y);
  const all = series.reduce((a, s) => a.concat(s.pts.filter(ok)), []);
  if (!all.length) return '<div class="empty">그릴 값이 없습니다.</div>';
  const W = 320, H = o.h || 170, pl = 34, pr = 6, pt = 10, pb = 18;
  const day = t => Date.UTC(+t.slice(0, 4), +t.slice(5, 7) - 1, +t.slice(8, 10)) / 86400000;
  const t0 = Math.min(...all.map(p => day(p.t))), t1 = Math.max(...all.map(p => day(p.t)));
  let y0 = Math.min(...all.map(p => p.y)), y1 = Math.max(...all.map(p => p.y));
  const pad = (y1 - y0) * 0.08 || Math.abs(y1) * 0.05 || 1;
  y0 -= pad; y1 += pad;
  const X = t => pl + (W - pl - pr) * (t1 > t0 ? (day(t) - t0) / (t1 - t0) : 0.5);
  const Y = v => pt + (H - pt - pb) * (1 - (v - y0) / (y1 - y0));
  let s = '<svg class="spark tall" viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none" role="img"' +
    (o.label ? ' aria-label="' + esc(o.label) + '"' : "") + ">";
  [0, 0.5, 1].forEach(g => {
    const y = pt + (H - pt - pb) * g;
    s += '<line class="grid" x1="' + pl + '" y1="' + y.toFixed(1) + '" x2="' + W + '" y2="' + y.toFixed(1) + '"/>';
    s += '<text class="lab ylab" x="0" y="' + (y + 3).toFixed(1) + '">' + esc(wonS(y1 - (y1 - y0) * g)) + "</text>";
  });
  /* 날짜마다 세로 띠. 누르거나 마우스를 올리면 그날의 값이 모든 선에 대해 뜬다 (점을 정확히 맞히지 않아도 된다) */
  const byDay = new Map();
  for (const se of series) for (const p of se.pts.filter(ok)) {
    const k = p.t.slice(0, 10);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k).push((se.name ? se.name + " " : "") + (o.fmt ? o.fmt(p.y) : won(p.y) + "원"));
  }
  const days = Array.from(byDay.keys()).sort();
  if (o.tips !== false && days.length) {
    days.forEach((k, i) => {
      const x = X(k), xl = i ? (X(days[i - 1]) + x) / 2 : pl, xr = i < days.length - 1 ? (x + X(days[i + 1])) / 2 : W;
      s += '<rect class="hit" x="' + xl.toFixed(1) + '" y="' + pt + '" width="' + Math.max(1, xr - xl).toFixed(1) + '" height="' + (H - pt - pb) +
        '" data-tip="' + esc(k + "\n" + byDay.get(k).join("\n")) + '"/>';
    });
  }
  for (const se of series) {
    const pts = se.pts.filter(ok).slice().sort((a, b) => a.t < b.t ? -1 : a.t > b.t ? 1 : 0);
    if (!pts.length) continue;
    /* step 이면 계단으로 그린다. 입금처럼 그날 한 번에 바뀌는 값 */
    const d = pts.map((p, i) => i === 0 ? "M" + X(p.t).toFixed(1) + " " + Y(p.y).toFixed(1)
      : se.step ? "H" + X(p.t).toFixed(1) + " V" + Y(p.y).toFixed(1)
      : "L" + X(p.t).toFixed(1) + " " + Y(p.y).toFixed(1)).join(" ");
    s += '<path d="' + d + '" fill="none" stroke="' + (se.color || "var(--navy)") + '" stroke-width="' + (se.w || 2) +
      '"' + (se.dash ? ' stroke-dasharray="4 3"' : "") + ' stroke-linejoin="round" vector-effect="non-scaling-stroke" pointer-events="none"/>';
    if (se.dot && pts.length <= 60) pts.forEach(p => {
      s += '<circle cx="' + X(p.t).toFixed(1) + '" cy="' + Y(p.y).toFixed(1) + '" r="' + (se.r || 2.4) + '" fill="' + (se.color || "var(--navy)") +
        '" stroke="var(--solid)" stroke-width="1.5" pointer-events="none"/>';
    });
  }
  /* 아래 눈금은 달의 첫날. 다섯 개 안팎이 되게 건너뛴다 */
  const first = new Date(t0 * 86400000), last = new Date(t1 * 86400000);
  const months = [];
  for (let y = first.getUTCFullYear(), m = first.getUTCMonth(); y < last.getUTCFullYear() || (y === last.getUTCFullYear() && m <= last.getUTCMonth()); m++) {
    if (m > 11) { m = 0; y++; }
    months.push(y + "-" + pad2(m + 1) + "-01");
  }
  const inside = months.filter(t => day(t) >= t0 && day(t) <= t1);
  const step = Math.max(1, Math.ceil(inside.length / 5));
  inside.forEach((t, i) => {
    if (i % step) return;
    s += '<text class="lab" x="' + X(t).toFixed(1) + '" y="' + (H - 4) + '" text-anchor="middle">' + t.slice(2, 4) + "." + t.slice(5, 7) + "</text>";
  });
  return s + "</svg>";
}

/* ---------- 넓이가 값인 사각형 지도 (treemap) ----------
   칸이 정사각형에 가깝도록 나누는 squarified 방식(Bruls, Huizing, van Wijk 2000).
   x, y, w, h 는 같은 단위. 값이 0 이하인 것은 자리를 받지 않는다(null) */
function squarify(vals, x, y, w, h) {
  const out = new Array(vals.length).fill(null);
  const idx = vals.map((v, i) => i).filter(i => vals[i] > 0).sort((a, b) => vals[b] - vals[a]);
  const total = idx.reduce((s, i) => s + vals[i], 0);
  if (!total || !(w > 0) || !(h > 0)) return out;
  const scale = (w * h) / total;
  let rest = idx.map(i => ({ i, a: vals[i] * scale }));
  let rx = x, ry = y, rw = w, rh = h;
  const worst = (row, side) => {
    const s = row.reduce((t, r) => t + r.a, 0), mx = Math.max(...row.map(r => r.a)), mn = Math.min(...row.map(r => r.a));
    return Math.max(side * side * mx / (s * s), (s * s) / (side * side * mn));
  };
  while (rest.length) {
    const side = Math.min(rw, rh);
    const row = [rest[0]];
    let k = 1;
    while (k < rest.length && worst(row.concat(rest[k]), side) <= worst(row, side)) { row.push(rest[k]); k++; }
    rest = rest.slice(k);
    const s = row.reduce((t, r) => t + r.a, 0);
    if (rw >= rh) {                      /* 넓으면 왼쪽에 세로 한 줄 */
      const cw = rest.length ? s / rh : rw;
      let cy = ry;
      row.forEach(r => { const ch = r.a / cw; out[r.i] = { x: rx, y: cy, w: cw, h: ch }; cy += ch; });
      rx += cw; rw -= cw;
    } else {                             /* 높으면 위에 가로 한 줄 */
      const ch = rest.length ? s / rw : rh;
      let cx = rx;
      row.forEach(r => { const cw = r.a / ch; out[r.i] = { x: cx, y: ry, w: cw, h: ch }; cx += cw; });
      ry += ch; rh -= ch;
    }
  }
  return out;
}
/** groups = [{ key, cls, items: [{ name, v, cls, label, tip, open }] }]
    무리마다 먼저 자리를 나누고, 그 안에서 항목을 나눈다. 같은 무리는 붙어 있고 같은 색이다.
    칸 사이는 2px 바탕색 틈. 글씨가 칸에 안 들어가면 fitTreemaps 가 지운다(잘라 보이지 않게) */
function treemapHTML(groups, opt) {
  const o = opt || {};
  const R = o.ratio || 1.7, W = 100 * R, H = 100;
  const gs = groups.filter(g => g.items.some(i => i.v > 0));
  if (!gs.length) return '<div class="empty">그릴 값이 없습니다.</div>';
  const gRect = squarify(gs.map(g => g.items.reduce((s, i) => s + Math.max(0, i.v), 0)), 0, 0, W, H);
  const pct = (a, b) => (a / b * 100).toFixed(3) + "%";
  let s = '<div class="tmap" style="aspect-ratio:' + R + '"' + (o.label ? ' role="img" aria-label="' + esc(o.label) + '"' : "") + ">";
  gs.forEach((g, gi) => {
    const r = gRect[gi];
    if (!r) return;
    const iRect = squarify(g.items.map(i => i.v), r.x, r.y, r.w, r.h);
    g.items.forEach((it, ii) => {
      const c = iRect[ii];
      if (!c) return;
      s += '<div class="tm ' + (it.cls || g.cls || "") + '" style="left:calc(' + pct(c.x, W) + " + 1px);top:calc(" + pct(c.y, H) +
        " + 1px);width:calc(" + pct(c.w, W) + " - 2px);height:calc(" + pct(c.h, H) + ' - 2px)"' +
        (it.tip ? ' data-tip="' + esc(it.tip) + '"' : "") + (it.open ? ' data-open="' + esc(it.open) + '"' : "") + ' tabindex="0">' +
        '<span class="tl"><b>' + esc(it.name) + "</b>" + (it.label ? "<em>" + esc(it.label) + "</em>" : "") + "</span></div>";
    });
  });
  return s + "</div>";
}
/** 칸에 안 들어가는 글씨를 지운다. 이름만이라도 들어가면 이름만 남긴다. 잘린 글씨는 보이지 않게 */
function fitTreemap(box) {
  box.querySelectorAll(".tm").forEach(c => {
    c.classList.remove("nolab", "noem", "sm");
    const t = c.querySelector(".tl");
    if (!t || !c.clientWidth) return;
    /* 칸 안이 넘치면 scroll 크기가 client 크기보다 커진다. 이름은 띄어쓰기에서 줄을 바꿔 들어갈 수 있다.
       안 들어가면 글씨를 줄이고, 그래도 안 되면 숫자를 빼고, 그래도 안 되면 글씨를 지운다(누르면 뜬다) */
    const fits = () => c.scrollHeight <= c.clientHeight + 1 && c.scrollWidth <= c.clientWidth + 1;
    if (fits()) return;
    c.classList.add("sm");
    if (fits()) return;
    c.classList.add("noem");
    if (!fits()) c.classList.add("nolab");
  });
}
const TMAP_RO = typeof ResizeObserver === "function" ? new ResizeObserver(es => es.forEach(e => fitTreemap(e.target))) : null;
function fitTreemaps(root) {
  (root || document).querySelectorAll(".tmap").forEach(m => {
    fitTreemap(m);
    if (!m.dataset.fit) { m.dataset.fit = "1"; if (TMAP_RO) TMAP_RO.observe(m); }
  });
}

/* ---------- 날짜 위의 점 (매수 기록) ----------
   pts = [{ t, y, r, tip }], refs = [{ y, color, label, dash }] 가로 기준선.
   점마다 보이지 않는 큰 원을 겹쳐 손가락으로도 맞힐 수 있게 한다 */
function dotTimeChart(pts, refs, opt) {
  const o = opt || {};
  const ok = p => p && /^\d{4}-\d{2}-\d{2}/.test(p.t || "") && isNum(p.y);
  const ps = pts.filter(ok);
  if (!ps.length) return '<div class="empty">그릴 값이 없습니다.</div>';
  const W = 320, H = o.h || 170, pl = 40, pr = 8, pt = 12, pb = 18;
  const day = t => Date.UTC(+t.slice(0, 4), +t.slice(5, 7) - 1, +t.slice(8, 10)) / 86400000;
  const t0 = Math.min(...ps.map(p => day(p.t))), t1 = Math.max(...ps.map(p => day(p.t)));
  const ys = ps.map(p => p.y).concat((refs || []).filter(r => isNum(r.y)).map(r => r.y));
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  const pad = (y1 - y0) * 0.1 || Math.abs(y1) * 0.1 || 1;
  y0 = Math.max(0, y0 - pad); y1 += pad;
  const X = t => pl + (W - pl - pr) * (t1 > t0 ? (day(t) - t0) / (t1 - t0) : 0.5);
  const Y = v => pt + (H - pt - pb) * (1 - (v - y0) / (y1 - y0));
  const fmt = o.fmt || (v => won(v));
  let s = '<svg class="spark tall" viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none" role="img"' +
    (o.label ? ' aria-label="' + esc(o.label) + '"' : "") + ">";
  [0, 0.5, 1].forEach(g => {
    const y = pt + (H - pt - pb) * g;
    s += '<line class="grid" x1="' + pl + '" y1="' + y.toFixed(1) + '" x2="' + W + '" y2="' + y.toFixed(1) + '"/>';
    s += '<text class="lab ylab" x="0" y="' + (y + 3).toFixed(1) + '">' + esc(fmt(y1 - (y1 - y0) * g)) + "</text>";
  });
  (refs || []).filter(r => isNum(r.y)).forEach(r => {
    const y = Y(r.y).toFixed(1);
    s += '<line x1="' + pl + '" y1="' + y + '" x2="' + W + '" y2="' + y + '" stroke="' + r.color + '" stroke-width="1.5"' +
      (r.dash ? ' stroke-dasharray="4 3"' : "") + ' vector-effect="non-scaling-stroke"/>';
    if (r.label) s += '<text class="lab reflab" x="' + (W - pr) + '" y="' + (+y - 4) + '" text-anchor="end">' + esc(r.label) + "</text>";
  });
  ps.forEach(p => {
    const cx = X(p.t).toFixed(1), cy = Y(p.y).toFixed(1);
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (p.r || 4).toFixed(1) + '" fill="' + (p.color || "var(--gold)") +
      '" fill-opacity=".75" stroke="var(--solid)" stroke-width="1.5" pointer-events="none"/>';
    s += '<circle class="hitc" cx="' + cx + '" cy="' + cy + '" r="' + Math.max(10, (p.r || 4) + 4).toFixed(1) + '" data-tip="' + esc(p.tip || "") + '"/>';
  });
  const y0s = new Date(t0 * 86400000).getUTCFullYear(), y1s = new Date(t1 * 86400000).getUTCFullYear();
  for (let y = y0s; y <= y1s; y++) {
    const t = y + "-01-01";
    if (day(t) < t0 || day(t) > t1) continue;
    s += '<text class="lab" x="' + X(t).toFixed(1) + '" y="' + (H - 4) + '" text-anchor="middle">' + String(y).slice(2) + "</text>";
  }
  if (y0s === y1s || ps.length === 1) s += '<text class="lab" x="' + X(ps[0].t).toFixed(1) + '" y="' + (H - 4) + '" text-anchor="middle">' + esc(ps[0].t.slice(2, 7).replace("-", ".")) + "</text>";
  return s + "</svg>";
}

/* ---------- 눌러서 값 보기 ----------
   그래프 값은 예전에 SVG <title> 로만 있어 휴대폰에서는 볼 수 없었다.
   data-tip 이 달린 것을 누르면(마우스는 올리면) 작은 상자에 값을 띄운다. 첫 줄이 굵게 나온다.
   data-open 이 달린 것은 누르면 제 할 일(상세 창)을 하므로 누를 때는 띄우지 않는다.
   글은 textContent 로 넣는다. 시트에서 온 이름이 섞이므로 HTML 로 넣지 않는다 */
const TIP = { el: null, cur: null };
function tipShow(t, x, y) {
  if (!TIP.el) {
    TIP.el = document.createElement("div");
    TIP.el.id = "viztip"; TIP.el.setAttribute("role", "status"); TIP.el.hidden = true;
    document.body.appendChild(TIP.el);
  }
  if (TIP.cur && TIP.cur !== t) TIP.cur.classList.remove("tipon");
  TIP.cur = t; t.classList.add("tipon");
  TIP.el.textContent = "";
  String(t.getAttribute("data-tip") || "").split("\n").forEach((line, i) => {
    const e = document.createElement(i ? "span" : "b"); e.textContent = line; TIP.el.appendChild(e);
  });
  TIP.el.hidden = false;
  const r = TIP.el.getBoundingClientRect(), vw = window.innerWidth, vh = window.innerHeight;
  let left = x - r.width / 2, top = y - r.height - 14;
  if (top < 8) top = y + 18;
  left = Math.max(8, Math.min(vw - r.width - 8, left));
  top = Math.max(8, Math.min(vh - r.height - 8, top));
  TIP.el.style.left = left + "px"; TIP.el.style.top = top + "px";
}
function tipHide() {
  if (TIP.cur) TIP.cur.classList.remove("tipon");
  TIP.cur = null;
  if (TIP.el) TIP.el.hidden = true;
}
if (typeof document !== "undefined" && document.addEventListener) {
  const tipOf = e => e.target && e.target.closest ? e.target.closest("[data-tip]") : null;
  document.addEventListener("click", e => {
    const t = tipOf(e);
    if (t && !t.hasAttribute("data-open")) tipShow(t, e.clientX, e.clientY);
    else tipHide();
  });
  document.addEventListener("pointermove", e => {
    if (e.pointerType !== "mouse") return;
    const t = tipOf(e);
    if (t) { if (t !== TIP.cur || TIP.el.hidden) tipShow(t, e.clientX, e.clientY); else { TIP.el.style.left = Math.max(8, Math.min(window.innerWidth - TIP.el.offsetWidth - 8, e.clientX - TIP.el.offsetWidth / 2)) + "px"; } }
    else if (TIP.cur) tipHide();
  });
  document.addEventListener("focusin", e => {
    const t = tipOf(e);
    if (t) { const r = t.getBoundingClientRect(); tipShow(t, r.left + r.width / 2, r.top); }
  });
  document.addEventListener("keydown", e => {
    if ((e.key === "Enter" || e.key === " ") && e.target && e.target.hasAttribute && e.target.hasAttribute("data-open")) { e.preventDefault(); e.target.click(); }
  });
  /* 창 안(상세 창의 시트)에서 밀어도 닫히게 capture 로 듣는다. scroll 은 거품이 일지 않는다 */
  document.addEventListener("scroll", tipHide, { passive: true, capture: true });
}
