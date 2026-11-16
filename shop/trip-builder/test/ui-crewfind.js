/* "Find your crew" test: the opt-in on the send form, what it sends, and what the guest sees afterwards. It drives the form against a stubbed backend.
   Run it in a browser tab on the builder:   await import('/test/ui-crewfind.js?' + Date.now()); await __findcrew()
   (serve the folder with `npm start`, open http://localhost:8000). Nothing leaves the page: the endpoints are stubbed for the length of the run.
   It reports { clean: true, checked: N } or what was wrong. */
(function () {
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function words(el) { return ((el && el.textContent) || '').replace(/\s+/g, ' '); }
  window.__findcrew = async function () {
    var A = window.MMApp, C = window.MM_CONFIG, problems = [], checked = 0;
    var saved = { lead: C.LEAD_ENDPOINT, status: C.STATUS_ENDPOINT, crew: C.FIND_CREW, dep: C.DEPOSIT_PER_PERSON };
    var realFetch = window.fetch, posted = [], answer = {}, seq = 0;
    window.fetch = function (u, o) {
      if (!/__stub/.test(String(u))) return realFetch(u, o);
      posted.push({ url: String(u), body: o && o.body ? JSON.parse(o.body) : null });
      return Promise.resolve(new Response(JSON.stringify(typeof answer === 'function' ? answer(String(u)) : answer), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    };
    function expect(label, cond, extra) { checked++; if (!cond) problems.push(label + (extra ? '  -> ' + extra : '')); }
    function modal() { return document.getElementById('modal-root'); }
    async function openForm() {
      location.hash = '#/build/i=s.siquijor.3~s.panglao.3&d=2027-02-05&t=' + (seq++); await wait(1400);
      var b = document.querySelector('[data-act="lead"]'); if (b) b.click(); await wait(500);
      return document.querySelector('#leadf');
    }
    function close() { var x = document.querySelector('#modal-root [data-act="close"]'); if (x) x.click(); return wait(250); }
    function fillBasics(f) {
      document.querySelector('#lf-name').value = 'Ellie';
      var em = f.querySelector('[data-via="email"][role="radio"]'); if (em) em.click();
      f.querySelector('input[name=email]').value = 'ellie@example.com'; f.querySelector('input[name=consent]').checked = true;
    }
    function send(f) { f.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })); return wait(700); }
    function err() { var e = document.querySelector('#leaderr'); return e && e.style.display !== 'none' ? words(e) : ''; }
    try {
      C.DEPOSIT_PER_PERSON = 0;
      try { localStorage.removeItem('mm-subs'); } catch (e) { /* ignore */ }

      /* ---- live, with a backend that doesn't keep it: not offered at all ---- */
      C.LEAD_ENDPOINT = '/__stub/lead'; C.STATUS_ENDPOINT = '/__stub/status'; C.FIND_CREW = false;
      await openForm();
      expect('with a live backend that does not keep it, the form does not offer Find your crew', !document.querySelector('#modal-root .fcrew'));
      await close();

      /* ---- live, with a backend that keeps it ---- */
      C.FIND_CREW = true;
      var f = await openForm(), m = modal();
      expect('switched on, the form offers Find your crew', !!m.querySelector('.fcrew') && /Find your crew\./.test(words(m.querySelector('.fcrew__on'))));
      expect('it is off until they tick it, and its questions are hidden', !m.querySelector('#fc-on').checked && m.querySelector('#fc-body').hidden);
      expect('it says a real person asks both of them first', /asks you both first, and only introduces you if you both say yes/.test(words(m.querySelector('.fcrew__on'))));
      expect('it never says "single" (this is not a dating app)', !/\bsingle\b/i.test(words(m.querySelector('.fcrew'))));

      // left off: nothing about it is sent
      fillBasics(f); answer = { ref: 'MM-CREW01', status: 'submitted', key: 'k1' }; posted.length = 0; await send(f);
      var plain = posted.filter(function (p) { return /__stub\/lead/.test(p.url); })[0];
      expect('left unticked, the trip is sent with no Find your crew answers', plain && !('findCrew' in plain.body), plain && JSON.stringify(Object.keys(plain.body)));
      expect('... and the confirmation does not mention it', !m.querySelector('.fcrew__note'));
      await close();

      // ticked: the questions appear and the checks hold
      f = await openForm(); m = modal(); fillBasics(f);
      var on = m.querySelector('#fc-on'); on.click(); await wait(150);
      expect('ticking it shows the questions and says so to screen readers', !m.querySelector('#fc-body').hidden && on.getAttribute('aria-expanded') === 'true');
      await send(f); expect('without an age it stops and says why', /pick your age/.test(err()), err());
      var age = m.querySelector('#fc-age'); age.value = '22-25';
      await send(f); expect('without the 18+ box it stops and says why', /18 or over/.test(err()), err());
      var who = m.querySelector('#fc-who'), gender = m.querySelector('#fc-gender');
      expect('"Women only" is not offered until they say they are a woman (and "Prefer not to say" is the default)', who.querySelector('option[value=women]').disabled && gender.value === '');
      gender.value = 'woman'; gender.dispatchEvent(new Event('change', { bubbles: true }));
      expect('... then it is', !who.querySelector('option[value=women]').disabled);
      who.value = 'women';
      gender.value = 'man'; gender.dispatchEvent(new Event('change', { bubbles: true }));
      expect('changing to "a man" takes "women only" away again', who.value === 'anyone' && who.querySelector('option[value=women]').disabled);
      gender.value = 'woman'; gender.dispatchEvent(new Event('change', { bubbles: true })); who.value = 'women';
      var life = m.querySelectorAll('[data-pick="fc_life"] .chip'); [0, 4, 6, 1].forEach(function (i) { life[i].click(); }); await wait(100);
      expect('only three "where you\'re at" picks stick', f.querySelector('input[name=fc_life]').value === 'gap-year,quit-job,remote' && life[1].getAttribute('aria-pressed') === 'false', f.querySelector('input[name=fc_life]').value);
      life[4].click(); life[1].click(); await wait(50);
      expect('a pick can be taken back, freeing a place', f.querySelector('input[name=fc_life]').value === 'gap-year,uni-break,remote', f.querySelector('input[name=fc_life]').value);
      m.querySelectorAll('[data-pick="fc_vibes"] .chip')[0].click();
      m.querySelector('#fc-home').value = 'UK'; m.querySelector('#fc-about').value = 'Just quit finance <b>here</b> for sunsets';
      f.querySelector('input[name=fc_solo]').checked = true; f.querySelector('input[name=fc_ok]').checked = true;
      answer = { ref: 'MM-CREW02', status: 'submitted', key: 'k2' }; posted.length = 0; await send(f);
      var sent = posted.filter(function (p) { return /__stub\/lead/.test(p.url); })[0], fc = sent && sent.body.findCrew;
      expect('ticked and filled in, it goes with the trip', fc && fc.on === true && fc.age === '22-25' && fc.gender === 'woman' && fc.home === 'UK' && fc.want.who === 'women' && fc.want.solo === true && fc.want.ages === 'near' && fc.consent === true && fc.adult === true, JSON.stringify(fc));
      expect('... with only the picks they made, and their line as plain text', fc && fc.life.join() === 'gap-year,uni-break,remote' && fc.vibes.join() === 'party' && fc.about.indexOf('<') < 0, JSON.stringify(fc));
      expect('the confirmation says it is on and nothing is shared until both say yes', /Find your crew is on/.test(words(m.querySelector('.fcrew__note'))) && /Nothing is shared until you've both said yes/.test(words(m.querySelector('.fcrew__note'))));
      var rec = (JSON.parse(localStorage.getItem('mm-subs') || '[]')[0]) || {};
      expect('the sent trip remembers it is on', rec.ref === 'MM-CREW02' && rec.crew === true, JSON.stringify(rec));
      await close();

      // the trip page says it is on, with a person to ask to switch it off
      answer = function (u) { return /status/.test(u) ? { ref: 'MM-CREW02', status: 'checking', route: 'Siquijor → Panglao', days: 7, link: '#/build/i=s.siquijor.3', findCrew: true } : {}; };
      location.hash = '#/trip/MM-CREW02'; await wait(1300);
      var line = Array.prototype.filter.call(document.querySelectorAll('#app .humans'), function (x) { return /Find your crew is on/.test(words(x)); })[0];
      expect('the trip page says Find your crew is on, and how to switch it off', !!line && /switch it off/.test(words(line)) && !!line.querySelector('a,button'), line && words(line));

      /* ---- demo mode (no backend): offered, so it can be tried ---- */
      C.LEAD_ENDPOINT = ''; C.STATUS_ENDPOINT = ''; C.FIND_CREW = false;
      f = await openForm(); m = modal();
      expect('in demo mode it is offered', !!m.querySelector('.fcrew'));
      fillBasics(f); m.querySelector('#fc-on').click(); m.querySelector('#fc-age').value = '26-29'; f.querySelector('input[name=fc_ok]').checked = true;
      await send(f); await wait(400);
      expect('in demo mode the confirmation says what would happen in live mode', /In live mode/.test(words(m.querySelector('.fcrew__note'))) && A._lastLead && A._lastLead.findCrew && A._lastLead.findCrew.age === '26-29');
      await close();
    } catch (e) {
      problems.push('crashed: ' + (e && e.stack || e));
    } finally {
      window.fetch = realFetch; C.LEAD_ENDPOINT = saved.lead; C.STATUS_ENDPOINT = saved.status; C.FIND_CREW = saved.crew; C.DEPOSIT_PER_PERSON = saved.dep;
      try { localStorage.removeItem('mm-subs'); } catch (e) { /* ignore */ }
    }
    return problems.length ? { clean: false, checked: checked, problems: problems } : { clean: true, checked: checked };
  };
})();
