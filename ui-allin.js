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

  /* ---------- nights away from a Mad Monkey (away) count as days ----------
     The site counts them in the trip's length (a night boat or bus, a partner hotel), so the builder does too: they go in after the
     ALL IN part's last stop (the link doesn't say where inside it they fall), so the trip is as long as the site says and every date
     after it is right. They cost nothing here; the crew prices them. Only while the ALL IN part is still there: once the guest has
     changed its stops it's their own route, and the crew is told about the nights instead. */
  /* ---------- the ALL IN site's own price for its trip ----------
     Where the site has an approved price for this trip, that's what the guest saw there. So while they keep
     the trip as it is, the builder prices those stops at it (in "ALL IN trips", in place of its own beds, tours and journeys between
     them) and estimates only what they add around it. The price comes from the site in this browser (localStorage 'allin-site-prices',
     same origin, MM.sitePrice), never from the link. Change anything inside the trip and it's back to the builder's estimate. The crew
     confirms the real price before anyone pays, either way. */
  var PRICE = 0;
  if (ctx && ctx.trip && MM.sitePrice) { try { PRICE = MM.sitePrice(localStorage.getItem('allin-site-prices'), ctx.trip); } catch (e) { PRICE = 0; } }
  A.allinPrice = function () { var f = found(); return PRICE && f && f.intact ? PRICE : 0; };

  if (ctx && ctx.mark && (ctx.away > 0 || PRICE) && MM.plan && !MM.plan.withAway) {
    var basePlan = MM.plan;
    MM.plan = function (st) {
      var c = A.allin, f = c && c.mark && st && st.items ? MM.allinFind(st.items, c.mark) : null;
      if (!f) return basePlan(st);
      var extra = {};
      if (c.away > 0) extra.away = { after: f.i + f.n - 1, n: c.away };
      if (PRICE && f.intact) extra.approved = { from: f.i, n: f.n, usd: PRICE };
      return basePlan(Object.assign({}, st, extra));
    };
    MM.plan.withAway = true;
  }
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

  /* A multi-day trip that leaves from a stop (the Ha Giang Loop from Hanoi) is a stop of its own on the ALL IN site, but here it sits
     inside the stop it leaves from. So the route line names it the way the site does, and the bar says where to find it. */
  var AWAY = [[/ha giang/i, 'Ha Giang Loop', 'the Ha Giang Loop'], [/lan ha/i, 'Lan Ha Bay'], [/ha long/i, 'Ha Long Bay'], [/sapa/i, 'Sapa'], [/nong khiaw/i, 'Nong Khiaw'], [/rinjani/i, 'Mount Rinjani']];
  function awayNames(it) {
    var out = [];
    ((it && it.acts) || []).forEach(function (id) {
      var a = (MM.ACTS || {})[id]; if (!a || !a.multi || !(a.multi.n > 0)) return;
      var n = String(a.n || ''), hit = AWAY.filter(function (w) { return w[0].test(n); })[0];
      var nm = hit ? hit[1] : n.split(' · ')[0].replace(/\s*\(.*?\)/g, '').trim(), say = hit && hit[2] || nm;
      if (nm && !out.some(function (o) { return o.n === nm; })) out.push({ n: nm, say: say });
    });
    return out;
  }
  // the trip's country and route, right under its name: "Vietnam · Hanoi → Lan Ha Bay → Ha Giang Loop → Hoi An"
  function where(items) {
    var P = MM.PLACES || {}, C2 = MM.COUNTRIES || {}, names = [], cs = [];
    items.forEach(function (it) {
      var pl = it && P[it.p]; if (!pl) return;
      if (names[names.length - 1] !== pl.n) names.push(pl.n);
      awayNames(it).forEach(function (w) { if (names[names.length - 1] !== w.n) names.push(w.n); });
      var cn = C2[pl.c] && C2[pl.c].n; if (cn && cs.indexOf(cn) < 0) cs.push(cn);
    });
    return names.length ? '<span class="aibar__where">' + esc((cs.length ? cs.join(' + ') + ' · ' : '') + names.join(' → ')) + '</span>' : '';
  }
  // "Lan Ha Bay and the Ha Giang Loop are trips from Hanoi, so you'll find them inside your Hanoi stop."
  function inside(items) {
    var P = MM.PLACES || {};
    return items.map(function (it) {
      var pl = it && P[it.p], w = awayNames(it); if (!pl || !w.length) return '';
      var one = w.length === 1;
      return list(w.map(function (x) { return x.say; })).replace(/^the /, 'The ') + (one ? ' is a trip' : ' are trips') + ' from ' + pl.n + ', so you\'ll find ' + (one ? 'it' : 'them') + ' inside your ' + pl.n + ' stop.';
    }).filter(Boolean).join(' ');
  }

  /* ---------- the bar at the top of the builder ---------- */
  A.allinBar = function (pl) {
    var c = A.allin; if (!c) return '';
    var f = found(), back = backHref(), name = c.name, h = '<section class="aibar" aria-label="From the ALL IN site"><div class="aibar__k"><span class="aibar__logo">ALL IN</span><span>by Mad Monkey</span></div><div class="aibar__t">';
    if (c.trip && name && f) {
      var bits = [], plu = U().plural, start = dateOf(pl, f.i, false), mine = A.state.items.slice(f.i, f.i + f.n), inn = inside(mine);
      h += '<b>' + esc(name) + '</b>' + where(mine);
      bits.push(f.before || f.after ? 'Stops ' + (f.i + 1) + ' to ' + (f.i + f.n) + ' are your ALL IN trip' + (start ? ', starting ' + MM.util.fmtDate(start) : '') + '. You\'ve added ' + list([f.before ? plu(f.before, 'stop') + ' before it' : '', f.after ? plu(f.after, 'stop') + ' after it' : ''].filter(Boolean)) + '.' + (inn ? ' ' + inn : '')
        : 'This is the ALL IN trip, day for day' + (start ? ', starting ' + MM.util.fmtDate(start) : '') + '.' + (inn ? ' ' + inn : '') + ' Add days before or after it, or change anything, then send it to the crew.');
      if (!f.intact) bits.push('You\'ve changed ' + (f.changed.length === 1 ? 'one thing' : f.changed.length + ' things') + ' inside it (' + f.changed.slice(0, 2).join('; ') + (f.changed.length > 2 ? '…' : '') + '). That\'s fine: the crew checks it as you\'ve built it.');
      if (c.away) { var lastP = (MM.PLACES || {})[(A.state.items[f.i + f.n - 1] || {}).p]; bits.push('It includes ' + plu(c.away, 'night') + ' away from a Mad Monkey (a night boat or bus, or a partner hotel), so it\'s as long here as on the ALL IN site: ' + (c.away === 1 ? 'it sits' : 'they sit') + ' after ' + (lastP ? lastP.n : 'its last stop') + ' in your days. The crew prices ' + (c.away === 1 ? 'it' : 'them') + ' when they check your trip.'); }
      if (PRICE && f.intact) bits.push('Its price is the ALL IN site\'s: ' + U().money(PRICE) + ' per person for the trip as it is, in your total in place of our own figures for those days. Anything you add around it is our estimate, and the crew confirms the real price before you pay a thing.');
      else if (PRICE) bits.push('The site\'s ' + U().money(PRICE) + ' is for the trip as it is, so with your changes this total is our estimate. The crew confirms the real price before you pay a thing.');
      else bits.push('Prices here are estimates: the crew confirms the real price before you pay a thing.');
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
    var priced = PRICE && f && f.intact ? MM.plan(A.state).approved : null;
    return { site: 'all-in', trip: c.trip, name: c.name, stops: f ? [f.i + 1, f.i + f.n] : null, intact: f ? f.intact : false, changed: f ? f.changed.slice(0, 8) : [], before: f ? f.before : 0, after: f ? f.after : 0, away: c.away, awayIn: !!(f && c.away),
      approvedUsd: priced ? priced.usd : 0, approvedEst: priced ? priced.est : 0, sitePriceUsd: PRICE };
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
