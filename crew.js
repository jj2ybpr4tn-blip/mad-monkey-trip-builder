/* ============================================================
   CREW SUMMARY: everything a human needs to review a trip, as one plain
   (JSON-safe) object, plus a plain-text version of it.

   It travels inside the lead payload as `summary` and `crewText`, so the email,
   the admin tab and the crew review page all show the same thing, in the same
   order: who, the route stop by stop with the tours and the travel between,
   the money, and a short "heads up" list of things worth a second look.

     MM.crewSummary(state, plan, {people, dates})   -> summary object
     MM.crewText(summary, extra)                    -> plain text for WhatsApp / a CRM note
     MM.suggestBalance(summary, depositPaid)        -> a starting figure for the balance (crew can change it)
   ============================================================ */
(function (r) {
  var MM = r.MM = r.MM || {}, U = MM.util, P = function () { return MM.PLACES; };
  var DOWN = U.DOWN;
  function iso(d) { return d ? U.isoDate(d) : ''; }
  function nice(isoStr) { var d = U.parseDate(isoStr); return d ? U.fmtDate(d) : ''; }
  function niceY(isoStr) { var d = U.parseDate(isoStr); return d ? U.fmtDate(d) + ' ' + d.getUTCFullYear() : ''; }
  function usd(n) { return '$' + Math.round(+n || 0).toLocaleString('en-US'); }
  function clean(s) { return String(s == null ? '' : s).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(); }
  var PREFS = { balanced: 'Smart pick', cheap: 'Cheapest', fast: 'Fastest' };
  var DATES = { fixed: 'Dates are fixed', flex: 'Dates are flexible', open: 'Dates not decided' };

  MM.crewSummary = function (state, pl, ctx) {
    ctx = ctx || {}; state = state || MM.defaultState();
    var T = pl.totals, segs = pl.segs || pl.stops || [], people = Math.max(1, Math.min(8, Math.round(+ctx.people) || 1));

    // days grouped by stop, and the first day each tour lands on
    var bySeg = segs.map(function () { return []; }), tourDay = {};
    pl.days.forEach(function (d) {
      if (d.si != null && bySeg[d.si]) bySeg[d.si].push(d);
      (d.acts || []).forEach(function (a) { var k = a.id + '@' + d.si; if (!tourDay[k]) tourDay[k] = d; });
      if (d.epic) { var k2 = d.epic.id + '@' + d.si; if (!tourDay[k2]) tourDay[k2] = d; }
    });
    var cantFit = {}; (pl.unscheduled || []).forEach(function (u) { cantFit[u.act.id + '@' + u.seg] = true; });

    var stops = segs.map(function (s, si) {
      var ds = bySeg[si], stay = ds.filter(function (d) { return d.kind === 'stay' || d.kind === 'epic' || d.kind === 'block'; });
      var from = stay.length && stay[0].date ? iso(stay[0].date) : '', last = stay.length ? stay[stay.length - 1] : null;
      var to = last && last.date ? iso(U.addDays(last.date, 1)) : '';
      if (s.kind === 'allin') {
        return { kind: 'allin', id: s.trip.id, name: 'ALL IN ' + s.trip.n, nights: s.trip.days - 1, days: s.trip.days, usd: s.trip.usd, from: from, to: to,
          route: s.trip.tag, departs: DOWN[s.trip.dep], status: s.trip.status, tours: [], next: null };
      }
      var pl1 = P()[s.p], covered = 0;
      s.inline.forEach(function (a) { if (a.multi && a.multi.covers) covered += Math.max(0, a.multi.d - 1); });
      var billable = Math.max(0, s.n - covered);
      var tours = s.acts.map(function (a) {
        var at = tourDay[a.id + '@' + si];
        return { id: a.id, name: a.n, usd: a.usd == null ? null : Math.round(a.usd), est: !!a.est, payOnDay: a.usd == null, days: a.multi && a.multi.d > 1 ? a.multi.d : 1,
          includesBeds: !!(a.multi && a.multi.covers), when: a.when && a.when !== 'Every day' ? a.when : '', day: at ? at.n : 0, date: at && at.date ? iso(at.date) : '', fits: !cantFit[a.id + '@' + si] };
      });
      return { kind: 'stop', id: s.p, name: pl1.n, country: MM.COUNTRIES[pl1.c] ? MM.COUNTRIES[pl1.c].n : pl1.c, nights: s.n, from: from, to: to,
        bedUsd: pl1.bed, bedNights: billable, bedsUsd: Math.round(billable * pl1.bed), partner: !!pl1.partner, tours: tours, next: null };
    });

    pl.legs.forEach(function (l) {
      var c = l.chosen, s = stops[l.index]; if (!s) return;
      s.next = { to: P()[l.to].n, mode: c.modeLabel, hours: U.hoursLabel(c.h), usd: Math.round(l.u), overnight: !!c.ovn, date: l.date || '', pref: PREFS[c.key] || '',
        lastMinuteFare: l.fare ? { min: l.fare.min, max: l.fare.max } : null, note: l.border || '' };
    });

    // Straight from the plan's own total so it matches the builder's headline figure (the parts are each rounded, so they can differ by a dollar).
    var tripCost = T.total - T.fund;
    var budget = { beds: T.beds, tours: T.acts, transport: T.transport, allIn: T.allin, squadDiscount: T.squad, tripCost: tripCost,
      spendPerDay: +state.fund || 0, spendFund: T.fund, total: T.total, people: people, tripCostAllPeople: tripCost * people, totalAllPeople: T.total * people,
      toursPaidOnTheDay: T.payOnDay, hasEstimates: !!T.est, guestBudget: T.budget || 0, budgetLeft: T.budget ? T.budgetLeft : null };

    /* ---- heads up for the crew ---- */
    var flags = [], seen = {};
    function flag(level, text) { text = clean(text); if (!text || seen[text]) return; seen[text] = 1; flags.push({ level: level, text: text }); }
    if (state.start) {
      var inDays = Math.round((U.parseDate(state.start).getTime() - Date.now()) / 86400000);
      if (inDays <= 14) flag('warn', 'Leaves ' + (inDays <= 0 ? 'right now' : 'in ' + inDays + ' days') + '. Hold the beds today.');
      else flag('info', 'Leaves in ' + inDays + ' days.');
    } else flag('info', 'No start date yet. Help them pick one so the beds can be held.');
    // The planner words some warnings for the guest. The crew reads them in the crew's voice.
    pl.warnings.forEach(function (w) {
      var t = w.m;
      if (/no Mad Monkey yet/.test(t)) { flag('warn', P()[w.p].n + ' has no Mad Monkey yet. Find them a partner hostel and confirm the bed price.'); return; }
      if (/is launching soon/.test(t)) { flag('warn', t.replace(/ is launching soon\..*$/, ' is not on sale yet.')); return; }
      flag(w.t === 'warn' ? 'warn' : 'info', t.replace(/ It still runs, pack for it\.$/, ''));
    });
    try {
      if (MM.doctor) MM.doctor(state, {}).findings.filter(function (f) { return f.sev === 'bad' || f.sev === 'warn'; }).slice(0, 5)
        .forEach(function (f) { flag(f.sev === 'bad' ? 'warn' : 'info', f.title + '. ' + f.body); });
    } catch (e) { /* the summary still works without the Doctor */ }
    try {
      if (state.start && MM.eventsFor) MM.eventsFor(pl).forEach(function (e) {
        var where = e.places && e.places.length ? ' (' + e.places.map(function (p) { return P()[p].n; }).join(', ') + ')' : '';
        flag(e.sev >= 2 ? 'warn' : 'info', e.title + ' overlaps ' + e.nights + (e.nights === 1 ? ' night' : ' nights') + where + (e.conf ? '' : ', date still a forecast') +
          '. Beds go fast.' + (e.shift ? ' Moving the trip ' + Math.abs(e.shift.days) + ' days ' + (e.shift.days > 0 ? 'later' : 'earlier') + ' avoids it.' : ''));
      });
    } catch (e2) { /* ignore */ }
    var m = pl.match && pl.match[0], allInMatch = null;
    if (m) {
      allInMatch = { id: m.trip.id, name: m.trip.n, days: m.trip.days, usd: m.trip.usd, nextDeparture: iso(m.next) };
      flag('info', 'Close to ALL IN ' + m.trip.n + ' (' + m.trip.days + ' days, ' + usd(m.trip.usd) + '). Next departure ' + nice(iso(m.next)) + '. Worth offering.');
    }
    if (state.budget && T.budgetLeft < 0) flag('warn', 'Over their own budget by ' + usd(-T.budgetLeft) + ' (they said ' + usd(state.budget) + ' per person).');
    if (T.payOnDay) flag('info', T.payOnDay + (T.payOnDay === 1 ? ' tour is' : ' tours are') + ' paid on the day, so not in the total.');
    if (T.est) flag('info', 'Some tour prices are estimates. Check them before quoting.');
    flags.sort(function (a, b) { return (a.level === 'warn' ? 0 : 1) - (b.level === 'warn' ? 0 : 1); });

    var lastDay = pl.days.length ? pl.days[pl.days.length - 1] : null;
    return { v: 1, headline: MM.routeLine(pl), days: T.days, nights: T.nights, stopCount: T.stops, km: pl.km,
      countries: pl.countries.map(function (c) { return MM.COUNTRIES[c] ? MM.COUNTRIES[c].n : c; }),
      start: state.start || '', end: lastDay && lastDay.date ? iso(lastDay.date) : '', dates: ctx.dates || '', datesLabel: DATES[ctx.dates] || '',
      people: people, pref: PREFS[state.pref] || '', crewMates: state.crew || 0, stops: stops, budget: budget, flags: flags.slice(0, 14), allInMatch: allInMatch };
  };

  // A starting figure for the balance: the trip cost for everyone, less the deposit already paid. Never their spending money.
  MM.suggestBalance = function (sum, deposit) {
    var b = sum && sum.budget; if (!b) return 0;
    return Math.max(0, Math.round(b.tripCostAllPeople - (+deposit || 0)));
  };

  MM.crewText = function (sum, x) {
    x = x || {}; var L = [], b = sum.budget;
    function rule(t) { L.push(''); L.push(t); }
    L.push('TRIP TO CHECK' + (x.ref ? ' · ' + x.ref : ''));
    var who = [x.name, sum.people > 1 ? 'party of ' + sum.people : 'travelling solo', x.from ? 'from ' + x.from : ''].filter(Boolean).join(' · ');
    if (who) L.push(who);
    if (x.contact) L.push('Contact: ' + x.contact);
    rule('THE TRIP');
    L.push(sum.headline);
    L.push(sum.days + ' days · ' + sum.nights + ' nights · ' + sum.stopCount + (sum.stopCount === 1 ? ' stop · ' : ' stops · ') + sum.countries.join(' + '));
    L.push(sum.start ? 'Dates: ' + niceY(sum.start) + (sum.end ? ' to ' + niceY(sum.end) : '') + (sum.datesLabel ? ' (' + sum.datesLabel.toLowerCase() + ')' : '') : 'Dates: not decided yet');
    if (sum.pref) L.push('Travel style: ' + sum.pref);
    rule('STOP BY STOP');
    sum.stops.forEach(function (s, i) {
      var when = s.from ? ' · ' + nice(s.from) + ' to ' + nice(s.to) : '';
      L.push('');
      if (s.kind === 'allin') { L.push((i + 1) + '. ' + s.name.toUpperCase() + ' · ' + s.days + ' days · ' + usd(s.usd) + when); if (s.route) L.push('   ' + s.route); }
      else {
        L.push((i + 1) + '. ' + s.name.toUpperCase() + ' (' + s.country + ') · ' + s.nights + (s.nights === 1 ? ' night' : ' nights') + when);
        L.push('   Bed from ' + usd(s.bedUsd) + ' a night' + (s.partner ? ' (partner hostel, price is an estimate)' : ''));
        if (!s.tours.length) L.push('   No tours picked');
        s.tours.forEach(function (t) {
          L.push('   - ' + t.name + ' · ' + (t.payOnDay ? 'pay on the day' : usd(t.usd) + (t.est ? ' (est.)' : '')) + (t.date ? ' · ' + nice(t.date) : t.day ? ' · day ' + t.day : '') + (t.fits ? '' : ' · DOES NOT FIT, needs another night'));
        });
      }
      if (s.next) L.push('   Then: ' + s.next.mode + ' to ' + s.next.to + ' · ' + s.next.hours + ' · ' + usd(s.next.usd) + (s.next.overnight ? ' · overnight' : '') + (s.next.date ? ' · ' + nice(s.next.date) : ''));
    });
    rule('MONEY (per person, US dollars)');
    L.push('Beds             ' + usd(b.beds));
    L.push('Tours            ' + usd(b.tours));
    L.push('Travel           ' + usd(b.transport));
    if (b.allIn) L.push('ALL IN trip      ' + usd(b.allIn));
    if (b.squadDiscount) L.push('Squad discount   -' + usd(-b.squadDiscount));
    L.push('Trip cost        ' + usd(b.tripCost) + (b.people > 1 ? '  (x' + b.people + ' = ' + usd(b.tripCostAllPeople) + ')' : ''));
    L.push('Spending money   ' + usd(b.spendFund) + ' (' + usd(b.spendPerDay) + ' a day, their own, not charged)');
    L.push('Estimated total  ' + usd(b.total) + (b.people > 1 ? '  (x' + b.people + ' = ' + usd(b.totalAllPeople) + ')' : ''));
    if (b.guestBudget) L.push('Their budget     ' + usd(b.guestBudget) + (b.budgetLeft >= 0 ? ' (' + usd(b.budgetLeft) + ' to spare)' : ' (over by ' + usd(-b.budgetLeft) + ')'));
    if (x.deposit) L.push('Deposit paid     ' + usd(x.deposit));
    if (sum.flags.length) { rule('HEADS UP'); sum.flags.forEach(function (f) { L.push((f.level === 'warn' ? '! ' : '- ') + f.text); }); }
    if (x.notes) { rule('THEIR NOTE'); L.push(x.notes); }
    if (x.link) { rule('OPEN IT EXACTLY AS THEY BUILT IT'); L.push(x.link); }
    return L.join('\n');
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = MM;
})(typeof window !== 'undefined' ? window : globalThis);
