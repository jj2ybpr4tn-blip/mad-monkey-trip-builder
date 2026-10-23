/* ============================================================
   REVIEW + HOLD + PAY: "a real person checks every trip".

   The guest sends the trip for review; the crew checks it; the guest approves and pays the rest.
     • the "Hold my beds + get it checked" modal and confirmation
     • the trip status page  #/trip/<ref>[?k=<key>]  including choosing how to pay once the crew has approved

   Two modes, set by MM_CONFIG:
     DEPOSIT_PER_PERSON = 0  (the default) free to send: nothing is paid until the guest has approved the checked plan.
                             Once the crew approves, the guest picks how to pay: all now, a week before they leave, or in
                             instalments when they leave 60+ days out (PAY_ENDPOINT). A card is collected at that point.
     DEPOSIT_PER_PERSON > 0  a deposit is taken when the trip is sent (LEAD_ENDPOINT answers with a Stripe `checkoutUrl`).
                             It holds the beds, counts towards the trip, and is refunded if the crew can't make it work.
   Whichever the config says, the page follows what the backend answers: a `checkoutUrl` in the reply to a send means go and pay it.
   With no LEAD_ENDPOINT it runs in demo mode: nothing is sent or charged.
   Contract: docs/LEADS.md (send), docs/PAYMENTS.md (status + pay).
   ============================================================ */
