/* ============================================================
   WHERE NEXT?   a step in hostel check-in, and the crew's list of who to message
     #/wherenext/h=<hostel>&out=<YYYY-MM-DD>&b=<booking ref>&n=<first name>&back=<check-in URL>
       The guest sees our ALL IN trips, the most likely first, each with its first departure after they check out, and ticks
       the ones they'd like details on. "Next" (or "Not interested") saves the answer and sends them back to finish checking
       in. A tick is their OK to be messaged about that trip, and only that one. Nothing is booked.
     #/wherenext-crew
       For the crew: everyone who ticked a trip, by check-out date, with the next departure of each and the message written.
   Needs WHERENEXT_ENDPOINT (answers) and CREW_ENDPOINT (the list, admin password). Without them it's a demo: answers stay on
   this device and the list shows sample guests. The trips, order and message come from MM.whereNext / MM.whereNextMsg (logic.js).
   docs/WHERE-NEXT.md
   ============================================================ */
(function () {
  var A = window.MMApp, MM = window.MM, C = window.MM_CONFIG || {}, u = A.util, esc = u.esc, $ = u.$, U = MM.util;
  var LOCAL = 'mm-wherenext', STATUS_KEY = 'mm-wherenext-status', WHOKEY = 'mm-who';
  var CONSENT = 'We\'ll message you about the trips you tick, and only those. Nothing is booked, and flights are never included.';
  var ST = { new: 'Not messaged yet', messaged: 'Messaged', booked: 'Booked', no: 'Not now' };

  function num(v) { var n = Math.round(+v); return isFinite(n) ? n : 0; }
  function plainText(s, n) { return String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f<>"]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n); }
  function day(iso) { var d = U.parseDate(iso); return d ? U.fmtDate(d) : ''; }
  function addDays(n) { var d = new Date(); return U.isoDate(new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate() + n))); }
  function hostelName(id) { return MM.PLACES[id] ? MM.PLACES[id].n : ''; }
  function store(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || 'null'); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } return v; }
  // "back" may only lead to the check-in system named in config, so the page can't send a guest to a stranger's site.
  function backUrl(v) {
    var ok = String(C.WHERENEXT_RETURN || '').split(',').map(function (h) { return h.trim().toLowerCase(); }).filter(Boolean), m = /^https:\/\/([^\/?#:]+)[\/?#]?/i.exec(String(v || ''));
    return m && ok.indexOf(m[1].toLowerCase()) > -1 && u.url(v) ? v : '';
  }
  function parse(rest) {
    var q = {}; String(u.dec(rest || '')).replace(/^\?/, '').split('&').forEach(function (kv) { var i = kv.indexOf('='); if (i > 0) q[kv.slice(0, i)] = kv.slice(i + 1); });
    var h = MM.PLACES[q.h] && !MM.PLACES[q.h].partner ? q.h : '';
    return { h: h, out: /^\d{4}-\d{2}-\d{2}$/.test(q.out || '') && U.parseDate(q.out) ? q.out : '', b: /^[A-Za-z0-9-]{1,40}$/.test(q.b || '') ? q.b : '', n: plainText(q.n, 30), back: backUrl(q.back) };
  }
  var hostels = function () { return Object.keys(MM.PLACES).filter(function (id) { return !MM.PLACES[id].partner; }).sort(function (a, b) { return hostelName(a) < hostelName(b) ? -1 : 1; }); };

  /* ---------- the guest's page ---------- */
  A.views.wherenext = function (rest) {
    var root = document.getElementById('app'), q = parse(rest), demo = !q.h;
    A._wnDone = null;
    if (demo) { q.h = 'hanoi'; q.out = addDays(3); q.n = 'Sam'; }
    paint(root, q, demo, {});
  };
  function photo(t) { var src = (t.img && (MM.tourImg(t.img[0]) || MM.hostelImg(t.img[1]))) || ''; return src ? u.photo(src, 'wnt__img', 's') : '<div class="photo photo--none wnt__img"></div>'; }
  function tripRow(t, on) {
    return '<label class="wnt wnt--' + esc(t.col) + (on ? ' wnt--on' : '') + '"><input class="sr" type="checkbox" name="wn" value="' + esc(t.id) + '"' + (on ? ' checked' : '') + '>' +
      '<span class="wnt__pic">' + photo(t) + '<span class="wnt__days"><b>' + num(t.days) + '</b>days</span></span>' +
      '<span class="wnt__b"><span class="wnt__tag">' + esc(t.kicker) + '</span><span class="wnt__n">' + esc(t.n.replace(/^ALL IN /, '')) + '</span><span class="wnt__r">' + esc(t.route) + '</span>' +
      '<span class="wnt__next">Next: <b>' + esc(t.depLabel) + '</b> · ' + esc(t.when) + '</span></span>' +
      '<span class="wnt__p"><i>from</i><b>$' + num(t.usd) + '</b></span><span class="wnt__tick" aria-hidden="true"></span></label>';
  }
  function paint(root, q, demo, picked) {
    var trips = MM.whereNext(q.h, q.out), at = hostelName(q.h);
    root.innerHTML = '<section class="wn">' +
      '<div class="wn__strip" aria-hidden="true"><span>Where next? · Vietnam · Laos · Cambodia · Indonesia · Gili T · Your crew · Your route · Zero planning · Where next? · Vietnam · Laos · Cambodia · Indonesia · Gili T</span></div>' +
      (demo ? demoBar(q) : '') +
      '<div class="wn__wrap"><div class="wn__brand"><span class="wn__logo">ALL<br>IN</span><span class="wn__at">Mad Monkey ' + esc(at) + '<br>Check-in</span></div>' +
      '<p class="wn__over">One last thing</p><h1 class="wn__h">Where next?<em>Your next crew is waiting.</em></h1>' +
      '<p class="wn__lead">' + (q.n ? 'Hey ' + esc(q.n) + ', you' : 'You') + (q.out ? ' check out <b>' + esc(day(q.out)) + '</b>.' : '\'re all checked in.') + ' Tick any trips you\'d like details on, and the crew will send you the dates.</p>' +
      '<fieldset class="wn__list"><legend class="sr">ALL IN trips you could do next</legend>' + trips.map(function (t) { return tripRow(t, !!picked[t.id]); }).join('') +
      '<label class="wnt wnt--own' + (picked.builder ? ' wnt--on' : '') + '"><input class="sr" type="checkbox" name="wn" value="builder"' + (picked.builder ? ' checked' : '') + '><span class="wnt__b"><span class="wnt__tag">Somewhere else?</span><span class="wnt__n">Plan my own</span>' +
      '<span class="wnt__r">Build your next leg in 2 minutes, and a real person checks it.</span></span><span class="wnt__tick" aria-hidden="true"></span></label></fieldset>' +
      '<p class="wn__fine">' + esc(CONSENT) + '</p></div>' +
      '<div class="wn__bar"><p class="wn__err" id="wnerr" role="alert" hidden></p><div class="wn__btns"><button class="btn wn__no" id="wnno" type="button">Not interested</button><button class="btn wn__go" id="wngo" type="button">Next</button></div></div>' +
      '</section>';
    var go = $('#wngo', root), err = $('#wnerr', root);
    function ticked() { return Array.prototype.map.call(root.querySelectorAll('input[name="wn"]:checked'), function (i) { return i.value; }); }
    function count() { var n = ticked().length; go.textContent = n ? 'Next (' + n + ')' : 'Next'; err.hidden = true; }
    Array.prototype.forEach.call(root.querySelectorAll('input[name="wn"]'), function (i) {
      i.addEventListener('change', function () { i.closest('.wnt').classList.toggle('wnt--on', i.checked); count(); });
    });
    go.addEventListener('click', function () {
      var t = ticked(); if (!t.length) { err.textContent = 'Tick a trip, or press Not interested.'; err.hidden = false; return; }
      send(root, q, demo, t);
    });
    $('#wnno', root).addEventListener('click', function () { send(root, q, demo, []); });
    if (demo) wireDemo(root, q, picked);
    count();
  }
  function demoBar(q) {
    return '<div class="wn__demo"><span class="pill pill--lime pill--sm">Demo</span><label>Hostel <select class="select" id="wnh">' + hostels().map(function (id) { return '<option value="' + esc(id) + '"' + (id === q.h ? ' selected' : '') + '>' + esc(hostelName(id)) + '</option>'; }).join('') + '</select></label>' +
      '<label>Checks out <input class="input" id="wnout" type="date" value="' + esc(q.out) + '"></label><a href="#/wherenext-crew">The crew\'s list</a></div>';
  }
  function wireDemo(root, q, picked) {
    var redo = function () { var h = $('#wnh', root).value, o = $('#wnout', root).value; if (MM.PLACES[h]) q.h = h; if (/^\d{4}-\d{2}-\d{2}$/.test(o)) q.out = o; paint(root, q, true, picked); };
    $('#wnh', root).addEventListener('change', redo); $('#wnout', root).addEventListener('change', redo);
  }
  function send(root, q, demo, trips) {
    var body = { hostel: q.h, booking: q.b, checkout: q.out, name: q.n, trips: trips, consent: trips.length ? CONSENT : '', at: new Date().toISOString() };
    var btns = root.querySelectorAll('.wn__btns .btn'); Array.prototype.forEach.call(btns, function (b) { b.disabled = true; });
    var done = function () { thanks(root, q, trips); };
    if (!C.WHERENEXT_ENDPOINT) {
      var all = store(LOCAL) || []; all.unshift(body); store(LOCAL, all.slice(0, 50)); u.track('wherenext', { n: trips.length });
      return done();
    }
    u.timed(C.WHERENEXT_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, 15000)
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); u.track('wherenext', { n: trips.length }); done(); })
      .catch(function () { done(); });          // never hold up a check-in: the worst case is one missed answer
  }
  function thanks(root, q, trips) {
    var names = MM.whereNext(q.h, q.out).filter(function (t) { return trips.indexOf(t.id) > -1; }).map(function (t) { return t.n; });
    if (trips.indexOf('builder') > -1) names.push('planning your own next leg');
    var list = names.length < 2 ? names.join('') : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
    root.innerHTML = '<section class="wn wn--done"><div class="wn__wrap"><div class="wn__brand"><span class="wn__logo">ALL<br>IN</span><span class="wn__at">Mad Monkey ' + esc(hostelName(q.h)) + '<br>Check-in</span></div>' +
      '<h1 class="wn__h">' + (trips.length ? 'Sorted.<em>We\'ll be in touch.</em>' : 'No worries.<em>Enjoy ' + esc(hostelName(q.h)) + '.</em>') + '</h1>' +
      '<p class="wn__lead">' + (trips.length ? 'The crew will message you about ' + esc(list) + ' before you check out. Nothing is booked.' : 'If you change your mind, ask at reception about our ALL IN trips.') + '</p>' +
      (q.back ? '<p><a class="btn btn--lg wn__go" href="' + esc(q.back) + '">Back to check-in</a></p>' : '<p class="wn__fine">You can carry on with your check-in.</p>') +
      (C.WHERENEXT_ENDPOINT ? '' : '<p class="wn__fine">Demo: your answer is saved on this device only. <a href="#/wherenext-crew">See the crew\'s list</a> · <a href="#/wherenext">Try it again</a></p>') + '</div></section>';
    window.scrollTo(0, 0);
    // back to check-in by itself after a moment, but only from this thank-you screen (not one shown later, or another page)
    var tok = A._wnDone = {}; if (q.back) setTimeout(function () { if (A._wnDone === tok && A.view === 'wherenext') location.href = q.back; }, 3000);
  }

  /* ---------- the crew's list ---------- */
  // Demo guests: made-up names, example.com addresses and UK drama-range numbers, so a message button never reaches a real person.
  function samples() {
    var g = function (id, name, hostel, out, via, trips) { return { id: id, name: name, hostel: hostel, checkout: addDays(out), via: via, email: via === 'email' ? name.split(' ')[0].toLowerCase() + '@example.com' : '', whatsapp: via === 'whatsapp' ? '+44 7700 900' + (100 + id.length * 7 + out) : '', trips: trips, sample: true, at: new Date().toISOString() }; };
    return [g('s1', 'Sam Lee', 'hanoi', 2, 'whatsapp', ['laos', 'loop']), g('s2', 'Priya Shah', 'hanoi', 1, 'email', ['vietnam']), g('s3', 'Jonas Berg', 'hoi-an', 3, 'whatsapp', ['cambodia']),
      g('s4', 'Mia Clarke', 'phnom-penh', 2, 'email', ['cambodia', 'gili-lombok']), g('s5', 'Leo Martin', 'uluwatu', 4, 'whatsapp', ['gili-lombok']), g('s6', 'Ana Souza', 'luang-prabang', 1, 'email', ['laos']),
      g('s7', 'Tom Price', 'bangkok', 5, 'whatsapp', ['builder']), g('s8', 'Zoe Kim', 'siem-reap', 3, 'email', []), g('s9', 'Finn Walsh', 'hanoi', 2, 'whatsapp', [])];
  }
  // What the list shows, from whichever source: plain values only, and only trips we know about.
  function clean(list) {
    var known = MM.ALL_IN.map(function (t) { return t.id; }).concat(['builder']);
    return (Array.isArray(list) ? list : []).map(function (x, i) {
      x = x || {};
      return { id: String(x.id || x.booking || ('local-' + i)).slice(0, 60), name: plainText(x.name, 40) || 'Guest', hostel: MM.PLACES[x.hostel] ? x.hostel : '', checkout: /^\d{4}-\d{2}-\d{2}$/.test(x.checkout || '') ? x.checkout : '',
        via: x.via === 'whatsapp' ? 'whatsapp' : 'email', email: plainText(x.email, 120), whatsapp: plainText(x.whatsapp, 30), booking: plainText(x.booking, 40),
        trips: (Array.isArray(x.trips) ? x.trips : []).filter(function (t, k, a) { return known.indexOf(t) > -1 && a.indexOf(t) === k; }), status: ST[x.status] ? x.status : 'new', sample: !!x.sample, at: x.at || '' };
    }).filter(function (x) { return x.hostel; });
  }
  A.views['wherenext-crew'] = function () {
    var root = document.getElementById('app'), live = !!(C.WHERENEXT_ENDPOINT && A.crewApi && A.crewApi.endpoint());
    if (!live) {
      var st = store(STATUS_KEY) || {}, mine = (store(LOCAL) || []).map(function (x, i) { var o = {}; for (var k in x) o[k] = x[k]; o.id = 'local-' + i; o.name = x.name || 'You (this device)'; return o; });
      var rows = clean(mine.concat(samples())).map(function (r) { r.status = ST[st[r.id]] ? st[r.id] : r.status; return r; });
      return list(root, rows, true, '');
    }
    if (!A.crewApi.pw()) return login(root, '');
    load(root, '');
  };
  function login(root, err) {
    root.innerHTML = '<section class="quiz crew"><div class="wrap"><div class="qbox"><span class="over">For the crew</span><h1 class="disp">Where next?</h1><p class="qhelp">Who ticked an ALL IN trip at check-in. Enter the admin password (the same as Admin &gt; Trip builder).</p>' +
      '<form class="cfin" id="wnin"><label for="wnpw">Admin password</label><input class="input" id="wnpw" type="password" autocomplete="current-password" required>' + (err ? '<p class="cerr" role="alert">' + esc(err) + '</p>' : '') +
      '<button class="btn btn--lg" type="submit">Open the list</button></form></div></div></section>';
    $('#wnin', root).addEventListener('submit', function (e) { e.preventDefault(); var v = $('#wnpw', root).value.trim(); if (v) { A.crewApi.setPw(v); load(root, ''); } });
  }
  function load(root, msg) {
    A.crewApi.call({ action: 'wherenext-list', password: A.crewApi.pw() }).then(function (d) { list(root, clean(d.guests), false, msg); }).catch(function (e) {
      if (e.status === 401 || e.status === 403) { A.crewApi.setPw(''); return login(root, 'That password didn\'t work.'); }
      root.innerHTML = '<section class="quiz crew"><div class="wrap"><div class="qbox"><h1 class="disp">Couldn\'t open the list.</h1><p class="qhelp">' + esc(e.message) + '</p></div></div></section>';
    });
  }
  function list(root, rows, demo, msg, f) {
    f = f || { h: '', t: '' };
    var me = (function () { try { return localStorage.getItem(WHOKEY) || ''; } catch (e) { return ''; } })(), today = addDays(0);
    var keen = rows.filter(function (r) { return r.trips.length && (!r.checkout || r.checkout >= today); });
    var want = {}; keen.forEach(function (r) { r.trips.forEach(function (t) { want[t] = (want[t] || 0) + 1; }); });
    var top = Object.keys(want).filter(function (k) { return k !== 'builder'; }).sort(function (a, b) { return want[b] - want[a]; })[0];
    var tname = function (id) { var t = MM.tripById && MM.tripById(id); return id === 'builder' ? 'Plan my own' : t ? 'ALL IN ' + t.n : id; };
    var shown = keen.filter(function (r) { return (!f.h || r.hostel === f.h) && (!f.t || r.trips.indexOf(f.t) > -1); }).sort(function (a, b) { return a.checkout < b.checkout ? -1 : a.checkout > b.checkout ? 1 : 0; });
    var soon = keen.filter(function (r) { return r.checkout && r.checkout <= addDays(3); }).length, stat = function (n, k) { return '<div><span>' + esc(k) + '</span><b>' + esc(n) + '</b></div>'; };
    var hs = {}; keen.forEach(function (r) { hs[r.hostel] = 1; });
    var h = '<section class="quiz crew wnc"><div class="wrap"><div class="crew__top"><span class="over">For the crew</span><h1 class="disp">Where next?</h1>' +
      '<p class="crew__sub">Guests who ticked an ALL IN trip at check-in, leaving soonest first. Message them while they\'re still with us, before they book their next stop somewhere else.</p></div>' +
      (demo ? '<div class="cbanner">Demo: sample guests (made up), plus anything answered on <a href="#/wherenext">the check-in page</a> on this device. Nothing is sent from here.</div>' : '') +
      (msg ? '<div class="cbanner cbanner--ok" role="status">' + esc(msg) + '</div>' : '') +
      '<div class="cglance cfind__stats">' + stat(rows.length, 'Answered') + stat(rows.length ? Math.round(100 * keen.length / rows.length) + '%' : '0%', 'Ticked a trip') + stat(top ? tname(top).replace(/^ALL IN /, '') : '—', 'Most wanted') + stat(soon, 'Leaving in 3 days') + '</div>' +
      '<div class="wnc__tools"><label>Hostel <select class="select" id="wnch"><option value="">All hostels</option>' + Object.keys(hs).sort().map(function (id) { return '<option value="' + esc(id) + '"' + (f.h === id ? ' selected' : '') + '>' + esc(hostelName(id)) + '</option>'; }).join('') + '</select></label>' +
      '<label>Trip <select class="select" id="wnct"><option value="">Every trip</option>' + Object.keys(want).map(function (id) { return '<option value="' + esc(id) + '"' + (f.t === id ? ' selected' : '') + '>' + esc(tname(id)) + ' (' + want[id] + ')</option>'; }).join('') + '</select></label>' +
      '<div class="field cfind__me"><label for="wncwho">I\'m… (your name signs the messages)</label><input class="input" id="wncwho" maxlength="40" autocomplete="name" value="' + esc(me) + '"></div></div>' +
      (shown.length ? shown.map(function (r, i) {
        var picks = MM.whereNext(r.hostel, r.checkout).filter(function (t) { return r.trips.indexOf(t.id) > -1; }), text = MM.whereNextMsg(r, r.trips, me), first = r.name.split(' ')[0];
        var reach = MM.crewWords.reach({ via: r.via, email: r.email, whatsapp: r.whatsapp }, text), can = r.via === 'whatsapp' ? !!r.whatsapp : !!r.email;
        return '<article class="cbox wnc__g"><div class="cfpair__hd"><h3>' + esc(r.name) + '</h3><span class="cdim">Mad Monkey ' + esc(hostelName(r.hostel)) + (r.checkout ? ' · checks out ' + esc(day(r.checkout)) : '') + (r.booking ? ' · ' + esc(r.booking) : '') + '</span>' +
          (r.sample ? '<span class="cpill">Sample</span>' : '') + '<span class="cpill cpill--' + (r.status === 'booked' ? 'ok' : r.status === 'messaged' ? 'rdy' : r.status === 'no' ? 'off' : 'new') + '">' + esc(ST[r.status]) + '</span></div>' +
          '<ul class="wnc__trips">' + picks.map(function (t) { return '<li class="wnt--' + esc(t.col) + '"><b>' + esc(t.n) + '</b> · next ' + esc(t.depLabel) + ' (' + esc(t.when.replace(/\byou\b/g, 'they')) + ') · from $' + num(t.usd) + '</li>'; }).join('') +
          (r.trips.indexOf('builder') > -1 ? '<li class="wnt--own"><b>Plan my own</b> · send them the trip builder</li>' : '') + '</ul>' +
          '<div class="cfpair__acts">' + (can ? '<a class="btn btn--sm" target="_blank" rel="noopener" href="' + esc(reach) + '">' + (r.via === 'whatsapp' ? 'WhatsApp ' : 'Email ') + esc(first) + '</a>' : '<span class="cdim">No contact details yet: they come from the booking.</span>') +
          '<button class="btn btn--sm btn--paper" type="button" data-wcopy="' + i + '">Copy the message</button>' +
          '<select class="select" data-wst="' + i + '" aria-label="Where this guest is">' + Object.keys(ST).map(function (k) { return '<option value="' + k + '"' + (r.status === k ? ' selected' : '') + '>' + esc(ST[k]) + '</option>'; }).join('') + '</select>' +
          '<button class="btn btn--sm btn--paper" type="button" data-wsave="' + i + '">Save</button></div></article>';
      }).join('') : '<div class="cbox"><p>' + (keen.length ? 'Nobody matches those filters.' : 'Nobody has ticked a trip yet.') + '</p></div>') +
      '<p class="cdim">Guests who pressed Not interested are counted in "Answered" and not listed. Flights are never included: the message says so.</p></div></section>';
    root.innerHTML = h;
    var again = function (m) { list(root, rows, demo, m, f); };
    $('#wnch', root).addEventListener('change', function () { f.h = this.value; again(''); });
    $('#wnct', root).addEventListener('change', function () { f.t = this.value; again(''); });
    $('#wncwho', root).addEventListener('change', function () { try { localStorage.setItem(WHOKEY, this.value.trim()); } catch (e) { /* private mode */ } again(''); });
    Array.prototype.forEach.call(root.querySelectorAll('[data-wcopy]'), function (b) {
      b.addEventListener('click', function () { var r = shown[+b.getAttribute('data-wcopy')]; u.copy(MM.whereNextMsg(r, r.trips, me)); u.toast('Copied. Paste it into WhatsApp or an email.'); });
    });
    Array.prototype.forEach.call(root.querySelectorAll('[data-wsave]'), function (b) {
      b.addEventListener('click', function () {
        var i = b.getAttribute('data-wsave'), r = shown[+i], s = $('[data-wst="' + i + '"]', root).value;
        if (demo) { var st = store(STATUS_KEY) || {}; st[r.id] = s; store(STATUS_KEY, st); r.status = s; return again('Saved: ' + r.name + ' · ' + ST[s] + '.'); }
        b.disabled = true;
        A.crewApi.call({ action: 'wherenext-status', password: A.crewApi.pw(), id: r.id, status: s, by: me }).then(function () { load(root, 'Saved: ' + r.name + ' · ' + ST[s] + '.'); })
          .catch(function (e) { b.disabled = false; if (e.status === 401 || e.status === 403) { A.crewApi.setPw(''); login(root, 'That password didn\'t work.'); } else u.toast(e.message); });
      });
    });
  }
})();
