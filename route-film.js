/* ============================================================
   ROUTE FILM: the route draws itself, stop by stop, like the map in an old travel film.
   One function for every map, the trip builder's and the ALL IN site's:

     var film = MMRouteFilm(map, stops, options);

   map    an <svg> (or an element with one inside) drawn in the trip builder's map projection (data/map-data.js),
          as the builder's map and the site's maps are. Anything else: options.project(place) → [x, y].
   stops  the trip in order, each with its place and how you get to the next one:
          [{ place: 'hanoi', by: 'bus' }, { place: 'ha-giang', by: 'scooter' }, { place: 'hoi-an' }]
          by: bus | boat | scooter | plane, and van, train and car (words like ferry, flight or motorbike work too).

   Each leg draws in about a second or two with its vehicle moving along it, a short pause at each stop, and each
   place's name appearing as the line arrives. The whole route plays when the map scrolls into view (or on .play()),
   Replay plays it again, Skip shows the finished route, and adding a stop with .set() draws only the new leg.
   With loop: true (the site's trip maps) it holds the finished route for a few seconds, then plays again, only while the
   map is on screen; the builder plays once. A device that asks for reduced motion gets the finished route at once,
   with no loop and no buttons.
   Our own look only: the page's own font, colours from CSS variables (docs/ALL-IN-SITE.md), no footage, no sound.
   ============================================================ */
