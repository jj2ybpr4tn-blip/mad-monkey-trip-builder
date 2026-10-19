/* UI smoke test: presses every button on the main screens and reports the ones that visibly do nothing.
   Run it in a browser tab on the builder:   await import('/test/ui-smoke.js?' + Date.now()); await __smoke()
   (serve the folder with `npm start`, open http://localhost:8000). It never needs a network: lead/status calls are stubbed.
   A "dead" button is one where nothing on the page changed after it was pressed: no new screen, modal, toast, scroll or address. */
(function () {
  var SKIP = { print: 1, ics: 1, dlstory: 1, copytext: 1, copylead: 1, share: 0, openpack: 0 };
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function djb(s) { var h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return h; }
  function snap() {
    var a = document.getElementById('app');
    // What is drawn on screen, not the address: an action that changes the address but leaves the screen as it was is a dead button.
    var mapView = (document.querySelector('#bmap svg') || {}).getAttribute ? (document.querySelector('#bmap svg').getAttribute('viewBox') || '') : '';
    return [a ? djb(a.innerHTML) : 0, mapView, document.querySelectorAll('.modal').length, document.querySelectorAll('.toast').length, Math.round(window.scrollY / 40),
      document.body.getAttribute('data-view')].join('|');
  }
  var TRIP = '#/build/i=s.hanoi.4~s.hoi-an.4~s.saigon.3&d=2027-02-10&f=20&b=1500';
  var SCENES = [
    { name: 'home', hash: '#/' },
    { name: 'builder (empty)', hash: '#/build', empty: true },
    { name: 'builder (trip)', hash: TRIP },
    { name: 'builder (trip, no date)', hash: '#/build/i=s.chiang-mai.3~s.luang-prabang.3~s.vang-vieng.3' },
    { name: 'builder (ALL IN block)', hash: '#/build/i=a.vietnam~s.saigon.2&d=2027-02-10' },
    { name: 'pack', hash: '#/pack/' + TRIP.slice(8) }
  ];
  function fresh(scene) {
    try { localStorage.clear(); sessionStorage.clear(); } catch (e) { /* ignore */ }
    if (scene.empty && window.MMApp) { window.MMApp.state = window.MM.defaultState(); window.MMApp.auto = false; }   // the trip lives in memory too, so start from nothing
    var same = location.hash === scene.hash; location.hash = scene.hash; if (same) window.dispatchEvent(new HashChangeEvent('hashchange'));
    return wait(450);
  }
  function targets() {
    return Array.prototype.slice.call(document.querySelectorAll('#app [data-act], #app [data-go], #app button[data-focus], #app [data-pref], #app .nextchip, body > .toast-root [data-act]'))
      .filter(function (el) { return !el.disabled && el.tagName !== 'A' && !SKIP[el.getAttribute('data-act')] && el.offsetParent !== null; });
  }
  function label(el) { return (el.getAttribute('data-act') || el.getAttribute('data-go') || el.className) + ' "' + el.textContent.replace(/\s+/g, ' ').trim().slice(0, 36) + '"'; }
  window.__smoke = async function () {
    var report = [], dead = [], errors = [];
    window.addEventListener('error', function (e) { errors.push(e.message); });
    var realOpen = window.open; window.open = function () { return null; }; var realConfirm = window.confirm; window.confirm = function () { return true; };
    var realFetch = window.fetch; window.fetch = function (u) { return Promise.resolve(new Response('{}', { status: 404 })); };
    for (var s = 0; s < SCENES.length; s++) {
      await fresh(SCENES[s]);
      var n = targets().length, sceneDead = 0;
      for (var i = 0; i < n; i++) {
        await fresh(SCENES[s]);
        var els = targets(); if (i >= els.length) break;
        var el = els[i], lab = label(el), before = snap();
        try { el.click(); } catch (e) { errors.push(SCENES[s].name + ' ' + lab + ': ' + e.message); }
        await wait(350);
        if (snap() === before) { dead.push(SCENES[s].name + ' > ' + lab); sceneDead++; }
      }
      report.push(SCENES[s].name + ': ' + n + ' buttons, ' + sceneDead + ' did nothing');
    }
    window.open = realOpen; window.confirm = realConfirm; window.fetch = realFetch;
    return { report: report, dead: dead, errors: errors };
  };
})();
