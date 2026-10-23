/* ============================================================
   TRIP EDITING: one set of validated operations behind the screen controls and the day-by-day editor.

     MM.edit.apply(state, ops)         -> { ok, state, changes[], errors[] }   all-or-nothing; the input state is never touched
     MM.edit.describe(before, after)   -> ["Removed Hoi An", "Hanoi: 4 -> 5 nights", ...]   what changed, in words
     MM.edit.newStop(place, nights)    -> a stop with sensible starter tours

   Stop and day numbers are the ones the traveller sees (1-based): "stop 2", "day 6". Places and tours are ids.
   ============================================================ */
(function (r) {
  var MM = r.MM = r.MM || {}, U = MM.util, P = function () { return MM.PLACES; };
  var MAX_STOPS = 14, STYLE = { cheap: 'cheap', cheapest: 'cheap', balanced: 'balanced', smart: 'balanced', fast: 'fast', fastest: 'fast' };
  var STYLE_NAME = { cheap: 'Cheapest', balanced: 'Smart pick', fast: 'Fastest' };
  function clone(s) { return JSON.parse(JSON.stringify(s)); }
  function has(o, k) { return typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k); }     // an id, not "constructor" or "__proto__"
  function money(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
  function norm(s) { return String(s == null ? '' : s).toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim(); }
  function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }

  /* ---------- finding things by name ---------- */
  var ALIAS = (function () {                                   // what people type -> a place id (the terms live in data/places.js; the first place to claim a word keeps it)
    var a = {}; Object.keys(MM.PLACE_TERMS || {}).forEach(function (id) { MM.PLACE_TERMS[id].forEach(function (t) { if (!a[t]) a[t] = id; }); }); return a;
  })();
  // A place by id or by what a person would type. Returns { id } or { error } (with the candidates when it's ambiguous).
  function place(q) {
    var ids = Object.keys(P()); if (q == null || q === '') return { error: 'No place given.' };
    if (has(P(), q)) return { id: q };
    var n = norm(q); if (has(ALIAS, n) && has(P(), ALIAS[n])) return { id: ALIAS[n] };
    var exact = ids.filter(function (id) { return norm(P()[id].n) === n || norm(id) === n; }); if (exact.length === 1) return { id: exact[0] };
    var part = ids.filter(function (id) { return n && (norm(P()[id].n).indexOf(n) > -1 || n.indexOf(norm(P()[id].n)) > -1); });
    if (part.length === 1) return { id: part[0] };
    if (part.length > 1) return { error: '"' + q + '" could be ' + part.map(function (id) { return P()[id].n + ' (' + id + ')'; }).join(', ') + '. Use the id.' };
    return { error: 'There is no Mad Monkey called "' + q + '". Use search_places to find the id.' };
  }
  function tour(placeId, q) {
    if (!has(P(), placeId)) return { error: 'A packaged ALL IN trip comes with its own tours.' };
    var list = MM.actsAt(placeId); if (!q) return { error: 'No tour given.' };
    var ex = list.filter(function (a) { return a.id === q; })[0]; if (ex) return { id: ex.id };
    var n = norm(q), words = n.split(' ').filter(Boolean);
    var hit = list.filter(function (a) { var an = norm(a.n); return words.length && words.every(function (w) { return an.indexOf(w) > -1; }); });
    if (hit.length === 1) return { id: hit[0].id };
    if (hit.length > 1) return { error: '"' + q + '" matches ' + hit.slice(0, 5).map(function (a) { return a.n + ' (' + a.id + ')'; }).join('; ') + '. Use the id.' };
    return { error: 'No tour like "' + q + '" at ' + P()[placeId].n + '. Use search_tours.' };
  }
  MM.edit = { place: place, tour: tour };

  /* ---------- a new stop ---------- */
  function newStop(p, n) {
    n = n || P()[p].sug;
    var acts = MM.actsAt(p).filter(function (a) { return a.star && !a.multi; }).slice(0, n >= 3 ? 2 : 1).map(function (a) { return a.id; });
    return { kind: 'stop', p: p, n: n, acts: acts };
  }
  MM.edit.newStop = newStop;

  /* ---------- applying operations ---------- */
  var DATE = /^\d{4}-\d{2}-\d{2}$/;
  function stayDays(pl, idx) { return pl.days.filter(function (d) { return d.si === idx && d.kind === 'stay'; }); }
  function tidy(s) {                                  // pins can't outlive their tour or their day
    s.items.forEach(function (it) {
      if (it.kind !== 'stop' || !it.pins) return;
      Object.keys(it.pins).forEach(function (id) { if ((it.acts || []).indexOf(id) < 0 || it.pins[id] > it.n || it.pins[id] < 1) delete it.pins[id]; });
      if (!Object.keys(it.pins).length) delete it.pins;
    });
  }
  function needStop(s, n, err, forInsert) {
    var i = Math.round(+n) - 1;
    if (!(i >= 0 && i < s.items.length)) { err('There is no stop ' + n + ' (the trip has ' + plural(s.items.length, 'stop') + ').'); return null; }
    return i;
  }
  function label(it) { return it.kind === 'allin' ? 'ALL IN ' + ((MM.ALL_IN.filter(function (t) { return t.id === it.trip; })[0] || {}).n || '') : P()[it.p].n; }

  var OPS = {
    add_stop: function (s, o, e) {
      var p = place(o.place); if (p.error) return e(p.error);
      if (s.items.length >= MAX_STOPS) return e('That would be more than ' + MAX_STOPS + ' stops. Remove one first.');
      var n = o.nights == null ? P()[p.id].sug : Math.round(+o.nights); if (!(n >= 1 && n <= 30)) return e('Nights must be between 1 and 30.');
      var at = o.position == null ? s.items.length : Math.max(0, Math.min(s.items.length, Math.round(+o.position) - 1));
      s.items.splice(at, 0, newStop(p.id, n)); s.legPick = {};
      return 'Added ' + P()[p.id].n + ' (' + plural(n, 'night') + ') as stop ' + (at + 1);
    },
    remove_stop: function (s, o, e) {
      var i = needStop(s, o.stop, e); if (i == null) return; var name = label(s.items[i]);
      s.items.splice(i, 1); s.legPick = {}; return 'Removed ' + name;
    },
    move_stop: function (s, o, e) {
      var i = needStop(s, o.stop, e); if (i == null) return; var to = Math.round(+o.to) - 1;
      if (!(to >= 0 && to < s.items.length)) return e('Stop ' + o.stop + ' can\'t go to position ' + o.to + ' (the trip has ' + plural(s.items.length, 'stop') + ').');
      var it = s.items.splice(i, 1)[0]; s.items.splice(to, 0, it); s.legPick = {};
      return 'Moved ' + label(it) + ' to stop ' + (to + 1);
    },
    set_nights: function (s, o, e) {
      var i = needStop(s, o.stop, e); if (i == null) return; var it = s.items[i];
      if (it.kind !== 'stop') return e(label(it) + ' is a packaged ALL IN trip, so its nights are fixed. Customise it into separate stops first.');
      var n = Math.round(+o.nights); if (!(n >= 1 && n <= 30)) return e('Nights must be between 1 and 30.');
      var was = it.n; it.n = n; return P()[it.p].n + ': ' + plural(was, 'night') + ' to ' + plural(n, 'night');
    },
    swap_stop: function (s, o, e) {
      var i = needStop(s, o.stop, e); if (i == null) return; var it = s.items[i];
      if (it.kind !== 'stop') return e(label(it) + ' is a packaged ALL IN trip, so it can\'t be swapped for one hostel.');
      var p = place(o.place); if (p.error) return e(p.error);
      var was = P()[it.p].n, ns = newStop(p.id, it.n); s.items[i] = ns; s.legPick = {};
      return 'Swapped ' + was + ' for ' + P()[p.id].n + ' (' + plural(it.n, 'night') + ')';
    },
    add_tour: function (s, o, e) {
      var i = needStop(s, o.stop, e); if (i == null) return; var it = s.items[i];
      if (it.kind !== 'stop') return e('ALL IN trips come with their tours; customise it into separate stops to pick your own.');
      var t = tour(it.p, o.tour); if (t.error) return e(t.error);
      it.acts = it.acts || []; if (it.acts.indexOf(t.id) > -1) return e(MM.ACTS[t.id].n + ' is already in stop ' + o.stop + '.');
      it.acts.push(t.id); return 'Added ' + MM.ACTS[t.id].n + ' at ' + P()[it.p].n;
    },
    remove_tour: function (s, o, e) {
      var i = needStop(s, o.stop, e); if (i == null) return; var it = s.items[i];
      if (it.kind !== 'stop') return e('That stop is a packaged ALL IN trip.');
      var t = tour(it.p, o.tour); if (t.error) return e(t.error);
      var at = (it.acts || []).indexOf(t.id); if (at < 0) return e(MM.ACTS[t.id].n + ' isn\'t in stop ' + o.stop + '.');
      it.acts.splice(at, 1); if (it.pins) delete it.pins[t.id]; return 'Removed ' + MM.ACTS[t.id].n;
    },
    move_tour: function (s, o, e) {
      var i = needStop(s, o.stop, e); if (i == null) return; var it = s.items[i];
      if (it.kind !== 'stop') return e('That stop is a packaged ALL IN trip.');
      var t = tour(it.p, o.tour); if (t.error) return e(t.error);
      if ((it.acts || []).indexOf(t.id) < 0) return e(MM.ACTS[t.id].n + ' isn\'t in stop ' + o.stop + ' yet. Add it first.');
      var a = MM.ACTS[t.id]; if (a.multi && a.multi.d > 1) return e(a.n + ' is a multi-day trip, so it picks its own days.');
      var pl = MM.plan(s), days = stayDays(pl, i), at = days.map(function (d) { return d.n; }).indexOf(Math.round(+o.day));
      if (at < 0) return e('Day ' + o.day + ' isn\'t one of the days in ' + P()[it.p].n + ' (days ' + (days.length ? days[0].n + ' to ' + days[days.length - 1].n : 'none') + ').');
      it.pins = it.pins || {}; it.pins[t.id] = at + 1; var d = days[at];
      return 'Moved ' + a.n + ' to day ' + d.n + (d.dateLabel ? ' (' + d.dateLabel + ')' : '');
    },
    unpin_tour: function (s, o, e) {
      var i = needStop(s, o.stop, e); if (i == null) return; var it = s.items[i];
      if (it.kind !== 'stop') return e('That stop is a packaged ALL IN trip.');
      var t = tour(it.p, o.tour); if (t.error) return e(t.error);
      if (it.pins) delete it.pins[t.id]; return MM.ACTS[t.id].n + ' goes back to being scheduled automatically';
    },
    set_start: function (s, o, e) {
      if (o.date === '' || o.date === null) { s.start = ''; return 'Cleared the start date'; }
      if (!DATE.test(String(o.date || '')) || !U.parseDate(o.date)) return e('The start date must look like 2027-02-10.');
      if (o.date < U.isoDate(new Date())) return e('That date has already gone.');
      s.start = o.date; return 'Start date set to ' + U.fmtDate(U.parseDate(o.date)) + ' ' + o.date.slice(0, 4);
    },
    set_style: function (s, o, e) {
      var k = STYLE[norm(o.style)]; if (!k) return e('Style must be cheapest, smart or fastest.');
      s.pref = k; s.legPick = {}; return 'Travel style: ' + STYLE_NAME[k];
    },
    set_travel: function (s, o, e) {
      var i = needStop(s, o.stop, e); if (i == null) return; var k = STYLE[norm(o.mode)]; if (!k) return e('Mode must be cheapest, smart or fastest.');
      var pl = MM.plan(s), leg = pl.legs.filter(function (l) { return l.index === i; })[0];
      if (!leg) return e('There is no journey after stop ' + o.stop + '.');
      var opt = leg.options.filter(function (x) { return x.key === k; })[0];
      if (!opt) return e(P()[leg.from].n + ' to ' + P()[leg.to].n + ' has no separate ' + STYLE_NAME[k].toLowerCase() + ' option. Options: ' + leg.options.map(function (x) { return x.label + ' (' + x.modeLabel + ')'; }).join(', ') + '.');
      s.legPick = s.legPick || {}; s.legPick[i] = k; return P()[leg.from].n + ' to ' + P()[leg.to].n + ': ' + opt.modeLabel.toLowerCase() + ', ' + U.hoursLabel(opt.h) + ', ' + money(opt.u);
    },
    set_spending: function (s, o, e) {
      var n = Math.round(+o.per_day); if (!(n >= 0 && n <= 100)) return e('Spending money must be between $0 and $100 a day.');
      s.fund = n; return 'Food and fun fund: ' + money(n) + ' a day';
    },
    set_budget: function (s, o, e) {
      var n = Math.round(+o.amount); if (!(n >= 0 && n <= 99999)) return e('The budget must be between $0 and $99,999.');
      s.budget = n; return n ? 'Budget target: ' + money(n) : 'Cleared the budget target';
    },
    clear: function (s) { s.items = []; s.legPick = {}; return 'Cleared the whole trip'; }
  };
  MM.edit.OPS = Object.keys(OPS);

  // All-or-nothing: either every operation works and you get the new state, or you get the reasons and the original is untouched.
  MM.edit.apply = function (state, ops) {
    var s = clone(state || MM.defaultState()), changes = [], errors = [];
    if (!Array.isArray(ops) || !ops.length) return { ok: false, state: state, changes: [], errors: ['No changes were given.'] };
    if (ops.length > 20) return { ok: false, state: state, changes: [], errors: ['That is too many changes at once (20 at most).'] };
    ops.forEach(function (o, k) {
      var f = o && OPS[o.op];
      if (!f) { errors.push('Change ' + (k + 1) + ': unknown change "' + (o && o.op) + '". Known: ' + Object.keys(OPS).join(', ') + '.'); return; }
      var err = null, msg = f(s, o, function (m) { err = m; });
      if (err) errors.push('Change ' + (k + 1) + ' (' + o.op + '): ' + err); else if (msg) changes.push(msg);
    });
    if (errors.length) return { ok: false, state: state, changes: [], errors: errors };
    tidy(s);
    return { ok: true, state: s, changes: changes, errors: [] };
  };

  /* ---------- the quickest order ----------
     Keeps where you land (stop 1) and puts the rest in the order that costs the least travel: every journey's hours, with a dollar counted as
     five minutes. Up to 12 stops it tries every order (exact); beyond that it takes the nearest stop each time and then untangles it.
     Returns { state, savedH, savedUsd, before, after } or null when there is nothing worth changing. */
  MM.edit.bestOrder = function (state) {
    var items = (state && state.items) || [], n = items.length; if (n < 3) return null;
    var pref = state.pref || 'balanced', INF = 1e6;
    function firstOf(it) { return it.kind === 'allin' ? (MM.tripById(it.trip).stops[0].p) : it.p; }
    function lastOf(it) { var t = it.kind === 'allin' ? MM.tripById(it.trip) : null; return t ? t.stops[t.stops.length - 1].p : it.p; }
    var c = [], i, j, hop = {};
    for (i = 0; i < n; i++) { c[i] = []; for (j = 0; j < n; j++) {
      if (i === j) { c[i][j] = 0; continue; }
      var a = lastOf(items[i]), b = firstOf(items[j]), r = a === b ? { h: 0, u: 0 } : MM.route(a, b, pref);
      c[i][j] = r ? r.h + r.u / 12 : INF; hop[i + '>' + j] = r ? { h: r.h, u: r.u } : { h: 0, u: 0 };
    } }
    function pathCost(o) { var t = 0; for (var k = 1; k < o.length; k++) t += c[o[k - 1]][o[k]]; return t; }
    var best;
    if (n <= 12) {                                                  // exact: the cheapest way through every stop, starting at stop 1
      var m = n - 1, full = (1 << m) - 1, dp = [], par = [];
      for (var mask = 0; mask <= full; mask++) { dp[mask] = []; par[mask] = []; for (var e = 0; e < m; e++) dp[mask][e] = INF * 100; }
      for (e = 0; e < m; e++) { dp[1 << e][e] = c[0][e + 1]; par[1 << e][e] = -1; }
      for (mask = 1; mask <= full; mask++) for (e = 0; e < m; e++) {
        if (!(mask & (1 << e)) || dp[mask][e] >= INF * 100) continue;
        for (var f = 0; f < m; f++) { if (mask & (1 << f)) continue; var nm = mask | (1 << f), v = dp[mask][e] + c[e + 1][f + 1]; if (v < dp[nm][f] - 1e-9) { dp[nm][f] = v; par[nm][f] = e; } }
      }
      var be = 0; for (e = 1; e < m; e++) if (dp[full][e] < dp[full][be] - 1e-9) be = e;
      var seq = [], mk = full, cur = be; while (cur !== -1 && cur !== undefined) { seq.unshift(cur + 1); var pe = par[mk][cur]; mk &= ~(1 << cur); cur = pe; }
      best = [0].concat(seq);
    } else {                                                        // many stops: nearest next, then swap pairs while it helps
      var left = [], o = [0]; for (i = 1; i < n; i++) left.push(i);
      while (left.length) { var bi = 0; for (j = 1; j < left.length; j++) if (c[o[o.length - 1]][left[j]] < c[o[o.length - 1]][left[bi]]) bi = j; o.push(left.splice(bi, 1)[0]); }
      var improved = true, guard = 0;
      while (improved && guard++ < 50) { improved = false; for (i = 1; i < n - 1; i++) for (j = i + 1; j < n; j++) { var t = o.slice(0, i).concat(o.slice(i, j + 1).reverse(), o.slice(j + 1)); if (pathCost(t) < pathCost(o) - 1e-9) { o = t; improved = true; } } }
      best = o;
    }
    var now = items.map(function (_, k) { return k; });
    if (best.join() === now.join() || pathCost(best) >= pathCost(now) - 0.4) return null;          // not worth a shuffle: under about 25 minutes
    var st = JSON.parse(JSON.stringify(state)); st.items = best.map(function (k) { return JSON.parse(JSON.stringify(items[k])); }); st.legPick = {};
    var A = MM.plan(state).totals, B = MM.plan(st).totals;
    return { state: st, order: best, savedH: Math.max(0, Math.round((pathCost(now) - pathCost(best)) * 10) / 10), savedUsd: A.total - B.total, before: A, after: B };
  };

  /* ---------- what changed, in words ---------- */
  MM.edit.describe = function (a, b) {
    var out = [], A = (a && a.items) || [], B = (b && b.items) || [];
    function key(it) { return it.kind === 'allin' ? 'a:' + it.trip : 's:' + it.p; }
    var ak = A.map(key), bk = B.map(key);
    var gone = ak.filter(function (k) { return bk.indexOf(k) < 0; }), came = bk.filter(function (k) { return ak.indexOf(k) < 0; });
    var nm = function (k) { return k.slice(0, 2) === 'a:' ? 'ALL IN ' + ((MM.ALL_IN.filter(function (t) { return t.id === k.slice(2); })[0] || {}).n || '') : P()[k.slice(2)].n; };
    if (!B.length && A.length) return ['Cleared the trip'];
    gone.forEach(function (k) { out.push('Removed ' + nm(k)); }); came.forEach(function (k) { out.push('Added ' + nm(k)); });
    if (!gone.length && !came.length && A.length === B.length && ak.join() !== bk.join()) out.push('Changed the order of your stops');
    B.forEach(function (it, i) {
      var was = A.filter(function (x) { return key(x) === key(it); })[0]; if (!was || it.kind !== 'stop') return;
      if (was.n !== it.n) out.push(P()[it.p].n + ': ' + plural(was.n, 'night') + ' to ' + plural(it.n, 'night'));
      var plus = (it.acts || []).filter(function (id) { return (was.acts || []).indexOf(id) < 0; }), minus = (was.acts || []).filter(function (id) { return (it.acts || []).indexOf(id) < 0; });
      plus.forEach(function (id) { out.push('Added ' + MM.ACTS[id].n); }); minus.forEach(function (id) { out.push('Removed ' + MM.ACTS[id].n); });
      if (JSON.stringify(was.pins || {}) !== JSON.stringify(it.pins || {}) && !plus.length && !minus.length) out.push('Moved a tour to another day in ' + P()[it.p].n);
    });
    if ((a && a.start || '') !== (b && b.start || '')) out.push(b.start ? 'Start date: ' + b.start : 'Cleared the start date');
    if ((a && a.pref) !== (b && b.pref)) out.push('Travel style: ' + (STYLE_NAME[b.pref] || b.pref));
    if (!out.length && JSON.stringify(a) !== JSON.stringify(b)) out.push('Changed your trip');
    return out.slice(0, 6);
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = MM;
})(typeof window !== 'undefined' ? window : globalThis);
