/* Route film test: runs the moving map (route-film.js) on a small test map and checks what a guest sees.
   Run it in a browser tab on the builder:   await import('/test/ui-film.js?' + Date.now()); await __film()
   (serve the folder with `npm start`, open http://localhost:8000). Takes about 25 seconds: the film runs fast here (speed 4).
   Checks: it waits until the map is on screen, draws, plays once unless asked to loop, loops with a hold in between and only while
   the map is on screen, Skip shows the finished route and stops the loop, Replay starts it again, and with reduced motion it just
   shows the finished route. Returns { pass, fail, fails: [what failed] }. */
(function () {
  var NS = 'http://www.w3.org/2000/svg';
  var STOPS = [{ place: 'hanoi', by: 'plane' }, { place: 'bangkok', by: 'bus' }, { place: 'siem-reap', by: 'boat' }, { place: 'kampot' }];
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  async function until(fn, ms) { for (var t = 0; t < (ms || 15000); t += 40) { if (fn()) return true; await wait(40); } return !!fn(); }
  // a test map, on screen at the top of the page or parked far above it
  function stage(onScreen) {
    var box = document.createElement('div'), svg = document.createElementNS(NS, 'svg');
    box.style.cssText = 'position:fixed;left:0;width:420px;z-index:99999;background:#163a33;top:' + (onScreen ? '0' : '-3000px');
    svg.setAttribute('viewBox', '60 40 300 480'); svg.style.cssText = 'display:block;width:100%;height:auto';
    box.appendChild(svg); document.body.appendChild(box);
    return { box: box, svg: svg, show: function (on) { box.style.top = on ? '0' : '-3000px'; }, remove: function () { box.remove(); } };
  }
  window.__film = async function () {
    var res = { pass: 0, fail: 0, fails: [] };
    function ok(name, cond, extra) { if (cond) res.pass++; else { res.fail++; res.fails.push(name + (extra != null ? ' (' + extra + ')' : '')); } }
    function film(st, opt) {
      var log = [], o = { speed: 4, pause: 120 }, k;
      for (k in opt) o[k] = opt[k];
      o.onStart = function () { log.push('start'); }; o.onEnd = function (sk) { log.push(sk ? 'skip' : 'end'); };
      var f = MMRouteFilm(st.svg, STOPS, o); f.log = log; return f;
    }
    function count(f, k) { return f.log.filter(function (x) { return x === k; }).length; }
    function hidden(st) { return st.svg.querySelectorAll('.rf-line[style*="hidden"]').length; }

    // 1. plays once, when the map comes on screen
    var s = stage(false), f = film(s, {}), n;
    await wait(500); ok('waits until the map is on screen', count(f, 'start') === 0 && hidden(s) === 3, f.log.join());
    s.show(true); ok('starts when the map comes on screen', await until(function () { return count(f, 'start') === 1; }, 1500));
    ok('draws, then ends', await until(function () { return count(f, 'end') === 1; }));
    ok('then shows the finished route, every place named', hidden(s) === 0 && s.svg.querySelectorAll('.rf-place').length === 4);
    await wait(1500); ok('plays once unless asked to loop', count(f, 'start') === 1, f.log.join());
    f.destroy(); s.remove();

    // 2. loops when asked, holding the finished route in between
    s = stage(true); f = film(s, { loop: true, hold: 600, autoplay: true });
    await until(function () { return count(f, 'end') === 1; });
    var t0 = performance.now();
    ok('plays again after the hold', await until(function () { return count(f, 'start') === 2; }, 3000));
    var gap = performance.now() - t0; ok('holds the finished route for about the hold time first', gap > 550 && gap < 1600, Math.round(gap) + 'ms');
    // 3. only while the map is on screen
    await until(function () { return count(f, 'end') === 2; }); s.show(false);
    n = count(f, 'start'); await wait(1600); ok('does not loop while the map is off screen', count(f, 'start') === n, f.log.join());
    s.show(true); ok('plays again when the map is back on screen', await until(function () { return count(f, 'start') === n + 1; }, 1500));
    // 4. Skip shows the finished route and stops the loop; Replay starts it again
    await wait(150); f.skip();
    ok('Skip shows the finished route', !f.playing && hidden(s) === 0 && f.log[f.log.length - 1] === 'skip', f.log.join());
    n = count(f, 'start'); await wait(1600); ok('Skip stops the loop', count(f, 'start') === n && !f.looping, f.log.join());
    f.replay(); ok('Replay plays it again', f.playing && f.looping);
    await until(function () { return count(f, 'end') >= 3; }); n = count(f, 'start');
    ok('the loop carries on after Replay', await until(function () { return count(f, 'start') === n + 1; }, 3000));
    f.destroy(); ok('destroy takes the film off the map', !s.svg.querySelector('.rf'));
    s.remove();

    // 5. autoplay off: nothing until .play(), even with the loop on; then it loops
    s = stage(true); f = film(s, { autoplay: false, loop: true, hold: 300 });
    await wait(1200); ok('autoplay off: nothing plays until play()', count(f, 'start') === 0, f.log.join());
    f.play(); await until(function () { return count(f, 'end') === 1; });
    ok('autoplay off: loops once it has played', await until(function () { return count(f, 'start') === 2; }, 2500), f.log.join());
    f.destroy(); s.remove();

    // 6. reduced motion: the finished route, no loop, no buttons
    var mm = window.matchMedia;
    window.matchMedia = function (q) { return /reduced-motion/.test(q) ? { matches: true, media: q, addListener: function () {}, removeListener: function () {} } : mm.call(window, q); };
    try {
      s = stage(true); f = film(s, { loop: true, hold: 300 });
      await wait(900);
      ok('reduced motion: nothing moves or loops', count(f, 'start') === 0 && !f.playing && !f.looping, f.log.join());
      ok('reduced motion: the finished route shows', hidden(s) === 0);
      var rb = s.box.querySelector('.rf-replay'); ok('reduced motion: no Replay button', !rb || rb.hidden);
      f.destroy(); s.remove();
    } finally { window.matchMedia = mm; }
    return res;
  };
})();