(function (root) {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg', doc = root.document;

  /* ---------- how you get to the next stop ---------- */
  var MODE_WORDS = [
    ['plane', /\b(plane|planes|flight|flights|fly|flying|air|airplane|aeroplane)\b/],
    ['boat', /boat|ferry|ship|cruise|junk|kayak|sail|longtail|catamaran/],
    ['scooter', /scoot|moto|bike|rider|moped/],
    ['train', /train|rail/],
    ['van', /\bvan\b|minivan|minibus|shuttle/],
    ['car', /taxi|car\b|cars\b|transfer|jeep|tuk|grab|truck|songthaew/],
    ['bus', /bus|coach/]
  ];
  function mode(m) {
    var k = String(m == null ? '' : m).toLowerCase();
    for (var i = 0; i < MODE_WORDS.length; i++) if (MODE_WORDS[i][1].test(k)) return MODE_WORDS[i][0];
    return 'bus';
  }

  /* ---------- the vehicles: 24 × 24, drawn in the vehicle colour ('f') with holes in the badge colour ('c').
     Bus, boat, train, car and plane are Material Design icons (Apache 2.0, as the builder's leg cards use); the scooter is ours. ---------- */
  var BUS = 'M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z';
  var ICONS = {
    plane: [['path', { d: 'M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z' }, 'f']],
    bus: [['path', { d: BUS }, 'f']],
    van: [['path', { d: BUS }, 'f']],
    train: [['path', { d: 'M12 2c-4 0-8 .5-8 4v9.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h2.23l2-2H14l2 2h2v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-3.58-4-8-4zM7.5 17c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm3.5-7H6V6h5v4zm2 0V6h5v4h-5zm3.5 7c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z' }, 'f']],
    boat: [['path', { d: 'M20 21c-1.39 0-2.78-.47-4-1.32-2.44 1.71-5.56 1.71-8 0C6.78 20.53 5.39 21 4 21H2v2h2c1.38 0 2.74-.35 4-.99 2.52 1.29 5.48 1.29 8 0 1.26.65 2.62.99 4 .99h2v-2h-2zM3.95 19H4c1.6 0 3.02-.88 4-2 .98 1.12 2.4 2 4 2s3.02-.88 4-2c.98 1.12 2.4 2 4 2h.05l1.89-6.68c.08-.26.06-.54-.06-.78s-.34-.42-.6-.5L20 10.62V6c0-1.1-.9-2-2-2h-3V1H9v3H6c-1.1 0-2 .9-2 2v4.62l-1.29.42c-.26.08-.48.26-.6.5s-.14.52-.05.78L3.95 19zM6 6h12v3.97L12 8 6 9.97V6z' }, 'f']],
    car: [['path', { d: 'M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z' }, 'f']],
    // a scooter from the side, heading right: seat, body, floor, steering column, handlebar and two wheels
    scooter: [
      ['rect', { x: 3.4, y: 8.4, width: 7.4, height: 2.4, rx: 1.2 }, 'f'],
      ['path', { d: 'M2.9 13.6c0-1.6 1.3-2.6 2.9-2.6h5.4l1.3 3.6H9.1a3.6 3.6 0 0 0-5.9.6z' }, 'f'],
      ['rect', { x: 9.6, y: 14.2, width: 7.2, height: 2, rx: 1 }, 'f'],
      ['path', { d: 'M14.6 16.4l2.3-10.1h2l-2.3 10.1z' }, 'f'],
      ['rect', { x: 15.9, y: 5, width: 5, height: 1.8, rx: 0.9 }, 'f'],
      ['circle', { cx: 6.2, cy: 17.3, r: 3.4 }, 'f'], ['circle', { cx: 6.2, cy: 17.3, r: 1.3 }, 'c'],
      ['circle', { cx: 18.4, cy: 17.3, r: 3.4 }, 'f'], ['circle', { cx: 18.4, cy: 17.3, r: 1.3 }, 'c']
    ]
  };
  var SIDEWAYS = { scooter: 1 };            // drawn from the side: turns to face the way it's going
  var HEADING = { plane: 1 };               // drawn from above: points the way it's going

  /* ---------- where a place's name sits (the same nudges as the builder's map) ---------- */
  var SIDE = { pai: { a: 'end' }, 'koh-sdach': { a: 'end' }, 'koh-rong': { a: 'end' }, kampot: { a: 'end', dy: 16 }, dumaguete: { a: 'end' }, 'nacpan-beach': { a: 'end' }, uluwatu: { a: 'end' },
    'nusa-lembongan': { a: 'start', dy: -4 }, 'kuta-lombok': { a: 'start', dy: 12 }, 'gili-trawangan': { a: 'start', dy: -6 }, 'phnom-penh': { a: 'start', dy: 14 }, 'siem-reap': { a: 'end' }, saigon: { a: 'start', dy: 6 },
    'vang-vieng': { a: 'end', dy: 8 }, 'luang-prabang': { a: 'end', dy: -2 }, siquijor: { a: 'start', dy: 12 }, panglao: { a: 'start', dy: 6 }, 'hoi-an': { a: 'start' }, manila: { a: 'start' } };

  /* ---------- geometry ---------- */
  function MMs() { return root.MM || {}; }
  // the builder's projection (data/map-data.js): Mercator, in the map's own units
  function proj(lat, lon) {
    var m = MMs().MAP; if (!m) return null;
    var k = m.w / (m.lon1 - m.lon0), mer = function (l) { return Math.log(Math.tan(Math.PI / 4 + l * Math.PI / 360)); };
    return [(lon - m.lon0) * k, (mer(m.lat1) - mer(lat)) * k * 180 / Math.PI];
  }
  function placeXY(p) { var P = MMs().PLACES, pl = P && P[p]; return pl && pl.ll ? proj(pl.ll[0], pl.ll[1]) : null; }
  // A gentle arc from a to b, bulging upward: the same curve the builder's map draws, so a film line and the map's own line match exactly.
  function arc(a, b, bend) {
    var dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy);
    if (d < 1) return { d: 'M' + a[0] + ' ' + a[1], mid: a, len: 0 };
    var nx = -dy / d, ny = dx / d; if (ny > 0) { nx = -nx; ny = -ny; }
    var k = d * (bend == null ? 0.16 : bend), cx = (a[0] + b[0]) / 2 + nx * k, cy = (a[1] + b[1]) / 2 + ny * k;
    var mid = [0.25 * a[0] + 0.5 * cx + 0.25 * b[0], 0.25 * a[1] + 0.5 * cy + 0.25 * b[1]];
    return { d: 'M' + a[0].toFixed(1) + ' ' + a[1].toFixed(1) + ' Q' + cx.toFixed(1) + ' ' + cy.toFixed(1) + ' ' + b[0].toFixed(1) + ' ' + b[1].toFixed(1), mid: mid, len: d * 1.1 };
  }

  /* ---------- timing: about a second or two a leg (longer legs take longer), a short pause at each stop.
     A very long trip (20-odd legs) is sped up so the whole film stays under maxTotal. ---------- */
  function timing(pxLens, o) {
    o = o || {};
    var speed = o.speed > 0 ? o.speed : 1, pause = o.pause == null ? 450 : +o.pause, max = o.maxTotal || 24000;
    var legs = pxLens.map(function (L) { return Math.max(1000, Math.min(2000, 850 + (L || 0) * 2)) / speed; });
    var total = legs.reduce(function (s, x) { return s + x; }, 0) + pause * legs.length;
    if (legs.length && total > max) {
      var f = max / total;
      legs = legs.map(function (x) { return Math.max(650, x * f); }); pause = Math.max(200, pause * f);
    }
    return { legs: legs, pause: pause, total: legs.reduce(function (s, x) { return s + x; }, 0) + pause * legs.length };
  }

  /* ---------- what's new between two versions of the trip: the legs to draw and the stops to bring in.
     One run of stops added or swapped (a new stop, an ALL IN trip dropped in, a place changed) → the legs touching it.
     Nothing new (a stop taken out, stops moved round, nights changed) → null: the route just updates. ---------- */
  function fresh(oldP, newP) {
    oldP = oldP || []; newP = newP || [];
    var m = oldP.length, k = newP.length; if (k < 2) return null;
    var p = 0; while (p < m && p < k && oldP[p] === newP[p]) p++;
    var s = 0; while (s < m - p && s < k - p && oldP[m - 1 - s] === newP[k - 1 - s]) s++;
    var a = p, b = k - s - 1;                                        // the run of new or moved stops in the new trip
    if (b < a) return null;
    var outside = {}, i; for (i = 0; i < k; i++) if (i < a || i > b) outside[newP[i]] = 1;
    var was = {}, now = {}; oldP.forEach(function (x) { was[x] = (was[x] || 0) + 1; }); newP.forEach(function (x) { now[x] = (now[x] || 0) + 1; });
    var added = false; for (i = a; i <= b; i++) if ((now[newP[i]] || 0) > (was[newP[i]] || 0)) added = true;
    if (!added) return null;                                          // only moved round: nothing new to draw
    var bring = []; for (i = a; i <= b; i++) if (!outside[newP[i]]) bring.push(i);
    if (a === 0) bring.unshift(0);
    return { from: Math.max(0, a - 1), to: Math.min(k - 2, b), stops: bring.filter(function (x, j, arr) { return arr.indexOf(x) === j; }) };
  }

  function reduced() { try { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; } }
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function easeBack(t) { var c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }

  /* ---------- the default look, overridable by any page rule (zero specificity) or the CSS variables ---------- */
  var CSS = ':where(.rf-case){fill:none;stroke:var(--rf-case,#0E2B26);stroke-linecap:round;stroke-linejoin:round}' +
    ':where(.rf-line){fill:none;stroke:var(--rf-line,#FFB238);stroke-linecap:round;stroke-linejoin:round}' +
    ':where(.rf-dot){fill:var(--rf-dot,#FFB238);stroke:var(--rf-case,#0E2B26);stroke-width:2.5px}' +
    ':where(.rf-num){fill:var(--rf-case,#0E2B26);font-weight:800;font-size:11px;text-anchor:middle;dominant-baseline:central}' +
    ':where(.rf-name){fill:var(--rf-name,#F3F7F2);stroke:var(--rf-halo,#0E2B26);stroke-width:4px;stroke-linejoin:round;paint-order:stroke;font-weight:800;font-size:13px}' +
    ':where(.rf-veh-bg){fill:var(--rf-veh-bg,#0E2B26);stroke:var(--rf-veh-ring,#F3F7F2);stroke-width:2px}' +
    ':where(.rf-veh-f){fill:var(--rf-veh,#FFB238)}:where(.rf-veh-c){fill:var(--rf-veh-bg,#0E2B26)}' +
    ':where(.rf-ping){fill:none;stroke:var(--rf-line,#FFB238);stroke-width:2.5px}' +
    ':where(.rf-ctl){position:absolute;right:10px;bottom:10px;z-index:5;display:flex;gap:6px}' +
    ':where(.rf-btn){display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:6px 14px;border-radius:999px;border:1.5px solid rgba(243,247,242,.7);background:rgba(14,43,38,.88);color:#F3F7F2;font:inherit;font-size:13px;font-weight:700;line-height:1;cursor:pointer}' +
    ':where(.rf-btn:focus-visible){outline:3px solid #FFB238;outline-offset:2px}' +
    '@media (pointer:coarse){:where(.rf-btn){min-height:44px}}' +
    '.rf-btn[hidden]{display:none!important}';
  function styleOnce() {
    if (!doc || doc.getElementById('rf-style')) return;
    var s = doc.createElement('style'); s.id = 'rf-style'; s.textContent = CSS; (doc.head || doc.documentElement).appendChild(s);
  }
  function el(name, attrs, parent) { var e = doc.createElementNS(NS, name); for (var k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
  function iconInto(g, m) {
    (ICONS[m] || ICONS.bus).forEach(function (part) { el(part[0], part[1], g).setAttribute('class', part[2] === 'c' ? 'rf-veh-c' : 'rf-veh-f'); });
  }

  /* ============================================================
     MMRouteFilm(map, stops, options)
     options (all optional):
       autoplay   'view' (default): the first time the map is a third on screen · true: now · false: wait for .play() or .set()
       loop       false (default): play once · true: when the route has drawn, hold it for `hold` ms (5000), then play it
                  again, only while the map is on screen. Skip stops the loop until Replay. Never with reduced motion.
       controls   true (default): Replay and Skip buttons over the map · false: none (call .play()/.skip() from your own)
       labels     true: each place's name appears as the line arrives · dots: true: a dot at each stop · numbers: false
       keep       true: the drawn route stays after the film · false: it fades out leg by leg (a map that draws its own)
       project    function (place) → [x, y] in the map's units, for a map in another projection (or give stops x, y)
       name       function (place) → its name (default: the builder's place names)
       scale      function () → map units per screen pixel (default: measured), so lines and names keep their size
       width      line width in px (4.5) · casing: its outline (9.5) · speed: 1 · pause: ms at each stop (450) · maxTotal (24000)
       lineClass, caseClass   extra classes for the lines, to take a map's own line style
       under      the map element to draw the lines under (default: on top of everything)
       onHide(legs, stops), onLeg(i), onArrive(i), onEnd(skipped)   for a map that hides and shows its own route
     Returns { play(), replay(), skip(), set(stops, how), destroy(), playing, looping }
       set(stops, how): the trip changed; how 'auto' (default) draws only what's new, 'all' plays the whole route, 'none' just shows it.
     ============================================================ */
  function MMRouteFilm(map, stops, o) {
    o = o || {}; styleOnce();
    var svg = map && map.tagName && map.tagName.toLowerCase() === 'svg' ? map : map && map.querySelector && map.querySelector('svg');
    if (!svg) throw new Error('MMRouteFilm: no <svg> in that map');
    var host = svg.parentNode, keep = o.keep !== false, wantLabels = o.labels !== false, wantDots = o.dots !== false;
    var gLines = el('g', { 'class': 'rf rf-lines', 'aria-hidden': 'true' }), gTop = el('g', { 'class': 'rf rf-top', 'aria-hidden': 'true' });
    if (o.under && o.under.parentNode === svg) svg.insertBefore(gLines, o.under); else svg.appendChild(gLines);
    svg.appendChild(gTop);
    var gStops = el('g', {}, gTop), gNames = el('g', {}, gTop), gPings = el('g', {}, gTop);
    var veh = el('g', { 'class': 'rf-veh' }, gTop); veh.style.display = 'none';
    var vehBody = el('g', {}, veh); el('circle', { r: 15, 'class': 'rf-veh-bg' }, vehBody);
    var vehIcon = el('g', {}, vehBody), vehMode = '';

    var cur = [], pts = [], legs = [], dots = [], names = [], run = null, raf = 0, ctl = null, btnReplay = null, btnSkip = null, observer = null, dead = false, lastU = 0;
    // looping: hold the finished route, then play it again while the map is on screen
    var loopOn = !!o.loop, hold = o.hold == null || isNaN(+o.hold) ? 5000 : Math.max(0, +o.hold);
    var onScreen = !root.IntersectionObserver, waitingFirst = false, stopped = false, holdTimer = 0, fading = 0, idleSince = 0, hasPlayed = false;

    function unitsPerPx() {
      if (o.scale) { var v = +o.scale(); if (v > 0) return v; }
      try { var m = svg.getScreenCTM(); if (m && m.a) return 1 / Math.abs(m.a); } catch (e) { /* not on screen */ }
      var vb = svg.viewBox && svg.viewBox.baseVal, w = svg.getBoundingClientRect().width;
      return vb && vb.width && w ? vb.width / w : 1;
    }
    function xyOf(s) {
      if (s.x != null && s.y != null) return [+s.x, +s.y];
      return (o.project ? o.project(s.place) : placeXY(s.place)) || null;
    }
    function nameOf(s) {
      if (s.name) return s.name;
      if (o.name) return o.name(s.place);
      var P = MMs().PLACES; return P && P[s.place] ? P[s.place].n : String(s.place || '');
    }
    function norm(list) {
      return (list || []).map(function (s) { return typeof s === 'string' ? { place: s } : { place: s.place || s.p || s.id, by: s.by || s.mode || s.m, x: s.x, y: s.y, name: s.name, side: s.side, color: s.color, legClass: s.legClass }; })
        .filter(function (s, i, a) { return (s.place || s.x != null) && !(i && a[i - 1].place && a[i - 1].place === s.place); });
    }

    /* ---------- draw the route's parts (hidden or shown as the film needs) ---------- */
    function build(list) {
      gLines.textContent = ''; gStops.textContent = ''; gNames.textContent = ''; gPings.textContent = '';
      cur = list; pts = list.map(xyOf); legs = []; dots = []; names = [];
      for (var i = 0; i + 1 < list.length; i++) {
        var a = pts[i], b = pts[i + 1], g = el('g', { 'class': 'rf-leg' + (list[i].legClass ? ' ' + list[i].legClass : '') }, gLines);
        if (!a || !b) { legs.push(null); continue; }
        var c = arc(a, b), cas = el('path', { d: c.d, 'class': 'rf-case' + (o.caseClass ? ' ' + o.caseClass : '') }, g),
          line = el('path', { d: c.d, 'class': 'rf-line' + (o.lineClass ? ' ' + o.lineClass : '') }, g);
        if (list[i].color) line.style.stroke = list[i].color;
        var len = 0; try { len = line.getTotalLength(); } catch (e) { len = c.len; }
        legs.push({ g: g, paths: [cas, line], len: len || c.len || 1, mode: mode(list[i].by), done: false });
      }
      list.forEach(function (s, i) {
        var p = pts[i]; if (!p) { dots.push(null); names.push(null); return; }
        var dg = null, ng = null;
        if (wantDots) {
          dg = el('g', { 'class': 'rf-stop', 'data-x': p[0], 'data-y': p[1] }, gStops); var inner = el('g', {}, dg);
          el('circle', { r: 7, 'class': 'rf-dot' }, inner);
          if (o.numbers) el('text', { 'class': 'rf-num', y: 0.5 }, inner).textContent = i + 1;
        }
        if (wantLabels) {
          var side = s.side ? { a: s.side === 'left' ? 'end' : 'start' } : (SIDE[s.place] || {});
          ng = el('g', { 'class': 'rf-place', 'data-x': p[0], 'data-y': p[1] }, gNames);
          var t = el('text', { 'class': 'rf-name', x: side.a === 'end' ? -12 : 12, y: side.dy == null ? 4.5 : side.dy, 'text-anchor': side.a || 'start' }, ng);
          t.textContent = nameOf(s);
        }
        dots.push(dg); names.push(ng);
      });
      lastU = 0; rescale(true);
    }
    // keep lines, dots, names and the vehicle the same size on screen whatever the map's zoom
    function rescale(force) {
      var u = unitsPerPx(); if (!force && Math.abs(u - lastU) < lastU * 0.002) return u; lastU = u;
      var w = (o.width || 4.5) * u, cw = (o.casing || 9.5) * u;
      legs.forEach(function (l) { if (!l) return; l.paths[0].setAttribute('stroke-width', cw.toFixed(3)); l.paths[1].setAttribute('stroke-width', w.toFixed(3)); });
      dots.concat(names).forEach(function (g) { if (!g) return; g.firstChild.setAttribute('transform', 'translate(' + g.getAttribute('data-x') + ' ' + g.getAttribute('data-y') + ') scale(' + u.toFixed(4) + ')'); });
      return u;
    }
    function legAt(i, f) {                 // show leg i drawn from 0 (nothing) to 1 (all of it)
      var l = legs[i]; if (!l) return;
      l.paths.forEach(function (p) {
        if (f >= 1) { p.style.strokeDasharray = ''; p.style.strokeDashoffset = ''; p.style.visibility = ''; return; }
        p.style.visibility = f <= 0 ? 'hidden' : ''; p.style.strokeDasharray = l.len + ' ' + l.len; p.style.strokeDashoffset = (l.len * (1 - Math.max(0, f))).toFixed(2);
      });
    }
    function stopShown(i, on) { [dots[i], names[i]].forEach(function (g) { if (g) { g.style.transition = ''; g.style.opacity = on ? '' : '0'; } }); }
    // a place arrives: its dot pops, its name fades up, and a ring spreads out from it
    function arrive(i, at) {
      var p = pts[i]; if (!p) return;
      [dots[i], names[i]].forEach(function (g) {
        if (!g) return; g.style.transition = 'none'; g.style.opacity = '0';
        if (root.getComputedStyle) root.getComputedStyle(g).opacity;      // let the browser see it hidden first, so the fade runs
        g.style.transition = 'opacity .32s ease-out'; g.style.opacity = '';
      });
      if (dots[i]) pop(dots[i].firstChild, p, at);
      if (names[i]) { var t = names[i].querySelector('text'); t.setAttribute('dy', 6); slide(t, at); }
      ping(p, at);
    }
    var anims = [];                        // small one-off animations (pops, pings, slides) run by the same clock
    function pop(g, p, at) { anims.push({ t0: at, d: 380, f: function (k) { var u = lastU, s = easeBack(k); g.setAttribute('transform', 'translate(' + p[0] + ' ' + p[1] + ') scale(' + (u * Math.max(0.01, s)).toFixed(4) + ')'); } }); }
    function slide(t, at) { anims.push({ t0: at, d: 320, f: function (k) { t.setAttribute('dy', (6 * (1 - ease(k))).toFixed(2)); } }); }
    function ping(p, at) {
      var c = el('circle', { 'class': 'rf-ping', cx: p[0], cy: p[1], r: 0 }, gPings);
      anims.push({ t0: at, d: 720, f: function (k) { var u = lastU; c.setAttribute('r', (u * (6 + 22 * ease(k))).toFixed(3)); c.setAttribute('stroke-width', (u * 2.5).toFixed(3)); c.style.opacity = (0.85 * (1 - k)).toFixed(3); if (k >= 1 && c.parentNode) c.parentNode.removeChild(c); } });
    }
    function requestFrame(fn) { return (root.requestAnimationFrame || function (f) { return setTimeout(function () { f(Date.now()); }, 16); })(fn); }

    /* ---------- the vehicle ---------- */
    function setVehicle(m) {
      if (m === vehMode) return; vehMode = m; vehIcon.textContent = ''; iconInto(vehIcon, m);
    }
    function placeVehicle(x, y, ang, m, scaleK) {
      var u = lastU, s = (scaleK == null ? 1 : scaleK);
      veh.setAttribute('transform', 'translate(' + x.toFixed(2) + ' ' + y.toFixed(2) + ') scale(' + (u * s).toFixed(4) + ')');
      var rot = HEADING[m] ? ang + 90 : 0, flip = SIDEWAYS[m] && Math.cos(ang * Math.PI / 180) < -0.05 ? -1 : 1;
      vehIcon.setAttribute('transform', 'rotate(' + rot.toFixed(1) + ') scale(' + (0.78 * flip) + ' 0.78) translate(-12 -12)');
    }
    function pointOn(i, f) {
      var l = legs[i], p = l.paths[1], at = l.len * f, a = p.getPointAtLength(Math.max(0, at - 1)), b = p.getPointAtLength(Math.min(l.len, at + 1)), c = p.getPointAtLength(at);
      return { x: c.x, y: c.y, ang: Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI };
    }

    /* ---------- the film: a list of legs to draw, one after another ---------- */
    function startRun(from, to, bring) {
      cancel();
      anims = [];
      var u = rescale(true), list = [], i;
      for (i = from; i <= to; i++) if (legs[i]) list.push(i);
      if (!list.length) { finishAll(false); return; }
      hasPlayed = true;
      var tm = timing(list.map(function (j) { return legs[j].len / u; }), o), t = 0, steps = [];
      list.forEach(function (j, n) { t += n === 0 ? Math.min(420, tm.pause) : tm.pause; steps.push({ leg: j, t0: t, t1: t + tm.legs[n] }); t += tm.legs[n]; });
      run = { steps: steps, end: t + 320, base: null, last: null, bring: {}, hidden: { legs: list.slice(), stops: [] } };
      bring.forEach(function (s) { run.bring[s] = 1; });
      // what the film will draw starts hidden; everything else shows as it is
      legs.forEach(function (l, j) { if (!l) return; l.done = list.indexOf(j) < 0; legAt(j, l.done ? 1 : 0); l.g.style.transition = ''; l.g.style.opacity = l.done && !keep ? '0' : ''; });
      cur.forEach(function (s, j) { var hide = !!run.bring[j]; stopShown(j, !hide); if (hide) run.hidden.stops.push(j); });
      if (o.onHide) o.onHide(run.hidden.legs.slice(), run.hidden.stops.slice());
      var first = list[0], p0 = pts[first];
      setVehicle(legs[first].mode); veh.style.display = ''; veh.style.opacity = '0';
      var pt = pointOn(first, 0); placeVehicle(p0[0], p0[1], pt.ang, legs[first].mode, 0.01);
      run.first = first;
      run.arrived = {}; if (run.bring[first]) { run.arrived[first] = 1; run.pendingArrive = first; }
      if (ctl) { btnSkip.hidden = false; }
      if (o.onStart) o.onStart();
      raf = requestFrame(tick);
    }
    function tick(now) {
      if (dead || !run) return;
      if (svg.isConnected === false) { endRun(true); return; }        // the map was taken off the page
      if (run.base == null) { run.base = now; run.last = now; }
      if (now - run.last > 250) run.base += now - run.last - 16;      // the tab was hidden or the page stalled: carry on where it was
      run.last = now; var t = now - run.base;
      rescale(false);
      if (run.pendingArrive != null) { var pa = run.pendingArrive; run.pendingArrive = null; arrive(pa, now); if (o.onArrive) o.onArrive(pa); }
      var active = null;
      for (var n = 0; n < run.steps.length; n++) {
        var st = run.steps[n], l = legs[st.leg];
        if (t >= st.t1) {
          if (!l.done) {
            l.done = true; legAt(st.leg, 1); if (!keep) fadeLeg(st.leg);
            if (o.onLeg) o.onLeg(st.leg);
            var to = st.leg + 1; if (!run.arrived[to]) { run.arrived[to] = 1; if (run.bring[to]) arrive(to, now); else ping(pts[to], now); if (o.onArrive) o.onArrive(to); }
          }
        } else if (t >= st.t0) { active = { st: st, f: ease((t - st.t0) / (st.t1 - st.t0)) }; break; }
        else { active = { st: st, f: 0, waiting: true }; break; }
      }
      // the vehicle: on its leg, or waiting at the stop for the next one (wearing the next leg's vehicle)
      if (active) {
        var j = active.st.leg, pt = pointOn(j, active.f);
        if (active.waiting) setVehicle(legs[j].mode);
        veh.style.opacity = '1';
        placeVehicle(pt.x, pt.y, pt.ang, legs[j].mode, active.waiting && n === 0 ? Math.max(0.01, easeBack(Math.max(0, Math.min(1, t / 260)))) : 1);
        if (!active.waiting) legAt(j, active.f);
      } else {
        var k = Math.min(1, (t - (run.end - 320)) / 320); veh.style.opacity = (1 - k).toFixed(3);
      }
      runAnims(now);
      if (t >= run.end) { endRun(false); return; }
      raf = requestFrame(tick);
    }
    function runAnims(now) {
      anims = anims.filter(function (a) { var k = Math.max(0, Math.min(1, (now - a.t0) / a.d)); a.f(k); return k < 1; });
    }
    function fadeLeg(i) {
      var l = legs[i]; if (!l) return; var g = l.g;
      g.style.transition = 'opacity .25s ease-out'; g.style.opacity = '0';
    }
    function endRun(skipped) {
      cancel();
      if (run) {
        var r = run; run = null;
        r.steps.forEach(function (st) { var l = legs[st.leg]; if (!l.done) { l.done = true; legAt(st.leg, 1); if (!keep) fadeLeg(st.leg); if (o.onLeg) o.onLeg(st.leg); } var to = st.leg + 1; if (!r.arrived[to]) { r.arrived[to] = 1; stopShown(to, true); if (o.onArrive) o.onArrive(to); } });
        if (r.pendingArrive != null) { stopShown(r.pendingArrive, true); if (o.onArrive) o.onArrive(r.pendingArrive); }
      }
      anims.forEach(function (a) { a.f(1); }); anims = [];
      cur.forEach(function (s, j) { stopShown(j, true); });
      dots.forEach(function (g, j) { if (g && pts[j]) g.firstChild.setAttribute('transform', 'translate(' + pts[j][0] + ' ' + pts[j][1] + ') scale(' + lastU.toFixed(4) + ')'); });
      names.forEach(function (g) { var t = g && g.querySelector('text'); if (t) t.removeAttribute('dy'); });
      veh.style.display = 'none';
      if (!keep) { legs.forEach(function (l) { if (l) { l.g.style.opacity = '0'; } }); }
      if (ctl) btnSkip.hidden = true;
      if (o.onEnd) o.onEnd(!!skipped);
      if (!skipped) queueLoop();
    }
    function finishAll(skipped) { if (run) endRun(skipped); else { showAll(); } }
    function showAll() {                 // the finished route, at once
      cancel(); legs.forEach(function (l, j) { if (l) { l.done = true; legAt(j, 1); if (!keep) l.g.style.opacity = '0'; else l.g.style.opacity = ''; } });
      cur.forEach(function (s, j) { stopShown(j, true); }); veh.style.display = 'none';
      if (ctl) btnSkip.hidden = true;
    }
    function cancel() { if (raf) { (root.cancelAnimationFrame || clearTimeout)(raf); raf = 0; } }

    /* ---------- looping, and knowing when the map is on screen ---------- */
    function seen(e) {                   // a third of the map on screen, or (for a tall map) half the screen
      return e.isIntersecting && (e.intersectionRatio >= 0.34 || !!(e.rootBounds && e.intersectionRect.height >= e.rootBounds.height * 0.5));
    }
    function watch() {
      if (observer || !root.IntersectionObserver) return;
      observer = new root.IntersectionObserver(function (es) {
        var was = onScreen; onScreen = seen(es[es.length - 1]);
        if (onScreen && !was) cameIntoView(); else if (!onScreen && was) clearHold();
      }, { threshold: [0, 0.2, 0.35, 0.6, 1] });
      observer.observe(svg);
    }
    function unwatch() { if (observer) { observer.disconnect(); observer = null; } }
    function cameIntoView() {
      if (dead) return;
      if (waitingFirst) { waitingFirst = false; if (!loopOn) unwatch(); playWhole(); return; }
      if (!loopOn || !idleSince || run || fading || stopped || reduced() || cur.length < 2) return;   // the loop starts after a first play
      clearHold();
      var left = hold - (Date.now() - idleSince);                       // away longer than the hold: play now, as on the first view
      if (left <= 0) loopAgain(); else holdTimer = setTimeout(loopAgain, left);
    }
    function clearHold() { if (holdTimer) { clearTimeout(holdTimer); holdTimer = 0; } }
    function queueLoop() {               // the film has finished: hold the finished route, then play it again
      clearHold();
      if (!loopOn || !hasPlayed || dead || stopped || reduced() || cur.length < 2) return;
      idleSince = Date.now();
      if (onScreen) holdTimer = setTimeout(loopAgain, hold);
    }
    function loopAgain() {
      holdTimer = 0;
      if (dead || run || fading || stopped || !onScreen || reduced() || svg.isConnected === false) return;
      // fade the finished route out, then draw it again from the first stop
      [gLines, gStops, gNames].forEach(function (g) { g.style.transition = 'opacity .4s ease-in'; g.style.opacity = '0'; });
      fading = setTimeout(function () {
        fading = 0;
        if (!dead && !run && !stopped && onScreen && !reduced()) playWhole();
        unfade();
      }, 420);
    }
    function unfade() { [gLines, gStops, gNames].forEach(function (g) { g.style.transition = 'none'; g.style.opacity = ''; }); }
    function stopFade() { if (fading) { clearTimeout(fading); fading = 0; unfade(); } }
    function playWhole() {               // the whole route, from the first stop
      clearHold(); stopFade();
      if (run) endRun(true);
      build(cur);
      if (reduced() || cur.length < 2) { showAll(); syncControls(); if (o.onEnd) o.onEnd(false); return; }
      startRun(0, cur.length - 2, cur.map(function (s, i) { return i; })); syncControls();
    }

    /* ---------- the buttons ---------- */
    function controls() {
      if (o.controls === false || ctl || !host || !doc) return;
      if (root.getComputedStyle && root.getComputedStyle(host).position === 'static') host.style.position = 'relative';
      ctl = doc.createElement('div'); ctl.className = 'rf-ctl';
      btnReplay = doc.createElement('button'); btnReplay.type = 'button'; btnReplay.className = 'rf-btn rf-replay'; btnReplay.setAttribute('aria-label', 'Replay the route');
      btnReplay.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 5V1L7 6l5 5V7a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z"/></svg><span>Replay</span>';
      btnSkip = doc.createElement('button'); btnSkip.type = 'button'; btnSkip.className = 'rf-btn rf-skip'; btnSkip.setAttribute('aria-label', 'Skip to the whole route'); btnSkip.hidden = true;
      btnSkip.innerHTML = '<span>Skip</span><svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>';
      btnReplay.addEventListener('click', function () { api.play(); });
      btnSkip.addEventListener('click', function () { api.skip(); });
      ctl.appendChild(btnSkip); ctl.appendChild(btnReplay); host.appendChild(ctl);
    }
    function syncControls() { if (!ctl) return; var still = reduced() || cur.length < 2; btnReplay.hidden = still; if (still || !run) btnSkip.hidden = true; }

    /* ---------- the public side ---------- */
    var api = {
      play: function () { if (dead) return; stopped = false; waitingFirst = false; if (!loopOn) unwatch(); playWhole(); },
      replay: function () { api.play(); },
      skip: function () { if (dead) return; if (loopOn) { stopped = true; clearHold(); stopFade(); } if (run) endRun(true); },
      set: function (list, how) {
        if (dead) return false;
        var next = norm(list), before = cur.map(function (s) { return s.place; }), after = next.map(function (s) { return s.place; });
        clearHold(); stopFade(); waitingFirst = false; if (!loopOn) unwatch();
        if (run) endRun(true);
        build(next);
        var f = how === 'none' || reduced() ? null : how === 'all' ? (next.length > 1 ? { from: 0, to: next.length - 2, stops: next.map(function (s, i) { return i; }) } : null) : fresh(before, after);
        if (!f) { showAll(); syncControls(); queueLoop(); return false; }
        startRun(f.from, f.to, f.stops); syncControls(); return true;
      },
      destroy: function () {
        dead = true; cancel(); clearHold(); stopFade(); unwatch();
        [gLines, gTop, ctl].forEach(function (n) { if (n && n.parentNode) n.parentNode.removeChild(n); });
      }
    };
    Object.defineProperty(api, 'playing', { get: function () { return !!run; } });
    Object.defineProperty(api, 'looping', { get: function () { return loopOn && !stopped && !dead && !reduced(); } });

    /* ---------- first draw ---------- */
    cur = norm(stops); controls(); build(cur);
    var auto = o.autoplay == null ? 'view' : o.autoplay;
    if (reduced() || cur.length < 2 || auto === false) { showAll(); }
    else if (auto === 'view' && root.IntersectionObserver) {
      // until it plays: just the first stop, where the trip starts
      legs.forEach(function (l, j) { legAt(j, 0); }); cur.forEach(function (s, j) { stopShown(j, j === 0); });
      waitingFirst = true;
    } else { api.play(); }
    if (waitingFirst || (loopOn && !reduced())) watch();
    syncControls();
    return api;
  }

  MMRouteFilm.CSS = CSS; MMRouteFilm.mode = mode; MMRouteFilm.timing = timing; MMRouteFilm.fresh = fresh; MMRouteFilm.arc = arc; MMRouteFilm.reduced = reduced; MMRouteFilm.SIDE = SIDE; MMRouteFilm.ICONS = ICONS;
  root.MMRouteFilm = MMRouteFilm;
  if (typeof module !== 'undefined' && module.exports) module.exports = MMRouteFilm;
})(typeof window !== 'undefined' ? window : globalThis);
