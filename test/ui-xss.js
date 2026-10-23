/* Hostile-data test: the crew page, the trip status page and the group page draw text that other people wrote (a guest's name, notes, tours, a mate's name).
   This feeds each of them data stuffed with markup and script, in every field, and checks nothing ever gets onto the page as anything but text.
   Run it in a browser tab on the builder:   await import('/test/ui-xss.js?' + Date.now()); await __xss()
   (serve the folder with `npm start`, open http://localhost:8000). Nothing is sent anywhere: the endpoints are stubbed for the length of the run.
   It reports { clean: true, checked: N } or the screens and fields that let something through. The page's Content-Security-Policy would stop an
   injected script from running, so this also checks the thing the policy can't: injected buttons, links and images (phishing inside a trusted page). */
(function () {
  var HOSTILE = '"><img src=x data-pwn=1 onerror=window.__pwned=1><svg data-pwn=1 onload=window.__pwned=2></svg><a data-pwn=1 href="javascript:window.__pwned=4">x</a><script data-pwn=1>window.__pwned=3</script>';
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  // every string becomes the hostile one (dates stay dates so the page still gets as far as drawing them); `numbers` turns numbers into it as well
  function poison(v, numbers) {
    if (typeof v === 'string') return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : HOSTILE;
    if (typeof v === 'number') return numbers ? HOSTILE : v;
    if (Array.isArray(v)) return v.map(function (x) { return poison(x, numbers); });
    if (v && typeof v === 'object') { var o = {}; Object.keys(v).forEach(function (k) { o[k] = poison(v[k], numbers); }); return o; }
    return v;
  }
  function scan(label, where) {
    var app = document.body, bad = Array.prototype.slice.call(app.querySelectorAll('#app [data-pwn], #app script, #app [onerror], #app [onload], #modal-root [data-pwn], #modal-root script, #humanbar [data-pwn]')), js = Array.prototype.filter.call(app.querySelectorAll('#app a[href], #app form[action], #modal-root a[href]'), function (a) { return /^\s*javascript:/i.test(a.getAttribute('href') || a.getAttribute('action') || ''); });
    var fire = window.__pwned || 0; window.__pwned = 0;
    return (bad.length || js.length || fire) ? [label + ': ' + bad.length + ' injected element(s), ' + js.length + ' javascript: link(s), script ran ' + (fire ? 'YES' : 'no') + (where ? ' (' + where + ')' : '')] : [];
  }
  window.__xss = async function () {
    var MM = window.MM, A = window.MMApp, C = window.MM_CONFIG, problems = [], checked = 0, realFetch = window.fetch, realConfirm = window.confirm, saved = { crew: C.CREW_ENDPOINT, status: C.STATUS_ENDPOINT, group: C.GROUP_ENDPOINT };
    var body = {}, seq = 0;
    window.fetch = function (u, o) { return /__stub/.test(String(u)) ? Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })) : realFetch(u, o); };
    try {
      /* ---- the crew review page ---- */
      var st = MM.decodeState('i=s.phnom-penh.4~s.siem-reap.4&d=2027-03-10&f=20&b=1500&o=saigon&v=hanoi,hoi-an,saigon'), pl = MM.plan(st), sum = MM.crewSummary(st, pl, { people: 2, stage: { n: 2, parent: 'MM-ABC234' } });
      C.CREW_ENDPOINT = '/__stub/crew';
      [false, true].forEach(function () { /* (both rounds run below) */ });
      for (var round = 0; round < 2; round++) {
        var numbers = round === 1, N = function (v) { return numbers ? HOSTILE : v; };
        var req = poison({ ref: 'MM-ABC234', status: 'checking', name: 'x', contact_via: 'email', email: 'x', whatsapp: 'x', guest_email: 'x', from_place: 'x', party_size: 2, dates_flex: 'x', start_date: '2027-02-10', route: 'x', days: 9, nights: 8, est_total_usd: 900,
          all_in_match: 'x', trip_link: 'x', itinerary: 'x', notes: 'x', campaign_ref: 'x', from_hostel: 'x', deposit_amount: 100, deposit_paid_at: '2026-10-20T10:00:00Z', hold_until: '2026-10-25T10:00:00Z', balance_amount: null, balance_url: 'x', pay_plan: 'x',
          pay_schedule: [{ n: 1, amount: 100, due: '2027-01-01', status: 'x' }], refunded_at: null, crew_note: 'x', created_at: '2026-10-20T10:00:00Z' }, numbers);
        req.trip_link = 'javascript:alert(1)'; req.balance_url = 'javascript:alert(2)';
        body = { ok: true, request: req, summary: poison(sum, numbers), suggestedBalance: N(500), canAct: true, rev: N(2),
          revision: poison({ at: '2026-10-21T10:00:00Z', note: 'x', route: 'x', days: 7, estTotalUsd: 800 }, numbers),
          original: { trip: poison({ route: 'x', days: 8, estTotalUsd: 700 }, numbers) },
          guestRevision: poison({ rev: 2, at: '2026-10-21T10:00:00Z', note: 'x', changes: ['x', 'x'], wasStatus: 'ready', was: { route: 'x', days: 7, estTotalUsd: 600, link: 'x' } }, numbers) };
        body.original.trip.link = 'javascript:alert(3)'; body.guestRevision.was.link = 'javascript:alert(4)';
        window.__pwned = 0; location.hash = '#/crew/MM-ABC234?k=x&t=' + (seq++); await wait(1500);
        problems = problems.concat(scan('crew page' + (numbers ? ' (numbers hostile)' : ''))); checked++;
        ['approve', 'decline', 'edit'].forEach(function (k) { var b = document.querySelector('.crew__act[data-crew="' + k + '"]'); if (b) b.click(); });
        await wait(300); problems = problems.concat(scan('crew page, panel open' + (numbers ? ' (numbers hostile)' : ''))); checked++;
      }

      /* ---- the trip status page, in every state ---- */
      C.STATUS_ENDPOINT = '/__stub/trip-builder-status';
      var statuses = ['pending_payment', 'submitted', 'checking', 'ready', 'approved', 'declined'];
      for (var si = 0; si < statuses.length; si++) for (var nn = 0; nn < 2; nn++) {
        var nh = nn === 1, M = function (v) { return nh ? HOSTILE : v; };
        body = { ref: 'MM-ABC234', status: statuses[si], route: HOSTILE, days: M(9), start: '2027-02-10', link: 'javascript:alert(1)', note: HOSTILE, payLink: 'javascript:alert(2)', hold: { until: HOSTILE }, deposit: { amount: M(100), paid: true, refunded: false },
          balance: { amount: M(500), paid: false }, keyed: true, canEdit: true, rev: M(2), people: M(2), datesFlex: HOSTILE,
          pay: { balance: M(500), daysToGo: 100, options: [{ plan: HOSTILE, count: M(3), amount: M(500), items: [{ amount: M(125), due: HOSTILE }, { amount: M(125), due: HOSTILE }, { amount: M(125), due: HOSTILE }] }, { plan: 'now', count: 1, amount: M(500), items: [{ amount: M(500), due: '2026-10-23' }] }] },
          plan: HOSTILE, schedule: [{ n: 1, amount: M(125), due: HOSTILE, status: HOSTILE }, { n: 2, amount: M(125), due: '2026-12-01', status: 'pending' }], owing: [{ n: 1, amount: M(125), due: HOSTILE }] };
        window.__pwned = 0; try { localStorage.removeItem('mm-subs'); } catch (e) { /* ignore */ }
        location.hash = '#/trip/MM-ABC234?k=zz&t=' + (seq++); await wait(1400);
        problems = problems.concat(scan('status page, ' + statuses[si] + (nh ? ' (numbers hostile)' : ''))); checked++;
      }

      /* ---- the group page: names and votes written on other people's phones ---- */
      C.GROUP_ENDPOINT = '';
      var gid = 'xss' + Date.now().toString(36), g = { id: gid, trip: 'i=s.hanoi.3~s.hoi-an.3', alt: 'i=s.saigon.2~s.hoi-an.3', organiser: { id: 'o1', name: HOSTILE }, created: new Date().toISOString(),
        members: [{ id: 'm1', name: HOSTILE, in: true, votes: { route: 'a', 'i:hanoi': 'y', 'i:hoi-an': HOSTILE }, wants: ['p:saigon', 'a:' + HOSTILE, 'p:' + HOSTILE], trip: 'i=s.hanoi.2' }, { id: 'm2', name: HOSTILE, in: false, votes: {}, wants: [], trip: HOSTILE }] };
      localStorage.setItem('mm-group-' + gid, JSON.stringify(g)); localStorage.setItem('mm-me-' + gid, 'm1');
      window.__pwned = 0; location.hash = '#/group/' + gid + '?t=' + (seq++); await wait(1500);
      problems = problems.concat(scan('group page, as a mate')); checked++;
      localStorage.setItem('mm-org-' + gid, 'o1'); location.hash = '#/group/' + gid + '?t=' + (seq++); await wait(1500);
      problems = problems.concat(scan('group page, as the organiser')); checked++;
      localStorage.removeItem('mm-group-' + gid); localStorage.removeItem('mm-me-' + gid); localStorage.removeItem('mm-org-' + gid);

      /* ---- the home page's list of sent trips, the stage bar and the log-in: drawn from what this browser stored ---- */
      var keepSubs = localStorage.getItem('mm-subs'), keepStage = localStorage.getItem('mm-stage');
      localStorage.setItem('mm-subs', JSON.stringify([{ ref: 'MM-ABC234', status: 'checking', route: HOSTILE, days: HOSTILE, key: 'k', link: HOSTILE, name: HOSTILE, stage: { n: HOSTILE, parent: HOSTILE } }, { ref: HOSTILE, status: HOSTILE, route: HOSTILE }]));
      window.__pwned = 0; location.hash = '#/quiz'; await wait(300); location.hash = '#/'; await wait(1300);
      problems = problems.concat(scan('home page, trips sent from this device')); checked++;
      var nb = document.querySelector('[data-act="nextstage"]'); if (nb) { nb.click(); await wait(600); problems = problems.concat(scan('next-stage form')); checked++; var cl = document.querySelector('#modal-root [data-act="close"]'); if (cl) cl.click(); await wait(300); }
      var lg = document.querySelector('[data-act="login"]'); if (lg) { lg.click(); await wait(500); problems = problems.concat(scan('log-in form')); checked++; var cl2 = document.querySelector('#modal-root [data-act="close"]'); if (cl2) cl2.click(); await wait(300); }
      A.stage = { n: HOSTILE, parent: HOSTILE, trips: [{ ref: HOSTILE, route: HOSTILE, days: HOSTILE, status: HOSTILE, n: HOSTILE }] };
      location.hash = '#/build/i=s.phnom-penh.3&o=saigon&v=hanoi,hoi-an,saigon'; await wait(1500);
      problems = problems.concat(scan('a later stage in the builder (stage bar, where next)')); checked++;
      A.stage = null; if (keepSubs === null) localStorage.removeItem('mm-subs'); else localStorage.setItem('mm-subs', keepSubs); if (keepStage === null) localStorage.removeItem('mm-stage'); else localStorage.setItem('mm-stage', keepStage);
    } finally {
      window.fetch = realFetch; window.confirm = realConfirm; C.CREW_ENDPOINT = saved.crew; C.STATUS_ENDPOINT = saved.status; C.GROUP_ENDPOINT = saved.group;
    }
    return problems.length ? { clean: false, checked: checked, problems: problems } : { clean: true, checked: checked };
  };
})();
