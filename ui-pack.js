/* ============================================================
   TRIP PACK + LAUNCH WAITLIST + MAD MONKEY APP LINK
   • #/pack/<trip>   a designed, printable itinerary: the route, where to sleep, how to get there,
                     day by day, local knowledge, visa + festival notes and a packing list.
                     "Print or save as PDF" in the browser. Marked DRAFT until the crew has checked it.
   • Waitlist        "Tell me when it launches" for ALL IN trips that aren't live yet.
   • App card        links to the Mad Monkey app when MM_CONFIG.APP_URL is set.
   ============================================================ */
(function () {
  var A = window.MMApp, MM = window.MM, C = window.MM_CONFIG || {}, u = A.util, esc = u.esc, $ = u.$, P = MM.PLACES, money = u.money, plural = u.plural, U = MM.util;
  var fmtD = U.fmtDate;
  function mapsLink(id) { return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('Mad Monkey Hostel ' + P[id].n); }
  function hostelInfo(id) { return (MM.LIVE && MM.LIVE.hostels && MM.LIVE.hostels[id]) || {}; }
  function packRec(enc) {
    var subs = u.store('mm-subs') || [];
    return subs.filter(function (s) { return s.link && s.link.indexOf(enc) > -1; })[0] || null;
  }

  /* ---------- app link card ---------- */
  A.appCard = function () {
    if (!C.APP_URL) return '';
    return '<div class="appcard"><div><span class="over">Take it with you</span><b>Get the Mad Monkey app</b><p>Your bookings, your crew and the hostel info, all in your pocket.</p></div><a class="btn btn--sm btn--pink" href="' + esc(C.APP_URL) + '" target="_blank" rel="noopener">Get the app</a></div>';
  };

  /* ---------- the pack ---------- */
  A.views.pack = function (enc) {
    try { enc = decodeURIComponent(enc || ''); } catch (e) { enc = enc || ''; } var root = document.getElementById('app'), st = MM.decodeState(enc);
    if (!st.items.length) { root.innerHTML = '<section class="quiz"><div class="wrap"><div class="qbox"><span class="over">Trip pack</span><h1 class="disp">Nothing to pack yet.</h1><p class="qhelp">Build a trip first, then come back for your pack.</p><div class="qnav"><button class="btn" data-go="build" type="button">Open the builder</button></div></div></div></section>'; return; }
    var pl = MM.plan(st), rec = packRec(enc), checked = rec && (rec.status === 'ready' || rec.status === 'approved'), T = pl.totals, pass = A.passport || '';
    var first = pl.places[0], last = pl.places[pl.places.length - 1];
    var contact = [C.WHATSAPP ? 'WhatsApp +' + C.WHATSAPP.replace(/^\+/, '') : '', C.CREW_EMAIL || ''].filter(Boolean).join('  ·  ');
    var h = '<div class="packbar"><div class="wrap packbar__in"><a class="btn btn--sm btn--paper" href="#/build/' + esc(enc) + '">Back to my trip</a><button class="btn btn--sm btn--pink" id="packprint" type="button">Print or save as PDF</button><button class="btn btn--sm btn--paper" id="packcal" type="button">Add to calendar</button></div></div>';
    h += '<article class="pack"><header class="pack__cover"><div class="pack__logo"><img src="assets/logo/mad-monkey-black.png" alt="Mad Monkey" width="120" height="36"></div>' +
      '<span class="pack__stamp pack__stamp--' + (checked ? 'ok' : 'draft') + '">' + (checked ? 'Checked by the crew' : 'Draft: not checked yet') + '</span>' +
      '<p class="pack__over">Your trip pack</p><h1 class="disp">' + esc(MM.routeLine(pl)) + '</h1>' +
      '<div class="pack__facts"><div><b>' + T.days + '</b><span>days</span></div><div><b>' + T.nights + '</b><span>nights</span></div><div><b>' + pl.places.length + '</b><span>stops</span></div><div><b>' + pl.countries.length + '</b><span>' + (pl.countries.length === 1 ? 'country' : 'countries') + '</span></div><div><b>~' + money(T.total, A.cur) + '</b><span>est. each</span></div></div>' +
      (st.start ? '<p class="pack__dates">' + fmtD(U.parseDate(st.start)) + ' to ' + fmtD(U.addDays(U.parseDate(st.start), T.days - 1)) + ', ' + U.parseDate(st.start).getUTCFullYear() + '</p>' : '<p class="pack__dates">Dates not set yet. Add a start date in the builder and your pack fills in.</p>') +
      (rec ? '<p class="pack__ref">Reference <b>' + esc(rec.ref) + '</b></p>' : '') +
      (checked ? '' : '<p class="pack__note">This is a draft of your trip, not a booking. Hold your beds' + (C.DEPOSIT_PER_PERSON > 0 ? ' with a $' + C.DEPOSIT_PER_PERSON + ' deposit per person' : ' (sending it is free)') + ' and a real crew member checks the routes, dates and prices before you pay' + (C.DEPOSIT_PER_PERSON > 0 ? ' the rest' : '') + '.</p>') + '</header>';

    // 1. where you sleep
    h += '<section class="pack__sec"><h2 class="disp">Where you\'re sleeping</h2><div class="pack__stays">' + pl.segs.map(function (sg, i) {
      if (sg.kind === 'allin') return '<div class="stay"><span class="stay__n">' + (i + 1) + '</span><div><b>ALL IN ' + esc(sg.trip.n) + '</b><p>' + sg.trip.days + ' days, beds and activities included. Your crew leader sends the meeting point.</p></div></div>';
      var hi = hostelInfo(sg.p), d0 = pl.days.filter(function (d) { return d.si === i && d.loc === sg.p; })[0], dl = pl.days.filter(function (d) { return d.si === i && d.loc === sg.p; }).slice(-1)[0];
      var when = d0 && d0.date ? fmtD(d0.date) + ' to ' + fmtD(U.addDays(dl.date, 1)) : plural(sg.n, 'night');
      return '<div class="stay"><span class="stay__n">' + (i + 1) + '</span><div><b>Mad Monkey ' + esc(P[sg.p].n) + '</b><p>' + esc(MM.COUNTRIES[P[sg.p].c].n) + ' · ' + esc(when) + ' · ' + plural(sg.n, 'night') + '</p>' +
        '<p class="stay__d">' + (hi.addr ? esc(hi.addr) : 'Address on your booking confirmation') + (hi.checkin ? ' · Check-in ' + esc(hi.checkin) : '') + (hi.phone ? ' · ' + esc(hi.phone) : '') + '</p>' +
        (hi.directions ? '<p class="stay__d">' + esc(hi.directions) + '</p>' : '') + '<p class="stay__d"><a href="' + esc(mapsLink(sg.p)) + '">' + esc(mapsLink(sg.p)) + '</a></p></div></div>';
    }).join('') + '</div></section>';

    // 2. getting around
    h += '<section class="pack__sec"><h2 class="disp">Getting there</h2>';
    if (first && P[first].ap && P[first].ap.length) h += '<p class="pack__p"><b>Arriving in ' + esc(P[first].n) + ':</b> the closest airport hub' + (P[first].ap.length > 1 ? 's are ' : ' is ') + P[first].ap.map(function (a) { return a[0] + ' (about ' + U.hoursLabel(a[1]) + ' by transfer, around ' + money(a[2], A.cur) + ')'; }).join(', ') + '.</p>';
    h += '<ol class="legs">' + pl.legs.map(function (l) {
      var c = l.chosen, steps = c.route.steps.filter(function (s) { return s.e.m !== 'taxi'; }).map(function (s) { return s.e.note; }).join('. ');
      var dd = pl.days.filter(function (d) { return d.travel === l && d.date; })[0];
      return '<li><b>' + esc(P[l.from].n) + ' to ' + esc(P[l.to].n) + '</b>' + (dd ? ' <span class="legs__d">' + fmtD(dd.date) + '</span>' : '') + '<p>' + esc(c.modeLabel) + ' · ' + U.hoursLabel(c.h) + ' · about ' + money(c.u, A.cur) + (c.fare ? ' (lowest fare found for your date)' : '') + (c.arrive ? ' · arrives about ' + c.arrive + (c.arriveNext ? ' next day' : '') : '') + '</p><p class="legs__s">' + esc(steps) + '</p>' + (l.border ? '<p class="legs__w">' + esc(l.border) + '</p>' : '') + '</li>';
    }).join('') + '</ol>' + (pl.legs.length ? '' : '<p class="pack__p">One stop, so no transport between hostels.</p>');
    if (last && P[last].ap && P[last].ap.length) h += '<p class="pack__p"><b>Leaving from ' + esc(P[last].n) + ':</b> ' + P[last].ap.map(function (a) { return a[0] + ' (about ' + U.hoursLabel(a[1]) + ' by transfer)'; }).join(', ') + '. Leave plenty of time, and ask the crew about an airport transfer.</p>';
    h += '</section>';

    // 3. day by day
    h += '<section class="pack__sec"><h2 class="disp">Day by day</h2><ol class="days">' + pl.days.map(function (d) {
      var acts = (d.acts || []).map(function (x) { var a = MM.ACTS[x.id]; return a ? esc(a.n) + ' <i>(' + x.part + ')</i>' : ''; }).filter(Boolean).join(' · '), tr = d.travel && (d.kind === 'stay' || d.kind === 'move') ? 'Travel: ' + esc(P[d.travel.from].n) + ' to ' + esc(P[d.travel.to].n) + ', ' + esc(d.travel.chosen.modeLabel.toLowerCase()) + ', ' + U.hoursLabel(d.travel.h) : '';
      return '<li><span class="days__n">' + d.n + '</span><div><b>' + (d.date ? fmtD(d.date) + ' · ' : '') + esc(d.title || (d.loc ? P[d.loc].n : '')) + '</b>' + (tr ? '<p>' + tr + '</p>' : '') + (acts ? '<p>' + acts + '</p>' : '') + (d.note ? '<p class="days__note">' + esc(d.note) + '</p>' : '') + (d.notes && d.notes.length ? '<p class="days__note">' + d.notes.map(esc).join(' · ') + '</p>' : '') + '</div></li>';
    }).join('') + '</ol></section>';

    // 4. entry + festivals
    var visa = MM.visaCheck(pl, pass), ev = MM.eventsFor(pl);
    h += '<section class="pack__sec"><h2 class="disp">Before you fly</h2>' + pl.countries.map(function (c) {
      var e = MM.ENTRY[c], v = visa.filter(function (x) { return x.c === c; });
      return '<div class="pack__c"><b>' + esc(MM.COUNTRIES[c].n) + '</b><p>' + esc(pass ? e.by[pass] : 'Check how long your passport allows.') + ' ' + esc(e.extra) + '</p>' + (v.length && v[0].msg && pass ? '<p class="pack__v pack__v--' + v[0].status + '">' + esc(v[0].msg) + '</p>' : '') + '<p class="stay__d"><a href="' + esc(e.link) + '">' + esc(e.link) + '</a></p></div>';
    }).join('') + '<p class="fine">Entry rules checked ' + esc(MM.ENTRY_CHECKED) + '. They change, so confirm on the official site before you fly.</p>' +
      (ev.length ? '<h3 class="pack__h3">Festivals and closures on your dates</h3>' + ev.filter(function (e) { return e.ev.id !== 'fullmoon'; }).map(function (e) { return '<p class="pack__p"><b>' + esc(e.ev.n) + '</b> (' + esc(e.core || (fmtD(e.from) + ' to ' + fmtD(e.to))) + '). ' + esc(e.ev.advice) + '</p>'; }).join('') : '') + '</section>';

    // 5. local knowledge
    h += '<section class="pack__sec"><h2 class="disp">Know before you go</h2>' + MM.GUIDE.forCountries(pl.countries).map(function (c) {
      var g = MM.GUIDE.countries[c];
      return '<div class="pack__c"><b>' + esc(MM.COUNTRIES[c].n) + '</b><ul>' + ['money', 'online', 'safe', 'manners', 'health'].map(function (k) { return '<li><i>' + esc(MM.GUIDE.topics.filter(function (t) { return t.k === k; })[0].t) + ':</i> ' + esc(g[k][0]) + (g[k][1] ? ' ' + esc(g[k][1]) : '') + '</li>'; }).join('') + '</ul></div>';
    }).join('') + (MM.GUIDE.hasRiding(pl) ? '<div class="pack__ride"><b>' + esc(MM.GUIDE.scooterHead) + '</b><ul>' + MM.GUIDE.scooterCore.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></div>' : '') +
      '<h3 class="pack__h3">At each stop</h3>' + pl.places.filter(function (p) { return MM.GUIDE.places[p]; }).map(function (p) { return '<p class="pack__p"><b>' + esc(P[p].n) + ':</b> ' + MM.GUIDE.places[p].map(esc).join(' ') + '</p>'; }).join('') + '</section>';

    // 6. packing + costs
    h += '<section class="pack__sec"><h2 class="disp">Packing list</h2><div class="pack__pk">' + MM.packing(pl).map(function (g) { return '<div><b>' + esc(g.g) + '</b><ul class="chk">' + g.items.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul></div>'; }).join('') + '</div></section>';
    h += '<section class="pack__sec"><h2 class="disp">What it adds up to</h2><table class="pack__t"><tbody><tr><td>Beds</td><td>' + money(T.beds, A.cur) + '</td></tr><tr><td>Transport</td><td>' + money(T.transport, A.cur) + '</td></tr><tr><td>Activities</td><td>' + money(T.acts, A.cur) + '</td></tr>' + (T.allin ? '<tr><td>ALL IN trips</td><td>' + money(T.allin, A.cur) + '</td></tr>' : '') + '<tr><td>Food + fun fund</td><td>' + money(T.fund, A.cur) + '</td></tr>' + (T.squad ? '<tr><td>Squad Leader</td><td>-' + money(-T.squad, A.cur) + '</td></tr>' : '') + '<tr class="tot"><td>Estimated total, per person</td><td>~' + money(T.total, A.cur) + '</td></tr></tbody></table><p class="fine">Estimates, not quotes. Flights to and from the region aren\'t included.</p></section>';
    h += '<footer class="pack__ft"><b>Questions? The crew is a message away.</b><p>' + (contact ? esc(contact) : 'Reply to your confirmation message and a real person answers.') + '</p>' + A.appCard() + '</footer></article>';
    root.innerHTML = h;
    $('#packprint').addEventListener('click', function () { u.track('pack_print'); window.print(); });
    $('#packcal').addEventListener('click', function () { if (u.ics) u.ics(pl, st); });
  };

  /* ---------- launch waitlist ---------- */
  function waitlist(id) {
    var t = MM.ALL_IN.filter(function (x) { return x.id === id; })[0]; if (!t) return;
    var q = u.store('mm-lead') || {};
    u.openModal('<div class="modal__hd"><div><div class="over">Launching soon</div><h2 class="disp">Be first on<br>ALL IN ' + esc(t.n) + '.</h2></div><button class="modal__x" data-act="close" aria-label="Close" type="button">×</button></div><div class="modal__bd">' +
      '<p style="font-weight:500">We\'ll message you the day it opens, before it\'s announced. No spam, one message.</p>' +
      '<form id="wlf" novalidate><div class="form2"><div class="field"><label for="wl-name">First name</label><input class="input" id="wl-name" name="name" autocomplete="given-name" required value="' + esc(q.name || '') + '"></div>' +
      u.contactPick(q) +
      '<div class="full" style="display:none"><label>Leave empty <input name="website" tabindex="-1" autocomplete="off"></label></div>' +
      '<label class="chk full"><input type="checkbox" name="consent" required><span>It\'s OK for Mad Monkey to message me once about this trip launching.' + (C.PRIVACY_URL ? ' <a href="' + esc(C.PRIVACY_URL) + '" target="_blank" rel="noopener">Privacy</a>' : '') + '</span></label></div>' +
      '<div id="wlerr" class="warn" style="display:none;margin-top:var(--s-3)"><i>!</i><span></span></div>' +
      '<div style="display:flex;gap:var(--s-2);margin-top:var(--s-4);flex-wrap:wrap"><button class="btn btn--pink" type="submit">Tell me first</button><button class="btn btn--ghost" data-act="close" type="button">Not now</button></div></form></div>', function (m) {
        $('#wlf', m).addEventListener('submit', function (e) {
          e.preventDefault(); var f = e.target, v = {}; new FormData(f).forEach(function (val, k) { v[k] = typeof val === 'string' ? val.trim() : val; });
          var err = $('#wlerr', m), show = function (msg) { err.style.display = 'grid'; $('span', err).textContent = msg; };
          if (v.website) return; if (!v.name) return show('Pop your first name in.');
          var ct = u.readContact(v); if (ct.err) return show(ct.err); if (!v.consent) return show('Tick the box so we\'re allowed to message you.');
          u.store('mm-lead', Object.assign(u.store('mm-lead') || {}, { name: v.name, via: ct.via, email: v.email, whatsapp: v.whatsapp }));
          var btn = $('button[type=submit]', f); btn.disabled = true; btn.textContent = 'Saving…';
          var done = function (demo) {
            u.track('waitlist', { trip: id, via: ct.via });
            $('.modal__bd', m).innerHTML = '<div class="refbox"><span class="over">You\'re on the list</span><b>ALL IN ' + esc(t.n) + '</b></div><p style="font-weight:500;margin-top:var(--s-3)">We\'ll message you on ' + (ct.via === 'email' ? 'email' : 'WhatsApp') + ' the moment it opens.</p>' + (demo ? '<div class="demo">DEMO MODE: nothing was saved. Set <code>WAITLIST_ENDPOINT</code> in config.js and this goes to the crew.</div>' : '') + '<div style="margin-top:var(--s-4)"><button class="btn" data-act="close" type="button">Done</button></div>';
          };
          if (!C.WAITLIST_ENDPOINT) return setTimeout(function () { done(true); }, 350);
          fetch(C.WAITLIST_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trip: id, source: 'builder', contact: { name: v.name, via: ct.via, email: ct.email, whatsapp: ct.whatsapp, consent: true } }) })
            .then(function (r) { if (!r.ok) throw new Error(r.status); done(false); })
            .catch(function () { btn.disabled = false; btn.textContent = 'Tell me first'; show('That didn\'t go through. Try again in a moment.'); });
        });
      });
  }
  A.waitlist = waitlist;

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act="waitlist"]'); if (b) { e.preventDefault(); waitlist(b.getAttribute('data-id')); }
    var p = e.target.closest('[data-act="openpack"]'); if (p) { e.preventDefault(); u.go('pack', MM.encodeState(A.state)); }
  });
})();
