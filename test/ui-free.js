/* "Free to send" test: sending a trip costs nothing, and the screens say so. It walks the send form and the trip page against a stubbed backend and checks the wording
   and what is sent, for a trip with no deposit (the default) and for one that paid a deposit (still supported behind a switch).
   Run it in a browser tab on the builder:   await import('/test/ui-free.js?' + Date.now()); await __free()
   (serve the folder with `npm start`, open http://localhost:8000). Nothing leaves the page: the endpoints are stubbed for the length of the run.
   It reports { clean: true, checked: N } or what was wrong. */
(function () {
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  // the text as written, not as the stylesheet shows it (headings and buttons are drawn in capitals)
  function words(el) { return ((el && el.textContent) || '').replace(/\s+/g, ' '); }
  window.__free = async function () {
    var MM = window.MM, A = window.MMApp, C = window.MM_CONFIG, problems = [], checked = 0;
    var saved = { lead: C.LEAD_ENDPOINT, status: C.STATUS_ENDPOINT, pay: C.PAY_ENDPOINT, dep: C.DEPOSIT_PER_PERSON, url: A.util.url };
    var realFetch = window.fetch, answer = {}, posted = [], seq = 0;
    window.fetch = function (u, o) {
      if (!/__stub/.test(String(u))) return realFetch(u, o);
      posted.push({ url: String(u), body: o && o.body ? JSON.parse(o.body) : null });
      var a = typeof answer === 'function' ? answer(String(u), o) : answer;
      return Promise.resolve(new Response(JSON.stringify(a), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    };
    function expect(label, cond, extra) { checked++; if (!cond) problems.push(label + (extra ? '  -> ' + extra : '')); }
    function page() { return words(document.getElementById('app')); }
    function modal() { return words(document.getElementById('modal-root')); }
    function sentWith(re) { return posted.filter(function (p) { return re.test(p.url); }); }
    try {
      C.LEAD_ENDPOINT = '/__stub/lead'; C.STATUS_ENDPOINT = '/__stub/trip-builder-status'; C.PAY_ENDPOINT = '/__stub/trip-builder-pay'; C.DEPOSIT_PER_PERSON = 0;
      try { localStorage.removeItem('mm-subs'); sessionStorage.removeItem('mm-paying'); } catch (e) { /* ignore */ }

      /* ---- the send form, with no deposit ---- */
      location.hash = '#/build/i=s.hanoi.4~s.hoi-an.4~s.saigon.3&d=2027-03-01&f=20&b=1500&t=' + (seq++); await wait(1500);
      var open = document.querySelector('[data-act="lead"]'); expect('the builder has a "Hold my beds" button', !!open);
      if (open) open.click(); await wait(500);
      var m = modal();
      expect('the form says sending is free', /Sending it is free/.test(m), m.slice(0, 200));
      expect('the form never mentions a deposit', !/deposit/i.test(m), (m.match(/.{30}deposit.{30}/i) || [''])[0]);
      expect('the form has no "deposit today" box', !document.querySelector('#lf-dep'));
      expect('the button says send, not pay', /Send it for checking/.test(modal()) && !/Pay \$/.test(modal()));
      expect('the steps say "Free" and "Only now do you pay"', /Free\. Your whole plan lands with the crew/.test(m) && /Only now do you pay, your way/.test(m));

      // fill it in and send: the backend answers that it is already with the crew
      var f = document.querySelector('#leadf'); document.querySelector('#lf-name').value = 'Sam';
      var em = f.querySelector('[data-via="email"][role="radio"]'); if (em) em.click();
      f.querySelector('input[name=email]').value = 'sam@example.com'; f.querySelector('input[name=consent]').checked = true;
      answer = { ref: 'MM-FREE22', status: 'submitted', key: 'guestkey1', deposit: { amount: 0, perPerson: 0, people: 1 }, hold: { until: '2027-02-28T10:00:00Z' } };
      posted.length = 0; f.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })); await wait(900);
      var sent = sentWith(/__stub\/lead/)[0];
      expect('it was sent without a deposit field', !!sent && !('deposit' in sent.body), JSON.stringify(sent && Object.keys(sent.body)));
      expect('and the confirmation says it is with the crew, with the reference', /It's with the crew/.test(modal()) && /MM-FREE22/.test(modal()), modal().slice(0, 200));
      expect('the confirmation talks about no deposit and no payment link', !/deposit|Stripe|pay \$/i.test(modal()));
      var rec = (JSON.parse(localStorage.getItem('mm-subs') || '[]')[0]) || {};
      expect('the sent trip is remembered with its key, no deposit and the status the backend gave', rec.ref === 'MM-FREE22' && rec.key === 'guestkey1' && !rec.deposit && rec.status === 'submitted', JSON.stringify(rec));
      var close = document.querySelector('#modal-root [data-act="close"]'); if (close) close.click(); await wait(300);

      // an older backend that still wants a deposit answers with a payment link: the page goes and pays it rather than saying "sent"
      location.hash = '#/build/i=s.hanoi.4~s.hoi-an.4&d=2027-03-01&t=' + (seq++); await wait(1200);
      var open2 = document.querySelector('[data-act="lead"]'); if (open2) open2.click(); await wait(500);
      var f2 = document.querySelector('#leadf'); document.querySelector('#lf-name').value = 'Sam';
      var em2 = f2.querySelector('[data-via="email"][role="radio"]'); if (em2) em2.click();
      f2.querySelector('input[name=email]').value = 'sam@example.com'; f2.querySelector('input[name=consent]').checked = true;
      answer = { ref: 'MM-OLD111', status: 'pending_payment', checkoutUrl: 'https://checkout.stripe.test/pay/cs_1', key: 'k2' };
      A.util.url = function () { return '#/trip/MM-OLD111'; };          // so "go to Stripe" is a harmless change of the address here
      f2.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })); await wait(900);
      A.util.url = saved.url;
      var paying = ''; try { paying = sessionStorage.getItem('mm-paying') || ''; } catch (e) { /* ignore */ }
      expect('a payment link in the answer is followed (the trip is not with the crew until it is paid)', /^MM-OLD111:pending_payment/.test(paying) && /#\/trip\/MM-OLD111/.test(location.hash), paying + ' ' + location.hash);
      try { sessionStorage.removeItem('mm-paying'); } catch (e) { /* ignore */ }

      /* ---- the trip page, no deposit ---- */
      function trip(extra) {
        return Object.assign({ ref: 'MM-FREE22', status: 'submitted', route: 'Hanoi → Hoi An → Ho Chi Minh City', days: 12, start: '2027-03-01', link: '#/build/i=s.hanoi.4~s.hoi-an.4~s.saigon.3', note: '', payLink: '', hold: null,
          deposit: { amount: 0, paid: false, refunded: false }, balance: { amount: null, paid: false }, keyed: true, canEdit: true, rev: 0, people: 1, datesFlex: 'fixed', pay: null, canPay: false, plan: null, schedule: [], owing: [] }, extra);
      }
      var OPTS = [{ plan: 'now', count: 1, amount: 600, items: [{ amount: 600, due: '2026-10-23' }] }, { plan: 'later', count: 1, amount: 600, items: [{ amount: 600, due: '2027-02-22' }] },
        { plan: 'instalments', count: 4, amount: 600, items: [{ amount: 150, due: '2026-10-23' }, { amount: 150, due: '2026-11-22' }, { amount: 150, due: '2026-12-22' }, { amount: 150, due: '2027-01-21' }] }];
      async function show(t, key) { answer = t; location.hash = '#/trip/MM-FREE22' + (key === false ? '' : '?k=zz') + (key === false ? '?' : '&') + 't=' + (seq++); await wait(1500); return page(); }

      var p = await show(trip({ status: 'submitted' }));
      expect('submitted: "It\'s with the crew", no deposit anywhere on the page', /It's with the crew/.test(p) && !/deposit/i.test(p), (p.match(/.{30}deposit.{30}/i) || [''])[0]);
      p = await show(trip({ status: 'checking' }));
      expect('checking: "A human is checking it", no deposit', /A human is checking it/.test(p) && !/deposit/i.test(p));

      p = await show(trip({ status: 'ready', balance: { amount: 600, paid: false }, pay: { balance: 600, daysToGo: 130, options: OPTS }, canPay: true }));
      expect('ready: the price is "To pay", not "the rest"', /To pay: \$600/.test(p) && !/The rest to pay/.test(p), p.slice(0, 300));
      expect('ready: asks how they would like to pay (not "the rest")', /How would you like to pay\?/.test(p) && !/How would you like to pay the rest/.test(p));
      expect('ready: no deposit is mentioned', !/deposit/i.test(p), (p.match(/.{30}deposit.{30}/i) || [''])[0]);
      expect('ready: the three ways to pay are there, and "later" says a card is added first', /Pay it all now/.test(p) && /Pay on /.test(p) && /Pay in 4 instalments/.test(p) && /added a card/.test(p) && /pay the first one with/.test(p));
      expect('ready: the buttons say what happens', /Pay \$600 now/.test(p) || document.querySelector('[data-act="paygo"]'));
      var later = document.querySelector('input[name="payplan"][value="later"]'); if (later) { later.click(); later.dispatchEvent(new Event('change', { bubbles: true })); await wait(300); }
      expect('choosing "later" changes the button to "Add a card and book"', /Add a card and book/.test(page()), page().slice(-300));

      // pressing it sends the plan, and a card page is where it goes next
      answer = function (u) { return /trip-builder-pay/.test(u) ? { ok: true, checkoutUrl: 'https://checkout.stripe.test/setup/cs_9', card: true, plan: 'later' } : trip({ status: 'ready', balance: { amount: 600, paid: false }, pay: { balance: 600, daysToGo: 130, options: OPTS }, canPay: true }); };
      A.util.url = function () { return '#/trip/MM-FREE22?k=zz&t=card'; };
      posted.length = 0; var go = document.querySelector('[data-act="paygo"]'); if (go) go.click(); await wait(900);
      A.util.url = saved.url;
      var pp = sentWith(/trip-builder-pay/)[0]; var mark = ''; try { mark = sessionStorage.getItem('mm-paying') || ''; } catch (e) { /* ignore */ }
      expect('the plan they chose is sent with their key', !!pp && pp.body.plan === 'later' && pp.body.ref === 'MM-FREE22' && pp.body.k === 'zz', JSON.stringify(pp && pp.body));
      expect('and the page remembers it is waiting for a card, not a payment', mark === 'MM-FREE22:ready:later', mark);
      answer = trip({ status: 'ready', balance: { amount: 600, paid: false }, pay: { balance: 600, daysToGo: 130, options: OPTS }, canPay: true });
      location.hash = '#/trip/MM-FREE22?k=zz&t=' + (seq++); await wait(1200);
      expect('back from the card page, before it is confirmed: "Saving your card…"', /Saving your card/.test(page()), page().slice(0, 200));
      try { sessionStorage.removeItem('mm-paying'); } catch (e) { /* ignore */ }

      p = await show(trip({ status: 'ready', balance: { amount: 600, paid: false }, pay: null, canPay: true }), false);
      expect('ready, without their key: told to open the link in the email (the price is waiting)', /Open this page from the button in the "your trip is checked" email/.test(p) && /To pay: \$600/.test(p), p.slice(0, 300));
      p = await show(trip({ status: 'approved', balance: { amount: 600, paid: false }, plan: 'later', schedule: [{ n: 1, amount: 600, due: '2027-02-22', status: 'pending' }] }));
      expect('booked with a card saved: "You\'re booked", the card is the one saved with us, no deposit', /You're booked/.test(p) && /saved with us/.test(p) && !/deposit/i.test(p) && /Your payments/.test(p), p.slice(0, 300));
      p = await show(trip({ status: 'approved', balance: { amount: 600, paid: true }, plan: 'now', schedule: [{ n: 1, amount: 600, due: '2026-10-23', status: 'paid' }] }));
      expect('paid in full: "Paid in full" and "You\'re booked"', /Paid in full/.test(p) && /You're booked/.test(p));
      p = await show(trip({ status: 'declined', note: 'Sorry, full that week.' }));
      expect('declined: no talk of a refund or a deposit', /We need to tweak it/.test(p) && !/refund|deposit/i.test(p));

      /* ---- a trip that DID pay a deposit (the switch is on) keeps its wording ---- */
      p = await show(trip({ status: 'ready', deposit: { amount: 100, paid: true, refunded: false }, balance: { amount: 500, paid: false }, pay: { balance: 500, daysToGo: 130, options: OPTS }, canPay: true }));
      expect('a deposit trip: "The rest to pay" with the deposit taken off', /The rest to pay: \$500/.test(p) && /Your deposit is already taken off/.test(p) && /How would you like to pay the rest\?/.test(p), p.slice(0, 300));
      expect('and its card is the one the deposit was paid with', /paid your deposit with/.test(p) && /Your \$100 deposit is already counted/.test(p));
      p = await show(trip({ status: 'approved', deposit: { amount: 100, paid: true }, balance: { amount: 500, paid: false }, plan: 'later', schedule: [{ n: 1, amount: 500, due: '2027-02-22', status: 'pending' }] }));
      expect('a deposit trip once booked: the card is the one the deposit was paid with', /You're booked/.test(p) && /paid your deposit with/.test(p), p.slice(0, 300));
      p = await show(trip({ status: 'pending_payment', deposit: { amount: 100, paid: false }, payLink: 'https://checkout.stripe.test/pay/cs_2', canEdit: true }));
      expect('a trip still waiting on its deposit says so', /Deposit not paid yet/.test(p) && /Pay \$100 deposit/.test(p), p.slice(0, 300));

      /* ---- the crew's review page: a free trip has no deposit to take off or refund ---- */
      var st = MM.decodeState('i=s.hanoi.4~s.hoi-an.4~s.saigon.3&d=2027-03-01&f=20&b=1500'), sum = MM.crewSummary(st, MM.plan(st), { people: 2 });
      var savedCrew = C.CREW_ENDPOINT; C.CREW_ENDPOINT = '/__stub/crew';
      function crewReq(extra) {
        return Object.assign({ ref: 'MM-FREE22', status: 'submitted', name: 'Sam Lee', contact_via: 'email', email: 'sam@example.com', whatsapp: null, guest_email: null, from_place: 'Leeds', party_size: 2, dates_flex: 'fixed', start_date: '2027-03-01',
          route: 'Hanoi → Hoi An → Ho Chi Minh City', days: 12, nights: 11, est_total_usd: 702, all_in_match: null, trip_link: 'https://madmonkeyhostels.com/all-in-trips/trip-builder/#/build/i=s.hanoi.4~s.hoi-an.4~s.saigon.3', itinerary: 'x', notes: '', deposit_amount: 0,
          deposit_paid_at: null, hold_until: '2027-02-28T10:00:00Z', balance_amount: null, balance_url: null, balance_paid_at: null, pay_plan: null, pay_schedule: [], refunded_at: null, crew_note: null, created_at: '2026-10-23T10:00:00Z' }, extra);
      }
      async function crew(req, suggested) { answer = { ok: true, request: req, summary: sum, suggestedBalance: suggested, canAct: true, rev: 0 }; location.hash = '#/crew/MM-FREE22?k=x&t=' + (seq++); await wait(1600); return page(); }
      p = await crew(crewReq({}), 702);
      expect('crew page, free trip: says it is free to send and nothing is paid', /None: free to send/.test(p) && /Free to send, nothing paid yet/.test(p) && /suggested price \$702/.test(p), p.slice(0, 200));
      expect('crew page, free trip: no "Deposit paid", no "less the deposit", no refund wording', !/Deposit paid|less the deposit|refund the deposit/i.test(p) && /Say no, with a reason/.test(p));
      var yes = document.querySelector('.crew__act[data-crew="approve"]'); if (yes) yes.click(); await wait(300);
      var pan = words(document.querySelector('.cpanel--yes'));
      expect('crew approve panel: asks for the price, says nothing has been paid, and never mentions a deposit', /Price to charge \(US dollars\)/.test(pan) && /They haven't paid anything yet/.test(pan) && !/deposit/i.test(pan), pan.slice(0, 300));
      var no = document.querySelector('.crew__act[data-crew="decline"]'); if (no) no.click(); await wait(300);
      expect('crew decline panel: no "refund the deposit" tick-box for a free trip', !document.querySelector('#cref'));
      p = await crew(crewReq({ deposit_amount: 100, deposit_paid_at: '2026-10-20T10:00:00Z' }), 602);
      expect('crew page, a trip that paid a deposit: still "Deposit paid" and "less the deposit"', /Deposit paid \$100/.test(p) && /less the deposit/.test(p) && /Say no and refund the deposit/.test(p), p.slice(0, 200));
      C.CREW_ENDPOINT = savedCrew;

      /* ---- the config switch: with a deposit number the form asks for it again ---- */
      C.DEPOSIT_PER_PERSON = 50;
      location.hash = '#/build/i=s.hanoi.4~s.hoi-an.4&d=2027-03-01&t=' + (seq++); await wait(1200);
      var open3 = document.querySelector('[data-act="lead"]'); if (open3) open3.click(); await wait(500);
      expect('with DEPOSIT_PER_PERSON set the form asks for the deposit again', /\$50 deposit per person/.test(modal()) && /Pay \$50 deposit/.test(modal()) && !/Sending it is free/.test(modal()), modal().slice(0, 200));
    } finally {
      window.fetch = realFetch; A.util.url = saved.url; C.LEAD_ENDPOINT = saved.lead; C.STATUS_ENDPOINT = saved.status; C.PAY_ENDPOINT = saved.pay; C.DEPOSIT_PER_PERSON = saved.dep;
      try { localStorage.removeItem('mm-subs'); sessionStorage.removeItem('mm-paying'); } catch (e) { /* ignore */ }
    }
    return problems.length ? { clean: false, checked: checked, problems: problems } : { clean: true, checked: checked };
  };
})();
