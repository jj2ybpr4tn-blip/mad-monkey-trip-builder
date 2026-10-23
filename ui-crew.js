/* ============================================================
   CREW REVIEW PAGE   #/crew/<ref>?k=<key>[&do=approve|decline|edit]

   Where the three buttons in the new-trip email land. It shows the trip exactly as the guest
   built it (stop by stop, tours, travel, money, heads-up) with the guest's details, and the
   three decisions:
     Approve       send the guest the final price + payment link for the balance
     Not approved  say no (with a reason), optionally refund the deposit
     Edit it       open the trip in the builder, change it, then "Save our version"
   The key in the link proves it came from the email. Opening the page only reads: nothing is
   sent, charged or refunded until a person presses the button in a panel.
   Needs MM_CONFIG.CREW_ENDPOINT (the trip-builder-admin function).
   ============================================================ */
(function () {
  var A = window.MMApp, MM = window.MM, C = window.MM_CONFIG || {}, u = A.util, esc = u.esc, $ = u.$, U = MM.util;
  var SKEY = 'mm-crew';
  var STATUS = { pending_payment: ['Unpaid', 'off'], submitted: ['New', 'new'], checking: ['Checking', 'chk'], ready: ['Balance link sent', 'rdy'], approved: ['Booked', 'ok'], declined: ['Declined', 'off'] };

  function endpoint() { return C.CREW_ENDPOINT || (C.STATUS_ENDPOINT ? C.STATUS_ENDPOINT.replace(/trip-builder-status/, 'trip-builder-admin') : ''); }
  function usd(n) { return '$' + Math.round(+n || 0).toLocaleString('en-US'); }
  function num(v) { var n = +v; return isFinite(n) ? n : 0; }                           // a number, whatever the server sent: nothing in a number can be markup
  function link(l, text) { var h = u.url(l); return h ? ' · <a href="' + esc(h) + '">' + text + '</a>' : ''; }   // only http(s) and #/ links are links
  function day(iso, year) { var d = U.parseDate(iso); return d ? U.fmtDate(d) + (year ? ' ' + d.getUTCFullYear() : '') : ''; }
  function when(ts) { var d = ts ? new Date(ts) : null; return d && !isNaN(d) ? d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC' : ''; }
  function firstName(n) { return String(n || '').trim().split(/\s+/)[0] || 'them'; }
  function sess() { try { return JSON.parse(sessionStorage.getItem(SKEY)); } catch (e) { return null; } }
  function setSess(s) { try { if (s) sessionStorage.setItem(SKEY, JSON.stringify(s)); else sessionStorage.removeItem(SKEY); } catch (e) { /* private mode */ } }
  function parse(rest) {
    var p = u.dec(rest || '').split('?'), q = {}; (p[1] || '').split('&').forEach(function (kv) { var i = kv.indexOf('='); if (i > 0) q[kv.slice(0, i)] = u.dec(kv.slice(i + 1)); });
    return { ref: (p[0] || '').toUpperCase(), k: q.k || '', doo: q.do || '' };
  }
  function call(body) {
    return u.timed(endpoint(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, 30000).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok || d.ok === false) { var e = new Error(d.error || ('Something went wrong (' + r.status + ')')); e.status = r.status; throw e; }
        return d;
      });
    });
  }
  function stateOf(link) { var i = String(link || '').indexOf('#/build/'); return i < 0 ? '' : link.slice(i + 8); }
  function derive(r) {                       // trips sent before the summary existed: rebuild it from the guest's own link
    var st = MM.decodeState(stateOf(r.trip_link)); if (!st.items.length) return null;
    return MM.crewSummary(st, MM.plan(st), { people: r.party_size, dates: r.dates_flex });
  }
  function note(root, html, cls) { root.innerHTML = '<section class="quiz crew"><div class="wrap"><div class="qbox"><span class="over">Crew review</span>' + html + '</div></div></section>'; }

  /* ---------- the page ---------- */
  A.views.crew = function (rest) {
    var root = document.getElementById('app'), q = parse(rest);
    removeBar();
    if (!endpoint()) return note(root, '<h1 class="disp">Not switched on here.</h1><p class="qhelp">Crew review needs <code>CREW_ENDPOINT</code> in config.js.</p>');
    if (!q.ref || !q.k) return note(root, '<h1 class="disp">That link looks cut off.</h1><p class="qhelp">Open the trip from a button in the new-trip email, or from Admin &gt; Trip builder.</p>');
    note(root, '<h1 class="disp">Opening ' + esc(q.ref) + '…</h1>');
    load(root, q, q.doo, '');
  };

  function load(root, q, open, banner) {
    call({ action: 'view', ref: q.ref, key: q.k }).then(function (d) { paint(root, q, d, open, banner); }).catch(function (e) {
      note(root, '<h1 class="disp">' + (e.status === 401 ? 'That link has run out.' : 'Couldn\'t open that trip.') + '</h1><p class="qhelp">' + esc(e.message) + '</p>');
    });
  }

  function paint(root, q, d, open, banner) {
    var r = d.request, sum = d.summary || derive(r), first = firstName(r.name), st = STATUS[r.status] || [r.status, 'off'], can = !!d.canAct, dep = usd(r.deposit_amount);
    var enc = stateOf(r.trip_link), canEdit = can && r.status !== 'ready', rev = d.revision, gr = d.guestRevision;
    setSess({ ref: r.ref, k: q.k, name: r.name, first: first, people: r.party_size, dates: r.dates_flex, from: r.from_place, notes: r.notes, editing: false, rev: d.rev });

    var h = '<section class="quiz crew"><div class="wrap">' +
      '<div class="crew__top"><span class="over">Crew review · ' + esc(r.ref) + '</span><h1 class="disp">' + esc(r.name) + '\'s trip</h1>' +
      '<p class="crew__sub">' + esc(r.route || '') + ' · ' + num(r.days) + ' days' + (r.start_date ? ' · from ' + esc(day(r.start_date, true)) : '') + ' <span class="cpill cpill--' + st[1] + '">' + esc(st[0]) + '</span>' + (rev ? ' <span class="cpill cpill--edit">Edited by the crew</span>' : '') + (gr ? ' <span class="cpill cpill--upd">Changed by ' + esc(first) + ' · v' + num(gr.rev) + '</span>' : '') + '</p></div>' +
      (gr ? guestChangeHTML(gr, first) : '') +
      (banner ? '<div class="cbanner cbanner--ok" role="status">' + banner + '</div>' : '') +
      (!can ? '<div class="cbanner">' + (r.status === 'approved' ? 'This trip is booked. Nothing left to action.' : r.status === 'declined' ? 'This trip was declined' + (r.refunded_at ? ' and the deposit refunded' : '') + '.' : r.status === 'pending_payment' ? 'The deposit isn\'t paid yet, so there is nothing to action.' : 'Nothing to action.') + '</div>' : '') +
      '<div class="crew__acts" role="group" aria-label="Decide about this trip">' +
        act('approve', 'yes', 'Approve', r.status === 'ready' ? 'Change the price' : 'Send ' + first + ' the final price', can, open) +
        act('decline', 'no', 'Not approved', num(r.deposit_amount) > 0 ? 'Say no and refund the deposit' : 'Say no, with a reason', can, open) +
        act('edit', 'edit', 'Edit it', canEdit || !can ? 'Change it, add our input' : 'Balance link already sent', canEdit, open) + '</div>' +
      '<div id="cpanel"></div>' +
      '<div class="crew__grid"><div class="crew__main">' + (sum ? tripHTML(sum, d.suggestedBalance, r) : '<div class="cbox"><p>This trip can\'t be shown here. Open it in the builder below.</p></div>') + '</div>' +
      '<div class="crew__side" role="group" aria-label="About the guest and this trip">' + guestHTML(r, first, enc) + historyHTML(r, rev, d.original, first) + '</div></div>' +
      '</div></section>';
    root.innerHTML = h;
    var panel = $('#cpanel', root);
    function show(which) {
      Array.prototype.forEach.call(root.querySelectorAll('.crew__act'), function (b) { b.setAttribute('aria-expanded', b.getAttribute('data-crew') === which ? 'true' : 'false'); });
      panel.innerHTML = which ? panelHTML(which, r, sum, d, first, dep) : '';
      if (which) { wirePanel(which, root, q, r, d, first, dep); panel.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    }
    Array.prototype.forEach.call(root.querySelectorAll('.crew__act'), function (b) {
      b.addEventListener('click', function () { if (b.disabled) return; var w = b.getAttribute('data-crew'); show(b.getAttribute('aria-expanded') === 'true' ? '' : w); });
    });
    if (open && /^(approve|decline|edit)$/.test(open)) { var ob = root.querySelector('.crew__act[data-crew="' + open + '"]'); if (ob && !ob.disabled) show(open); }
  }

  function act(k, cls, label, sub, on, open) {
    return '<button type="button" class="crew__act crew__act--' + cls + '" data-crew="' + k + '" aria-expanded="' + (open === k ? 'true' : 'false') + '"' + (on ? '' : ' disabled') + '>' + label + '<small>' + esc(sub) + '</small></button>';
  }

  /* ---------- the trip itself ---------- */
  function stageHTML(g, r) {
    var a = g.arrival, f = g.from;
    return '<div class="cbox cbox--stage"><h3>Stage ' + num(g.n) + ' of their journey</h3><p><b>' + esc(firstName(r.name)) + ' is already travelling.</b> Only the new stops below need checking.</p>' +
      (f ? '<p>Starting from <b>' + esc(f.name) + '</b>' + (a ? ': ' + esc(a.mode) + ' to ' + esc(a.to) + ' · ' + esc(a.hours) + ' · ' + usd(a.usd) + (a.overnight ? ' · overnight' : '') : '') + '.</p>' : '') +
      (g.been && g.been.length ? '<p>Already been to ' + g.been.map(function (x) { return esc(x); }).join(', ') + '. None of these were suggested.</p>' : '') +
      (g.parent ? '<p class="cdim">The earlier stage is ' + esc(g.parent) + ' (find it in Admin &gt; Trip builder).</p>' : '') + '</div>';
  }
  function tripHTML(s, suggested, r) {
    var b = s.budget, h = s.stage ? stageHTML(s.stage, r) : '';
    h += '<div class="cglance"><div><span>Length</span><b>' + num(s.days) + ' days</b><i>' + num(s.nights) + ' nights</i></div><div><span>Stops</span><b>' + num(s.stopCount) + '</b><i>' + esc((s.countries || []).join(' + ')) + '</i></div>' +
      '<div><span>Dates</span><b>' + (s.start ? esc(day(s.start)) : 'Not set') + '</b><i>' + (s.start ? 'to ' + esc(day(s.end, true)) : esc(s.datesLabel || 'Needs dates')) + '</i></div>' +
      '<div><span>Estimate</span><b>' + usd(b.total) + '</b><i>each' + (num(s.people) > 1 ? ' · ' + usd(b.totalAllPeople) + ' for ' + num(s.people) : '') + '</i></div></div>';
    if (s.flags && s.flags.length) h += '<div class="cbox cbox--flags"><h3>Heads up before you decide</h3><ul>' + s.flags.map(function (f) { var warn = f.level === 'warn'; return '<li class="' + (warn ? 'warn' : 'info') + '">' + (warn ? '<b>!</b> ' : '') + esc(f.text) + '</li>'; }).join('') + '</ul></div>';
    h += '<h3 class="crew__h">The trip, stop by stop</h3>';
    h += s.stops.map(function (p, i) {
      var date = p.from ? day(p.from) + ' to ' + day(p.to) : '';
      var head = p.kind === 'allin' ? esc(p.name) + ' <small>· ' + num(p.days) + ' days · ' + usd(p.usd) + '</small>' : esc(p.name) + (p.country ? ' <small>· ' + esc(p.country) + '</small>' : '');
      var sub = p.kind === 'allin' ? esc(p.route || '') : num(p.nights) + (num(p.nights) === 1 ? ' night' : ' nights') + (date ? ' · ' + esc(date) : '') + ' · bed from ' + usd(p.bedUsd) + ' a night' + (p.partner ? ' (partner hostel, estimate)' : '');
      var tours = (p.tours || []).map(function (t) {
        return '<li><span>' + (t.fits ? '' : '<em>No room</em> ') + esc(t.name) + '</span><span>' + (t.payOnDay ? 'pay on the day' : usd(t.usd) + (t.est ? ' est.' : '')) + (t.date ? '<i>' + esc(day(t.date)) + '</i>' : t.day ? '<i>day ' + num(t.day) + '</i>' : '') + '</span></li>';
      }).join('') || (p.kind === 'allin' ? '' : '<li class="none"><span>No tours picked</span></li>');
      var next = p.next ? '<div class="cstop__next"><b>Then</b> ' + esc(p.next.mode) + ' to ' + esc(p.next.to) + ' · ' + esc(p.next.hours) + ' · ' + usd(p.next.usd) + (p.next.overnight ? ' · overnight' : '') + (p.next.date ? ' · ' + esc(day(p.next.date)) : '') + '</div>' : '';
      return '<article class="cstop"><div class="cstop__n">' + (i + 1) + '</div><div class="cstop__b"><h4>' + head + '</h4><p>' + sub + '</p><ul>' + tours + '</ul>' + next + '</div></article>';
    }).join('');
    var row = function (k, v, bold, n) { return '<tr' + (bold ? ' class="b"' : '') + '><td>' + esc(k) + (n ? '<i>' + esc(n) + '</i>' : '') + '</td><td>' + v + '</td></tr>'; };
    h += '<table class="cmoney"><caption>The money · each person, US dollars</caption>' + row('Beds', usd(b.beds)) + row('Tours', usd(b.tours)) + row('Getting around', usd(b.transport)) + (b.allIn ? row('ALL IN trip', usd(b.allIn)) : '') +
      (b.squadDiscount ? row('Squad discount', '-' + usd(-b.squadDiscount)) : '') + row('Trip cost', usd(b.tripCost), true) +
      row('Their spending money', usd(b.spendFund), false, usd(b.spendPerDay) + ' a day for food and fun. Theirs to spend, not charged by us.') + row('Estimated total', usd(b.total), true) +
      (num(s.people) > 1 ? row('For all ' + num(s.people), usd(b.tripCostAllPeople) + ' trip cost · ' + usd(b.totalAllPeople) + ' with spending money', true) : '') +
      (b.guestBudget ? row('Their own budget', usd(b.guestBudget) + ' each', false, b.budgetLeft == null ? '' : b.budgetLeft >= 0 ? usd(b.budgetLeft) + ' to spare' : usd(-b.budgetLeft) + ' over') : '') +
      '<tfoot><tr><td colspan="2">' + (num(r.deposit_amount) > 0 ? 'Deposit paid <b>' + usd(r.deposit_amount) + '</b> · suggested balance <b>' + usd(suggested) + '</b> <i>(trip cost' + (num(s.people) > 1 ? ' for ' + num(s.people) : '') + ' less the deposit)</i>' : 'Free to send, nothing paid yet · suggested price <b>' + usd(suggested) + '</b> <i>(the trip cost' + (num(s.people) > 1 ? ' for ' + num(s.people) : '') + ')</i>') + '</td></tr></tfoot></table>';
    if (r.notes) h += '<div class="cbox cbox--note"><h3>' + esc(firstName(r.name)) + '\'s note</h3><p>' + esc(r.notes).replace(/\n/g, '<br>') + '</p></div>';
    return h;
  }

  // The guest changed a trip they had already sent: what moved, what it replaced, and what that does to an approval.
  function guestChangeHTML(g, first) {
    var w = g.was || {};
    return '<div class="cbanner cbanner--upd" role="status"><b>' + esc(first) + ' changed this trip after sending it</b> (version ' + num(g.rev) + (g.at ? ', ' + esc(when(g.at)) : '') + '). What you see below is their latest plan.' +
      (g.changes && g.changes.length ? '<ul>' + g.changes.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ul>' : '') +
      (g.note ? '<p>“' + esc(g.note) + '”</p>' : '') +
      '<p class="cdim">Before: ' + esc(w.route || '') + (num(w.days) ? ' · ' + num(w.days) + ' days' : '') + (w.estTotalUsd != null ? ' · ' + usd(w.estTotalUsd) + ' est.' : '') + link(w.link, 'open it') + '</p>' +
      (g.wasStatus === 'ready' ? '<p><b>You had approved the earlier version.</b> That approval and the balance are withdrawn, so nothing is waiting for ' + esc(first) + ' to pay. Approve this one when you\'re happy.</p>' : '') + '</div>';
  }

  function guestHTML(r, first, enc) {
    var wa = String(r.whatsapp || '').replace(/\D/g, ''), h = '<div class="cbox"><h3>Who</h3><p class="cwho"><b>' + esc(r.name) + '</b><br>' + (num(r.party_size) > 1 ? 'Party of ' + num(r.party_size) : 'Travelling solo') + (r.from_place ? ' · from ' + esc(r.from_place) : '') + '</p><p class="clinks">';
    if (wa.length >= 8) h += '<a class="btn btn--sm btn--paper" href="https://wa.me/' + wa + '" target="_blank" rel="noopener">WhatsApp ' + esc(first) + '</a>';
    if (r.email) h += '<a class="btn btn--sm btn--paper" href="mailto:' + esc(r.email) + '">Email ' + esc(first) + '</a>';
    else if (r.guest_email) h += '<a class="btn btn--sm btn--paper" href="mailto:' + esc(r.guest_email) + '">Email ' + esc(first) + '</a>';
    h += '</p><dl class="cdl"><dt>Prefers</dt><dd>' + (r.contact_via === 'whatsapp' ? 'WhatsApp ' + esc(r.whatsapp || '') : 'Email ' + esc(r.email || '')) + '</dd>' +
      (r.guest_email && r.guest_email !== r.email ? '<dt>Receipts</dt><dd>' + esc(r.guest_email) + '</dd>' : '') +
      '<dt>Dates</dt><dd>' + esc({ fixed: 'Fixed', flex: 'Flexible', open: 'Not decided' }[r.dates_flex] || '—') + '</dd>' +
      '<dt>Sent</dt><dd>' + esc(when(r.created_at)) + '</dd>' +
      '<dt>Deposit</dt><dd>' + (num(r.deposit_amount) > 0 ? usd(r.deposit_amount) + (r.deposit_paid_at ? ' paid' : ' not paid') + (r.refunded_at ? ', refunded' : '') : 'None: free to send') + '</dd>' +
      (r.hold_until && ['submitted', 'checking'].indexOf(r.status) > -1 ? '<dt>Beds held</dt><dd>until ' + esc(when(r.hold_until)) + '</dd>' : '') +
      (r.all_in_match ? '<dt>Looks like</dt><dd>ALL IN ' + esc(r.all_in_match) + '</dd>' : '') +
      (r.campaign_ref ? '<dt>Came from</dt><dd>' + esc(r.campaign_ref) + '</dd>' : '') + (r.from_hostel ? '<dt>QR at</dt><dd>' + esc(r.from_hostel) + '</dd>' : '') + '</dl></div>';
    if (enc) h += '<div class="cbox"><h3>See it as ' + esc(first) + ' did</h3><p class="clinks"><a class="btn btn--sm" href="#/build/' + esc(enc) + '">Open in the builder</a><a class="btn btn--sm btn--paper" href="#/pack/' + esc(enc) + '">Trip pack</a></p></div>';
    return h;
  }

  function historyHTML(r, rev, original, first) {
    if (!rev && !r.crew_note && !(r.balance_amount && r.status === 'ready') && !(r.pay_plan && r.pay_schedule && r.pay_schedule.length)) return '';
    var h = '<div class="cbox"><h3>History</h3>';
    if (rev) {
      h += '<p>Edited by the crew ' + esc(when(rev.at)) + '.' + (rev.note ? ' Note: “' + esc(rev.note) + '”' : '') + '</p>';
      if (original && original.trip) h += '<p class="cdim">' + esc(first) + '\'s own version: ' + esc(original.trip.route || '') + ' · ' + num(original.trip.days) + ' days' + (original.trip.estTotalUsd != null ? ' · ' + usd(original.trip.estTotalUsd) + ' est.' : '') + link(original.trip.link, 'open it') + '</p>';
    }
    if (r.crew_note) h += '<p>Note on file: “' + esc(r.crew_note) + '”</p>';
    if (r.status === 'ready' && r.balance_amount) h += '<p>Waiting for ' + esc(first) + ' to choose how to pay the <b>' + usd(r.balance_amount) + '</b>.</p>';
    var sch = Array.isArray(r.pay_schedule) ? r.pay_schedule : [];
    if (r.pay_plan && sch.length) h += '<p><b>' + esc({ now: 'Paying it all now', later: 'Paying a week before they leave', instalments: 'Paying in instalments' }[r.pay_plan] || r.pay_plan) + '</b></p><ul class="cplan">' + sch.map(function (i) { return '<li class="' + (/^[a-z_]{1,12}$/.test(i.status) ? i.status : '') + '"><span>' + esc(day(i.due, true)) + '</span><b>' + usd(i.amount) + '</b><i>' + esc({ paid: 'Paid', pending: 'Due', failed: 'Failed, retrying', gave_up: 'Not taken' }[i.status] || i.status) + '</i></li>'; }).join('') + '</ul>';
    return h + '</div>';
  }

  /* ---------- the three panels ---------- */
  function panelHTML(which, r, sum, d, first, dep) {
    if (which === 'approve') {
      var sug = d.suggestedBalance || '', hasDep = num(r.deposit_amount) > 0;
      return '<div class="cpanel cpanel--yes"><h3>' + (r.status === 'ready' ? 'Update ' + esc(first) + '\'s price' : 'Send ' + esc(first) + ' the final price') + '</h3>' +
        '<p>The trip checks out. ' + esc(first) + ' gets an email to choose how to pay' + (hasDep ? ' the rest' : '') + ': all now, a week before they leave, or in instalments if they leave 2+ months out. ' + (hasDep ? 'The ' + dep + ' deposit is already counted, and nothing' : 'They haven\'t paid anything yet, and nothing') + ' is charged until they choose.</p>' +
        '<div class="field"><label for="cbal">' + (hasDep ? 'Balance to charge' : 'Price to charge') + ' (US dollars)</label><input class="input" id="cbal" type="number" min="1" step="0.01" value="' + (r.status === 'ready' && r.balance_amount ? num(r.balance_amount) : (num(sug) || '')) + '" inputmode="decimal">' +
        '<p class="cdim">' + (sum ? 'Starting figure: the trip cost' + (num(sum.people) > 1 ? ' for ' + num(sum.people) : '') + ' (' + usd(sum.budget.tripCostAllPeople) + ')' + (hasDep ? ' less the ' + dep + ' deposit' : '') + '. Spending money is never charged. Beds are "from" prices, so change it if the live rates differ.' : (hasDep ? 'Work out the balance after the deposit.' : 'Work out the price for everyone.')) + '</p></div>' +
        '<div class="field"><label for="cnote">Note to ' + esc(first) + ' (optional, goes in the email)</label><textarea class="input" id="cnote" placeholder="e.g. All checked. We swapped the night bus for a day minivan so you arrive in daylight.">' + esc(r.crew_note || '') + '</textarea></div>' +
        '<p class="cerr" id="cerr" role="alert" hidden></p><button class="btn btn--lg" id="cgo" type="button">' + (r.status === 'ready' ? 'Send ' + esc(first) + ' the new price' : 'Send ' + esc(first) + ' the final price') + '</button></div>';
    }
    if (which === 'decline') {
      return '<div class="cpanel cpanel--no"><h3>Can\'t make this version work</h3><p>' + esc(first) + ' gets a kind email with your reason and an offer to find a version that does work.</p>' +
        '<div class="field"><label for="cnote">Reason for ' + esc(first) + ' (goes in the email)</label><textarea class="input" id="cnote" placeholder="e.g. Koh Sdach is full on those nights. Want to swap it for Koh Rong Samloem?">' + esc(r.crew_note || '') + '</textarea></div>' +
        (r.deposit_paid_at && !r.refunded_at ? '<label class="chk"><input type="checkbox" id="cref" checked><span>Refund the <b>' + dep + '</b> deposit to their card</span></label>' : '') +
        '<p class="cerr" id="cerr" role="alert" hidden></p><button class="btn btn--pink btn--lg" id="cgo" type="button">Decline and email ' + esc(first) + '</button></div>';
    }
    return '<div class="cpanel cpanel--edit"><h3>Make it right, then send it back</h3>' +
      '<p>This opens ' + esc(first) + '\'s trip in the builder. Change the stops, nights, tours or travel. When you\'re happy, press <b>Save our version</b> on the bar at the bottom. ' + esc(first) + '\'s own version is kept safe, and you can approve the new one straight after.</p>' +
      '<button class="btn btn--lg crew__orange" id="cgo" type="button">Open it in the builder</button></div>';
  }

  function wirePanel(which, root, q, r, d, first, dep) {
    var go = $('#cgo', root), err = $('#cerr', root);
    function fail(e) { go.disabled = false; go.textContent = go.getAttribute('data-label'); if (err) { err.hidden = false; err.textContent = e.message; } else u.toast(e.message); }
    go.setAttribute('data-label', go.textContent);
    go.addEventListener('click', function () {
      if (err) err.hidden = true;
      var noteV = ($('#cnote', root) || {}).value || '';
      if (which === 'edit') {
        var s = sess() || {}; s.editing = true; setSess(s);
        var enc = stateOf(r.trip_link); if (!enc) return u.toast('That trip has no link to open.');
        return u.go('build', enc);
      }
      go.disabled = true; go.textContent = 'Working…';
      if (which === 'approve') {
        var amt = Math.round(parseFloat($('#cbal', root).value) * 100) / 100;
        if (!(amt >= 1 && amt <= 50000)) return fail(new Error(num(r.deposit_amount) > 0 ? 'Enter the balance in US dollars, after the deposit.' : 'Enter the price in US dollars.'));
        call({ action: 'balance', ref: q.ref, key: q.k, amount: amt, note: noteV, rev: d.rev }).then(function (res) {
          setSess(null);
          load(root, q, '', 'Sent. ' + esc(first) + ' can now choose how to pay the <b>' + usd(amt) + '</b>' + (res.emailed ? ', by email.' : '. There was no email address on file, so send them this link yourself: <a href="' + esc(u.url(res.url) || '#/') + '">choose how to pay</a>.'));
        }).catch(fail);
      } else {
        var refund = !!($('#cref', root) && $('#cref', root).checked);
        call({ action: 'decline', ref: q.ref, key: q.k, note: noteV, refund: refund, rev: d.rev }).then(function (res) {
          setSess(null);
          load(root, q, '', 'Declined. ' + esc(first) + ' has been emailed' + (res.refunded ? ' and ' + usd(res.refunded) + ' is on its way back to their card.' : '.'));
        }).catch(fail);
      }
    });
  }

  /* ---------- the "Save our version" bar, shown in the builder while a crew member is editing ---------- */
  function removeBar() { var b = document.getElementById('crewbar'); if (b) b.remove(); document.body.classList.remove('crewing'); }
  function bar() {
    var s = sess(), el = document.getElementById('crewbar');
    if (!s || !s.editing || A.view !== 'build') return removeBar();
    if (!el) { el = document.createElement('div'); el.id = 'crewbar'; el.className = 'crewbar'; document.body.appendChild(el); document.body.classList.add('crewing'); }
    if (el.getAttribute('data-ref') === s.ref) return;
    el.setAttribute('data-ref', s.ref);
    el.innerHTML = '<div class="crewbar__in"><div class="crewbar__who"><span class="over">Crew edit</span><b>' + esc(s.ref) + ' · ' + esc(s.name) + '</b></div>' +
      '<input class="input" id="crewnote" maxlength="400" placeholder="Note to ' + esc(s.first || 'them') + ' (optional)" aria-label="Note to the guest">' +
      '<button class="btn btn--sm" id="crewsave" type="button">Save our version</button>' +
      '<a class="btn btn--sm btn--paper" href="#/crew/' + esc(s.ref) + '?k=' + encodeURIComponent(s.k) + '">Back to review</a>' +
      '<button class="btn btn--sm btn--ghost" id="crewleave" type="button">Leave edit mode</button></div>';
    document.getElementById('crewleave').addEventListener('click', function () { s.editing = false; setSess(s); removeBar(); });
    document.getElementById('crewsave').addEventListener('click', function () {
      var cur = sess(), st = A.state, pl = MM.plan(st), b = this;
      if (!pl.totals.days) return u.toast('Add a stop first');
      var link = u.baseUrl() + '#/build/' + MM.encodeState(st), sum = MM.crewSummary(st, pl, { people: cur.people, dates: cur.dates });
      b.disabled = true; b.textContent = 'Saving…';
      call({ action: 'revise', ref: cur.ref, key: cur.k, rev: cur.rev, note: document.getElementById('crewnote').value,
        trip: { link: link, state: MM.encodeState(st), route: MM.routeLine(pl), days: pl.totals.days, nights: pl.totals.nights, stops: pl.places, countries: pl.countries, start: st.start || '', estTotalUsd: pl.totals.total },
        summary: sum, crewText: MM.crewText(sum, { name: cur.name, from: cur.from, notes: cur.notes, link: link }) })
        .then(function () { cur.editing = false; setSess(cur); removeBar(); u.toast('Saved. Now approve it, or send it back.'); location.hash = '#/crew/' + cur.ref + '?k=' + encodeURIComponent(cur.k) + '&do=approve'; })
        .catch(function (e) { b.disabled = false; b.textContent = 'Save our version'; u.toast(e.message); });
    });
  }
  window.addEventListener('hashchange', function () { setTimeout(bar, 60); });
  setTimeout(bar, 300);
})();
