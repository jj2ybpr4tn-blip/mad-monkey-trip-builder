/* Front door test (ui-start.js, #/start): runs the whole flow the way a guest does and checks what they see.
   Run it in a browser tab on the builder:   await import('/test/ui-start.js?' + Date.now()); await __startcheck()
   (serve the folder with `npm start`, open http://localhost:8000). Takes about 30 seconds.
   Checks: a visit with no address and #/build with no trip land on the front door; "how long" has six answers in three rows of two;
   the bar counts days the way the trip page and its day by day do (3 nights in Bangkok: day 4; a sleeper bus counts its night);
   an option's name never sits on the current stop, a drawn name or another option; every colour in the vibe bar has its name;
   Hold my beds sends one request with the ALL IN site's fields (freeNight when the trip starts with ALL IN, who's coming, the dates,
   what they told the site) and needs a name, an email, a free-night answer and the tick; Copy my trip copies the share link; the full
   editor opens with the same trip. Returns { pass, fail, fails: [what failed] }. Leaves the trip saved on this device as it found it. */
(function () {
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  async function until(fn, ms) { for (var t = 0; t < (ms || 15000); t += 50) { try { if (fn()) return true; } catch (e) { /* not yet */ } await wait(50); } try { return !!fn(); } catch (e) { return false; } }
  function R() { var h = document.getElementById('tbs'); return h && h.shadowRoot; }
  function $(s) { var r = R(); return r && r.querySelector(s); }
  function $$(s) { var r = R(); return r ? Array.prototype.slice.call(r.querySelectorAll(s)) : []; }
  function hit(a, b) { return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top; }
  function shown(e) { return e.style.display !== 'none' && e.getAttribute('display') !== 'none'; }
  function closeAny() { var x = document.querySelector('.modal [data-act="close"]'); if (x) x.click(); }

  window.__startcheck = async function () {
    var pass = 0, fails = [], ok = function (c, what) { if (c) pass++; else fails.push(what); };
    var A = window.MMApp, MM = window.MM, C = window.MM_CONFIG, keep = { trip: localStorage.getItem('mm-trip'), x: localStorage.getItem('mm-start'), told: sessionStorage.getItem('allin-told'), lead: C.LEAD_ENDPOINT };
    try {
      // the front door is where the builder starts
      A.state = MM.defaultState(); location.hash = '#/build'; await until(function () { return location.hash === '#/start' && $('h1'); });
      ok(location.hash === '#/start', '#/build with no trip open goes to the front door');
      ok($('h1') && /Where does your trip start/.test($('h1').textContent), 'the front door asks where the trip starts');

      // how long: six answers, three rows of two
      $('[data-start="bangkok"]').click(); await until(function () { return $$('.week').length === 6; });
      var rows = {}; $$('.week').forEach(function (w) { var r = w.getBoundingClientRect(), k = Math.round(r.top); (rows[k] = rows[k] || []).push(r.width); });
      var rw = Object.keys(rows).map(function (k) { return rows[k]; });
      ok(rw.length === 3 && rw.every(function (r) { return r.length === 2 && Math.abs(r[0] - r[1]) < 2; }), 'how long has three rows of two, none on its own');

      // two weeks, then Bangkok for 3 nights: day 4 of 14
      $('[data-weeks="14"]').click(); await until(function () { return $('.sheet.on [data-go]'); });
      var out = $('.sheet .stepper output'); ok(out && /^3/.test(out.textContent), 'Bangkok starts at 3 nights');
      $('.sheet [data-go]').click(); await until(function () { return location.hash === '#/start/next' && $('#daysT') && $$('.card').length; }, 20000);
      ok(/Day 4 of 14/.test($('#daysT').textContent), 'the bar says day 4 of 14 after 3 nights in Bangkok (said: ' + ($('#daysT') || {}).textContent + ')');
      ok($$('.card').length === 4 && $$('.card--allin').length === 1, 'three places and the ALL IN trip that fits, as the fourth');
      await until(function () { return $$('#gmap .cpin').length >= 3; }, 8000); await wait(400);
      var svg = $('#gmap svg'), lbl = $$('#gmap .cpin .lbl').filter(shown).map(function (e) { return { n: e.textContent, r: e.getBoundingClientRect() }; });
      var names = $$('#gmap .rf-place').filter(shown).map(function (e) { return { n: e.textContent, r: e.getBoundingClientRect() }; }), here = $('#gmap .here'), bad = [];
      lbl.forEach(function (l) { names.forEach(function (n) { if (hit(l.r, n.r)) bad.push(l.n + ' on ' + n.n); }); if (here && hit(l.r, here.getBoundingClientRect())) bad.push(l.n + ' on where you are'); lbl.forEach(function (o) { if (o !== l && hit(l.r, o.r)) bad.push(l.n + ' on ' + o.n); }); });
      ok(svg && !bad.length, 'no option name sits on the current stop, a drawn name or another option' + (bad.length ? ' (' + bad.join(', ') + ')' : ''));

      // a stop with a sleeper bus before it: the day count and the day by day agree
      window.__start.openPick('chiang-mai'); await until(function () { return $('.sheet.on [data-go]'); });
      $('.sheet [data-go]').click(); await until(function () { return /Day 8 of 14/.test(($('#daysT') || {}).textContent || ''); }, 20000);
      ok(/Day 8 of 14/.test($('#daysT').textContent), 'after the sleeper bus and 3 nights in Chiang Mai it says day 8 (said: ' + $('#daysT').textContent + ')');
      await until(function () { return $('[data-act="finish"]'); }, 20000);           // the next choices (and the finish) come in once the new part of the route has drawn
      $('[data-act="finish"]').click(); await until(function () { return location.hash === '#/start/trip' && $$('.tl__d').length; });
      var days = +(/^(\d+) days/.exec($('h1').textContent) || [])[1], tl = $$('.tl__d').map(function (e) { return e.textContent; }), last = +(/(\d+)$/.exec(tl[tl.length - 1]) || [])[1];
      ok(days === 8 && last === 8, 'the trip page says 8 days and its day by day ends on day 8 (' + days + ', ' + tl.join(' / ') + ')');
      ok(tl[1] === 'Day 5 to 8', 'the night on the sleeper bus counts: Chiang Mai is day 5 to 8 (' + tl[1] + ')');
      ok($$('.vibe__bar i').length === $$('.vibe__k > span').length, 'every colour in the vibe bar has its name');
      var pct = $$('.vibe__k > span').map(function (e) { return +(/(\d+)%$/.exec(e.textContent) || [])[1]; }).reduce(function (a, b) { return a + b; }, 0);
      ok(pct === 100, 'the vibe adds up to 100% (' + pct + ')');

      // copy my trip: the existing share link
      var copied = null, real = A.util.copy; A.util.copy = function (t) { copied = t; return Promise.resolve(true); };
      $('[data-act="copy"]').click(); await wait(100); A.util.copy = real;
      ok(copied && copied.indexOf(A.util.shareLink()) > -1, 'Copy my trip copies the trip with its share link');

      // hold my beds: one request, the ALL IN site's fields, nothing missing. A trip with ALL IN in it asks about the free night first.
      sessionStorage.setItem('allin-told', JSON.stringify({ text: 'Two weeks, first time solo https://www.tiktok.com/@a/video/7', tiktok: ['https://www.tiktok.com/@a/video/7'], at: Date.now() }));
      C.LEAD_ENDPOINT = ''; A._lastLead = null;
      var cam = MM.ALL_IN.filter(function (t) { return t.id === 'cambodia'; })[0], d = new Date(Date.now() + 40 * 864e5); while (d.getUTCDay() !== cam.dep) d = new Date(d.getTime() + 864e5);
      window.__start.set([{ kind: 'allin', trip: 'cambodia' }, { kind: 'stop', p: 'kampot', n: 2, acts: [] }], 'trip', 21);
      await until(function () { return location.hash === '#/start/trip' && $('[data-act="hold"]'); });
      A.state.start = MM.util.isoDate(d); A.util.persist(); location.hash = '#/start/next'; await until(function () { return $('#daysT'); }); location.hash = '#/start/trip';
      await until(function () { return $('.tdates') && $('.tl--end'); });
      var pl0 = MM.plan(A.state), end0 = pl0.days[pl0.days.length - 1].date;
      ok(/ to /.test($('.tdates').textContent) && $('.tl--end .tl__d').textContent === MM.util.fmtDate(end0), 'the trip page shows the day it finishes (' + $('.tdates').textContent + '; ' + $('.tl--end .tl__d').textContent + ')');
      ok(/Day \d+, in /.test($('.tl--end .tl__x').textContent) && +(/Day (\d+)/.exec($('.tl--end .tl__x').textContent) || [])[1] === pl0.totals.days, 'the day by day ends with the last day, the same day the trip page counts to');
      $('[data-act="hold"]').click(); await until(function () { return $('.sheet.on [data-free]'); });
      ok($$('.sheet.on [data-free]').length === 2 && !$('.sheet.on #holdf'), 'a trip with ALL IN in it asks about the free night first, on its own');
      ok(/Mad Monkey /.test(($('#h-freed') || {}).textContent || '') && /night before you start/.test($('#h-freed').textContent), 'it says where and when the free bed is');
      $('.sheet.on [data-free="yes"]').click(); await until(function () { return $('.sheet.on #holdf'); });
      ok(!!$('#h-told'), 'what they told the ALL IN site shows, with Leave it off');
      ok(/free night before ALL IN: yes please/i.test($('.sheet.on .incl').textContent), 'the form says what they picked, with Change');
      $('#h-name').value = 'Test'; $('#h-email').value = 'not-an-email';
      $('#holdf button[type=submit]').click(); await wait(80);
      ok(/email/i.test($('#h-err').textContent), 'a bad email is caught');
      $('#h-email').value = 'test@example.com'; $('#holdf button[type=submit]').click(); await wait(80);
      ok(/Tick the box/.test($('#h-err').textContent), 'the tick is needed');
      $('#holdf input[name=consent]').click(); $('#holdf button[type=submit]').click();
      await until(function () { return A._lastLead; }, 5000); await wait(100);
      var p = A._lastLead || {};
      ok(p.type === 'review_request' && p.status === 'submitted', 'it sends a review request, the same as the editor\'s form');
      ok(p.freeNight && p.freeNight.optIn === true && p.freeNight.answered === true && p.freeNight.night === MM.util.isoDate(MM.util.addDays(d, -1)) && p.freeNight.checkOut === MM.util.isoDate(d) && p.freeNight.hostel === cam.stops[0].p && /^Mad Monkey /.test(p.freeNight.hostelName), 'freeNight says yes, for the night before, at the trip\'s first stop');
      ok(p.contact && /^FREE NIGHT BEFORE: YES/.test(p.contact.notes), 'the crew\'s notes start with the free night');
      ok(p.contact && p.contact.dates === 'fixed' && p.trip && p.trip.start === MM.util.isoDate(d) && p.hold && p.hold.requested === true, 'the dates go with it, and the beds are held');
      ok(p.contact && p.contact.partySize === 1 && /Travelling solo/.test(p.contact.notes), 'who\'s coming goes with it');
      ok(p.told && p.told.tiktok.length === 1 && /IN THEIR OWN WORDS/.test(p.crewText || ''), 'what they told the ALL IN site goes with it');
      ok(p.trip && p.trip.link && p.trip.link.indexOf('#/build/') > -1, 'the crew gets the trip\'s link');
      await until(function () { return $('.sheet.on .refbox'); }, 3000);
      ok(!!$('.sheet.on .refbox') && !!$('.sheet.on a[href^="#/trip/"]'), 'it says it\'s with the crew, with a reference and Track my trip');

      // ALL IN later in the trip: still asked, for the night before that ALL IN trip starts
      A._lastLead = null;
      window.__start.set([{ kind: 'stop', p: 'bangkok', n: 3, acts: [] }, { kind: 'allin', trip: 'cambodia' }], 'trip', 21);
      await until(function () { return location.hash === '#/start/trip' && $('[data-act="hold"]'); });
      // getting there the day before it leaves: the engine adds that free night, and the day by day still ends on the last day
      A.state.start = MM.util.isoDate(MM.util.addDays(d, -4)); A.util.persist(); location.hash = '#/start/next'; await until(function () { return $('#daysT'); }); location.hash = '#/start/trip';
      await until(function () { return $('.tl--end'); });
      var plP = MM.plan(A.state), rowsP = $$('.tl__d').map(function (e) { return e.textContent; });
      ok(plP.segs[1].pre && rowsP[1].split(' to ')[1] === rowsP[2] && rowsP[2] === MM.util.fmtDate(plP.days[plP.days.length - 1].date) && +(/Day (\d+)/.exec($('.tl--end .tl__x').textContent) || [])[1] === plP.totals.days,
        'with the free night before ALL IN, its row ends on the day the trip ends (' + rowsP.join(' / ') + ')');
      A.state.start = MM.util.isoDate(d); A.util.persist();
      var seg = MM.plan(A.state).segs[1], dep2 = seg.departs;
      $('[data-act="hold"]').click(); await until(function () { return $('.sheet.on [data-free]'); });
      ok(/night before ALL IN /.test($('#h-freed').textContent) && /Mad Monkey /.test($('#h-freed').textContent), 'ALL IN later in the trip: asked about the night before it starts');
      $('.sheet.on [data-free="no"]').click(); await until(function () { return $('.sheet.on #holdf'); });
      $('#h-name').value = 'Test'; $('#h-email').value = 'test@example.com'; $('#holdf input[name=consent]').click(); $('#holdf button[type=submit]').click();
      await until(function () { return A._lastLead; }, 5000);
      p = A._lastLead || {};
      ok(p.freeNight && p.freeNight.optIn === false && p.freeNight.answered === true && dep2 && p.freeNight.checkOut === MM.util.isoDate(dep2) && /^FREE NIGHT BEFORE: NO/.test(p.contact.notes), 'a no goes as freeNight, for the night before that ALL IN trip');

      // the full editor's own Hold form asks the same, and sends their words too
      A._lastLead = null; closeAny();
      location.hash = '#/build/' + MM.encodeState(A.state); await until(function () { return document.body.getAttribute('data-view') === 'build' && document.querySelector('.stopc'); });
      A.review.open(); await until(function () { return document.querySelector('#leadf'); });
      var F = document.querySelector('#leadf');
      ok(!!F.querySelector('#lf-free') && !!document.querySelector('#lf-told'), 'the editor\'s Hold form asks about the free night and shows what they told the site');
      F.querySelector('#lf-name').value = 'Ed'; var em = F.querySelector('.cpick [data-via="email"]'); if (em) em.click(); F.querySelector('.cpick__em').value = 'ed@example.com'; F.querySelector('input[name=consent]').click();
      F.querySelector('button[type=submit]').click(); await wait(80);
      ok(/free night/.test((document.querySelector('#leaderr span') || {}).textContent || ''), 'the editor\'s form needs the free night answer');
      F.querySelector('#lf-free input[value=yes]').click(); F.querySelector('button[type=submit]').click();
      await until(function () { return A._lastLead; }, 5000);
      p = A._lastLead || {};
      ok(p.freeNight && p.freeNight.optIn === true && /^FREE NIGHT BEFORE: YES/.test(p.contact.notes) && p.told && p.told.words, 'the editor\'s form sends freeNight and their words');
      closeAny();

      // the full editor, one tap away, with the same trip
      location.hash = '#/start/trip'; await until(function () { return $('[data-act="editor"]'); });
      var enc = MM.encodeState(A.state); $('[data-act="editor"]').click();
      await until(function () { return document.body.getAttribute('data-view') === 'build' && document.querySelector('.stopc'); });
      ok(location.hash.indexOf('#/build/') === 0 && MM.encodeState(A.state) === enc, 'Open the full editor opens this trip in the editor');
    } catch (e) { fails.push('crashed: ' + (e && e.message)); }
    // put it back as it was
    if (keep.trip == null) localStorage.removeItem('mm-trip'); else localStorage.setItem('mm-trip', keep.trip);
    if (keep.x == null) localStorage.removeItem('mm-start'); else localStorage.setItem('mm-start', keep.x);
    if (keep.told == null) sessionStorage.removeItem('allin-told'); else sessionStorage.setItem('allin-told', keep.told);
    C.LEAD_ENDPOINT = keep.lead;
    return { pass: pass, fail: fails.length, fails: fails };
  };
})();
