/* ============================================================
   EXTRAS UI — Trip Doctor, What's on (festivals + closures), Know before you go,
   per-stop local knowledge, themed trips and Surprise me.
   Logic lives in extras.js and data/{rules,guide}.js. This file only draws and wires clicks.
   ============================================================ */
(function () {
  var A = window.MMApp, MM = window.MM, u = A.util, esc = u.esc, P = MM.PLACES, money = u.money, plural = u.plural, U = MM.util;
  var X = window.MMX = {};
  var ICON = {
    bad: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2 21h20L12 3zm-1 7h2v6h-2v-6zm0 8h2v2h-2v-2z"/></svg>',
    warn: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1 5h2v7h-2V7zm0 9h2v2h-2v-2z"/></svg>',
    tip: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a7 7 0 0 0-4 12.7V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.3A7 7 0 0 0 12 2zm-2 18h4v2h-4v-2z"/></svg>',
    good: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg>'
  };
  var TAG = { bad: 'Fix this', warn: 'Heads up', tip: 'Good to know', good: 'All good' };
  var fmtD = U.fmtDate;
  function range(a, b) { return a.getTime() === b.getTime() ? fmtD(a) : fmtD(a) + ' to ' + fmtD(b); }

  /* ---------------- Trip Doctor ---------------- */
  var cache = { key: '', val: null };
  function diagnose() {
    var key = MM.encodeState(A.state) + '|' + (A.passport || ''); if (cache.key === key) return cache.val;
    cache = { key: key, val: MM.doctor(A.state, { passport: A.passport || null }) }; return cache.val;
  }
  X.diagnose = diagnose;
  function visaRow(d) {
    var pass = A.passport || '', opts = MM.PASSPORTS.map(function (p) { return '<option value="' + p.k + '"' + (pass === p.k ? ' selected' : '') + '>' + esc(p.n) + '</option>'; }).join('');
    var h = '<div class="docvisa"><div class="docvisa__hd"><span class="over">Visa length</span><label class="sr" for="docpass">Your passport</label><select class="select docpass" id="docpass" data-pass><option value="">Pick your passport…</option>' + opts + '</select></div>';
    if (!pass) return h + '<p class="fine">Pick your passport and we\'ll check each country against how long you can stay.</p></div>';
    h += '<div class="docvisa__list">' + d.visa.map(function (v) {
      var cls = v.status === 'over' ? 'bad' : v.status === 'near' ? 'warn' : v.status === 'ok' ? 'good' : 'tip';
      return '<span class="vchip vchip--' + cls + '" title="' + esc(v.msg) + '"><i data-c="' + v.c + '"></i>' + esc(MM.COUNTRIES[v.c].n) + ' <b>' + v.days + (v.allowed ? ' of ' + v.allowed : '') + ' days</b></span>';
    }).join('') + '</div><p class="fine">Counts your arrival day. Rules change, so confirm on the official site before you fly.</p></div>';
    return h;
  }
  X.doctor = function (pl) {
    if (!pl || !pl.totals.days) return '';
    var d = diagnose(), F = d.findings, all = !!A.open.docall, show = all ? F : F.slice(0, 3);
    var level = d.bad ? 'bad' : d.warns ? 'warn' : 'good', segs = '';
    for (var i = 0; i < 10; i++) segs += '<i class="' + (i < Math.round(d.score / 10) ? 'on' : '') + '"></i>';
    var s = d.stats, statLine = [plural(s.stops, 'stop'), '~' + s.transitH + ' hrs in transit', s.overnights ? plural(s.overnights, 'overnight journey') : 'no night buses', s.avgNights + ' nights a stop'].join(' · ');
    var h = '<section class="doc doc--' + level + '" aria-label="Trip Doctor"><div class="doc__hd"><div><span class="doc__tag">Trip Doctor</span><h3 class="disp doc__label">' + esc(d.label) + '</h3><p class="doc__stats">' + esc(statLine) + '</p></div>' +
      '<div class="doc__meter" role="img" aria-label="Pace score ' + d.score + ' out of 100">' + segs + '<b>' + d.score + '</b></div></div>';
    h += '<div class="doc__list">' + show.map(function (f) {
      var n = F.indexOf(f), fx = f.fix, cost = fx ? (fx.dDays ? (fx.dDays > 0 ? '+' + plural(fx.dDays, 'day') : plural(Math.abs(fx.dDays), 'day') + ' shorter') + ' · ' : '') + (fx.dCost === 0 ? 'no change in cost' : (fx.dCost > 0 ? '+' : '−') + money(Math.abs(fx.dCost))) : '';
      return '<div class="docf docf--' + f.sev + '"><span class="docf__i">' + ICON[f.sev] + '</span><div class="docf__bd"><span class="docf__tag">' + TAG[f.sev] + '</span><b>' + esc(f.title) + '</b><p>' + esc(f.body) + '</p>' +
        (fx ? '<div class="docf__fix"><button class="btn btn--sm btn--pink" type="button" data-act="docfix" data-n="' + n + '">' + esc(fx.label) + '</button><span class="docf__cost">' + esc(cost) + '</span></div>' : '') + '</div></div>';
    }).join('') + '</div>';
    if (F.length > 3) h += '<button class="doc__more" type="button" data-act="toggle" data-k="docall">' + (all ? 'Show fewer' : 'Show ' + (F.length - 3) + ' more') + '</button>';
    h += visaRow(d) + '</section>';
    return h;
  };

  /* ---------------- What's on: festivals + closures ---------------- */
  var KIND = { closure: 'Closures', festival: 'Festival', peak: 'Busy + dear', info: 'Good to know' };
  X.calendar = function (pl) {
    if (!pl || !pl.totals.days) return '';
    var dated = !!(pl.days[0] && pl.days[0].date), rows = [];
    if (dated) {
      var evs = MM.eventsFor(pl);
      if (!evs.length) return '<section class="cal"><div class="cal__hd"><span class="doc__tag">What\'s on</span><h3 class="disp">Clear dates.</h3></div><p class="fine">Nothing on our festival and closure calendar lands on your trip. Last checked ' + esc(MM.ENTRY_CHECKED) + '.</p></section>';
      rows = evs.map(function (e) {
        var where = e.places.length ? ' · ' + e.places.map(function (p) { return P[p].n; }).join(', ') : '';
        return { kind: e.ev.kind, n: e.ev.id === 'fullmoon' ? e.title : e.ev.n, when: e.ev.id === 'fullmoon' ? '' : (e.core ? 'core days ' + e.core : range(e.from, e.to)) + where, impact: e.ev.impact, advice: e.ev.advice, conf: e.conf, sev: e.sev };
      });
    } else {
      var up = MM.upcomingEvents({ countries: pl.countries, places: pl.places, months: 13 });
      rows = up.slice(0, 8).map(function (e) { return { kind: e.ev.kind, n: e.ev.n, when: (e.core ? e.core + ' ' : '') + range(e.from, e.to), impact: e.ev.impact, advice: e.ev.advice, conf: e.conf, sev: e.ev.sev }; });
      if (!rows.length) return '';
    }
    var h = '<section class="cal"><div class="cal__hd"><span class="doc__tag">What\'s on</span><h3 class="disp">' + (dated ? 'Festivals + closures on your trip' : 'Coming up where you\'re going') + '</h3>' + (dated ? '' : '<p class="fine">Add a start date and we\'ll check these against your dates and suggest a better week if one clashes.</p>') + '</div><ul class="cal__list">';
    rows.forEach(function (r) {
      h += '<li class="cal__i cal__i--' + r.kind + '"><span class="cal__k">' + KIND[r.kind] + '</span><div><b>' + esc(r.n) + '</b><span class="cal__w">' + esc(r.when) + '</span><p>' + esc(r.impact) + '</p>' + (r.advice ? '<p class="cal__a"><b>What to do:</b> ' + esc(r.advice) + '</p>' : '') + (r.conf === false ? '<p class="fine">Dates are a forecast and can move. Check closer to the time.</p>' : '') + '</div></li>';
    });
    return h + '</ul><p class="fine">Checked ' + esc(MM.ENTRY_CHECKED) + '. Lunar and government holiday dates shift, so confirm locally.</p></section>';
  };

  /* ---------------- Know before you go ---------------- */
  var G = MM.GUIDE;
  function guideItems(c, k) {
    var base = (G.countries[c] && G.countries[c][k] || []).slice();
    if (k === 'money' && MM.LOCAL[c]) base.push('Rough guide: $10 is about ' + MM.localMoney(10, c) + ', and $100 about ' + MM.localMoney(100, c) + ' (' + MM.LOCAL[c].code + '). Rates move.');
    return base;
  }
  X.guide = function (pl) {
    if (!pl || !pl.countries.length) return '';
    var cs = G.forCountries(pl.countries); if (!cs.length) return '';
    var cur = A.open.gc && cs.indexOf(A.open.gc) > -1 ? A.open.gc : cs[0], riding = G.hasRiding(pl);
    var h = '<section class="kb"><div class="cal__hd"><span class="doc__tag">Know before you go</span><h3 class="disp">The stuff nobody tells you.</h3><p class="fine">Planning advice from the Mad Monkey team (drafted ' + esc(G.checked) + '). Rules and prices change, so check official sources for anything that matters.</p></div>';
    if (riding) {
      h += '<div class="kb__ride"><b>' + esc(G.scooterHead) + '</b><ul>' + G.scooterCore.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' +
        cs.map(function (c) { var s = G.countries[c].scooters; return s ? '<details class="kb__rc"' + (cs.length === 1 ? ' open' : '') + '><summary>' + esc(MM.COUNTRIES[c].n) + ': the rules</summary><ul>' + s.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></details>' : ''; }).join('') + '</div>';
    }
    if (cs.length > 1) h += '<div class="kb__tabs" role="tablist" aria-label="Country">' + cs.map(function (c) { return '<button type="button" role="tab" aria-selected="' + (c === cur) + '" data-act="gtab" data-c="' + c + '"><i data-c="' + c + '"></i>' + esc(MM.COUNTRIES[c].n) + '</button>'; }).join('') + '</div>';
    else h += '<div class="kb__tabs"><span class="kb__one"><i data-c="' + cs[0] + '"></i>' + esc(MM.COUNTRIES[cs[0]].n) + '</span></div>';
    h += '<div class="kb__topics">' + G.topics.filter(function (t) { return t.k !== 'scooters' || !riding; }).map(function (t) {
      var items = guideItems(cur, t.k), key = 'kb-' + cur + '-' + t.k, on = A.open[key] != null ? !!A.open[key] : t.k === 'money';
      return '<div class="kb__t"><button class="kb__th" type="button" data-act="toggle" data-k="' + key + '" aria-expanded="' + on + '"><span>' + esc(t.t) + '</span><b>' + (on ? '−' : '+') + '</b></button>' + (on ? '<ul>' + items.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '') + '</div>';
    }).join('') + '</div></section>';
    return h;
  };
  X.local = function (sg, i) {
    var tips = G.places[sg.p]; if (!tips) return '';
    var on = !!A.open['lk' + i];
    return '<button class="stopc__more stopc__more--local" data-act="toggle" data-k="lk' + i + '" aria-expanded="' + on + '" type="button"><span>Local knowledge: ' + esc(P[sg.p].n) + '</span><span class="count"><span class="pill pill--sm pill--paper">' + tips.length + '</span><b>' + (on ? '−' : '+') + '</b></span></button>' +
      (on ? '<ul class="lk">' + tips.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' : '');
  };

  /* ---------------- themed trips + Surprise me ---------------- */
  var CLR = { pink: 'var(--pink)', cyan: 'var(--cyan)', orange: 'var(--orange)', lime: 'var(--lime)', yellow: 'var(--yellow)', green: 'var(--green)', blue: 'var(--blue)' };
  X.themesSection = function () {
    var cards = MM.THEMES.map(function (t) {
      var x = MM.themeTrip(t.id), pl = MM.plan(x.state), cs = pl.countries.map(function (c) { return MM.COUNTRIES[c].n; }).join(' + ');
      return '<article class="theme" style="--tc:' + CLR[t.c] + '"><div class="theme__bar"></div><div class="theme__bd"><span class="theme__tag">' + esc(t.tag) + '</span><h3 class="disp">' + esc(t.n) + '</h3><p>' + esc(t.blurb) + '</p>' +
        '<div class="theme__route">' + esc(MM.routeLine(pl)) + '</div><div class="theme__meta"><b>' + pl.totals.days + ' days</b><span>' + esc(cs) + '</span><span>~' + money(pl.totals.total) + '</span></div>' +
        '<button class="btn btn--sm" type="button" data-act="theme" data-id="' + t.id + '">Start with this</button></div></article>';
    }).join('');
    return '<section class="sec sec--black" id="themes"><div class="wrap"><div class="sec__head"><div><div class="over lime" style="margin-bottom:var(--s-2)">Pick a vibe</div><h2 class="disp">Hand-picked<br>by the crew.</h2></div>' +
      '<div class="sec__side"><p class="dim" style="max-width:30em">Eight routes the crew actually recommends. Start with one, then change anything you like. Or let us surprise you.</p><button class="btn btn--pink" type="button" data-act="surprise">Surprise me</button></div></div>' +
      '<div class="tgrid theme-grid">' + cards + '</div></div></section>';
  };
  function openState(st, msg) {
    A.state = Object.assign(MM.defaultState(), st); A.auto = false; A.focus = []; A.open = {}; u.persist();
    u.go('build', MM.encodeState(A.state)); if (msg) setTimeout(function () { u.toast(msg); }, 150);
  }
  X.openState = openState;
  X.surprise = function () {
    var s = MM.surprise(); if (!s) { u.toast('Couldn\'t think of one. Try again.'); return; }
    u.track('surprise', { theme: s.theme.id }); openState(s.state, 'Surprise: ' + s.why.join(', ') + ' · ' + s.days + ' days');
  };

  /* ---------------- hostel list view (an alternative to the map: phones, screen readers, keyboards) ---------------- */
  function listHTML() {
    var inTrip = {}; (A.state.items || []).forEach(function (it, i) { if (it.kind === 'stop') inTrip[it.p] = i + 1; });
    return Object.keys(MM.COUNTRIES).map(function (c) {
      var ids = MM.PLACE_ORDER.filter(function (id) { return P[id].c === c; }); if (!ids.length) return '';
      return '<section class="hlist__c"><h3><i data-c="' + c + '"></i>' + esc(MM.COUNTRIES[c].n) + '</h3><ul>' + ids.map(function (id) {
        var p = P[id], n = inTrip[id];
        return '<li><span class="photo hlist__ph">' + u.photo(MM.hostelImg(id)) + '</span><div class="hlist__b"><b>' + esc(p.n) + (p.partner ? ' <em>partner</em>' : '') + '</b><span>' + esc(p.hook) + '</span><span class="hlist__m">Dorm from ' + money(p.bed) + ' · most stay ' + p.sug + ' nights</span></div>' +
          '<button class="btn btn--sm ' + (n ? '' : 'btn--pink') + '" type="button" data-act="listadd" data-p="' + id + '" ' + (n ? 'disabled' : '') + ' aria-label="' + (n ? esc(p.n) + ' is stop ' + n + ' in your trip' : 'Add ' + esc(p.n) + ' to your trip') + '">' + (n ? 'In your trip · ' + n : 'Add') + '</button></li>';
      }).join('') + '</ul></section>';
    }).join('');
  }
  X.openList = function () {
    u.openModal('<div class="modal__hd"><div><div class="over">Every hostel</div><h2 class="disp">Pick your stops.</h2></div><button class="modal__x" data-act="close" aria-label="Close" type="button">×</button></div><div class="modal__bd hlist" id="hlist">' + listHTML() + '</div>');
    u.track('map_list');
  };

  /* ---------------- clicks ---------------- */
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b) return; var act = b.getAttribute('data-act');
    if (act === 'docfix') {
      var d = diagnose(), f = d.findings[+b.getAttribute('data-n')]; if (!f || !f.fix) return;
      var before = MM.plan(A.state).totals; A.state = Object.assign(MM.defaultState(), MM.applyFix(A.state, f.fix)); A.auto = false; u.persist(); u.refresh();
      var after = MM.plan(A.state).totals; u.track('doctor_fix', { id: f.id }); u.toast('Done. ' + (after.total === before.total ? 'Same cost' : (after.total > before.total ? '+' : '−') + money(Math.abs(after.total - before.total))) + ', ' + plural(after.days, 'day') + ' now.');
    } else if (act === 'maplist') { e.preventDefault(); X.openList(); }
    else if (act === 'listadd') { var pid = b.getAttribute('data-p'); u.addStop(pid); var box = document.getElementById('hlist'); if (box) box.innerHTML = listHTML(); u.toast(P[pid].n + ' added'); }
    else if (act === 'gtab') { A.open.gc = b.getAttribute('data-c'); u.refresh(); }
    else if (act === 'theme') { var t = MM.themeTrip(b.getAttribute('data-id')); if (t) { u.track('theme', { id: t.theme.id }); openState(t.state, t.theme.n + ': ' + t.days + ' days. Change anything you like.'); } }
    else if (act === 'surprise') { e.preventDefault(); X.surprise(); }
  });
  document.addEventListener('change', function (e) {
    var s = e.target.closest('[data-pass]'); if (!s) return;
    A.passport = s.value; u.store('mm-passport', s.value); u.refresh();
  });
})();
