// Generates data/map-data.js (SVG paths for Southeast Asia) from Natural Earth topojson.
//   node scripts/build-map.mjs path/to/countries-50m.json
// Source: world-atlas@2 (Natural Earth, public domain). Output is committed, so this only
// needs re-running if the map framing below changes.
import { readFileSync, writeFileSync } from 'node:fs';

const src = process.argv[2];
if (!src) { console.error('usage: node scripts/build-map.mjs countries-50m.json'); process.exit(1); }
const topo = JSON.parse(readFileSync(src, 'utf8'));

// ---- framing (lon/lat) and projection (Mercator) ----
const LON0 = 96.5, LON1 = 128.5, LAT0 = -10.6, LAT1 = 24.6;
const W = 1000;
const merc = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const k = W / (LON1 - LON0);                  // px per degree lon
const yTop = merc(LAT1), yBot = merc(LAT0);
const kY = k * (180 / Math.PI);               // px per mercator unit
const H = Math.round((yTop - yBot) * kY);
const proj = (lon, lat) => [(lon - LON0) * k, (yTop - merc(lat)) * kY];

// ---- decode topojson arcs ----
const { scale, translate } = topo.transform;
const arcs = topo.arcs.map((arc) => {
  let x = 0, y = 0;
  return arc.map(([dx, dy]) => { x += dx; y += dy; return [x * scale[0] + translate[0], y * scale[1] + translate[1]]; });
});
function ring(indices) {
  const pts = [];
  for (const i of indices) {
    const a = i >= 0 ? arcs[i] : arcs[~i].slice().reverse();
    for (let j = pts.length ? 1 : 0; j < a.length; j++) pts.push(a[j]);
  }
  return pts;
}

// ---- Sutherland–Hodgman clip to the lon/lat frame (+margin) ----
const M = 5;
const box = [LON0 - M, LAT0 - M, LON1 + M, LAT1 + M];
function clip(poly) {
  const edges = [
    [(p) => p[0] >= box[0], (a, b) => { const t = (box[0] - a[0]) / (b[0] - a[0]); return [box[0], a[1] + t * (b[1] - a[1])]; }],
    [(p) => p[0] <= box[2], (a, b) => { const t = (box[2] - a[0]) / (b[0] - a[0]); return [box[2], a[1] + t * (b[1] - a[1])]; }],
    [(p) => p[1] >= box[1], (a, b) => { const t = (box[1] - a[1]) / (b[1] - a[1]); return [a[0] + t * (b[0] - a[0]), box[1]]; }],
    [(p) => p[1] <= box[3], (a, b) => { const t = (box[3] - a[1]) / (b[1] - a[1]); return [a[0] + t * (b[0] - a[0]), box[3]]; }],
  ];
  let out = poly;
  for (const [inside, cut] of edges) {
    const input = out; out = [];
    if (!input.length) break;
    let prev = input[input.length - 1];
    for (const cur of input) {
      if (inside(cur)) { if (!inside(prev)) out.push(cut(prev, cur)); out.push(cur); }
      else if (inside(prev)) out.push(cut(prev, cur));
      prev = cur;
    }
  }
  return out;
}

// ---- Douglas–Peucker ----
function dp(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let maxD = 0, idx = -1;
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1e-9;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / len;
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > tol) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

// A closed ring has identical first/last points, which breaks plain DP: split at the farthest point.
function dpRing(pts, tol) {
  if (pts.length > 1 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) pts = pts.slice(0, -1);
  if (pts.length < 4) return pts;
  let far = 0, best = -1;
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]); if (d > best) { best = d; far = i; } }
  const a = dp(pts.slice(0, far + 1), tol), b = dp(pts.slice(far).concat([pts[0]]), tol);
  return a.concat(b.slice(1, -1));
}

const area = (pts) => { let s = 0; for (let i = 0; i < pts.length; i++) { const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length]; s += x1 * y2 - x2 * y1; } return Math.abs(s / 2); };

function pathFor(geoms) {
  let d = '';
  for (const g of geoms) {
    const polys = g.type === 'Polygon' ? [g.arcs] : g.type === 'MultiPolygon' ? g.arcs : [];
    for (const poly of polys) {
      for (let r = 0; r < poly.length; r++) {
        let pts = clip(ring(poly[r]));
        if (pts.length < 3) continue;
        pts = pts.map(([lo, la]) => proj(lo, la));
        pts = dpRing(pts, 0.45);
        if (pts.length < 3 || area(pts) < 2.2) continue;
        d += 'M' + pts.map(([x, y]) => x.toFixed(1) + ' ' + y.toFixed(1)).join('L') + 'Z';
      }
    }
  }
  return d;
}

const MM = { Thailand: 'TH', Laos: 'LA', Vietnam: 'VN', Cambodia: 'KH', Indonesia: 'ID', Philippines: 'PH' };
const groups = { TH: [], LA: [], VN: [], KH: [], ID: [], PH: [], other: [] };
for (const g of topo.objects.countries.geometries) {
  const name = g.properties && g.properties.name;
  if (name === 'Antarctica') continue;
  (groups[MM[name]] || groups.other).push(g);
}
const paths = {};
for (const [key, geoms] of Object.entries(groups)) paths[key] = pathFor(geoms);

const out =
  '/* GENERATED by scripts/build-map.mjs — Natural Earth (public domain). Do not hand-edit. */\n' +
  '(function(r){var MM=r.MM=r.MM||{};MM.MAP=' +
  JSON.stringify({ w: W, h: H, lon0: LON0, lon1: LON1, lat0: LAT0, lat1: LAT1, paths }) +
  ';if(typeof module!=="undefined")module.exports=MM.MAP;})(typeof window!=="undefined"?window:globalThis);\n';
writeFileSync(new URL('../data/map-data.js', import.meta.url), out);
console.log('map', W + 'x' + H, 'bytes', out.length, Object.fromEntries(Object.entries(paths).map(([k2, v]) => [k2, v.length])));
