/* ============================================================
   ALL IN SITE HAND-OFF: a guest who taps "Carry on in the trip builder" on the ALL IN site lands here with the trip
   in the link and ?via=allin&trip=<id>&tn=<name>&part=<first>.<count>&away=<nights> in the address (extras.js reads it,
   MM.allinFrom). This file:
     • names the trip and marks which stops are the ALL IN trip, so a guest never lands on an anonymous DIY route
     • stops the "this looks like ALL IN Cambodia, swap it in" card arguing with the trip they just picked
     • links back to the trip's page on the ALL IN site (MM_CONFIG.ALLIN_SITE; no link while that's blank)
     • tells the crew, in the lead (allinSite) and their text, which trip it started from and what the guest changed
   Nothing from the address is trusted or priced: the name is a checked label, prices are the builder's own estimates
   and the crew prices the trip before anyone pays.
   ============================================================ */
(function () {
  'use strict';
  var MM = window.MM, A = window.MMApp, C = window.MM_CONFIG || {};
  if (!MM || !A || !MM.allinFrom) return;
  var KEY = 'mm-allin', TRIP_KEYS = ['trip', 'tn', 'part', 'away'];
  var U = function () { return A.util; }, esc = function (s) { return U().esc(s); };
  function sget() { try { return JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
  function sset(v) { try { if (v) sessionStorage.setItem(KEY, JSON.stringify(v)); else sessionStorage.removeItem(KEY); } catch (e) { /* private mode: the context still works for this page view */ } }

  /* ---------- on arrival ---------- */
  var ctx = MM.allinFrom(location.search);
  if (ctx) {
    var saved = sget();
    if (saved && saved.qs === location.search && saved.mark !== undefined) ctx.mark = saved.mark;   // a reload: the trip in the address already has their edits, so keep what was marked when they arrived
    else {
      var m = /^#\/build\/(.+)$/.exec(location.hash), st = null;
      if (m && ctx.trip) { try { st = MM.decodeState(m[1]); } catch (e) { st = null; } }
      ctx.mark = st ? MM.allinMark(st.items, ctx) : null;
      sset({ qs: location.search, mark: ctx.mark });
    }
  }
  A.allin = ctx;
  if (ctx) document.documentElement.setAttribute('data-look', 'allin');                 // they came from the ALL IN site: keep its look whatever this copy's LOOK says

  /* ---------- the ALL IN site's address (config, so it's trusted, but still only a plain https address or a path on this site) ---------- */
  function site() {
    var s = String(C.ALLIN_SITE == null ? '' : C.ALLIN_SITE).trim();
    if (/^https:\/\/[^\s"'<>\\`]+$/i.test(s)) return s.replace(/#.*$/, '');
    if (/^(\.\.?\/)*[\w\-.\/]*$/.test(s) && s.indexOf('//') < 0 && s) return s.replace(/#.*$/, '');   // e.g. '../' when the builder sits inside the ALL IN site
    return '';
  }
  A.allinSite = site;
  function backHref() { var b = site(); return b ? b + (A.allin && A.allin.trip ? '#trip-' + A.allin.trip : '') : ''; }
  var nav = document.getElementById('nav-allin');
  if (nav && site()) nav.href = site();

  /* ---------- where the ALL IN part is now ---------- */
  function found() { var c = A.allin; return c && c.mark ? MM.allinFind(A.state.items, c.mark) : null; }
  A.allinFound = found;
  // The swap card ("this looks a lot like ALL IN Cambodia") would push a different trip on someone who just picked one on the site.
  A.allinHides = function () { return !!found(); };
  A.allinTag = function (i) {
    var f = found(); if (!f || i < f.i || i >= f.i + f.n) return '';
    return ' <span class="pill pill--sm aitag" title="Part of ' + esc(A.allin.name || 'your ALL IN trip') + '">ALL IN</span>';
  };
  function list(a) { return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; }
  function dateOf(pl, si, last) {
    var ds = pl.days.filter(function (d) { return d.si === si && d.date; });
    return ds.length ? (last ? ds[ds.length - 1] : ds[0]).date : null;
  }

  /* ---------- the bar at the top of the builder ---------- */
  A.allinBar = function (pl) {
    var c = A.allin; if (!c) return '';
    var f = found(), back = backHref(), name = c.name, h = '<section class="aibar" aria-label="From the ALL IN site"><div class="aibar__k"><span class="aibar__logo">ALL IN</span><span>by Mad Monkey</span></div><div class="aibar__t">';
    if (c.trip && name && f) {
      var bits = [], plu = U().plural, start = dateOf(pl, f.i, false);
      h += '<b>' + esc(name) + '</b>';
      bits.push(f.before || f.after ? 'Stops ' + (f.i + 1) + ' to ' + (f.i + f.n) + ' are your ALL IN trip' + (start ? ', starting ' + MM.util.fmtDate(start) : '') + '. You\'ve added ' + list([f.before ? plu(f.before, 'stop') + ' before it' : '', f.after ? plu(f.after, 'stop') + ' after it' : ''].filter(Boolean)) + '.'
        : 'This is the ALL IN trip, stop for stop' + (start ? ', starting ' + MM.util.fmtDate(start) : '') + '. Add days before or after it, or change anything, then send it to the crew.');
      if (!f.intact) bits.push('You\'ve changed ' + (f.changed.length === 1 ? 'one thing' : f.changed.length + ' things') + ' inside it (' + f.changed.slice(0, 2).join('; ') + (f.changed.length > 2 ? '…' : '') + '). That\'s fine: the crew checks it as you\'ve built it.');
      if (c.away) bits.push('It also has ' + plu(c.away, 'night') + ' we can\'t show here (on a night boat or bus, or in a partner hotel), so the ALL IN site counts ' + plu(c.away, 'more day') + '. The crew adds ' + (c.away === 1 ? 'it' : 'them') + ' when they check your trip.');
      bits.push('Prices here are estimates: the crew confirms the real price before you pay a thing.');
      h += '<p>' + esc(bits.join(' ')) + '</p>';
    } else if (c.trip && name && c.mark) {
      h += '<b>' + esc(name) + '</b><p>' + esc('You\'ve changed its stops, so the crew will check this as your own route.' + (back ? ' Want the trip as it was? It\'s on the ALL IN site.' : '')) + '</p>';
    } else if (c.trip && name) {
      h += '<b>' + esc(name) + '</b><p>' + esc('Your trip from the ALL IN site. Change anything you like, then send it to the crew: a real person checks it before anything is booked.') + '</p>';
    } else {
      h += '<b>Build it your way</b><p>' + esc('Any route, any length, with the same crew behind it. A real person checks it before anything is booked.') + '</p>';
    }
    h += '</div>' + (back ? '<a class="aibar__back" href="' + esc(back) + '">' + (c.trip && name ? 'Back to the trip' : 'Back to ALL IN') + '</a>' : '') + '</section>';
    return h;
  };

  /* ---------- what the crew is told (ui-review.js puts it in the lead) ---------- */
  A.allinMeta = function () {
    var c = A.allin; if (!c) return null;
    var f = found();
    return { site: 'all-in', trip: c.trip, name: c.name, stops: f ? [f.i + 1, f.i + f.n] : null, intact: f ? f.intact : false, changed: f ? f.changed.slice(0, 8) : [], before: f ? f.before : 0, after: f ? f.after : 0, away: c.away };
  };

  /* ---------- Start over: forget the trip (they're still a guest from the ALL IN site) ---------- */
  A.allinClear = function (all) {
    if (!A.allin) return;
    try {
      var q = new URLSearchParams(location.search);
      (all ? TRIP_KEYS.concat(['via']) : TRIP_KEYS).forEach(function (k) { q.delete(k); });
      var qs = q.toString(); history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
    } catch (e) { /* old browser: the address keeps them, the screen doesn't */ }
    A.allin = all ? null : { trip: '', name: '', b: -1, n: 0, away: 0, mark: null };
    sset(null);
  };
})();