(function () {
  var A = window.MMApp, MM = window.MM, C = window.MM_CONFIG || {}, u = A.util, esc = u.esc, $ = u.$, U = MM.util;
  var per = function () { return +C.DEPOSIT_PER_PERSON || 0; };
  var deposit = function () { return per() > 0; };
  var usd = function (n) { return '$' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 }); };
  var hold = function () { return C.HOLD_HOURS || 48; };
  var subs = function () { return u.store('mm-subs') || []; };
  var saveRec = function (rec) { var l = subs().filter(function (s) { return s.ref !== rec.ref; }); l.unshift(rec); u.store('mm-subs', l.slice(0, 20)); };
  var payEndpoint = function () { return C.PAY_ENDPOINT || (C.STATUS_ENDPOINT ? C.STATUS_ENDPOINT.replace(/trip-builder-status/, 'trip-builder-pay') : ''); };
  var reviseEndpoint = function () { return C.REVISE_ENDPOINT || (C.STATUS_ENDPOINT ? C.STATUS_ENDPOINT.replace(/trip-builder-status/, 'trip-builder-revise') : ''); };
  var EDITABLE = ['pending_payment', 'submitted', 'checking', 'ready'];
  // `withDep` is whether THIS trip took a deposit (a trip page knows; the send form goes by the config).
  function steps(withDep) {
    var d = withDep === undefined ? deposit() : !!withDep;
    return [
      { k: 'submitted', t: 'You send it', d: d ? 'A ' + usd(per()) + ' deposit per person holds your beds and sends your plan to the crew.' : 'Free. Your whole plan lands with the crew.' },
      { k: 'checking', t: 'A human checks it', d: 'A real crew member checks the routes, beds, dates and prices.' },
      { k: 'ready', t: 'You approve', d: d ? 'You get the checked plan and the final price. Then you choose how to pay the rest.' : 'You get the checked plan and the final price. Change anything you like.' },
      { k: 'approved', t: 'You\'re booked', d: d ? 'Your deposit counts towards the total. Pay the rest now, later or in instalments, your way.' : 'Only now do you pay, your way. Beds locked in.' }];
  }
  function ref() { var s = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', o = 'MM-'; for (var i = 0; i < 6; i++) o += s[Math.floor(Math.random() * s.length)]; return o; }
  function fmtDT(iso) { var d = new Date(iso); return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) + ', ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); }
  function fmtDay(iso) { var d = U.parseDate(iso); return d ? U.fmtDate(d) + (d.getUTCFullYear() !== new Date().getUTCFullYear() ? ' ' + d.getUTCFullYear() : '') : ''; }
  function stepsHTML(status, withDep) {
    var S = steps(withDep), at = S.map(function (s) { return s.k; }).indexOf(status === 'pending_payment' ? 'submitted' : status);
    return '<ol class="steps">' + S.map(function (s, i) { return '<li class="' + (i < at ? 'done' : i === at ? 'now' : '') + '"><i>' + (i < at ? '✓' : i + 1) + '</i><div><b>' + s.t + '</b><span>' + s.d + '</span></div></li>'; }).join('') + '</ol>';
  }
  function parseRef(rest) { var p = u.dec(rest || '').split('?'), q = {}; (p[1] || '').split('&').forEach(function (kv) { var i = kv.indexOf('='); if (i > 0) q[kv.slice(0, i)] = u.dec(kv.slice(i + 1)); }); return { ref: (p[0] || '').toUpperCase(), k: q.k || '' }; }

  /* ---------- the modal ---------- */
  function open() {
    if (A.revise) return openRevise();
    var plan = u.getPlan();
    if (!plan || !plan.totals.days) { u.toast('Add a stop first'); return; }
    var q = u.store('mm-lead') || {}, hasDate = !!A.state.start, live = !!C.LEAD_ENDPOINT, dep = deposit();
    var sizes = [1, 2, 3, 4, 5, 6, 7, 8].map(function (n) { return '<option value="' + n + '">' + (n === 1 ? 'Just me' : n + ' of us') + '</option>'; }).join('');
    u.openModal('<div class="modal__hd"><div><div class="over">Checked by a human</div><h2 class="disp">Hold my beds.<br>Get it checked.</h2></div><button class="modal__x" data-act="close" aria-label="Close" type="button">×</button></div><div class="modal__bd">' +
      '<p style="font-weight:500">Nobody books this for you by robot. A <b>real Mad Monkey crew member</b> checks your whole trip. ' + (dep
        ? 'A <b>' + usd(per()) + ' deposit per person</b> holds your beds while they do, and it comes off your trip total. If the crew can\'t make it work, you get it back.'
        : '<b>Sending it is free.</b> You pay nothing until you\'ve seen the checked plan and said yes.') + ' <span class="nowrap">Not sure about something? ' + u.ask('btn btn--sm btn--paper') + ' first.</span></p>' + stepsHTML('submitted') +
      '<form id="leadf" novalidate><div class="form2"><div class="field"><label for="lf-name">First name</label><input class="input" id="lf-name" name="name" autocomplete="given-name" required value="' + esc(q.name || '') + '"></div>' +
      u.contactPick(q) +
      '<div class="field"><label for="lf-from">Where are you now?</label><input class="input" id="lf-from" name="from" placeholder="city or country" value="' + esc(q.from || '') + '"></div>' +
      '<div class="field"><label for="lf-size">Travelling as</label><select class="select" id="lf-size" name="size">' + sizes + '</select></div>' +
      '<div class="field"><label for="lf-flex">Dates</label><select class="select" id="lf-flex" name="flex"><option value="fixed">These dates, locked</option><option value="flex">Flexible by a week or so</option><option value="open">Still deciding</option></select></div>' +
      '<div class="humans full holdbox" style="margin:0"><span>' + (hasDate ? '<b>We hold your beds for these dates</b> while the crew checks it (up to ' + hold() + ' hours).' : '<b>No start date yet</b>, so there are no nights to hold. The crew will help you pick dates.') + '</span></div>' +
      '<div class="field full"><label for="lf-notes">Anything the crew should know?</label><textarea class="input" id="lf-notes" name="notes" placeholder="budget worries, who you\'re bringing, must-dos…"></textarea></div>' +
      '<div class="full" style="display:none"><label>Leave empty <input name="website" tabindex="-1" autocomplete="off"></label></div>' +
      '<label class="chk full"><input type="checkbox" name="consent" required><span>It\'s OK for Mad Monkey to contact me about this trip. We only use your details to plan it with you.' + (C.PRIVACY_URL ? ' <a href="' + esc(C.PRIVACY_URL) + '" target="_blank" rel="noopener">Privacy</a>' : '') + '</span></label>' +
      (dep ? '<div class="refbox full" style="margin:0"><span class="over">Deposit today</span><b id="lf-dep">' + usd(per()) + '</b></div>' : '') + '</div>' +
      '<div id="leaderr" class="warn" style="display:none;margin-top:var(--s-3)"><i>!</i><span></span></div>' +
      '<div style="display:flex;gap:var(--s-2);margin-top:var(--s-4);flex-wrap:wrap"><button class="btn btn--pink" type="submit" id="lf-pay">' + (dep && live ? 'Pay ' + usd(per()) + ' deposit' : 'Send it for checking') + '</button><button class="btn btn--ghost" data-act="close" type="button">Not yet</button></div>' +
      (dep && live ? '<p class="fine" style="margin-top:var(--s-3)">Secure payment by Stripe. Your deposit comes off your trip total, and we save the card so you can pay the rest your way once you\'ve approved the checked plan: all at once, a week before you leave, or in instalments if you\'re travelling 2+ months from now. You only pay it if you say yes.</p>' : '') + '</form></div>', function (m) {
        var size = $('#lf-size', m), depEl = $('#lf-dep', m), pay = $('#lf-pay', m);
        if (dep) size.addEventListener('change', function () {
          var n = +size.value || 1, total = per() * n;
          depEl.textContent = usd(total) + (n > 1 ? ' (' + n + ' × ' + usd(per()) + ')' : '');
          if (live) pay.textContent = 'Pay ' + usd(total) + ' deposit';
        });
        $('#leadf', m).addEventListener('submit', submit);
      });
  }

  function submit(e) {
    e.preventDefault(); var f = e.target, v = {}; new FormData(f).forEach(function (val, k) { v[k] = typeof val === 'string' ? val.trim() : val; });
    var err = $('#leaderr'), show = function (m) { err.style.display = 'grid'; $('span', err).textContent = m; };
    if (v.website) return;
    if (!v.name) return show('Pop your first name in.');
    var ct = u.readContact(v); if (ct.err) return show(ct.err);
    if (!v.consent) return show('Tick the box so we\'re allowed to reply.');
    u.store('mm-lead', { name: v.name, via: ct.via, email: v.email, whatsapp: v.whatsapp, from: v.from });
    var plan = u.getPlan(), wantHold = !!A.state.start, people = Math.min(8, Math.max(1, +v.size || 1)), dep = deposit();
    var payload = MM.leadPayload(A.state, plan, { name: v.name, via: ct.via, email: ct.email, whatsapp: ct.whatsapp, from: v.from || '', partySize: people, dates: v.flex, notes: v.notes || '', consent: true },
      { ref: A.meta.ref, fromHostel: A.meta.from, link: u.shareLink(), stage: A.stage ? { n: A.stage.n, parent: A.stage.parent } : null });
    payload.type = 'review_request'; payload.status = 'submitted'; payload.hold = { requested: wantHold, hours: hold() };
    if (dep) payload.deposit = { perPersonUsd: per(), people: people };
    u.track('review_request', { stops: plan.places.length, days: plan.totals.days, hold: wantHold });
    var btn = $('button[type=submit]', f), label = btn.textContent; btn.disabled = true; btn.textContent = dep && C.LEAD_ENDPOINT ? 'Opening secure payment…' : 'Sending…';
    function record(data, demo) {
      var r = (data && data.ref) || ref(), now = new Date(), rec = { ref: r, createdAt: now.toISOString(), status: (data && data.status) || 'submitted', route: payload.trip.route, days: payload.trip.days, link: payload.trip.link,
        hold: wantHold ? { until: (data && data.hold && data.hold.until) || new Date(now.getTime() + hold() * 3600000).toISOString() } : null, demo: !!demo, name: v.name, email: ct.email, whatsapp: ct.whatsapp, via: ct.via,
        deposit: dep ? { amount: per() * people, paid: false } : null, payLink: (data && data.checkoutUrl) || '', key: (data && data.key) || '', people: people, datesFlex: v.flex || '', stage: A.stage ? { n: A.stage.n, parent: A.stage.parent } : null };
      saveRec(rec); return rec;
    }
    if (!C.LEAD_ENDPOINT) return setTimeout(function () { A._lastLead = payload; success(record(null, true), payload); }, 400);
    u.timed(C.LEAD_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }, 30000)
      .then(function (res) { return res.json().catch(function () { return {}; }).then(function (d) { if (!res.ok || (dep && d.status !== 'submitted' && !u.url(d.checkoutUrl, true))) throw new Error(d.error || ('HTTP ' + res.status)); return d; }); })
      .then(function (data) {
        var rec = record(data, false); A._lastLead = payload;
        // The backend decides: a `checkoutUrl` means it wants the deposit paid first (the trip isn't with the crew until it is); without one the trip is already with them.
        if (u.url(data.checkoutUrl, true)) { try { sessionStorage.setItem('mm-paying', data.ref + ':pending_payment'); } catch (x) { /* private mode */ } window.location.href = u.url(data.checkoutUrl, true); }
        else success(rec, payload);
      })
      .catch(function (x) { btn.disabled = false; btn.textContent = label; show((x && x.message && x.message.indexOf('HTTP') !== 0 ? x.message + ' ' : '') + (dep ? 'Nothing has been charged. ' : '') + 'Try again, or copy your plan and message the crew' + (C.CREW_EMAIL ? ' at ' + C.CREW_EMAIL : '') + '.'); });
  }

  // Confirmation for demo mode (nothing sent, nothing charged) and for a hold-only send.
  function success(rec, payload) {
    var wa = C.WHATSAPP ? 'https://wa.me/' + C.WHATSAPP + '?text=' + encodeURIComponent('Hi Mad Monkey, I just sent trip ' + rec.ref + ' for checking: ' + payload.trip.route + '. ' + rec.link) : '';
    var statusUrl = u.baseUrl() + '#/trip/' + rec.ref;
    u.openModal('<div class="modal__hd"><div><div class="over">' + (rec.demo ? 'Demo mode' : 'With the crew') + '</div><h2 class="disp">' + (rec.demo ? 'Review request ready.' : 'It\'s with the crew.') + '</h2></div><button class="modal__x" data-act="close" aria-label="Close" type="button">×</button></div><div class="modal__bd">' +
      (rec.demo ? '<div class="demo">DEMO MODE: nothing was sent, nothing was charged and no beds were held. Set <code>LEAD_ENDPOINT</code> in config.js and this goes straight to the crew.</div>' : '') +
      '<div class="refbox"><span class="over">Your reference</span><b>' + esc(rec.ref) + '</b></div>' +
      (rec.hold ? '<p style="font-weight:600">' + (rec.demo ? 'In live mode we\'d hold your beds until ' : 'We\'re holding your beds until ') + '<b>' + fmtDT(rec.hold.until) + '</b> while a real person checks the trip.</p>' : '') + stepsHTML(rec.status) +
      '<div style="display:flex;gap:var(--s-2);flex-wrap:wrap"><a class="btn btn--sm" href="#/trip/' + esc(rec.ref) + '" data-act="close">Track my trip</a>' + (wa ? '<a class="btn btn--sm btn--pink" href="' + wa + '" target="_blank" rel="noopener">' + esc(u.askLabel()) + ' on WhatsApp</a>' : '') +
      '<button class="btn btn--sm btn--paper" data-act="copylead" type="button">Copy review card</button><button class="btn btn--sm btn--ghost" data-act="close" type="button">Done</button></div><input type="hidden" id="statusurl" value="' + esc(statusUrl) + '"></div>');
  }

  /* ---------- changing a trip after sending it ----------
     The guest opens their trip page, presses "Change my trip", edits it in the builder and presses "Send my changes". That REPLACES the trip on the same
     request (same reference, same deposit, same held beds), so the crew only ever checks their latest plan. Possible until the trip is booked. */
  function stateOf(link) { var i = String(link || '').indexOf('#/build/'); return i < 0 ? '' : String(link).slice(i + 8); }
  function startRevise(x, key) {
    var enc = stateOf(x.link), st = enc ? MM.decodeState(enc) : null;
    if (!st || !st.items.length) { u.toast('That trip has no plan to open.'); return; }
    A.state = st; A.auto = false; A.focus = []; A.open = {}; A.tourPending = false;
    A.revise = { ref: x.ref, k: key || x.key || '', base: MM.encodeState(st), route: x.route || '', days: x.days || 0, status: x.status, people: x.people || 1, datesFlex: x.datesFlex || '', name: x.name || '', via: x.via || 'email', email: x.email || '', whatsapp: x.whatsapp || '', stage: x.stage || null };
    u.store('mm-revise', A.revise); u.persist(); u.track('revise_start', { status: x.status }); u.go('build', MM.encodeState(st));
  }
  function endRevise() { A.revise = null; u.store('mm-revise', null); }
  function changesNow() { return A.revise ? MM.edit.describe(MM.decodeState(A.revise.base), A.state) : []; }
  // The strip at the top of the builder while someone is changing a trip they sent.
  A.reviseBar = function () {
    var R = A.revise, n = changesNow().length, same = MM.encodeState(A.state) === R.base;
    return '<div class="revbar" role="region" aria-label="Changing a trip you sent"><div class="revbar__t"><span class="over">Changing trip ' + esc(R.ref) + '</span><b>' + (same ? 'This is the trip the crew has. Change what you like.' : 'You have changed it. Send your changes when you\'re happy.') + '</b>' +
      '<span class="fine">Your changes replace what the crew is checking, so they only ever look at your latest plan.' + (R.status === 'ready' ? ' They already approved the version you sent, so they\'ll check this one again and send you a new price.' : '') + '</span></div>' +
      '<div class="revbar__b"><button class="btn btn--sm btn--pink" data-act="lead" type="button"' + (same ? ' disabled' : '') + '>Send my changes' + (n ? ' (' + n + (n >= 6 ? '+' : '') + ')' : '') + '</button><button class="btn btn--sm btn--ghost" data-act="reviseCancel" type="button">Discard my changes</button></div></div>';
  };
  function openRevise() {
    var R = A.revise, plan = u.getPlan(); if (!plan || !plan.totals.days) { u.toast('Add a stop first'); return; }
    var ch = changesNow(), same = MM.encodeState(A.state) === R.base;
    u.openModal('<div class="modal__hd"><div><div class="over">Trip ' + esc(R.ref) + '</div><h2 class="disp">Send your changes.</h2></div><button class="modal__x" data-act="close" aria-label="Close" type="button">×</button></div><div class="modal__bd">' +
      '<p style="font-weight:500">This <b>replaces</b> the trip you sent. Same reference, same deposit, your beds stay held, and the crew checks this version instead.</p>' +
      (same ? '<div class="humans" style="margin-top:0"><b>You haven\'t changed anything yet.</b> Close this and change your trip first.</div>' : '<div class="revchg"><div class="over">What you changed</div><ul>' + (ch.length ? ch.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') : '<li>Your plan</li>') + '</ul></div>') +
      (R.status === 'ready' ? '<div class="demo" style="background:var(--yellow)">The crew already approved the version you sent. Because the plan has changed they\'ll check this one again and send you a new price. Nothing is due in the meantime.</div>' : '') +
      '<form id="revf" novalidate><div class="field"><label for="rv-note">Anything the crew should know? (optional)</label><textarea class="input" id="rv-note" maxlength="1000" placeholder="why you changed it, anything they should look at first…"></textarea></div>' +
      '<div id="reverr" class="warn" style="display:none;margin-top:var(--s-3)"><i>!</i><span></span></div>' +
      '<div style="display:flex;gap:var(--s-2);margin-top:var(--s-4);flex-wrap:wrap"><button class="btn btn--pink" type="submit" id="rv-go"' + (same ? ' disabled' : '') + '>Send my changes</button><button class="btn btn--ghost" data-act="close" type="button">Keep editing</button></div>' +
      (!reviseEndpoint() ? '<div class="demo" style="margin-top:var(--s-3)">DEMO MODE: nothing is sent. Set <code>STATUS_ENDPOINT</code> (or <code>REVISE_ENDPOINT</code>) in config.js and this replaces the trip the crew has.</div>' : '') + '</form></div>', function (m) {
        $('#revf', m).addEventListener('submit', function (e) { e.preventDefault(); submitRevise(m, ch, ($('#rv-note', m).value || '').trim()); });
      });
  }
  function submitRevise(m, ch, note) {
    var R = A.revise, plan = u.getPlan(), btn = $('#rv-go', m), err = $('#reverr', m), label = btn.textContent;
    function show(msg) { err.style.display = 'grid'; $('span', err).textContent = msg; btn.disabled = false; btn.textContent = label; }
    btn.disabled = true; btn.textContent = 'Sending…'; err.style.display = 'none';
    var payload = MM.leadPayload(A.state, plan, { name: R.name, via: R.via, email: R.email, whatsapp: R.whatsapp, from: '', partySize: R.people || 1, dates: R.datesFlex, notes: note }, { link: u.shareLink(), stage: R.stage || null });
    var body = { ref: R.ref, k: R.k, note: note, changes: ch.slice(0, 8), trip: payload.trip, summary: payload.summary, crewText: payload.crewText, itinerary: payload.itinerary };
    function done(d) {
      var rec = subs().filter(function (x) { return x.ref === R.ref; })[0];
      if (rec) { rec.route = payload.trip.route; rec.days = payload.trip.days; rec.link = payload.trip.link; if (d && d.status) rec.status = d.status; else if (rec.status === 'ready') rec.status = 'checking'; saveRec(rec); }
      var back = R.ref + (R.k ? '?k=' + encodeURIComponent(R.k) : ''), withdrawn = d && d.withdrawn;
      endRevise(); u.closeModal(); u.track('revise_sent', { changes: ch.length }); u.go('trip', back);
      u.toast(withdrawn ? 'Changes sent. The crew will check it again.' : d && d.unchanged ? 'That\'s the trip the crew already has.' : 'Changes sent. The crew will check this version.');
    }
    if (!reviseEndpoint()) return setTimeout(function () { done({}); }, 400);
    u.timed(reviseEndpoint(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, 30000)
      .then(function (res) { return res.json().catch(function () { return {}; }).then(function (d) { if (!res.ok || d.ok === false) { var e = new Error(d.error || ('Something went wrong (' + res.status + ')')); e.locked = !!d.locked; throw e; } return d; }); })
      .then(done)
      .catch(function (e) { show(e.message + (e.locked ? '' : ' Nothing was sent. Try again, or message the crew' + (C.CREW_EMAIL ? ' at ' + C.CREW_EMAIL : '') + '.')); });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act="reviseCancel"]'); if (!b || !A.revise) return;
    var back = A.revise.ref + (A.revise.k ? '?k=' + encodeURIComponent(A.revise.k) : '');
    endRevise(); u.go('trip', back); u.toast('Discarded. The trip the crew has is as it was.');
  });

  /* ---------- how to pay the rest ---------- */
  // options: [{ plan: 'now'|'later'|'instalments', count, amount, items: [{ amount, due }] }] from the status endpoint (the rules live on the server).
  // `withDep`: this trip took a deposit, so there is already a card on file; otherwise the card is collected as part of choosing.
  function optionCopy(o, withDep) {
    var first = o.items[0];
    if (o.plan === 'now') return { t: 'Pay it all now', big: usd(o.amount), d: 'One payment today, and you\'re fully paid up.', go: 'Pay ' + usd(o.amount) + ' now' };
    if (o.plan === 'later') return withDep
      ? { t: 'Pay on ' + fmtDay(first.due), big: usd(o.amount), d: 'You\'re booked today. We charge the card you paid your deposit with, a week before you leave, and email you a reminder first.', go: 'Book my trip' }
      : { t: 'Pay on ' + fmtDay(first.due), big: usd(o.amount), d: 'You\'re booked once you\'ve added a card. Nothing is charged today: we charge it a week before you leave, and email you a reminder first.', go: 'Add a card and book' };
    return { t: 'Pay in ' + o.count + ' instalments', big: usd(first.amount) + ' today', d: 'Then ' + o.items.slice(1).map(function (i) { return usd(i.amount) + ' on ' + fmtDay(i.due); }).join(', ') + '. Charged to the card you ' + (withDep ? 'paid your deposit with' : 'pay the first one with') + ', and the last one lands before the final week.', go: 'Pay ' + usd(first.amount) + ' and book' };
  }
  function payPickerHTML(x) {
    var opts = (x.pay && x.pay.options) || [];
    if (!opts.length) return '';
    var sel = x._sel || opts[0].plan, withDep = !!(x.deposit && x.deposit.amount), what = withDep ? 'How would you like to pay the rest?' : 'How would you like to pay?';
    return '<fieldset class="paypick" role="radiogroup" aria-label="' + what + '"><legend class="over">' + what + '</legend>' + opts.map(function (o) {
      var c = optionCopy(o, withDep); return '<label class="payopt' + (sel === o.plan ? ' payopt--on' : '') + '"><input type="radio" name="payplan" value="' + esc(o.plan) + '"' + (sel === o.plan ? ' checked' : '') + '><span class="payopt__b"><b>' + esc(c.t) + '</b><em>' + esc(c.big) + '</em><small>' + esc(c.d) + '</small></span></label>';
    }).join('') + '</fieldset>' +
      '<p class="fine">' + (withDep ? 'Your ' + usd(x.deposit.amount) + ' deposit is already counted. ' : '') + 'Every payment is a secure Stripe payment, and you can pay any of them sooner.</p>' +
      '<div class="qnav" style="margin-top:var(--s-3)"><button class="btn btn--pink btn--lg" data-act="paygo" type="button">' + esc(optionCopy(opts.filter(function (o) { return o.plan === sel; })[0] || opts[0], withDep).go) + '</button></div>';
  }
  function scheduleHTML(x) {
    var sch = x.schedule || []; if (!sch.length) return '';
    var owing = x.owing || [];
    return '<div class="paysched"><div class="over">Your payments</div><ul>' + sch.map(function (i) {
      var late = owing.some(function (o) { return o.n === i.n; });
      return '<li class="' + (i.status === 'paid' ? 'paid' : late ? 'late' : '') + '"><span>' + esc(i.due === new Date().toISOString().slice(0, 10) ? 'Today' : fmtDay(i.due)) + '</span><b>' + usd(i.amount) + '</b><i>' + (i.status === 'paid' ? 'Paid' : late ? 'Needs paying' : 'Due') + '</i></li>';
    }).join('') + '</ul>' + (owing.length ? '<p class="warn warn--warn" style="margin:var(--s-3) 0"><i>!</i><span>A payment didn\'t go through. Pay it now to keep your beds, or we\'ll try the card again shortly.</span></p><button class="btn btn--pink" data-act="payowing" type="button">Pay ' + usd(owing[0].amount) + ' now</button>' : '<p class="fine">Payments after today come out of the card ' + (x.deposit && x.deposit.amount ? 'you paid your deposit with' : 'you saved with us') + '. We email a reminder a few days before each one.</p>') + '</div>';
  }

  /* ---------- status page ---------- */
  A.views.trip = function (restArg) {
    var pr = parseRef(restArg), r = pr.ref, key = pr.k;
    var root = document.getElementById('app'), rec = subs().filter(function (s) { return s.ref === r; })[0], polls = 0, wait = null, waitPlan = '', busy = false, alive = true;
    if (!key && rec && rec.key) key = rec.key;       // sent from this browser: it already has the guest's key
    try { var pg = (sessionStorage.getItem('mm-paying') || '').split(':'); if (pg[0] === r) { wait = pg[1] || 'pending_payment'; waitPlan = pg[2] || ''; } } catch (x) { /* private mode */ }
    var sel = null;
    function paint(x, note) {
      if (!x) { root.innerHTML = '<section class="quiz"><div class="wrap"><div class="qbox"><span class="over">Trip status</span><h1 class="disp">' + (C.STATUS_ENDPOINT ? 'Looking up your trip…' : 'Can\'t find that trip.') + '</h1><p class="qhelp">' + (C.STATUS_ENDPOINT ? '' : 'We can only look up trips sent from this device. If you sent one, check your confirmation email for the reference.') + '</p><div class="qnav"><button class="btn" data-go="build" type="button">Open the builder</button></div></div></div></section>' + u.footer(); return; }
      var waiting = wait && x.status === wait;
      var demo = !C.LEAD_ENDPOINT || x.demo, dep = x.deposit || {}, bal = x.balance || {}, depMode = !!(dep.amount);
      // booked through the pay-your-way screen (a plan and a schedule), with or without a deposit
      var hasPlan = !!(x.plan || (x.schedule && x.schedule.length));
      var titles = { pending_payment: waiting ? 'Confirming your payment…' : 'Deposit not paid yet.', submitted: 'It\'s with the crew.', checking: 'A human is checking it.', ready: waiting ? (waitPlan === 'later' ? 'Saving your card…' : 'Confirming your payment…') : 'Ready for your OK.', approved: depMode || hasPlan ? 'You\'re booked.' : 'You\'re all set.', declined: 'We need to tweak it.' };
      x._sel = sel; var ready = x.status === 'ready' && !waiting;
      root.innerHTML = '<section class="quiz"><div class="wrap"><div class="qbox"><span class="over">Trip ' + esc(x.ref) + '</span><h1 class="disp">' + (titles[x.status] || titles.submitted) + '</h1><p class="qhelp">' + esc(x.route) + ' · ' + (Math.round(+x.days) || 0) + ' days' + (x.start ? ' · from ' + esc(fmtDay(x.start)) : '') + '. Every trip is checked by a real person before you pay' + (depMode ? ' the rest' : ' anything') + '.</p>' +
        (x.status === 'declined' || x.status === 'approved' ? '' : stepsHTML(x.status, depMode)) +
        (x.status === 'pending_payment' && !waiting ? '<div class="humans" style="margin-top:0"><b>Your trip is saved.</b> Pay the ' + usd(dep.amount) + ' deposit to send it to the crew and hold your beds.</div>' : '') +
        (dep.paid && x.status !== 'declined' && x.status !== 'approved' ? '<div class="humans" style="margin-top:0"><b>Deposit paid: ' + usd(dep.amount) + '.</b> It comes off your trip total.</div>' : '') +
        (x.status === 'declined' ? '<div class="humans" style="margin-top:0"><b>Don\'t worry.</b> A crew member couldn\'t make this exact trip work and wants to find you a better one. ' + (dep.refunded ? 'Your ' + usd(dep.amount) + ' deposit has been refunded to your card. ' : '') + (note ? '' : 'They\'ll be in touch.') + '</div>' : '') +
        (note ? '<div class="humans" style="margin-top:0"><b>From the crew:</b> ' + esc(note) + '</div>' : '') +
        (ready && bal.amount ? '<div class="humans" style="margin-top:0;background:var(--lime)"><b>' + (depMode ? 'The rest to pay: ' : 'To pay: ') + usd(bal.amount) + '.</b> ' + (depMode ? 'Your deposit is already taken off.' : x.pay ? 'Choose how to pay below to lock in your beds.' : 'Pay it to lock in your beds.') + '</div>' : '') +
        (ready && x.pay ? payPickerHTML(x) : '') +
        (ready && !x.pay && (depMode || x.canPay) && !demo ? '<div class="humans" style="margin-top:0"><b>Choose how to pay.</b> Open this page from the button in the "your trip is checked" email we sent you, so we know it\'s you. Can\'t find it? Message the crew and we\'ll resend it.</div>' : '') +
        (x.status === 'approved' && bal.paid ? '<div class="humans" style="margin-top:0;background:var(--lime)"><b>Paid in full.</b> Your beds are locked in. See you out there.</div>' : '') +
        (x.status === 'approved' && !bal.paid && (depMode || hasPlan) ? '<div class="humans" style="margin-top:0;background:var(--lime)"><b>You\'re booked.</b> Your beds are locked in. The rest is paid the way you chose, below.</div>' : '') +
        (x.status === 'approved' ? scheduleHTML(x) : '') +
        (x.hold && (x.status === 'submitted' || x.status === 'checking') ? '<div class="humans" style="background:var(--yellow)"><b>Beds held</b> until ' + fmtDT(x.hold.until) + ' while we check it.</div>' : '') +
        changeHTML(x, demo) +
        (['submitted', 'checking', 'ready', 'approved'].indexOf(x.status) > -1 ? '<div class="humans humans--ask" style="margin-top:0"><span><b>Not sure where you\'re heading after this?</b> Decide once you\'re there. Come back, log in with your email, and we\'ll remember where you\'ve been, so we never suggest it twice.</span><button class="btn btn--sm btn--pink" type="button" data-act="nextstage" data-ref="' + esc(x.ref) + '">Plan my next stage</button></div>' : '') +
        '<div class="qnav"><a class="btn" href="' + esc(u.url(x.link) || '#/build') + '">Open my trip</a>' + (x.status === 'declined' ? '' : '<a class="btn btn--paper" href="' + esc(String(u.url(x.link) || '#/build').replace('#/build/', '#/pack/')) + '">Open my trip pack</a>') +
        (x.status === 'pending_payment' && x.payLink && !waiting ? '<a class="btn btn--pink" href="' + esc(u.url(x.payLink, true)) + '">Pay ' + usd(dep.amount) + ' deposit</a>' : '') +
        (C.WHATSAPP && x.status !== 'pending_payment' ? '<a class="btn btn--paper" href="https://wa.me/' + C.WHATSAPP + '?text=' + encodeURIComponent('Hi Mad Monkey, it\'s about my trip ' + x.ref + ': ' + x.route + '. ' + u.baseUrl() + '#/trip/' + x.ref) + '" target="_blank" rel="noopener">' + esc(u.askLabel()) + ' on WhatsApp</a>' : '') +
        (ready && demo && !x.pay ? '<button class="btn btn--pink" data-act="approve" type="button">Approve plan</button>' : '') + '</div>' +
        '<p class="qerr warn" id="payerr" style="display:none;margin-top:var(--s-3)" role="alert"><i>!</i><span></span></p>' +
        (demo ? '<div class="demo" style="margin-top:var(--s-5)">DEMO: move it along to see each state. <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">' + steps().map(function (s) { return '<button class="chip" data-act="demostatus" data-s="' + s.k + '" type="button">' + s.t + '</button>'; }).join('') + '</div></div>' : '') +
        '</div></div></section>' + u.footer();
    }
    // Changing the trip they sent: possible until it's booked.
    function changeHTML(x, demo) {
      var can = demo ? EDITABLE.indexOf(x.status) > -1 : !!x.canEdit;
      if (x.status === 'approved') return '<div class="humans" style="margin-top:0"><b>Want to change something?</b> Your trip is booked, so message the crew and we\'ll sort it with you.</div>';
      if (x.status === 'declined' || x.status === 'pending_payment' && !demo && !x.canEdit) return '';
      if (can) return '<div class="humans" style="margin-top:0"><b>Changed your mind about something?</b> Edit your trip and send your changes. They replace this version, so the crew only ever checks your latest plan.' + (x.status === 'ready' ? ' They\'ve already approved this one, so they\'ll check the new one and send you a new price.' : '') + ' <button class="btn btn--sm btn--pink" data-act="reviseStart" type="button" style="margin-top:8px">Change my trip</button></div>';
      return EDITABLE.indexOf(x.status) > -1 ? '<div class="humans" style="margin-top:0"><b>Want to change your trip?</b> Open this page from the link in your confirmation email, so we know it\'s you.</div>' : '';
    }
    function fetchStatus() {
      if (!C.STATUS_ENDPOINT) return;
      fetch(C.STATUS_ENDPOINT + (C.STATUS_ENDPOINT.indexOf('?') > -1 ? '&' : '?') + 'ref=' + encodeURIComponent(r) + (key ? '&k=' + encodeURIComponent(key) : '')).then(function (res) { return res.json(); }).then(function (d) {
        if (!alive) return;                     // they have moved on to another screen: don't draw this one over it
        if (!d || !d.status) { var h = root.querySelector('.disp'); if (!rec && h) h.textContent = 'Can\'t find that trip.'; return; }
        rec = Object.assign(rec || {}, { ref: r, key: key || (rec && rec.key) || '', canEdit: !!d.canEdit, people: d.people || (rec && rec.people) || 1, datesFlex: d.datesFlex || (rec && rec.datesFlex) || '', status: d.status, route: d.route || (rec && rec.route) || '', days: d.days || (rec && rec.days) || 0, start: d.start || '', link: d.link || (rec && rec.link) || '#/build',
          payLink: d.payLink || '', hold: d.hold ? { until: d.hold.until } : null, deposit: d.deposit || {}, balance: d.balance || {}, pay: d.pay || null, canPay: !!d.canPay, schedule: d.schedule || [], owing: d.owing || [], plan: d.plan || null, demo: false });
        saveRec(Object.assign({}, rec, { pay: null, schedule: [], owing: [] }));
        // Back from Stripe before the payment webhook has landed: check again for up to 30 seconds.
        if (wait && d.status === wait && polls++ < 10) setTimeout(fetchStatus, 3000);
        else if (wait && (d.status !== wait || polls >= 10)) { wait = null; try { sessionStorage.removeItem('mm-paying'); } catch (x) { /* ignore */ } }
        paint(rec, d.note);
      }).catch(function () { /* keep the local view */ });
    }
    function perr(msg) { var e = $('#payerr', root); if (e) { e.style.display = msg ? 'grid' : 'none'; if (msg) $('span', e).textContent = msg; } }
    function choose(plan, label) {
      if (busy) return; busy = true; perr(''); var b = root.querySelector('[data-act="paygo"],[data-act="payowing"]'), txt = b && b.textContent; if (b) { b.disabled = true; b.textContent = 'One moment…'; }
      u.timed(payEndpoint(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ref: r, k: key, plan: plan }) }, 30000)
        .then(function (res) { return res.json().catch(function () { return {}; }).then(function (d) { if (!res.ok || d.ok === false) throw new Error(d.error || 'Something went wrong. Try again.'); return d; }); })
        .then(function (d) {
          if (d.checkoutUrl) { try { sessionStorage.setItem('mm-paying', r + ':' + (rec.status || 'ready') + ':' + (/^[a-z]{1,12}$/.test(plan) ? plan : '')); } catch (x) { /* ignore */ } if (u.url(d.checkoutUrl, true)) { window.location.href = u.url(d.checkoutUrl, true); return; } throw new Error('Something went wrong. Try again.'); }
          busy = false; wait = null; fetchStatus(); u.toast(d.booked ? 'You\'re booked' : 'Done');
        }).catch(function (e) { busy = false; if (b) { b.disabled = false; b.textContent = txt; } perr(e.message); });
    }
    paint(rec);
    fetchStatus();
    // One set of listeners per visit, removed when the screen changes (the router calls A._unwatch), so reopening this page never stacks them.
    function onChange(e) { var t = e.target; if (t && t.name === 'payplan') { sel = t.value; if (rec) paint(rec, ''); var chk = root.querySelector('input[name="payplan"]:checked'); if (chk) chk.focus(); } }
    function onClick(e) {
      var b = e.target.closest('[data-act]'); if (!b || !rec) return; var act = b.getAttribute('data-act');
      if (act === 'demostatus') { rec.status = b.getAttribute('data-s'); saveRec(rec); paint(rec, rec.status === 'ready' ? 'Everything checks out. Here\'s your confirmed plan: have a look and change what you like.' : ''); }
      if (act === 'approve') { u.toast('Demo: choosing how to pay would open here'); }
      if (act === 'reviseStart') startRevise(rec, key);
      if (act === 'paygo') { var chk = root.querySelector('input[name="payplan"]:checked'); choose(chk ? chk.value : (rec.pay && rec.pay.options[0].plan)); }
      if (act === 'payowing') choose('due');
    }
    root.addEventListener('change', onChange); root.addEventListener('click', onClick);
    A._unwatch = function () { alive = false; root.removeEventListener('change', onChange); root.removeEventListener('click', onClick); };
  };

  A.review = { open: open };
})();
