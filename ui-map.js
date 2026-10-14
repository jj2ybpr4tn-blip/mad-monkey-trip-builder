/* ============================================================
   MAP — the SE Asia SVG map (builder) + static versions (hero, results, story)
   Geometry comes from data/map-data.js (Natural Earth, pre-projected).
   Pins/labels/route widths live in scaled groups so they stay the same
   size on screen at every zoom.
   ============================================================ */
(function (r) {
  var MM = r.MM = r.MM || {};
  var M = function () { return MM.MAP; };
  var NS = 'http://www.w3.org/2000/svg';

  /* ---------- geometry ---------- */
  function proj(lat, lon) {
    var m = M(), k = m.w / (m.lon1 - m.lon0), mer = function (l) { return Math.log(Math.tan(Math.PI / 4 + l * Math.PI / 360)); };
    return [(lon - m.lon0) * k, (mer(m.lat1) - mer(lat)) * k * 180 / Math.PI];
  }
  MM.proj = proj;
  function pp(id) { return proj(MM.PLACES[id].ll[0], MM.PLACES[id].ll[1]); }
  MM.REGIONS = {
    all: { n: 'All Asia', b: [-10.2, 96.8, 24.3, 128.2] },
    mainland: { n: 'Mainland', b: [7.2, 97, 23.6, 110] },
    thailand: { n: 'Thailand', b: [6.8, 97.2, 20.8, 102.8] },
    laos: { n: 'Laos', b: [17.6, 100.6, 20.6, 104.2] },
    vietnam: { n: 'Vietnam', b: [9.8, 104.2, 22.8, 109.8] },
    cambodia: { n: 'Cambodia', b: [10.2, 102.6, 14.2, 105.4] },
    indonesia: { n: 'Bali + Lombok', b: [-9.4, 114.7, -8.0, 116.7] },
    philippines: { n: 'Philippines', b: [8.4, 119.0, 15.3, 127.0] }
  };
  function bboxPx(b) { var a = proj(b[2], b[1]), c = proj(b[0], b[3]); return { x0: a[0], y0: a[1], x1: c[0], y1: c[1] }; }
  function viewBoxFor(px, aspect, pad) {
    var w = (px.x1 - px.x0) * (1 + pad * 2), h = (px.y1 - px.y0) * (1 + pad * 2), cx = (px.x0 + px.x1) / 2, cy = (px.y0 + px.y1) / 2;
    if (w / h < aspect) w = h * aspect; else h = w / aspect;
    return { x: cx - w / 2, y: cy - h / 2, w: w, h: h };
  }
  MM.viewBoxFor = viewBoxFor; MM.bboxPx = bboxPx;
  function routePx(places, minW) {
    var xs = [], ys = []; places.forEach(function (p) { var q = pp(p); xs.push(q[0]); ys.push(q[1]); });
    var x0 = Math.min.apply(0, xs), x1 = Math.max.apply(0, xs), y0 = Math.min.apply(0, ys), y1 = Math.max.apply(0, ys);
    if (x1 - x0 < minW) { var c = (x0 + x1) / 2; x0 = c - minW / 2; x1 = c + minW / 2; }
    if (y1 - y0 < minW) { var d = (y0 + y1) / 2; y0 = d - minW / 2; y1 = d + minW / 2; }
    return { x0: x0, y0: y0, x1: x1, y1: y1 };
  }
  MM.routePx = routePx;

  function arc(a, b, bend) {
    var dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy);
    if (d < 1) return { d: 'M' + a[0] + ' ' + a[1], mid: a, len: 0 };
    var nx = -dy / d, ny = dx / d; if (ny > 0) { nx = -nx; ny = -ny; }          // bulge upward
    var k = d * (bend == null ? 0.16 : bend), cx = (a[0] + b[0]) / 2 + nx * k, cy = (a[1] + b[1]) / 2 + ny * k;
    var mid = [0.25 * a[0] + 0.5 * cx + 0.25 * b[0], 0.25 * a[1] + 0.5 * cy + 0.25 * b[1]];
    return { d: 'M' + a[0].toFixed(1) + ' ' + a[1].toFixed(1) + ' Q' + cx.toFixed(1) + ' ' + cy.toFixed(1) + ' ' + b[0].toFixed(1) + ' ' + b[1].toFixed(1), mid: mid, len: d * 1.1 };
  }

  /* ---------- icons (Material Design, Apache 2.0) ---------- */
  var ICON = {
    flight: 'M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z',
    bus: 'M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z',
    train: 'M12 2c-4 0-8 .5-8 4v9.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h2.23l2-2H14l2 2h2v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-3.58-4-8-4zM7.5 17c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm3.5-7H6V6h5v4zm2 0V6h5v4h-5zm3.5 7c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z',
    boat: 'M20 21c-1.39 0-2.78-.47-4-1.32-2.44 1.71-5.56 1.71-8 0C6.78 20.53 5.39 21 4 21H2v2h2c1.38 0 2.74-.35 4-.99 2.52 1.29 5.48 1.29 8 0 1.26.65 2.62.99 4 .99h2v-2h-2zM3.95 19H4c1.6 0 3.02-.88 4-2 .98 1.12 2.4 2 4 2s3.02-.88 4-2c.98 1.12 2.4 2 4 2h.05l1.89-6.68c.08-.26.06-.54-.06-.78s-.34-.42-.6-.5L20 10.62V6c0-1.1-.9-2-2-2h-3V1H9v3H6c-1.1 0-2 .9-2 2v4.62l-1.29.42c-.26.08-.48.26-.6.5s-.14.52-.05.78L3.95 19zM6 6h12v3.97L12 8 6 9.97V6z',
    taxi: 'M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z'
  };
  ICON.van = ICON.bus;
  MM.modeIcon = function (m, cls) { return '<svg viewBox="0 0 24 24" aria-hidden="true"' + (cls ? ' class="' + cls + '"' : '') + '><path d="' + (ICON[m] || ICON.bus) + '"/></svg>'; };
  MM.ICON = ICON;

  var LBL = { pai: { a: 'end' }, 'koh-sdach': { a: 'end' }, 'koh-rong': { a: 'end' }, kampot: { a: 'end', dy: 16 }, dumaguete: { a: 'end' }, 'nacpan-beach': { a: 'end' }, 'uluwatu': { a: 'end' },
    'nusa-lembongan': { a: 'start', dy: -4 }, 'kuta-lombok': { a: 'start', dy: 12 }, 'gili-trawangan': { a: 'start', dy: -6 }, 'phnom-penh': { a: 'start', dy: 14 }, 'siem-reap': { a: 'end' }, saigon: { a: 'start', dy: 6 },
    'vang-vieng': { a: 'end', dy: 8 }, 'luang-prabang': { a: 'end', dy: -2 }, siquijor: { a: 'start', dy: 12 }, panglao: { a: 'start', dy: 6 }, 'hoi-an': { a: 'start' }, manila: { a: 'start' } };
  var COUNTRY_LBL = [['THAILAND', 15.6, 100.6, 'TH'], ['LAOS', 19.9, 103.3, 'LA'], ['VIETNAM', 18.6, 106.2, 'VN'], ['CAMBODIA', 12.9, 104.9, 'KH'], ['INDONESIA', -6.9, 112.2, 'ID'], ['PHILIPPINES', 12.3, 122.4, 'PH']];

  function landMarkup(opts) {
    var m = M(), paths = m.paths, out = '<rect class="m-sea" x="-2000" y="-2000" width="6000" height="6000"/>';
    if (!opts || opts.other !== false) out += '<path class="m-other" vector-effect="non-scaling-stroke" fill-rule="evenodd" d="' + paths.other + '"/>';
    ['TH', 'LA', 'VN', 'KH', 'ID', 'PH'].forEach(function (c) { out += '<path class="m-land" data-c="' + c + '" vector-effect="non-scaling-stroke" fill-rule="evenodd" d="' + paths[c] + '"/>'; });
    return out;
  }

  /* ============================================================
     STATIC MAP (hero / results) — returns an SVG string
     opts: {places:[ids in order], aspect, pad, minW, dots:true, labels:true, animate:true, all:true}
     ============================================================ */
  MM.staticMap = function (o) {
    o = o || {}; var aspect = o.aspect || 1, px;
    if (o.region) px = bboxPx(MM.REGIONS[o.region].b); else if (o.places && o.places.length) px = routePx(o.places, o.minW || 160); else px = bboxPx(MM.REGIONS.all.b);
    var vb = viewBoxFor(px, aspect, o.pad == null ? 0.22 : o.pad), u = vb.w / (o.px || 520);
    var s = '<svg viewBox="' + vb.x.toFixed(1) + ' ' + vb.y.toFixed(1) + ' ' + vb.w.toFixed(1) + ' ' + vb.h.toFixed(1) + '" xmlns="' + NS + '" role="img" aria-label="' + (o.label || 'Map of Southeast Asia') + '" preserveAspectRatio="xMidYMid ' + (o.slice ? 'slice' : 'meet') + '">';
    s += landMarkup({ other: o.other });
    if (o.countryLabels) COUNTRY_LBL.forEach(function (c) { var q = proj(c[1], c[2]); s += '<text class="m-lbl" x="' + q[0].toFixed(1) + '" y="' + q[1].toFixed(1) + '" font-size="' + (13 * u).toFixed(1) + '">' + c[0] + '</text>'; });
    if (o.dots) Object.keys(MM.PLACES).forEach(function (id) { var q = pp(id); s += '<circle cx="' + q[0].toFixed(1) + '" cy="' + q[1].toFixed(1) + '" r="' + (3.6 * u).toFixed(1) + '" fill="' + (MM.PLACES[id].partner ? '#8a867b' : '#f5efe2') + '" stroke="#0a0a0a" stroke-width="' + (1.4 * u).toFixed(1) + '"/>'; });
    if (o.routes) o.routes.forEach(function (rt, ri) {
      var d = '', pts = rt.map(pp);
      for (var i = 1; i < pts.length; i++) { var a = arc(pts[i - 1], pts[i]); d += a.d + ' '; }
      var anim = o.animate ? ' style="stroke-dasharray:1;stroke-dashoffset:1;animation:hdraw ' + (4 + ri) + 's ' + (ri * 1.3) + 's ease-in-out infinite" pathLength="1"' : '';
      if (!o.animate) s += '<path d="' + d + '" fill="none" stroke="#0a0a0a" stroke-width="' + (8 * u).toFixed(1) + '" stroke-linecap="round" stroke-linejoin="round"/>';
      s += '<path d="' + d + '" fill="none" stroke="' + (rt.col || '#ccff01') + '" stroke-width="' + (4.2 * u).toFixed(1) + '" stroke-linecap="round" stroke-linejoin="round"' + anim + '/>';
    });
    if (o.places && o.places.length) {
      var seen = {};
      o.places.forEach(function (id, i) {
        var q = pp(id), first = !seen[id]; seen[id] = 1; if (!first) return;
        s += '<g transform="translate(' + q[0].toFixed(1) + ' ' + q[1].toFixed(1) + ') scale(' + u.toFixed(3) + ')"><circle r="10" fill="#ccff01" stroke="#0a0a0a" stroke-width="3"/><text y="1" text-anchor="middle" dominant-baseline="central" font-family="Montserrat,sans-serif" font-weight="900" font-size="11" fill="#0a0a0a">' + (i + 1) + '</text>';
        if (o.labels) s += '<text x="' + (LBL[id] && LBL[id].a === 'end' ? -15 : 15) + '" y="' + ((LBL[id] && LBL[id].dy) || 4) + '" text-anchor="' + ((LBL[id] && LBL[id].a) || 'start') + '" font-family="Montserrat,sans-serif" font-weight="900" font-size="12" fill="#fff" stroke="#0a0a0a" stroke-width="4" paint-order="stroke" style="text-transform:uppercase">' + MM.PLACES[id].n + '</text>';
        s += '</g>';
      });
    }
    return s + '</svg>';
  };

  /* ============================================================
     BUILDER MAP — interactive
     ============================================================ */
  var BM = MM.BuilderMap = (function () {
    var box, svg, gLand, gRoute, gPins, tip, vb, vbTarget, anim, scale = 1, handlers = {}, drawn = {}, focus = [], lastPlan = null, lastState = null, selMap = {}, showLabelsAll = false;

    function el(name, attrs, parent) { var e = document.createElementNS(NS, name); for (var k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
    function size() { var b = box.getBoundingClientRect(); return { w: Math.max(200, b.width), h: Math.max(200, b.height) }; }

    function mount(container, h) {
      box = container; handlers = h || {}; box.innerHTML = '';
      svg = el('svg', { xmlns: NS, role: 'application', 'aria-label': 'Interactive map. Tab to a hostel and press Enter to add it to your trip.', preserveAspectRatio: 'xMidYMid meet' }); box.appendChild(svg);
      gLand = el('g', {}, svg); gLand.innerHTML = landMarkup();
      var cl = el('g', { 'class': 'm-ctry' }, svg);
      gRoute = el('g', {}, svg); gPins = el('g', {}, svg);
      COUNTRY_LBL.forEach(function (c) { var q = proj(c[1], c[2]); var t = el('text', { 'class': 'm-lbl', x: q[0], y: q[1], 'data-c': c[3] }, cl); t.textContent = c[0]; });
      Object.keys(MM.PLACES).forEach(function (id) {
        var p = MM.PLACES[id], q = pp(id), l = LBL[id] || {};
        var g = el('g', { 'class': 'm-pin' + (p.partner ? ' partner' : ''), 'data-p': id, tabindex: 0, role: 'button', 'aria-label': 'Add ' + p.n + ' to your trip' }, gPins);
        var inner = el('g', { 'data-pos': q[0] + ',' + q[1] }, g);
        el('circle', { r: 20, fill: 'transparent' }, inner);
        el('circle', { 'class': 'dot', r: 9 }, inner);
        var n = el('text', { 'class': 'n', y: 1 }, inner);
        var nm = el('text', { 'class': 'nm', x: l.a === 'end' ? -15 : 15, y: l.dy == null ? 4 : l.dy, 'text-anchor': l.a || 'start', 'font-size': 12 }, inner); nm.textContent = p.n;
        g.addEventListener('click', function (e) { e.stopPropagation(); handlers.pin && handlers.pin(id); });
        g.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handlers.pin && handlers.pin(id); } });
        g.addEventListener('mouseenter', function () { showTip(id, g); });
        g.addEventListener('focus', function () { showTip(id, g); });
        g.addEventListener('mouseleave', hideTip); g.addEventListener('blur', hideTip);
      });
      tip = document.createElement('div'); tip.className = 'bmap__tip'; box.appendChild(tip);
      window.removeEventListener('resize', onResize); window.addEventListener('resize', onResize);
      vb = null; drawn = {}; lastPlan = null;
    }
    function onResize() { if (!box || !box.isConnected) return; refit(true); }

    function showTip(id, g) {
      if (!tip) return; var p = MM.PLACES[id], img = MM.hostelImg(id), c = g.querySelector('.dot').getBoundingClientRect(), b = box.getBoundingClientRect();
      var ctry = MM.COUNTRIES[p.c].n;
      tip.innerHTML = (img ? '<div class="photo"><img src="' + img + '" alt="" loading="lazy" onerror="this.parentNode.className+=\' photo--none\';this.remove()"></div>' : '') +
        '<div class="tx"><b>' + p.n + '</b><p>' + p.hook + '</p><small>' + ctry + ' · dorm from ' + MM.money(p.bed, (window.MMApp && MMApp.cur) || 'USD') + '/night' + (p.opens ? ' · opens ' + p.opens.slice(8) + '/' + p.opens.slice(5, 7) : '') + (p.partner ? ' · partner hostel' : '') + '</small>' +
        (p.next.length ? '<small style="color:#5b574d;margin-top:3px;text-transform:none;letter-spacing:0;font-weight:600">Guests go next: ' + p.next.slice(0, 3).map(function (n) { return MM.PLACES[n].n; }).join(' · ') + '</small>' : '') + '</div>';
      var x = c.left + c.width / 2 - b.left, y = c.top - b.top, below = y < 270;
      x = Math.max(124, Math.min(b.width - 124, x)); tip.style.left = x + 'px'; tip.style.top = (below ? y + c.height : y) + 'px'; tip.classList.toggle('below', below); tip.classList.add('on');
    }
    function hideTip() { if (tip) tip.classList.remove('on'); }

    function setView(v) {
      vb = v; svg.setAttribute('viewBox', v.x.toFixed(2) + ' ' + v.y.toFixed(2) + ' ' + v.w.toFixed(2) + ' ' + v.h.toFixed(2));
      scale = v.w / size().w; applyScale();
    }
    function applyScale() {
      var u = scale;
      var pins = gPins.children;
      for (var i = 0; i < pins.length; i++) { var inner = pins[i].firstChild, pos = inner.getAttribute('data-pos').split(','); inner.setAttribute('transform', 'translate(' + pos[0] + ' ' + pos[1] + ') scale(' + u.toFixed(4) + ')'); }
      var lb = svg.querySelectorAll('.m-lbl'); for (var j = 0; j < lb.length; j++) lb[j].setAttribute('font-size', (15 * u).toFixed(2));
      var cs = gRoute.querySelectorAll('[data-w]'); for (var k = 0; k < cs.length; k++) cs[k].setAttribute('stroke-width', (+cs[k].getAttribute('data-w') * u).toFixed(2));
      var ms = gRoute.querySelectorAll('.m-mode'); for (var m2 = 0; m2 < ms.length; m2++) { var mp = ms[m2].getAttribute('data-pos').split(','); ms[m2].setAttribute('transform', 'translate(' + mp[0] + ' ' + mp[1] + ') scale(' + u.toFixed(4) + ')'); }
    }
    function inFocus(c) { return !focus.length || focus.indexOf(c) > -1; }
    function targetView(plan) {
      var s = size(), aspect = s.w / s.h;
      if (focus.length) {
        var ps = Object.keys(MM.PLACES).filter(function (id) { return focus.indexOf(MM.PLACES[id].c) > -1; });
        return viewBoxFor(routePx(ps, 120), aspect, 0.16);
      }
      var rp = plan && plan.places && plan.places.length ? plan.places : null;
      if (!rp) return viewBoxFor(bboxPx(MM.REGIONS.all.b), aspect, 0.02);
      return viewBoxFor(routePx(rp, 330), aspect, 0.28);
    }
    function refit(instant) {
      if (!svg) return; var t = targetView(lastPlan);
      if (instant || !vb) { cancelAnimationFrame(anim); setView(t); return; }
      var from = { x: vb.x, y: vb.y, w: vb.w, h: vb.h }, t0 = null, dur = 650;
      cancelAnimationFrame(anim);
      (function step(ts) {
        if (t0 == null) t0 = ts; var p = Math.min(1, (ts - t0) / dur), e = p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        setView({ x: from.x + (t.x - from.x) * e, y: from.y + (t.y - from.y) * e, w: from.w + (t.w - from.w) * e, h: from.h + (t.h - from.h) * e });
        if (p < 1) anim = requestAnimationFrame(step);
      })(performance.now());
    }

    function update(plan, state, foc) {
      if (!svg) return; lastPlan = plan; lastState = state;
      var prevKey = focus.join(','); focus = foc || [];
      // pins: numbers + selected
      selMap = {}; var seq = [];
      plan.segs.forEach(function (s) { if (s.kind === 'allin') s.trip.stops.forEach(function (st) { seq.push(st.p); }); else seq.push(s.p); });
      seq = seq.filter(function (p, i) { return i === 0 || p !== seq[i - 1]; });
      seq.forEach(function (p, i) { if (!selMap[p]) selMap[p] = i + 1; });
      var labelsAll = focus.length === 1 || (!focus.length && plan.places.length && viewSpanSmall(plan));
      Array.prototype.forEach.call(gPins.children, function (g) {
        var id = g.getAttribute('data-p'), n = selMap[id];
        var inF = inFocus(MM.PLACES[id].c);
        g.setAttribute('class', 'm-pin' + (MM.PLACES[id].partner ? ' partner' : '') + (n ? ' sel' : '') + (!inF && n ? ' off' : ''));
        g.style.display = (!inF && !n) ? 'none' : '';
        g.querySelector('.n').textContent = n || '';
        g.querySelector('.nm').style.display = (n || (labelsAll && inF)) ? '' : 'none';
        g.setAttribute('aria-label', (n ? 'Stop ' + n + ': ' : 'Add ') + MM.PLACES[id].n + (n ? '' : ' to your trip'));
      });
      Array.prototype.forEach.call(svg.querySelectorAll('.m-land'), function (p) { p.classList.toggle('dim', !inFocus(p.getAttribute('data-c'))); });
      Array.prototype.forEach.call(svg.querySelectorAll('.m-lbl'), function (t) { t.style.display = inFocus(t.getAttribute('data-c')) ? '' : 'none'; });
      // route
      var now = {}; gRoute.innerHTML = '';
      var path = [], idx = 0;
      plan.segs.forEach(function (s, si) {
        if (s.kind === 'allin') s.trip.stops.forEach(function (st) { path.push({ p: st.p, block: true }); });
        else path.push({ p: s.p, block: false });
      });
      var legByFrom = {}; plan.legs.forEach(function (l) { legByFrom[l.from + '>' + l.to] = l; });
      for (var i = 1; i < path.length; i++) {
        var a = path[i - 1].p, b = path[i].p; if (a === b) continue;
        var A = pp(a), B = pp(b), c = arc(A, B), key = a + '>' + b, blk = path[i].block && path[i - 1].block;
        var isNew = !drawn[key]; now[key] = 1;
        var sg = el('g', { 'class': 'm-seg' + (inFocus(MM.PLACES[a].c) && inFocus(MM.PLACES[b].c) ? '' : ' m-faded') }, gRoute);
        var cs = el('path', { 'class': 'm-case', d: c.d, 'data-w': 10 }, sg);
        var rp = el('path', { 'class': 'm-route' + (isNew ? ' m-draw' : ''), d: c.d, 'data-w': 4.6, style: blk ? 'stroke:#ff01aa' : '' }, sg);
        if (isNew) { rp.style.setProperty('--len', c.len * 1.4); rp.style.strokeDasharray = c.len * 1.4; }
        var leg = legByFrom[key];
        if (leg || blk) {
          var main = leg ? leg.chosen.main : 'bus', label = leg ? MM.util.hoursLabel(leg.h) : 'ALL IN';
          var g = el('g', { 'class': 'm-mode', 'data-pos': c.mid[0].toFixed(1) + ',' + c.mid[1].toFixed(1) }, sg);
          var w = Math.max(46, 34 + label.length * 8);
          el('rect', { x: -w / 2, y: -12, width: w, height: 24, rx: 12 }, g);
          var ic = el('path', { d: ICON[main] || ICON.bus, transform: 'translate(' + (-w / 2 + 6) + ' -8) scale(.66)' }, g);
          var tx = el('text', { x: -w / 2 + 25, y: 1 }, g); tx.textContent = label;
          if (blk) { g.querySelector('rect').setAttribute('style', 'stroke:#ff01aa'); ic.setAttribute('style', 'fill:#ff01aa'); }
        }
      }
      drawn = now;
      applyScale();
      // view
      if (!vb) refit(true); else if (prevKey !== focus.join(',') || !focus.length) refit(false);
    }
    function viewSpanSmall(plan) { var px = routePx(plan.places, 150); return (px.x1 - px.x0) < 520; }

    return { mount: mount, update: update, refit: refit };
  })();

  if (typeof module !== 'undefined') module.exports = {};
})(typeof window !== 'undefined' ? window : globalThis);
