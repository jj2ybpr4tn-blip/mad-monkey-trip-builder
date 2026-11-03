/* Find your crew on a backend without the bundled console (the ALL IN site): a guest's answers on the crew review page, and the board at #/crewfind
   (password, matches, the ask-first and intro messages, saving where an introduction is, switching someone off, hostile text). Against a stubbed
   trip-builder-admin (actions view, crew-list, crew-intro, crew-off), so nothing leaves the page.
   Run it in a browser tab on the builder:   await import('/test/ui-crewboard.js?' + Date.now()); await __crewboard()
   (serve the folder with `npm start`, open http://localhost:8000). It reports { clean: true, checked: N } or what was wrong. */
(function () {
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function words(el) { return ((el && el.textContent) || '').replace(/\s+/g, ' '); }
  window.__crewboard = async function () {
    var A = window.MMApp, C = window.MM_CONFIG, problems = [], checked = 0, seq = 0;
    var saved = { crew: C.CREW_ENDPOINT, confirm: window.confirm }, realFetch = window.fetch, posted = [], answer = null;
    window.fetch = function (u, o) {
      if (!/__stub/.test(String(u))) return realFetch(u, o);
      var body = o && o.body ? JSON.parse(o.body) : {}; posted.push(body);
      var a = typeof answer === 'function' ? answer(body) : answer, status = (a && a.__status) || 200;
      return Promise.resolve(new Response(JSON.stringify(a || {}), { status: status, headers: { 'Content-Type': 'application/json' } }));
    };
    function expect(label, cond, extra) { checked++; if (!cond) problems.push(label + (extra ? '  -> ' + extra : '')); }
    function page() { return words(document.getElementById('app')); }
    var app = function () { return document.getElementById('app'); };
    var PW = 'test-only-password';
    // three travellers: two crossing in Siquijor and Panglao (one with hostile text in every field a guest types), one leaving later on another route
    var crew = function (x) { return Object.assign({ on: true, consent: true, adult: true, age: '22-25', gender: 'woman', home: 'UK', life: ['gap-year'], vibes: ['islands'], about: '', want: { who: 'anyone', ages: 'near', solo: false } }, x); };
    var T = [
      { ref: 'MM-AAAA22', name: 'Ava Stone', party_size: 1, contact_via: 'email', email: 'ava@example.com', whatsapp: null, route: 'Siquijor → Panglao', start_date: '2027-03-01', days: 7, trip_link: 'https://madmonkeyhostels.com/all-in-trips/trip-builder/#/build/i=s.siquijor.3~s.panglao.3&d=2027-03-01', find_crew: crew({ about: 'Quit finance. Here for sunsets.' }) },
      { ref: 'MM-BBBB22', name: '<img src=x onerror=alert(1)> Bea', party_size: 1, contact_via: 'whatsapp', email: '', whatsapp: '+44 7700 900123', route: 'Siquijor → Panglao', start_date: '2027-03-02', days: 7, trip_link: 'https://madmonkeyhostels.com/all-in-trips/trip-builder/#/build/i=s.siquijor.3~s.panglao.3&d=2027-03-02',
        find_crew: crew({ home: '<b>NZ</b>', about: '<script>alert(1)</script> "hi"', gender: 'robot', life: ['gap-year', 'hacker'], want: { who: 'women', ages: 'near', solo: false } }) },
      { ref: 'MM-CCCC22', name: 'Cal Reed', party_size: 2, contact_via: 'email', email: 'cal@example.com', whatsapp: null, route: 'Hanoi', start_date: '2027-06-01', days: 4, trip_link: 'https://madmonkeyhostels.com/all-in-trips/trip-builder/#/build/i=s.hanoi.3&d=2027-06-01', find_crew: crew({ gender: 'man', age: '30-35' }) },
      { ref: 'MM-DDDD22', name: 'Off Person', party_size: 1, contact_via: 'email', email: 'off@example.com', route: 'Siquijor', start_date: '2027-03-01', days: 4, trip_link: 'https://madmonkeyhostels.com/all-in-trips/trip-builder/#/build/i=s.siquijor.3&d=2027-03-01', find_crew: { on: false } }
    ];
    function board(body) {
      if (body.password !== PW) return { __status: 401, ok: false, error: 'Unauthorized' };
      if (body.action === 'crew-list') return { ok: true, travellers: T, intros: [{ a: 'MM-BBBB22', b: 'MM-AAAA22', status: 'asked', by: 'Jo', at: '2026-11-02T10:00:00Z' }] };
      return { ok: true };
    }
    try {
      C.CREW_ENDPOINT = '/__stub/trip-builder-admin';
      try { sessionStorage.removeItem('mm-crew-pw'); localStorage.removeItem('mm-who'); } catch (e) { /* ignore */ }

      /* ---- the crew review page: their answers, cleaned ---- */
      answer = { ok: true, canAct: true, rev: 0, suggestedBalance: 500, request: { ref: 'MM-BBBB22', status: 'submitted', name: 'Bea Hart', contact_via: 'email', email: 'bea@example.com', party_size: 1, dates_flex: 'fixed', start_date: '2027-03-02', route: 'Siquijor → Panglao', days: 7,
        trip_link: T[1].trip_link, deposit_amount: 0, created_at: '2026-11-03T10:00:00Z', pay_schedule: [], find_crew: T[1].find_crew } };
      location.hash = '#/crew/MM-BBBB22?k=x&t=' + (seq++); await wait(1600);
      var box = words(document.querySelector('.cbox--find'));
      expect('review page: a "Find your crew: on" box with what they asked for', /Find your crew: on/.test(box) && /Wants to meet anyone, around their age/.test(box) && /22–25/.test(box) && /Gap year/.test(box), box.slice(0, 200));
      expect('review page: only known values survive ("robot", "hacker" dropped, so "women only" from someone who isn\'t a woman reads "anyone")', !/robot|hacker|women only/.test(box), box);
      expect('review page: what they typed is plain text: no tags, no angle brackets', !document.querySelector('.cbox--find script, .cbox--find b') && !/[<>]/.test(box) && /script alert\(1\) \/script/.test(box), box);
      var see = document.querySelector('.cbox--find a[href^="#/crewfind/"]');
      expect('review page: "See their matches" goes to the board, for this trip', !!see && see.getAttribute('href') === '#/crewfind/MM-BBBB22');
      answer.request.find_crew = null; location.hash = '#/crew/MM-BBBB22?k=x&t=' + (seq++); await wait(1400);
      expect('review page: no box when they didn\'t tick it', !document.querySelector('.cbox--find'));

      /* ---- the board: password first ---- */
      answer = board; posted.length = 0;
      location.hash = '#/crewfind'; await wait(900);
      expect('board: asks for the admin password and calls nothing until it has one', !!document.getElementById('cfpw') && !posted.length, page().slice(0, 200));
      document.getElementById('cfpw').value = 'wrong'; document.getElementById('cfin').dispatchEvent(new Event('submit', { cancelable: true })); await wait(800);
      expect('board: a wrong password says so and asks again', /That password didn't work/.test(page()) && !!document.getElementById('cfpw'));
      document.getElementById('cfpw').value = PW; document.getElementById('cfin').dispatchEvent(new Event('submit', { cancelable: true })); await wait(1200);
      var list = posted.filter(function (b) { return b.action === 'crew-list'; }).pop();
      expect('board: crew-list is called with the password', !!list && list.password === PW);
      var p = page();
      expect('board: the two in Siquijor and Panglao match, the switched-off one and the other route don\'t', /Matches/.test(p) && (p.match(/nights? together/g) || []).length === 1 && !/Off Person/.test(p), p.slice(0, 400));
      expect('board: stats count who opted in (3) and the one match', /Opted in ?3/.test(p) && /Matches ?1/.test(p), p.slice(0, 300));
      expect('board: the intro already asked shows as "Asked them both", by Jo', /Asked them both/.test(p) && /Jo,/.test(p));
      expect('board: hot spots list Siquijor', /Hot spots/.test(p) && /Siquijor/.test(p));
      expect('board: hostile text never becomes markup', !app().querySelector('img, script, b b') && /<img src=x onerror=alert\(1\)> Bea/.test(p), (app().innerHTML.match(/.{40}onerror.{20}/) || [''])[0]);
      var ask = [].slice.call(app().querySelectorAll('.cfpair__acts a'));
      var mail = ask.filter(function (a) { return /^mailto:ava%40example\.com\?/.test(a.getAttribute('href')); })[0], wa = ask.filter(function (a) { return /^https:\/\/wa\.me\/447700900123\?text=/.test(a.getAttribute('href')); })[0];
      expect('board: "Ask" opens each traveller\'s own channel (email for Ava, WhatsApp for Bea) with the message written', !!mail && !!wa, ask.map(function (a) { return a.getAttribute('href').slice(0, 40); }).join(' | '));
      expect('board: the ask-first message only shares what they agreed to', !!mail && /Want%20me%20to%20introduce%20you/.test(mail.getAttribute('href')) && !/bea%40|7700/.test(mail.getAttribute('href')));

      /* ---- signing, saving an introduction, copying it, switching someone off ---- */
      var me = document.getElementById('cfwho'); me.value = 'Ewan'; me.dispatchEvent(new Event('change')); await wait(300);
      mail = [].slice.call(app().querySelectorAll('.cfpair__acts a')).filter(function (a) { return /^mailto:/.test(a.getAttribute('href')); })[0];
      expect('board: the name typed in "I\'m…" signs the messages', !!mail && /it's Ewan from Mad Monkey/.test(decodeURIComponent(mail.getAttribute('href'))));
      var sel = app().querySelector('[data-ist="0"]'); sel.value = 'yes'; posted.length = 0;
      app().querySelector('[data-isave="0"]').click(); await wait(1200);
      var intro = posted.filter(function (b) { return b.action === 'crew-intro'; })[0];
      expect('board: Save sends crew-intro with the pair, the status, who and the password', !!intro && intro.status === 'yes' && intro.by === 'Ewan' && intro.password === PW && [intro.a, intro.b].sort().join() === 'MM-AAAA22,MM-BBBB22', JSON.stringify(intro));
      expect('board: and says so, then reloads the board', /Saved: Ava \+ /.test(page()) && posted.some(function (b) { return b.action === 'crew-list'; }));
      window.confirm = function () { return true; }; posted.length = 0;
      var off = app().querySelector('[data-off="MM-CCCC22"]'); if (off) off.click(); await wait(1200);
      var offB = posted.filter(function (b) { return b.action === 'crew-off'; })[0];
      expect('board: Switch off sends crew-off for that trip, after asking', !!offB && offB.ref === 'MM-CCCC22' && offB.password === PW && /Switched off: Cal Reed/.test(page()), JSON.stringify(offB));
      window.confirm = function () { return false; }; posted.length = 0;
      off = app().querySelector('[data-off="MM-CCCC22"]'); if (off) off.click(); await wait(400);
      expect('board: saying no to "Switch off?" sends nothing', !posted.length);

      /* ---- one traveller's matches, then locking it ---- */
      location.hash = '#/crewfind/MM-CCCC22'; await wait(1200);
      expect('board for one traveller: their name in the heading, no matches for Cal, and a way back to everyone', /Matches for Cal Reed/.test(page()) && /No matches yet/.test(page()) && !!app().querySelector('a[href="#/crewfind"]'), page().slice(0, 300));
      app().querySelector('#cfout').click(); await wait(300);
      var kept = ''; try { kept = sessionStorage.getItem('mm-crew-pw') || ''; } catch (e) { /* ignore */ }
      expect('board: "Lock the board" forgets the password and asks again', !kept && !!document.getElementById('cfpw'));
    } finally {
      window.fetch = realFetch; window.confirm = saved.confirm; C.CREW_ENDPOINT = saved.crew;
      try { sessionStorage.removeItem('mm-crew-pw'); localStorage.removeItem('mm-who'); } catch (e) { /* ignore */ }
    }
    return problems.length ? { clean: false, checked: checked, problems: problems } : { clean: true, checked: checked };
  };
})();
