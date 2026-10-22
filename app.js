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

  var app = window.MMApp = { view: 'home', cur: 'USD', state: MM.defaultState(), quiz: { step: 0, a: { days: 14, vibes: [], must: [] } }, results: null, profile: null, focus: [], open: {}, nmOff: {}, meta: { ref: '', from: '' } };
  var plan = null;
  app.views = {}; app.passport = ''; app.recoDays = 14; app.auto = false; app.pv = []; app.pm = []; app.pbudget = null;

  /* ---------- utils ---------- */
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var money = function (usd) { return MM.money(usd, app.cur); };
  // Money wording shared by every screen. A deposit is taken when MM_CONFIG.DEPOSIT_PER_PERSON > 0 (the live ALL IN site); without one, nothing is paid until the guest approves the checked plan.
  var dep = function () { return +C.DEPOSIT_PER_PERSON || 0; };
  var TERMS = {
    hold: function () { return dep() ? 'A $' + dep() + ' deposit per person holds the beds on a trip you build while they do it, and you only pay the rest once you\'ve approved the plan.' : 'We can hold your beds while they do it, and you approve before you pay a penny.'; },
    step2: function () { return dep() ? 'Send it for checking with a $' + dep() + ' deposit per person and we hold the nights while we look.' : 'Send it for checking and we hold the nights while we look.'; },
    step4: function () { return dep() ? 'You get the checked plan and the final price. Happy? Pay the rest now, later or in instalments. Can\'t make it work? Your deposit comes back.' : 'You get a confirmed plan. Happy? Pay the deposit. Not? No harm done.'; },
    send: function () { return dep() ? 'Send it for checking and a real person looks over every bus, bed and price before you pay the rest.' : 'One tap sends your plan to a real person who can book it.'; },
    box: function () { return dep() ? 'Hit "Hold my beds" ($' + dep() + ' deposit per person) and the crew reviews your whole trip before you pay the rest.' : 'Hit "Hold my beds" and the crew reviews your whole trip before you pay a penny.'; },
    cta: function () { return dep() ? 'A $' + dep() + ' deposit per person holds your beds, the crew reviews the routes, dates and prices, and you approve before you pay the rest.' : 'We hold your beds, the crew reviews the routes, dates and prices, and you approve before you pay anything.'; },
    before: function () { return dep() ? 'before you pay the rest' : 'before you pay anything'; }
  };
  var plural = function (n, w, ws) { return n + ' ' + (n === 1 ? w : (ws || w + 's')); };
  app.revise = null;      // set while a guest is changing a trip they already sent (ui-review.js): { ref, k, base, ... }
  function store(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(k)); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }
  app.revise = store('mm-revise');
  var SID = (function () { try { var s = sessionStorage.getItem('mm-sid'); if (!s) { s = Math.random().toString(36).slice(2, 12); sessionStorage.setItem('mm-sid', s); } return s; } catch (e) { return 'x'; } })();
  function track(name, props) {
    try { (window.dataLayer = window.dataLayer || []).push({ event: 'mm_' + name, props: props || {} }); } catch (e) { /* analytics is optional */ }
    if (C.EVENT_ENDPOINT && navigator.sendBeacon) { try { navigator.sendBeacon(C.EVENT_ENDPOINT, new Blob([JSON.stringify({ n: name, p: props || {}, s: SID })], { type: 'application/json' })); } catch (e) { /* ignore */ } }
  }
  // A message at the bottom of the screen. With {undo: true} it carries an Undo button and stays a little longer.
  function toast(msg, o) {
    var t = document.createElement('div'), m = document.createElement('span'); t.className = 'toast' + (o && o.undo ? ' toast--act' : ''); m.textContent = msg; t.appendChild(m);
    if (o && o.undo) { var b = document.createElement('button'); b.type = 'button'; b.setAttribute('data-act', 'undo'); b.textContent = 'Undo'; t.appendChild(b); }
    while (toastRoot.children.length > 2) toastRoot.removeChild(toastRoot.firstChild);   // never more than three at once
    toastRoot.appendChild(t); setTimeout(function () { t.remove(); }, o && o.undo ? 6500 : 2400);
  }
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

  app.rerender = function () { if (app.view === 'build') refreshBuilder(); else if (app.view === 'home') renderHome(); };

  /* ---------- state ---------- */
  /* ---------- undo / redo: every change to the trip keeps the version before it, so anything can be taken back (the AI's changes, "Start over", a surprise...) ---------- */
  var HIST_MAX = 60, H = app.hist = { past: [], future: [], cur: null, busy: false };
  function snapState(st) { return JSON.stringify({ items: st.items, start: st.start, pref: st.pref, legPick: st.legPick, fund: st.fund, crew: st.crew, budget: st.budget, month: st.month }); }
  function recordHist() {
    var sn = snapState(app.state); if (H.cur === null) { H.cur = sn; return; } if (sn === H.cur) return;
    if (!H.busy) { H.past.push(H.cur); if (H.past.length > HIST_MAX) H.past.shift(); H.future = []; }
    H.cur = sn;
  }
  function syncHist() { var sn = snapState(app.state); if (sn !== H.cur) { H.cur = sn; H.past = []; H.future = []; } }   // a trip opened from a link starts with a clean history
  function stepHist(dir) {
    var from = dir < 0 ? H.past : H.future, to = dir < 0 ? H.future : H.past; if (!from.length || app.view !== 'build') return null;
    var was = H.cur, next = from.pop(); to.push(was); H.busy = true; var back = JSON.parse(next);
    app.state = Object.assign(MM.defaultState(), back); app.auto = false; persist(); H.cur = next; H.busy = false; refreshBuilder();
    return MM.edit.describe(JSON.parse(was), back);
  }
  app.undo = function () { var d = stepHist(-1); toast(d ? 'Undone' + (d.length ? ': ' + d[0] : '') : 'Nothing to undo'); return !!d; };
  // Take back several steps at once and say so once.
  app.undoMany = function (n) {
    var was = H.cur, k = 0; while (k < n && stepHist(-1)) k++;
    var d = k ? MM.edit.describe(JSON.parse(was), JSON.parse(H.cur)) : null; toast(k ? 'Undone' + (d && d.length ? ': ' + d[0] : '') : 'Nothing to undo'); return k;
  };
  app.redo = function () { var d = stepHist(1); toast(d ? 'Redone' + (d.length ? ': ' + d[0] : '') : 'Nothing to redo'); return !!d; };
  // Replace the trip with an edited one (from the controls or the AI) and offer an Undo.
  app.commit = function (state, msg, quiet) { app.state = state; app.auto = false; persist(); refreshBuilder(); if (!quiet) toast(msg, { undo: true }); };
  function applyEdit(ops) {
    var res = MM.edit.apply(app.state, ops); if (!res.ok) { toast(res.errors[0].replace(/^Change \d+ \([a-z_]+\): /, '')); return false; }
    app.commit(res.state, res.changes[0]); return true;
  }
  app.applyEdit = applyEdit;
  function persist() { recordHist(); store('mm-trip', { state: app.state, cur: app.cur }); if (app.view === 'build') history.replaceState(null, '', '#/build/' + MM.encodeState(app.state)); }
  /* ---------- "Start building" is a blank sheet. The trip you had is kept, and the home page offers to pick it back up ---------- */
  function savedTrip() {
    var cand = [app.state, (store('mm-trip') || {}).state, (store('mm-trip-last') || {}).state];
    for (var k = 0; k < cand.length; k++) if (cand[k] && cand[k].items && cand[k].items.length) return Object.assign(MM.defaultState(), JSON.parse(JSON.stringify(cand[k])));
    return null;
  }
  function startFresh() {
    if (app.state.items.length) store('mm-trip-last', { state: JSON.parse(JSON.stringify(app.state)), at: Date.now() });
    app.state = MM.defaultState(); app.auto = false; app.focus = []; app.open = {}; app.revise = null; store('mm-revise', null); app.tourPending = true;
    store('mm-trip', { state: app.state, cur: app.cur });
  }
  function resumeStrip() {
    var sv = savedTrip(); if (!sv) return '';
    var pl = MM.plan(sv), names = pl.places.map(function (id) { return P[id].n; });
    return '<div class="resume"><div><span class="over">Pick up where you left off</span><b>' + esc(names.slice(0, 4).join(' → ') + (names.length > 4 ? ' → …' : '')) + '</b><span class="fine">' + pl.totals.days + ' days · about ' + money(pl.totals.total) + ' a person</span></div><button class="btn btn--sm btn--paper" data-act="resume" type="button">Continue this trip</button></div>';
  }
  function defaultActs(p, n) {
    var list = MM.actsAt(p).filter(function (a) { return a.star && !(a.multi); });
    return list.slice(0, n >= 3 ? 2 : 1).map(function (a) { return a.id; });
  }
  function stopFor(p, n) { return MM.edit.newStop(p, n); }
  function mutate(fn, opts) { app.auto = false; fn(app.state); persist(); refreshBuilder(opts); }

  /* ============================================================
     ROUTER
     ============================================================ */
  function parseHash() {
    var h = location.hash.replace(/^#\/?/, ''), seg = h.split('/'), view = seg[0] || 'home';
    return { view: ['home', 'quiz', 'results', 'build', 'group', 'trip', 'pack', 'crew'].indexOf(view) > -1 ? view : 'home', rest: seg.slice(1).join('/') };
  }
  function sameAddress(a, b) { try { return decodeURIComponent(a) === decodeURIComponent(b); } catch (e) { return a === b; } }
  // Setting the address to what it already is fires no hashchange, so the screen would never redraw: buttons like "start from a classic",
  // "Surprise me" or "Swap in ALL IN" did nothing when pressed from the builder. Draw it ourselves in that case.
  function go(view, rest) {
    var h = '#/' + (view === 'home' ? '' : view) + (rest ? '/' + rest : '');
    if (sameAddress(location.hash, h)) { route(); return; }
    location.hash = h;
  }
  function route() {
    if (app._unwatch) { app._unwatch(); app._unwatch = null; }
    var r = parseHash(); closeModal();
    if (r.view === 'results' && !app.results) r.view = 'quiz';
    if (r.view === 'build') {
      if (r.rest) { var st = MM.decodeState(r.rest); if (st.items.length || r.rest.indexOf('i=') === 0) app.state = st; }
      else { var saved = store('mm-trip'); if (saved && saved.state && !app.state.items.length) app.state = Object.assign(MM.defaultState(), saved.state); }
    }
    if (r.view === 'build') syncHist();
    app.view = r.view; document.body.setAttribute('data-view', r.view);
    if (r.view === 'build' && app.state.items.length) history.replaceState(null, '', '#/build/' + MM.encodeState(app.state));
    $$('.navbtn[data-go]').forEach(function (b) { b.setAttribute('aria-current', b.getAttribute('data-go') === r.view ? 'true' : 'false'); });
    window.scrollTo(0, 0);
    if (app.views[r.view]) app.views[r.view](r.rest); else ({ home: renderHome, quiz: renderQuiz, results: renderResults, build: renderBuilder })[r.view]();
    track('view', { view: r.view });
    if (r.view === 'build' && app.tourPending) { app.tourPending = false; if (app.tour) setTimeout(function () { if (app.view === 'build' && !app.state.items.length) app.tour.start(); }, 500); }
  }

  /* ============================================================
     HOME
     ============================================================ */
  var HERO_ROUTES = [['bangkok', 'chiang-mai', 'luang-prabang', 'vang-vieng', 'hanoi', 'hoi-an', 'phnom-penh', 'koh-rong'], ['uluwatu', 'nusa-lembongan', 'gili-trawangan', 'kuta-lombok'], ['manila', 'panglao', 'siargao']];
  function spotsPill(t) {
    var s = MM.LIVE && MM.LIVE.spots && MM.LIVE.spots[t.id]; if (!s || s.left == null) return '';
    return '<div class="tcard__spots pill pill--sm ' + (s.left <= 5 ? 'pill--pink' : 'pill--lime') + '">' + (s.left === 0 ? 'Full: join the waitlist' : s.left + (s.left === 1 ? ' spot left' : ' spots left')) + '</div>';
  }
  function liveNotice() { return MM.LIVE && MM.LIVE.notice ? '<div class="livebar">' + esc(MM.LIVE.notice) + '</div>' : ''; }
  function tripCard(t) {
    var img = MM.tourImg(t.img[0]) || MM.hostelImg(t.img[1]), soon = t.status === 'soon', nd = MM.nextDeparture(t, tomorrow());
    return '<article class="tcard">' +
      '<div class="tcard__pill pill ' + (soon ? 'pill--pink' : 'pill--black') + ' pill--sm">' + (soon ? 'Launching soon' : 'Every ' + U.DOWN[t.dep]) + '</div>' + spotsPill(t) +
      '<div class="tcard__price"><div class="burst"><span>' + (soon ? 'rrp' : 'from') + '<b>' + money(t.usd) + '</b></span></div></div>' +
      photo(img) +
      '<div class="tcard__body"><div class="over dim">' + esc(t.kicker) + '</div><h3>' + esc(t.n) + '</h3><div class="tcard__route">' + esc(t.tag) + '</div>' +
      '<div class="tcard__meta"><span class="pill pill--paper pill--sm">' + t.days + ' days</span><span class="pill pill--paper pill--sm">Max ' + t.max + '</span><span class="pill pill--paper pill--sm">$' + MM.DEPOSIT + ' holds your spot</span></div>' +
      '<p style="font-size:13.5px;font-weight:500;margin-top:4px">' + esc(t.pitch) + '</p>' +
      (soon ? '' : '<div class="tcard__next">Next departure: ' + U.fmtDate(nd) + (t.until ? ' · runs until ' + t.until : '') + '</div>') +
      '<div class="tcard__foot">' + (soon ? '<button class="btn btn--sm btn--pink" data-act="waitlist" data-id="' + t.id + '" type="button">Tell me when it launches</button>' : '') + '<button class="btn btn--sm' + (soon ? ' btn--paper' : '') + '" data-act="addblock" data-id="' + t.id + '" type="button">Build on this</button><button class="btn btn--sm btn--paper" data-act="customise" data-id="' + t.id + '" type="button">Customise</button></div></div></article>';
  }
  // the one featured partner trip (MM.SPECIALS[0]); renders nothing when there isn't one
  function specialHTML(g) {
    if (!g) return '';
    var stats = [[g.days, 'days'], [g.stops.length, 'stops']].concat(g.stats || []).concat([[g.gbp ? 'from £' + g.gbp.toLocaleString('en-GB') : g.usd ? 'from ' + money(g.usd) : '', 'per person']]).filter(function (s) { return s[0] !== '' && s[0] != null; });
    return '<div class="gap" style="margin-top:var(--s-7)">' + photo((g.img && MM.tourImg(g.img)) || MM.hostelImg(g.stops[0].p)) +
      '<div class="gap__b"><span class="pill pill--pink pill--sm">Special' + (g.dates ? ' · ' + esc(g.dates) : '') + '</span><h3>' + esc(g.n) + '</h3><p style="font-weight:500">' + esc(g.pitch) + '</p>' +
      '<div class="stats">' + stats.map(function (s) { return '<div class="stat"><b>' + esc(s[0]) + '</b><span>' + esc(s[1]) + '</span></div>'; }).join('') + '</div>' +
      '<div class="tcard__foot" style="padding-top:0"><a class="btn btn--sm btn--pink" href="' + esc(g.url) + '" target="_blank" rel="noopener">Book + details ↗</a></div></div></div>';
  }
  function renderHome() {
    var g = MM.special, ticker = '23 hostels · 6 countries · 150+ things to do · every bus, boat + flight in between · $99 holds an ALL IN spot · real prices · real people · ';
    root.innerHTML = liveNotice() +
      '<section class="hero on-black"><div class="wrap hero__in"><div>' +
        '<div class="over lime" style="margin-bottom:var(--s-4)">Mad Monkey · Trip Builder</div>' +
        '<h1 class="disp">Build the trip you <span class="hl">actually</span> want.</h1>' +
        '<p class="hero__lede"><b>23 hostels. 6 countries.</b> Every bus, boat and flight in between. Pick your stops, see what it really costs, then send it to the crew. Or jump on an ALL IN and let us sort the lot.</p>' +
        '<div class="hero__cta"><button class="btn btn--lg" data-go="build" data-new="1" type="button">Start building</button><button class="btn btn--lg btn--pink" data-go="quiz" type="button">Build it for me <span class="pill pill--sm pill--paper">60 sec</span></button><button class="btn btn--lg btn--paper" data-act="surprise" type="button">Surprise me</button></div>' + resumeStrip() +
      '</div><div class="hero__map" aria-hidden="true">' +
        '<div class="hm hm--d">' + MM.staticMap({ region: 'all', aspect: 0.85, pad: 0, dots: true, countryLabels: true, routes: HERO_ROUTES, animate: true, px: 560, slice: true, other: false }) + '</div>' +
        '<div class="hm hm--m">' + MM.staticMap({ region: 'mainland', aspect: 1.25, pad: 0.0, dots: true, countryLabels: true, routes: [HERO_ROUTES[0]], animate: true, px: 700, slice: true, other: false }) + '</div>' +
        '<div class="burst hero__burst"><span>23<br>hostels</span></div><span class="sticker hero__sticker">All in.</span>' +
      '</div></div></section>' +
      '<div class="ticker" aria-hidden="true"><span>' + (ticker + ticker + ticker + ticker) + '</span></div>' +

      '<section class="sec"><div class="wrap"><div class="sec__head"><h2 class="disp">Three ways in.</h2><p class="dim" style="max-width:30em">Know exactly where you\'re going, want us to work it out, or just want it done? Pick a door.</p></div>' +
        '<div class="doors on-black">' +
          '<button class="door" data-go="build" data-new="1" type="button"><span class="door__n">01</span><h3>Build it yourself</h3><p>Tap hostels on the map. Get the real bus, boat and flight times, the cost, and a day-by-day plan.</p><span class="go">Open the map →</span></button>' +
          '<button class="door" data-go="quiz" type="button"><span class="burst burst--pink door__burst"><span>60<br>sec</span></span><span class="door__n">02</span><h3>Build it for me</h3><p>Seven quick questions. Three routes that fit your days, your vibe and your budget.</p><span class="go">Take the quiz →</span></button>' +
          '<button class="door" data-act="scroll" data-to="trips" type="button"><span class="sticker door__sticker">$99 holds it</span><span class="door__n">03</span><h3>Jump on an ALL IN</h3><p>Pre-built crew trips. Beds, boats and activities sorted. $' + MM.DEPOSIT + ' holds your spot.</p><span class="go">See the trips →</span></button>' +
        '</div></div></section>' +
      X('themesSection') +

      '<section class="sec sec--bone" id="trips"><div class="wrap"><div class="sec__head"><div><div class="over" style="margin-bottom:var(--s-2)">ALL IN trips</div><h2 class="disp">Stop planning.<br>Start going.</h2></div><p class="dim" style="max-width:30em">Up to 20 backpackers, real Mad Monkey beds every night, every transfer and activity in the price, free drinks, 24/7 crew. Flights and insurance not included. Hit <b>Build on this</b> to bolt more days on either end.</p></div>' +
        '<div class="tgrid">' + MM.ALL_IN.map(tripCard).join('') + '</div>' +
        specialHTML(g) +
      '</div></section>' +

      '<section class="sec sec--pink" id="humans"><div class="wrap"><div class="sec__head"><div><div class="over" style="margin-bottom:var(--s-2)">The human bit</div><h2 class="disp">Humans check<br>everything.</h2></div><p style="max-width:32em;font-weight:600">No robot books your trip. Every plan you send is read by a real Mad Monkey crew member who checks the routes, the beds, the dates and the prices. ' + TERMS.hold() + '</p></div>' +
        '<div class="how how--4">' + [['1', 'You build it', 'Pick stops on the map, or let us build it from your budget.'], ['2', 'We hold your beds', TERMS.step2()], ['3', 'A human checks it', 'Routes, beds, dates, prices: read by someone who has done the trip.'], ['4', 'You say yes', TERMS.step4()]].map(function (s) { return '<div class="hs"><b>' + s[0] + '</b><h4>' + s[1] + '</h4><p>' + s[2] + '</p></div>'; }).join('') + '</div>' +
        '<div class="rate"><b>' + MM.TRUST.rating + '</b><span>from ' + MM.TRUST.raters + ' Mad Monkey travellers</span></div>' +
        '<div class="quotes">' + MM.TRUST.quotes.map(function (q) { return '<blockquote class="quote">“' + esc(q.q) + '”<cite>' + esc(q.by) + ' · ' + esc(q.from) + '</cite></blockquote>'; }).join('') + '</div></div></section>' +

      '<section class="sec"><div class="wrap"><div class="sec__head"><h2 class="disp">How it works.</h2></div><div class="how">' +
        '<div><b class="lime">1</b><h4>Pick your stops</h4><p class="dim">Tap hostels, or take the quiz. Every bus, boat and flight between them is already in.</p></div>' +
        '<div><b class="lime">2</b><h4>See the real cost</h4><p class="dim">Beds, transport and activities add up live. Switch between cheapest, smart and fastest on any leg.</p></div>' +
        '<div><b class="lime">3</b><h4>Send it to the crew</h4><p class="dim">' + TERMS.send() + ' Or spot an ALL IN that already covers it.</p></div>' +
      '</div></div></section>' +
      footer();
  }
  function footer() {
    return '<footer class="foot"><div class="wrap"><p>Prices are estimates, not quotes: dorm beds are "from" prices, transport is typical fares (flights switch to the lowest fare found once you add dates), activities are listed prices (or marked est.). The crew confirms live rates ' + TERMS.before() + '. Not included in ALL IN trips: flights, travel insurance, personal spending. Check visa rules for your passport.</p><img src="assets/logo/mad-monkey-white.png" alt="Mad Monkey" width="113" height="34"></div></footer>';
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
    { k: 'budget', over: 'Step 6 of 7', h: 'Budget feel?', help: 'Ground costs only (beds, transport, activities, food), not flights to Asia. It shapes the whole route: how far we hop, bus vs flight, and which paid activities make the cut.', type: 'single' },
    { k: 'crew', over: 'Step 7 of 7', h: 'Solo or a crew?', help: 'Rolling alone is fine. Most people find their people by night two.', type: 'single' }
  ];
  var BUDGETS = [{ v: 'cheap', t: 'Every dollar counts', s: 'About $45 a day · dorms, buses, cheap eats' }, { v: 'mid', t: 'Comfortable, not fussy', s: 'About $80 a day · flights where they save a day' }, { v: 'splash', t: 'Happy to spend', s: 'About $140 a day · do the big stuff properly' }];
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
    root.innerHTML = '<section class="res"><div class="wrap"><div class="res__head"><div class="over">Your routes</div><h2 class="disp">' + ({ 1: 'One trip', 2: 'Two trips', 3: 'Three trips' }[Math.min(3, Math.max(1, app.results.length))]) + '<br>built for <span class="hl">you</span>.</h2></div>' +
      '<div class="res__prof">' + chips.map(function (c) { return '<span class="chip">' + esc(c) + '</span>'; }).join('') + '<button class="chip" data-act="qedit" type="button" style="background:var(--lime)">Edit answers</button></div>' +
      '<div class="rcards">' + app.results.map(function (r, i) { return resultCard(r, i); }).join('') + '</div>' +
      '<div style="margin-top:var(--s-7);display:flex;gap:var(--s-3);flex-wrap:wrap"><button class="btn btn--pink" data-go="build" data-new="1" type="button">Start from a blank map</button></div></div></section>' + footer();
  }
  function resultCard(r, i) {
    var pl = MM.plan(r.state), t = r.cand.tpl, top = i === 0, price = r.isAllIn && !r.hybrid;
    var map = MM.staticMap({ places: pl.places, aspect: top ? 1.25 : 1.6, labels: pl.places.length <= 5, px: top ? 640 : 420, pad: 0.3, minW: 190 });
    return '<article class="rcard' + (top ? ' rcard--top' : '') + '"><div class="rcard__map">' + map + '<span class="rcard__rank pill ' + (top ? 'pill--pink' : 'pill--paper') + '">' + (top ? 'Best fit' : '#' + (i + 1)) + '</span><span class="pill pill--sm ' + (r.generated ? 'pill--paper' : 'pill--yellow') + '" style="position:absolute;right:12px;top:12px">' + (r.generated ? 'Built for you' : 'Ready-made ALL IN') + '</span></div>' +
      '<div class="rcard__body"><div><h3>' + esc(resultName(r)) + '</h3><div class="rcard__route">' + esc(MM.routeLine(pl)) + '</div></div>' +
      '<div class="stats"><div class="stat"><b>' + pl.totals.days + '</b><span>days</span></div><div class="stat"><b>' + (price && t.nStops ? t.nStops : pl.totals.stops) + '</b><span>stops</span></div><div class="stat"><b>' + (price ? money(t.usd) : '~' + money(pl.totals.total)) + '</b><span>' + (price ? 'ALL IN from' : r.hybrid ? 'est. all-in' : 'est. total') + '</span></div></div>' +
      '<div class="why">' + r.why.map(function (w) { return '<span class="pill pill--sm' + (/above your budget|over your budget/.test(w) ? ' pill--yellow' : '') + '">' + esc(w) + '</span>'; }).join('') + '</div>' +
      (r.misses && r.misses.length ? '<p class="rcard__miss"><b>Doesn\'t include:</b> ' + esc(r.misses.join(', ')) + '. Open it in the builder to add ' + (r.misses.length === 1 ? 'it' : 'them') + '.</p>' : '') +
      (r.isAllIn ? '<p style="font-size:13px;font-weight:500">' + (r.hybrid ? 'Start with the ALL IN crew trip, then keep going on your own with beds and transport sorted below.' : esc(t.pitch)) + (t.status === 'soon' ? ' <b>Launching soon.</b>' : '') + '</p>' : '<p style="font-size:13px;font-weight:500">' + esc(t.pitch) + '</p>') +
      '<div class="rcard__cta"><button class="btn btn--sm" data-act="openres" data-i="' + i + '" type="button">Open in builder</button>' + (r.isAllIn ? '<a class="btn btn--sm btn--paper" href="' + MM.allInUrl(t.id) + '" target="_blank" rel="noopener">ALL IN details ↗</a>' : '') + '</div></div></article>';
  }

  /* ============================================================
     BUILDER
     ============================================================ */
  function renderBuilder() {
    root.innerHTML = '<div class="bld"><section class="bmap" id="bmap" aria-label="Map"></section><section class="bpanel" id="bpanel" aria-label="Your trip"></section></div><div class="mbar" id="mbar"></div>';
    var box = $('#bmap'), mapHost = document.createElement('div'); mapHost.style.cssText = 'position:absolute;inset:0'; box.appendChild(mapHost);
    box.insertAdjacentHTML('beforeend', '<div class="bmap__regions" id="regions"></div><div class="bmap__stats" id="mstats"></div><div class="bmap__hint"><span class="pill pill--sm">Tap a hostel to add it</span></div><div class="bmap__ctl"><button type="button" class="bmap__list" data-act="maplist" aria-label="Show the hostels as a list">List</button><button type="button" data-act="mapzoom" data-f="1.5" aria-label="Zoom in">+</button><button type="button" data-act="mapzoom" data-f="0.67" aria-label="Zoom out">−</button><button type="button" class="fit" data-act="mapfit" aria-label="Fit the map to my trip">FIT</button></div>');
    MM.BuilderMap.mount(mapHost, { pin: onPin, leg: onLegTap });
    refreshBuilder({ instant: true });
  }
  function onPin(id) {
    var items = app.state.items, last = items[items.length - 1];
    if (last && last.kind === 'stop' && last.p === id) { toast('You\'re already at ' + P[id].n); return; }
    addStop(id);
  }
  function onLegTap(key, idx) {
    if (idx == null) return; app.open['why' + idx] = true; refreshBuilder();
    var c = document.getElementById('leg' + idx); if (c) { c.scrollIntoView({ behavior: 'smooth', block: 'center' }); c.classList.add('flash'); setTimeout(function () { c.classList.remove('flash'); }, 1400); }
    MM.BuilderMap.selectLeg(key);
  }
  function addStop(id, n) {
    mutate(function (s) { s.items.push(stopFor(id, n)); });
    track('add_stop', { place: id });
    var cards = $$('.stopc'); if (cards.length) cards[cards.length - 1].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function refreshBuilder(opts) {
    if (app.view !== 'build') return;
    var y = window.scrollY; plan = MM.plan(app.state); if (app.fareHook) app.fareHook(plan);
    var panel = $('#bpanel'); if (!panel) return;
    panel.innerHTML = panelHTML(plan);
    missToast();
    $('#regions').innerHTML = '<button type="button" data-focus="" aria-pressed="' + !app.focus.length + '">Everywhere</button>' + Object.keys(MM.COUNTRIES).map(function (c) { return '<button type="button" data-focus="' + c + '" aria-pressed="' + (app.focus.indexOf(c) > -1) + '">' + MM.COUNTRIES[c].n + '</button>'; }).join('');
    var t = plan.totals;
    $('#mstats').innerHTML = t.days ? '<span class="chip"><b>' + t.days + '</b> days</span><span class="chip"><b>' + t.stops + '</b> stops</span><span class="chip"><b>' + plan.countries.length + '</b> ' + (plan.countries.length === 1 ? 'country' : 'countries') + '</span><span class="chip"><b>' + plan.km.toLocaleString('en-GB') + '</b> km</span>' : '';
    $('#mbar').innerHTML = t.days ? '<div><b>~' + money(t.total) + '</b><span>' + t.days + ' days · est. total</span></div><button class="btn btn--sm btn--pink" data-act="lead" type="button">' + (app.revise ? 'Send my changes' : 'Hold my beds') + '</button>' : '<div><b>Tap the map</b><span>to add your first stop</span></div>';
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
    var s = app.state, t = pl.totals, items = s.items, h = app.revise && app.reviseBar ? app.reviseBar() : '';
    if (items.length) h += '<div class="print-head"><img src="assets/logo/mad-monkey-black.png" alt="Mad Monkey"><h1>' + esc(MM.routeLine(pl)) + '</h1><p>' + t.days + ' days · ' + plural(pl.countries.length, 'country', 'countries') + ' · about ' + money(t.total) + ' per person (estimate)' + (s.start ? ' · starting ' + U.fmtDate(U.parseDate(s.start)) : '') + '</p><p class="print-link">Open this trip: ' + esc(shareLink()) + '</p></div>';
    var backG = store('mm-back-group');
    if (backG && items.length) h += '<div class="backg"><span>Building your own route for the group?</span><a class="btn btn--sm btn--pink" href="#/group/' + esc(backG) + '" data-act="backg">Back to the group</a><button class="ideas__x" data-act="backgx" type="button">Dismiss</button></div>';
    /* summary */
    h += '<div class="bsum"><div class="bsum__top"><div><div class="over lime">Your trip</div><h2 class="disp" style="margin-top:6px">' + (items.length ? plural(t.days, 'day') + ' · ' + plural(pl.countries.length, 'country', 'countries') : 'Start anywhere') + '</h2>' +
      '<div class="bsum__route">' + (items.length ? esc(MM.routeLine(pl)) : 'Tap a hostel on the map, or pick a starter below. <button class="linkbtn" data-act="tour" type="button">Show me around</button>') + '</div></div>' +
      (items.length ? '<div class="bsum__total"><b>~' + money(t.total) + '</b><span>est. total · ' + (t.est ? 'incl. estimates' : 'per person') + '</span></div>' : '') + '</div>' +
      (items.length ? '<div class="stats"><div class="stat"><b>' + t.nights + '</b><span>nights</span></div><div class="stat"><b>' + t.stops + '</b><span>stops</span></div><div class="stat"><b>' + pl.km.toLocaleString('en-GB') + '</b><span>km</span></div><div class="stat"><b>' + pl.legs.length + '</b><span>transfers</span></div></div>' : '') +
      '<div class="bsum__ctl"><div class="field"><label for="startd">Start date</label><input class="input" id="startd" type="date" value="' + esc(s.start) + '" min="' + U.isoDate(new Date()) + '"></div>' +
      '<div class="field"><label>Travel style</label><div class="seg" role="group" aria-label="Travel style"><button type="button" data-act="pref" data-v="cheap" aria-pressed="' + (s.pref === 'cheap') + '">Cheapest</button><button type="button" data-act="pref" data-v="balanced" aria-pressed="' + (s.pref === 'balanced') + '">Smart</button><button type="button" data-act="pref" data-v="fast" aria-pressed="' + (s.pref === 'fast') + '">Fastest</button></div></div>' +
      '<div class="field full"><label for="fund">Food + fun fund: ' + money(s.fund) + ' a day</label><input class="range" id="fund" type="range" min="5" max="60" step="1" value="' + s.fund + '" aria-label="Daily spending money"></div>' +
      '<div class="field full"><label for="budget">Budget target: ' + (s.budget ? money(s.budget) : 'not set') + '</label><input class="range" id="budget" type="range" min="0" max="6000" step="50" value="' + (s.budget || 0) + '" aria-label="Total budget target"></div></div>' +
      (items.length && s.budget ? budgetBar(t) : '') + (items.length ? seasonStrip(pl) : '') +
      '<div class="humans"><b>Checked by a real person.</b> ' + (app.revise ? 'Send my changes replaces the trip the crew is checking, so they only ever look at your latest plan.' : TERMS.box()) + '</div></div>';

    if (plannerOn()) h += recoHTML();

    if (!items.length) {
      h += '<div class="empty"><h3>Tap the map.<br>Start anywhere.</h3><p>Every Mad Monkey is a pin. Add a few and we\'ll work out the buses, boats and flights between them, the cost, and the days.</p><div class="row">' +
        (app.meta.from && P[app.meta.from] ? '<button class="btn btn--sm btn--pink" data-act="addplace" data-p="' + app.meta.from + '" type="button">I\'m at ' + esc(P[app.meta.from].n) + '</button>' : '') +
        '<button class="btn btn--sm" data-act="plantoggle" type="button">Plan it for me</button><button class="btn btn--sm btn--pink" data-act="surprise" type="button">Surprise me</button><button class="btn btn--sm btn--paper" data-go="quiz" type="button">Take the quiz</button></div></div>';
      h += '<div><div class="over" style="margin-bottom:var(--s-2)">Or start from a classic</div><div class="nextbar">' +
        MM.ALL_IN.slice(0, 5).map(function (t) { return '<button class="nextchip" data-act="addblock" data-id="' + t.id + '" type="button"><b>ALL IN ' + esc(t.n) + '</b> <small>' + t.days + 'd · ' + money(t.usd) + '</small></button>'; }).join('') +
        MM.CLASSICS.slice(0, 5).map(function (c) { return '<button class="nextchip" data-act="customise" data-id="' + c.id + '" type="button"><b>' + esc(c.n) + '</b></button>'; }).join('') + '</div></div>';
      if (app.meta.from && P[app.meta.from]) h += nextBar(app.meta.from, 'Where next from Mad Monkey ' + P[app.meta.from].n + '?');
      return h;
    }

    h += timelineHTML(pl);
    h += X('doctor', pl);
    h += missHTML();
    /* add bar */
    var groups = {}; MM.PLACE_ORDER.forEach(function (id) { if (app.focus.length && app.focus.indexOf(P[id].c) < 0) return; (groups[P[id].c] = groups[P[id].c] || []).push(id); });
    h += '<div class="addbar"><button class="btn btn--pink addbar__btn" data-act="insertat" data-i="' + app.state.items.length + '" data-where="1" type="button">+ Add a stop</button>' +
      nextBar(pl.segs[pl.segs.length - 1].last, 'Mad Monkey guests go next') + tweakRow() + '</div>';

    /* edit bar + itinerary */
    h += '<div class="editbar" role="toolbar" aria-label="Edit your trip"><button class="btn btn--sm btn--paper" data-act="undo" type="button"' + (H.past.length ? '' : ' disabled') + '>↶ Undo</button><button class="btn btn--sm btn--paper" data-act="redo" type="button"' + (H.future.length ? '' : ' disabled') + '>↷ Redo</button>' +
      '<button class="btn btn--sm btn--paper" data-act="insertat" data-i="' + app.state.items.length + '" data-where="1" type="button">+ Add a stop</button><button class="btn btn--sm btn--ghost" data-act="tour" type="button">Show me around</button><button class="btn btn--sm btn--ghost" data-act="reset" type="button">Start over</button></div>';
    h += '<div class="itin">';
    pl.segs.forEach(function (sg, i) {
      h += sg.kind === 'allin' ? blockCard(sg, i, pl) : stopCard(sg, i, pl);
      var leg = pl.legs.filter(function (l) { return l.index === i; })[0];
      if (leg) h += legCard(leg);
      else if (i < pl.segs.length - 1) h += '<div style="height:var(--s-4)"></div>';
    });
    h += '<button class="addstop" data-act="insertat" data-i="' + pl.segs.length + '" data-where="1" type="button"><b>+ Add another stop</b><span>Changed your mind about a place? Add somewhere else, at the end or anywhere in between.</span></button></div>';

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
    h += X('calendar', pl) + X('guide', pl);
    h += entryHTML(pl);
    /* CTA */
    h += '<div class="humans humans--cta"><b>A real person checks every trip.</b> ' + TERMS.cta() + '</div>' +
      '<div class="cta"><button class="btn btn--lg btn--pink" data-act="lead" type="button">' + (app.revise ? 'Send my changes to the crew' : 'Hold my beds + get it checked') + '</button><div class="cta__row"><button class="btn btn--sm btn--paper" data-act="group" type="button">Plan with mates</button><button class="btn btn--sm btn--paper" data-act="share" type="button">Share link</button><button class="btn btn--sm btn--paper" data-act="story" type="button">Story card</button><button class="btn btn--sm btn--paper" data-act="copytext" type="button">Copy for WhatsApp</button><button class="btn btn--sm btn--paper" data-act="openpack" type="button">Trip pack</button><button class="btn btn--sm btn--paper" data-act="ics" type="button">Add to calendar</button><button class="btn btn--sm btn--paper" data-act="print" type="button">Save as PDF</button><button class="btn btn--sm btn--ghost" data-act="reset" type="button">Start over</button></div>' +
      '<p class="fine">Estimates, not quotes. Dorm beds are "from" prices, transport is typical fares (flights switch to the lowest fare found once you add dates), activities are listed prices (est. where marked). The crew confirms live rates, dates and availability ' + TERMS.before() + '.</p></div>';
    return h;
  }

  /* ---------- recommended itineraries for the chosen countries ---------- */
  var recoCache = { key: '', list: [] };
  function pbudget() { return app.pbudget || (app.state.pref === 'cheap' ? 'cheap' : app.state.pref === 'fast' ? 'splash' : 'mid'); }
  function plannerOn() { return app.focus.length > 0 || !!app.open.planner; }
  function recos() {
    if (!plannerOn()) return [];
    var sd = U.parseDate(app.state.start), month = sd ? sd.getUTCMonth() : (app.state.month != null ? app.state.month : null);
    var key = [app.focus.slice().sort().join(','), app.recoDays, pbudget(), month, app.pv.join(','), app.pm.join(',')].join('|');
    if (recoCache.key !== key) recoCache = { key: key, list: MM.generate({ countries: app.focus.length ? app.focus.slice() : null, days: app.recoDays, budget: pbudget(), month: month, vibes: app.pv.slice(), must: app.pm.slice() }) };
    return recoCache.list;
  }
  function applyReco(r) {
    var st = Object.assign(MM.defaultState(), JSON.parse(JSON.stringify(r.state)));
    st.start = app.state.start; st.budget = app.state.budget; st.crew = app.state.crew; st.fund = app.state.fund; st.pref = app.state.pref; st.legPick = {};
    app.state = st; app.auto = true; persist(); track('reco_apply', { countries: app.focus.join(',') });
  }
  // Picking countries re-plans for you, as long as you haven't started editing by hand.
  function autoReco() {
    if (!plannerOn()) return;
    if (app.state.items.length && !app.auto) return;
    var list = recos(); if (list.length) applyReco(list[0]);
  }
  function recoHTML() {
    var names = app.focus.length ? app.focus.map(function (c) { return MM.COUNTRIES[c].n; }).join(' + ') : 'anywhere', list = recos(), cur = plan ? MM.routeLine(plan) : '', bl = pbudget();
    var chips = function (arr, sel, act, key, lab) { return arr.map(function (x) { return '<button type="button" class="chip" data-act="' + act + '" data-v="' + x[key] + '" aria-pressed="' + (sel.indexOf(x[key]) > -1) + '">' + x[lab] + '</button>'; }).join(''); };
    var h = '<div class="reco"><div class="reco__hd"><div><div class="over">Plan it for me</div><h3 class="disp">' + esc(names) + '</h3></div><button class="iconbtn" data-act="plantoggle" aria-label="Close the planner" type="button">×</button></div>' +
      '<div class="reco__row"><label for="recodays">I\'m going for</label><input class="input reco__n" id="recodays" type="number" min="4" max="45" value="' + app.recoDays + '"><span class="reco__u">days</span>' + [7, 10, 14, 21, 30].map(function (d) { return '<button type="button" class="chip" data-act="recodays" data-v="' + d + '" aria-pressed="' + (app.recoDays === d) + '">' + d + '</button>'; }).join('') + '</div>' +
      '<div class="reco__row"><label>Vibe</label><div class="reco__chips">' + chips(MM.VIBES, app.pv, 'pvibe', 'k', 'n') + '</div></div>' +
      '<div class="reco__row"><label>Must-dos</label><div class="reco__chips">' + chips(MM.MUSTS, app.pm, 'pmust', 'k', 'n') + '</div></div>' +
      '<div class="reco__row"><label>Budget</label><div class="reco__chips">' + [['cheap', 'Every dollar counts · ~$45/day'], ['mid', 'Comfortable · ~$80/day'], ['splash', 'Happy to spend · ~$140/day']].map(function (b) { return '<button type="button" class="chip" data-act="pbudget" data-v="' + b[0] + '" aria-pressed="' + (bl === b[0]) + '">' + b[1] + '</button>'; }).join('') + '</div></div>';
    if (!list.length) return h + '<p class="fine">Nothing sensible fits ' + (app.focus.length ? esc(names) + ' ' : '') + 'in ' + app.recoDays + ' days. Try more days, or fewer countries.</p></div>';
    h += '<div class="over" style="margin-top:4px">Routes for you</div>' + list.map(function (r, i) {
      var p = MM.plan(r.state), line = MM.routeLine(p), on = line === cur;
      return '<div class="reco__c' + (on ? ' on' : '') + '"><div><b>' + esc(line) + '</b><span>' + p.totals.days + ' days · ~' + money(p.totals.total) + ' · ' + plural(p.countries.length, 'country', 'countries') + '</span><em>' + esc(r.why.slice(0, 3).join(' · ')) + '</em></div>' +
        (on ? '<span class="pill pill--sm">In your trip</span>' : '<button class="btn btn--sm" data-act="usereco" data-i="' + i + '" type="button">Use this</button>') + '</div>';
    }).join('');
    return h + '<p class="fine">Same engine as the quiz: it scores every hostel for your vibe, must-dos, month and budget, then routes the real buses, boats and flights. Change anything and it re-plans, until you edit a stop by hand.</p></div>';
  }

  /* ---------- don't miss: good stuff the guest has skipped ---------- */
  function missList() { try { return MM.missed(app.state, app.nmOff); } catch (e) { return []; } }
  function missHTML() {
    var list = missList(); app._miss = list; if (!list.length) return '';
    var lim = X('phone') ? 1 : 3, show = list.slice(0, app.open.missall ? 8 : lim);
    return '<section class="miss" aria-label="Don\'t miss"><div class="miss__hd"><span class="miss__tag">Don\'t miss</span><span class="miss__sub">The crew spotted ' + (list.length === 1 ? 'something' : list.length + ' things') + ' you went past</span></div>' +
      show.map(function (x) {
        var isP = x.kind === 'place', a = isP ? null : MM.ACTS[x.act], img = isP ? MM.hostelImg(x.p) : (MM.actImg(a) || MM.hostelImg(x.p));
        var title = isP ? P[x.p].n : a.n, cost = (x.dDays > 0 ? '+' + x.dDays + (x.dDays === 1 ? ' day' : ' days') + ' · ' : '') + (x.dCost > 0 ? '+' + money(x.dCost) : a && a.usd == null ? 'Pay on the day' : 'No extra cost');
        return '<div class="miss__row" data-c="' + P[x.p].c + '">' + photo(img) + '<div class="miss__bd"><b>' + esc(title) + '</b><p class="miss__why">' + esc(x.why) + '</p><p class="miss__pitch">' + esc(x.pitch) + '</p>' +
          '<div class="miss__ft"><span class="miss__cost">' + cost + '</span><button class="btn btn--sm btn--pink" type="button" data-act="' + (isP ? 'nmadd' : 'nmact') + '" data-k="' + esc(x.k) + '">' + (isP ? 'Add ' + esc(P[x.p].n) : 'Add it') + '</button>' +
          '<button class="miss__no" type="button" data-act="nmoff" data-k="' + esc(x.k) + '">Not for me</button></div></div></div>';
      }).join('') +
      (list.length > lim ? '<button class="miss__more" type="button" data-act="toggle" data-k="missall">' + (app.open.missall ? 'Show fewer' : 'Show ' + (list.length - lim) + ' more') + '</button>' : '') + '</section>';
  }
  // after an edit, flag anything newly skipped once, so it doesn't go unnoticed
  function missToast() {
    var now = {}; (app._miss || []).forEach(function (x) { now[x.k] = x; });
    var prev = app._missSeen; app._missSeen = now; if (!prev) return;
    var fresh = Object.keys(now).filter(function (k) { return !prev[k] && now[k].kind === 'place'; })[0];
    if (fresh) { var w = now[fresh].why.replace(/\.$/, ''); toast('Heads up. ' + w + '. Take a look below.'); }
  }

  // optional extras (ui-extras.js), so the builder still renders if it fails to load
  function X(fn) { try { return window.MMX && window.MMX[fn] ? window.MMX[fn].apply(null, [].slice.call(arguments, 1)) : ''; } catch (e) { return ''; } }
  function nextBar(fromId, title) {
    var p = P[fromId]; if (!p) return '';
    var ranked = MM.nextRanked(fromId).filter(function (x) { return x.id !== fromId; }).slice(0, 5);
    if (!ranked.length) return '';
    return '<div class="nextbar"><span class="over">' + esc(title) + '</span>' + ranked.map(function (x) {
      var r = MM.route(fromId, x.id, app.state.pref || 'balanced');
      return '<button class="nextchip" data-act="addplace" data-p="' + x.id + '" type="button"><b>' + esc(P[x.id].n) + '</b>' + (r ? ' <small>' + hours(r.h) + ' · ~' + money(r.u) + '</small>' : '') + (x.why.length ? '<em class="whytag">' + esc(x.why[0]) + '</em>' : '') + '</button>';
    }).join('') + '</div>';
  }
  function tweakRow() {
    var h = '<div class="tweaks"><button class="btn btn--sm btn--paper" data-act="plantoggle" type="button">Plan it for me</button><button class="btn btn--sm btn--paper" data-act="surprise" type="button">Surprise me</button><button class="btn btn--sm btn--paper" data-act="suggest" type="button">Suggest my next stop</button><button class="btn btn--sm btn--paper" data-act="tweak" data-v="cheaper" type="button">Make it cheaper</button><button class="btn btn--sm btn--paper" data-act="tweak" data-v="faster" type="button">Make it faster</button></div>';
    if (app.open.suggest) {
      var sg = MM.suggestNext(app.state);
      h += '<div class="nextbar"><span class="over">Picked for your route</span>' + (sg.length ? sg.map(function (x) { return '<button class="nextchip" data-act="addplace" data-p="' + x.id + '" type="button"><b>' + esc(P[x.id].n) + '</b> <small>' + hours(x.leg.h) + ' · ~' + money(x.leg.u) + '</small><em class="whytag">' + esc(x.why.slice(0, 2).join(' · ')) + '</em></button>'; }).join('') : '<small>Nothing else fits within a day\'s travel.</small>') + '</div>';
    }
    return h;
  }
  function budgetBar(t) {
    var pct = Math.min(100, Math.round(t.total / t.budget * 100)), over = t.total > t.budget;
    return '<div class="bbar' + (over ? ' over' : '') + '"><div class="bbar__t"><i style="width:' + pct + '%"></i></div><span>' + (over ? 'Over budget by ' + money(t.total - t.budget) : money(t.budgetLeft) + ' left of ' + money(t.budget)) + '</span></div>';
  }
  function seasonStrip(pl) {
    var av = MM.bestMonths(pl.places), sd = U.parseDate(app.state.start), cur = sd ? sd.getUTCMonth() : (app.state.month != null ? app.state.month : null);
    var mx = Math.max.apply(0, av), best = [], thr = mx >= 2.6 ? 2.6 : mx - 0.15; av.forEach(function (v, m) { if (v >= thr) best.push(U.MONTHN[m]); });
    var note = cur != null && av[cur] < 2.1 ? 'Your dates are in the wet or rough-sea season for this route.' : (cur != null && av[cur] >= 2.6 ? 'Your dates are prime season for this route.' : '');
    return '<div class="seas-wrap"><div class="over" style="color:var(--ink-dim-on-black)">Best time for this route</div><div class="seas" role="img" aria-label="Best months for this route: ' + best.join(', ') + '">' +
      av.map(function (v, m) { var k = v >= 2.6 ? 3 : v >= 2.1 ? 2 : 1; return '<i class="s' + k + (cur === m ? ' cur' : '') + '" title="' + U.MONTHN[m] + '"><u style="height:' + (k === 3 ? 100 : k === 2 ? 62 : 28) + '%"></u><span>' + U.MONTHN[m][0] + '</span></i>'; }).join('') + '</div><div class="fine" style="color:var(--ink-dim-on-black)">' + (best.length < 12 ? 'Best: ' + best.slice(0, 5).join(', ') + '. ' : '') + note + '</div></div>';
  }
  function timelineHTML(pl) {
    var out = '';
    pl.segs.forEach(function (sg, i) {
      var w, label, c;
      if (sg.kind === 'allin') { w = sg.trip.days - 1; label = 'ALL IN ' + sg.trip.n; c = 'ALL'; }
      else { w = sg.n + sg.epics.reduce(function (acc, e) { return acc + e.multi.n; }, 0); label = P[sg.p].n; c = P[sg.p].c; }
      out += '<button class="tl__seg" style="flex:' + Math.max(w, 1.2) + ' 1 0" data-c="' + c + '" data-act="goto" data-i="' + i + '" type="button" title="' + esc(label) + '"><b>' + esc(label) + '</b><span>' + w + 'n</span></button>';
      var leg = pl.legs.filter(function (l) { return l.index === i; })[0];
      if (leg) out += '<i class="tl__leg" title="' + esc(leg.chosen.modeLabel + ' · ' + hours(leg.h)) + '">' + MM.modeIcon(leg.chosen.main) + '</i>';
    });
    return '<div class="tl" aria-label="Trip timeline">' + out + '</div>';
  }
  function entryHTML(pl) {
    var open = !!app.open.entry, pass = app.passport;
    var body = '<div class="field"><label for="passport">Your passport</label><div class="sel-wrap"><select class="select" id="passport">' + MM.PASSPORTS.map(function (x) { return '<option value="' + x.k + '"' + (x.k === pass ? ' selected' : '') + '>' + x.n + '</option>'; }).join('') + '</select></div></div>' +
      pl.countries.map(function (c) { var e = MM.ENTRY[c]; return '<div class="entry"><span class="dotc" data-c="' + c + '"></span><div><b>' + MM.COUNTRIES[c].n + '</b><p>' + esc(pass ? e.by[pass] + ' ' : 'Pick your passport to see how long you can stay. ') + esc(e.extra) + '</p><a href="' + e.link + '" target="_blank" rel="noopener">' + esc(e.cta) + ' ↗</a>' + (e.link2 ? ' · <a href="' + e.link2 + '" target="_blank" rel="noopener">' + esc(e.cta2) + ' ↗</a>' : '') + '</div></div>'; }).join('') +
      '<p class="fine">Checked ' + MM.ENTRY_CHECKED + '. Entry rules change often (Thailand cut its visa-free stay to 30 days in September 2026), so always confirm on the official link before you book flights.</p>';
    return '<div class="blk"><button class="blk__hd" data-act="toggle" data-k="entry" aria-expanded="' + open + '" type="button"><h3>Entry rules</h3><span class="pill pill--sm pill--paper">' + plural(pl.countries.length, 'country', 'countries') + ' · ' + (open ? 'Hide' : 'Show') + '</span></button>' + (open ? '<div class="blk__bd">' + body + '</div>' : '') + '</div>';
  }
  function reviewLine(id) {
    var rv = (MM.REVIEWS[id] || [])[0]; if (!rv) return '';
    return '<blockquote class="quote quote--sm">“' + esc(rv.q) + '”<cite>' + esc(rv.by) + (rv.from ? ', ' + esc(rv.from) : '') + '</cite></blockquote>';
  }
  function galleryStrip(id) {
    var g = MM.gallery(id); if (g.length < 2) return '';
    return '<div class="gal">' + g.slice(0, 4).map(function (u, k) { return '<button type="button" class="gal__i" data-act="gal" data-p="' + id + '" data-k="' + k + '" aria-label="Open photo ' + (k + 1) + ' of ' + g.length + '"><img src="' + u + '" alt="" loading="lazy" onerror="this.parentNode.remove()"></button>'; }).join('') + '<button type="button" class="gal__more" data-act="gal" data-p="' + id + '" data-k="0">' + g.length + ' photos</button></div>';
  }
  function icsEscape(t) { return String(t).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;'); }
  function icsDate(d) { return U.isoDate(d).replace(/-/g, ''); }
  function downloadICS(pl, state) {
    var ics = buildICS(pl, state); if (!ics) { toast('Pick a start date first so the days land in your calendar'); return; }
    var bl = new Blob([ics], { type: 'text/calendar' }), al = document.createElement('a'); al.href = URL.createObjectURL(bl); al.download = 'my-mad-monkey-trip.ics'; al.click(); setTimeout(function () { URL.revokeObjectURL(al.href); }, 2000); track('ics');
  }
  function buildICS(pl, state) {
    var sd = U.parseDate(state.start); if (!sd) return null;
    var ev = [], cur = null, stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
    function push(title, from, to, desc) { ev.push({ t: title, a: from, b: U.addDays(to, 1), d: desc || '' }); }
    pl.days.forEach(function (d) {
      if (!d.date || d.kind === 'depart') return;
      var seg = pl.segs[d.si], name = d.kind === 'move' ? 'Overnight travel' : d.kind === 'epic' ? d.epic.n : d.kind === 'block' ? 'ALL IN ' + d.blockTrip.n : 'Mad Monkey ' + P[d.loc].n;
      var key = d.kind + ':' + d.si + ':' + name;
      if (cur && cur.key === key && U.isoDate(U.addDays(cur.last, 1)) === U.isoDate(d.date)) cur.last = d.date; else { cur = { key: key, name: name, first: d.date, last: d.date, kind: d.kind }; ev.push(cur); cur.__raw = true; }
      if (d.travel && d.kind === 'stay') push('Travel: ' + P[d.travel.from].n + ' → ' + P[d.travel.to].n, d.date, d.date, d.travel.chosen.modeLabel + ' · about ' + hours(d.travel.chosen.h) + ' · arrives about ' + d.travel.chosen.arrive);
    });
    var out = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Mad Monkey//Trip Builder//EN', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:My Mad Monkey trip'];
    ev.forEach(function (e, i) {
      var a1, b1, title, desc;
      if (e.__raw) { a1 = e.first; b1 = U.addDays(e.last, 1); var n = Math.round((b1 - a1) / 86400000); title = e.name + (e.kind === 'stay' ? ' (' + plural(n, 'night') + ')' : ''); desc = ''; }
      else { a1 = e.a; b1 = e.b; title = e.t; desc = e.d; }
      out.push('BEGIN:VEVENT', 'UID:mm-' + i + '-' + stamp + '@madmonkeyhostels.com', 'DTSTAMP:' + stamp, 'DTSTART;VALUE=DATE:' + icsDate(a1), 'DTEND;VALUE=DATE:' + icsDate(b1), 'SUMMARY:' + icsEscape(title), 'DESCRIPTION:' + icsEscape((desc ? desc + '\n' : '') + 'Estimates only. Your trip: ' + shareLink()), 'END:VEVENT');
    });
    out.push('END:VCALENDAR'); return out.join('\r\n');
  }
  function openGallery(id, k) {
    var g = MM.gallery(id); if (!g.length) return; k = Math.max(0, Math.min(g.length - 1, k));
    var rv = (MM.REVIEWS[id] || [])[0];
    openModal('<div class="modal__hd"><div><div class="over">Mad Monkey ' + esc(P[id].n) + '</div><h2 class="disp">' + (k + 1) + ' / ' + g.length + '</h2></div><button class="modal__x" data-act="close" aria-label="Close" type="button">×</button></div><div class="modal__bd"><div class="photo lb"><img src="' + g[k] + '" alt="Photo ' + (k + 1) + ' of Mad Monkey ' + esc(P[id].n) + '"></div>' +
      '<div style="display:flex;gap:var(--s-2)"><button class="btn btn--sm btn--paper" data-act="galnav" data-p="' + id + '" data-k="' + (k - 1 + g.length) % g.length + '" type="button">← Back</button><button class="btn btn--sm" data-act="galnav" data-p="' + id + '" data-k="' + (k + 1) % g.length + '" type="button">Next →</button></div>' +
      (rv ? '<blockquote class="quote">“' + esc(rv.q) + '”<cite>' + esc(rv.by) + (rv.from ? ', ' + esc(rv.from) : '') + '</cite></blockquote>' : '') + '</div>');
  }

  function stopCard(sg, i, pl) {
    var p = P[sg.p], it = app.state.items[i], open = !!app.open['acts' + i], chosen = sg.acts;
    var travelDays = pl.days.filter(function (d) { return d.si === i && d.loc === sg.p; });
    var sub = [MM.COUNTRIES[p.c].n, 'dorm from ' + money(p.bed) + '/night', plural(sg.n, 'night')];
    var epicNights = sg.epics.reduce(function (a, e) { return a + e.multi.n; }, 0); if (epicNights) sub.push('+ ' + plural(epicNights, 'night') + ' away');
    var h = '<div class="stopc" id="stop' + i + '" data-seg="' + i + '" data-c="' + p.c + '"><div class="stopc__head"><div class="stopc__thumb photo">' + photo(MM.hostelImg(p.id)).replace('class="photo ', 'class="photo ').replace('<div', '<div style="width:100%;height:100%"') + '<span class="stopc__num">' + (i + 1) + '</span></div>' +
      '<div><h3><span class="dotc" data-c="' + p.c + '"></span>' + esc(p.n) + (p.partner ? ' ' + chip('Partner', 'pill--yellow') : '') + '</h3><div class="stopc__sub">' + sub.join(' · ') + '</div></div>' +
      '<div class="stopc__ctl"><div class="stepper" role="group" aria-label="Nights in ' + esc(p.n) + '"><button type="button" data-act="nights" data-i="' + i + '" data-d="-1" aria-label="One fewer night"' + (it.n <= 1 ? ' disabled' : '') + '>−</button><b>' + plural(it.n, 'night') + '</b><button type="button" data-act="nights" data-i="' + i + '" data-d="1" aria-label="One more night"' + (it.n >= 30 ? ' disabled' : '') + '>+</button></div>' +
'</div></div>' +
      '<div class="stopc__acts" role="group" aria-label="Change ' + esc(p.n) + '"><button class="btn btn--sm btn--paper" data-act="swapat" data-i="' + i + '" type="button"><span aria-hidden="true">⇄</span> Swap place</button><button class="btn btn--sm btn--paper stopc__rm" data-act="remove" data-i="' + i + '" aria-label="Remove ' + esc(p.n) + ' from your trip" type="button"><span aria-hidden="true">×</span> Remove stop</button>' +
      '<span class="stopc__move" role="group" aria-label="Move ' + esc(p.n) + '"><span class="stopc__movelbl">Move</span><button class="iconbtn" data-act="move" data-i="' + i + '" data-d="-1" aria-label="Move ' + esc(p.n) + ' up" title="Move up" type="button"' + (i === 0 ? ' disabled' : '') + '>↑</button><button class="iconbtn" data-act="move" data-i="' + i + '" data-d="1" aria-label="Move ' + esc(p.n) + ' down" title="Move down" type="button"' + (i === app.state.items.length - 1 ? ' disabled' : '') + '>↓</button><button class="iconbtn grip" data-grip="' + i + '" aria-label="Drag to reorder ' + esc(p.n) + '" title="Drag to reorder" type="button"></button></span></div>';
    if (chosen.length && !open) h += '<div class="stopc__picks">' + chosen.slice(0, 4).map(function (a) { return '<button class="pill pill--sm pick" type="button" data-act="dayrm" data-i="' + i + '" data-a="' + a.id + '" aria-label="Remove ' + esc(a.n) + ' from your trip" title="Remove">' + esc(a.n) + ' <b aria-hidden="true">×</b></button>'; }).join('') + (chosen.length > 4 ? '<span class="pill pill--sm pill--paper">+' + (chosen.length - 4) + ' more</span>' : '') + '</div>';
    h += galleryStrip(p.id) + reviewLine(p.id) + X('local', sg, i);
    h += '<button class="stopc__more" data-act="toggle" data-k="acts' + i + '" aria-expanded="' + open + '" type="button"><span>Things to do at ' + esc(p.n) + '</span><span class="count"><span class="pill pill--sm pill--paper">' + chosen.length + ' picked</span><b>' + (open ? '−' : '+') + '</b></span></button>';
    if (open) h += actsPanel(sg, i);
    return h + '</div>';
  }

  var SLOT = { full: 'Full day', half: 'Half day', eve: 'Evening' };
  function actCard(a, on, i) {
    var price = a.usd == null ? 'Pay on the day' : (a.est ? '~' : '') + money(a.usd), small = a.usd == null ? '' : a.live ? 'live' : a.est ? 'est.' : 'from';
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
    var from = P[leg.from].n, to = P[leg.to].n, ex = MM.explainLeg(leg), whyOpen = !!app.open['why' + leg.index];
    var h = '<div class="legc" id="leg' + leg.index + '"><button class="legc__add" data-act="insertat" data-i="' + (leg.index + 1) + '" type="button">+ Add a stop in between</button><div class="legc__hd"><span>' + esc(from) + '</span><span class="arrow">→</span><span>' + esc(to) + '</span>' + (leg.ovn ? chip(leg.nights > 1 ? leg.nights + ' nights on the move' : 'Overnight', 'pill--cyan') : '') + '</div><div class="legopts">';
    leg.options.forEach(function (o) {
      h += '<button class="legopt" type="button" data-act="leg" data-i="' + leg.index + '" data-k="' + o.key + '" aria-pressed="' + (o.key === leg.key) + '">' + legIcon(leg, o) +
        '<div><b>' + o.label + ' · ' + esc(o.modeLabel) + (o.fare ? '<i class="live-pill">fare for your date</i>' : o.route.steps.some(function (s) { return s.e.live; }) ? '<i class="live-pill">live fare</i>' : '') + '</b><span class="nt">' + esc(stepsText(o.route)) + '</span><span class="nt">Arrives about ' + o.arrive + (o.arriveNext ? ' next day' : '') + (o.odd ? ' (odd hour)' : '') + '</span>' + (o.fare && o.fare.max > o.fare.min ? '<span class="nt">Fares that day: ' + money(o.fare.min) + ' to ' + money(o.fare.max) + '. We have used the lowest.</span>' : '') + '</div><div class="tm">' + (o.fare ? '' : '~') + money(o.u) + '<small>' + hours(o.h) + '</small></div></button>';
    });
    h += '</div><button class="why" data-act="toggle" data-k="why' + leg.index + '" aria-expanded="' + whyOpen + '" type="button">Why this leg? <b>' + (whyOpen ? '−' : '+') + '</b></button>';
    if (whyOpen) h += '<div class="why__bd"><p><b>' + ex.verdict + '</b></p>' + (ex.lines.length ? ex.lines.map(function (l) { return '<p>' + l + '</p>'; }).join('') : '<p>This is the only sensible way to do it.</p>') + '</div>';
    var x = '';
    if (leg.border) x += '<div class="legc__warn">' + esc(leg.border) + '</div>';
    if (leg.tickets) x += '<div>Mad Monkey sells the train tickets: ' + leg.tickets.map(function (t) { return t.n + ' ' + money(t.usd); }).join(' · ') + ' <a href="https://madmonkeyhostels.com/tours-events/' + leg.tickets[1].slug + '" target="_blank" rel="noopener">Book ↗</a></div>';
    if (leg.pkgs) x += '<div>Or bundle it: ' + leg.pkgs.map(function (k) { return '<a href="https://madmonkeyhostels.com/tours-events/' + k.slug + '" target="_blank" rel="noopener">' + esc(k.n) + ' ' + money(k.usd) + ' ↗</a>'; }).join(' · ') + ' (transfer + Siem Reap experiences)</div>';
    if (x) h += '<div class="legc__x">' + x + '</div>';
    return h + '</div>';
  }

  function blockCard(sg, i, pl) {
    var t = sg.trip, route = (MM.ALL_IN_ROUTE[t.id] || []), nd = MM.nextDeparture(t, U.parseDate(app.state.start) || tomorrow());
    var h = '<div class="blockc" id="stop' + i + '" data-seg="' + i + '"><div class="blockc__top"><div><span class="pill pill--sm">ALL IN</span><h3 style="margin-top:8px">' + esc(t.n) + '</h3><div class="route">' + esc(t.tag) + '</div></div><div class="blockc__px"><b>' + money(t.usd) + '</b><span>' + t.days + ' days · ' + (t.status === 'soon' ? 'rrp' : 'from') + '</span></div></div>' +
      '<div class="blockc__days">' + route.map(function (r) { return '<div><b>DAY ' + r[0] + '</b><span><strong style="color:var(--paper)">' + esc(r[1]) + '.</strong> ' + esc(r[2]) + '</span></div>'; }).join('') + '</div>' +
      '<div class="blockc__foot"><span class="fine" style="color:var(--ink-dim-on-black);flex:1;min-width:200px">' + (t.status === 'soon' ? 'Launching soon. Pop your details in to be first on the list.' : 'Departs every ' + U.DOWN[t.dep] + ' · next ' + U.fmtDate(nd) + (t.until ? ' · until ' + t.until : '') + ' · $' + MM.DEPOSIT + ' holds your spot') + '</span>' +
      '<button class="btn btn--sm" data-act="customiseblock" data-i="' + i + '" type="button">Customise</button><button class="iconbtn grip" style="color:var(--paper);border-color:var(--paper)" data-grip="' + i + '" aria-label="Drag to reorder" type="button"></button><button class="iconbtn" style="color:var(--paper);border-color:var(--paper)" data-act="move" data-i="' + i + '" data-d="-1" aria-label="Move up" type="button"' + (i === 0 ? ' disabled' : '') + '>↑</button><button class="iconbtn" style="color:var(--paper);border-color:var(--paper)" data-act="move" data-i="' + i + '" data-d="1" aria-label="Move down" type="button"' + (i === app.state.items.length - 1 ? ' disabled' : '') + '>↓</button><button class="btn btn--sm blockc__rm" data-act="remove" data-i="' + i + '" aria-label="Remove ALL IN ' + esc(t.n) + ' from your trip" type="button"><span aria-hidden="true">×</span> Remove</button></div></div>';
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
      '<div class="match__row"><button class="btn btn--sm btn--black" data-act="swapallin" data-id="' + t.id + '" type="button">Swap in ALL IN</button><a class="btn btn--sm btn--paper" href="' + MM.allInUrl(t.id) + '" target="_blank" rel="noopener">Details ↗</a></div></div>';
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
      if (d.travel && (d.kind === 'stay' || d.kind === 'move')) { var l = d.travel, c = l.chosen; travel = '<div class="trv">' + MM.modeIcon(c.main) + esc(P[l.from].n) + ' → ' + esc(P[l.to].n) + ' · ' + esc(c.modeLabel) + ' · ' + hours(c.h) + ' · ' + (c.fare ? 'from ' : '~') + money(c.u) + '</div>'; }
      var sg0 = pl.segs[d.si], editable = d.kind === 'stay' && sg0 && sg0.kind === 'stop';
      var acts = (d.acts || []).map(function (x) {
        var a = MM.ACTS[x.id], mv = editable && !(a.multi && a.multi.d > 1);
        return '<li><b>' + x.part + '</b><span>' + esc(a.n) + (a.usd != null ? ' <span class="dim">(' + (a.est ? '~' : '') + money(a.usd) + ')</span>' : '') + '</span>' +
          (mv ? '<span class="day__ctl"><select class="mvday" data-act="mvday" data-i="' + d.si + '" data-a="' + x.id + '" aria-label="Move ' + esc(a.n) + ' to another day">' + dayOptions(pl, d.si, d.n) + '</select><button class="iconbtn iconbtn--sm" data-act="dayrm" data-i="' + d.si + '" data-a="' + x.id + '" aria-label="Remove ' + esc(a.n) + ' from your trip" type="button">×</button></span>' : '') + '</li>';
      }).join('') + (editable ? addTourRow(pl, d, sg0) : '');
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
     EDITING HELPERS: the day plan's controls and the "add / swap a stop" picker
     ============================================================ */
  function dayOptions(pl, si, cur) {
    return pl.days.filter(function (d) { return d.si === si && d.kind === 'stay'; }).map(function (d) { return '<option value="' + d.n + '"' + (d.n === cur ? ' selected' : '') + '>Day ' + d.n + (d.dateLabel ? ' · ' + d.dateLabel : '') + '</option>'; }).join('');
  }
  function addTourRow(pl, d, sg) {
    var have = (sg.acts || []).map(function (a) { return a.id; }), opts = MM.actsAt(sg.p).filter(function (a) { return have.indexOf(a.id) < 0 && !(a.multi && a.multi.d > 1); });
    if (!opts.length) return '';
    return '<li class="addrow"><select class="mvday addday" data-act="addtourday" data-i="' + d.si + '" data-d="' + d.n + '" aria-label="Add a tour on day ' + d.n + '"><option value="">+ Add a tour on this day…</option>' +
      opts.map(function (a) { return '<option value="' + a.id + '">' + esc(a.n) + (a.usd != null ? ' (' + (a.est ? '~' : '') + money(a.usd) + ')' : '') + '</option>'; }).join('') + '</select></li>';
  }
  // The places on either side of a gap in the trip (0 = before the first stop).
  function nearFor(i) { var a = i > 0 && plan.segs[i - 1] ? plan.segs[i - 1].last : null, b = plan.segs[i] ? plan.segs[i].first : null; return [a, b]; }
  // What it adds to the journey to visit `id` between the two places in `near`.
  function detour(near, id) {
    var a = near[0], b = near[1], ra = a ? MM.route(a, id, 'balanced') : null, rb = b ? MM.route(id, b, 'balanced') : null, rab = a && b ? MM.route(a, b, 'balanced') : null;
    if ((a && !ra) || (b && !rb)) return null;
    return { h: Math.max(0, (ra ? ra.h : 0) + (rb ? rb.h : 0) - (rab ? rab.h : 0)), u: Math.round((ra ? ra.u : 0) + (rb ? rb.u : 0) - (rab ? rab.u : 0)) };
  }
  function openPicker(o) {
    var n = app.state.items.length, pl0 = plan;
    function stopName(k) { var sg = pl0 && pl0.segs[k]; return sg ? (sg.kind === 'allin' ? 'ALL IN ' + sg.trip.n : P[sg.p].n) : 'the last stop'; }
    function rowsHTML() {
      var have = app.state.items.map(function (it) { return it.p; });
      var rows = MM.PLACE_ORDER.filter(function (id) { return !(o.exclude && o.exclude.indexOf(id) > -1); }).map(function (id) { return { id: id, d: o.near ? detour(o.near, id) : null }; });
      // closest to the way first; places already in the trip go last (adding the same place twice is rarely what anyone wants)
      if (o.near && (o.near[0] || o.near[1])) rows.sort(function (x, y) { var nx = have.indexOf(x.id) > -1 ? 1000 : 0, ny = have.indexOf(y.id) > -1 ? 1000 : 0; return (nx + (x.d ? x.d.h : 999)) - (ny + (y.d ? y.d.h : 999)); });
      return rows.map(function (r) {
        var p = P[r.id], ex = o.near && r.d ? ' · adds ' + (r.d.h < 1 ? 'under an hour' : hours(r.d.h)) + ' and ' + money(Math.max(0, r.d.u)) : '', here = have.indexOf(r.id) > -1 && o.swap == null ? ' · already in your trip' : '';
        return '<li data-q="' + esc((p.n + ' ' + MM.COUNTRIES[p.c].n).toLowerCase()) + '"><button class="picker__b" type="button" data-act="pickplace" data-p="' + r.id + '"' + (o.swap != null ? ' data-swap="' + o.swap + '"' : ' data-pos="' + o.position + '"') + '><i class="dotc" data-c="' + p.c + '"></i><span><b>' + esc(p.n) + (p.partner ? ' <em>partner</em>' : '') + '</b><small>' + esc(MM.COUNTRIES[p.c].n) + ' · dorm from ' + money(p.bed) + '/night · ' + p.sug + ' nights suggested' + ex + here + '</small></span></button></li>';
      }).join('');
    }
    function hintText() {
      return o.near && (o.near[0] || o.near[1]) ? (o.near[0] && o.near[1] ? 'Closest to the way from ' + P[o.near[0]].n + ' to ' + P[o.near[1]].n + ' first, with what each adds to the journey.' : 'Easiest to get to first, with what each adds to the journey.') : 'Every Mad Monkey. They keep their nights, you pick the tours.';
    }
    var where = '';
    if (o.where && n > 0) {      // "Where does it go?": the start, or after any stop
      where = '<div class="field"><label for="pkwhere">Where does it go?</label><div class="sel-wrap"><select class="select" id="pkwhere">' +
        '<option value="1"' + (o.position === 1 ? ' selected' : '') + '>At the start, before ' + esc(stopName(0)) + '</option>' +
        app.state.items.map(function (_, k) { return '<option value="' + (k + 2) + '"' + (o.position === k + 2 ? ' selected' : '') + '>' + (k === n - 1 ? 'At the end, after ' : 'After ') + esc(stopName(k)) + '</option>'; }).join('') + '</select></div></div>';
    }
    openModal('<div class="modal__hd"><div><div class="over">Your trip</div><h2 class="disp">' + esc(o.title) + '</h2></div><button class="modal__x" data-act="close" aria-label="Close" type="button">×</button></div><div class="modal__bd">' + where + '<p class="qhelp pkhint" style="margin-bottom:var(--s-3)">' + hintText() + '</p>' +
      '<div class="field"><label for="pksearch">Search</label><input class="input" id="pksearch" type="search" placeholder="a place or a country" autocomplete="off"></div>' +
      '<ul class="picker">' + rowsHTML() + '</ul></div>', function (m) {
        var q = $('#pksearch', m);
        function filter() { var v = q.value.trim().toLowerCase(); $$('.picker li', m).forEach(function (li) { li.hidden = !!v && li.getAttribute('data-q').indexOf(v) < 0; }); }
        q.addEventListener('input', filter);
        var w = $('#pkwhere', m);
        if (w) w.addEventListener('change', function () { o.position = +w.value; o.near = nearFor(o.position - 1); $('.picker', m).innerHTML = rowsHTML(); $('.pkhint', m).textContent = hintText(); filter(); });
      });
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

  /* ---------- contact: guest picks ONE way for the crew to reach them ---------- */
  function contactPick(q) {
    var via = q.via === 'email' || (!q.via && q.email && !q.whatsapp) ? 'email' : 'whatsapp';
    return '<div class="field full cpick" data-via="' + via + '"><span class="lbl">How should the crew reach you?</span>' +
      '<div class="seg" role="radiogroup" aria-label="Contact method"><button type="button" role="radio" data-via="whatsapp" aria-checked="' + (via === 'whatsapp') + '" aria-pressed="' + (via === 'whatsapp') + '">WhatsApp</button><button type="button" role="radio" data-via="email" aria-checked="' + (via === 'email') + '" aria-pressed="' + (via === 'email') + '">Email</button></div>' +
      '<input type="hidden" name="via" value="' + via + '">' +
      '<input class="input cpick__wa" name="whatsapp" type="tel" autocomplete="tel" placeholder="WhatsApp number with country code, e.g. +44 7700 900123" aria-label="WhatsApp number" value="' + esc(q.whatsapp || '') + '">' +
      '<input class="input cpick__em" name="email" type="email" autocomplete="email" placeholder="you@example.com" aria-label="Email" value="' + esc(q.email || '') + '"></div>';
  }
  // returns { via, email, whatsapp } with only the chosen one filled, or { err }
  function readContact(v) {
    if (v.via === 'email') return /^\S+@\S+\.\S+$/.test(v.email || '') ? { via: 'email', email: v.email, whatsapp: '' } : { err: 'That email doesn\'t look right.' };
    var digits = (v.whatsapp || '').replace(/[^\d]/g, '');
    return digits.length >= 8 && digits.length <= 15 ? { via: 'whatsapp', email: '', whatsapp: (/^\s*\+/.test(v.whatsapp) ? '+' : '') + digits } : { err: 'Pop in your WhatsApp number with the country code, e.g. +44.' };
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('.cpick [data-via]'); if (!b) return;
    var box = b.closest('.cpick'), via = b.getAttribute('data-via'); box.setAttribute('data-via', via); box.querySelector('[name=via]').value = via;
    box.querySelectorAll('.seg [data-via]').forEach(function (x) { var on = x === b; x.setAttribute('aria-pressed', on); x.setAttribute('aria-checked', on); });
    var inp = box.querySelector(via === 'email' ? '.cpick__em' : '.cpick__wa'); if (inp) inp.focus();
  });

  function openShare() {
    var link = shareLink(), text = function (l) { return MM.planText(plan, app.state, app.cur) + '\n\n' + l; };
    openModal('<div class="modal__hd"><div><div class="over">Share</div><h2 class="disp">Send it to the group chat.</h2></div><button class="modal__x" data-act="close" aria-label="Close" type="button">×</button></div><div class="modal__bd">' +
      '<p style="font-weight:500">This link opens your exact trip, ready to edit. Perfect for getting your mates to say yes.</p>' +
      (C.SHARE_ENDPOINT ? '<div class="ogprev" id="ogprev" aria-hidden="true"><canvas id="ogc" width="1200" height="630"></canvas><span>This is what your mates see in the chat</span></div>' : '') +
      '<div class="sharebox"><input class="input" id="sharelink" readonly value="' + esc(link) + '" aria-label="Share link"><button class="btn btn--sm" data-act="copylink" type="button">Copy</button></div>' +
      '<div style="display:flex;gap:var(--s-2);flex-wrap:wrap"><a class="btn btn--sm btn--pink" id="sharewa" href="https://wa.me/?text=' + encodeURIComponent(text(link)) + '" target="_blank" rel="noopener">Share on WhatsApp</a><button class="btn btn--sm btn--paper" data-act="story" type="button">Make a story card</button><button class="btn btn--sm btn--paper" data-act="group" type="button">Plan it with mates</button></div>' +
      '<div class="meetup"><span class="over">Travelling separately from a mate?</span><p>Paste their trip link and see where and when you cross.</p><div class="sharebox"><input class="input" id="meetin" placeholder="Paste your mate\'s trip link" aria-label="Your mate\'s trip link"><button class="btn btn--sm" data-act="meetgo" type="button">Check</button></div><div id="meetout" aria-live="polite"></div></div></div>', function (m) {
        if (!C.SHARE_ENDPOINT) return;
        var cv = $('#ogc', m);
        MM.drawCard(cv, plan, app.state, app.cur).then(function () {
          var img = ''; try { img = cv.toDataURL('image/jpeg', 0.84); } catch (e) { /* tainted canvas: share without an image */ }
          return fetch(C.SHARE_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ state: MM.encodeState(app.state), img: img }) });
        }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (d) {
          var short = (C.SITE_URL ? C.SITE_URL.replace(/\/$/, '') : location.origin) + d.path, inp = $('#sharelink', m), wa = $('#sharewa', m);
          if (inp) inp.value = short; if (wa) wa.href = 'https://wa.me/?text=' + encodeURIComponent(text(short));
          track('share_short');
        }).catch(function () { /* the long link still works */ });
      });
  }
  // meet-up: compare this trip with a mate's link (long #/build/ link or a short /t/ link)
  function meetCheck() {
    var raw = ($('#meetin') || {}).value || '', out = $('#meetout'); if (!out) return;
    var say = function (h) { out.innerHTML = h; };
    var mBuild = raw.match(/#\/build\/([^\s]+)/), mShort = raw.match(/\/t\/([a-z0-9]{7})/);
    var got = mBuild ? Promise.resolve(decodeURIComponent(mBuild[1])) : mShort && C.SHARE_ENDPOINT ? fetch(C.SHARE_ENDPOINT + '/' + mShort[1]).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (d) { return d.state; }) : Promise.reject(0);
    got.then(function (enc) {
      var theirs = MM.decodeState(enc); if (!theirs.items || !theirs.items.length) throw 0;
      var o = MM.overlap(app.state, theirs), tp = MM.plan(theirs);
      var h = '<p class="fine">Their trip: ' + esc(MM.routeLine(tp)) + (theirs.start ? '' : ' (no start date yet)') + '</p>';
      if (o.ranges.length) h += '<ul class="meets">' + o.ranges.map(function (r) { return '<li class="hit">You\'re both in <b>' + esc(P[r.p].n) + '</b> ' + esc(r.label) + '. Same hostel?</li>'; }).join('') + '</ul>';
      else if (o.near && o.near.length) h += '<ul class="meets">' + o.near.map(function (n) { return '<li>You just miss each other in <b>' + esc(P[n.p].n) + '</b> (you ' + esc(n.a) + ', them ' + esc(n.b) + '). Shift ' + plural(n.gap, 'day') + ' and you\'d meet.</li>'; }).join('') + '</ul>';
      else if (!o.dated && o.shared.length) h += '<ul class="meets"><li>You both go to <b>' + esc(o.shared.map(function (p) { return P[p].n; }).join(', ')) + '</b>. ' + (app.state.start ? 'Ask them to add a start date' : 'Add your start date') + ' to see if you overlap.</li></ul>';
      else h += '<ul class="meets"><li class="miss">Your trips don\'t cross this time.</li></ul>';
      say(h); track('meetup_check', { hit: o.ranges.length > 0 });
    }).catch(function () { say('<p class="fine">That doesn\'t look like a Mad Monkey trip link. Ask your mate to tap Share in their builder and send you the link.</p>'); });
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
    var door = e.target.closest('.door'); if (door) track('door', { door: door.getAttribute('data-go') || door.getAttribute('data-to') || 'x' });
    var go_ = e.target.closest('[data-go]'); if (go_) { e.preventDefault(); var v = go_.getAttribute('data-go'); if (v === 'quiz') { app.quiz.step = 0; } if (go_.hasAttribute('data-new')) { track('start_fresh', { had: app.state.items.length ? 1 : 0 }); startFresh(); go('build', ''); return; } go(v === 'build' && app.state.items.length ? 'build' : v, v === 'build' && app.state.items.length ? MM.encodeState(app.state) : ''); return; }
    var rg = e.target.closest('[data-focus]'); if (rg) { var fc = rg.getAttribute('data-focus'); if (!fc) app.focus = []; else { var fi = app.focus.indexOf(fc); if (fi > -1) app.focus.splice(fi, 1); else app.focus.push(fc); } autoReco(); if (app.auto) persist(); refreshBuilder(); return; }
    var el = e.target.closest('[data-act]'); if (!el) return;
    var act = el.getAttribute('data-act'), i = +el.getAttribute('data-i'), S = app.state;
    switch (act) {
      case 'goto': { var tg = document.getElementById('stop' + i); if (tg) tg.scrollIntoView({ behavior: 'smooth', block: 'center' }); break; }
      case 'suggest': app.open.suggest = !app.open.suggest; refreshBuilder(); break;
      case 'tweak': { var before = MM.plan(app.state).totals.total, ns2 = MM.tweak(app.state, el.getAttribute('data-v')), after = MM.plan(ns2).totals; app.state = Object.assign(MM.defaultState(), ns2); persist(); refreshBuilder();
        toast(el.getAttribute('data-v') === 'cheaper' ? (before - after.total > 1 ? 'Cheaper route: saves about ' + money(before - after.total) : 'That\'s already about as cheap as it gets') : 'Fastest connections picked: ' + (after.total - before > 1 ? 'about ' + money(after.total - before) + ' more' : 'no extra cost')); break; }
      case 'ics': downloadICS(plan, app.state); break;
      case 'gal': openGallery(el.getAttribute('data-p'), +el.getAttribute('data-k')); break;
      case 'galnav': openGallery(el.getAttribute('data-p'), +el.getAttribute('data-k')); break;
      case 'group': if (app.group) app.group.start(); break;
      case 'plantoggle': app.open.planner = !plannerOn() ? true : false; if (!app.open.planner && app.focus.length) { /* closing the planner leaves the country focus alone */ } autoReco(); if (app.auto) persist(); refreshBuilder(); break;
      case 'pvibe': { var vv = el.getAttribute('data-v'), vi = app.pv.indexOf(vv); if (vi > -1) app.pv.splice(vi, 1); else app.pv.push(vv); autoReco(); if (app.auto) persist(); refreshBuilder(); break; }
      case 'pmust': { var mv = el.getAttribute('data-v'), mi = app.pm.indexOf(mv); if (mi > -1) app.pm.splice(mi, 1); else app.pm.push(mv); autoReco(); if (app.auto) persist(); refreshBuilder(); break; }
      case 'pbudget': { var bv2 = el.getAttribute('data-v'); app.pbudget = bv2; app.state.pref = bv2 === 'cheap' ? 'cheap' : bv2 === 'splash' ? 'fast' : 'balanced'; app.state.legPick = {}; if (app.auto) { autoReco(); } persist(); refreshBuilder(); break; }
      case 'recodays': app.recoDays = +el.getAttribute('data-v'); autoReco(); if (app.auto) persist(); refreshBuilder(); break;
      case 'usereco': { var rl = recos(); if (rl[i]) { applyReco(rl[i]); refreshBuilder(); MM.BuilderMap.reset(); } break; }
      case 'mapzoom': MM.BuilderMap.zoom(+el.getAttribute('data-f')); break;
      case 'mapfit': MM.BuilderMap.reset(); break;
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
      case 'backg': store('mm-back-group', null); break;
      case 'backgx': store('mm-back-group', null); refreshBuilder(); break;
      case 'nmadd': case 'nmact': {
        var nk = el.getAttribute('data-k'), nx = (app._miss || []).filter(function (x) { return x.k === nk; })[0]; if (!nx) break;
        if (nx.kind === 'place') mutate(function (s2) { s2.items.splice(nx.after + 1, 0, stopFor(nx.p, P[nx.p].min)); s2.legPick = {}; });
        else mutate(function (s2) { var it = s2.items[nx.seg]; if (it && it.acts.indexOf(nx.act) < 0) it.acts.push(nx.act); });
        track('miss_add', { k: nk }); toast(nx.kind === 'place' ? P[nx.p].n + ' added to your trip' : 'Added to ' + P[nx.p].n);
        break;
      }
      case 'nmoff': { app.nmOff[el.getAttribute('data-k')] = 1; store('mm-nmoff', app.nmOff); track('miss_no', { k: el.getAttribute('data-k') }); refreshBuilder(); break; }
      case 'nights': mutate(function (s2) { var it = s2.items[i]; it.n = Math.max(1, Math.min(30, it.n + (+el.getAttribute('data-d')))); }); break;
      case 'move': { var d = +el.getAttribute('data-d'), j = i + d; if (j >= 0 && j < S.items.length) mutate(function (s2) { var tmp = s2.items[i]; s2.items[i] = s2.items[j]; s2.items[j] = tmp; s2.legPick = {}; }); break; }
      case 'remove': { var nm = S.items[i] ? (S.items[i].kind === 'allin' ? 'ALL IN trip' : P[S.items[i].p].n) : 'stop'; mutate(function (s2) { s2.items.splice(i, 1); s2.legPick = {}; }); toast('Removed ' + nm, { undo: true }); break; }
      case 'resume': { var sv = savedTrip(); if (sv) { app.state = sv; app.auto = false; persist(); go('build', MM.encodeState(sv)); } break; }
      case 'undo': app.undo(); { var tt = el.closest('.toast'); if (tt) tt.remove(); } break;
      case 'redo': app.redo(); break;
      case 'insertat': openPicker({ title: 'Add a stop', position: i + 1, near: nearFor(i), where: el.hasAttribute('data-where') }); break;
      case 'swapat': openPicker({ title: 'Swap ' + (S.items[i] && S.items[i].p ? P[S.items[i].p].n : 'this stop') + ' for…', swap: i, exclude: [S.items[i] && S.items[i].p] }); break;
      case 'pickplace': { var pid = el.getAttribute('data-p'), sw = el.getAttribute('data-swap'), pos = +el.getAttribute('data-pos'); closeModal(); if (sw !== null && sw !== '') applyEdit([{ op: 'swap_stop', stop: +sw + 1, place: pid }]); else if (applyEdit([{ op: 'add_stop', place: pid, position: pos }])) { var nc = document.getElementById('stop' + (pos - 1)); if (nc) nc.scrollIntoView({ behavior: 'smooth', block: 'center' }); } break; }
      case 'dayrm': applyEdit([{ op: 'remove_tour', stop: i + 1, tour: el.getAttribute('data-a') }]); break;
      case 'toggle': { var key = el.getAttribute('data-k'); app.open[key] = !app.open[key]; refreshBuilder(); break; }
      case 'act': { var aid = el.getAttribute('data-a'); mutate(function (s2) { var arr = s2.items[i].acts, ix2 = arr.indexOf(aid); if (ix2 > -1) arr.splice(ix2, 1); else arr.push(aid); }); break; }
      case 'leg': mutate(function (s2) { s2.legPick = s2.legPick || {}; s2.legPick[i] = el.getAttribute('data-k'); }); break;
      case 'pref': mutate(function (s2) { s2.pref = el.getAttribute('data-v'); s2.legPick = {}; }); break;
      case 'crew': mutate(function (s2) { s2.crew = Math.max(0, Math.min(8, (s2.crew || 0) + (+el.getAttribute('data-d')))); }); break;
      case 'reset': { app.state = MM.defaultState(); app.open = {}; app.focus = []; persist(); history.replaceState(null, '', '#/build'); refreshBuilder(); toast('Cleared your trip', { undo: true }); break; }
      case 'lead': if (app.review) app.review.open(); break;
      case 'share': openShare(); break;
      case 'story': openStory(); break;
      case 'print': app.open.days = true; refreshBuilder(); setTimeout(function () { window.print(); }, 150); break;
      case 'copytext': copy(MM.planText(plan, app.state, app.cur) + '\n\n' + shareLink()).then(function (ok) { toast(ok ? 'Copied. Paste it in the chat' : 'Couldn\'t copy: select and copy manually'); }); break;
      case 'meetgo': meetCheck(); break;
      case 'copylink': copy(($('#sharelink') || {}).value || shareLink()).then(function (ok) { toast(ok ? 'Link copied' : 'Couldn\'t copy'); }); break;
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
    if (t.id === 'recodays') { app.recoDays = Math.max(4, Math.min(45, parseInt(t.value, 10) || 14)); autoReco(); if (app.auto) persist(); refreshBuilder(); }
    if (t.id === 'passport') { app.passport = t.value; store('mm-passport', t.value); refreshBuilder(); }
    if (t.id === 'addsel' && t.value) { var v = t.value; t.value = ''; addStop(v); }
    var da = t.getAttribute && t.getAttribute('data-act');
    if (da === 'mvday' && t.value) applyEdit([{ op: 'move_tour', stop: +t.getAttribute('data-i') + 1, tour: t.getAttribute('data-a'), day: +t.value }]);
    if (da === 'addtourday' && t.value) { var si1 = +t.getAttribute('data-i') + 1; applyEdit([{ op: 'add_tour', stop: si1, tour: t.value }, { op: 'move_tour', stop: si1, tour: t.value, day: +t.getAttribute('data-d') }]); }
  });
  document.addEventListener('input', function (e) {
    if (e.target.id === 'budget') { var bv = +e.target.value; app.state.budget = bv; var bl = $('label[for=budget]'); if (bl) bl.textContent = 'Budget target: ' + (bv ? money(bv) : 'not set'); clearTimeout(app._bt); app._bt = setTimeout(function () { persist(); refreshBuilder(); }, 160); }
    if (e.target.id === 'fund') { var v = +e.target.value; app.state.fund = v; var lb = $('label[for=fund]'); if (lb) lb.textContent = 'Food + fun fund: ' + money(v) + ' a day'; clearTimeout(app._ft); app._ft = setTimeout(function () { persist(); refreshBuilder(); }, 160); }
  });
  /* ---------- drag to reorder (mouse + touch) ---------- */
  document.addEventListener('pointerdown', function (e) {
    var g = e.target.closest && e.target.closest('.grip'); if (!g) return; e.preventDefault();
    var idx = +g.getAttribute('data-grip'), cards = $$('[data-seg]'), card = cards[idx]; if (!card) return;
    var rects = cards.map(function (c) { var r = c.getBoundingClientRect(); return { top: r.top + window.scrollY, h: r.height }; });
    var y0 = e.clientY, sy0 = window.scrollY, target = idx, auto = 0, lastY = e.clientY;
    card.classList.add('dragging'); try { g.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
    function place() {
      var dy = lastY - y0 + (window.scrollY - sy0); card.style.transform = 'translateY(' + dy + 'px)';
      var mid = rects[idx].top + rects[idx].h / 2 + dy, t = idx;
      rects.forEach(function (r, k) { if (k !== idx && ((k < idx && mid < r.top + r.h / 2) || (k > idx && mid > r.top + r.h / 2))) { if ((k < idx && k < t) || (k > idx && k > t) || t === idx) t = k; } });
      target = t;
      cards.forEach(function (c, k) { if (k === idx) return; var sh = 0; if (idx < target && k > idx && k <= target) sh = -rects[idx].h - 16; if (idx > target && k < idx && k >= target) sh = rects[idx].h + 16; c.style.transform = sh ? 'translateY(' + sh + 'px)' : ''; c.style.transition = 'transform .15s'; });
    }
    function move(ev) { lastY = ev.clientY; place(); auto = ev.clientY < 90 ? -14 : ev.clientY > window.innerHeight - 90 ? 14 : 0; }
    var tick = setInterval(function () { if (auto) { window.scrollBy(0, auto); place(); } }, 16);
    function up() {
      clearInterval(tick); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
      cards.forEach(function (c) { c.style.transform = ''; c.style.transition = ''; c.classList.remove('dragging'); });
      if (target !== idx) mutate(function (s) { var it = s.items.splice(idx, 1)[0]; s.items.splice(target, 0, it); s.legPick = {}; });
    }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && modalRoot.firstChild) closeModal(); });
  document.addEventListener('keydown', function (e) {
    var k = (e.key || '').toLowerCase(); if (!(e.metaKey || e.ctrlKey) || (k !== 'z' && k !== 'y') || app.view !== 'build') return;
    var tg = e.target; if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA' || tg.tagName === 'SELECT' || tg.isContentEditable)) return;   // typing keeps its own undo
    e.preventDefault(); if (k === 'y' || e.shiftKey) app.redo(); else app.undo();
  });

  app.util = { addStop: function (id) { addStop(id); }, ics: downloadICS, contactPick: contactPick, readContact: readContact, esc: esc, $: $, $$: $$, money: money, photo: photo, toast: toast, copy: copy, openModal: openModal, closeModal: closeModal, store: store, track: track, shareLink: shareLink, baseUrl: baseUrl, go: go, plural: plural, hours: hours, footer: footer, persist: persist, refresh: refreshBuilder, getPlan: function () { return plan; } };
  var navAllIn = $('#nav-allin'); if (navAllIn && MM.allInBase) navAllIn.href = MM.allInBase();   // the ALL IN site, wherever this copy lives
  window.addEventListener('hashchange', route);

  /* ---------- boot ---------- */
  (function boot() {
    var q = new URLSearchParams(location.search); app.meta.ref = (q.get('ref') || q.get('r') || '').slice(0, 40); app.meta.from = P[q.get('from')] ? q.get('from') : '';
    app.nmOff = store('mm-nmoff') || {};
    var pp2 = store('mm-passport'); if (pp2) app.passport = pp2;
    var sc = store('mm-cur'); if (sc && MM.CURRENCIES[sc]) app.cur = sc;
    var csel = $('#cursel'); if (csel) { csel.value = app.cur; csel.addEventListener('change', function () { app.cur = csel.value; store('mm-cur', app.cur); track('currency', { c: app.cur }); if (app.view === 'build') refreshBuilder(); else route(); }); }
    var qa = store('mm-quiz'); if (qa) { app.quiz.a = Object.assign({ days: 14, vibes: [], must: [] }, qa); }
    if (app.meta.from && !location.hash) { app.state = MM.defaultState(); location.hash = '#/build'; return; }
    window.addEventListener('DOMContentLoaded', function () { route(); }); if (document.readyState !== 'loading') setTimeout(route, 0);
  })();
})();
