/* ============================================================
   MAD MONKEY TRIP BUILDER — the UI
   views: home · quiz · results · build        (hash router)
   state: one object (MM.defaultState shape) -> MM.plan() -> HTML
   ============================================================ */
(function () {
  'use strict';
  var MM = window.MM, C = window.MM_CONFIG || {}, U = MM.util;
  var root = document.getElementById('app'), modalRoot = document.getElementById('modal-root'), toastRoot = document.getElementById('toast-root');
  var P = MM.PLACES;

  var app = window.MMApp = { view: 'home', cur: 'USD', state: MM.defaultState(), quiz: { step: 0, a: { days: 14, vibes: [], must: [] } }, results: null, profile: null, focus: [], open: {}, meta: { ref: '', from: '' } };
  var plan = null;

  /* ---------- utils ---------- */
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var money = function (usd) { return MM.money(usd, app.cur); };
  var plural = function (n, w, ws) { return n + ' ' + (n === 1 ? w : (ws || w + 's')); };
  function store(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(k)); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }
  function track(name, props) { try { (window.dataLayer = window.dataLayer || []).push({ event: 'mm_' + name, props: props || {} }); } catch (e) { /* analytics is optional */ } }
  function toast(msg) { var t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; toastRoot.appendChild(t); setTimeout(function () { t.remove(); }, 2400); }
  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).then(function () { return true; }, fallback);
    return Promise.resolve(fallback());
    function fallback() { var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); var ok = false; try { ok = document.execCommand('copy'); } catch (e) { /* ignore */ } ta.remove(); return ok; }
  }
  var photo = function (src, cls) { return src ? '<div class="photo ' + (cls || '') + '"><img src="' + src + '" alt="" loading="lazy" onerror="this.parentNode.classList.add(\'photo--none\');this.remove()"></div>' : '<div class="photo photo--none ' + (cls || '') + '"></div>'; };
  var hours = U.hoursLabel;
  function tomorrow() { var d = new Date(); return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate() + 1)); }
  function baseUrl() { return (C.SITE_URL || (location.origin + location.pathname)).replace(/#.*$/, ''); }
  function shareLink() { return baseUrl() + '#/build/' + MM.encodeState(app.state); }

  /* ---------- state ---------- */
  function persist() { store('mm-trip', { state: app.state, cur: app.cur }); if (app.view === 'build') history.replaceState(null, '', '#/build/' + MM.encodeState(app.state)); }
  function defaultActs(p, n) {
    var list = MM.actsAt(p).filter(function (a) { return a.star && !(a.multi); });
    return list.slice(0, n >= 3 ? 2 : 1).map(function (a) { return a.id; });
  }
  function stopFor(p, n) { n = n || P[p].sug; return { kind: 'stop', p: p, n: n, acts: defaultActs(p, n) }; }
  function mutate(fn, opts) { fn(app.state); persist(); refreshBuilder(opts); }

  /* ============================================================
     ROUTER
     ============================================================ */
  function parseHash() {
    var h = location.hash.replace(/^#\/?/, ''), seg = h.split('/'), view = seg[0] || 'home';
    return { view: ['home', 'quiz', 'results', 'build'].indexOf(view) > -1 ? view : 'home', rest: seg.slice(1).join('/') };
  }
  function go(view, rest) { location.hash = '#/' + (view === 'home' ? '' : view) + (rest ? '/' + rest : ''); }
  function route() {
    var r = parseHash(); closeModal();
    if (r.view === 'results' && !app.results) r.view = 'quiz';
    if (r.view === 'build') {
      if (r.rest) { var st = MM.decodeState(r.rest); if (st.items.length || r.rest.indexOf('i=') === 0) app.state = st; }
      else { var saved = store('mm-trip'); if (saved && saved.state && !app.state.items.length) app.state = Object.assign(MM.defaultState(), saved.state); }
    }
    app.view = r.view; document.body.setAttribute('data-view', r.view);
    if (r.view === 'build' && app.state.items.length) history.replaceState(null, '', '#/build/' + MM.encodeState(app.state));
    $$('.navbtn[data-go]').forEach(function (b) { b.setAttribute('aria-current', b.getAttribute('data-go') === r.view ? 'true' : 'false'); });
    window.scrollTo(0, 0);
    ({ home: renderHome, quiz: renderQuiz, results: renderResults, build: renderBuilder })[r.view]();
    track('view', { view: r.view });
  }

  /* ============================================================
     HOME
     ============================================================ */
  var HERO_ROUTES = [['bangkok', 'chiang-mai', 'luang-prabang', 'vang-vieng', 'hanoi', 'hoi-an', 'phnom-penh', 'koh-rong'], ['uluwatu', 'nusa-lembongan', 'gili-trawangan', 'kuta-lombok'], ['manila', 'panglao', 'siargao']];
  function tripCard(t) {
    var img = MM.tourImg(t.img[0]) || MM.hostelImg(t.img[1]), soon = t.status === 'soon', nd = MM.nextDeparture(t, tomorrow());
    return '<article class="tcard">' +
      '<div class="tcard__pill pill ' + (soon ? 'pill--pink' : 'pill--black') + ' pill--sm">' + (soon ? 'Launching soon' : 'Every ' + U.DOWN[t.dep]) + '</div>' +
      '<div class="tcard__price"><div class="burst"><span>' + (soon ? 'rrp' : 'from') + '<b>' + money(t.usd) + '</b></span></div></div>' +
      photo(img) +
      '<div class="tcard__body"><div class="over dim">' + esc(t.kicker) + '</div><h3>' + esc(t.n) + '</h3><div class="tcard__route">' + esc(t.tag) + '</div>' +
      '<div class="tcard__meta"><span class="pill pill--paper pill--sm">' + t.days + ' days</span><span class="pill pill--paper pill--sm">Max ' + t.max + '</span><span class="pill pill--paper pill--sm">$' + MM.DEPOSIT + ' holds your spot</span></div>' +
      '<p style="font-size:13.5px;font-weight:500;margin-top:4px">' + esc(t.pitch) + '</p>' +
      (soon ? '' : '<div class="tcard__next">Next departure: ' + U.fmtDate(nd) + (t.until ? ' · runs until ' + t.until : '') + '</div>') +
      '<div class="tcard__foot"><button class="btn btn--sm" data-act="addblock" data-id="' + t.id + '" type="button">Build on this</button><button class="btn btn--sm btn--paper" data-act="customise" data-id="' + t.id + '" type="button">Customise</button></div></div></article>';
  }
  function renderHome() {
    var g = MM.gap, ticker = '23 hostels · 6 countries · 150+ things to do · every bus, boat + flight in between · $99 holds an ALL IN spot · real prices · real people · ';
    root.innerHTML =
      '<section class="hero on-black"><div class="wrap hero__in"><div>' +
        '<div class="over lime" style="margin-bottom:var(--s-4)">Mad Monkey · Trip Builder</div>' +
        '<h1 class="disp">Build the trip you <span class="hl">actually</span> want.</h1>' +
        '<p class="hero__lede"><b>23 hostels. 6 countries.</b> Every bus, boat and flight in between. Pick your stops, see what it really costs, then send it to the crew. Or jump on an ALL IN and let us sort the lot.</p>' +
        '<div class="hero__cta"><button class="btn btn--lg" data-go="build" type="button">Start building</button><button class="btn btn--lg btn--ghost" data-go="quiz" type="button">Build it for me</button></div>' +
      '</div><div class="hero__map" aria-hidden="true">' +
        '<div class="hm hm--d">' + MM.staticMap({ region: 'all', aspect: 0.85, pad: 0, dots: true, countryLabels: true, routes: HERO_ROUTES, animate: true, px: 560, slice: true, other: false }) + '</div>' +
        '<div class="hm hm--m">' + MM.staticMap({ region: 'mainland', aspect: 1.25, pad: 0.0, dots: true, countryLabels: true, routes: [HERO_ROUTES[0]], animate: true, px: 700, slice: true, other: false }) + '</div>' +
        '<div class="burst hero__burst"><span>23<br>hostels</span></div><span class="sticker hero__sticker">All in.</span>' +
      '</div></div></section>' +
      '<div class="ticker" aria-hidden="true"><span>' + (ticker + ticker + ticker + ticker) + '</span></div>' +

      '<section class="sec"><div class="wrap"><div class="sec__head"><h2 class="disp">Three ways in.</h2><p class="dim" style="max-width:30em">Know exactly where you\'re going, want us to work it out, or just want it done? Pick a door.</p></div>' +
        '<div class="doors on-black">' +
          '<button class="door" data-go="build" type="button"><span class="door__n">01</span><h3>Build it yourself</h3><p>Tap hostels on the map. Get the real bus, boat and flight times, the cost, and a day-by-day plan.</p><span class="go">Open the map →</span></button>' +
          '<button class="door" data-go="quiz" type="button"><span class="door__n">02</span><h3>Build it for me</h3><p>Seven quick questions. Three routes that fit your days, your vibe and your budget.</p><span class="go">Take the quiz →</span></button>' +
          '<button class="door" data-act="scroll" data-to="trips" type="button"><span class="door__n">03</span><h3>Jump on an ALL IN</h3><p>Pre-built crew trips. Beds, boats and activities sorted. $' + MM.DEPOSIT + ' holds your spot.</p><span class="go">See the trips →</span></button>' +
        '</div></div></section>' +

      '<section class="sec sec--bone" id="trips"><div class="wrap"><div class="sec__head"><div><div class="over" style="margin-bottom:var(--s-2)">ALL IN trips</div><h2 class="disp">Stop planning.<br>Start going.</h2></div><p class="dim" style="max-width:30em">Up to 20 backpackers, real Mad Monkey beds every night, every transfer and activity in the price, free drinks, 24/7 crew. Flights and insurance not included. Hit <b>Build on this</b> to bolt more days on either end.</p></div>' +
        '<div class="tgrid">' + MM.ALL_IN.map(tripCard).join('') + '</div>' +
        '<div class="gap" style="margin-top:var(--s-7)">' + photo(MM.tourImg('the-ha-giang-loop-tour-4d-3n-easy-rider') || MM.hostelImg('hanoi')) +
          '<div class="gap__b"><span class="pill pill--pink pill--sm">Special · ' + g.dates + '</span><h3>The Gap Collective</h3><p style="font-weight:500">' + esc(g.pitch) + '</p><div class="stats"><div class="stat"><b>31</b><span>days</span></div><div class="stat"><b>9</b><span>stops</span></div><div class="stat"><b>1,500</b><span>at the festival</span></div><div class="stat"><b>from £1,995</b><span>per person</span></div></div><div class="tcard__foot" style="padding-top:0"><a class="btn btn--sm btn--pink" href="' + g.url + '" target="_blank" rel="noopener">Book + details ↗</a></div></div></div>' +
      '</div></section>' +

      '<section class="sec"><div class="wrap"><div class="sec__head"><h2 class="disp">How it works.</h2></div><div class="how">' +
        '<div><b class="lime">1</b><h4>Pick your stops</h4><p class="dim">Tap hostels, or take the quiz. Every bus, boat and flight between them is already in.</p></div>' +
        '<div><b class="lime">2</b><h4>See the real cost</h4><p class="dim">Beds, transport and activities add up live. Switch between cheapest, smart and fastest on any leg.</p></div>' +
        '<div><b class="lime">3</b><h4>Send it to the crew</h4><p class="dim">One tap sends your plan to a real person who can book it. Or spot an ALL IN that already covers it.</p></div>' +
      '</div></div></section>' +
      footer();
  }
  function footer() {
    return '<footer class="foot"><div class="wrap"><p>Prices are estimates, not quotes: dorm beds are "from" prices, transport is typical fares, activities are listed prices (or marked est.). The crew confirms live rates before you pay anything. Not included in ALL IN trips: flights, travel insurance, personal spending. Check visa rules for your passport.</p><img src="assets/logo/mad-monkey-white.png" alt="Mad Monkey" width="113" height="34"></div></footer>';
  }

  /* ============================================================
     QUIZ
     ============================================================ */
  var QSTEPS = [
    { k: 'start', over: 'Step 1 of 7', h: 'Where are you landing?', help: 'Your first stop. Not booked? Pick "not booked yet" and we\'ll suggest where.', type: 'single' },
    { k: 'days', over: 'Step 2 of 7', h: 'How long have you got?', help: 'On the ground, door to door. We\'ll fit the route to it.', type: 'days' },
    { k: 'month', over: 'Step 3 of 7', h: 'When are you going?', help: 'Month is enough. It lets us flag wet seasons and rough seas.', type: 'month' },
    { k: 'vibes', over: 'Step 4 of 7', h: 'What\'s the vibe?', help: 'Pick as many as you like.', type: 'multi' },
    { k: 'must', over: 'Step 5 of 7', h: 'Any must-dos?', help: 'The thing you\'d be gutted to miss. Skip if you\'re easy.', type: 'multi', optional: true },
    { k: 'budget', over: 'Step 6 of 7', h: 'Budget feel?', help: 'It decides bus vs flight, and how many paid activities we pack in.', type: 'single' },
    { k: 'crew', over: 'Step 7 of 7', h: 'Solo or a crew?', help: 'Rolling alone is fine. Most people find their people by night two.', type: 'single' }
  ];
  var BUDGETS = [{ v: 'cheap', t: 'Every dollar counts', s: 'Dorms, buses, cheap eats' }, { v: 'mid', t: 'Comfortable, not fussy', s: 'Flights where they save a day' }, { v: 'splash', t: 'Happy to spend', s: 'Do the big stuff properly' }];
  var CREWS = [{ v: 'solo', t: 'Solo', s: 'I\'ll find my people' }, { v: 'mates', t: 'Me + a mate or two', s: 'Small and sorted' }, { v: 'crew', t: 'A whole crew', s: 'The more the louder' }];
  function monthOptions() { var d = new Date(), out = []; for (var i = 0; i < 12; i++) { var m = (d.getMonth() + i) % 12, y = d.getFullYear() + Math.floor((d.getMonth() + i) / 12); out.push({ v: m + ':' + y, m: m, y: y, t: U.MONTHN[m], s: String(y) }); } return out; }

  function renderQuiz() {
    var q = app.quiz, s = QSTEPS[q.step], a = q.a;
    var prog = QSTEPS.map(function (_, i) { return '<i class="' + (i < q.step ? 'on' : i === q.step ? 'cur' : '') + '"></i>'; }).join('');
    var body = '';
    if (s.type === 'single') {
      var opts = s.k === 'start' ? MM.GATEWAYS.map(function (g) { return { v: g.id, t: g.n, s: g.sub }; }) : s.k === 'budget' ? BUDGETS : CREWS;
      body = '<div class="qopts">' + opts.map(function (o) { return '<button class="qopt" data-act="qpick" data-v="' + o.v + '" aria-pressed="' + (a[s.k] === o.v) + '" type="button"><b>' + esc(o.t) + '</b><span>' + esc(o.s) + '</span></button>'; }).join('') + '</div>';
    } else if (s.type === 'days') {
      body = '<div class="qbig">' + a.days + '<small>days</small></div><input class="qrange" id="qdays" type="range" min="4" max="45" value="' + a.days + '" aria-label="Number of days">' +
        '<div class="row" style="display:flex;gap:8px;flex-wrap:wrap">' + [7, 10, 14, 21, 30, 40].map(function (d) { return '<button class="chip" data-act="qdays" data-v="' + d + '" aria-pressed="' + (a.days === d) + '" type="button">' + d + ' days</button>'; }).join('') + '</div>';
    } else if (s.type === 'month') {
      body = '<div class="qmonths">' + monthOptions().map(function (o) { return '<button class="qopt" data-act="qmonth" data-m="' + o.m + '" data-y="' + o.y + '" aria-pressed="' + (a.month === o.m && a.year === o.y) + '" type="button"><b>' + o.t + '</b><span>' + o.s + '</span></button>'; }).join('') +
        '<button class="qopt" data-act="qmonth" data-m="" aria-pressed="' + (a.month === null) + '" type="button"><b>No idea</b><span>Surprise me</span></button></div>';
    } else if (s.type === 'multi') {
      var list = s.k === 'vibes' ? MM.VIBES.map(function (v) { return { v: v.k, t: v.n, s: v.sub }; }) : MM.MUSTS.map(function (v) { return { v: v.k, t: v.n, s: '' }; });
      body = '<div class="qopts">' + list.map(function (o) { return '<button class="qopt" data-act="qmulti" data-v="' + o.v + '" aria-pressed="' + (a[s.k].indexOf(o.v) > -1) + '" type="button"><b>' + esc(o.t) + '</b>' + (o.s ? '<span>' + esc(o.s) + '</span>' : '') + '</button>'; }).join('') + '</div>';
    }
    var canNext = s.type === 'multi' ? (s.optional || a[s.k].length > 0) : s.type === 'single' ? !!a[s.k] : true;
    root.innerHTML = '<section class="quiz"><div class="wrap"><div class="qprog" aria-label="Progress">' + prog + '</div><div class="qbox">' +
      '<span class="over">' + s.over + '</span><h2 class="disp">' + s.h + '</h2><p class="qhelp">' + s.help + '</p>' + body +
      '<div class="qnav">' + (q.step ? '<button class="btn btn--paper" data-act="qback" type="button">← Back</button>' : '<button class="btn btn--paper" data-go="home" type="button">← Home</button>') +
      (s.type === 'single' ? '' : '<button class="btn btn--pink" data-act="qnext" type="button"' + (canNext ? '' : ' disabled') + '>' + (q.step === QSTEPS.length - 1 ? 'Show my routes' : s.optional && !a[s.k].length ? 'Skip' : 'Next →') + '</button>') +
      '</div></div></div></section>';
    var rng = $('#qdays'); if (rng) rng.addEventListener('input', function () { a.days = +rng.value; $('.qbig').firstChild.nodeValue = a.days; $$('[data-act="qdays"]').forEach(function (b) { b.setAttribute('aria-pressed', String(+b.getAttribute('data-v') === a.days)); }); });
  }
  function quizAdvance() {
    if (app.quiz.step < QSTEPS.length - 1) { app.quiz.step++; renderQuiz(); window.scrollTo(0, 0); return; }
    finishQuiz();
  }
  function finishQuiz() {
    var a = app.quiz.a, g = MM.GATEWAYS.filter(function (x) { return x.id === a.start; })[0] || MM.GATEWAYS[MM.GATEWAYS.length - 1];
    app.profile = { start: g.place, startId: g.id, days: a.days, month: a.month == null ? null : a.month, year: a.year, vibes: a.vibes.slice(), must: a.must.slice(), budget: a.budget || 'mid', crew: a.crew || 'mates' };
    root.innerHTML = '<section class="quiz"><div class="wrap qwait"><div><div class="burst" style="width:120px;margin:0 auto var(--s-4);background:var(--pink)"><span>…</span></div><h2 class="disp">Building your routes.</h2><p class="dim" style="margin-top:var(--s-3)">Checking buses, boats, flights and wet seasons.</p></div></div></section>';
    track('quiz_done', app.profile);
    setTimeout(function () { app.results = MM.suggest(app.profile); store('mm-quiz', app.quiz.a); go('results'); }, 900);
  }

  /* ============================================================
     RESULTS
     ============================================================ */
  function resultName(r) {
    var t = r.cand.tpl; if (r.isAllIn) return 'ALL IN ' + t.n + (r.hybrid ? ' + more' : '');
    if (r.o && r.o.reversed) return t.n.indexOf(' → ') > -1 ? t.n.split(' → ').reverse().join(' → ') : t.n + ' (reverse)';
    return t.n;
  }
  function renderResults() {
    var pr = app.profile, g = MM.GATEWAYS.filter(function (x) { return x.id === pr.startId; })[0];
    var chips = ['Landing: ' + (g ? g.n : 'anywhere'), pr.days + ' days', pr.month != null ? U.MONTHN[pr.month] : 'Any month'].concat(pr.vibes.map(function (v) { return MM.VIBES.filter(function (x) { return x.k === v; })[0].n; }), pr.must.map(function (v) { return MM.MUSTS.filter(function (x) { return x.k === v; })[0].n; }), [({ cheap: 'Every dollar counts', mid: 'Comfortable', splash: 'Happy to spend' })[pr.budget]]);
    root.innerHTML = '<section class="res"><div class="wrap"><div class="res__head"><div class="over">Your routes</div><h2 class="disp">Three trips<br>built for <span class="hl">you</span>.</h2></div>' +
      '<div class="res__prof">' + chips.map(function (c) { return '<span class="chip">' + esc(c) + '</span>'; }).join('') + '<button class="chip" data-act="qedit" type="button" style="background:var(--lime)">Edit answers</button></div>' +
      '<div class="rcards">' + app.results.map(function (r, i) { return resultCard(r, i); }).join('') + '</div>' +
      '<div style="margin-top:var(--s-7);display:flex;gap:var(--s-3);flex-wrap:wrap"><button class="btn btn--pink" data-go="build" type="button">Start from a blank map</button></div></div></section>' + footer();
  }
  function resultCard(r, i) {
    var pl = MM.plan(r.state), t = r.cand.tpl, top = i === 0, price = r.isAllIn && !r.hybrid;
    var map = MM.staticMap({ places: pl.places, aspect: top ? 1.25 : 1.6, labels: pl.places.length <= 5, px: top ? 640 : 420, pad: 0.3, minW: 190 });
    return '<article class="rcard' + (top ? ' rcard--top' : '') + '"><div class="rcard__map">' + map + '<span class="rcard__rank pill ' + (top ? 'pill--pink' : 'pill--paper') + '">' + (top ? 'Best fit' : '#' + (i + 1)) + '</span></div>' +
      '<div class="rcard__body"><div><h3>' + esc(resultName(r)) + '</h3><div class="rcard__route">' + esc(MM.routeLine(pl)) + '</div></div>' +
      '<div class="stats"><div class="stat"><b>' + pl.totals.days + '</b><span>days</span></div><div class="stat"><b>' + (price && t.nStops ? t.nStops : pl.totals.stops) + '</b><span>stops</span></div><div class="stat"><b>' + (price ? money(t.usd) : '~' + money(pl.totals.total)) + '</b><span>' + (price ? 'ALL IN from' : r.hybrid ? 'est. all-in' : 'est. total') + '</span></div></div>' +
      '<div class="why">' + r.why.map(function (w) { return '<span class="pill pill--sm">' + esc(w) + '</span>'; }).join('') + '</div>' +
      (r.isAllIn ? '<p style="font-size:13px;font-weight:500">' + (r.hybrid ? 'Start with the ALL IN crew trip, then keep going on your own with beds and transport sorted below.' : esc(t.pitch)) + (t.status === 'soon' ? ' <b>Launching soon.</b>' : '') + '</p>' : '<p style="font-size:13px;font-weight:500">' + esc(t.pitch) + '</p>') +
      '<div class="rcard__cta"><button class="btn btn--sm" data-act="openres" data-i="' + i + '" type="button">Open in builder</button>' + (r.isAllIn ? '<a class="btn btn--sm btn--paper" href="' + MM.ALLIN_URL + '" target="_blank" rel="noopener">ALL IN details ↗</a>' : '') + '</div></div></article>';
  }

  /* ============================================================
     BUILDER
     ============================================================ */
  function renderBuilder() {
    root.innerHTML = '<div class="bld"><section class="bmap" id="bmap" aria-label="Map"></section><section class="bpanel" id="bpanel" aria-label="Your trip"></section></div><div class="mbar" id="mbar"></div>';
    var box = $('#bmap'), mapHost = document.createElement('div'); mapHost.style.cssText = 'position:absolute;inset:0'; box.appendChild(mapHost);
    box.insertAdjacentHTML('beforeend', '<div class="bmap__regions" id="regions"></div><div class="bmap__stats" id="mstats"></div><div class="bmap__hint"><span class="pill pill--sm">Tap a hostel to add it</span></div>');
    MM.BuilderMap.mount(mapHost, { pin: onPin });
    refreshBuilder({ instant: true });
  }
  function onPin(id) {
    var items = app.state.items, last = items[items.length - 1];
    if (last && last.kind === 'stop' && last.p === id) { toast('You\'re already at ' + P[id].n); return; }
    addStop(id);
  }
  function addStop(id, n) {
    mutate(function (s) { s.items.push(stopFor(id, n)); });
    track('add_stop', { place: id });
    var cards = $$('.stopc'); if (cards.length) cards[cards.length - 1].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function refreshBuilder(opts) {
    if (app.view !== 'build') return;
    var y = window.scrollY; plan = MM.plan(app.state);
    var panel = $('#bpanel'); if (!panel) return;
    panel.innerHTML = panelHTML(plan);
    $('#regions').innerHTML = '<button type="button" data-focus="" aria-pressed="' + !app.focus.length + '">Everywhere</button>' + Object.keys(MM.COUNTRIES).map(function (c) { return '<button type="button" data-focus="' + c + '" aria-pressed="' + (app.focus.indexOf(c) > -1) + '">' + MM.COUNTRIES[c].n + '</button>'; }).join('');
    var t = plan.totals;
    $('#mstats').innerHTML = t.days ? '<span class="chip"><b>' + t.days + '</b> days</span><span class="chip"><b>' + t.stops + '</b> stops</span><span class="chip"><b>' + plan.countries.length + '</b> ' + (plan.countries.length === 1 ? 'country' : 'countries') + '</span><span class="chip"><b>' + plan.km.toLocaleString('en-GB') + '</b> km</span>' : '';
    $('#mbar').innerHTML = t.days ? '<div><b>~' + money(t.total) + '</b><span>' + t.days + ' days · est. total</span></div><button class="btn btn--sm btn--pink" data-act="lead" type="button">Send to the crew</button>' : '<div><b>Tap the map</b><span>to add your first stop</span></div>';
    MM.BuilderMap.update(plan, app.state, app.focus);
    if (!(opts && opts.instant)) window.scrollTo(0, y);
  }

  function chip(label, extra) { return '<span class="pill pill--sm ' + (extra || 'pill--paper') + '">' + label + '</span>'; }
  function legIcon(leg, o) { return MM.modeIcon((o || leg.chosen).main); }
  function stepsText(rt) {
    if (rt.steps.length === 1) return rt.steps[0].e.note;
    return rt.steps.map(function (s) { return (MM.MODE_LABEL[s.e.m] || s.e.m) + ' ' + hours(s.e.h); }).join(' → ');
  }

  function panelHTML(pl) {
    var s = app.state, t = pl.totals, items = s.items, h = '';
    /* summary */
    h += '<div class="bsum"><div class="bsum__top"><div><div class="over lime">Your trip</div><h2 class="disp" style="margin-top:6px">' + (items.length ? plural(t.days, 'day') + ' · ' + plural(pl.countries.length, 'country', 'countries') : 'Start anywhere') + '</h2>' +
      '<div class="bsum__route">' + (items.length ? esc(MM.routeLine(pl)) : 'Tap a hostel on the map, or pick a starter below.') + '</div></div>' +
      (items.length ? '<div class="bsum__total"><b>~' + money(t.total) + '</b><span>est. total · ' + (t.est ? 'incl. estimates' : 'per person') + '</span></div>' : '') + '</div>' +
      (items.length ? '<div class="stats"><div class="stat"><b>' + t.nights + '</b><span>nights</span></div><div class="stat"><b>' + t.stops + '</b><span>stops</span></div><div class="stat"><b>' + pl.km.toLocaleString('en-GB') + '</b><span>km</span></div><div class="stat"><b>' + pl.legs.length + '</b><span>transfers</span></div></div>' : '') +
      '<div class="bsum__ctl"><div class="field"><label for="startd">Start date</label><input class="input" id="startd" type="date" value="' + esc(s.start) + '" min="' + U.isoDate(new Date()) + '"></div>' +
      '<div class="field"><label>Travel style</label><div class="seg" role="group" aria-label="Travel style"><button type="button" data-act="pref" data-v="cheap" aria-pressed="' + (s.pref === 'cheap') + '">Cheapest</button><button type="button" data-act="pref" data-v="balanced" aria-pressed="' + (s.pref === 'balanced') + '">Smart</button><button type="button" data-act="pref" data-v="fast" aria-pressed="' + (s.pref === 'fast') + '">Fastest</button></div></div>' +
      '<div class="field full"><label for="fund">Food + fun fund: ' + money(s.fund) + ' a day</label><input class="range" id="fund" type="range" min="5" max="60" step="1" value="' + s.fund + '" aria-label="Daily spending money"></div></div></div>';

    if (!items.length) {
      h += '<div class="empty"><h3>Tap the map.<br>Start anywhere.</h3><p>Every Mad Monkey is a pin. Add a few and we\'ll work out the buses, boats and flights between them, the cost, and the days.</p><div class="row">' +
        (app.meta.from && P[app.meta.from] ? '<button class="btn btn--sm btn--pink" data-act="addplace" data-p="' + app.meta.from + '" type="button">I\'m at ' + esc(P[app.meta.from].n) + '</button>' : '') +
        '<button class="btn btn--sm" data-go="quiz" type="button">Build it for me</button></div></div>';
      h += '<div><div class="over" style="margin-bottom:var(--s-2)">Or start from a classic</div><div class="nextbar">' +
        MM.ALL_IN.slice(0, 5).map(function (t) { return '<button class="nextchip" data-act="addblock" data-id="' + t.id + '" type="button"><b>ALL IN ' + esc(t.n) + '</b> <small>' + t.days + 'd · ' + money(t.usd) + '</small></button>'; }).join('') +
        MM.CLASSICS.slice(0, 5).map(function (c) { return '<button class="nextchip" data-act="customise" data-id="' + c.id + '" type="button"><b>' + esc(c.n) + '</b></button>'; }).join('') + '</div></div>';
      if (app.meta.from && P[app.meta.from]) h += nextBar(app.meta.from, 'Where next from Mad Monkey ' + P[app.meta.from].n + '?');
      return h;
    }

    /* add bar */
    var groups = {}; MM.PLACE_ORDER.forEach(function (id) { if (app.focus.length && app.focus.indexOf(P[id].c) < 0) return; (groups[P[id].c] = groups[P[id].c] || []).push(id); });
    h += '<div class="addbar"><div class="addbar__row"><div class="sel-wrap"><select class="select" id="addsel" aria-label="Add a stop"><option value="">+ Add a stop…</option>' +
      Object.keys(groups).map(function (c) { return '<optgroup label="' + MM.COUNTRIES[c].n + '">' + groups[c].map(function (id) { return '<option value="' + id + '">' + esc(P[id].n) + (P[id].partner ? ' (partner)' : '') + (P[id].opens ? ' (opens ' + P[id].opens.slice(8) + '/' + P[id].opens.slice(5, 7) + ')' : '') + '</option>'; }).join('') + '</optgroup>'; }).join('') + '</select></div></div>' +
      nextBar(pl.segs[pl.segs.length - 1].last, 'Where guests go next') + '</div>';

    /* itinerary */
    h += '<div class="itin">';
    pl.segs.forEach(function (sg, i) {
      h += sg.kind === 'allin' ? blockCard(sg, i, pl) : stopCard(sg, i, pl);
      var leg = pl.legs.filter(function (l) { return l.index === i; })[0];
      if (leg) h += legCard(leg);
      else if (i < pl.segs.length - 1) h += '<div style="height:var(--s-4)"></div>';
    });
    h += '</div>';

    /* ALL IN match */
    if (pl.match.length) h += matchCard(pl.match[0], pl);
    /* squad */
    if (pl.segs.some(function (x) { return x.kind === 'allin'; })) h += squadCard(pl);
    /* warnings */
    if (pl.warnings.length) h += '<div class="warns">' + pl.warnings.map(function (w) { return '<div class="warn warn--' + w.t + '"><i>' + (w.t === 'season' ? '~' : w.t === 'info' ? 'i' : '!') + '</i><span>' + esc(w.m) + '</span></div>'; }).join('') + '</div>';
    /* day by day */
    h += '<div class="blk"><button class="blk__hd" data-act="toggle" data-k="days" aria-expanded="' + !!app.open.days + '" type="button"><h3>Day by day</h3><span class="pill pill--sm pill--paper">' + (app.open.days ? 'Hide' : 'Show') + ' ' + t.days + ' days</span></button>' + (app.open.days ? '<div class="blk__bd">' + daysHTML(pl) + '</div>' : '') + '</div>';
    /* costs */
    h += costsHTML(pl);
    /* CTA */
    h += '<div class="cta"><button class="btn btn--lg btn--pink" data-act="lead" type="button">Send it to the crew</button><div class="cta__row"><button class="btn btn--sm btn--paper" data-act="share" type="button">Share link</button><button class="btn btn--sm btn--paper" data-act="story" type="button">Story card</button><button class="btn btn--sm btn--paper" data-act="copytext" type="button">Copy for WhatsApp</button><button class="btn btn--sm btn--paper" data-act="print" type="button">Print / PDF</button><button class="btn btn--sm btn--ghost" data-act="reset" type="button">Start over</button></div>' +
      '<p class="fine">Estimates, not quotes. Dorm beds are "from" prices, transport is typical fares, activities are listed prices (est. where marked). The crew confirms live rates, dates and availability before you pay anything.</p></div>';
    return h;
  }

  function nextBar(fromId, title) {
    var p = P[fromId]; if (!p) return '';
    var used = {}; app.state.items.forEach(function (it) { if (it.kind === 'stop') used[it.p] = 1; });
    var ids = p.next.filter(function (id) { return id !== fromId; }).slice(0, 5);
    if (!ids.length) return '';
    return '<div class="nextbar"><span class="over">' + esc(title) + '</span>' + ids.map(function (id) {
      var r = MM.route(fromId, id, app.state.pref || 'balanced');
      return '<button class="nextchip" data-act="addplace" data-p="' + id + '" type="button"><b>' + esc(P[id].n) + '</b>' + (r ? ' <small>' + hours(r.h) + ' · ~' + money(r.u) + '</small>' : '') + '</button>';
    }).join('') + '</div>';
  }

  function stopCard(sg, i, pl) {
    var p = P[sg.p], it = app.state.items[i], open = !!app.open['acts' + i], chosen = sg.acts;
    var travelDays = pl.days.filter(function (d) { return d.si === i && d.loc === sg.p; });
    var sub = [MM.COUNTRIES[p.c].n, 'dorm from ' + money(p.bed) + '/night', plural(sg.n, 'night')];
    var epicNights = sg.epics.reduce(function (a, e) { return a + e.multi.n; }, 0); if (epicNights) sub.push('+ ' + plural(epicNights, 'night') + ' away');
    var h = '<div class="stopc" id="stop' + i + '"><div class="stopc__head"><div class="stopc__thumb photo">' + photo(MM.hostelImg(p.id)).replace('class="photo ', 'class="photo ').replace('<div', '<div style="width:100%;height:100%"') + '<span class="stopc__num">' + (i + 1) + '</span></div>' +
      '<div><h3><span class="dotc" data-c="' + p.c + '"></span>' + esc(p.n) + (p.partner ? ' ' + chip('Partner', 'pill--yellow') : '') + '</h3><div class="stopc__sub">' + sub.join(' · ') + '</div></div>' +
      '<div class="stopc__ctl"><div class="stepper" role="group" aria-label="Nights in ' + esc(p.n) + '"><button type="button" data-act="nights" data-i="' + i + '" data-d="-1" aria-label="One fewer night"' + (it.n <= 1 ? ' disabled' : '') + '>−</button><b>' + plural(it.n, 'night') + '</b><button type="button" data-act="nights" data-i="' + i + '" data-d="1" aria-label="One more night"' + (it.n >= 30 ? ' disabled' : '') + '>+</button></div>' +
      '<div class="stopc__tools"><button class="iconbtn" data-act="move" data-i="' + i + '" data-d="-1" aria-label="Move up" type="button"' + (i === 0 ? ' disabled' : '') + '>↑</button><button class="iconbtn" data-act="move" data-i="' + i + '" data-d="1" aria-label="Move down" type="button"' + (i === app.state.items.length - 1 ? ' disabled' : '') + '>↓</button><button class="iconbtn" data-act="remove" data-i="' + i + '" aria-label="Remove ' + esc(p.n) + '" type="button">×</button></div></div></div>';
    if (chosen.length && !open) h += '<div class="stopc__picks">' + chosen.slice(0, 4).map(function (a) { return '<span class="pill pill--sm">' + esc(a.n) + '</span>'; }).join('') + (chosen.length > 4 ? '<span class="pill pill--sm pill--paper">+' + (chosen.length - 4) + ' more</span>' : '') + '</div>';
    h += '<button class="stopc__more" data-act="toggle" data-k="acts' + i + '" aria-expanded="' + open + '" type="button"><span>Things to do at ' + esc(p.n) + '</span><span class="count"><span class="pill pill--sm pill--paper">' + chosen.length + ' picked</span><b>' + (open ? '−' : '+') + '</b></span></button>';
    if (open) h += actsPanel(sg, i);
    return h + '</div>';
  }

  var SLOT = { full: 'Full day', half: 'Half day', eve: 'Evening' };
  function actCard(a, on, i) {
    var price = a.usd == null ? 'Pay on the day' : (a.est ? '~' : '') + money(a.usd), small = a.usd == null ? '' : a.est ? 'est.' : 'from';
    var length = a.multi ? (a.multi.d > 1 ? a.multi.d + ' days' + (a.multi.n ? ' · ' + a.multi.n + (a.multi.n === 1 ? ' night' : ' nights') + ' away' : '') : SLOT[a.slot]) : SLOT[a.slot];
    var url = MM.actUrl(a);
    return '<div class="act" role="button" tabindex="0" data-act="act" data-i="' + i + '" data-a="' + a.id + '" aria-pressed="' + on + '">' + photo(MM.actImg(a)) +
      '<div><b>' + esc(a.n) + '</b><div class="sub">' + (a.star ? '<span class="star">★ Top pick</span>' : '') + '<span>' + length + '</span><span>' + (a.dows ? a.when : 'Every day') + '</span>' + (url ? '<a class="link" href="' + url + '" target="_blank" rel="noopener" data-stop="1">Details ↗</a>' : '') + '</div>' + (a.note ? '<div class="sub" style="margin-top:2px">' + esc(a.note) + '</div>' : '') + '</div>' +
      '<div class="px">' + price + (small ? '<small>' + small + '</small>' : '') + '</div></div>';
  }
  function actsPanel(sg, i) {
    var it = app.state.items[i], sel = {}; it.acts.forEach(function (id) { sel[id] = 1; });
    var all = MM.actsAt(sg.p).slice().sort(function (x, y) { return (y.star ? 1 : 0) - (x.star ? 1 : 0) || (x.usd == null ? -1 : x.usd) - (y.usd == null ? -1 : y.usd); });
    var groups = [['Top picks', function (a) { return a.star; }], ['Multi-day adventures', function (a) { return !a.star && a.cat === 'epic'; }], ['Days out', function (a) { return !a.star && a.cat === 'day'; }], ['Nights out', function (a) { return !a.star && a.cat === 'night'; }]];
    var h = '<div class="acts">';
    groups.forEach(function (g) { var list = all.filter(g[1]); if (list.length) h += '<div class="acts__group"><div class="over">' + g[0] + '</div>' + list.map(function (a) { return actCard(a, !!sel[a.id], i); }).join('') + '</div>'; });
    return h + '</div>';
  }

  function legCard(leg) {
    var from = P[leg.from].n, to = P[leg.to].n;
    var h = '<div class="legc"><div class="legc__hd"><span>' + esc(from) + '</span><span class="arrow">→</span><span>' + esc(to) + '</span>' + (leg.ovn ? chip(leg.nights > 1 ? leg.nights + ' nights on the move' : 'Overnight', 'pill--cyan') : '') + '</div><div class="legopts">';
    leg.options.forEach(function (o) {
      h += '<button class="legopt" type="button" data-act="leg" data-i="' + leg.index + '" data-k="' + o.key + '" aria-pressed="' + (o.key === leg.key) + '">' + legIcon(leg, o) +
        '<div><b>' + o.label + ' · ' + esc(o.modeLabel) + '</b><span class="nt">' + esc(stepsText(o.route)) + '</span></div><div class="tm">~' + money(o.u) + '<small>' + hours(o.h) + '</small></div></button>';
    });
    h += '</div>';
    var x = '';
    if (leg.border) x += '<div class="legc__warn">' + esc(leg.border) + '</div>';
    if (leg.tickets) x += '<div>Mad Monkey sells the train tickets: ' + leg.tickets.map(function (t) { return t.n + ' ' + money(t.usd); }).join(' · ') + ' <a href="https://madmonkeyhostels.com/tours-events/' + leg.tickets[1].slug + '" target="_blank" rel="noopener">Book ↗</a></div>';
    if (leg.pkgs) x += '<div>Or bundle it: ' + leg.pkgs.map(function (k) { return '<a href="https://madmonkeyhostels.com/tours-events/' + k.slug + '" target="_blank" rel="noopener">' + esc(k.n) + ' ' + money(k.usd) + ' ↗</a>'; }).join(' · ') + ' (transfer + Siem Reap experiences)</div>';
    if (x) h += '<div class="legc__x">' + x + '</div>';
    return h + '</div>';
  }

  function blockCard(sg, i, pl) {
    var t = sg.trip, route = (MM.ALL_IN_ROUTE[t.id] || []), nd = MM.nextDeparture(t, U.parseDate(app.state.start) || tomorrow());
    var h = '<div class="blockc" id="stop' + i + '"><div class="blockc__top"><div><span class="pill pill--sm">ALL IN</span><h3 style="margin-top:8px">' + esc(t.n) + '</h3><div class="route">' + esc(t.tag) + '</div></div><div class="blockc__px"><b>' + money(t.usd) + '</b><span>' + t.days + ' days · ' + (t.status === 'soon' ? 'rrp' : 'from') + '</span></div></div>' +
      '<div class="blockc__days">' + route.map(function (r) { return '<div><b>DAY ' + r[0] + '</b><span><strong style="color:var(--paper)">' + esc(r[1]) + '.</strong> ' + esc(r[2]) + '</span></div>'; }).join('') + '</div>' +
      '<div class="blockc__foot"><span class="fine" style="color:var(--ink-dim-on-black);flex:1;min-width:200px">' + (t.status === 'soon' ? 'Launching soon. Pop your details in to be first on the list.' : 'Departs every ' + U.DOWN[t.dep] + ' · next ' + U.fmtDate(nd) + (t.until ? ' · until ' + t.until : '') + ' · $' + MM.DEPOSIT + ' holds your spot') + '</span>' +
      '<button class="btn btn--sm" data-act="customiseblock" data-i="' + i + '" type="button">Customise</button><button class="iconbtn" style="color:var(--paper);border-color:var(--paper)" data-act="move" data-i="' + i + '" data-d="-1" aria-label="Move up" type="button"' + (i === 0 ? ' disabled' : '') + '>↑</button><button class="iconbtn" style="color:var(--paper);border-color:var(--paper)" data-act="move" data-i="' + i + '" data-d="1" aria-label="Move down" type="button"' + (i === app.state.items.length - 1 ? ' disabled' : '') + '>↓</button><button class="iconbtn" style="color:var(--paper);border-color:var(--paper)" data-act="remove" data-i="' + i + '" aria-label="Remove ALL IN ' + esc(t.n) + '" type="button">×</button></div></div>';
    return h;
  }

  function matchCard(m, pl) {
    var t = m.trip, pct = Math.round(m.cover * 100), cheaper = pl.totals.diy > t.usd;
    var nd = U.fmtDate(m.next);
    var names = m.hit.map(function (p) { return P[p].n; }).join(' + ');
    return '<div class="match"><span class="pill pill--sm pill--black">ALL IN match</span><h3>This looks a lot like ALL IN ' + esc(t.n) + '.</h3>' +
      '<p>You\'re hitting ' + esc(names) + (m.missing.length ? ' but skipping ' + esc(m.missing.map(function (p) { return P[p].n; }).join(', ')) : '') + '. On ALL IN you get beds, every transfer, every activity, free drinks and a crew of up to ' + t.max + ' in one price.</p>' +
      '<div class="cmp"><div><b>~' + money(pl.totals.diy) + '</b><span>Your DIY route</span></div><div><b>' + money(t.usd) + '</b><span>ALL IN ' + (t.status === 'soon' ? 'rrp' : 'from') + '</span></div></div>' +
      '<p class="fine" style="color:var(--black)">' + (cheaper ? 'ALL IN is the cheaper way to do it, and meals + drinks are on top of your DIY number.' : 'Not like for like: ALL IN also covers meals, free drinks and a guaranteed crew.') + ' ' + (t.status === 'soon' ? 'Launching soon.' : 'Next departure ' + nd + '.') + '</p>' +
      '<div class="match__row"><button class="btn btn--sm btn--black" data-act="swapallin" data-id="' + t.id + '" type="button">Swap in ALL IN</button><a class="btn btn--sm btn--paper" href="' + MM.ALLIN_URL + '" target="_blank" rel="noopener">Details ↗</a></div></div>';
  }
  function squadCard(pl) {
    var s = app.state, t = pl.totals, first = pl.segs.filter(function (x) { return x.kind === 'allin'; })[0].trip;
    var perk = s.crew >= 6 ? 'You travel FREE.' : s.crew >= 3 ? 'You get 50% off.' : 'Rally 3 mates for 50% off, 6 to go free.';
    return '<div class="squad"><span class="pill pill--sm pill--pink">Squad Leader</span><h3>Bring the crew, travel for less.</h3>' +
      '<div style="display:flex;align-items:center;gap:var(--s-3);flex-wrap:wrap"><div class="stepper" role="group" aria-label="Mates you are rallying"><button type="button" data-act="crew" data-d="-1" aria-label="Fewer mates"' + (s.crew <= 0 ? ' disabled' : '') + '>−</button><b>' + plural(s.crew, 'mate') + '</b><button type="button" data-act="crew" data-d="1" aria-label="More mates"' + (s.crew >= 8 ? ' disabled' : '') + '>+</button></div><span style="font-weight:700;font-size:14px">' + perk + (t.squad ? ' Your ALL IN ' + esc(first.n) + ' ticket: ' + money(first.usd + t.squad) + '.' : '') + '</span></div>' +
      '<p class="fine">Squad Leader perks apply to the leader\'s own ticket on an ALL IN trip. Everyone pays the standard price.</p></div>';
  }

  function routeLineFor(trip, d) {
    var rows = MM.ALL_IN_ROUTE[trip.id] || [];
    for (var i = 0; i < rows.length; i++) { var m, re = /(\d+)(?:–(\d+))?/g; while ((m = re.exec(rows[i][0]))) { var a = +m[1], b = m[2] ? +m[2] : a; if (d >= a && d <= b) return rows[i]; } }
    return null;
  }
  function daysHTML(pl) {
    var start = pl.days.length ? 0 : 0, h = '<div class="days">';
    var blockNo = {}; pl.days.forEach(function (d, i) { if (d.kind === 'block') { blockNo[d.blockTrip.id + d.si] = (blockNo[d.blockTrip.id + d.si] || 0) + 1; d._bk = blockNo[d.blockTrip.id + d.si]; } });
    pl.days.forEach(function (d) {
      var title = d.title, extra = '';
      if (d.kind === 'block') { var rr = routeLineFor(d.blockTrip, d._bk); title = 'ALL IN ' + d.blockTrip.n + (rr ? ' · ' + rr[1] : ''); if (rr && (d._bk === 1 || routeLineFor(d.blockTrip, d._bk - 1) !== rr)) extra = '<div class="note">' + esc(rr[2]) + '</div>'; }
      var travel = '';
      if (d.travel && (d.kind === 'stay' || d.kind === 'move')) { var l = d.travel, c = l.chosen; travel = '<div class="trv">' + MM.modeIcon(c.main) + esc(P[l.from].n) + ' → ' + esc(P[l.to].n) + ' · ' + esc(c.modeLabel) + ' · ' + hours(c.h) + ' · ~' + money(c.u) + '</div>'; }
      var acts = (d.acts || []).map(function (x) { var a = MM.ACTS[x.id]; return '<li><b>' + x.part + '</b><span>' + esc(a.n) + (a.usd != null ? ' <span class="dim">(' + (a.est ? '~' : '') + money(a.usd) + ')</span>' : '') + '</span></li>'; }).join('');
      var ev = (d.notes || []).map(function (n) { return '<span class="ev">' + esc(n) + '</span>'; }).join('');
      var epic = d.epic ? '<div class="note">' + esc(d.epic.note || 'Multi-day experience, everything included in the tour price.') + '</div>' : '';
      h += '<div class="day day--' + d.kind + '"><div class="day__n"><b>' + d.n + '</b><span>day</span></div><div><h4>' + esc(title) + '</h4>' + (d.dateLabel ? '<div class="dl">' + d.dateLabel + '</div>' : '') + travel + (acts ? '<ul>' + acts + '</ul>' : '') + extra + epic + (d.note ? '<div class="note">' + esc(d.note) + '</div>' : '') + ev + '</div></div>';
    });
    return h + '</div>';
  }

  function costsHTML(pl) {
    var t = pl.totals, rows = [['Beds', t.beds], ['Transport', t.transport], ['Activities', t.acts], ['ALL IN trips', t.allin], ['Food + fun fund', t.fund]].filter(function (r) { return r[1] > 0; });
    var max = Math.max.apply(0, rows.map(function (r) { return r[1]; })) || 1;
    var h = '<div class="blk"><div class="blk__hd" style="cursor:default"><h3>Where the money goes</h3></div><div class="blk__bd"><div class="costs">' +
      rows.map(function (r) { return '<div class="cost"><span>' + r[0] + '</span><i><u style="width:' + Math.max(3, Math.round(r[1] / max * 100)) + '%"></u></i><b>' + money(r[1]) + '</b></div>'; }).join('') + '</div>';
    if (t.squad) h += '<div class="cost" style="margin-top:9px"><span>Squad Leader</span><i style="visibility:hidden"></i><b>−' + money(-t.squad) + '</b></div>';
    h += '<div class="costs__tot" style="margin-top:var(--s-3)"><span>Estimated total</span><span>~' + money(t.total) + '</span></div>' +
      '<p class="fine" style="margin-top:var(--s-2)">' + (t.est ? 'Includes estimated activity prices (marked est.). ' : '') + (t.payOnDay ? t.payOnDay + ' free-or-pay-on-the-day nights out not counted. ' : '') + 'Flights to and from Asia, insurance and visas are not included.' + (t.coveredBed ? ' Surf-camp packages cover ' + plural(t.coveredBed, 'bed night') + '.' : '') + '</p></div></div>';
    return h;
  }

  /* ============================================================
     MODALS
     ============================================================ */
  function openModal(html, onMount) {
    modalRoot.innerHTML = '<div class="modal" role="dialog" aria-modal="true"><div class="modal__box">' + html + '</div></div>';
    var m = $('.modal', modalRoot); m.addEventListener('mousedown', function (e) { if (e.target === m) closeModal(); });
    var f = $('input,select,textarea,button', m); if (f) f.focus();
    if (onMount) onMount(m);
  }
  function closeModal() { modalRoot.innerHTML = ''; }

  function openLead() {
    if (!plan || !plan.totals.days) { toast('Add a stop first'); return; }
    var q = store('mm-lead') || {};
    openModal('<div class="modal__hd"><div><div class="over">Almost there</div><h2 class="disp">Send it to the crew.</h2></div><button class="modal__x" data-act="close" aria-label="Close" type="button">×</button></div>' +
      '<div class="modal__bd"><p style="font-weight:500">A real person from the crew gets your whole plan: stops, dates, transport choices and what you\'re keen to do. They\'ll pick it up from here.</p>' +
      '<form id="leadf" novalidate><div class="form2"><div class="field"><label for="lf-name">First name</label><input class="input" id="lf-name" name="name" autocomplete="given-name" required value="' + esc(q.name || '') + '"></div>' +
      '<div class="field"><label for="lf-email">Email</label><input class="input" id="lf-email" name="email" type="email" autocomplete="email" required value="' + esc(q.email || '') + '"></div>' +
      '<div class="field"><label for="lf-wa">WhatsApp (best way to reach you)</label><input class="input" id="lf-wa" name="whatsapp" type="tel" autocomplete="tel" placeholder="+44 …" value="' + esc(q.whatsapp || '') + '"></div>' +
      '<div class="field"><label for="lf-from">Where are you now?</label><input class="input" id="lf-from" name="from" placeholder="city or country" value="' + esc(q.from || '') + '"></div>' +
      '<div class="field"><label for="lf-size">Travelling as</label><select class="select" id="lf-size" name="size"><option value="1">Just me</option><option value="2">2 of us</option><option value="3">3 of us</option><option value="4">4 of us</option><option value="6">5–6 of us</option><option value="8">7+ of us</option></select></div>' +
      '<div class="field"><label for="lf-flex">Dates</label><select class="select" id="lf-flex" name="flex"><option value="fixed">These dates, locked</option><option value="flex">Flexible by a week or so</option><option value="open">Still deciding</option></select></div>' +
      '<div class="field full"><label for="lf-notes">Anything else?</label><textarea class="input" id="lf-notes" name="notes" placeholder="dietary, budget worries, who you\'re bringing…"></textarea></div>' +
      '<div class="full" style="display:none"><label>Leave empty <input name="website" tabindex="-1" autocomplete="off"></label></div>' +
      '<label class="chk full"><input type="checkbox" name="consent" required><span>It\'s OK for Mad Monkey to contact me about this trip. We only use your details to plan it with you.' + (C.PRIVACY_URL ? ' <a href="' + esc(C.PRIVACY_URL) + '" target="_blank" rel="noopener">Privacy</a>' : '') + '</span></label></div>' +
      '<div id="leaderr" class="warn" style="display:none;margin-top:var(--s-3)"><i>!</i><span></span></div>' +
      '<div style="display:flex;gap:var(--s-2);margin-top:var(--s-4);flex-wrap:wrap"><button class="btn btn--pink" type="submit">Send it</button><button class="btn btn--ghost" data-act="close" type="button">Not yet</button></div></form></div>', function (m) {
        $('#leadf', m).addEventListener('submit', submitLead);
      });
  }
  function submitLead(e) {
    e.preventDefault(); var f = e.target, v = {}; new FormData(f).forEach(function (val, k) { v[k] = typeof val === 'string' ? val.trim() : val; });
    var err = $('#leaderr'), show = function (m) { err.style.display = 'grid'; $('span', err).textContent = m; };
    if (v.website) return;                                               // honeypot
    if (!v.name) return show('Pop your first name in.');
    if (!/^\S+@\S+\.\S+$/.test(v.email || '')) return show('That email doesn\'t look right.');
    if (!v.consent) return show('Tick the box so we\'re allowed to reply.');
    store('mm-lead', { name: v.name, email: v.email, whatsapp: v.whatsapp, from: v.from });
    var payload = MM.leadPayload(app.state, plan, { name: v.name, email: v.email, whatsapp: v.whatsapp || '', from: v.from || '', partySize: +v.size || 1, dates: v.flex, notes: v.notes || '', consent: true },
      { ref: app.meta.ref, fromHostel: app.meta.from, link: shareLink() });
    track('lead', { stops: plan.places.length, days: plan.totals.days });
    var btn = $('button[type=submit]', f); btn.disabled = true; btn.textContent = 'Sending…';
    if (!C.LEAD_ENDPOINT) return setTimeout(function () { leadDone(payload, 'demo'); }, 400);
    fetch(C.LEAD_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); leadDone(payload, 'sent'); })
      .catch(function () { btn.disabled = false; btn.textContent = 'Send it'; show('That didn\'t go through. Try again, or copy your plan and message the crew directly.'); });
  }
  function leadDone(payload, mode) {
    var wa = C.WHATSAPP ? 'https://wa.me/' + C.WHATSAPP + '?text=' + encodeURIComponent('Hi Mad Monkey, I built a trip: ' + MM.routeLine(plan) + ' (' + plan.totals.days + ' days). ' + shareLink()) : '';
    openModal('<div class="modal__hd"><div><div class="over">' + (mode === 'sent' ? 'Sent' : 'Demo mode') + '</div><h2 class="disp">' + (mode === 'sent' ? 'Nice one. The crew has it.' : 'Lead card ready.') + '</h2></div><button class="modal__x" data-act="close" aria-label="Close" type="button">×</button></div><div class="modal__bd">' +
      (mode === 'demo' ? '<div class="demo">DEMO MODE: nothing was sent. Set <code>LEAD_ENDPOINT</code> in config.js and this goes straight to the crew.</div>' : '<p style="font-weight:500">A real person will pick this up. Keep an eye on ' + (payload.contact.whatsapp ? 'WhatsApp' : 'your email') + '.</p>') +
      '<div class="leadcard"><b style="color:var(--lime);letter-spacing:.1em;text-transform:uppercase;font-size:11px">What the crew sees</b><div style="margin-top:6px"><b>' + esc(payload.contact.name) + '</b> · ' + esc(payload.contact.email) + (payload.contact.whatsapp ? ' · ' + esc(payload.contact.whatsapp) : '') + '<br>' + esc(payload.trip.route) + '<br>' + payload.trip.days + ' days · ~' + MM.money(payload.trip.estTotalUsd, 'USD') + ' est. · ' + payload.trip.urgency + (payload.ref ? ' · ref ' + esc(payload.ref) : '') + (payload.fromHostel ? ' · from Mad Monkey ' + esc(P[payload.fromHostel] ? P[payload.fromHostel].n : payload.fromHostel) : '') + '</div><pre>' + esc(payload.itinerary) + '</pre></div>' +
      '<div style="display:flex;gap:var(--s-2);flex-wrap:wrap"><button class="btn btn--sm" data-act="copylead" type="button">Copy lead card</button>' + (wa ? '<a class="btn btn--sm btn--pink" href="' + wa + '" target="_blank" rel="noopener">Message the crew on WhatsApp</a>' : '') + (C.CREW_EMAIL && mode === 'demo' ? '<a class="btn btn--sm btn--paper" href="mailto:' + esc(C.CREW_EMAIL) + '?subject=' + encodeURIComponent('Trip: ' + MM.routeLine(plan)) + '&body=' + encodeURIComponent(payload.itinerary + '\n\n' + shareLink()) + '">Email it</a>' : '') + '<button class="btn btn--sm btn--ghost" data-act="close" type="button">Done</button></div></div>');
    app._lastLead = payload;
  }

  function openShare() {
    var link = shareLink(), text = MM.planText(plan, app.state, app.cur) + '\n\n' + link;
    openModal('<div class="modal__hd"><div><div class="over">Share</div><h2 class="disp">Send it to the group chat.</h2></div><button class="modal__x" data-act="close" aria-label="Close" type="button">×</button></div><div class="modal__bd">' +
      '<p style="font-weight:500">This link opens your exact trip, ready to edit. Perfect for getting your mates to say yes.</p>' +
      '<div class="sharebox"><input class="input" id="sharelink" readonly value="' + esc(link) + '" aria-label="Share link"><button class="btn btn--sm" data-act="copylink" type="button">Copy</button></div>' +
      '<div style="display:flex;gap:var(--s-2);flex-wrap:wrap"><a class="btn btn--sm btn--pink" href="https://wa.me/?text=' + encodeURIComponent(text) + '" target="_blank" rel="noopener">Share on WhatsApp</a><button class="btn btn--sm btn--paper" data-act="story" type="button">Make a story card</button></div></div>');
  }
  function openStory() {
    openModal('<div class="modal__hd"><div><div class="over">Story card</div><h2 class="disp">Post the route.</h2></div><button class="modal__x" data-act="close" aria-label="Close" type="button">×</button></div><div class="modal__bd"><div class="story"><canvas id="storyc" width="1080" height="1920" aria-label="Your route as a story image"></canvas><div style="display:flex;flex-direction:column;gap:var(--s-3)"><p style="font-weight:500">1080 × 1920, made for Instagram + TikTok stories. Tag <b>@madmonkeyhostels</b> and say where you\'re headed.</p><button class="btn btn--pink" data-act="dlstory" type="button">Download PNG</button></div></div></div>', function (m) {
      MM.drawStory($('#storyc', m), plan, app.state, app.cur);
    });
  }

  /* ============================================================
     EVENTS
     ============================================================ */
  document.addEventListener('click', function (e) {
    if (e.target.closest('a[data-stop]')) { e.stopPropagation(); return; }
    var go_ = e.target.closest('[data-go]'); if (go_) { e.preventDefault(); var v = go_.getAttribute('data-go'); if (v === 'quiz') { app.quiz.step = 0; } go(v === 'build' && app.state.items.length ? 'build' : v, v === 'build' && app.state.items.length ? MM.encodeState(app.state) : ''); return; }
    var cur = e.target.closest('[data-cur]'); if (cur) { app.cur = cur.getAttribute('data-cur'); $$('[data-cur]').forEach(function (b) { b.setAttribute('aria-pressed', String(b === cur)); }); store('mm-cur', app.cur); if (app.view === 'build') refreshBuilder(); else route(); return; }
    var rg = e.target.closest('[data-focus]'); if (rg) { var fc = rg.getAttribute('data-focus'); if (!fc) app.focus = []; else { var fi = app.focus.indexOf(fc); if (fi > -1) app.focus.splice(fi, 1); else app.focus.push(fc); } refreshBuilder(); return; }
    var el = e.target.closest('[data-act]'); if (!el) return;
    var act = el.getAttribute('data-act'), i = +el.getAttribute('data-i'), S = app.state;
    switch (act) {
      case 'scroll': { var t = document.getElementById(el.getAttribute('data-to')); if (t) t.scrollIntoView({ behavior: 'smooth' }); break; }
      case 'close': closeModal(); break;
      /* quiz */
      case 'qpick': { var s = QSTEPS[app.quiz.step]; app.quiz.a[s.k] = el.getAttribute('data-v'); renderQuiz(); setTimeout(quizAdvance, 220); break; }
      case 'qdays': app.quiz.a.days = +el.getAttribute('data-v'); renderQuiz(); break;
      case 'qmonth': { var mm = el.getAttribute('data-m'); app.quiz.a.month = mm === '' ? null : +mm; app.quiz.a.year = mm === '' ? null : +el.getAttribute('data-y'); renderQuiz(); setTimeout(quizAdvance, 220); break; }
      case 'qmulti': { var k = QSTEPS[app.quiz.step].k, list = app.quiz.a[k], v2 = el.getAttribute('data-v'), ix = list.indexOf(v2); if (ix > -1) list.splice(ix, 1); else list.push(v2); renderQuiz(); break; }
      case 'qnext': quizAdvance(); break;
      case 'qback': app.quiz.step = Math.max(0, app.quiz.step - 1); renderQuiz(); break;
      case 'qedit': app.quiz.step = 0; go('quiz'); break;
      case 'openres': { var r = app.results[i]; app.state = Object.assign(MM.defaultState(), JSON.parse(JSON.stringify(r.state))); app.focus = []; persist(); track('open_result', { id: r.cand.tpl.id }); go('build', MM.encodeState(app.state)); break; }
      /* home / starters */
      case 'addblock': { app.state = MM.defaultState(); app.state.items.push({ kind: 'allin', trip: el.getAttribute('data-id') }); app.focus = []; persist(); track('addblock', { id: el.getAttribute('data-id') }); go('build', MM.encodeState(app.state)); break; }
      case 'customise': { var tpl = MM.tripById(el.getAttribute('data-id')); app.state = MM.defaultState(); tpl.stops.forEach(function (st) { app.state.items.push({ kind: 'stop', p: st.p, n: st.n, acts: st.acts.slice() }); }); app.state.pref = tpl.pref || 'cheap'; app.focus = []; persist(); track('customise', { id: tpl.id }); go('build', MM.encodeState(app.state)); break; }
      case 'customiseblock': { var blk = S.items[i], tp = MM.ALL_IN.filter(function (x) { return x.id === blk.trip; })[0]; var ns = tp.stops.map(function (st) { return { kind: 'stop', p: st.p, n: st.n, acts: st.acts.slice() }; }); mutate(function (s2) { s2.items.splice.apply(s2.items, [i, 1].concat(ns)); }); toast('Now it\'s yours: edit anything'); break; }
      case 'swapallin': { var id2 = el.getAttribute('data-id'), tr = MM.ALL_IN.filter(function (x) { return x.id === id2; })[0], inTrip = {}; tr.stops.forEach(function (st) { inTrip[st.p] = 1; }); mutate(function (s2) { var extras = s2.items.filter(function (it) { return it.kind === 'stop' && !inTrip[it.p]; }); s2.items = [{ kind: 'allin', trip: id2 }].concat(extras); }); track('swap_allin', { id: id2 }); break; }
      /* builder */
      case 'addplace': addStop(el.getAttribute('data-p')); break;
      case 'nights': mutate(function (s2) { var it = s2.items[i]; it.n = Math.max(1, Math.min(30, it.n + (+el.getAttribute('data-d')))); }); break;
      case 'move': { var d = +el.getAttribute('data-d'), j = i + d; if (j >= 0 && j < S.items.length) mutate(function (s2) { var tmp = s2.items[i]; s2.items[i] = s2.items[j]; s2.items[j] = tmp; s2.legPick = {}; }); break; }
      case 'remove': mutate(function (s2) { s2.items.splice(i, 1); s2.legPick = {}; }); break;
      case 'toggle': { var key = el.getAttribute('data-k'); app.open[key] = !app.open[key]; refreshBuilder(); break; }
      case 'act': { var aid = el.getAttribute('data-a'); mutate(function (s2) { var arr = s2.items[i].acts, ix2 = arr.indexOf(aid); if (ix2 > -1) arr.splice(ix2, 1); else arr.push(aid); }); break; }
      case 'leg': mutate(function (s2) { s2.legPick = s2.legPick || {}; s2.legPick[i] = el.getAttribute('data-k'); }); break;
      case 'pref': mutate(function (s2) { s2.pref = el.getAttribute('data-v'); s2.legPick = {}; }); break;
      case 'crew': mutate(function (s2) { s2.crew = Math.max(0, Math.min(8, (s2.crew || 0) + (+el.getAttribute('data-d')))); }); break;
      case 'reset': if (confirm('Clear this trip and start over?')) { app.state = MM.defaultState(); app.open = {}; app.focus = []; persist(); history.replaceState(null, '', '#/build'); refreshBuilder(); } break;
      case 'lead': openLead(); break;
      case 'share': openShare(); break;
      case 'story': openStory(); break;
      case 'print': app.open.days = true; refreshBuilder(); setTimeout(function () { window.print(); }, 150); break;
      case 'copytext': copy(MM.planText(plan, app.state, app.cur) + '\n\n' + shareLink()).then(function (ok) { toast(ok ? 'Copied. Paste it in the chat' : 'Couldn\'t copy: select and copy manually'); }); break;
      case 'copylink': copy(shareLink()).then(function (ok) { toast(ok ? 'Link copied' : 'Couldn\'t copy'); }); break;
      case 'copylead': copy(app._lastLead ? JSON.stringify(app._lastLead, null, 2) : '').then(function (ok) { toast(ok ? 'Lead card copied' : 'Couldn\'t copy'); }); break;
      case 'dlstory': { var cv = $('#storyc'); cv.toBlob(function (b) { var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'my-mad-monkey-route.png'; a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000); track('story_dl'); }, 'image/png'); break; }
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modalRoot.firstChild) closeModal();
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.act[role=button]')) { e.preventDefault(); e.target.click(); }
  });
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.id === 'startd') mutate(function (s) { s.start = t.value || ''; });
    if (t.id === 'addsel' && t.value) { var v = t.value; t.value = ''; addStop(v); }
  });
  document.addEventListener('input', function (e) {
    if (e.target.id === 'fund') { var v = +e.target.value; app.state.fund = v; var lb = $('label[for=fund]'); if (lb) lb.textContent = 'Food + fun fund: ' + money(v) + ' a day'; clearTimeout(app._ft); app._ft = setTimeout(function () { persist(); refreshBuilder(); }, 160); }
  });
  window.addEventListener('hashchange', route);

  /* ---------- boot ---------- */
  (function boot() {
    var q = new URLSearchParams(location.search); app.meta.ref = (q.get('ref') || q.get('r') || '').slice(0, 40); app.meta.from = P[q.get('from')] ? q.get('from') : '';
    var sc = store('mm-cur'); if (sc === 'GBP' || sc === 'USD') app.cur = sc;
    $$('[data-cur]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-cur') === app.cur)); });
    var qa = store('mm-quiz'); if (qa) { app.quiz.a = Object.assign({ days: 14, vibes: [], must: [] }, qa); }
    if (app.meta.from && !location.hash) { app.state = MM.defaultState(); location.hash = '#/build'; return; }
    route();
  })();
})();
