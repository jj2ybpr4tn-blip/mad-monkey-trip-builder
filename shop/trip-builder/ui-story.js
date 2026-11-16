/* ============================================================
   STORY CARD — 1080×1920 poster of the guest's route, drawn on a canvas.
   Black canvas, Montserrat 900, one brand device (the lime starburst),
   official white wordmark bottom-right. No photos (they'd taint the canvas).
   ============================================================ */
(function (r) {
  var MM = r.MM = r.MM || {};
  var W = 1080, H = 1920, LIME = '#ccff01', PINK = '#ff01aa', BONE = '#f5efe2', BLACK = '#0a0a0a', PAPER = '#ffffff';

  function loadImgCors(src) { return new Promise(function (res) { if (!src) return res(null); var i = new Image(); i.crossOrigin = 'anonymous'; i.onload = function () { res(i); }; i.onerror = function () { res(null); }; i.src = src; }); }
  function loadImg(src) { return new Promise(function (res) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = function () { res(null); }; i.src = src; }); }
  function fonts() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.all([document.fonts.load('900 60px Montserrat'), document.fonts.load('700 30px Montserrat'), document.fonts.load('500 30px Montserrat')]).catch(function () {});
  }
  function arcPts(a, b) {
    var dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d; if (ny > 0) { nx = -nx; ny = -ny; }
    var k = d * 0.16; return [(a[0] + b[0]) / 2 + nx * k, (a[1] + b[1]) / 2 + ny * k];
  }
  function star(ctx, cx, cy, ro, ri, n) {
    ctx.beginPath(); for (var i = 0; i < n * 2; i++) { var rad = i % 2 ? ri : ro, ang = Math.PI * i / n - Math.PI / 2; ctx[i ? 'lineTo' : 'moveTo'](cx + rad * Math.cos(ang), cy + rad * Math.sin(ang)); } ctx.closePath();
  }

  // the route on a cropped map, black land / bone countries / lime line + numbered pins. k scales strokes for smaller cards.
  function drawRouteMap(ctx, plan, places, bx, by, bw, bh, F, k) {
    ctx.save(); ctx.beginPath(); ctx.rect(bx, by, bw, bh); ctx.clip();
    ctx.fillStyle = BLACK; ctx.fillRect(bx, by, bw, bh);
    var px = MM.routePx(places.length ? places : ['hanoi'], 170), vb = MM.viewBoxFor(px, bw / bh, 0.28), sc = bw / vb.w;
    ctx.save(); ctx.translate(bx, by); ctx.scale(sc, sc); ctx.translate(-vb.x, -vb.y);
    var P = MM.MAP.paths;
    ctx.lineJoin = 'round';
    ctx.fillStyle = '#1b1b1b'; ctx.fill(new Path2D(P.other), 'evenodd');
    ['TH', 'LA', 'VN', 'KH', 'ID', 'PH'].forEach(function (c) { var p2 = new Path2D(P[c]); ctx.fillStyle = BONE; ctx.fill(p2, 'evenodd'); ctx.lineWidth = 1.6 / sc; ctx.strokeStyle = BLACK; ctx.stroke(p2); });
    ctx.restore();
    var T = function (id) { var q = MM.proj(MM.PLACES[id].ll[0], MM.PLACES[id].ll[1]); return [bx + (q[0] - vb.x) * sc, by + (q[1] - vb.y) * sc]; };
    var seq = []; plan.segs.forEach(function (s) { if (s.kind === 'allin') s.trip.stops.forEach(function (st) { seq.push(st.p); }); else seq.push(s.p); });
    seq = seq.filter(function (p, i) { return i === 0 || p !== seq[i - 1]; });
    [[BLACK, 22 * k], [LIME, 10 * k]].forEach(function (st) {
      ctx.strokeStyle = st[0]; ctx.lineWidth = st[1]; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
      for (var i = 1; i < seq.length; i++) { var a = T(seq[i - 1]), b = T(seq[i]), c = arcPts(a, b); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(c[0], c[1], b[0], b[1]); }
      ctx.stroke();
    });
    var done = {};
    seq.forEach(function (id, i) {
      if (done[id]) return; done[id] = 1; var q = T(id);
      ctx.beginPath(); ctx.arc(q[0], q[1], 24 * k, 0, Math.PI * 2); ctx.fillStyle = LIME; ctx.fill(); ctx.lineWidth = 6 * k; ctx.strokeStyle = BLACK; ctx.stroke();
      ctx.fillStyle = BLACK; ctx.font = '900 ' + Math.round(24 * k) + 'px ' + F; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(i + 1), q[0], q[1] + 1);
    });
    ctx.restore(); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.lineWidth = 8 * k; ctx.strokeStyle = LIME; ctx.strokeRect(bx, by, bw, bh);
  }

  // 1200×630 link-preview card (WhatsApp, iMessage, Instagram DMs, Facebook): map left, the trip right
  MM.drawCard = function (canvas, plan, state, cur) {
    var CW = 1200, CH = 630; canvas.width = CW; canvas.height = CH; var ctx = canvas.getContext('2d');
    return Promise.all([fonts(), loadImg('assets/logo/mad-monkey-white.png')]).then(function (res) {
      var logo = res[1], F = 'Montserrat, system-ui, sans-serif', places = plan.places.slice();
      ctx.fillStyle = BLACK; ctx.fillRect(0, 0, CW, CH);
      drawRouteMap(ctx, plan, places, 0, 0, 560, CH, F, 0.62);
      var x = 610, w = CW - x - 50;
      ctx.fillStyle = LIME; ctx.font = '700 22px ' + F; if ('letterSpacing' in ctx) ctx.letterSpacing = '5px'; ctx.fillText('MY MONKEY ROUTE', x, 78); if ('letterSpacing' in ctx) ctx.letterSpacing = '-1px';
      var names = places.map(function (p) { return MM.PLACES[p].n.toUpperCase(); }); if (names.length > 5) names = names.slice(0, 4).concat(['+' + (names.length - 4) + ' MORE']);
      var size = 64; ctx.font = '900 ' + size + 'px ' + F;
      function widest() { return Math.max.apply(0, names.map(function (n) { return ctx.measureText(n).width; })); }
      while ((widest() > w || size * 0.95 * names.length > 300) && size > 30) { size -= 2; ctx.font = '900 ' + size + 'px ' + F; }
      var y = 78 + 20 + size * 0.9;
      names.forEach(function (n, i) { ctx.fillStyle = i === names.length - 1 && names.length > 1 ? LIME : PAPER; ctx.fillText(n, x, y); y += size * 0.95; });
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
      var t = plan.totals, sy = Math.max(y + 30, 450);
      [[String(t.days), 'DAYS'], [String(plan.countries.length), plan.countries.length === 1 ? 'COUNTRY' : 'COUNTRIES'], ['~' + MM.money(t.total, cur), 'EST. EACH']].forEach(function (s, i) {
        var cx = x + i * (w / 3); ctx.fillStyle = i === 2 ? LIME : PAPER; ctx.font = '900 ' + (i === 2 ? 42 : 48) + 'px ' + F; ctx.fillText(s[0], cx, sy);
        ctx.fillStyle = '#b3afa4'; ctx.font = '700 16px ' + F; if ('letterSpacing' in ctx) ctx.letterSpacing = '3px'; ctx.fillText(s[1], cx, sy + 28); if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
      });
      ctx.fillStyle = PINK; ctx.fillRect(x, CH - 92, 300, 46); ctx.fillStyle = BLACK; ctx.font = '900 20px ' + F; if ('letterSpacing' in ctx) ctx.letterSpacing = '2px'; ctx.fillText('OPEN + EDIT THE TRIP', x + 18, CH - 62); if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
      if (logo) { var lw = 130, lh = lw * logo.height / logo.width; ctx.drawImage(logo, CW - 44 - lw, CH - 40 - lh, lw, lh); }
      return canvas;
    });
  };

  MM.drawStory = function (canvas, plan, state, cur) {
    canvas.width = W; canvas.height = H; var ctx = canvas.getContext('2d');
    var firstP = plan.places[0];
    return Promise.all([fonts(), loadImg('assets/logo/mad-monkey-white.png'), loadImgCors(firstP ? (MM.hostelImg(firstP)) : null)]).then(function (res) {
      var logo = res[1], photo = res[2], F = 'Montserrat, system-ui, sans-serif';
      ctx.fillStyle = BLACK; ctx.fillRect(0, 0, W, H);
      var places = plan.places.slice(), PAD = 64;

      // eyebrow
      ctx.textBaseline = 'alphabetic'; ctx.fillStyle = LIME; ctx.font = '700 28px ' + F; if ('letterSpacing' in ctx) ctx.letterSpacing = '6px';
      ctx.fillText('MY MONKEY ROUTE', PAD, 110); if ('letterSpacing' in ctx) ctx.letterSpacing = '-2px';

      // title: one place per line, as big as fits
      var names = places.map(function (p) { return MM.PLACES[p].n.toUpperCase(); });
      if (names.length > 6) names = names.slice(0, 5).concat(['+' + (names.length - 5) + ' MORE']);
      var size = 156; ctx.font = '900 ' + size + 'px ' + F;
      function widest() { return Math.max.apply(0, names.map(function (n) { return ctx.measureText(n).width; })); }
      while ((widest() > W - PAD * 2 - 140 || size * 0.92 * names.length > 640) && size > 56) { size -= 4; ctx.font = '900 ' + size + 'px ' + F; }
      var y = 110 + 40 + size * 0.86;
      names.forEach(function (n, i) { ctx.fillStyle = i === names.length - 1 && names.length > 1 ? LIME : PAPER; ctx.fillText(n, PAD, y); y += size * 0.92; });
      var titleBottom = y - size * 0.92 + 24;
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';

      // map box
      var footerH = 430, bx = PAD, bw = W - PAD * 2, by = Math.round(titleBottom + 36);
      // a real Mad Monkey photo of the first stop, if there's room and the image host allows it
      if (photo && H - footerH - by >= 300 + 36 + 540) {
        ctx.save(); ctx.beginPath(); ctx.rect(bx, by, bw, 300); ctx.clip();
        var sc0 = Math.max(bw / photo.width, 300 / photo.height), pw = photo.width * sc0, ph = photo.height * sc0;
        try { ctx.filter = 'saturate(1.3) contrast(1.06)'; } catch (e) { /* older browsers */ }
        ctx.drawImage(photo, bx + (bw - pw) / 2, by + (300 - ph) / 2, pw, ph); ctx.restore();
        ctx.lineWidth = 8; ctx.strokeStyle = LIME; ctx.strokeRect(bx, by, bw, 300);
        ctx.fillStyle = BLACK; ctx.fillRect(bx, by + 300 - 52, 330, 52); ctx.fillStyle = LIME; ctx.font = '900 26px ' + F; if ('letterSpacing' in ctx) ctx.letterSpacing = '2px';
        ctx.fillText(('MAD MONKEY ' + MM.PLACES[firstP].n).toUpperCase().slice(0, 22), bx + 14, by + 300 - 17); if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
        by += 336;
      }
      var bh = Math.min(900, H - footerH - by);
      drawRouteMap(ctx, plan, places, bx, by, bw, bh, F, 1);
      // starburst device on the map corner
      var cx = bx + bw - 110, cy = by + 20;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(-8 * Math.PI / 180); star(ctx, 0, 0, 150, 118, 16); ctx.fillStyle = LIME; ctx.fill();
      ctx.fillStyle = BLACK; ctx.textAlign = 'center'; ctx.font = '900 70px ' + F; ctx.fillText(String(plan.totals.days), 0, 10);
      ctx.font = '900 30px ' + F; ctx.fillText('days', 0, 48); ctx.restore(); ctx.textAlign = 'left';

      // stats row
      var sy = by + bh + 96, stats = [[String(plan.totals.stops), 'STOPS'], [String(plan.countries.length), plan.countries.length === 1 ? 'COUNTRY' : 'COUNTRIES'], [plan.km.toLocaleString('en-GB'), 'KM'], ['~' + MM.money(plan.totals.total, cur), 'EST. TOTAL']];
      var colW = (W - PAD * 2) / stats.length;
      stats.forEach(function (s, i) {
        ctx.fillStyle = i === 3 ? LIME : PAPER; ctx.font = '900 ' + (i === 3 ? 62 : 70) + 'px ' + F; ctx.fillText(s[0], PAD + i * colW, sy);
        ctx.fillStyle = '#b3afa4'; ctx.font = '700 22px ' + F; if ('letterSpacing' in ctx) ctx.letterSpacing = '4px'; ctx.fillText(s[1], PAD + i * colW, sy + 40); if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
      });

      // footer
      ctx.fillStyle = PAPER; ctx.font = '900 60px ' + F; if ('letterSpacing' in ctx) ctx.letterSpacing = '-2px'; ctx.fillText('BUILD YOURS.', PAD, H - 150);
      ctx.fillStyle = LIME; ctx.font = '700 30px ' + F; if ('letterSpacing' in ctx) ctx.letterSpacing = '1px';
      ctx.fillText(((window.MM_CONFIG && MM_CONFIG.SITE_LABEL) || 'madmonkeyhostels.com').toUpperCase(), PAD, H - 100); if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
      if (logo) { var lw = 170, lh = lw * logo.height / logo.width; ctx.drawImage(logo, W - 48 - lw, H - 48 - lh, lw, lh); }
      return canvas;
    });
  };

  if (typeof module !== 'undefined') module.exports = {};
})(typeof window !== 'undefined' ? window : globalThis);
