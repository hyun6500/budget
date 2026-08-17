/* ===== js/widgets-extra.js ===== */
/* widgets-extra.js - 세그먼트, 잔디, 꺾은선, 막대, 자산 트리 줄. */
FILEV.widgetsExtra = CONFIG.APP_VERSION;
function segHTML(items, cur, attr) {
  return '<div class="seg">' + items.map(([k, n]) =>
    '<button class="' + (k === cur ? "on" : "") + '" data-' + attr + '="' + k + '">' + n + "</button>").join("") + "</div>";
}

/** 잔디. days = [{d, v}] 를 요일 세로로 깔아 준다 */
function heatHTML(map, nDays) {
  const n = nDays || 371;
  const end = new Date(todayISO() + "T00:00:00");
  const start = new Date(end); start.setDate(start.getDate() - n + 1);
  start.setDate(start.getDate() - start.getDay());
  const vals = [];
  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const k = d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
    vals.push({ k, v: map.get(k) || 0 });
  }
  const nz = vals.map(x => x.v).filter(v => v > 0).sort((a, b) => a - b);
  const q = p => nz.length ? nz[Math.min(nz.length - 1, Math.floor(nz.length * p))] : 0;
  const t1 = q(.25), t2 = q(.55), t3 = q(.82);
  const shade = v => !v ? "var(--soft)" : v <= t1 ? "rgba(179,58,90,.20)" : v <= t2 ? "rgba(179,58,90,.42)"
    : v <= t3 ? "rgba(179,58,90,.68)" : "var(--out)";
  const cells = vals.map(x =>
    '<i style="background:' + shade(x.v) + '" title="' + x.k + " " + (x.v ? won(x.v) + "원" : "기록 없음") + '"></i>').join("");
  return '<div class="heatwrap"><div class="heat">' + cells + "</div></div>" +
    '<div class="heatleg">적음' +
    [0, t1, t2, t3, t3 + 1].map(v => '<i style="background:' + shade(v) + '"></i>').join("") +
    "많음 <span style=\"margin-left:auto\">최근 " + Math.round(n / 30) + "달</span></div>";
}

/** 두 겹 꺾은선. a 는 실선, b 는 점선(추정) */
function lineChart(series, opt) {
  const o = opt || {};
  const all = series.reduce((a, s) => a.concat(s.pts), []);
  if (!all.length) return '<div class="empty">그릴 값이 없습니다.</div>';
  const W = 320, H = o.h || 150, pl = 4, pr = 4, ptop = 10, pb = 18;
  const xs = Array.from(new Set(all.map(p => p.x))).sort();
  const maxV = Math.max(1, ...all.map(p => p.y));
  const minV = o.zero === false ? Math.min(...all.map(p => p.y)) : 0;
  const span = Math.max(1, maxV - minV);
  const X = i => pl + (W - pl - pr) * (xs.length > 1 ? i / (xs.length - 1) : .5);
  const Y = v => ptop + (H - ptop - pb) * (1 - (v - minV) / span);
  let s = '<svg class="spark' + (o.h ? " tall" : "") + '" viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none" role="img">';
  [0, .5, 1].forEach(g => { const y = ptop + (H - ptop - pb) * g; s += '<line class="grid" x1="0" y1="' + y + '" x2="' + W + '" y2="' + y + '"/>'; });
  for (const se of series) {
    const d = se.pts.map((p, i) => {
      const ix = xs.indexOf(p.x);
      return (i ? "L" : "M") + X(ix).toFixed(1) + " " + Y(p.y).toFixed(1);
    }).join(" ");
    s += '<path d="' + d + '" fill="none" stroke="' + (se.color || "var(--navy)") + '" stroke-width="' + (se.w || 2) +
      '"' + (se.dash ? ' stroke-dasharray="4 3"' : "") + ' stroke-linejoin="round" vector-effect="non-scaling-stroke"/>';
    if (se.dot) se.pts.forEach(p => {
      s += '<circle cx="' + X(xs.indexOf(p.x)).toFixed(1) + '" cy="' + Y(p.y).toFixed(1) + '" r="2.4" fill="' + (se.color || "var(--navy)") + '"/>';
    });
  }
  const step = Math.max(1, Math.ceil(xs.length / 7));
  xs.forEach((x, i) => {
    if (i % step && i !== xs.length - 1) return;
    s += '<text class="lab" x="' + X(i).toFixed(1) + '" y="' + (H - 5) + '" text-anchor="middle">' + esc(o.label ? o.label(x) : x) + "</text>";
  });
  return s + "</svg>";
}

/** 간단한 세로 막대. pts = [{key, mine}] */
function barsHTML(pts, opt) {
  const o = opt || {};
  if (!pts.length) return '<div class="empty">그릴 값이 없습니다.</div>';
  const W = 320, H = o.h || 130, pl = 4, pr = 4, ptop = 10, pb = 18;
  const maxV = Math.max(1, ...pts.map(p => Math.abs(p.mine)));
  const iw = (W - pl - pr) / pts.length;
  let s = '<svg class="spark" viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none" role="img">';
  [.5, 1].forEach(g => { const y = ptop + (H - ptop - pb) * (1 - g); s += '<line class="grid" x1="0" y1="' + y + '" x2="' + W + '" y2="' + y + '"/>'; });
  pts.forEach((p, i) => {
    const h = (H - ptop - pb) * (Math.abs(p.mine) / maxV);
    s += '<rect x="' + (pl + i * iw + iw * .2).toFixed(1) + '" y="' + (H - pb - h).toFixed(1) +
      '" width="' + (iw * .6).toFixed(1) + '" height="' + Math.max(0, h).toFixed(1) +
      '" rx="1.6" fill="' + (p.color || o.color || "var(--out)") + '" opacity="' + (p.hi ? 1 : .85) + '"/>';
  });
  const step = Math.max(1, Math.ceil(pts.length / 12));
  pts.forEach((p, i) => {
    if (i % step) return;
    s += '<text class="lab" x="' + (pl + i * iw + iw / 2).toFixed(1) + '" y="' + (H - 5) + '" text-anchor="middle">' + esc(p.key) + "</text>";
  });
  return s + "</svg>";
}

/** 자산 트리 한 줄 */
function treeRow(t, showValued) {
  const gap = showValued && t.valued != null ? t.valued - t.amt : null;
  return '<div class="t d' + t.depth + '"><div>' + esc(t.name) +
    (t.rate ? '<span class="side">' + (t.rate * 100).toFixed(2) + "%</span>" : "") +
    (t.note ? '<span class="side">' + esc(t.note) + "</span>" : "") + "</div>" +
    '<div class="amt">' + won(t.amt) +
    (gap != null && Math.abs(gap) > 1
      ? ' <span class="side" style="color:' + (gap >= 0 ? "var(--in)" : "var(--out)") + '">' +
        (gap >= 0 ? "+" : "-") + wonS(Math.abs(gap)) + "</span>" : "") +
    "</div></div>";
}
