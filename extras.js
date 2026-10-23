/* ============================================================
   EXTRAS — the "is this trip actually a good idea?" layer. Pure logic, no DOM.
     • MM.eventsFor(plan)      festivals + closures that land on the trip, and how to dodge them
     • MM.upcomingEvents(opts) what's coming up (for undated trips and the pages for Google)
     • MM.visaCheck(plan, pp)  days in each country vs the visa-free / visa days for a passport
     • MM.doctor(state, opts)  Trip Doctor: pace, night buses, one-night stands, visa, events
     • MM.applyFix(state, fix) apply one of the doctor's one-tap fixes
     • MM.packing(plan)        a packing list built from the trip
     • MM.THEMES / themeTrip / surprise   ready-made vibes and "Surprise me"
   ============================================================ */
(function (r) {
  var MM = r.MM = r.MM || {};
  var P = function () { return MM.PLACES; }, U = function () { return MM.util; };
  var DAY = 86400000;
  function utc(y, m, d) { return new Date(Date.UTC(y, m, d)); }
  function iso(d) { return d.toISOString().slice(0, 10); }
  function pISO(s) { var p = s.split('-'); return utc(+p[0], +p[1] - 1, +p[2]); }
  function fmt(d) { return U().fmtDate(d); }
  function fmtRange(a, b) { return a.getTime() === b.getTime() ? fmt(a) : fmt(a) + ' to ' + fmt(b); }
  function ctry(p) { return P()[p] ? P()[p].c : null; }
  function plural(n, w, ws) { return n + ' ' + (n === 1 ? w : (ws || w + 's')); }

  /* ---------------- astronomy: full moons (Meeus ch. 49), shown in Thai time ---------------- */
  var rad = Math.PI / 180;
  function fullMoonJDE(k) {
    var T = k / 1236.85, T2 = T * T, T3 = T2 * T, T4 = T3 * T;
    var jde = 2451550.09766 + 29.530588861 * k + 0.00015437 * T2 - 0.00000015 * T3 + 0.00000000073 * T4;
    var E = 1 - 0.002516 * T - 0.0000074 * T2;
    var M = (2.5534 + 29.1053567 * k - 0.0000014 * T2 - 0.00000011 * T3) * rad;
    var Mp = (201.5643 + 385.81693528 * k + 0.0107582 * T2 + 0.00001238 * T3 - 0.000000058 * T4) * rad;
    var F = (160.7108 + 390.67050284 * k - 0.0016118 * T2 - 0.00000227 * T3 + 0.000000011 * T4) * rad;
    var O = (124.7746 - 1.56375588 * k + 0.0020672 * T2 + 0.00000215 * T3) * rad;
    var c = -0.40614 * Math.sin(Mp) + 0.17302 * E * Math.sin(M) + 0.01614 * Math.sin(2 * Mp) + 0.01043 * Math.sin(2 * F) + 0.00734 * E * Math.sin(Mp - M) -
      0.00515 * E * Math.sin(Mp + M) + 0.00209 * E * E * Math.sin(2 * M) - 0.00111 * Math.sin(Mp - 2 * F) - 0.00057 * Math.sin(Mp + 2 * F) + 0.00056 * E * Math.sin(2 * Mp + M) -
      0.00042 * Math.sin(3 * Mp) + 0.00042 * E * Math.sin(M + 2 * F) + 0.00038 * E * Math.sin(M - 2 * F) - 0.00024 * E * Math.sin(2 * Mp - M) - 0.00017 * Math.sin(O);
    return jde + c;
  }
  // calendar dates (Thai time) of the full moons in a year
  function fullMoons(y) {
    var out = [], k0 = Math.floor((y - 2000) * 12.3685) - 1;
    for (var k = k0; k < k0 + 16; k++) {
      var jd = fullMoonJDE(k + 0.5), ms = (jd - 2440587.5) * DAY + 7 * 3600000, d = new Date(ms);
      if (d.getUTCFullYear() === y) out.push(utc(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    }
    return out;
  }
  MM.fullMoons = fullMoons;
  function easter(y) {                                   // Anonymous Gregorian algorithm
    var a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3),
      h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
      mo = Math.floor((h + l - 7 * m + 114) / 31), dy = ((h + l - 7 * m + 114) % 31) + 1;
    return utc(y, mo - 1, dy);
  }
  MM.easter = easter;

  /* ---------------- calendar: every span of an event that touches [from, to] ---------------- */
  function spansOf(ev, from, to) {
    var out = [], y0 = from.getUTCFullYear() - 1, y1 = to.getUTCFullYear() + 1;
    ev.spans.forEach(function (s) {
      if (s.from) out.push({ from: pISO(s.from), to: pISO(s.to), conf: s.conf !== false, core: s.core });
      else if (s.fixed) {
        var parts = s.fixed.split('/'), a = parts[0].split('-'), b = parts[1].split('-');
        for (var y = y0; y <= y1; y++) { var f = utc(y, +a[0] - 1, +a[1]), t = utc(y, +b[0] - 1, +b[1]); if (t < f) t = utc(y + 1, +b[0] - 1, +b[1]); out.push({ from: f, to: t, conf: true }); }
      } else if (s.fullmoon) { for (var y2 = y0; y2 <= y1; y2++) fullMoons(y2).forEach(function (d) { out.push({ from: d, to: d, conf: true, moon: true }); }); }
      else if (s.holyweek) { for (var y3 = y0; y3 <= y1; y3++) { var e = easter(y3); out.push({ from: new Date(e.getTime() - 7 * DAY), to: new Date(e.getTime() + DAY), conf: true }); } }
    });
    return out.filter(function (s) { return s.to >= from && s.from <= to; });
  }
  function hits(ev, place) { var c = ctry(place); return !!place && ((ev.at && ev.at.indexOf(place) > -1) || (ev.c && ev.c.indexOf(c) > -1)); }

  // days = [{date: Date, loc: placeId}] already in the trip
  function overlapOf(ev, days, from, to) {
    var best = [];
    spansOf(ev, from, to).forEach(function (sp) {
      var hit = days.filter(function (d) { return d.date >= sp.from && d.date <= sp.to && hits(ev, d.loc); });
      if (hit.length) best.push({ sp: sp, days: hit });
    });
    return best;
  }
  function tripDays(pl) { return pl.days.filter(function (d) { return d.date && d.loc; }).map(function (d) { return { date: d.date, loc: d.loc }; }); }

  MM.eventsFor = function (pl) {
    var days = tripDays(pl); if (!days.length) return [];
    var from = days[0].date, to = days[days.length - 1].date, out = [];
    MM.CALENDAR.forEach(function (ev) {
      var ov = overlapOf(ev, days, from, to); if (!ov.length) return;
      if (ev.id === 'fullmoon') {                                   // one line listing the full-moon nights that fall in Thailand
        var nights = []; ov.forEach(function (o) { o.days.forEach(function (d) { nights.push(d.date); }); });
        out.push({ ev: ev, sev: 1, conf: true, from: nights[0], to: nights[nights.length - 1], nights: nights.length, places: [], title: ev.n + ': ' + nights.map(fmt).join(', '), shift: null });
        return;
      }
      ov.forEach(function (o) {
        var dates = o.days.map(function (d) { return d.date; }), places = []; o.days.forEach(function (d) { if (places.indexOf(d.loc) < 0) places.push(d.loc); });
        var item = { ev: ev, sev: ev.sev, conf: o.sp.conf, from: o.sp.from, to: o.sp.to, core: o.sp.core, nights: o.days.length, places: places, firstHit: dates[0], lastHit: dates[dates.length - 1], title: ev.n };
        // smallest shift of the whole trip (either way, up to 3 weeks) that misses it
        for (var d = 1; d <= 21 && !item.shift; d++) [d, -d].forEach(function (s) {
          if (item.shift) return;
          var moved = days.map(function (x) { return { date: new Date(x.date.getTime() + s * DAY), loc: x.loc }; });
          if (!overlapOf(ev, moved, new Date(from.getTime() + s * DAY), new Date(to.getTime() + s * DAY)).length) item.shift = { days: s, newStart: new Date(from.getTime() + s * DAY) };
        });
        out.push(item);
      });
    });
    return out.sort(function (a, b) { return b.sev - a.sev || a.from - b.from; });
  };

  // what's on in the next N months for these countries / hostels (undated trips + pages)
  MM.upcomingEvents = function (o) {
    o = o || {}; var from = o.from || new Date(), months = o.months || 14, to = new Date(from.getTime() + months * 30.5 * DAY), out = [];
    MM.CALENDAR.forEach(function (ev) {
      var relevant = !o.countries && !o.places ? true : (o.countries || []).some(function (c) { return ev.c && ev.c.indexOf(c) > -1; }) || (o.places || []).some(function (p) { return hits(ev, p); });
      if (!relevant || (ev.id === 'fullmoon' && !o.moon)) return;
      spansOf(ev, from, to).forEach(function (sp) { out.push({ ev: ev, from: sp.from, to: sp.to, conf: sp.conf, core: sp.core }); });
    });
    return out.sort(function (a, b) { return a.from - b.from; });
  };

  /* ---------------- visa length ---------------- */
  MM.visaCheck = function (pl, pass) {
    var runs = [], cur = null;
    pl.days.forEach(function (d, i) {
      var c = d.loc ? ctry(d.loc) : null; if (!c) return;
      if (!cur || cur.c !== c) { cur = { c: c, i0: i, i1: i, d0: d.date, d1: d.date, places: [] }; runs.push(cur); }
      cur.i1 = i; cur.d1 = d.date; if (cur.places.indexOf(d.loc) < 0) cur.places.push(d.loc);
    });
    var pp = pass || null;
    return runs.map(function (ru) {
      var days = ru.i1 - ru.i0 + 1, rule = MM.STAY && MM.STAY[ru.c] && pp ? MM.STAY[ru.c][pp] : null, out = { c: ru.c, days: days, from: ru.d0, to: ru.d1, places: ru.places, rule: rule };
      if (!pp) { out.status = 'pick'; out.msg = 'Pick your passport to check how long you can stay.'; return out; }
      if (!rule || rule.days == null) { out.status = 'check'; out.msg = 'We don\'t have the stay limit for your passport. Check the official site.'; return out; }
      out.allowed = rule.days; out.over = days - rule.days;
      var how = rule.how === 'free' ? 'visa-free' : rule.how === 'evisa' ? 'on an e-visa' : 'on a visa on arrival or e-visa';
      if (days > rule.days) { out.status = 'over'; out.msg = 'You\'re in ' + MM.COUNTRIES[ru.c].n + ' for ' + days + ' days. Your passport gets ' + rule.days + ' ' + how + '. ' + (rule.extend || ''); }
      else if (days >= rule.days - 2) { out.status = 'near'; out.msg = days + ' days in ' + MM.COUNTRIES[ru.c].n + ' is right at the ' + rule.days + '-day limit ' + how + '. Count your arrival day, and leave a day spare.'; }
      else { out.status = 'ok'; out.msg = days + ' days in ' + MM.COUNTRIES[ru.c].n + ', inside the ' + rule.days + ' ' + how + '.'; }
      return out;
    });
  };

  /* ---------------- fixes (used by the doctor + the one-tap buttons) ---------------- */
  MM.applyFix = function (state, fix) {
    var s = JSON.parse(JSON.stringify(state)); s.legPick = s.legPick || {};
    if (fix.t === 'nights') { var it = s.items[fix.i]; if (it && it.kind === 'stop') it.n = Math.max(1, Math.min(30, it.n + fix.d)); }
    else if (fix.t === 'leg') { s.legPick[fix.i] = fix.k; }
    else if (fix.t === 'remove') { s.items.splice(fix.i, 1); s.legPick = {}; }
    else if (fix.t === 'shift' && s.start) { s.start = iso(new Date(pISO(s.start).getTime() + fix.d * DAY)); }
    return s;
  };

  /* ---------------- Trip Doctor ---------------- */
  MM.doctor = function (state, opts) {
    opts = opts || {}; var pl = MM.plan(state), out = { findings: [], stats: {}, score: 100, label: '', plan: pl };
    if (!pl.totals.days || pl.segs.length === 0) return out;
    var T = pl.totals, legs = pl.legs, F = out.findings, stops = pl.segs;
    function cost(fix) { var p2 = MM.plan(MM.applyFix(state, fix)).totals; return { dCost: Math.round(p2.total - T.total), dDays: p2.days - T.days }; }
    function add(f) { if (f.fix) { var c = cost(f.fix); f.fix.dCost = c.dCost; f.fix.dDays = c.dDays; } F.push(f); }

    var transitH = legs.reduce(function (a, l) { return a + l.h; }, 0), ovnLegs = legs.filter(function (l) { return l.ovn; });
    out.stats = { transitH: Math.round(transitH), transitDays: Math.round(transitH / 16 * 10) / 10, overnights: ovnLegs.length, stops: pl.places.length, nights: T.nights, days: T.days, avgNights: pl.places.length ? Math.round(T.nights / pl.places.length * 10) / 10 : 0 };

    // 1. night buses / trains stacked close together
    var seen = {};
    for (var i = 0; i < legs.length; i++) for (var j = i + 1; j < legs.length; j++) {
      if (!legs[i].ovn || !legs[j].ovn) continue;
      var between = 0; for (var q = legs[i].index + 1; q <= legs[j].index; q++) between += stops[q] && stops[q].kind === 'stop' ? stops[q].n : 0;
      if (between <= 4 && !seen[j]) {
        seen[i] = seen[j] = 1;
        var alt = legs[j].options.filter(function (o) { return !o.ovn && o.key !== legs[j].key; }).sort(function (a, b) { return a.u - b.u; })[0];
        add({ sev: 'bad', id: 'ovn-stack', title: 'Two overnight journeys back to back', body: 'You travel overnight from ' + P()[legs[i].from].n + ' to ' + P()[legs[i].to].n + ' and again from ' + P()[legs[j].from].n + ' to ' + P()[legs[j].to].n + ', with only ' + plural(between, 'night') + ' between. You\'ll arrive wrecked.',
          fix: alt ? { t: 'leg', i: legs[j].index, k: alt.key, label: 'Fly or go by day on the second one' } : (stops[legs[j].index] && stops[legs[j].index].kind === 'stop' ? { t: 'nights', i: legs[j].index, d: 1, label: 'Add a recovery night in ' + P()[stops[legs[j].index].p].n } : null) });
      }
    }
    // 2. any single very long journey
    legs.forEach(function (l) {
      if (l.h >= 12 && !l.ovn) { var alt = l.options.filter(function (o) { return o.h < l.h - 4 && o.key !== l.key; }).sort(function (a, b) { return a.h - b.h; })[0];
        add({ sev: 'warn', id: 'long-' + l.index, title: P()[l.from].n + ' to ' + P()[l.to].n + ' is ' + Math.round(l.h) + ' hours', body: 'That is most of a day on the move.', fix: alt ? { t: 'leg', i: l.index, k: alt.key, label: 'Take the quicker option (' + U().hoursLabel(alt.h) + ')' } : null }); }
    });
    // 3. one-night stands
    stops.forEach(function (s, idx) {
      if (s.kind !== 'stop' || s.n !== 1 || stops.length < 3) return;
      var inL = legs.filter(function (l) { return l.to === s.p && l.index === idx - 1; })[0], outL = legs.filter(function (l) { return l.from === s.p && l.index === idx; })[0];
      if ((inL && inL.h >= 4) || (outL && outL.h >= 4) || P()[s.p].sug >= 3)
        add({ sev: 'warn', id: 'one-' + idx, title: 'Only one night in ' + P()[s.p].n, body: 'After the journey in and out, that\'s barely a day on the ground.' + (P()[s.p].sug >= 3 ? ' Most people give ' + P()[s.p].n + ' about ' + P()[s.p].sug + ' nights.' : ''), fix: { t: 'nights', i: idx, d: 1, label: 'Add a night in ' + P()[s.p].n } });
    });
    // 4. how much of the trip is spent travelling
    if (T.days >= 5 && transitH / (T.days * 16) > 0.26)
      add({ sev: 'warn', id: 'transit', title: 'About ' + out.stats.transitDays + ' of your ' + T.days + ' days are spent in transit', body: 'That is ' + out.stats.transitH + ' hours on buses, boats and planes. Fewer stops, or longer in each, would give you more to enjoy.', fix: null });
    // 5. too many places
    if (pl.places.length >= 4 && pl.places.length > T.days / 2.6)
      add({ sev: 'warn', id: 'rush', title: pl.places.length + ' stops in ' + T.days + ' days is a lot', body: 'That is a new bed every ' + (Math.round(T.nights / (pl.places.length - 1) * 10) / 10) + ' nights. You\'ll spend your trip packing.', fix: null });
    // 6. late or early arrivals
    legs.forEach(function (l) { if (l.chosen.odd) add({ sev: 'tip', id: 'odd-' + l.index, title: 'You land in ' + P()[l.to].n + ' at an odd hour (about ' + l.chosen.arrive + ')', body: 'Tell the crew when you send the trip, and we\'ll sort an early or late check-in so you\'re not stuck on a doorstep.', fix: null }); });
    // 7. a big multi-day activity followed straight away by a long journey
    pl.days.forEach(function (d, k) { var nx = pl.days[k + 1]; if (d.kind === 'epic' && nx && nx.travel && nx.travel.h >= 8 && !d._epicWarned) { d._epicWarned = 1;
      add({ sev: 'tip', id: 'epic-' + k, title: 'A long journey right after ' + d.epic.n, body: 'You\'ll be tired. Consider a spare night before you head to ' + P()[nx.travel.to].n + '.', fix: null }); } });
    // 8. visa length
    var visa = MM.visaCheck(pl, opts.passport || null);
    visa.forEach(function (v) {
      if (v.status === 'over') add({ sev: 'bad', id: 'visa-' + v.c, title: 'Longer than your visa in ' + MM.COUNTRIES[v.c].n, body: v.msg, fix: null });
      else if (v.status === 'near') add({ sev: 'warn', id: 'visa-' + v.c, title: 'Close to your visa limit in ' + MM.COUNTRIES[v.c].n, body: v.msg, fix: null });
    });
    out.visa = visa;
    // 9. festivals + closures
    out.events = MM.eventsFor(pl);
    out.events.forEach(function (e) {
      if (e.ev.id === 'fullmoon') return;
      var where = e.places.map(function (p) { return P()[p].n; }).join(', ');
      add({ sev: e.sev >= 3 ? 'bad' : e.sev === 2 ? 'warn' : 'tip', id: 'ev-' + e.ev.id + '-' + iso(e.from), title: e.ev.n + ' while you\'re in ' + where, body: (e.core ? 'Core days ' + e.core + '. ' : 'About ' + fmtRange(e.from, e.to) + '. ') + e.ev.impact + ' ' + e.ev.advice + (e.conf ? '' : ' (Dates are a forecast. Check them closer to the time.)'),
        fix: e.shift && state.start ? { t: 'shift', d: e.shift.days, label: 'Start ' + plural(Math.abs(e.shift.days), 'day') + (e.shift.days > 0 ? ' later' : ' earlier') + ' (' + fmt(e.shift.newStart) + ') to miss it' } : null });
    });
    // balance + score
    var pen = { bad: 14, warn: 7, tip: 2 }, score = 100; F.forEach(function (f) { score -= pen[f.sev] || 0; });
    var nBad = F.filter(function (f) { return f.sev === 'bad'; }).length;
    score = Math.max(12, Math.min(nBad ? 69 : 100, score)); out.score = score; out.bad = nBad; out.warns = F.filter(function (f) { return f.sev === 'warn'; }).length;
    out.label = nBad ? 'Needs a tweak' : score >= 88 ? 'Easy going' : score >= 72 ? 'Good rhythm' : score >= 52 ? 'Full-on' : 'Exhausting';
    if (!F.some(function (f) { return f.sev !== 'good'; })) F.push({ sev: 'good', id: 'good', title: 'Nicely paced', body: 'About ' + out.stats.avgNights + ' nights a stop and ' + out.stats.transitDays + ' days of travel across ' + T.days + '. That gives you time to actually enjoy it.', fix: null });
    F.sort(function (a, b) { var o = { bad: 0, warn: 1, tip: 2, good: 3 }; return o[a.sev] - o[b.sev]; });
    return out;
  };

  /* ---------------- packing list ---------------- */
  var PLUGS = { TH: 'A/B/C/O', LA: 'A/B/C/E/F', VN: 'A/C', KH: 'A/C/G', ID: 'C/F', PH: 'A/B/C' };
  MM.PLUGS = PLUGS;
  MM.packing = function (pl) {
    var cs = pl.countries, tags = {}, ids = {}, months = {}, wet = false;
    pl.segs.forEach(function (s) { if (s.kind === 'stop') s.acts.forEach(function (a) { ids[a.id] = 1; (a.tags || []).forEach(function (t) { tags[t] = 1; }); }); });
    pl.days.forEach(function (d) { if (d.date) months[d.date.getUTCMonth()] = 1; });
    pl.places.forEach(function (p) { Object.keys(months).forEach(function (m) { if (MM.seasonOf(p, +m) === 1) wet = true; }); });
    var anyMtn = pl.places.some(function (p) { return /hanoi|luang-prabang|pai|chiang-mai/.test(p); }) && (months[11] || months[0] || months[1] || !Object.keys(months).length);
    var loop = Object.keys(ids).some(function (i) { return /ha-giang|sapa|rinjani|batur|nong-khiaw/.test(i); });
    var list = [
      { g: 'Documents', items: ['Passport with at least 6 months left on it', 'Printed or saved copy of your trip + bed holds', 'Travel insurance details (and the policy number saved offline)', 'A couple of passport photos (handy for visas and SIMs)', 'Debit and credit cards, plus some spare US dollars in clean notes'] },
      { g: 'Clothes', items: ['Light, quick-drying tops and shorts', 'One long-sleeve top and long trousers or a sarong for temples (cover shoulders and knees)', 'Swimmers and a quick-dry towel', 'Flip-flops plus one pair of closed shoes you can walk in'] },
      { g: 'Tech + power', items: ['Phone, charger and a power bank', 'Plug adaptor: ' + cs.map(function (c) { return MM.COUNTRIES[c].n + ' ' + PLUGS[c]; }).join(', '), 'Earphones and a dry bag for your phone', 'An eSIM or a local SIM (more in Know before you go)'] },
      { g: 'Health + bits', items: ['Any prescription medication in the original packaging', 'Sun cream, insect repellent, and rehydration salts', 'A small first-aid kit with plasters and antiseptic', 'Hand gel and tissues (not every toilet has paper)', 'A padlock for your hostel locker'] }];
    if (wet) list[1].items.push('A light rain jacket or poncho (you\'ll hit the wet season)');
    if (anyMtn || loop) list[1].items.push('A warm layer. It gets properly cold on mountain roads and in the north.');
    if (loop) list.push({ g: 'For the mountains', items: ['Sturdy shoes, not flip-flops', 'A buff or scarf for dust', 'Layers you can add and remove all day'] });
    if (tags.dive || tags.surf || tags.water || tags.beach) list.push({ g: 'For the water', items: ['Reef-safe sun cream', 'A rash vest if you burn easily', 'A waterproof phone pouch', 'Your own snorkel mask if you like a good fit'] });
    if (tags.party || tags.night) list.push({ g: 'For the nights out', items: ['Something you don\'t mind getting wet or messy', 'A small bag you can lock or keep in front of you', 'A card or cash in one pocket only. Leave the rest in the locker.'] });
    if (Object.keys(ids).some(function (i) { return /moto|scooter|ha-giang|quad|atv/.test(i); })) list.push({ g: 'If you ride', items: ['Your driving licence and a valid International Driving Permit', 'Closed shoes, long trousers and gloves', 'Travel insurance that covers riding. Read the small print.'] });
    return list;
  };

  /* ---------------- themed trips + Surprise me ----------------
     Hand-picked routes (not generated), the way a crew member would suggest them. Every leg is a sensible journey. */
  // route entries are [hostel, nights, [activity name fragments]]. The activities are picked by hand so the
  // description, the days and the price all describe the same trip. A test makes sure every fragment still resolves.
  MM.THEMES = [
    { id: 'party', n: 'The Party Trail', tag: 'Pub crawls, pool parties, island nights', blurb: 'Angkor sunrise and the Siem Reap pub crawl, Phnom Penh\'s pool party, then beach nights on Koh Rong.',
      route: [['siem-reap', 3, ['Pub Street crawl', 'Sunrise Angkor']], ['phnom-penh', 3, ['Phnom Penh pub crawl', 'Pool party']], ['koh-rong', 4, ['Beach fire show', 'volleyball']], ['kampot', 2, ['River kayak']]], vibes: ['party', 'islands'], c: 'pink' },
    { id: 'surfdive', n: 'Surf + Dive', tag: 'Learn it. Live it.', blurb: 'A Bali surf lesson, snorkelling at Nusa Lembongan, a first scuba dive off the Gilis, then surf lessons in Lombok.',
      route: [['uluwatu', 4, ['Surf lesson (group', 'Mt Batur']], ['nusa-lembongan', 3, ['Snorkelling (three', 'Nusa Penida']], ['gili-trawangan', 4, ['Discover scuba', 'Snorkelling adventure']], ['kuta-lombok', 3, ['Surf lesson (intermediate', 'Secret Gili']]], vibes: ['surf', 'islands'], c: 'cyan' },
    { id: 'foodculture', n: 'Food + Culture', tag: 'Street food, cooking classes, old towns', blurb: 'Hanoi street food, Hoi An cooking classes and lantern nights, then Luang Prabang\'s night market, temples and waterfalls.',
      route: [['hanoi', 4, ['Street food + Train', 'Hanoi cooking class']], ['hoi-an', 4, ['Cooking class + bamboo', 'Sunset river cruise']], ['luang-prabang', 4, ['Night market food', 'Kuang Si', 'Stories of Luang Prabang']]], vibes: ['food', 'culture'], c: 'orange' },
    { id: 'adventure', n: 'Big Adventure', tag: 'Loops, caves, ziplines, waterfalls', blurb: 'The Ha Giang Loop, a flight to Laos, then the train to Vang Vieng for waterfalls, caves, ziplines and tubing.',
      route: [['hanoi', 4, ['Ha Giang Loop · 4 days, Easy', 'Ninh Binh']], ['luang-prabang', 3, ['Kuang Si']], ['vang-vieng', 3, ['Blue Lagoons', 'Zipline', 'Tipsy tubing']]], vibes: ['adventure', 'moto'], c: 'lime' },
    { id: 'chill', n: 'Slow + Chill', tag: 'Island boats, no alarms', blurb: 'The Visayas at ferry pace: Panglao\'s beaches and sunsets, turtles at Apo Island, and Siquijor by scooter.',
      route: [['panglao', 4, ['Cave + beach', 'Sunset cruise', 'Sunset beer yoga']], ['dumaguete', 3, ['Apo Island']], ['siquijor', 4, ['Scooter loop', 'Sunset cruise']]], vibes: ['chill', 'islands'], c: 'yellow' },
    { id: 'cheap', n: 'Cheap as Chips', tag: 'As far as the money goes', blurb: 'Pai, Chiang Mai, the two-day slow boat and Vang Vieng. Dorm beds from a few dollars, local transport and the cheapest things to do.',
      route: [['pai', 3, ['Pai Canyon', 'Pai pub crawl']], ['chiang-mai', 3, ['Doi Suthep', 'Day Party']], ['luang-prabang', 3, ['Night market food', 'Kuang Si']], ['vang-vieng', 3, ['Tipsy tubing', 'pub crawl']]], vibes: ['culture', 'food'], pref: 'cheap', fund: 14, c: 'green' },
    { id: 'firsttimer', n: 'First Timer Classic', tag: 'The easy way in', blurb: 'Vietnam\'s two big hitters, Hanoi and Hoi An, then Cambodia\'s temples and capital: Siem Reap and Phnom Penh.',
      route: [['hanoi', 3, ['Street food + Train', 'Ninh Binh']], ['hoi-an', 3, ['Cooking class + bamboo', 'Sunset river cruise']], ['siem-reap', 3, ['Sunrise Angkor', 'Pub Street crawl']], ['phnom-penh', 2, ['S21']]], vibes: ['culture', 'food', 'party'], c: 'blue' },
    { id: 'islandhop', n: 'Island Hopper', tag: 'Boats, sand and hammocks', blurb: 'Phnom Penh, then Koh Sdach and Koh Rong by boat, and Kampot\'s river and Bokor Mountain to finish.',
      route: [['phnom-penh', 2, ['Sunset river cruise']], ['koh-sdach', 3, ['Island-hopping', 'Snorkelling']], ['koh-rong', 4, ['Kayak hire', 'Beach fire show']], ['kampot', 3, ['River kayak', 'Bokor']]], vibes: ['islands', 'chill'], c: 'cyan' }];

  // find the activity at a hostel whose name contains the fragment
  function actByName(place, frag) {
    var f = frag.toLowerCase(), hit = MM.actsAt(place).filter(function (a) { return a.n.toLowerCase().indexOf(f) > -1; })[0]; return hit ? hit.id : null;
  }
  MM.themeActs = function (place, frags) { return (frags || []).map(function (f) { return actByName(place, f); }).filter(Boolean); };
  function stateFromRoute(route, t, o) {
    o = o || {};
    var items = route.map(function (x) { return { kind: 'stop', p: x[0], n: x[1], acts: x[2] ? MM.themeActs(x[0], x[2]) : (MM.autoActs ? MM.autoActs(x[0], x[1], { vibes: t.vibes.slice(), must: [] }) : []) }; });
    return { items: items, start: o.start || '', pref: o.pref || t.pref || 'balanced', legPick: {}, fund: t.fund || 20, crew: 0, budget: 0 };
  }
  MM.themeTrip = function (id, extra) {
    var t = MM.THEMES.filter(function (x) { return x.id === id; })[0]; if (!t) return null;
    var st = stateFromRoute(t.route, t, extra); return { theme: t, state: st, days: MM.plan(st).totals.days };
  };
  MM.surprise = function (rng) {
    rng = rng || Math.random; var pick = function (a) { return a[Math.floor(rng() * a.length)]; };
    var t = pick(MM.THEMES), route = t.route.map(function (x) { return [x[0], x[1], x[2]]; });
    if (rng() < 0.5) route.reverse();                                           // the legs work both ways
    var i = Math.floor(rng() * route.length); if (rng() < 0.6) route[i][1] = Math.max(2, route[i][1] + (rng() < 0.5 ? -1 : 1));
    var st = stateFromRoute(route, t, { pref: t.pref || (rng() < 0.25 ? 'fast' : 'balanced') }), why = [];
    why.push(t.n); if (route[0][0] !== t.route[0][0]) why.push('run backwards for a change');
    return { theme: t, state: st, why: why, days: MM.plan(st).totals.days };
  };

  if (typeof module !== 'undefined') module.exports = MM;
})(typeof window !== 'undefined' ? window : globalThis);
