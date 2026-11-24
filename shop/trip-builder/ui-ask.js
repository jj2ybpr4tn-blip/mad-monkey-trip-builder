/* ============================================================
   ASK EWAN: one button on every screen, a short form behind it.
   A guest asks a real person anything: their name, ONE way to reply (an email or a WhatsApp number, in one box) and the
   question. With a trip on screen it goes along: the trip they're building, or the reference of a trip they sent.
   It goes to the crew backend the way a trip does (MM_CONFIG.ASK_ENDPOINT, else LEAD_ENDPOINT), so it lands in Admin and the
   crew is emailed at once. Nothing opens the guest's own email app, and no personal number or address is in these files. Since
   24 Nov the ALL IN business WhatsApp (MM_CONFIG.WHATSAPP) is a link under the form for anyone who'd rather message. The payload is MM.askPayload (extras.js); the ALL IN site sends the very same thing from its own pages.
     • who it names is MM_CONFIG.ASK_NAME ("Ask Ewan"), so the button changes in one place when the team grows
     • on a phone it's a button that stays in the corner (above the price bar when there is one); on a laptop it sits in the
       ALL IN site's bar, or in the "real human" line under the builder's own header
     • demo mode (no endpoint): it says so, shows what the crew would get, and sends nothing
   ============================================================ */
