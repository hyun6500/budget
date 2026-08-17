/* ===== js/widgets.js ===== */
/* widgets.js - 그림 조각. 외부 차트 라이브러리를 쓰지 않는다. */
FILEV.widgets = CONFIG.APP_VERSION;

/** 이중 막대. 채운 부분이 내 몫, 빗금이 전액. */
function dbar(mine, full, max, kind) {
  const k = kind === "수입" ? " in" : kind === "이체" ? " mov" : "";
  const m = max ? Math.max(0, Math.min(100, mine / max * 100)) : 0;
  const f = max ? Math.max(0, Math.min(100, (full || mine) / max * 100)) : 0;
  return '<div class="dbar' + k + '"><i class="full" style="width:' + f.toFixed(1) + '%"></i>' +
    '<i class="mine" style="width:' + m.toFixed(1) + '%"></i></div>';
}

function deltaBadge(v, invert) {
  if (v == null || !isFinite(v)) return '<span class="delta flat">비교 없음</span>';
  const p = Math.round(v * 100);
  if (p === 0) return '<span class="delta flat">그대로</span>';
  const worse = invert ? p < 0 : p > 0;
  return '<span class="delta ' + (worse ? "up" : "down") + '">' + (p > 0 ? "+" : "") + p + "%</span>";
}

/** 가로 순위 목록 */
function rankList(items, max, opt) {
  const o = opt || {};
  if (!items.length) return '<div class="empty">아직 기록이 없습니다.</div>';
  const mx = max || items[0].mine || 1;
  return '<div class="rows">' + items.map(it => {
    const c = o.color ? o.color(it) : null;
    const bar = c
      ? '<div class="dbar"><i class="mine" style="width:' + Math.min(100, it.mine / mx * 100).toFixed(1) + '%;background:' + c + '"></i></div>'
      : dbar(it.mine, it.amt, mx);
    const chip = o.noIcon ? "" : iconChip(it.key, c);
    return '<div class="row' + (chip ? " hasic" : "") + '"' + (o.click ? ' data-k="' + esc(it.key) + '" style="cursor:pointer"' : "") + '>' +
      chip + '<div class="nm">' + esc(it.key) + "</div>" +
      '<div class="amt">' + won(it.mine) + "</div>" +
      '<div class="bar">' + bar + "</div>" +
      '<div class="meta"><span>' + it.n + "건</span>" +
      (it.amt > it.mine ? "<span>전액 " + won(it.amt) + "</span>" : "") +
      (o.extra ? "<span>" + o.extra(it) + "</span>" : "") + "</div></div>";
  }).join("") + "</div>";
}

/** 달별 꺾은선 + 막대. pts = [{ym, out, inc}] */
function sparkMonths(pts, opt) {
  const o = opt || {};
  if (!pts.length) return '<div class="empty">그릴 값이 없습니다.</div>';
  const W = 320, H = 130, pl = 4, pr = 4, pt = 10, pb = 18;
  const maxV = Math.max(1, ...pts.map(p => Math.max(p.out || 0, o.line ? (p.inc || 0) : 0)));
  const n = pts.length, iw = (W - pl - pr) / n;
  let s = '<svg class="spark" viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none" role="img">';
  [0.5, 1].forEach(g => { const y = pt + (H - pt - pb) * (1 - g); s += '<line class="grid" x1="0" y1="' + y + '" x2="' + W + '" y2="' + y + '"/>'; });
  pts.forEach((p, i) => {
    const h = (H - pt - pb) * ((p.out || 0) / maxV);
    const x = pl + i * iw + iw * 0.18, w = iw * 0.64;
    s += '<rect x="' + x.toFixed(1) + '" y="' + (H - pb - h).toFixed(1) + '" width="' + w.toFixed(1) +
      '" height="' + Math.max(0, h).toFixed(1) + '" rx="1.6" fill="' + (p.hi ? "var(--navy)" : "var(--out)") +
      '" opacity="' + (p.hi ? 1 : .82) + '"/>';
  });
  if (o.line) {
    const d = pts.map((p, i) => {
      const x = pl + i * iw + iw / 2, y = H - pb - (H - pt - pb) * ((p.inc || 0) / maxV);
      return (i ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1);
    }).join(" ");
    s += '<path d="' + d + '" fill="none" stroke="var(--in)" stroke-width="1.8" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>';
  }
  pts.forEach((p, i) => {
    if (n > 14 && i % 2) return;
    const x = pl + i * iw + iw / 2;
    s += '<text class="lab" x="' + x.toFixed(1) + '" y="' + (H - 5) + '" text-anchor="middle">' + esc(p.label || ymLabel(p.ym)) + "</text>";
  });
  return s + "</svg>";
}

/** 도넛. parts = [{key, mine, color}] */
function donut(parts, total) {
  const t = total || parts.reduce((a, p) => a + p.mine, 0);
  if (!t) return '<div class="empty">그릴 값이 없습니다.</div>';
  const R = 54, C = 2 * Math.PI * R;
  let acc = 0;
  let s = '<svg viewBox="0 0 140 140" style="width:140px;height:140px;flex:0 0 auto" role="img">' +
    '<circle cx="70" cy="70" r="' + R + '" fill="none" stroke="#F1F4F9" stroke-width="18"/>';
  parts.forEach(p => {
    const f = p.mine / t, len = C * f;
    s += '<circle cx="70" cy="70" r="' + R + '" fill="none" stroke="' + (p.color || colorOf(p.key)) +
      '" stroke-width="18" stroke-dasharray="' + len.toFixed(2) + " " + (C - len).toFixed(2) +
      '" stroke-dashoffset="' + (-acc).toFixed(2) + '" transform="rotate(-90 70 70)"/>';
    acc += len;
  });
  s += '<text x="70" y="66" text-anchor="middle" style="font-family:var(--mono);font-size:15px;font-weight:700;fill:var(--ink)">' + wonS(t) + "</text>";
  s += '<text x="70" y="82" text-anchor="middle" style="font-size:9px;fill:var(--ink3)">내 몫 합계</text>';
  return s + "</svg>";
}

/** 달력 히트맵 */
function calendar(ym, rs) {
  const y = +ym.slice(0, 4), m = +ym.slice(5, 7);
  const first = new Date(y, m - 1, 1), last = new Date(y, m, 0).getDate();
  const byDay = {};
  rs.filter(isOut).forEach(r => { const d = +r.date.slice(8, 10); byDay[d] = (byDay[d] || 0) + r.mine; });
  const mx = Math.max(1, ...Object.values(byDay));
  let s = '<div class="cal">' + WD.map(w => '<div class="h">' + w + "</div>").join("");
  for (let i = 0; i < first.getDay(); i++) s += '<div></div>';
  for (let d = 1; d <= last; d++) {
    const v = byDay[d] || 0, wd = new Date(y, m - 1, d).getDay();
    s += '<div class="d' + (v ? " has" : "") + (wd === 0 ? " sun" : wd === 6 ? " sat" : "") + '" data-day="' + d + '">' +
      (v ? '<i class="fill" style="height:' + (18 + 72 * (v / mx)).toFixed(0) + '%"></i>' : "") +
      '<span class="n">' + d + "</span>" + (v ? '<span class="v">' + wonS(v) + "</span>" : "") + "</div>";
  }
  return s + "</div>";
}
