/* ============================================================
   PLAN IN STAGES: carry on where you left off.
   Plan Vietnam now, decide what comes next once you're there. Come back, log in with the email you used (a link, no password), press
   "Plan my next stage", and the builder remembers where you've been: it starts from where you are, adds the journey from there,
   and never suggests a place you've already done. Each stage is its own trip for the crew to check, marked as stage 2, 3...

     MMStage.banner(state, plan)   the "Stage 2 of your journey" bar at the top of the builder
     MMStage.empty(state)          the blank sheet of a later stage: "Where next?"
     MMStage.homeStrip()           "Continue your travels" on the home page (trips sent from this device, and the log-in)

   State: the trip carries where you are (state.from) and where you've been (state.been); which stage it is, and which trip came before,
   live in MMApp.stage = { n, parent, trips: [{ ref, route, days, status, n }] } (kept in this browser; the crew gets it with the trip).
   Needs LOGIN_ENDPOINT (or STATUS_ENDPOINT, from which it is derived) to email the link; without it the log-in explains itself (demo).
   ============================================================ */
(function () {
  var A = window.MMApp, MM = window.MM, C = window.MM_CONFIG || {}, u = A.util, esc = u.esc, P = MM.PLACES, S = window.MMStage = {};
  var CAN_CONTINUE = ['submitted', 'checking', 'ready', 'approved'];

  function subs() { return u.store('mm-subs') || []; }
  function stateOf(link) { var i = String(link || '').indexOf('#/build/'); return i < 0 ? '' : String(link).slice(i + 8); }
  function uniq(a) { var o = []; a.forEach(function (x) { if (x && o.indexOf(x) < 0) o.push(x); }); return o; }
  function loginEndpoint() { return C.LOGIN_ENDPOINT || (C.STATUS_ENDPOINT ? C.STATUS_ENDPOINT.replace(/trip-builder-status/, 'trip-builder-login') : ''); }
  function chip(id) { return '<span class="beenchip">' + esc(P[id].n) + '</span>'; }
  function placeOptions(sel) {                                                    // every hostel, grouped by country
    return Object.keys(MM.COUNTRIES).map(function (c) {
      var ids = MM.PLACE_ORDER.filter(function (id) { return P[id].c === c; });
      return '<optgroup label="' + esc(MM.COUNTRIES[c].n) + '">' + ids.map(function (id) { return '<option value="' + id + '"' + (id === sel ? ' selected' : '') + '>' + esc(P[id].n) + '</option>'; }).join('') + '</optgroup>';
    }).join('');
  }
  function placeChecks(been, name) {
    return '<div class="beenpick">' + MM.PLACE_ORDER.map(function (id) {
      return '<label class="beenpick__i"><input type="checkbox" name="' + name + '" value="' + id + '"' + (been.indexOf(id) > -1 ? ' checked' : '') + '><span>' + esc(P[id].n) + '</span></label>';
    }).join('') + '</div>';
  }

  /* ---------- the bar at the top of a later stage ---------- */
  S.banner = function (s) {
    var st = A.cleanStage ? A.cleanStage(A.stage) : null, n = st ? st.n : 2, been = (s.been || []).filter(function (id) { return id !== s.from; }), earlier = st ? st.trips : [];
    return '<section class="stagebar" aria-label="Your journey"><div class="stagebar__hd"><span class="over">Stage ' + n + ' of your journey</span>' +
      '<b>' + (s.from ? 'You\'re in ' + esc(P[s.from].n) : 'We remember where you\'ve been') + '</b></div>' +
      '<p class="stagebar__been">' + (been.length || s.from ? '<span>Already been:</span> ' + (s.from ? chip(s.from) : '') + been.map(chip).join('') + ' <em>We won\'t suggest these again.</em>' : 'Tell us where you\'ve been and we\'ll leave it out of the ideas.') + '</p>' +
      '<div class="stagebar__act"><button class="btn btn--sm btn--paper" type="button" data-act="stagewhere">Change where I am</button><button class="btn btn--sm btn--paper" type="button" data-act="stagebeen">Places I\'ve been</button>' +
      earlier.map(function (t) { return '<a class="stagebar__old" href="#/trip/' + esc(t.ref) + '">Stage ' + (+t.n || 1) + ': ' + esc(t.route || t.ref) + '</a>'; }).join('') + '</div></section>';
  };

  /* ---------- the blank sheet of a later stage ---------- */
  S.empty = function (s) {
    var sg = MM.suggestNext(s), name = P[s.from].n;
    return '<div class="empty empty--stage"><h3>Where next?</h3><p>You\'re in ' + esc(name) + '. Search for somewhere, pick one of these, or let us plan it. We\'ve left out everywhere you\'ve been.</p>' +
      '<div class="row"><button class="btn btn--sm" type="button" data-act="plantoggle">Plan it for me</button></div></div>' +
      (sg.length ? '<div class="nextbar"><span class="over">Good next steps from ' + esc(name) + '</span>' + sg.map(function (x) {
        return '<button class="nextchip" data-act="addplace" data-p="' + x.id + '" type="button"><b>' + esc(P[x.id].n) + '</b> <small>' + u.hours(x.leg.h) + ' · ~' + u.money(x.leg.u) + '</small><em class="whytag">' + esc(x.why.slice(0, 2).join(' · ')) + '</em></button>';
      }).join('') + '</div>' : '');
  };

  /* ---------- starting the next stage ---------- */
  // rec is a trip this guest has sent (what the status page and the home page keep in mm-subs): its link says what they planned.
  function dossier(rec) {
    var prev = MM.decodeState(stateOf(rec.link)), pl = MM.plan(prev), places = pl.places.slice(), been = uniq((prev.been || []).concat(places)), last = places.length ? places[places.length - 1] : (prev.from || '');
    var end = pl.days.length && pl.days[pl.days.length - 1].date ? MM.util.isoDate(pl.days[pl.days.length - 1].date) : '';
    return { prev: prev, places: places, been: been, last: last, end: end, n: (rec.stage && +rec.stage.n) || 1 };
  }
  S.startNext = function (rec) {
    if (!rec || !rec.ref) return;
    var d = dossier(rec), tomorrow = MM.util.isoDate(new Date(Date.now() + 86400000));
    u.openModal('<div class="modal__hd"><div><div class="over">Stage ' + (d.n + 1) + '</div><h2 class="disp">Plan your next stage.</h2></div><button class="modal__x" data-act="close" aria-label="Close" type="button">×</button></div><div class="modal__bd">' +
      '<p class="qhelp">' + (d.places.length ? 'Stage ' + d.n + ' was ' + esc(d.places.map(function (id) { return P[id].n; }).join(' → ')) + '. ' : '') + 'We\'ll start from where you are, add the journey from there, and leave out everywhere you\'ve been. Whoever checks your plan sees all of it.</p>' +
      '<form id="nsf" novalidate><div class="form2">' +
        '<div class="field"><label for="ns-from">Where are you now?</label><div class="sel-wrap"><select class="select" id="ns-from" name="from">' + placeOptions(d.last) + '</select></div></div>' +
        '<div class="field"><label for="ns-date">When do you leave? (optional)</label><input class="input" id="ns-date" name="date" type="date" min="' + tomorrow + '" value="' + esc(d.end && d.end >= tomorrow ? d.end : '') + '"></div>' +
        '<fieldset class="full beenfs"><legend class="lbl">Anywhere else you\'ve been?</legend>' + placeChecks(d.been, 'been') + '</fieldset></div>' +
        '<p class="qerr warn" id="ns-err" role="alert" hidden></p>' +
        '<div class="qnav"><button class="btn btn--pink btn--lg" type="submit">Show me where next</button></div></form></div>', function (m) {
        m.querySelector('#nsf').addEventListener('submit', function (e) {
          e.preventDefault(); var f = e.target, from = f.from.value, err = m.querySelector('#ns-err');
          if (!P[from]) { err.textContent = 'Pick where you are now.'; err.hidden = false; return; }
          var been = uniq(Array.prototype.map.call(f.querySelectorAll('input[name=been]:checked'), function (x) { return x.value; }).concat([from]));
          var st = MM.defaultState(); st.from = from; st.been = been; st.start = f.date.value && f.date.value >= tomorrow ? f.date.value : '';
          st.pref = d.prev.pref || 'balanced'; st.fund = d.prev.fund != null ? d.prev.fund : 18; st.crew = d.prev.crew || 0;
          var prevStage = A.cleanStage ? A.cleanStage(A.stage) : null, trips = (prevStage ? prevStage.trips : []).filter(function (t) { return t.ref !== rec.ref; });
          trips.push({ ref: rec.ref, route: rec.route || '', days: rec.days || 0, status: rec.status || '', n: d.n });
          A.stage = { n: d.n + 1, parent: rec.ref, trips: trips.slice(-6) }; u.store('mm-stage', A.stage);
          u.track('stage_start', { n: A.stage.n }); u.closeModal();
          window.MMX.openState(st, 'Stage ' + A.stage.n + ': you\'re in ' + P[from].n + '. Where next?');
        });
      });
  };

  /* ---------- where I am, and where I've been ---------- */
  function openWhere() {
    var s = A.state;
    u.openModal('<div class="modal__hd"><div><div class="over">Your journey</div><h2 class="disp">Where are you now?</h2></div><button class="modal__x" data-act="close" aria-label="Close" type="button">×</button></div><div class="modal__bd">' +
      '<form id="swf"><div class="field"><label for="sw-from">I\'m in</label><div class="sel-wrap"><select class="select" id="sw-from">' + placeOptions(s.from) + '</select></div></div>' +
      '<p class="qhelp">The trip below starts from here. Where you\'ve been stays remembered.</p><div class="qnav"><button class="btn btn--pink" type="submit">Save</button></div></form></div>', function (m) {
      m.querySelector('#swf').addEventListener('submit', function (e) {
        e.preventDefault(); var id = m.querySelector('#sw-from').value; if (!P[id]) return; u.closeModal();
        A.commit(Object.assign(MM.defaultState(), JSON.parse(JSON.stringify(A.state)), { from: id, been: uniq((A.state.been || []).concat([id])), legPick: {} }), 'You\'re in ' + P[id].n + ' now');
      });
    });
  }
  function openBeen() {
    var s = A.state;
    u.openModal('<div class="modal__hd"><div><div class="over">Your journey</div><h2 class="disp">Where have you been?</h2></div><button class="modal__x" data-act="close" aria-label="Close" type="button">×</button></div><div class="modal__bd">' +
      '<form id="sbf"><p class="qhelp">Tick everywhere you\'ve already done. We won\'t suggest it again.</p><fieldset class="beenfs"><legend class="sr">Places you have been</legend>' + placeChecks(s.been || [], 'been') + '</fieldset><div class="qnav"><button class="btn btn--pink" type="submit">Save</button></div></form></div>', function (m) {
      m.querySelector('#sbf').addEventListener('submit', function (e) {
        e.preventDefault(); var been = uniq(Array.prototype.map.call(m.querySelectorAll('input[name=been]:checked'), function (x) { return x.value; }).concat(A.state.from ? [A.state.from] : [])); u.closeModal();
        A.commit(Object.assign(MM.defaultState(), JSON.parse(JSON.stringify(A.state)), { been: been }), been.length ? 'Remembered: ' + been.length + (been.length === 1 ? ' place' : ' places') : 'Cleared', true);
      });
    });
  }

  /* ---------- on the home page: your trips, and the log-in ---------- */
  function statusWord(st) { return { submitted: 'With the crew', checking: 'Being checked', ready: 'Ready for your OK', approved: 'Booked', pending_payment: 'Deposit not paid', declined: 'Needs a tweak' }[st] || 'Sent'; }
  S.homeStrip = function () {
    var list = subs().filter(function (r) { return r && r.ref && /^MM-[A-Z0-9]{6}$/.test(r.ref); }).slice(0, 3);
    return '<div class="yourtrips">' + (list.length ? '<div class="yourtrips__hd"><span class="over">Continue your travels</span><b>Trips you\'ve sent</b></div><ul>' + list.map(function (r) {
      var can = CAN_CONTINUE.indexOf(r.status) > -1;
      return '<li><div><b>' + esc(r.route || r.ref) + '</b><span>' + esc(r.ref) + ' · ' + esc(statusWord(r.status)) + (r.days ? ' · ' + (+r.days || 0) + ' days' : '') + '</span></div><span class="yourtrips__act"><a class="btn btn--sm btn--paper" href="#/trip/' + esc(r.ref) + '">Open</a>' +
        (can ? '<button class="btn btn--sm btn--pink" type="button" data-act="nextstage" data-ref="' + esc(r.ref) + '">Plan the next stage</button>' : '') + '</span></li>';
    }).join('') + '</ul>' : '<div class="yourtrips__hd"><span class="over">Already sent a trip?</span><b>Carry on where you left off</b></div><p class="yourtrips__p">Planning Vietnam now and deciding the rest once you\'re there? Come back any time, log in with your email, and we\'ll remember where you\'ve been.</p>') +
      '<button class="linkbtn yourtrips__login" type="button" data-act="login">' + (list.length ? 'Not on this device? Log in with your email' : 'Log in with your email') + '</button></div>';
  };

  /* ---------- log in: a link by email, no password ---------- */
  S.login = function () {
    u.openModal('<div class="modal__hd"><div><div class="over">Continue your travels</div><h2 class="disp">Log in.</h2></div><button class="modal__x" data-act="close" aria-label="Close" type="button">×</button></div><div class="modal__bd">' +
      '<p class="qhelp">Use the email you gave us when you sent your trip. We\'ll email you a link to it. No password, nothing to remember. From there you can change it, or plan your next stage.</p>' +
      '<form id="lgf" novalidate><div class="field"><label for="lg-email">Your email</label><input class="input" id="lg-email" name="email" type="email" autocomplete="email" inputmode="email" required></div>' +
      '<div style="display:none"><label>Leave empty <input name="website" tabindex="-1" autocomplete="off"></label></div>' +
      '<p class="qerr warn" id="lg-msg" role="status" hidden></p><div class="qnav"><button class="btn btn--pink btn--lg" id="lg-go" type="submit">Email me my link</button></div></form></div>', function (m) {
      var f = m.querySelector('#lgf'), msg = m.querySelector('#lg-msg'), go = m.querySelector('#lg-go');
      function say(t, ok) { msg.textContent = t; msg.hidden = false; msg.className = 'qerr ' + (ok ? 'ok' : 'warn'); }
      f.addEventListener('submit', function (e) {
        e.preventDefault(); var email = f.email.value.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return say('That email doesn\'t look right.', false);
        if (f.website.value) return say('Check your email in a minute.', true);
        if (!loginEndpoint()) return say('Demo: on the live site we email you a link to your trips. Here, the trips sent from this device are on the home page.', true);
        go.disabled = true; go.textContent = 'Sending…';
        u.timed(loginEndpoint(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email }) }, 20000)
          .then(function (res) { return res.json().catch(function () { return {}; }).then(function (d) { return { ok: res.ok, status: res.status, d: d }; }); })
          .then(function (r) {
            go.disabled = false; go.textContent = 'Email me my link'; u.track('login_request', { ok: r.ok });
            if (r.status === 429) return say('That\'s a few tries. Check your email, or ' + (u.askLabel ? u.askLabel() : 'ask us') + '.', false);
            if (!r.ok) return say('Couldn\'t send that. Try again in a minute, or ' + (u.askLabel ? u.askLabel() : 'ask us') + '.', false);
            say('If there\'s a trip for that email, a link is on its way. It can take a minute, and check your spam folder.', true);
          }).catch(function () { go.disabled = false; go.textContent = 'Email me my link'; say('Couldn\'t send that. Check your connection and try again.', false); });
      });
    });
  };

  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-act]'); if (!b) return; var act = b.getAttribute('data-act');
    if (act === 'nextstage') { var ref = b.getAttribute('data-ref'), rec = subs().filter(function (r) { return r.ref === ref; })[0]; if (rec) S.startNext(rec); else u.toast('Open that trip first, then plan the next stage.'); }
    else if (act === 'stagewhere') openWhere();
    else if (act === 'stagebeen') openBeen();
    else if (act === 'login') S.login();
  });
})();
