/* ============================================================
   THE FRONT DOOR (#/start): build a trip from nothing, one stop at a time.
   Where you land, how long you've got, then three different next stops at a time (and the ALL IN trip that fits as a fourth),
   the route drawing itself on the map as you go, and your whole trip at the end. Picked by Ewan on 18 Nov 2026 from the
   "Trip builder try-out" as the builder's front door.

   • The trip is the builder's own trip (MMApp.state, saved as mm-trip), worked out by the builder's engine (MM.plan, MM.legOptions),
     so the full editor is one tap away with everything in it. A few extras live in mm-start: how long they've got, who's coming.
   • It draws inside a shadow root with its own stylesheet (start.css, the ALL IN look), so its styles and the editor's never touch.
   • "Hold my beds, it's free" sends through the same request as the editor's form (MMApp.review.send: trip-builder-request on the
     ALL IN backend), with the ALL IN free night, who's coming and the dates, and what they told the ALL IN site (sessionStorage allin-told).
   Screens: #/start  where you land · #/start/how-long · #/start/next  where next · #/start/trip  your trip
   ============================================================ */
(function () {
  'use strict';
  var A = window.MMApp, MM = window.MM, Film = window.MMRouteFilm;
  if (!A || !MM || !Film) return;
  var P = MM.PLACES, u = A.util, C = window.MM_CONFIG || {}, NS = 'http://www.w3.org/2000/svg';
  var VER = (/[?&]v=([^&]+)/.exec((document.currentScript || {}).src || '') || [])[1] || '';
  var REDUCED = Film.reduced();
  var LOGO = 'assets/logo/mad-monkey-white.png';

  /* ============================================================
     WHAT A STOP FEELS LIKE: six kinds, so the three choices are always different
     ============================================================ */
  var KINDS = [
    { k: 'beach', n: 'Beach and islands', c: '#1BC4AF', tags: ['beach', 'water', 'surf', 'dive'] },
    { k: 'party', n: 'Party', c: '#FF6A4D', tags: ['party'] },
    { k: 'adventure', n: 'Adventure', c: '#C5E86C', tags: ['adventure', 'moto', 'mountains', 'nature'] },
    { k: 'culture', n: 'Culture and food', c: '#FFB238', tags: ['culture', 'food'] },
    { k: 'city', n: 'Big city', c: '#5FB7FF', tags: ['city'] },
    { k: 'chill', n: 'Slow down', c: '#B9A6FF', tags: ['chill'] }
  ];
  var CC = { TH: '#C5E86C', LA: '#B9A6FF', VN: '#FFB238', KH: '#FF6A4D', ID: '#1BC4AF', PH: '#5FB7FF' };
  var TINT = { TH: '#E4F1C8', LA: '#E6E0FA', VN: '#FFE8C0', KH: '#FFDCD3', ID: '#C9EFE9', PH: '#D8EBFF' };
  var GATES = [['bangkok', 'Bangkok'], ['hanoi', 'Hanoi'], ['saigon', 'Ho Chi Minh City'], ['uluwatu', 'Bali'], ['manila', 'Manila'], ['phnom-penh', 'Phnom Penh']];
  var WEEKS = [[7, '1 week'], [14, '2 weeks'], [21, '3 weeks'], [30, 'A month'], [42, '6 weeks or more'], [0, 'Not sure yet']];
  var DAYNAME = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  /* ---------- small helpers ---------- */
  var esc = u.esc;
  var R = null, V = null, sheets = null, toasts = null;          // the shadow root, the screen, the sheet layer, the toasts
  function $(sel, el) { return (el || R).querySelector(sel); }
  function $$(sel, el) { return Array.prototype.slice.call((el || R).querySelectorAll(sel)); }
  function money(x) { return u.money(Math.round(x)); }
  function hrs(h) { return MM.util.hoursLabel(h); }
  function cname(c) { return MM.COUNTRIES[c] ? MM.COUNTRIES[c].n : c; }
  function pname(id) { return id === 'uluwatu' ? 'Uluwatu, Bali' : P[id].n; }
  function gal(id, k) { var g = MM.gallery(id); return g[k] ? MM.thumb(g[k], 'm') : ''; }
  function photo(id) { var h = MM.hostelImg(id); return h ? MM.thumb(h, 'm') : gal(id, 0); }
  function photo2(id) { var n = MM.galleryRaw(id).length; return n ? gal(id, n > 1 ? 1 : 0) : photo(id); }
  function placePics(id) { var out = [], n = Math.min(3, MM.galleryRaw(id).length), h = MM.hostelImg(id); for (var i = 0; i < n; i++) out.push(gal(id, i)); if (h) out.push(MM.thumb(h, 'm')); return out; }
  function actPhoto(a, i) { var t = a.slug && MM.tourImg(a.slug); if (t) return MM.thumb(t, 'm'); var pics = placePics(a.p).filter(function (x) { return x !== photo2(a.p); }); return pics.length ? pics[(i || 0) % pics.length] : photo2(a.p); }
  function tripPhoto(t) { var x = (t.img || [])[0]; if (!x) return photo(t.stops[0].p); return MM.tourImg(x) ? MM.thumb(MM.tourImg(x), 'm') : P[x] ? photo(x) : photo(t.stops[0].p); }
  function hook(id) { return String(P[id].hook || '').replace(/\s*Everyone starts here\.?$/, ''); }
  function bg(url) { return url ? '--img:url(' + esc(JSON.stringify(String(url))) + ')' : ''; }
  function icon(m) {
    var parts = Film.ICONS[Film.mode(m)] || Film.ICONS.bus, s = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">';
    parts.forEach(function (p) { if (p[2] === 'c') return; s += '<' + p[0]; for (var k in p[1]) s += ' ' + k + '="' + p[1][k] + '"'; s += '/>'; });
    return s + '</svg>';
  }
  function modeWord(o) { var m = Film.mode(o.main); return o.ovn ? 'overnight ' + (m === 'plane' ? 'flight' : m) : m === 'plane' ? 'flight' : m === 'car' ? 'transfer' : m; }
  function rideLine(o) { return hrs(o.h) + ' ' + modeWord(o) + ' · ~' + money(o.u); }
  function trip(id) { return MM.ALL_IN.filter(function (t) { return t.id === id; })[0]; }
  function priceOf(t) { var d = A.state.start ? MM.util.parseDate(A.state.start) : null; return MM.allInPrice(t, d); }
  function fmtDay(d, yr) { return d ? d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }) + (yr ? ' ' + d.getUTCFullYear() : '') : ''; }
  // the day the trip finishes: the engine's last day (you check out and move on), a date once they've picked when they go
  function endDate(pl) { var d = pl && pl.days && pl.days.length ? pl.days[pl.days.length - 1].date : null; return d || null; }
  function startDate() { return A.state.start ? MM.util.parseDate(A.state.start) : null; }
  function dateRange(pl) { var a = startDate(), b = endDate(pl); if (!a || !b) return ''; var yr = a.getUTCFullYear() !== b.getUTCFullYear(); return fmtDay(a, yr) + ' to ' + fmtDay(b, true); }

  /* ============================================================
     THE TRIP: the builder's own (MMApp.state). The extras, mm-start: how long they've got, who's coming, the screen they were on.
     ============================================================ */
  var XKEY = 'mm-start';
  function freshX() { return { target: 0, who: 'solo', mates: 2, crew: true, full: false, at: 'next' }; }
  var S = Object.assign(freshX(), u.store(XKEY) || {}), hist = [], seen = {}, seenAt = '', pendingStart = null;
  function saveX() { u.store(XKEY, S); }
  function save() { saveX(); A.auto = false; u.persist(); }                      // the trip is saved where the full editor keeps it
  function items() { return A.state.items; }
  function plan() { try { return MM.plan(A.state); } catch (e) { if (window.console) console.error(e); return null; } }
  function lastPlace(pl) { return pl && pl.places.length ? pl.places[pl.places.length - 1] : null; }
  function countriesIn(pl) { var c = {}; (pl ? pl.places : []).forEach(function (p) { c[P[p].c] = 1; }); return Object.keys(c); }
  function people() { return S.who === 'friends' ? S.mates : 1; }
  // a trip saved on this device: the one open now, else the last one saved
  function savedTrip() {
    var cand = [A.state, (u.store('mm-trip') || {}).state, (u.store('mm-trip-last') || {}).state];
    for (var k = 0; k < cand.length; k++) { var c = cand[k] && cand[k].items && cand[k].items.length ? MM.sanitizeState(cand[k]) : null; if (c && c.items.length) return c; }
    return null;
  }
  // a new trip from its first stop: the one you had is kept (mm-trip-last), so "Carry on" and the editor's "Pick up where you left off" still find it
  function newTrip(first, target) {
    if (A.stash) A.stash();
    A.state = MM.defaultState(); A.auto = false; A.focus = []; A.open = {}; A.revise = null; u.store('mm-revise', null);
    A.state.items.push(first);
    S = freshX(); S.target = target || 0; hist = []; seen = {}; seenAt = '';
    save();
  }
  // how you get between each pair of places on the route (the plan's own legs; inside an ALL IN trip, the usual way)
  var modeCache = {};
  function legMode(a, b) { var k = a + '>' + b; if (!(k in modeCache)) { var o = MM.legOptions(a, b)[0]; modeCache[k] = o ? o.main : 'bus'; } return modeCache[k]; }
  function filmStops(pl) {
    if (!pl) return [];
    var used = {}, out = [];
    pl.places.forEach(function (p, i) {
      var next = pl.places[i + 1], by = null;
      if (next && next !== p) {
        var L = pl.legs.filter(function (l, j) { return !used[j] && l.from === p && l.to === next; })[0];
        if (L) { used[pl.legs.indexOf(L)] = 1; by = L.chosen ? L.chosen.main : null; }
        by = by || legMode(p, next);
      }
      out.push({ place: p, by: by });
    });
    return out;
  }

  /* ============================================================
     WHERE NEXT: three different kinds of next stop, the natural ones first
     ============================================================ */
  function kindsOf(id) {           // the kinds a place is, the one that defines it first
    var out = [];
    P[id].tags.forEach(function (t) { KINDS.forEach(function (k) { if (k.tags.indexOf(t) > -1 && out.indexOf(k) < 0) out.push(k); }); });
    return out.length ? out : [KINDS[3]];
  }
  function pool(pl) {
    var cur = lastPlace(pl); if (!cur) return [];
    var used = {}, tagsHave = {};
    pl.places.forEach(function (p) { used[p] = 1; P[p].tags.forEach(function (t) { tagsHave[t] = 1; }); });
    var nat = P[cur].next || [], start = A.state.start ? MM.util.parseDate(A.state.start) : null;
    var month = start ? new Date(start.getTime() + (pl.totals.days || 0) * 864e5).getUTCMonth() : null;
    return Object.keys(P).filter(function (id) { return !used[id]; }).map(function (id) {
      var o = MM.legOptions(cur, id)[0]; if (!o || o.h > 18) return null;
      var s = 0, ni = nat.indexOf(id), seas = month != null ? MM.seasonOf(id, month) : 2;
      if (ni > -1) s += 6 - ni;
      s += Math.min(2, P[id].tags.filter(function (t) { return !tagsHave[t]; }).length * 0.6);
      s += { 3: 1.5, 2: 0, 1: -2.5 }[seas] || 0;
      s -= o.h * 0.25 + o.u * 0.012;
      if (P[id].partner) s -= 0.6;
      var badge = ni === 0 ? 'Classic route' : seas === 3 && month != null ? 'Prime time' : P[id].c !== P[cur].c ? 'New country' : '';
      var ks = kindsOf(id);
      return { id: id, s: s, ride: o, natural: ni > -1, good: ni > -1 || o.h <= 9, kinds: ks, kind: ks[0], badge: badge };
    }).filter(Boolean).sort(function (a, b) { return b.s - a.s; });
  }
  // the natural next stops first (as different as they can be), then easy hops, then the rest
  function pickThree(list) {
    var out = [], kinds = {};
    [list.filter(function (c) { return c.natural; }), list.filter(function (c) { return !c.natural && c.good; }), list.filter(function (c) { return !c.natural && !c.good; })].forEach(function (tier) {
      tier.forEach(function (c) { if (out.length < 3 && !kinds[c.kind.k] && out.indexOf(c) < 0) { out.push(c); kinds[c.kind.k] = 1; } });
      tier.forEach(function (c) { if (out.length < 3 && out.indexOf(c) < 0) out.push(c); });
    });
    var shown = {};                  // each card says what it's like; two cards never say the same
    out.forEach(function (c) { var k = c.kinds.filter(function (x) { return !shown[x.k]; })[0] || c.kind; c.label = k; shown[k.k] = 1; });
    return out;
  }
  function deckFor(pl, shuffle) {
    var cur = lastPlace(pl), all = pool(pl);
    if (seenAt !== cur) { seen = {}; seenAt = cur; }
    var rest = all.filter(function (c) { return !seen[c.id]; }), wrapped = false;
    if (shuffle && rest.length < 1) { seen = {}; rest = all; wrapped = true; }
    var three = pickThree(shuffle ? rest : all);
    three.forEach(function (c) { seen[c.id] = 1; });
    return { cards: three, allin: allinFor(pl), wrapped: wrapped, total: all.length };
  }
  // an ALL IN trip that starts here or one hop away, and isn't in the trip yet
  function allinFor(pl) {
    var cur = lastPlace(pl), nat = P[cur].next || [], have = {};
    items().forEach(function (it) { if (it.kind === 'allin') have[it.trip] = 1; });
    var used = {}; pl.places.forEach(function (p) { used[p] = 1; });
    var list = MM.ALL_IN.filter(function (t) { return t.status === 'live' && !have[t.id]; }).map(function (t) {
      var first = t.stops[0].p, near = first === cur ? 0 : nat.indexOf(first) > -1 ? 1 : -1;
      var newPlaces = t.stops.filter(function (s) { return !used[s.p]; }).length;
      return near < 0 || (!newPlaces && t.stops.length > 1) ? null : { trip: t, near: near };
    }).filter(Boolean).sort(function (a, b) { return a.near - b.near || b.trip.days - a.trip.days; });
    return list[0] ? list[0].trip : null;
  }

  /* ============================================================
     THE MAP: the builder's own map, places to pick, and the route drawing itself
     ============================================================ */
  var CLABEL = { TH: [15.3, 101.0, 'Thailand'], LA: [19.9, 102.9, 'Laos'], VN: [16.2, 107.4, 'Vietnam'], KH: [12.8, 105.2, 'Cambodia'], ID: [-7.9, 113.2, 'Indonesia'], PH: [12.2, 122.6, 'Philippines'] };
  function proj(lat, lon) { var m = MM.MAP, k = m.w / (m.lon1 - m.lon0), mer = function (l) { return Math.log(Math.tan(Math.PI / 4 + l * Math.PI / 360)); }; return [(lon - m.lon0) * k, (mer(m.lat1) - mer(lat)) * k * 180 / Math.PI]; }
  function xy(id) { return proj(P[id].ll[0], P[id].ll[1]); }
  function el(name, attrs, parent) { var e = document.createElementNS(NS, name); for (var k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }

  function makeMap(box, opt) {
    opt = opt || {};
    var svg = el('svg', { viewBox: '0 0 1000 1127', preserveAspectRatio: 'xMidYMid slice', role: 'img', 'aria-label': opt.label || 'Map of your trip' });
    box.insertBefore(svg, box.firstChild);
    el('rect', { x: -2000, y: -2000, width: 5000, height: 5000, fill: '#0B231F' }, svg);
    var gLand = el('g', {}, svg), lands = {};
    Object.keys(MM.MAP.paths).forEach(function (c) { lands[c] = el('path', { d: MM.MAP.paths[c], 'class': 'land' + (c === 'other' ? ' land--other' : '') }, gLand); });
    var gDots = el('g', {}, svg), gLines = el('g', { 'aria-hidden': 'true' }, svg), gLab = el('g', { 'aria-hidden': 'true' }, svg), gPins = el('g', {}, svg), gHere = el('g', { 'aria-hidden': 'true' }, svg);
    var labels = Object.keys(CLABEL).map(function (c) { var p = proj(CLABEL[c][0], CLABEL[c][1]), g = el('g', { 'data-x': p[0], 'data-y': p[1], 'data-c': c }, gLab); el('text', { 'class': 'clabel', 'text-anchor': 'middle' }, g).textContent = CLABEL[c][2]; return g; });
    var dots = [];
    if (opt.dots) Object.keys(P).forEach(function (id) {
      var p = xy(id), g = el('g', { 'data-x': p[0], 'data-y': p[1], 'data-p': id }, gDots);
      el('circle', { r: 3.6, 'class': 'fdot' }, g); el('circle', { r: 15, 'class': 'fhit' }, g); dots.push(g);
    });
    var vb = { x: 0, y: 0, w: 1000, h: 1127 }, anim = 0, pins = [], here = null;
    function size() { var r = svg.getBoundingClientRect(); return { w: r.width || 360, h: r.height || 300 }; }
    function u2() { var s = size(); return Math.max(vb.w / s.w, vb.h / s.h); }   // map units per screen pixel
    function place(g) { g.setAttribute('transform', 'translate(' + g.getAttribute('data-x') + ' ' + g.getAttribute('data-y') + ') scale(' + u2().toFixed(4) + ')'); }
    // An option's name goes right of its pin, or left near the right edge or when the right is taken. It never sits on where you
    // are now, the names the route has drawn, another pin or another name; with no room either side it's left off (its card has it).
    function sides() {
      if (!pins.length) return;
      var k = u2(), sr = svg.getBoundingClientRect(), boxes = [];
      var at = function (g) { return [(+g.getAttribute('data-x') - vb.x) / k, (+g.getAttribute('data-y') - vb.y) / k]; };
      if (here) { var h0 = at(here); boxes.push([h0[0] - 16, h0[1] - 16, h0[0] + 16, h0[1] + 16]); }
      Array.prototype.forEach.call(svg.querySelectorAll('.rf-place'), function (g) {
        if (g.getAttribute('display') === 'none' || g.style.display === 'none') return;
        var r = g.getBoundingClientRect(); if (r.width) boxes.push([r.left - sr.left - 3, r.top - sr.top - 3, r.right - sr.left + 3, r.bottom - sr.top + 3]);
      });
      pins.forEach(function (g) { var p = at(g); boxes.push([p[0] - 13, p[1] - 13, p[0] + 13, p[1] + 13]); });
      var free = function (b) { return b[0] >= 2 && b[2] <= sr.width - 2 && !boxes.some(function (o) { return b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]; }); };
      pins.forEach(function (g) {
        var lb = g.querySelector('.lbl'); if (!lb) return;
        var p = at(g), w = lb.textContent.length * 7.4 + 8, x = +g.getAttribute('data-x');
        var right = [p[0] + 14, p[1] - 9, p[0] + 18 + w, p[1] + 9], left = [p[0] - 18 - w, p[1] - 9, p[0] - 14, p[1] + 9];
        var order = x > vb.x + vb.w * 0.66 ? [left, right] : [right, left], pick = free(order[0]) ? order[0] : free(order[1]) ? order[1] : null;
        if (!pick) { lb.style.display = 'none'; return; }
        lb.style.display = ''; lb.setAttribute('x', pick === left ? -18 : 18); lb.style.textAnchor = pick === left ? 'end' : 'start'; boxes.push(pick);
      });
    }
    function rescale() { labels.concat(dots, pins, here ? [here] : []).forEach(place); sides(); var k = u2(); $$('.cline', gLines).forEach(function (l) { l.setAttribute('stroke-width', (2 * k).toFixed(3)); l.setAttribute('stroke-dasharray', (5 * k).toFixed(2) + ' ' + (6 * k).toFixed(2)); }); }
    function setVB(v) { vb = v; svg.setAttribute('viewBox', v.x.toFixed(2) + ' ' + v.y.toFixed(2) + ' ' + v.w.toFixed(2) + ' ' + v.h.toFixed(2)); rescale(); }
    // frame these places, with room round them for pins and names
    function target(ids) {
      var pts = ids.map(xy), s = size(), x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      pts.forEach(function (p) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); });
      var L = 34, Rt = opt.padRight == null ? 104 : opt.padRight, Tp = 30, B = opt.padBottom || 30;          // room round the places for pins and names
      var minW = Math.max(170, Math.min(420, s.w * 0.42));                                    // never so close you lose where you are
      var k = Math.max((x1 - x0) / Math.max(60, s.w - L - Rt), (y1 - y0) / Math.max(60, s.h - Tp - B), minW / s.w);
      k = Math.min(k, 1800 / s.w);
      var W = s.w * k, H = s.h * k, cx = (x0 + x1) / 2 + (Rt - L) / 2 * k, cy = (y0 + y1) / 2 + (B - Tp) / 2 * k;
      return { x: cx - W / 2, y: cy - H / 2, w: W, h: H };
    }
    var lastIds = null;
    function fit(ids, ms, done) {
      lastIds = ids;
      if (anim) cancelAnimationFrame(anim);
      var to = target(ids), from = vb;
      if (REDUCED || !ms) { setVB(to); if (done) done(); return; }
      var t0 = 0;
      anim = requestAnimationFrame(function step(t) {
        if (!t0) t0 = t; var k = Math.min(1, (t - t0) / ms), e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        setVB({ x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e, w: from.w + (to.w - from.w) * e, h: from.h + (to.h - from.h) * e });
        if (k < 1) anim = requestAnimationFrame(step); else { anim = 0; if (done) done(); }
      });
    }
    function setHere(id) {
      gHere.textContent = ''; here = null; if (!id) return;
      var p = xy(id); here = el('g', { 'data-x': p[0], 'data-y': p[1] }, gHere); el('circle', { r: 10, 'class': 'here' }, here); place(here);
    }
    function setPins(cur, cards, allin, onPick) {
      gLines.textContent = ''; gPins.textContent = ''; pins = [];
      var a = cur ? xy(cur) : null;
      cards.forEach(function (c, i) {
        var p = xy(c.id);
        if (a) { var d = Film.arc(a, p, 0.16); el('path', { d: d.d, 'class': 'cline' }, gLines); }
        var g = el('g', { 'data-x': p[0], 'data-y': p[1], 'class': 'cpin', role: 'button', tabindex: '-1', 'aria-label': 'Go to ' + P[c.id].n }, gPins);
        el('circle', { r: 12, 'class': 'r' }, g); el('text', { y: 0.5 }, g).textContent = i + 1;
        var lb = el('text', { x: 18, y: 0.5, 'class': 'lbl' }, g); lb.textContent = P[c.id].n;
        g.addEventListener('click', function () { onPick(c.id); }); pins.push(g);
      });
      if (allin && allin.stops[0].p !== cur && !cards.some(function (c) { return c.id === allin.stops[0].p; })) {
        var q = xy(allin.stops[0].p), g2 = el('g', { 'data-x': q[0], 'data-y': q[1], 'class': 'cpin cpin--allin', role: 'button', tabindex: '-1' }, gPins);
        el('circle', { r: 12, 'class': 'r' }, g2); el('text', { y: 0.5 }, g2).textContent = cards.length + 1;
        el('text', { x: 18, y: 0.5, 'class': 'lbl' }, g2).textContent = 'ALL IN ' + allin.n;
        g2.addEventListener('click', function () { onPick('allin:' + allin.id); }); pins.push(g2);
      }
      rescale();
    }
    function tint(countries) {
      Object.keys(lands).forEach(function (c) { lands[c].style.fill = countries.indexOf(c) > -1 && TINT[c] ? TINT[c] : ''; lands[c].classList.add('lit'); });
      labels.forEach(function (g) { var c = g.getAttribute('data-c'); g.firstChild.style.stroke = countries.indexOf(c) > -1 && TINT[c] ? TINT[c] : '#E2E9DF'; });
    }
    function onDot(fn) { dots.forEach(function (g) { g.addEventListener('click', function () { fn(g.getAttribute('data-p')); }); }); }
    var rt = 0, was = '';
    var ro = window.ResizeObserver ? new ResizeObserver(function () {
      var s = size(), key = Math.round(s.w) + 'x' + Math.round(s.h); if (key === was) return; var first = !was; was = key;
      rescale(); if (first || !lastIds) return;
      clearTimeout(rt); rt = setTimeout(function () { fit(lastIds, 0, opt.onRefit); }, 120);       // the screen turned or the window changed: frame it again
    }) : null; if (ro) ro.observe(svg);
    return { svg: svg, lines: gLines, fit: fit, setPins: setPins, setHere: setHere, tint: tint, onDot: onDot, rescale: rescale, sides: sides, destroy: function () { if (ro) ro.disconnect(); if (anim) cancelAnimationFrame(anim); clearTimeout(rt); } };
  }

  /* ============================================================
     SCREEN 1: where does your trip start?
     ============================================================ */
  function viewStart() {
    var saved = savedTrip(), resume = '';
    if (saved) {
      var pl = null; try { pl = MM.plan(saved); } catch (e) { pl = null; }
      if (pl && pl.places.length) resume = '<button class="resume" data-act="resume"><span><b>Carry on with your trip</b><span>' + esc(pl.places.filter(function (p, i, a) { return a[i - 1] !== p; }).map(function (p) { return P[p].n; }).slice(0, 4).join(' → ')) + (pl.places.length > 4 ? ' …' : '') + ' · ' + pl.totals.days + ' days</span></span><span class="go">Open →</span></button>';
    }
    var tiles = GATES.map(function (g) {
      var img = photo(g[0]);
      return '<button class="tile' + (img ? '' : ' tile--noimg') + '" style="' + bg(img) + '" data-start="' + g[0] + '">' + (img ? '' : icon('scooter').replace('class="ico"', 'class="noimg-ico"')) + '<span class="tile__n">' + esc(g[1]) + '</span><span class="tile__c"><span class="cdot" style="--cc:' + CC[P[g[0]].c] + '"></span>' + esc(cname(P[g[0]].c)) + '</span></button>';
    }).join('');
    var others = Object.keys(P).filter(function (id) { return !GATES.some(function (g) { return g[0] === id; }); }).map(function (id) {
      return '<button class="chip" data-start="' + id + '"><span class="cdot" style="--cc:' + CC[P[id].c] + '"></span>' + esc(P[id].n) + '</button>';
    }).join('');
    var allins = MM.ALL_IN.filter(function (t) { return t.status === 'live'; }).map(function (t) {
      return '<button class="ai" data-startallin="' + t.id + '"><div class="ai__img" style="' + bg(tripPhoto(t)) + '"></div><div class="ai__b"><span class="ai__k">ALL IN · ' + t.days + ' days</span><span class="ai__n">' + esc(t.n) + '</span><span class="ai__r">' + esc(t.tag) + '</span><span class="ai__p">From ' + money(priceOf(t)) + ' · with a crew</span></div></button>';
    }).join('');
    V.innerHTML = '<section class="start">' + resume +
      '<h1 class="start__h">Where does your trip start?</h1><p class="start__sub">Pick where you land. Then build it one stop at a time.</p>' +
      '<div class="tiles">' + tiles + '</div>' +
      '<button class="link more" data-act="others" aria-expanded="false">Starting somewhere else?</button><div class="places" id="others">' + others + '</div>' +
      '<h2 class="allin-hd">Or start with <em>ALL IN</em></h2><p class="small">Trips we plan for you, with a crew of up to 20: beds, rides and the big days sorted. Add your own stops after.</p>' +
      '<div class="allins">' + allins + '</div>' +
      '<p class="small pro">Know exactly what you want? <button class="link" data-act="editor-blank">Open the full editor</button></p></section>';
  }

  /* ============================================================
     SCREEN 2: how long have you got?
     ============================================================ */
  function weeksHTML(sel) {
    // six answers in three rows of two: none sits on its own
    return '<div class="weeks">' + WEEKS.map(function (w) { return '<button class="week" data-weeks="' + w[0] + '"' + (sel === w[0] ? ' aria-pressed="true"' : '') + '>' + esc(w[1]) + (w[0] ? '<small>' + w[0] + ' days</small>' : '<small>Just build</small>') + '</button>'; }).join('') + '</div>';
  }
  function viewHowLong() {
    var st = pendingStart, img = st.kind === 'allin' ? tripPhoto(trip(st.trip)) : photo2(st.p);
    var label = st.kind === 'allin' ? 'ALL IN ' + trip(st.trip).n + ', nice.' : pname(st.p) + ' it is.';
    V.innerHTML = '<section class="howlong"><button class="back" data-act="tostart">‹ Back</button>' +
      '<div class="hl__photo" style="' + bg(img) + '"><span>' + esc(label) + '</span></div>' +
      '<h1>How long have you got?</h1><p>Rough is fine. We\'ll count the days as you go.</p>' + weeksHTML(-1) + '</section>';
  }

  /* ============================================================
     SCREEN 3: where next. Your trip so far, the map, and three places to go.
     ============================================================ */
  var G = null;   // the screen's parts while it's open
  function viewGame() {
    V.innerHTML = '<section class="game"><header class="bar"><div class="bar__row">' +
      '<button class="bar__logo" data-act="home" aria-label="Back to the start"><img src="' + LOGO + '" alt=""></button>' +
      '<button class="days" data-act="howlong" aria-label="Days on your trip"><span class="days__t" id="daysT"></span><span class="meter" id="meter"><i></i></span></button>' +
      '<button class="price" data-act="money" aria-label="What it costs"><b id="priceB">' + money(0) + '</b><span>each, so far</span></button></div>' +
      '<div class="strip" id="strip" role="list" aria-label="Your stops"></div></header>' +
      '<div class="stage"><div class="mapbox" id="gmap"><button class="skipchip" data-act="skip">Skip ›</button></div>' +
      '<div class="deck" id="deck"></div></div></section>';
    var box = $('#gmap'), map = makeMap(box, { dots: true, onRefit: function () { if (G && !G.film.playing) { G.film.set(filmStops(plan()), 'none'); G.map.sides(); } } });
    var film = Film(map.svg, [], { autoplay: false, controls: false, labels: true, dots: true, keep: true, under: map.lines,
      onStart: function () { box.classList.add('playing'); }, onEnd: function () { box.classList.remove('playing'); var f = G && G.after; if (G) G.after = null; if (f) f(); } });
    G = { map: map, film: film, box: box, deck: $('#deck'), after: null, price: 0, cards: [] };
    map.onDot(function (id) { tapPlace(id); });
    var pl = plan();
    film.set(filmStops(pl), 'none');
    refresh(pl, { first: true });
  }
  // everything on the screen from the plan; how: { added: true } after a stop is added
  function refresh(pl, how) {
    how = how || {};
    if (!G) return;
    if (!pl || !pl.places.length) return nav('');
    bar(pl, how.added);
    strip(pl, how.added);
    G.map.tint(countriesIn(pl));
    var cur = lastPlace(pl);
    if (how.added && !REDUCED) {
      // the new part of the route draws itself, then the next choices come in
      G.deck.classList.add('deck--wait');
      var prev = how.prev || cur, ids = [prev].concat(pl.places.slice(how.fromIdx || 0)).filter(function (x, i, a) { return a.indexOf(x) === i; });
      G.map.setPins(null, [], null); G.map.setHere(null);
      G.map.fit(ids, 650, function () {
        G.after = function () { nextDeck(pl, how); };
        if (!G.film.set(filmStops(pl), 'auto')) { var f = G.after; G.after = null; f(); }
      });
    } else {
      G.film.set(filmStops(pl), 'none');
      nextDeck(pl, how);
    }
  }
  function nextDeck(pl, how) {
    if (!G) return;
    var d = deckFor(pl, how.shuffle), cur = lastPlace(pl);
    G.cards = d.cards; G.allin = d.allin;
    d.cards.forEach(function (c) { var im = new Image(); im.src = photo2(c.id); var a = topActs(c.id).list[0]; if (a) { var im2 = new Image(); im2.src = actPhoto(a, 0) || ''; } });
    var all = items(), lastItem = all[all.length - 1], fromAllIn = lastItem && lastItem.kind === 'allin';
    var h = '<div class="deck__hd"><div><p class="over">' + (fromAllIn ? 'After ALL IN ' + esc(trip(lastItem.trip).n) : 'Where next?') + '</p><h2>From ' + esc(P[cur].n) + '</h2></div>' +
      (d.total > 3 ? '<button class="shuffle" data-act="shuffle"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5V2L8 6l4 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z"/></svg>More places</button>' : '') + '</div>';
    h += '<div class="cards">' + d.cards.map(function (c, i) { return card(c, i); }).join('') + '</div>';
    if (d.allin) h += '<p class="deck__or">or let us plan the next bit</p><div class="cards">' + allinCard(d.allin, d.cards.length, cur) + '</div>';
    h += '<div class="deck__ft">' + (all.length > 1 || fromAllIn ? '<button class="btn btn--ghost btn--block" data-act="finish">That\'s my trip. Show me!</button>' : '') + '</div>' +
      '<p class="hint">Can\'t decide? <button class="link" data-act="surprise" style="font-size:13px;padding:6px 0">Surprise me</button> · or tap any place on the map.</p>' +
      '<p class="hint pro">Want every detail? <button class="link" data-act="editor" style="font-size:13px;padding:6px 0">Open the full editor</button></p>';
    G.deck.innerHTML = h;
    G.deck.classList.remove('deck--wait');
    G.map.setHere(cur);
    G.map.setPins(cur, d.cards, d.allin, function (id) { id.indexOf('allin:') === 0 ? openAllIn(id.slice(6)) : openPick(id); });
    G.map.fit([cur].concat(d.cards.map(function (c) { return c.id; }), d.allin ? [d.allin.stops[0].p] : []), how.first || REDUCED ? 0 : 650, function () { if (G && !G.film.playing) { G.film.set(filmStops(pl), 'none'); G.map.sides(); } });
    if (how.added) celebrate(pl, how);
    if (how.shuffle && d.wrapped) toast('That\'s every place we go from here. Round again!');
  }
  function card(c, i) {
    var p = P[c.id], img = photo(c.id);
    return '<button class="card" data-pick="' + c.id + '"><span class="card__img' + (img ? '' : ' card__img--none') + '" style="' + bg(img) + '">' + (img ? '' : icon('scooter').replace('class="ico"', 'class="noimg-ico"')) + '<span class="card__num">' + (i + 1) + '</span></span>' +
      '<span class="card__b"><span class="kind" style="--k:' + (c.label || c.kind).c + '">' + esc((c.label || c.kind).n) + '</span>' +
      '<span class="card__n">' + esc(p.n) + '<small>' + esc(cname(p.c)) + '</small></span>' +
      '<span class="card__h">' + esc(hook(c.id)) + '</span>' +
      '<span class="card__m"><span>' + icon(c.ride.main) + esc(rideLine(c.ride)) + '</span><span>' + (p.partner ? 'Partner hostel from ' : 'Beds from ') + money(p.bed) + '</span></span></span>' +
      (c.badge ? '<span class="badge">' + esc(c.badge) + '</span>' : '') + '</button>';
  }
  function allinCard(t, i, cur) {
    var first = t.stops[0].p, o = first !== cur ? MM.legOptions(cur, first)[0] : null;
    return '<button class="card card--allin" data-allin="' + t.id + '"><span class="card__img" style="' + bg(tripPhoto(t)) + '"><span class="card__num">' + (i + 1) + '</span></span>' +
      '<span class="card__b"><span class="kind" style="--k:#FF6A4D">ALL IN · ' + t.days + ' days</span>' +
      '<span class="card__n">' + esc(t.n) + '</span><span class="card__h">' + esc(t.tag) + '</span>' +
      '<span class="card__m"><span>From ' + money(priceOf(t)) + ' with a crew</span>' + (o ? '<span>' + icon(o.main) + esc(hrs(o.h)) + ' to ' + esc(P[first].n) + '</span>' : '<span>Starts here</span>') + '</span></span></button>';
  }
  // Days count the way every Mad Monkey trip does (14 days is 13 nights: you leave on day 14), so the bar says how far the plan
  // reaches: 3 nights in Bangkok takes you to day 4, when you move on. The trip page and its day by day count the same way.
  function bar(pl, animate) {
    var days = pl.totals.days, t = S.target, over = t && days > t;
    var end = endDate(pl), on = end ? '<span class="days__d"> · ' + esc(fmtDay(end)) + '</span>' : '';       // with a date: the day it reaches
    $('#daysT').innerHTML = (t ? '<b>Day ' + days + '</b> of ' + t + (over ? ' · ' + (days - t) + ' over' : '') : 'Up to <b>day ' + days + '</b>') + on;
    var m = $('#meter'); m.classList.toggle('over', !!over); m.style.visibility = t ? '' : 'hidden';
    m.firstChild.style.width = t ? Math.min(100, days / t * 100) + '%' : '0';
    countTo($('#priceB'), G.price, pl.totals.total, animate ? 1400 : 0); G.price = pl.totals.total;
  }
  function countTo(node, from, to, ms) {
    if (REDUCED || !ms || from === to) { node.textContent = money(to); return; }
    var t0 = 0; requestAnimationFrame(function step(t) { if (!t0) t0 = t; var k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3); node.textContent = money(from + (to - from) * e); if (k < 1) requestAnimationFrame(step); });
  }
  function strip(pl, added) {
    var h = '', legs = pl.legs;
    pl.segs.forEach(function (sg, i) {
      if (i > 0) { var L = legs.filter(function (l) { return l.index === i - 1; })[0]; if (L && L.chosen) h += '<span class="ride" aria-hidden="true">' + icon(L.chosen.main) + esc(hrs(L.chosen.h)) + '</span>'; }
      var isNew = added && i === pl.segs.length - 1;
      if (sg.kind === 'stop') h += '<button class="stop' + (isNew ? ' stop--new' : '') + '" role="listitem" data-edit="' + i + '"><span class="cdot" style="--cc:' + CC[P[sg.p].c] + '"></span>' + esc(P[sg.p].n) + '<i>' + sg.n + (sg.n === 1 ? ' night' : ' nights') + '</i></button>';
      else h += '<button class="stop stop--allin' + (isNew ? ' stop--new' : '') + '" role="listitem" data-edit="' + i + '"><span class="cdot" style="--cc:#FF6A4D"></span>ALL IN ' + esc(sg.trip.n) + '<i>' + sg.trip.days + ' days</i></button>';
    });
    var s = $('#strip'); s.innerHTML = h; s.scrollLeft = s.scrollWidth;
  }

  /* ---------- little moments ---------- */
  function celebrate(pl, how) {
    var now = countriesIn(pl), before = how.countries || [];
    var fresh = now.filter(function (c) { return before.indexOf(c) < 0; });
    if (fresh.length && before.length) toast('<span class="cdot" style="--cc:' + CC[fresh[0]] + '"></span>Hello, ' + esc(cname(fresh[0])) + '!');
    if (S.target && pl.totals.days >= S.target && !S.full) { S.full = true; saveX(); setTimeout(function () { openFull(pl); }, REDUCED ? 0 : 500); }
  }
  function toast(html, undo) {
    if (!toasts) return;
    var t = document.createElement('div'); t.className = 'toast'; t.innerHTML = '<span>' + html + '</span>' + (undo ? '<button>Undo</button>' : '');
    if (undo) t.querySelector('button').addEventListener('click', function () { t.remove(); undo(); });
    toasts.appendChild(t); while (toasts.children.length > 2) toasts.removeChild(toasts.firstChild);
    setTimeout(function () { if (t.parentNode) t.remove(); }, undo ? 5200 : 2600);
  }

  /* ============================================================
     SHEETS: pick nights and things to do, an ALL IN trip, change a stop, the money, hold my beds
     ============================================================ */
  var openSheet = null;
  function sheet(html, onWire, label) {
    closeSheet(true);
    var wrap = document.createElement('div');
    wrap.innerHTML = '<div class="scrim"></div><div class="sheet" role="dialog" aria-modal="true"' + (label ? ' aria-label="' + esc(label) + '"' : '') + '>' + html + '</div>';
    sheets.appendChild(wrap);
    var sc = wrap.firstChild, sh = wrap.lastChild;
    requestAnimationFrame(function () { requestAnimationFrame(function () { sc.classList.add('on'); sh.classList.add('on'); }); });
    sc.addEventListener('click', function () { closeSheet(); });
    openSheet = { wrap: wrap, sheet: sh, last: R.activeElement }; toasts.classList.add('up');
    if (onWire) onWire(sh);
    var f = sh.querySelector('[data-focus]') || sh.querySelector('button'); if (f) setTimeout(function () { try { f.focus({ preventScroll: true }); } catch (e) { f.focus(); } }, 60);
    return sh;
  }
  function closeSheet(now) {
    if (!openSheet) return; var o = openSheet; openSheet = null; if (toasts) toasts.classList.remove('up');
    if (now || REDUCED) { o.wrap.remove(); return; }
    o.wrap.firstChild.classList.remove('on'); o.sheet.classList.remove('on');
    setTimeout(function () { o.wrap.remove(); }, 320);
    if (o.last && o.last.focus && o.last.isConnected) try { o.last.focus({ preventScroll: true }); } catch (e) { /* gone */ }
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && openSheet) closeSheet(); });

  function topActs(id) {
    var dm = MM.dontMiss(id), acts = MM.actsAt(id).slice();
    acts.sort(function (a, b) { return (b.star ? 1 : 0) - (a.star ? 1 : 0) || (b.slug ? 1 : 0) - (a.slug ? 1 : 0) || (a.usd == null ? 999 : a.usd) - (b.usd == null ? 999 : b.usd); });
    if (dm) acts = [dm.act].concat(acts.filter(function (a) { return a.id !== dm.act.id; }));
    return { list: acts, pitch: dm ? dm.pitch : '' };
  }
  function actRow(a, on, pitch, i) {
    var price = a.usd == null ? 'Pay on the day' : (a.est ? '~' : '') + money(a.usd), days = a.multi && a.multi.d > 1 ? ' · ' + a.multi.d + ' days' : '', img = actPhoto(a, i);
    return '<button class="act' + (on ? ' on' : '') + '" data-act-id="' + esc(a.id) + '" aria-pressed="' + (on ? 'true' : 'false') + '">' + (img ? '<span class="act__img" style="' + bg(img) + '"></span>' : '<span class="act__img act__img--none">' + icon(a.cat === 'night' ? 'boat' : 'scooter').replace('class="ico"', 'class="noimg-ico"') + '</span>') +
      '<span class="act__t"><b>' + esc(a.n) + '</b><span>' + (pitch ? '<em>' + esc(pitch) + '</em><br>' : '') + esc(price + days) + (a.when ? ' · ' + esc(a.when) : '') + '</span></span><span class="act__ck" aria-hidden="true">' + (on ? '✓' : '+') + '</span></button>';
  }
  // pick a place: how many nights, and the things not to miss
  function openPick(id, opts) {
    opts = opts || {};
    var pl = opts.first ? null : plan(), cur = lastPlace(pl), o = !opts.first && cur ? MM.legOptions(cur, id)[0] : null, p = P[id];
    var nights = p.sug || 3, min = 1, chosen = {}, Acts = topActs(id), showAll = false;
    var ride = o ? '<div class="sh__ride">' + icon(o.main) + '<span><b>' + esc(hrs(o.h)) + ' ' + esc(modeWord(o)) + '</b> from ' + esc(P[cur].n) + ', about ' + money(o.u) + (o.ovn ? '. It covers a night, so that\'s one less bed to pay for' : '') + '</span></div>' : '';
    function body() {
      var acts = Acts.list.slice(0, showAll ? 12 : 3);
      return '<div class="sh__photo" style="' + bg(photo2(id)) + '"><button class="sh__x" data-close aria-label="Close">×</button><div><p class="over" style="color:' + CC[p.c] + '">' + esc(cname(p.c)) + '</p><h2>' + esc(p.n) + '</h2><p>' + esc(p.hook) + '</p></div></div>' +
        '<div class="sh__b">' + (opts.surprise ? '<p class="over" style="color:var(--amber);margin-bottom:8px">Surprise! How about this?</p>' : '') + ride + '<p class="over">How many nights?</p>' +
        '<div class="stepper"><button data-n="-1" aria-label="One night less">−</button><output aria-live="polite">' + nights + '<small>' + (nights === 1 ? 'night' : 'nights') + ' · beds ~' + money(p.bed * nights) + '</small></output><button data-n="1" aria-label="One more night">+</button></div>' +
        '<p class="small">Most people stay ' + p.sug + '. ' + esc(p.note || '') + '</p>' +
        (Acts.list.length ? '<p class="over" style="margin-top:18px">Don\'t miss</p><div class="acts">' + acts.map(function (a, i) { return actRow(a, chosen[a.id], i === 0 && Acts.pitch && a.id === (MM.dontMiss(id) || { act: {} }).act.id ? Acts.pitch : '', i); }).join('') + '</div>' +
          (Acts.list.length > 3 && !showAll ? '<button class="link" data-more>See all ' + Acts.list.length + ' things to do</button>' : '') : '') +
        '<div class="sh__ft"><button class="btn btn--go btn--block" data-go data-focus>' + (opts.first ? 'Start in ' : 'Go to ') + esc(p.n) + '</button></div></div>';
    }
    var sh = sheet(body(), wire, p.n);
    function wire(s) {
      s.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        if (b.hasAttribute('data-close')) return closeSheet();
        if (b.hasAttribute('data-n')) { nights = Math.max(min, Math.min(14, nights + +b.getAttribute('data-n'))); return redraw(); }
        if (b.hasAttribute('data-act-id')) { var k = b.getAttribute('data-act-id'); chosen[k] = !chosen[k]; return redraw(); }
        if (b.hasAttribute('data-more')) { showAll = true; return redraw(); }
        if (b.hasAttribute('data-go')) {
          var stop = MM.edit.newStop(id, nights); stop.acts = Object.keys(chosen).filter(function (k) { return chosen[k]; });
          u.track('start_add', { place: id, n: nights, first: !!opts.first });
          if (opts.first) { newTrip(stop, pendingTarget); pendingStart = null; closeSheet(true); nav('next'); return; }
          var before = plan(), prev = lastPlace(before);
          hist.push(JSON.stringify(items()));
          items().push(stop); save(); closeSheet();
          refresh(plan(), { added: true, prev: prev, fromIdx: before ? before.places.length : 0, countries: countriesIn(before) });
          toast(esc(p.n) + ' added', undo);
        }
      });
    }
    function redraw() { var y = sh.scrollTop; sh.innerHTML = body(); sh.scrollTop = y; }
  }
  function undo() {
    if (!hist.length) return;
    A.state.items = JSON.parse(hist.pop()); S.full = false; save();
    if (!items().length) return nav('');
    refresh(plan(), {});
  }
  // an ALL IN trip: what it is, then add it
  function openAllIn(id, opts) {
    opts = opts || {};
    var t = trip(id), pl = opts.first ? null : plan(), cur = lastPlace(pl), first = t.stops[0].p, o = cur && first !== cur ? MM.legOptions(cur, first)[0] : null;
    sheet('<div class="sh__photo" style="' + bg(tripPhoto(t)) + '"><button class="sh__x" data-close aria-label="Close">×</button><div><p class="over" style="color:var(--coral)">ALL IN · ' + t.days + ' days</p><h2>' + esc(t.n) + '</h2><p>' + (t.kicker ? '<b>' + esc(t.kicker) + '.</b> ' : '') + esc(t.tag) + '</p></div></div>' +
      '<div class="sh__b">' + (o ? '<div class="sh__ride">' + icon(o.main) + '<span><b>' + esc(hrs(o.h)) + ' ' + esc(modeWord(o)) + '</b> to ' + esc(P[first].n) + ' to join it, about ' + money(o.u) + '</span></div>' : '') +
      '<p style="font-size:15.5px;line-height:1.5;margin-bottom:12px">' + esc(t.pitch) + '</p>' +
      '<p class="over">What\'s in it</p><ul class="incl">' + MM.INCLUDED.slice(0, 6).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + (t.meals ? '<li>Meals: ' + esc(t.meals) + '</li>' : '') + '</ul>' +
      '<div class="tprice"><b style="font-size:38px">' + money(priceOf(t)) + '</b><span>each, for all ' + t.days + ' days</span></div>' +
      '<p class="small" style="margin-top:6px">Leaves every ' + (DAYNAME[t.dep] || 'week') + '. A $' + MM.DEPOSIT + ' deposit holds your spot once the crew has checked your trip.</p>' +
      '<div class="sh__ft"><button class="btn btn--go btn--block" data-go data-focus>' + (opts.first ? 'Start with ' : 'Add ') + 'ALL IN ' + esc(t.n) + '</button></div></div>', function (s) {
      s.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        if (b.hasAttribute('data-close')) return closeSheet();
        if (b.hasAttribute('data-go')) {
          u.track('start_add', { allin: id });
          var before = plan(), prev = lastPlace(before);
          hist.push(JSON.stringify(items())); items().push({ kind: 'allin', trip: id }); save(); closeSheet();
          refresh(plan(), { added: true, prev: prev, fromIdx: before ? before.places.length : 0, countries: countriesIn(before) });
          toast('ALL IN ' + esc(t.n) + ' added', undo);
        }
      });
    }, 'ALL IN ' + t.n);
  }
  // change a stop you already have
  function openEdit(i) {
    var it = items()[i]; if (!it) return;
    if (it.kind === 'allin') {
      var t = trip(it.trip);
      return sheet('<div class="sh__photo" style="' + bg(tripPhoto(t)) + '"><button class="sh__x" data-close aria-label="Close">×</button><div><p class="over" style="color:var(--coral)">ALL IN · ' + t.days + ' days</p><h2>' + esc(t.n) + '</h2><p>' + esc(t.tag) + '</p></div></div>' +
        '<div class="sh__b"><p style="font-size:15px;line-height:1.5">' + esc(t.pitch) + '</p><div class="sh__ft"><button class="btn btn--go btn--block" data-close data-focus>Keep it</button><button class="link link--out" data-remove>Take it out of my trip</button></div></div>', function (s) { wireEdit(s, i); }, 'ALL IN ' + t.n);
    }
    var p = P[it.p], Acts = topActs(it.p), chosen = {}; (it.acts || []).forEach(function (k) { chosen[k] = true; });
    function body() {
      var shown = Acts.list.filter(function (a, j) { return j < 3 || chosen[a.id]; });
      return '<div class="sh__photo" style="' + bg(photo2(it.p)) + '"><button class="sh__x" data-close aria-label="Close">×</button><div><p class="over" style="color:' + CC[p.c] + '">' + esc(cname(p.c)) + '</p><h2>' + esc(p.n) + '</h2><p>' + esc(p.hook) + '</p></div></div>' +
        '<div class="sh__b"><p class="over">Nights</p><div class="stepper"><button data-n="-1" aria-label="One night less">−</button><output aria-live="polite">' + it.n + '<small>' + (it.n === 1 ? 'night' : 'nights') + '</small></output><button data-n="1" aria-label="One more night">+</button></div>' +
        (Acts.list.length ? '<p class="over" style="margin-top:16px">Things to do</p><div class="acts">' + shown.map(function (a, j) { return actRow(a, chosen[a.id], '', j); }).join('') + '</div>' : '') +
        '<div class="sh__ft"><button class="btn btn--go btn--block" data-close data-focus>Done</button><button class="link link--out" data-remove>Take ' + esc(p.n) + ' out of my trip</button></div></div>';
    }
    var sh = sheet(body(), function (s) { wireEdit(s, i, function () { var y = sh.scrollTop; sh.innerHTML = body(); sh.scrollTop = y; }, chosen); }, p.n);
  }
  function wireEdit(s, i, redraw, chosen) {
    var it = items()[i];
    s.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-remove')) {
        hist.push(JSON.stringify(items())); var name = it.kind === 'allin' ? 'ALL IN ' + trip(it.trip).n : P[it.p].n;
        items().splice(i, 1); S.full = false; save(); closeSheet();
        if (!items().length) { nav(''); return; }
        refresh(plan(), {}); toast(esc(name) + ' taken out', undo); return;
      }
      if (b.hasAttribute('data-close')) { closeSheet(); return; }
      if (b.hasAttribute('data-n')) { hist.push(JSON.stringify(items())); it.n = Math.max(1, Math.min(14, it.n + +b.getAttribute('data-n'))); save(); redraw(); refresh(plan(), {}); return; }
      if (b.hasAttribute('data-act-id')) { var k = b.getAttribute('data-act-id'); chosen[k] = !chosen[k]; it.acts = Object.keys(chosen).filter(function (x) { return chosen[x]; }); save(); redraw(); refresh(plan(), {}); }
    });
  }
  function openMoney() {
    var pl = plan(); if (!pl) return; var T = pl.totals;
    var rows = [['Beds at Mad Monkey', T.beds], ['Getting around', T.transport], ['Things to do', T.acts], ['ALL IN trips', T.allin], ['Food and fun (' + money(A.state.fund) + ' a day)', T.fund]].filter(function (r) { return r[1] > 0; });
    sheet('<div class="sh__b" style="padding-top:22px"><button class="sh__x" data-close aria-label="Close" style="background:var(--canopy-2)">×</button><h2>What it costs</h2><p class="small">Each, for ' + T.days + ' days. Estimates from today\'s prices: the crew confirms the real price before you pay a thing.</p>' +
      '<div class="lines">' + rows.map(function (r) { return '<div><span>' + esc(r[0]) + '</span><b>' + money(r[1]) + '</b></div>'; }).join('') + '<div class="tot"><span>About</span><span>' + money(T.total) + '</span></div></div>' +
      (T.flights ? '<p class="small">Plus about ' + money(T.flights) + ' in flights between stops, which you book yourself.</p>' : '') +
      '<div class="sh__ft"><button class="btn btn--go btn--block" data-close data-focus>Got it</button></div></div>', function (s) { s.addEventListener('click', function (e) { if (e.target.closest('[data-close]')) closeSheet(); }); }, 'What it costs');
  }
  function openWeeks() {
    sheet('<div class="sh__b" style="padding-top:22px"><button class="sh__x" data-close aria-label="Close" style="background:var(--canopy-2)">×</button><h2>How long have you got?</h2><p class="small" style="margin-bottom:14px">The bar at the top fills up as you go.</p>' + weeksHTML(S.target) + '</div>', function (s) {
      s.addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; if (b.hasAttribute('data-close')) return closeSheet(); if (b.hasAttribute('data-weeks')) { S.target = +b.getAttribute('data-weeks'); S.full = false; saveX(); closeSheet(); if (G) bar(plan(), false); } });
    }, 'How long have you got?');
  }
  function openFull(pl) {
    sheet('<div class="sh__b" style="padding-top:26px;text-align:center"><p class="big" aria-hidden="true">🎉</p><h2>That\'s your ' + esc(WEEKS.filter(function (w) { return w[0] === S.target; }).map(function (w) { return w[1].toLowerCase(); })[0] || S.target + ' days') + '!</h2>' +
      '<p class="small" style="margin:8px auto 4px;max-width:30ch">' + pl.totals.days + ' days, ' + countriesIn(pl).length + (countriesIn(pl).length === 1 ? ' country' : ' countries') + ', about ' + money(pl.totals.total) + ' each. Want to see it?</p>' +
      '<div class="sh__ft"><button class="btn btn--go btn--block" data-finish data-focus>Show me my trip</button><button class="btn btn--ghost btn--block" data-close>Keep going</button></div></div>', function (s) {
      s.addEventListener('click', function (e) { if (e.target.closest('[data-finish]')) { closeSheet(true); nav('trip'); } else if (e.target.closest('[data-close]')) closeSheet(); });
    }, 'Your trip is full');
  }
  function tapPlace(id) {
    var pl = plan(); if (!pl) return;
    if (pl.places.indexOf(id) > -1) { var segI = -1; pl.segs.forEach(function (sg, i) { if ((sg.kind === 'stop' && sg.p === id) || (sg.kind === 'allin' && sg.trip.stops.some(function (s) { return s.p === id; }))) segI = i; }); if (segI > -1) openEdit(segI); return; }
    var o = MM.legOptions(lastPlace(pl), id)[0]; if (!o) return toast('No easy way to ' + esc(P[id].n) + ' from here');
    openPick(id);
  }

  /* ============================================================
     SCREEN 4: your trip. The whole route, then hold your beds.
     ============================================================ */
  var T = null;
  function viewTrip() {
    var pl = plan(); if (!pl || !pl.places.length) return nav('');
    var tot = pl.totals, cs = countriesIn(pl), stops = pl.segs.length, st = A.state;
    var start = st.start ? MM.util.parseDate(st.start) : null, h = '';
    // each stop's days from the engine's own day by day (pl.days): it counts every night, on a sleeper bus, on a multi-day tour, and the
    // free night before an ALL IN trip, so the day by day ends on the same day the trip page counts to
    pl.segs.forEach(function (sg, i) {
      var ds = pl.days.filter(function (d) { return d.si === i && d.kind !== 'move'; }), from = ds.length ? ds[0].n : 1, to = ds.length ? ds[ds.length - 1].n + 1 : from;
      var when = start ? MM.util.fmtDate(MM.util.addDays(start, from - 1)) + ' to ' + MM.util.fmtDate(MM.util.addDays(start, to - 1)) : 'Day ' + from + ' to ' + to;
      if (sg.kind === 'stop') {
        var acts = (sg.acts || []).map(function (a) { return a.n; });
        h += '<li><span class="tl__d">' + esc(when) + '</span><span class="tl__n">' + esc(P[sg.p].n) + '</span><span class="tl__x">' + sg.n + (sg.n === 1 ? ' night' : ' nights') + (P[sg.p].partner ? ' at a partner hostel' : ' at Mad Monkey') + (acts.length ? ' · ' + esc(acts.join(', ')) : '') + '</span>';
      } else {
        h += '<li class="tl--allin"><span class="tl__d">' + esc(when) + '</span><span class="tl__n">ALL IN ' + esc(sg.trip.n) + '</span><span class="tl__x">' + esc(sg.trip.tag) + '. Planned for you, with a crew.' + (sg.pre ? ' You get there the day before it leaves, and that night is on us.' : '') + '</span>';
      }
      var L = pl.legs.filter(function (l) { return l.index === i; })[0];
      if (L && L.chosen && i < pl.segs.length - 1) h += '<span class="tl__ride">' + icon(L.chosen.main) + esc(hrs(L.chosen.h)) + ' ' + esc(modeWord(L.chosen)) + ' to ' + esc(P[L.to] ? P[L.to].n : L.to) + ', ~' + money(L.chosen.u) + '</span>';
      h += '</li>';
    });
    var end = endDate(pl), fin = lastPlace(pl), day = pl.days.length ? pl.days[pl.days.length - 1].n : tot.days;     // the last day: you check out and move on
    h += '<li class="tl--end"><span class="tl__d">' + esc(end ? MM.util.fmtDate(end) : 'Day ' + day) + '</span><span class="tl__n">Your trip ends</span><span class="tl__x">Day ' + day + ', in ' + esc(P[fin].n) + '. Check out, then head home or keep going. Flights aren\'t included: the crew suggests the right one.</span></li>';
    V.innerHTML = '<section class="trip"><div class="trip__top"><button class="back" data-act="keep">‹ Keep building</button><button class="link pro" data-act="editor" style="font-size:14px">Every detail: full editor</button></div>' +
      '<div class="tmap" id="tmap"></div>' +
      '<div class="trip__b"><p class="over">Your trip</p><h1>' + tot.days + ' days · ' + cs.length + (cs.length === 1 ? ' country' : ' countries') + ' · ' + stops + (stops === 1 ? ' stop' : ' stops') + '</h1>' +
      '<p class="tdates">' + (dateRange(pl) ? esc(dateRange(pl)) : 'Pick when you go (below) to see the day it finishes.') + '</p>' +
      vibeBar(pl) +
      '<div class="tprice"><b>' + money(tot.total) + '</b><span>each, about</span></div>' +
      '<p class="small" style="margin-top:8px">Beds, rides, the things you picked and ' + money(st.fund) + ' a day for food and fun' + (tot.flights ? ', plus about ' + money(tot.flights) + ' in flights' : '') + '. <button class="link" data-act="money" style="padding:0;font-size:13px">What\'s in it</button></p>' +
      '<div class="field"><label for="when">When do you go?</label><input type="date" id="when" value="' + esc(st.start) + '" min="' + MM.util.isoDate(new Date()) + '"></div>' +
      '<ol class="tl">' + h + '</ol>' +
      '<div class="who"><p class="over">Who\'s coming?</p><div class="seg" role="group" aria-label="Who\'s coming"><button data-who="solo" aria-pressed="' + (S.who === 'solo') + '">Just me</button><button data-who="friends" aria-pressed="' + (S.who === 'friends') + '">With friends</button></div>' +
      (S.who === 'solo' ? '<label class="check"><input type="checkbox" id="crew"' + (S.crew ? ' checked' : '') + '><span><b>Find me a crew going my way.</b> We\'ll introduce you to people on the same route at the same time. Never solo for long.</span></label>'
        : '<div class="mini"><button data-mates="-1" aria-label="One fewer">−</button><output>' + S.mates + '</output><button data-mates="1" aria-label="One more">+</button><span class="small">of you</span></div><p class="small">Everyone gets the same trip and pays their own share.</p>') + '</div>' +
      '<div class="cta"><button class="btn btn--go btn--block" data-act="hold">Hold my beds, it\'s free</button><p class="small center">Ewan and the crew check every stop and ride first. You pay nothing until you say yes.</p>' +
      '<button class="btn btn--ghost btn--block" data-act="copy">Copy my trip to send to friends</button>' +
      '<p class="small center">Want to change a ride, a date or a tour? <button class="link" data-act="editor" style="padding:0;font-size:13px">Open the full editor</button></p></div></div></section>';
    var box = $('#tmap'), map = makeMap(box, { label: 'Your whole route', padRight: 70, padBottom: 70, onRefit: function () { if (T && !T.film.playing) T.film.set(filmStops(plan()), 'none'); } });
    map.tint(cs);
    map.fit(pl.places, 0);
    var film = Film(map.svg, filmStops(pl), { autoplay: 'view', loop: true, hold: 4500, controls: true, labels: true, dots: true, keep: true, numbers: false });
    T = { map: map, film: film };
  }
  // what the trip feels like: each stop's nights shared out across what it is (what defines it counts double). Every colour gets its name.
  function vibeBar(pl) {
    var v = {}, all = 0;
    function add(id, n) { var ks = kindsOf(id); ks.forEach(function (k, i) { var w = n * (i === 0 ? 2 : 1) / (ks.length + 1); v[k.k] = (v[k.k] || 0) + w; all += w; }); }
    pl.segs.forEach(function (sg) { if (sg.kind === 'stop') add(sg.p, sg.n); else sg.trip.stops.forEach(function (stp) { if (P[stp.p]) add(stp.p, stp.n || 2); }); });
    if (!all) return '';
    var list = KINDS.filter(function (k) { return v[k.k]; }).map(function (k) { return { k: k, p: v[k.k] / all }; }).sort(function (a, b) { return b.p - a.p; });
    // whole percentages that add up to 100, so every part shows a number
    var pct = list.map(function (x) { return Math.floor(x.p * 100); }), left = 100 - pct.reduce(function (s, x) { return s + x; }, 0);
    list.map(function (x, i) { return { i: i, r: x.p * 100 - pct[i] }; }).sort(function (a, b) { return b.r - a.r; }).slice(0, left).forEach(function (x) { pct[x.i]++; });
    return '<div class="vibe"><p class="over">Your trip\'s vibe</p><div class="vibe__bar" aria-hidden="true">' + list.map(function (x) { return '<i style="flex:' + x.p.toFixed(3) + ';background:' + x.k.c + '"></i>'; }).join('') + '</div>' +
      '<p class="vibe__k">' + list.map(function (x, i) { return '<span><span class="cdot" style="--cc:' + x.k.c + '"></span>' + esc(x.k.n) + ' ' + Math.max(1, pct[i]) + '%</span>'; }).join('') + '</p></div>';
  }

  /* ---------- hold my beds: the trip goes to the crew (the same request as the editor's form) ---------- */
  // What they told the ALL IN site, and the ALL IN free night: the same helpers as the editor's form (ui-review.js), so both ask and send alike.
  function told() { return A.review && A.review.told ? A.review.told() : null; }
  function freeNightOf() { return A.review && A.review.freeNight ? A.review.freeNight.of(people()) : null; }
  function openHold() {
    var pl = plan(); if (!pl || !pl.places.length) return;
    u.track('start_hold_open', { days: pl.totals.days });
    var q = u.store('mm-lead') || {}, FN = A.review.freeNight, fn = freeNightOf(), pick = '', tw = told(), leaveTold = false,
      dep = +C.DEPOSIT_PER_PERSON > 0, live = !!C.LEAD_ENDPOINT, n = people(), cs = countriesIn(pl), form = {};
    var whoLine = S.who === 'friends' ? n + ' of you, everyone paying their own share' : S.crew ? 'Just you, and find you a crew going your way' : 'Just you';
    var X = '<button class="sh__x" data-close aria-label="Close" style="background:var(--canopy-2)">×</button>';
    // step 1, whenever there's an ALL IN trip in it: the free bed the night before, yes or no (it comes with every ALL IN trip)
    function stepFree() {
      return '<div class="sh__b" style="padding-top:22px">' + X + '<p class="over">ALL IN ' + esc(fn.trip.n) + ' comes with it</p>' +
        '<h2 style="margin:8px 0 10px">Your first night is on us</h2>' +
        '<p style="font-size:16px;line-height:1.5" id="h-freed">' + esc(FN.text(fn)) + '</p>' +
        '<div class="sh__ft"><button class="btn btn--go btn--block" data-free="yes" data-focus>' + (n > 1 ? 'Yes, book our free beds' : 'Yes, book my free night') + '</button>' +
        '<button class="btn btn--ghost btn--block" data-free="no">No thanks, I’ll arrive on the day</button></div></div>';
    }
    // step 2: who they are, and send it
    function stepForm() {
      var range = dateRange(plan());
      return '<div class="sh__b" style="padding-top:22px">' + X + '<p class="over">Hold my beds</p>' +
        '<h2 style="margin:8px 0 10px">Send it to the crew. It\'s free.</h2>' +
        '<p style="font-size:15.5px;line-height:1.5">Ewan and the crew check every stop, ride and date, fix anything that needs fixing' + (A.state.start ? ' and hold your beds for ' + (C.HOLD_HOURS || 48) + ' hours while they do' : '') + '. Then they send you the price. ' + (dep ? 'A deposit holds your beds, and it comes off your trip.' : 'You pay nothing until you say yes.') + '</p>' +
        '<ul class="incl" style="margin-top:14px"><li>' + pl.totals.days + ' days, ' + cs.length + (cs.length === 1 ? ' country' : ' countries') + ', about ' + money(pl.totals.total) + ' each</li><li id="h-range">' + (range ? esc(range) : 'No date yet: the crew will help you pick one') + '</li><li>' + esc(whoLine) + '</li>' +
        (fn ? '<li>Free night before ALL IN: <b>' + (pick === 'yes' ? 'yes please' : 'no thanks') + '</b> <button type="button" class="link" data-free-change style="padding:0 0 0 6px;font-size:14px">Change</button></li>' : '') + '</ul>' +
        '<form class="hold" id="holdf" novalidate>' +
        '<div class="field"><label for="h-when">When do you go?</label><input type="date" id="h-when" name="when" value="' + esc(A.state.start) + '" min="' + MM.util.isoDate(new Date()) + '"><span class="small">Not sure yet? Leave it, and the crew will help you pick.</span></div>' +
        '<div class="field"><label for="h-name">First name</label><input id="h-name" name="name" autocomplete="given-name" maxlength="60" required value="' + esc(form.name != null ? form.name : q.name || '') + '"></div>' +
        '<div class="field"><label for="h-email">Email</label><input id="h-email" name="email" type="email" autocomplete="email" maxlength="200" required placeholder="you@example.com" value="' + esc(form.email != null ? form.email : q.email || '') + '"><span class="small">The crew sends your checked trip and price here.</span></div>' +
        '<div class="field"><label for="h-wa">WhatsApp <small>(if you\'d like it there too)</small></label><input id="h-wa" name="whatsapp" type="tel" autocomplete="tel" maxlength="30" placeholder="with the country code, e.g. +44 7700 900123" value="' + esc(form.whatsapp != null ? form.whatsapp : q.whatsapp || '') + '"></div>' +
        (tw && !leaveTold ? '<div class="told" id="h-told"><p class="over">Sent with your trip: what you told us' + (tw.tiktok.length ? ', with your TikTok link' : '') + '</p><p class="told__w">' + esc(A.review.toldShort(tw)) + '</p><button type="button" class="link" data-leave>Leave it off</button></div>' : '') +
        '<div style="display:none"><label>Leave empty <input name="website" tabindex="-1" autocomplete="off"></label></div>' +
        '<label class="check" style="margin-top:14px"><input type="checkbox" name="consent" required' + (form.consent ? ' checked' : '') + '><span>It\'s OK for Mad Monkey to contact me about this trip. We only use your details to plan it with you.' + (C.PRIVACY_URL ? ' <a href="' + esc(C.PRIVACY_URL) + '" target="_blank" rel="noopener" style="color:var(--amber)">Privacy</a>' : '') + '</span></label>' +
        '<p class="err" id="h-err" role="alert" hidden></p>' +
        '<div class="sh__ft"><button class="btn btn--go btn--block" type="submit" data-focus>' + (dep && live ? 'Hold my beds' : 'Send it to the crew, free') + '</button>' +
        (live ? '' : '<p class="small center demo">Demo: no crew backend is set (LEAD_ENDPOINT), so nothing will really be sent.</p>') + '</div></form></div>';
    }
    function keep(s) { var f = $('#holdf', s); if (!f) return; ['name', 'email', 'whatsapp'].forEach(function (k) { form[k] = f.elements[k].value; }); form.consent = f.elements.consent.checked; }
    function draw(s, step) { s.innerHTML = step === 'free' ? stepFree() : stepForm(); s.scrollTop = 0; var x = s.querySelector('[data-focus]'); if (x) try { x.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
    sheet(fn ? stepFree() : stepForm(), function (s) {
      s.addEventListener('change', function (e) {
        if (e.target.id !== 'h-when') return;
        A.state.start = e.target.value || ''; save(); pl = plan();
        if (fn) fn = freeNightOf();
        var r = $('#h-range', s); if (r) r.textContent = dateRange(pl) || 'No date yet: the crew will help you pick one';
      });
      s.addEventListener('click', function (e) {
        if (e.target.closest('[data-close]')) return closeSheet();
        var fb = e.target.closest('[data-free]'); if (fb) { pick = fb.getAttribute('data-free'); u.track('start_free_night', { yes: pick === 'yes' }); return draw(s, 'form'); }
        if (e.target.closest('[data-free-change]')) { keep(s); return draw(s, 'free'); }
        if (e.target.closest('[data-leave]')) { leaveTold = true; var box = $('#h-told', s); if (box) box.remove(); }
      });
      s.addEventListener('submit', function (e) {
        e.preventDefault();
        var f = e.target, err = $('#h-err', s), v = {}; new FormData(f).forEach(function (val, k) { v[k] = typeof val === 'string' ? val.trim() : val; });
        var show = function (m, at) { err.hidden = false; err.textContent = m; if (at) { var x = $(at, s); if (x) x.focus(); } };
        if (v.website) return;
        if (fn && !pick) { keep(s); return draw(s, 'free'); }
        if (!v.name) return show('Pop your first name in.', '#h-name');
        var ct = u.readContact({ via: 'email', email: v.email }); if (ct.err) return show(ct.err, '#h-email');
        var wa = '';
        if (v.whatsapp) { var w2 = u.readContact({ via: 'whatsapp', whatsapp: v.whatsapp }); if (w2.err) return show(w2.err, '#h-wa'); wa = w2.whatsapp; }
        if (!v.consent) return show('Tick the box so we\'re allowed to reply.', 'input[name=consent]');
        err.hidden = true;
        u.store('mm-lead', Object.assign({}, q, { name: v.name, via: 'email', email: ct.email, whatsapp: wa || q.whatsapp || '' }));
        if (fn) fn = freeNightOf();                                                       // with the date they picked last
        var notes = [fn ? FN.note(fn, pick) : '',
          S.who === 'solo' ? (S.crew ? 'Travelling solo: happy to be introduced to others on the same route at the same time.' : 'Travelling solo.') : 'Travelling with friends: ' + n + ' of them, everyone paying their own share.',
          wa ? 'WhatsApp: ' + wa + '.' : ''].filter(Boolean).join(' ');
        var contact = { name: v.name.slice(0, 60), via: 'email', email: ct.email, whatsapp: wa, from: '', partySize: n, dates: A.state.start ? 'fixed' : 'open', notes: notes, consent: true };
        var opts = { flow: 'start', freeNight: fn ? FN.data(fn, pick) : null, told: tw && !leaveTold ? { words: tw.text, tiktok: tw.tiktok } : null };
        var btn = $('button[type=submit]', f), label = btn.textContent; btn.disabled = true; btn.textContent = dep && live ? 'Opening secure payment…' : 'Sending…';
        A.auto = false; u.persist();
        A.review.send(contact, opts).then(function (r) { if (!r.paying) sent(r, v.name, ct.email); })
          .catch(function (x) { btn.disabled = false; btn.textContent = label; show((x && x.message && x.message.indexOf('HTTP') !== 0 ? x.message + ' ' : '') + (dep ? 'Nothing has been charged. ' : '') + 'Try again in a minute, or tap ' + u.askLabel() + ' and we\'ll sort it out.'); });
      });
    }, 'Hold my beds');
  }
  function sent(r, name, email) {
    var rec = r.rec, until = rec.hold && rec.hold.until && A.review.fmtWhen ? A.review.fmtWhen(rec.hold.until) : '';
    var track = '#/trip/' + encodeURIComponent(rec.ref) + (rec.key ? '?k=' + encodeURIComponent(rec.key) : '');
    sheet('<div class="sh__b" style="padding-top:26px"><button class="sh__x" data-close aria-label="Close" style="background:var(--canopy-2)">×</button><p class="over">' + (rec.demo ? 'Demo: nothing was sent' : 'With the crew') + '</p>' +
      '<h2 style="margin:8px 0 10px">' + (r.duplicate ? 'Already with the crew, ' : 'It\'s with the crew, ') + esc(name) + '.</h2>' +
      '<p style="font-size:15.5px;line-height:1.5">' + (r.duplicate ? 'You sent this trip a moment ago, so we haven\'t sent it twice.' : 'A real person checks every day, bed and ride' + (until ? ', and we\'re holding your beds until ' + esc(until) : '') + '. They\'ll email ' + esc(email) + ' with your price. Nothing is charged until you say yes.') + '</p>' +
      '<div class="refbox"><span class="over">Your reference</span><b>' + esc(rec.ref) + '</b></div>' +
      '<div class="sh__ft"><a class="btn btn--go btn--block" href="' + esc(track) + '">Track my trip</a><button class="btn btn--ghost btn--block" data-close data-focus>Done</button></div></div>', function (s) {
      s.addEventListener('click', function (e) { if (e.target.closest('[data-close]')) closeSheet(); });
    }, 'Sent to the crew');
  }
  function tripText() {
    var pl = plan(); if (!pl) return '';
    return 'My Mad Monkey trip: ' + pl.segs.map(function (sg) { return sg.kind === 'stop' ? P[sg.p].n + ' (' + sg.n + (sg.n === 1 ? ' night)' : ' nights)') : 'ALL IN ' + sg.trip.n + ' (' + sg.trip.days + ' days)'; }).join(' → ') +
      '. ' + pl.totals.days + ' days' + (dateRange(pl) ? ', ' + dateRange(pl) : '') + ', about ' + money(pl.totals.total) + ' each. Who\'s in?';
  }
  function showText(txt) {
    sheet('<div class="sh__b" style="padding-top:22px"><button class="sh__x" data-close aria-label="Close" style="background:var(--canopy-2)">×</button><h2>Send it to your friends</h2><p class="small" style="margin-bottom:10px">Copy this and paste it in your group chat. The link opens your trip.</p><textarea readonly class="copybox">' + esc(txt) + '</textarea><div class="sh__ft"><button class="btn btn--go btn--block" data-close>Done</button></div></div>', function (s) {
      s.addEventListener('click', function (e) { if (e.target.closest('[data-close]')) closeSheet(); });
      var ta = $('textarea', s); setTimeout(function () { try { ta.focus(); ta.select(); } catch (e) { /* ignore */ } }, 80);
    }, 'Send it to your friends');
  }
  // the full editor, with this trip in it: every ride, date, tour and detail
  function editor() { u.track('start_editor', { stops: items().length }); A.auto = false; if (items().length) { u.persist(); u.go('build', MM.encodeState(A.state)); } else { A.state = MM.defaultState(); u.go('build', 'i='); } }

  /* ============================================================
     WIRING
     ============================================================ */
  var pendingTarget = 0;
  function begin(item) { pendingStart = item; pendingTarget = 0; nav('how-long'); }
  function onClick(e) {
    var b = e.target.closest('button,[data-start]'); if (!b || !V.contains(b)) return;
    if (b.hasAttribute('data-start')) return begin({ kind: 'stop', p: b.getAttribute('data-start') });
    if (b.hasAttribute('data-startallin')) return begin({ kind: 'allin', trip: b.getAttribute('data-startallin') });
    if (b.hasAttribute('data-weeks')) {
      var st = pendingStart; if (!st) return nav('');
      pendingTarget = +b.getAttribute('data-weeks');
      if (st.kind === 'allin') { u.track('start_add', { allin: st.trip, first: true }); newTrip({ kind: 'allin', trip: st.trip }, pendingTarget); pendingStart = null; nav('next'); toast('ALL IN ' + esc(trip(st.trip).n) + ' is in. Add your own stops after it.'); return; }
      openPick(st.p, { first: true }); return;
    }
    if (b.hasAttribute('data-pick')) return openPick(b.getAttribute('data-pick'));
    if (b.hasAttribute('data-allin')) return openAllIn(b.getAttribute('data-allin'));
    if (b.hasAttribute('data-edit')) return openEdit(+b.getAttribute('data-edit'));
    if (b.hasAttribute('data-who')) { S.who = b.getAttribute('data-who'); saveX(); var y = window.scrollY; show('trip'); window.scrollTo(0, y); return; }
    if (b.hasAttribute('data-mates')) { S.mates = Math.max(2, Math.min(20, S.mates + +b.getAttribute('data-mates'))); saveX(); b.parentNode.querySelector('output').textContent = S.mates; return; }
    switch (b.getAttribute('data-act')) {
      case 'resume': { var sv = savedTrip(); if (!sv) return nav(''); if (!A.state.items.length) { A.state = sv; A.auto = false; } hist = []; nav(S.at === 'trip' ? 'trip' : 'next'); break; }
      case 'others': { var o = $('#others'), on = !o.classList.contains('on'); o.classList.toggle('on', on); b.setAttribute('aria-expanded', on); break; }
      case 'tostart': pendingStart = null; nav(''); break;
      case 'home': nav(''); break;
      case 'shuffle': nextDeck(plan(), { shuffle: true }); break;
      case 'surprise': { var all = pool(plan()).slice(0, 8).filter(function (c) { return !G || G.cards.every(function (x) { return x.id !== c.id; }); }); if (all.length) openPick(all[Math.floor(Math.random() * all.length)].id, { surprise: true }); break; }
      case 'skip': if (G) G.film.skip(); break;
      case 'finish': u.track('start_finish', { stops: items().length }); nav('trip'); break;
      case 'money': openMoney(); break;
      case 'howlong': openWeeks(); break;
      case 'keep': nav('next'); break;
      case 'hold': openHold(); break;
      case 'editor': case 'editor-blank': editor(); break;
      case 'copy': {
        var txt = tripText() + '\n\n' + u.shareLink();
        u.track('start_copy', {});
        u.copy(txt).then(function (ok) { if (ok) toast('Copied. Paste it to your friends: the link opens your trip.'); else showText(txt); });
        break;
      }
    }
  }
  function onChange(e) {
    if (e.target.id === 'when') { A.state.start = e.target.value || ''; save(); var y = window.scrollY; show('trip'); window.scrollTo(0, y); }
    if (e.target.id === 'crew') { S.crew = e.target.checked; saveX(); }
  }

  /* ---------- the shadow root: made once, kept while you move between the screens ---------- */
  function mount() {
    var root = document.getElementById('app'), host = root.firstElementChild;
    if (host && host.id === 'tbs' && host.shadowRoot) { R = host.shadowRoot; V = R.getElementById('v'); sheets = R.getElementById('sheets'); toasts = R.getElementById('toasts'); return; }
    root.innerHTML = '<div id="tbs" class="tbs"></div>';
    host = root.firstElementChild; host.style.visibility = 'hidden';
    R = host.attachShadow({ mode: 'open' });
    R.innerHTML = '<style>' + Film.CSS + '</style><link rel="stylesheet" href="start.css' + (VER ? '?v=' + VER : '') + '"><div class="tb" id="v"></div><div id="sheets"></div><div class="toasts" id="toasts" aria-live="polite"></div>';
    var link = R.querySelector('link'), shown = false, reveal = function () { if (shown) return; shown = true; host.style.visibility = ''; if (G) G.map.rescale(); if (T) T.map.rescale(); };
    link.addEventListener('load', reveal); link.addEventListener('error', reveal); setTimeout(reveal, 1500);
    V = R.getElementById('v'); sheets = R.getElementById('sheets'); toasts = R.getElementById('toasts');
    V.addEventListener('click', onClick); V.addEventListener('change', onChange);
  }
  function destroyMaps() {
    if (G) { G.map.destroy(); G.film.destroy(); G = null; }
    if (T) { T.map.destroy(); T.film.destroy(); T = null; }
  }
  function show(screen) {
    closeSheet(true); destroyMaps();
    var has = items().length > 0;
    if (screen === 'next' && has) { S.at = 'next'; viewGame(); }
    else if (screen === 'trip' && has) { S.at = 'trip'; viewTrip(); }
    else if (screen === 'how-long' && pendingStart) viewHowLong();
    else { if (screen) history.replaceState(null, '', '#/start'); viewStart(); }
    if (has) saveX();
    if (A._booted) { var h = V.querySelector('h1, h2'); if (h) { h.setAttribute('tabindex', '-1'); try { h.focus({ preventScroll: true }); } catch (e) { /* ignore */ } } }
  }
  function nav(screen) {
    var h = '#/start' + (screen ? '/' + screen : '');
    if (location.hash === h) { show(screen); window.scrollTo(0, 0); } else location.hash = h;
  }
  A.views.start = function (rest) {
    mount();
    A._unwatch = function () { closeSheet(true); destroyMaps(); };          // leaving: stop the maps and their films
    show(String(rest || '').split('/')[0]);
  };
  A.startTrip = function () { return { extras: S, plan: plan() }; };

  // for the automated checks (test/ui-start.js): open any sheet or screen from a test script
  window.__start = { openPick: openPick, openAllIn: openAllIn, openEdit: openEdit, openMoney: openMoney, openHold: openHold, plan: plan, pool: pool, root: function () { return R; },
    set: function (list, screen, target) { A.state = Object.assign(MM.defaultState(), { items: list }); S = freshX(); S.target = target == null ? 21 : target; hist = []; save(); nav(screen || 'next'); }, extras: function () { return S; } };
})();
