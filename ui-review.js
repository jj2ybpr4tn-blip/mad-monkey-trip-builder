/* ============================================================
   REVIEW + HOLD — "a real person checks every trip".
   Guest sends the trip for review; (optionally) beds are held while the crew checks it;
   they approve a confirmed plan before paying. This file is the guest side:
     • the "Hold my beds + get it checked" modal and confirmation
     • the trip status page  #/trip/<ref>
   Server side (your endpoint) owns the real hold, the review and the status.
   Contract: docs/LEADS.md (POST) and the optional STATUS_ENDPOINT below.
   ============================================================ */
(function () {
  var A = window.MMApp, MM = window.MM, C = window.MM_CONFIG || {}, u = A.util, esc = u.esc, $ = u.$, P = MM.PLACES;
  var STEPS = [
    { k: 'submitted', t: 'You send it', d: 'Your whole plan lands with the crew.' },
    { k: 'checking', t: 'A human checks it', d: 'A real crew member checks the routes, beds, dates and prices.' },
    { k: 'ready', t: 'You approve', d: 'You get a confirmed plan back. Change anything you like.' },
    { k: 'approved', t: 'Deposit + done', d: 'Only now do you pay. Beds locked in.' }];
  var hold = function () { return C.HOLD_HOURS || 48; };
  var subs = function () { return u.store('mm-subs') || []; };
  function ref() { var s = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', o = 'MM-'; for (var i = 0; i < 6; i++) o += s[Math.floor(Math.random() * s.length)]; return o; }
  function fmtDT(iso) { var d = new Date(iso); return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) + ', ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); }
  function stepsHTML(status) {
    var at = STEPS.map(function (s) { return s.k; }).indexOf(status);
    return '<ol class="steps">' + STEPS.map(function (s, i) { return '<li class="' + (i < at ? 'done' : i === at ? 'now' : '') + '"><i>' + (i < at ? '✓' : i + 1) + '</i><div><b>' + s.t + '</b><span>' + s.d + '</span></div></li>'; }).join('') + '</ol>';
  }

  /* ---------- the modal ---------- */
  function open() {
    var plan = u.getPlan();
    if (!plan || !plan.totals.days) { u.toast('Add a stop first'); return; }
    var q = u.store('mm-lead') || {}, hasDate = !!A.state.start;
    u.openModal('<div class="modal__hd"><div><div class="over">Checked by a human</div><h2 class="disp">Hold my beds.<br>Get it checked.</h2></div><button class="modal__x" data-act="close" aria-label="Close" type="button">×</button></div><div class="modal__bd">' +
      '<p style="font-weight:500">Nobody books this for you by robot. A <b>real Mad Monkey crew member</b> checks your whole trip before you pay a penny.</p>' + stepsHTML('submitted') +
      '<form id="leadf" novalidate><div class="form2"><div class="field"><label for="lf-name">First name</label><input class="input" id="lf-name" name="name" autocomplete="given-name" required value="' + esc(q.name || '') + '"></div>' +
      u.contactPick(q) +
      '<div class="field"><label for="lf-from">Where are you now?</label><input class="input" id="lf-from" name="from" placeholder="city or country" value="' + esc(q.from || '') + '"></div>' +
      '<div class="field"><label for="lf-size">Travelling as</label><select class="select" id="lf-size" name="size"><option value="1">Just me</option><option value="2">2 of us</option><option value="3">3 of us</option><option value="4">4 of us</option><option value="6">5–6 of us</option><option value="8">7+ of us</option></select></div>' +
      '<div class="field"><label for="lf-flex">Dates</label><select class="select" id="lf-flex" name="flex"><option value="fixed">These dates, locked</option><option value="flex">Flexible by a week or so</option><option value="open">Still deciding</option></select></div>' +
      '<label class="chk full holdbox"><input type="checkbox" name="hold"' + (hasDate ? ' checked' : ' disabled') + '><span><b>Hold my beds while you check it</b> (up to ' + hold() + ' hours). ' + (hasDate ? 'No payment now. If the crew can\'t make it work, the hold simply drops.' : 'Pick a start date in the builder first so we know which nights to hold.') + '</span></label>' +
      '<div class="field full"><label for="lf-notes">Anything the crew should know?</label><textarea class="input" id="lf-notes" name="notes" placeholder="budget worries, who you\'re bringing, must-dos…"></textarea></div>' +
      '<div class="full" style="display:none"><label>Leave empty <input name="website" tabindex="-1" autocomplete="off"></label></div>' +
      '<label class="chk full"><input type="checkbox" name="consent" required><span>It\'s OK for Mad Monkey to contact me about this trip. We only use your details to plan it with you.' + (C.PRIVACY_URL ? ' <a href="' + esc(C.PRIVACY_URL) + '" target="_blank" rel="noopener">Privacy</a>' : '') + '</span></label></div>' +
      '<div id="leaderr" class="warn" style="display:none;margin-top:var(--s-3)"><i>!</i><span></span></div>' +
      '<div style="display:flex;gap:var(--s-2);margin-top:var(--s-4);flex-wrap:wrap"><button class="btn btn--pink" type="submit">Send it for checking</button><button class="btn btn--ghost" data-act="close" type="button">Not yet</button></div></form></div>', function (m) {
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
    var plan = u.getPlan(), wantHold = !!v.hold && !!A.state.start;
    var payload = MM.leadPayload(A.state, plan, { name: v.name, via: ct.via, email: ct.email, whatsapp: ct.whatsapp, from: v.from || '', partySize: +v.size || 1, dates: v.flex, notes: v.notes || '', consent: true },
      { ref: A.meta.ref, fromHostel: A.meta.from, link: u.shareLink() });
    payload.type = 'review_request'; payload.status = 'submitted'; payload.hold = { requested: wantHold, hours: hold() };
    u.track('review_request', { stops: plan.places.length, days: plan.totals.days, hold: wantHold });
    var btn = $('button[type=submit]', f); btn.disabled = true; btn.textContent = 'Sending…';
    function done(mode, data) {
      var r = (data && data.ref) || ref(), now = new Date(), rec = { ref: r, createdAt: now.toISOString(), status: (data && data.status) || 'submitted', route: payload.trip.route, days: payload.trip.days, link: payload.trip.link,
        hold: wantHold ? { until: (data && data.hold && data.hold.until) || new Date(now.getTime() + hold() * 3600000).toISOString() } : null, demo: mode === 'demo', name: v.name, email: ct.email, whatsapp: ct.whatsapp, via: ct.via };
      var list = subs().filter(function (s) { return s.ref !== r; }); list.unshift(rec); u.store('mm-subs', list.slice(0, 20)); A._lastLead = payload; success(rec, payload);
    }
    if (!C.LEAD_ENDPOINT) return setTimeout(function () { done('demo'); }, 400);
    fetch(C.LEAD_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json().catch(function () { return {}; }); })
      .then(function (data) { done('sent', data); })
      .catch(function () { btn.disabled = false; btn.textContent = 'Send it for checking'; show('That didn\'t go through. Try again, or copy your plan and message the crew directly.'); });
  }

  function success(rec, payload) {
    var wa = C.WHATSAPP ? 'https://wa.me/' + C.WHATSAPP + '?text=' + encodeURIComponent('Hi Mad Monkey, I just sent trip ' + rec.ref + ' for checking: ' + payload.trip.route + '. ' + rec.link) : '';
    var statusUrl = u.baseUrl() + '#/trip/' + rec.ref;
    u.openModal('<div class="modal__hd"><div><div class="over">' + (rec.demo ? 'Demo mode' : 'With the crew') + '</div><h2 class="disp">' + (rec.demo ? 'Review request ready.' : 'It\'s with the crew.') + '</h2></div><button class="modal__x" data-act="close" aria-label="Close" type="button">×</button></div><div class="modal__bd">' +
      (rec.demo ? '<div class="demo">DEMO MODE: nothing was sent and no beds were held. Set <code>LEAD_ENDPOINT</code> in config.js and this goes straight to the crew.</div>' : '') +
      '<div class="refbox"><span class="over">Your reference</span><b>' + esc(rec.ref) + '</b></div>' +
      (rec.hold ? '<p style="font-weight:600">' + (rec.demo ? 'In live mode we\'d hold your beds until ' : 'We\'re holding your beds until ') + '<b>' + fmtDT(rec.hold.until) + '</b> while a real person checks the trip. No payment needed.</p>' : '') +
      stepsHTML(rec.status) +
      '<p class="fine">What happens next: a crew member reads your plan, checks the routes, beds, dates and prices, then sends you a confirmed version to approve. You only pay the deposit once you\'re happy.</p>' +
      '<div style="display:flex;gap:var(--s-2);flex-wrap:wrap"><a class="btn btn--sm" href="#/trip/' + esc(rec.ref) + '" data-act="close">Track my trip</a>' + (wa ? '<a class="btn btn--sm btn--pink" href="' + wa + '" target="_blank" rel="noopener">Message the crew on WhatsApp</a>' : '') +
      '<button class="btn btn--sm btn--paper" data-act="copylead" type="button">Copy review card</button><button class="btn btn--sm btn--ghost" data-act="close" type="button">Done</button></div><input type="hidden" id="statusurl" value="' + esc(statusUrl) + '"></div>');
  }

  /* ---------- status page ---------- */
  A.views.trip = function (r) {
    var root = document.getElementById('app'), rec = subs().filter(function (s) { return s.ref === r; })[0];
    function paint(x, note) {
      if (!x) { root.innerHTML = '<section class="quiz"><div class="wrap"><div class="qbox"><span class="over">Trip status</span><h2 class="disp">Can\'t find that trip.</h2><p class="qhelp">We can only look up trips sent from this device, or from a live crew link. If you sent one, check your confirmation email for the reference.</p><div class="qnav"><button class="btn" data-go="build" type="button">Open the builder</button></div></div></div></section>' + u.footer(); return; }
      var titles = { submitted: 'It\'s with the crew.', checking: 'A human is checking it.', ready: 'Ready for your OK.', approved: 'You\'re all set.', declined: 'We need to tweak it.' };
      var demo = !C.LEAD_ENDPOINT || x.demo;
      root.innerHTML = '<section class="quiz"><div class="wrap"><div class="qbox"><span class="over">Trip ' + esc(x.ref) + '</span><h2 class="disp">' + titles[x.status] + '</h2><p class="qhelp">' + esc(x.route) + ' · ' + x.days + ' days. Every trip is checked by a real person before you pay.</p>' +
        (x.status === 'declined' ? '' : stepsHTML(x.status)) + (x.status === 'declined' ? '<div class="humans" style="margin-top:0"><b>Don\'t worry.</b> A crew member couldn\'t make this exact trip work and wants to find you a better one. ' + (note ? '' : 'They\'ll be in touch.') + '</div>' : '') + (note ? '<div class="humans" style="margin-top:0"><b>From the crew:</b> ' + esc(note) + '</div>' : '') +
        (x.hold && x.status !== 'declined' ? '<div class="humans" style="background:var(--yellow)"><b>Beds held</b> until ' + fmtDT(x.hold.until) + ' while we check it.</div>' : '') +
        '<div class="qnav"><a class="btn" href="' + esc(x.link) + '">Open my trip</a>' + (x.status === 'declined' ? '' : '<a class="btn btn--paper" href="' + esc(String(x.link).replace('#/build/', '#/pack/')) + '">Open my trip pack</a>') + + (x.status === 'ready' ? '<button class="btn btn--pink" data-act="approve" type="button">Approve + pay deposit</button>' : '') + '</div>' +
        (demo ? '<div class="demo" style="margin-top:var(--s-5)">DEMO: move it along to see each state. <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">' + STEPS.map(function (s) { return '<button class="chip" data-act="demostatus" data-s="' + s.k + '" type="button">' + s.t + '</button>'; }).join('') + '</div></div>' : '') +
        '</div></div></section>' + u.footer();
    }
    paint(rec);
    if (C.STATUS_ENDPOINT && rec) fetch(C.STATUS_ENDPOINT + (C.STATUS_ENDPOINT.indexOf('?') > -1 ? '&' : '?') + 'ref=' + encodeURIComponent(r)).then(function (res) { return res.json(); }).then(function (d) {
      if (d && d.status) { rec.status = d.status; rec.payLink = d.payLink || ''; rec.hold = d.hold ? { until: d.hold.until } : null; rec.demo = false; var l = subs().map(function (s) { return s.ref === r ? Object.assign(s, rec) : s; }); u.store('mm-subs', l); paint(rec, d.note); }
    }).catch(function () { /* keep the local view */ });
    root.addEventListener('click', function h(e) {
      var b = e.target.closest('[data-act]'); if (!b || !rec) return; var act = b.getAttribute('data-act');
      if (act === 'demostatus') { rec.status = b.getAttribute('data-s'); u.store('mm-subs', subs().map(function (s) { return s.ref === r ? rec : s; })); paint(rec, rec.status === 'ready' ? 'Everything checks out. Here\'s your confirmed plan: have a look and change what you like.' : ''); }
      if (act === 'approve') { if (rec.payLink) window.open(rec.payLink, '_blank'); else { rec.status = 'approved'; u.store('mm-subs', subs().map(function (s) { return s.ref === r ? rec : s; })); paint(rec); u.toast(rec.demo ? 'Demo: deposit step would open here' : 'Approved. The crew will send your payment link'); } }
    });
  };

  A.review = { open: open };
})();