(function () {
  'use strict';
  var A = window.MMApp, MM = window.MM, C = window.MM_CONFIG || {};
  if (!A || !A.util || !MM || !MM.askPayload) return;
  var u = A.util, esc = u.esc, $ = u.$;

  function endpoint() { return String(C.ASK_ENDPOINT || C.LEAD_ENDPOINT || ''); }
  // the business WhatsApp as a wa.me link, with the trip they're on in the first line when there is one ('' when there's no number)
  function waHref(ctx, extra) {
    var n = String(C.WHATSAPP || '').replace(/\D/g, ''); if (n.length < 8) return '';
    var t = 'Hi ' + who() + ', I\u2019ve got a question about ' + (ctx && ctx.tripName ? ctx.tripName : 'a trip') + '.' + (extra ? ' ' + extra : '');
    return 'https://wa.me/' + n + '?text=' + encodeURIComponent(t);
  }
  function label() { return u.askLabel(); }
  function who() { return label().replace(/^Ask /, ''); }

  // what the guest is looking at: a trip they sent, the trip they're building, or nothing in particular
  function context() {
    var m = /#\/trip\/(MM-[A-Z0-9]{6})/.exec(location.hash);
    if (m) return { ref: m[1], chip: 'Your trip ' + m[1], tripName: 'Trip ' + m[1], page: 'Trip builder: the page for trip ' + m[1] };
    var pl = u.getPlan && u.getPlan(), s = A.state;
    if (A.view === 'build' && s && s.items && s.items.length && pl && pl.totals && pl.totals.days) {
      var meta = A.allinMeta ? A.allinMeta() : null, name = meta && meta.name ? meta.name : '';
      var line = MM.routeLine(pl) + ' · ' + u.plural(pl.totals.days, 'day');
      return { plan: pl, state: s, chip: (name ? name + ': ' : '') + line, tripName: name || 'their trip in the builder', tripLine: line, allin: meta, page: 'Trip builder' };
    }
    var where = { home: 'the ideas page', quiz: 'the quiz', build: 'an empty map' }[A.view] || '';
    return { page: 'Trip builder' + (where ? ', ' + where : '') };
  }

  var ERR = {
    empty: 'Add an email or a WhatsApp number so we can reply.',
    email: 'That email doesn\'t look right. Check it and try again.',
    whatsapp: 'That number doesn\'t look right. Add the country code, like +44 7700 900123.',
    country: 'Add the country code to your number, like +44 7700 900123.',
    contact: 'Add an email, or a WhatsApp number with the country code.'
  };

  function form(ctx) {
    var q = u.store('mm-lead') || {}, reach = q.via === 'whatsapp' ? (q.whatsapp || '') : (q.email || q.whatsapp || '');
    return '<div class="modal__hd"><div><div class="over">A real person, not a bot</div><h2 class="disp">' + esc(label()) + '.</h2></div><button class="modal__x" data-act="close" aria-label="Close" type="button">×</button></div><div class="modal__bd">' +
      '<p class="askf__lead">Anything at all: a trip, dates, visas, money, whether it\'s right for you. ' + esc(who() === 'the crew' ? 'The crew read' : who() + ' reads') + ' every message and replies, usually within a day.</p>' +
      '<form id="askf" class="askf" novalidate>' +
      '<div class="field"><label for="ak-name">Your name</label><input class="input" id="ak-name" name="name" autocomplete="name" maxlength="60" required value="' + esc(q.name || '') + '"></div>' +
      '<div class="field"><label for="ak-reach">Email or WhatsApp</label><input class="input" id="ak-reach" name="reach" autocomplete="email" maxlength="200" required placeholder="Your email, or WhatsApp number" aria-describedby="ak-reach-h" value="' + esc(reach) + '"><span class="fine" id="ak-reach-h">A WhatsApp number needs its country code. We only use it to reply.</span></div>' +
      '<div class="field full"><label for="ak-msg">Your question</label><textarea class="input" id="ak-msg" name="msg" rows="4" maxlength="1500" required placeholder="Ask it like you\'d ask a mate"></textarea></div>' +
      (ctx.chip ? '<div class="askf__trip full" id="ak-trip"><span class="over">Sent with it</span><b>' + esc(ctx.chip) + '</b><button class="linkbtn" type="button" id="ak-drop">Leave it off</button></div>' : '') +
      '<div class="full" style="display:none"><label>Leave empty <input name="website" tabindex="-1" autocomplete="off"></label></div>' +
      '<div id="askerr" class="warn full" role="alert" style="display:none"><i>!</i><span></span></div>' +
      '<div class="askf__go full"><button class="btn btn--pink" type="submit">Send to ' + esc(who()) + '</button><span class="fine">Free. Nothing is booked or charged.</span></div>' +
      (waHref(ctx) ? '<p class="askf__wa full">Rather WhatsApp? <a href="' + esc(waHref(ctx)) + '" target="_blank" rel="noopener" data-wa="ask">Message us on <span class="nw">' + esc(C.WHATSAPP) + '</span></a></p>' : '') +
      (endpoint() ? '' : '<div class="demo full">DEMO MODE: nothing is sent. Set <code>ASK_ENDPOINT</code> (or <code>LEAD_ENDPOINT</code>) in config.js and this goes straight to the crew.</div>') +
      '</form></div>';
  }

  function done(rec) {
    var first = rec.name.split(/\s+/)[0], how = rec.via === 'whatsapp' ? 'on WhatsApp at ' + rec.whatsapp : 'by email at ' + rec.email;
    u.openModal('<div class="modal__hd"><div><div class="over">' + (rec.demo ? 'Demo mode' : 'Sent') + '</div><h2 class="disp">' + (rec.demo ? 'Ready to send.' : (rec.dup ? 'Already with ' : 'With ') + esc(who()) + '.') + '</h2></div><button class="modal__x" data-act="close" aria-label="Close" type="button">×</button></div><div class="modal__bd">' +
      (rec.demo ? '<div class="demo">DEMO MODE: nothing was sent. On the live site this goes straight to the crew.</div>' : '') +
      '<p class="askf__lead">' + (rec.demo ? 'This is what the crew would get from you, ' + esc(first) + '.' : (rec.dup ? 'You sent this a moment ago, so it hasn\'t gone twice. ' : 'Thanks, ' + esc(first) + '. ') + esc(who() === 'the crew' ? 'The crew reply' : who() + ' replies') + ' ' + esc(how) + ', usually within a day.') + '</p>' +
      (rec.ref ? '<p class="askf__ref">Your reference <b>' + esc(rec.ref) + '</b></p>' : '') +
      '<div class="askf__sum"><span class="over">Your question</span><p>' + esc(rec.msg) + '</p>' + (rec.chip ? '<span class="over">Sent with it</span><p>' + esc(rec.chip) + '</p>' : '') + '</div>' +
      '<div class="askf__go"><button class="btn" data-act="close" type="button">' + (A.view === 'build' && A.state.items.length ? 'Back to my trip' : 'Done') + '</button></div></div>');
  }

  function submit(e, ctx) {
    e.preventDefault();
    var f = e.target, v = {}; new FormData(f).forEach(function (val, k) { v[k] = typeof val === 'string' ? val.trim() : val; });
    var box = $('#askerr', f), say = function (msg, el) { box.style.display = 'grid'; $('span', box).textContent = msg; if (el) { el.setAttribute('aria-invalid', 'true'); el.focus(); } };
    box.style.display = 'none'; f.querySelectorAll('[aria-invalid]').forEach(function (x) { x.removeAttribute('aria-invalid'); });
    if (v.website) return;                                                        // only a bot fills the hidden box
    if (!v.name) return say('Add your name so we know who we\'re replying to.', $('#ak-name', f));
    var c = MM.askContact(v.reach); if (c.err) return say(ERR[c.err] || ERR.contact, $('#ak-reach', f));
    if (!v.msg) return say('Add your question.', $('#ak-msg', f));
    var keep = !ctx.dropped, payload = MM.askPayload({
      name: v.name, contact: v.reach, message: v.msg, page: ctx.page, source: 'trip-builder', ref: A.meta && A.meta.ref,
      plan: keep ? ctx.plan : null, state: keep ? ctx.state : null, link: keep && ctx.plan ? u.shareLink() : '', allin: keep ? ctx.allin : null,
      tripName: keep ? ctx.tripName : '', tripLine: keep ? ctx.tripLine : '', stage: A.stage ? { n: A.stage.n, parent: A.stage.parent } : null
    });
    if (!payload) return say('Something in the form didn\'t come through. Check it and try again.');
    u.store('mm-lead', Object.assign(u.store('mm-lead') || {}, { name: v.name, via: c.via, email: c.email || '', whatsapp: c.whatsapp || '' }));
    var rec = { name: payload.contact.name, via: c.via, email: c.email, whatsapp: c.whatsapp, msg: payload.question.text, chip: keep ? ctx.chip || '' : '' };
    u.track('ask', { where: A.view, trip: !!(keep && (ctx.plan || ctx.ref)) });
    if (!endpoint()) { rec.demo = true; A._lastAsk = payload; return done(rec); }
    var btn = $('button[type=submit]', f), was = btn.textContent; btn.disabled = true; btn.textContent = 'Sending…'; f.setAttribute('aria-busy', 'true');
    u.timed(endpoint(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), credentials: 'omit' }, 25000)
      .then(function (res) { return res.json().catch(function () { return {}; }).then(function (d) { if (!res.ok || !d.ref) { var x = new Error(d.error || ''); x.status = res.status; throw x; } return d; }); })
      .then(function (d) { A._lastAsk = payload; rec.ref = d.ref; rec.dup = !!d.duplicate; done(rec); })
      .catch(function (x) {
        btn.disabled = false; btn.textContent = was; f.removeAttribute('aria-busy');
        var why = x && x.status === 429 ? 'That\'s a few messages from you in the last hour. Give it a little while and try again.'
          : x && x.status >= 400 && x.status < 500 && x.message ? x.message
          : 'It didn\'t reach us (no signal, or our side is busy).';
        say(why + ' Your question is still here, so nothing is lost: try again in a minute' + (waHref(ctx) ? ', or send it on WhatsApp (the link under the form).' : '.'));
      });
  }

  A.openAsk = function () {
    var ctx = context();
    u.openModal(form(ctx), function (m) {
      var drop = $('#ak-drop', m);
      if (drop) drop.addEventListener('click', function () { ctx.dropped = true; var t = $('#ak-trip', m); if (t) t.parentNode.removeChild(t); $('#ak-msg', m).focus(); });
      $('#askf', m).addEventListener('submit', function (e) { submit(e, ctx); });
      var wa = $('a[data-wa]', m); if (wa) wa.addEventListener('click', function () { u.track('whatsapp_click', { where: A.view, placement: 'ask' }); });
      var first = !$('#ak-name', m).value ? $('#ak-name', m) : !$('#ak-reach', m).value ? $('#ak-reach', m) : $('#ak-msg', m);
      setTimeout(function () { try { first.focus(); } catch (e) { /* ignore */ } }, 30);
    });
  };

  // Every Ask button carries the name from the config. On a phone Ask sits in a bar at the bottom, next to the main button, as on the ALL IN site,
  // so it never floats over another button: on the trip itself in the trip's own bar (app.js), on every other screen in this one, with "Your trip" once there is one.
  Array.prototype.forEach.call(document.querySelectorAll('[data-ask-label]'), function (b) { b.textContent = label(); });
  if (!document.getElementById('abar')) {
    var bar = document.createElement('div');
    bar.id = 'abar'; bar.className = 'abar'; bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', 'Ask or carry on');
    bar.innerHTML = '<button class="btn btn--sm btn--paper abar__ask" type="button" data-act="ask" data-ask-label></button><button class="btn btn--sm btn--pink abar__go" id="abar-go" type="button" data-act="abargo" hidden>Your trip</button>';
    bar.querySelector('.abar__ask').textContent = label();
    document.body.appendChild(bar);
    if (A && A.syncAskBar) A.syncAskBar();
  }
  // an old link to "#ask" (or the site's "#enquire") opens the form
  function fromHash() { if (/^#(ask|enquire)$/.test(location.hash)) { try { history.replaceState(null, '', location.pathname + location.search + '#/'); } catch (e) { /* ignore */ } A.openAsk(); } }
  fromHash();
})();
