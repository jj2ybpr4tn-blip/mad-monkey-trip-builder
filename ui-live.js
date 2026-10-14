/* ============================================================
   LIVE DATA — spots left, real fares, real reviews, real "guests go next", analytics.
   Everything here is optional and fails quietly: with no API the builder uses its built-in
   estimates. Fed by the crew console (/admin) when the bundled server is running.
   ============================================================ */
(function () {
  var A = window.MMApp, MM = window.MM, C = window.MM_CONFIG || {}, u = A.util;
  MM.LIVE = { spots: {}, notice: '' };

  function get(url) { return fetch(url, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); }

  // fares: patch the transport graph, then drop cached routes
  function applyLive(L) {
    MM.LIVE = { spots: L.spots || {}, notice: L.notice || '', updated: L.updated };
    var n = 0;
    Object.keys(L.legs || {}).forEach(function (k) {
      var p = k.split('|'); if (p.length !== 3) return;
      MM.EDGES.forEach(function (e) {
        if (e.m === p[2] && ((e.a === p[0] && e.b === p[1]) || (e.a === p[1] && e.b === p[0]))) { if (L.legs[k].u != null) e.u = L.legs[k].u; if (L.legs[k].h != null) e.h = L.legs[k].h; e.live = true; n++; }
      });
    });
    Object.keys(L.acts || {}).forEach(function (id) { if (MM.ACTS[id]) { MM.ACTS[id].usd = L.acts[id]; MM.ACTS[id].est = false; MM.ACTS[id].live = true; n++; } });
    if (n && MM.resetRoutes) MM.resetRoutes();
  }
  function applyReviews(R) { Object.keys(R || {}).forEach(function (h) { if (MM.PLACES[h]) MM.REVIEWS[h] = R[h]; }); }

  function boot() {
    var jobs = [];
    if (C.LIVE_ENDPOINT) jobs.push(get(C.LIVE_ENDPOINT).then(applyLive).catch(function () {}));
    if (C.REVIEWS_ENDPOINT) jobs.push(get(C.REVIEWS_ENDPOINT).then(applyReviews).catch(function () {}));
    if (C.FLOW_ENDPOINT) jobs.push(get(C.FLOW_ENDPOINT).then(function (f) { if (MM.setFlow) MM.setFlow(f.rows || []); }).catch(function () {}));
    if (jobs.length) Promise.all(jobs).then(function () { if (A.rerender) A.rerender(); });
  }
  A.liveBoot = boot;
  boot();
})();
