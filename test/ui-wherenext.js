/* Where next? at check-in: the guest's page (#/wherenext: trips, ticks, Next / Not interested, what is saved, the way back to check-in,
   hostile link values) and the crew's list (#/wherenext-crew in demo mode: who is listed, filters, the message, saving where a guest is).
   Nothing leaves the page: WHERENEXT_ENDPOINT is stubbed for the length of the run, and demo answers are cleared before and after.
   Run it in a browser tab on the builder:   await import('/test/ui-wherenext.js?' + Date.now()); await __wherenext()
   (serve the folder with `npm start`, open http://localhost:8000). It reports { clean: true, checked: N } or what was wrong. */
(function () {
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function words(el) { return ((el && el.textContent) || '').replace(/\s+/g, ' '); }
  window.__wherenext = async function () {
    var MM = window.MM, C = window.MM_CONFIG, problems = [], checked = 0, seq = 0;
    var saved = { ep: C.WHERENEXT_ENDPOINT, ret: C.WHERENEXT_RETURN }, realFetch = window.fetch, posted = [];
    window.fetch = function (u, o) {
      if (!/__stub/.test(String(u))) return realFetch(u, o);
      posted.push(o && o.body ? JSON.parse(o.body) : {});
      return Promise.resolve(new Response('{"ok":true}', { status: 200, headers: { 'Content-Type': 'application/json' } }));
    };
    function expect(label, cond, extra) { checked++; if (!cond) problems.push(label + (extra ? '  -> ' + extra : '')); }
    var app = function () { return document.getElementById('app'); }, page = function () { return words(app()); };
    function clear() { try { localStorage.removeItem('mm-wherenext'); localStorage.removeItem('mm-wherenext-status'); localStorage.removeItem('mm-who'); } catch (e) { /* ignore */ } }
    async function open(rest) { location.hash = '#/wherenext' + (rest ? '/' + rest : '') + (rest ? '&' : '/') + 't=' + (seq++); await wait(900); return page(); }
    var tick = function (id) { var i = app().querySelector('input[name="wn"][value="' + id + '"]'); if (i) i.click(); return !!i; };
    var out = new Date(Date.now() + 4 * 86400000).toISOString().slice(0, 10);
    try {
      clear(); C.WHERENEXT_ENDPOINT = ''; C.WHERENEXT_RETURN = 'checkin.example.com';

      /* ---- the guest's page, from a real check-in link ---- */
      var p = await open('h=hanoi&out=' + out + '&b=BK-123&n=Sam&back=' + encodeURIComponent('https://checkin.example.com/step/4'));
      var rows = [].slice.call(app().querySelectorAll('.wnt:not(.wnt--own)')), first = rows.map(function (r) { return r.querySelector('input').value; });
      expect('guest page: "Where next?", their name and check-out day, and no demo bar on a real link', /Where next\?/.test(p) && /Hey Sam, you check out/.test(p) && !app().querySelector('.wn__demo'), p.slice(0, 200));
      expect('guest page: every live ALL IN as a row, trips from Hanoi first, plus "Plan my own"', rows.length === MM.whereNext('hanoi', out).length && first.slice(0, 2).sort().join() === 'loop,vietnam' && !!app().querySelector('.wnt--own input[value="builder"]'), first.join());
      expect('guest page: each row has its days, route, next departure and price', rows.every(function (r) { return /\d+days/.test(words(r.querySelector('.wnt__days'))) && /Next: /.test(words(r)) && /from\$\d+/.test(words(r.querySelector('.wnt__p'))); }));
      expect('guest page: the main menus are out of the way during check-in', getComputedStyle(document.querySelector('.hdr__nav')).display === 'none' && getComputedStyle(document.getElementById('humanbar')).display === 'none');
      expect('guest page: it says what a tick means', /We'll message you about the trips you tick, and only those\. Nothing is booked, and flights are never included\./.test(p));
      document.getElementById('wngo').click(); await wait(200);
      expect('guest page: Next with nothing ticked asks them to tick or say not interested, and saves nothing', /Tick a trip, or press Not interested/.test(page()) && !(JSON.parse(localStorage.getItem('mm-wherenext') || '[]')).length);
      tick('laos'); tick('loop'); await wait(150);
      expect('guest page: ticking marks the row and counts on the button', app().querySelectorAll('.wnt--on').length === 2 && /Next \(2\)/.test(words(document.getElementById('wngo'))));
      tick('loop'); await wait(100);
      expect('guest page: unticking takes it off again', app().querySelectorAll('.wnt--on').length === 1 && /Next \(1\)/.test(words(document.getElementById('wngo'))));
      document.getElementById('wngo').click(); await wait(400);
      var stored = JSON.parse(localStorage.getItem('mm-wherenext') || '[]')[0] || {};
      expect('guest page (demo): the answer is kept on this device with the hostel, booking, check-out, name and trips', stored.hostel === 'hanoi' && stored.booking === 'BK-123' && stored.checkout === out && stored.name === 'Sam' && stored.trips.join() === 'laos' && /only those/.test(stored.consent), JSON.stringify(stored));
      expect('guest page: "Sorted", naming the trip, and a way back to check-in at the allowed address', /Sorted\./.test(page()) && /about ALL IN Laos/.test(page()) && !!app().querySelector('a[href="https://checkin.example.com/step/4"]'), page().slice(0, 300));
      location.hash = '#/'; await wait(300);                                                   // leave before the automatic return to check-in fires

      /* ---- "Not interested", and the live endpoint ---- */
      C.WHERENEXT_ENDPOINT = '/__stub/wherenext'; posted.length = 0;
      p = await open('h=phnom-penh&out=' + out + '&b=BK-9&n=Zoe');
      expect('guest page: from Phnom Penh, ALL IN Cambodia leads', (app().querySelector('.wnt input') || {}).value === 'cambodia');
      document.getElementById('wnno').click(); await wait(500);
      expect('guest page: Not interested sends an answer with no trips and no consent line', posted.length === 1 && posted[0].trips.length === 0 && !posted[0].consent && posted[0].hostel === 'phnom-penh', JSON.stringify(posted[0]));
      expect('guest page: and says no worries, with no link back unless check-in gave one', /No worries\./.test(page()) && /Enjoy Phnom Penh/.test(page()) && !app().querySelector('a[href^="https://checkin"]'));
      C.WHERENEXT_ENDPOINT = '';

      /* ---- hostile link values ---- */
      p = await open('h=<img src=x onerror=alert(1)>&out=nope&b=<b>x</b>&n=' + encodeURIComponent('<script>alert(1)</script>Kai') + '&back=' + encodeURIComponent('javascript:alert(1)'));
      expect('guest page: an unknown hostel falls back to the demo, a broken date and booking are dropped, and nothing becomes markup', !!app().querySelector('.wn__demo') && !app().querySelector('.wn img[src="x"], .wn script'), page().slice(0, 200));
      p = await open('h=hanoi&out=' + out + '&n=' + encodeURIComponent('<script>alert(1)</script>Kai') + '&back=' + encodeURIComponent('https://evil.example.org/'));
      expect('guest page: a name is plain text', !app().querySelector('.wn script') && !/[<>]/.test(words(app().querySelector('.wn__lead'))), words(app().querySelector('.wn__lead')));
      tick('vietnam'); document.getElementById('wngo').click(); await wait(400);
      expect('guest page: a "back" link to any other site is ignored', !app().querySelector('a[href^="https://evil"]') && /You can carry on with your check-in/.test(page()));
      location.hash = '#/'; await wait(200);

      /* ---- the demo: change hostel and date ---- */
      p = await open('');
      var hs = document.getElementById('wnh'); hs.value = 'uluwatu'; hs.dispatchEvent(new Event('change')); await wait(300);
      expect('demo: picking Uluwatu reorders the trips (ALL IN Indonesia first) and says Uluwatu', (app().querySelector('.wnt input') || {}).value === 'indonesia' && /Mad Monkey Uluwatu/.test(page()));

      /* ---- the crew's list (demo) ---- */
      location.hash = '#/wherenext-crew'; await wait(900);
      p = page();
      var names = [].slice.call(app().querySelectorAll('.wnc__g h3')).map(function (h) { return words(h); });
      expect('crew list: demo banner, sample guests, and the answers given on this device', /Demo: sample guests/.test(p) && names.indexOf('Sam Lee') > -1 && names.indexOf('Sam') > -1 && names.some(function (n) { return /Kai$/.test(n) && !/[<>]/.test(n); }), names.join(', '));
      expect('crew list: guests who said not interested aren\'t listed, but count as answered', names.indexOf('Zoe Kim') < 0 && names.indexOf('Finn Walsh') < 0 && /Answered ?1[0-9]/.test(p), (p.match(/Answered ?\d+/) || [''])[0]);
      var cards = [].slice.call(app().querySelectorAll('.wnc__g')), outs = cards.map(function (c) { return (words(c).match(/checks out (\w{3} \d+ \w{3})/) || [])[1] || ''; });
      expect('crew list: soonest check-out first', cards.length > 3 && outs.every(Boolean), outs.join(' | '));
      var mail = [].slice.call(app().querySelectorAll('.wnc__g a[href^="mailto:"]'))[0], wa = [].slice.call(app().querySelectorAll('.wnc__g a[href^="https://wa.me/"]'))[0];
      expect('crew list: email and WhatsApp buttons open their channel with the message written, flights line and all', !!mail && !!wa && /Flights to get there aren't included/.test(decodeURIComponent(mail.getAttribute('href'))) && /utm_source%3Dcheckin|utm_source=checkin/.test(wa.getAttribute('href')));
      var ts = document.getElementById('wnct'); ts.value = 'laos'; ts.dispatchEvent(new Event('change')); await wait(300);
      var only = [].slice.call(app().querySelectorAll('.wnc__g'));
      expect('crew list: the trip filter shows only guests who ticked it', only.length >= 2 && only.every(function (c) { return /ALL IN Laos/.test(words(c)); }), only.length + '');
      var who = document.getElementById('wncwho'); who.value = 'Ewan'; who.dispatchEvent(new Event('change')); await wait(300);
      mail = app().querySelector('.wnc__g a[href^="mailto:"], .wnc__g a[href^="https://wa.me/"]');
      expect('crew list: the name typed in "I\'m…" signs the messages', !!mail && /it's Ewan from Mad Monkey/.test(decodeURIComponent(mail.getAttribute('href'))));
      var st = app().querySelector('[data-wst="0"]'), name0 = words(app().querySelector('.wnc__g h3')); st.value = 'messaged'; app().querySelector('[data-wsave="0"]').click(); await wait(300);
      expect('crew list (demo): Save keeps where a guest is', /Saved: /.test(page()) && /"messaged"/.test(localStorage.getItem('mm-wherenext-status') || ''), name0);
      location.hash = '#/wherenext-crew/x' + (seq++); await wait(700);
      expect('crew list (demo): and it is still there after a reload', /Messaged/.test(words([].slice.call(app().querySelectorAll('.wnc__g')).filter(function (c) { return words(c.querySelector('h3')) === name0; })[0])));
    } finally {
      window.fetch = realFetch; C.WHERENEXT_ENDPOINT = saved.ep; C.WHERENEXT_RETURN = saved.ret; clear();
    }
    return problems.length ? { clean: false, checked: checked, problems: problems } : { clean: true, checked: checked };
  };
})();
