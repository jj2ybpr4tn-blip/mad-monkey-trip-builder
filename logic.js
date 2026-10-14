/* ============================================================
   MAD MONKEY TRIP BUILDER — the brain (no DOM; runs in browser + Node tests)

     route / legOptions   shortest paths over the transport graph
     plan                 state -> day-by-day itinerary, legs, costs, warnings
     matchAllIn           how close is a DIY route to a packaged ALL IN trip
     suggest              quiz answers -> best-fit routes
     encodeState / decodeState   shareable links
     planText / leadPayload      share + lead-card output

   STATE
     items   [{kind:'stop', p, n, acts:[ids]} | {kind:'allin', trip}]
     start   'YYYY-MM-DD' | ''       pref  'balanced' | 'cheap' | 'fast'
     legPick {legIndex: 'balanced'|'cheap'|'fast'}   fund  $/day food+fun
     crew    mates rallied (ALL IN squad-leader perk)
   ============================================================ */
(function (r) {
  var MM = r.MM = r.MM || {};
  var P = function () { return MM.PLACES; };

  /* ---------------- tiny utils ---------------- */
  var DOWN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var MONTHN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function parseDate(s) { if (!s) return null; var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s); return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null; }
  function isoDate(d) { return d.toISOString().slice(0, 10); }
  function addDays(d, n) { return new Date(d.getTime() + n * 86400000); }
  function fmtDate(d) { return DOWN[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + MONTHN[d.getUTCMonth()]; }
  function round1(x) { return Math.round(x * 10) / 10; }
  function hav(a, b) {
    var R = 6371, t = Math.PI / 180, dLa = (b[0] - a[0]) * t, dLo = (b[1] - a[1]) * t;
    var h = Math.sin(dLa / 2) * Math.sin(dLa / 2) + Math.cos(a[0] * t) * Math.cos(b[0] * t) * Math.sin(dLo / 2) * Math.sin(dLo / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function hoursLabel(h) {
    if (h < 1) return Math.round(h * 60) + ' min';
    var whole = Math.floor(h), mins = Math.round((h - whole) * 60 / 5) * 5;
    if (mins === 60) { whole++; mins = 0; }
    if (h >= 20) return Math.round(h) + ' hrs';
    return whole + 'h' + (mins ? (mins < 10 ? '0' : '') + mins : '');
  }
  MM.util = { parseDate: parseDate, isoDate: isoDate, addDays: addDays, fmtDate: fmtDate, hoursLabel: hoursLabel, hav: hav, DOWN: DOWN, MONTHN: MONTHN };

  /* ---------------- currency ---------------- */
  MM.FX = { USD: 1, GBP: 1 / 1.27 };            // indicative; the booking engine has the real rate
  MM.money = function (usd, cur) {
    var v = usd * (MM.FX[cur || 'USD'] || 1), sym = cur === 'GBP' ? '£' : '$';
    return sym + Math.round(v).toLocaleString('en-GB');
  };

  /* ============================================================
     GRAPH + ROUTING
     ============================================================ */
  var AIRPORT_COUNTRY = { BKK: 'TH', CNX: 'TH', HKT: 'TH', HAN: 'VN', DAD: 'VN', SGN: 'VN', PNH: 'KH', REP: 'KH', SIHA: 'KH', LPQ: 'LA',
    DPS: 'ID', LOP: 'ID', MNL: 'PH', ENI: 'PH', CEB: 'PH', IAO: 'PH', TAG: 'PH', DGT: 'PH' };
  var TV = { cheap: 1.5, balanced: 6, fast: 25 };            // $ you'd pay to save an hour
  var BED_CREDIT = 6;                                       // an overnight bus saves a bed night
  var HOP = 0.3;                                             // hours lost per change

  var graph = null;
  function buildGraph() {
    var adj = {}, edges = MM.EDGES.slice();
    Object.keys(P()).forEach(function (id) {
      P()[id].ap.forEach(function (a) { edges.push({ a: id, b: a[0], m: 'taxi', h: a[1], u: a[2], note: 'Transfer to ' + a[0] + ' airport' }); });
    });
    edges.forEach(function (e, i) { e.id = i; (adj[e.a] = adj[e.a] || []).push({ to: e.b, e: e }); (adj[e.b] = adj[e.b] || []).push({ to: e.a, e: e }); });
    return { adj: adj, edges: edges };
  }
  function countryOf(node) { return P()[node] ? P()[node].c : AIRPORT_COUNTRY[node] || null; }
  function weight(e, pref) { return e.u + TV[pref] * (e.h + HOP) - (e.ovn ? BED_CREDIT : 0); }

  var routeCache = {};
  function route(a, b, pref) {
    if (!graph) graph = buildGraph();
    if (a === b) return { steps: [], h: 0, u: 0, ovn: false, nights: 0, nodes: [a] };
    var key = a + '>' + b + '>' + pref; if (routeCache[key]) return routeCache[key];
    var dist = {}, prev = {}, done = {}; dist[a] = 0;
    var nodes = Object.keys(graph.adj);
    while (true) {
      var best = null, bd = Infinity;
      for (var i = 0; i < nodes.length; i++) { var n = nodes[i]; if (!done[n] && dist[n] !== undefined && dist[n] < bd) { bd = dist[n]; best = n; } }
      if (best === null || best === b) break;
      done[best] = true;
      graph.adj[best].forEach(function (x) {
        var w = Math.max(1, weight(x.e, pref)), nd = dist[best] + w;
        if (dist[x.to] === undefined || nd < dist[x.to]) { dist[x.to] = nd; prev[x.to] = { from: best, e: x.e }; }
      });
    }
    if (dist[b] === undefined) return (routeCache[key] = null);
    var steps = [], nodesPath = [b], cur = b;
    while (cur !== a) { var p = prev[cur]; steps.unshift({ e: p.e, from: p.from, to: cur }); nodesPath.unshift(p.from); cur = p.from; }
    var res = { steps: steps, nodes: nodesPath, h: 0, u: 0, ovn: false, nights: 0 };
    steps.forEach(function (s) {
      res.h += s.e.h; res.u += s.e.u; if (s.e.ovn) { res.ovn = true; res.nights += (s.e.nights || 1); }
    });
    res.h += HOP * Math.max(0, steps.length - 1);
    res.h = round1(res.h); res.u = Math.round(res.u);
    res.sig = steps.map(function (s) { return s.e.id; }).join('.');
    return (routeCache[key] = res);
  }

  var PREF_LABEL = { balanced: 'Smart pick', cheap: 'Cheapest', fast: 'Fastest' };
  function describe(rt, a, b) {
    var modes = []; rt.steps.forEach(function (s) { if (s.e.m !== 'taxi' || rt.steps.length === 1) modes.push(s.e.m); });
    var flightStep = rt.steps.filter(function (s) { return s.e.m === 'flight'; })[0];
    var main = flightStep ? 'flight' : (rt.steps.slice().sort(function (x, y) { return y.e.h - x.e.h; })[0] || { e: { m: 'taxi' } }).e.m;
    var uniq = modes.filter(function (m, i) { return modes.indexOf(m) === i; });
    var label = uniq.map(function (m) { return MM.MODE_LABEL[m] || m; }).join(' + ') || 'Transfer';
    var mm = null; rt.steps.forEach(function (s) { if (s.e.mm) mm = s.e.mm; });
    return { main: main, label: label, mm: mm };
  }
  function legOptions(a, b) {
    var seen = {}, out = [];
    ['balanced', 'cheap', 'fast'].forEach(function (pref) {
      var rt = route(a, b, pref); if (!rt || seen[rt.sig]) return; seen[rt.sig] = 1;
      var d = describe(rt, a, b);
      out.push({ key: pref, label: PREF_LABEL[pref], route: rt, h: rt.h, u: rt.u, ovn: rt.ovn, nights: rt.nights, main: d.main, modeLabel: d.label, mm: d.mm });
    });
    // collapse labels when only one distinct route exists
    if (out.length === 1) out[0].label = 'Best route';
    return out;
  }
  MM.route = route; MM.legOptions = legOptions; MM.PREF_LABEL = PREF_LABEL; MM.countryOf = countryOf;

  function borderNote(a, b, opt) {
    var ca = countryOf(a), cb = countryOf(b), sorted = [ca, cb].sort().join('-');
    if (sorted === 'KH-TH') { var B = MM.BORDERS['TH-KH']; if (!B.open) return B.note; }
    return '';
  }

  /* ============================================================
     SEASONS + EVENTS
     ============================================================ */
  function seasonOf(placeId, month0) { var p = P()[placeId]; return p ? +p.seas[month0] : 2; }
  MM.seasonOf = seasonOf;
  var SEAS_TXT = { 1: 'Wet / rough season', 2: 'Fine', 3: 'Prime time' };
  MM.SEAS_TXT = SEAS_TXT;

  /* ============================================================
     PLAN
     ============================================================ */
  var EXTRA_SLOT = { full: ['am', 'pm'], half: ['am|pm'], eve: ['eve'] };

  function blockPlaces(trip) { return trip.stops.map(function (s) { return s.p; }); }
  function blockFirst(trip) { return trip.stops[0].p; }
  function blockLast(trip) { return trip.stops[trip.stops.length - 1].p; }

  function defaultState() { return { items: [], start: '', pref: 'balanced', legPick: {}, fund: 18, crew: 0 }; }
  MM.defaultState = defaultState;

  function plan(state) {
    state = state || defaultState();
    var items = state.items || [];
    var start = parseDate(state.start);
    var out = { days: [], legs: [], stops: [], warnings: [], totals: null, countries: [], places: [], match: [], km: 0, unscheduled: [], blocks: [] };

    /* ---- 1. flatten items into segments with entry/exit places ---- */
    var segs = items.map(function (it, idx) {
      if (it.kind === 'allin') {
        var t = MM.ALL_IN.filter(function (x) { return x.id === it.trip; })[0];
        return { idx: idx, kind: 'allin', trip: t, first: blockFirst(t), last: blockLast(t) };
      }
      var acts = (it.acts || []).map(function (id) { return MM.ACTS[id]; }).filter(Boolean);
      var epics = acts.filter(function (a) { return a.multi && a.multi.n > 0; });
      var inline = acts.filter(function (a) { return !(a.multi && a.multi.n > 0); });
      return { idx: idx, kind: 'stop', p: it.p, n: it.n, acts: acts, epics: epics, inline: inline, first: it.p, last: it.p };
    });

    /* ---- 2. legs between consecutive segments ---- */
    var legBetween = [];
    for (var i = 0; i < segs.length - 1; i++) {
      var a = segs[i].last, b = segs[i + 1].first, leg = null;
      if (a !== b) {
        var opts = legOptions(a, b); if (!opts.length) { out.warnings.push({ t: 'warn', m: 'No route found between ' + P()[a].n + ' and ' + P()[b].n + '.' }); }
        else {
          var pick = state.legPick && state.legPick[i], chosen = opts.filter(function (o) { return o.key === pick; })[0];
          if (!chosen) chosen = opts.filter(function (o) { return o.key === (state.pref || 'balanced'); })[0] || opts[0];
          // `pref` may map to an option that was de-duplicated away; fall back to the closest
          if (!chosen) chosen = opts[0];
          leg = { index: i, from: a, to: b, options: opts, chosen: chosen, key: chosen.key, pkgs: MM.LEG_PKGS[a + '|' + b] || MM.LEG_PKGS[b + '|' + a] || null,
            tickets: MM.TICKETS[a + '|' + b] || MM.TICKETS[b + '|' + a] || null, border: borderNote(a, b), h: chosen.h, u: chosen.u, ovn: chosen.ovn, nights: chosen.nights };
        }
      }
      legBetween.push(leg); if (leg) out.legs.push(leg);
    }

    /* ---- 3. timeline of nights ---- */
    var timeline = [];                     // {t:'bed'|'epic'|'move'|'block', seg, ...}
    segs.forEach(function (s, si) {
      if (s.kind === 'allin') { for (var k = 0; k < s.trip.days - 1; k++) timeline.push({ t: 'block', si: si, k: k, trip: s.trip }); }
      else {
        var hasEpic = s.epics.length > 0, k1 = hasEpic ? Math.ceil(s.n / 2) : s.n, k2 = s.n - k1;
        for (var a1 = 0; a1 < k1; a1++) timeline.push({ t: 'bed', si: si, first: a1 === 0 });
        s.epics.forEach(function (e) { for (var q = 0; q < e.multi.n; q++) timeline.push({ t: 'epic', si: si, act: e, q: q, of: e.multi.n }); });
        for (var a2 = 0; a2 < k2; a2++) timeline.push({ t: 'bed', si: si, first: false, afterEpic: a2 === 0 });
      }
      var leg = legBetween[si];
      if (leg && leg.nights > 0) for (var m = 0; m < leg.nights; m++) timeline.push({ t: 'move', si: si, leg: leg, m: m, of: leg.nights });
    });

    /* ---- 4. day entries ---- */
    var N = timeline.length;
    var firstBedOfSeg = {}, prevEntryByIdx = {};
    var segDays = segs.map(function () { return []; });
    timeline.forEach(function (tn, k) {
      var day = { n: k + 1, date: start ? addDays(start, k) : null, kind: tn.t === 'move' ? 'move' : tn.t === 'epic' ? 'epic' : tn.t === 'block' ? 'block' : 'stay',
        si: tn.si, acts: [], notes: [], slots: { am: true, pm: true, eve: true } };
      var seg = segs[tn.si];
      if (tn.t === 'bed') {
        day.loc = seg.p; day.title = P()[seg.p].n;
        var prev = timeline[k - 1];
        var isArrival = tn.first && (k > 0), legIn = tn.first && tn.si > 0 ? legBetween[tn.si - 1] : null;
        if (tn.first) {
          day.arrival = true;
          if (k === 0) { day.slots.am = false; day.title = 'Land in ' + P()[seg.p].n; }
          else if (legIn) {
            day.travel = legIn;
            if (prev && prev.t === 'move') { day.slots.am = false; day.note = 'Arrive after the overnight journey'; }
            else { day.slots.am = false; day.slots.pm = legIn.h < 4; day.title = 'Travel to ' + P()[seg.p].n; }
          }
        }
        if (tn.afterEpic) { day.slots.am = false; day.note = 'Back from ' + seg.epics.map(function (e) { return e.n; }).join(' + '); }
        segDays[tn.si].push(day);
      } else if (tn.t === 'epic') {
        day.loc = seg.p; day.title = tn.act.n + ' · day ' + (tn.q + 1) + ' of ' + tn.act.multi.d;
        day.epic = tn.act; day.slots = { am: false, pm: false, eve: false };
        if (tn.q === 0 && timeline[k - 1] && timeline[k - 1].t === 'bed') day.note = 'Pack light. The rest of your stuff stays at the hostel.';
      } else if (tn.t === 'move') {
        day.loc = null; day.travel = tn.leg; day.slots = { am: false, pm: false, eve: false };
        day.title = tn.of > 1 ? 'On the move · night ' + (tn.m + 1) + ' of ' + tn.of : 'Overnight journey';
        day.moveTo = tn.leg.to;
      } else if (tn.t === 'block') {
        day.loc = tn.trip.stops[0].p; day.title = 'ALL IN ' + tn.trip.n + ' · day ' + (tn.k + 1); day.slots = { am: false, pm: false, eve: false };
        day.blockTrip = tn.trip;
      }
      out.days.push(day);
    });
    // leg for same-day travel that falls on a stay day already attached (day.travel). Overnight leg shows on the move/arrival day.
    // final departure day
    out.days.push({ n: N + 1, date: start ? addDays(start, N) : null, kind: 'depart', loc: segs.length ? segs[segs.length - 1].last : null, title: 'Check out + onward travel', acts: [], notes: [], slots: {} });

    /* ---- 5. schedule activities ---- */
    segs.forEach(function (s, si) {
      if (s.kind !== 'stop') return;
      var days = segDays[si];
      // n=0 multi-day (surf camp, PADI) occupy consecutive full days
      s.inline.forEach(function (a) { if (a.multi && a.multi.d > 1) a._occ = a.multi.d; else a._occ = 1; });
      var order = s.inline.slice().sort(function (x, y) {
        var rx = (x.multi ? 0 : x.dows ? 1 : x.slot === 'full' ? 2 : x.slot === 'half' ? 3 : 4), ry = (y.multi ? 0 : y.dows ? 1 : y.slot === 'full' ? 2 : y.slot === 'half' ? 3 : 4);
        return rx - ry;
      });
      order.forEach(function (a) {
        var placed = false;
        function tryDay(d, needDow) {
          if (needDow && start && a.dows && d.date && a.dows.indexOf(d.date.getUTCDay()) < 0) return false;
          if (a.multi && a.multi.d > 1) return false;
          var sl = d.slots;
          if (a.slot === 'full' && sl.am && sl.pm) { sl.am = sl.pm = false; d.acts.push({ id: a.id, part: 'Full day' }); return true; }
          if (a.slot === 'half') { if (sl.pm) { sl.pm = false; d.acts.push({ id: a.id, part: 'Afternoon' }); return true; } if (sl.am) { sl.am = false; d.acts.push({ id: a.id, part: 'Morning' }); return true; } }
          if (a.slot === 'eve' && sl.eve) { sl.eve = false; d.acts.push({ id: a.id, part: 'Evening' }); return true; }
          return false;
        }
        if (a.multi && a.multi.d > 1) {            // block of consecutive free days
          var need = a.multi.d;
          for (var s0 = 0; s0 + need <= days.length && !placed; s0++) {
            var ok = true; for (var q = 0; q < need; q++) if (!(days[s0 + q].slots.am && days[s0 + q].slots.pm)) ok = false;
            if (ok) { for (var q2 = 0; q2 < need; q2++) { var dd = days[s0 + q2]; dd.slots.am = dd.slots.pm = false; dd.acts.push({ id: a.id, part: 'Day ' + (q2 + 1) + ' of ' + need }); } placed = true; }
          }
        } else {
          for (var di = 0; di < days.length && !placed; di++) placed = tryDay(days[di], true);
          // no date-compatible day: fall back (undated) or flag it (dated)
          if (!placed && !start) for (var dj = 0; dj < days.length && !placed; dj++) placed = tryDay(days[dj], false);
        }
        if (!placed) {
          var why = (a.dows && start) ? 'runs ' + a.when + ' and your dates miss it, or there is no free slot' : 'no free slot: add a night';
          out.unscheduled.push({ seg: si, p: s.p, act: a, why: why });
        }
      });
    });
    // epics attach to their first day (info)
    // dated events
    if (start) out.days.forEach(function (d) {
      if (!d.date || !d.loc) return; var iso = isoDate(d.date);
      MM.EVENTS.forEach(function (ev) { if (ev.date === iso && ev.at.indexOf(d.loc) > -1) d.notes.push(ev.n + ' at Mad Monkey ' + P()[d.loc].n + ' tonight'); });
    });
    // days left over for any day with a date: label weekday
    out.days.forEach(function (d) { if (d.date) d.dateLabel = fmtDate(d.date); });

    /* ---- 6. warnings ---- */
    function monthOfDay(d) { return d.date ? d.date.getUTCMonth() : (state.month != null ? state.month : null); }
    var seenSeas = {};
    out.days.forEach(function (d) {
      if (!d.loc || d.kind === 'move' || d.kind === 'depart') return; var m = monthOfDay(d); if (m == null) return;
      var key = d.loc + m; if (seenSeas[key]) return; seenSeas[key] = 1;
      if (seasonOf(d.loc, m) === 1) out.warnings.push({ t: 'season', p: d.loc, m: P()[d.loc].n + ' in ' + MONTHN[m] + ': ' + (P()[d.loc].note || 'Wet or rough-sea season.') + ' It still runs, pack for it.' });
    });
    segs.forEach(function (s) {
      if (s.kind !== 'stop') return;
      var pl = P()[s.p];
      if (pl.opens && start && isoDate(start) < pl.opens) out.warnings.push({ t: 'warn', p: s.p, m: pl.n + ' opens ' + fmtDate(parseDate(pl.opens)) + '. Your dates start earlier.' });
      if (pl.partner) out.warnings.push({ t: 'info', p: s.p, m: pl.n + ' has no Mad Monkey yet. We\'ll find you a partner hostel (bed price is an estimate).' });
      s.acts.forEach(function (a) { if (/rinjani/i.test(a.id) && start && [0, 1, 2].indexOf(start.getUTCMonth()) > -1) out.warnings.push({ t: 'warn', p: s.p, m: 'Rinjani is usually closed roughly Jan–Mar.' }); });
    });
    legBetween.forEach(function (l) {
      if (!l) return; if (l.border) out.warnings.push({ t: 'warn', m: l.border });
      if (l.chosen.h >= 18 && !l.chosen.ovn) out.warnings.push({ t: 'info', m: P()[l.from].n + ' → ' + P()[l.to].n + ' is a very long journey. Consider the flight option.' });
    });
    out.unscheduled.forEach(function (u) { out.warnings.push({ t: 'warn', p: u.p, m: u.act.n + ' at ' + P()[u.p].n + ' doesn\'t fit: ' + u.why + '.' }); });
    // ALL IN departure day
    segs.forEach(function (s, si) {
      if (s.kind !== 'allin') return;
      var startDay = 0; timeline.forEach(function (tn, k) { if (tn.t === 'block' && tn.si === si && tn.k === 0) startDay = k; });
      var dd = out.days[startDay];
      if (dd && dd.date && dd.date.getUTCDay() !== s.trip.dep && s.trip.status === 'live') out.warnings.push({ t: 'warn', m: 'ALL IN ' + s.trip.n + ' departs every ' + DOWN[s.trip.dep] + '. Your start is a ' + DOWN[dd.date.getUTCDay()] + ': shift it to line up.' });
      if (s.trip.status === 'soon') out.warnings.push({ t: 'info', m: 'ALL IN ' + s.trip.n + ' is launching soon. Pop your details in and you\'re first on the list.' });
    });

    /* ---- 7. totals ---- */
    var beds = 0, acts = 0, transport = 0, allin = 0, payDay = 0, estAny = false, bedNights = 0, coveredBed = 0, stopCount = {};
    segs.forEach(function (s, si) {
      if (s.kind === 'allin') { allin += s.trip.usd; blockPlaces(s.trip).forEach(function (p) { stopCount[p] = 1; }); return; }
      stopCount[s.p] = 1;
      var covered = 0; s.inline.forEach(function (a) { if (a.multi && a.multi.covers) covered += Math.max(0, a.multi.d - 1); });
      var billable = Math.max(0, s.n - covered);
      bedNights += s.n; coveredBed += (s.n - billable);
      beds += billable * P()[s.p].bed;
      s.acts.forEach(function (a) { if (a.usd == null) payDay++; else acts += a.usd; if (a.est) estAny = true; });
    });
    out.legs.forEach(function (l) { transport += l.u; });
    var diyDays = 0, blockDays = 0;
    segs.forEach(function (s) { if (s.kind === 'allin') blockDays += s.trip.days - 1; });
    diyDays = Math.max(0, N - blockDays);
    var fund = Math.round(diyDays * (state.fund || 0) + blockDays * (state.fund || 0) * 0.4);
    var squad = 0, mates = state.crew || 0;
    if (allin) squad = mates >= 6 ? -allin : mates >= 3 ? -Math.round(allin * 0.5) : 0;
    // squad perk applies per ALL IN block (leader's own ticket) — only the first block is eligible
    if (allin && squad) { var first = segs.filter(function (s) { return s.kind === 'allin'; })[0]; squad = mates >= 6 ? -first.trip.usd : -Math.round(first.trip.usd * 0.5); }
    var total = Math.round(beds + acts + transport + allin + squad + fund);
    // distance + countries + places
    var seq = []; segs.forEach(function (s) { if (s.kind === 'allin') s.trip.stops.forEach(function (st) { seq.push(st.p); }); else seq.push(s.p); });
    var dedup = seq.filter(function (p, i) { return i === 0 || p !== seq[i - 1]; });
    var km = 0; for (var q = 1; q < dedup.length; q++) km += hav(P()[dedup[q - 1]].ll, P()[dedup[q]].ll);
    var ctry = {}; dedup.forEach(function (p) { ctry[P()[p].c] = 1; });
    out.places = dedup; out.countries = Object.keys(ctry); out.km = Math.round(km);
    out.stops = segs; out.segs = segs;
    out.totals = { nights: N, days: N ? N + 1 : 0, bedNights: bedNights, coveredBed: coveredBed, beds: Math.round(beds), acts: Math.round(acts), transport: Math.round(transport), allin: allin, squad: squad,
      fund: fund, total: total, payOnDay: payDay, est: estAny, stops: Object.keys(stopCount).length, overnightLegs: out.legs.filter(function (l) { return l.ovn; }).length,
      diy: Math.round(beds + acts + transport + fund), mates: mates };
    out.match = matchAllIn(out, state);
    return out;
  }
  MM.plan = plan;

  /* ============================================================
     ALL IN match — is a packaged crew trip a better deal for this route?
     ============================================================ */
  function nextDeparture(trip, from) {
    var d = from ? new Date(from.getTime()) : new Date(); d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    for (var i = 0; i < 8; i++) { if (d.getUTCDay() === trip.dep) return d; d = addDays(d, 1); }
    return d;
  }
  MM.nextDeparture = nextDeparture;

  function matchAllIn(pl, state) {
    var res = [];
    var mine = {}; pl.places.forEach(function (p) { mine[p] = 1; });
    var hasBlock = (state.items || []).some(function (it) { return it.kind === 'allin'; });
    if (hasBlock || !pl.places.length) return res;
    MM.ALL_IN.forEach(function (t) {
      var tp = {}; blockPlaces(t).forEach(function (p) { tp[p] = 1; });
      var tk = Object.keys(tp), hit = tk.filter(function (p) { return mine[p]; });
      var cover = hit.length / tk.length;
      var dayFit = pl.totals.days ? Math.min(pl.totals.days, t.days) / Math.max(pl.totals.days, t.days) : 0;
      if (cover >= 0.6 && dayFit >= 0.5) {
        var missing = tk.filter(function (p) { return !mine[p]; }), extra = pl.places.filter(function (p) { return !tp[p]; });
        res.push({ trip: t, cover: cover, dayFit: dayFit, score: cover * 0.7 + dayFit * 0.3, hit: hit, missing: missing, extra: extra,
          save: pl.totals.diy - t.usd, next: nextDeparture(t, parseDate(state.start)) });
      }
    });
    return res.sort(function (a, b) { return b.score - a.score; }).slice(0, 2);
  }

  /* ============================================================
     AUTO-ACTIVITIES — pick the best few for a stop
     ============================================================ */
  var VIBE_TAGS = { party: ['party'], islands: ['beach', 'water'], moto: ['moto', 'mountains'], culture: ['culture'], adventure: ['adventure', 'trek', 'nature'],
    food: ['food'], chill: ['chill', 'nature'], surf: ['surf', 'dive', 'water'] };
  MM.VIBES = [
    { k: 'party', n: 'Party + people', sub: 'Pub crawls, boat parties, nights that go long' },
    { k: 'islands', n: 'Islands + beaches', sub: 'Turtles, boat days, barefoot' },
    { k: 'moto', n: 'Motorbikes + mountains', sub: 'The Loop, passes, homestays' },
    { k: 'culture', n: 'Culture + history', sub: 'Temples, museums, old towns' },
    { k: 'adventure', n: 'Adventure', sub: 'Treks, caves, ziplines, waterfalls' },
    { k: 'food', n: 'Food', sub: 'Street food, cooking classes' },
    { k: 'chill', n: 'Slow + chill', sub: 'Pools, hammocks, no alarms' },
    { k: 'surf', n: 'Surf + dive', sub: 'Learn it or live it' }];
  MM.MUSTS = [
    { k: 'loop', n: 'Ride the Ha Giang Loop', test: function (a) { return /ha-giang-loop/.test(a.id); } },
    { k: 'angkor', n: 'See Angkor Wat at sunrise', test: function (a) { return a.id === 'sunrise-angkor-wat-temple-tour'; } },
    { k: 'surf', n: 'Learn to surf', test: function (a) { return a.tags.indexOf('surf') > -1; } },
    { k: 'dive', n: 'Dive or snorkel', test: function (a) { return a.tags.indexOf('dive') > -1; } },
    { k: 'trek', n: 'Trek a volcano or mountain', test: function (a) { return a.tags.indexOf('trek') > -1; } },
    { k: 'islandhop', n: 'Island hop by boat', test: function (a) { return /island-hopping|tri-island|dolphin|nusa-penida|lan-ha|ha-long|phi phi/i.test(a.id + ' ' + a.n); } },
    { k: 'wildlife', n: 'Meet elephants + wildlife', test: function (a) { return a.tags.indexOf('wildlife') > -1; } },
    { k: 'party', n: 'A proper party', test: function (a) { return a.cat === 'night' && a.tags.indexOf('party') > -1 && (a.usd == null || a.usd > 6); } }];

  function autoActs(placeId, nights, prof) {
    var vibes = (prof && prof.vibes) || [], musts = (prof && prof.must) || [], budget = (prof && prof.budget) || 'mid';
    var want = {}; vibes.forEach(function (v) { (VIBE_TAGS[v] || []).forEach(function (t) { want[t] = 1; }); });
    var capUsd = { cheap: 140, mid: 320, splash: 1e9 }[budget];
    var list = MM.actsAt(placeId).filter(function (a) { return (a.usd == null || a.usd <= capUsd); }).filter(function (a) { return !(a.multi && a.multi.d > 1) || musts.some(function (m) { var M = MM.MUSTS.filter(function (x) { return x.k === m; })[0]; return M && M.test(a); }); });
    var scored = list.map(function (a) {
      var s = a.star ? 2 : 0; a.tags.forEach(function (t) { if (want[t]) s += 1.5; });
      musts.forEach(function (m) { var M = MM.MUSTS.filter(function (x) { return x.k === m; })[0]; if (M && M.test(a)) s += 6; });
      if (budget === 'cheap') { if (a.usd > 60) s -= 4; else if (a.usd > 35) s -= 2; if (a.usd != null && a.usd < 20) s += 0.5; }
      if (a.multi && a.multi.d > 1 && !musts.some(function (m) { var M = MM.MUSTS.filter(function (x) { return x.k === m; })[0]; return M && M.test(a); })) s -= 5;
      if (a.cat === 'night' && a.usd == null) s -= 0.5;
      return { a: a, s: s };
    }).sort(function (x, y) { return y.s - x.s; });
    // fill capacity: ~1 daytime + 1 evening per night (arrival day lighter)
    var capDay = Math.max(1, nights - 1) + (nights >= 3 ? 1 : 0), capEve = Math.max(1, Math.min(nights, 3)), pick = [], day = 0, eve = 0, epicN = 0;
    scored.forEach(function (x) {
      if (x.s <= 0 && pick.length >= 1) return;
      var a = x.a;
      if (a.multi && a.multi.n > 0) { if (epicN < 1) { pick.push(a.id); epicN++; } return; }
      if (a.slot === 'eve') { if (eve < capEve) { pick.push(a.id); eve++; } }
      else { var cost = a.slot === 'full' ? 2 : 1; if (day + cost <= capDay * 2 - 1 || day === 0) { pick.push(a.id); day += cost; } }
    });
    return pick.slice(0, Math.max(2, budget === 'cheap' ? nights : nights + 1));
  }
  MM.autoActs = autoActs;

  /* ============================================================
     SUGGEST — quiz answers -> best-fit routes
     profile {start, days, month(0-11)|null, vibes[], must[], budget, crew}
     ============================================================ */
  function cloneStops(stops) { return stops.map(function (s) { return { p: s.p, n: s.n, acts: s.acts.slice() }; }); }
  function toState(stops, prof, extra) {
    var st = defaultState();
    st.items = stops.map(function (s) { return { kind: 'stop', p: s.p, n: s.n, acts: s.acts.slice() }; });
    st.pref = (prof && prof.budget === 'cheap') ? 'cheap' : (prof && prof.budget === 'splash') ? 'fast' : 'balanced';
    if (prof && prof.startDate) st.start = prof.startDate;
    if (prof && prof.month != null) st.month = prof.month;
    st.fund = prof && prof.budget === 'cheap' ? 14 : prof && prof.budget === 'splash' ? 30 : 20;
    st.crew = prof && prof.crew || 0;
    if (extra) for (var k in extra) st[k] = extra[k];
    return st;
  }
  function placeMatchesStart(p, start) {
    if (!start) return true; if (p === start) return true;
    var sameHub = { bangkok: ['bangkok'], hanoi: ['hanoi'], saigon: ['saigon'], uluwatu: ['uluwatu', 'nusa-lembongan'], manila: ['manila'], 'phnom-penh': ['phnom-penh', 'siem-reap'] };
    return (sameHub[start] || []).indexOf(p) > -1;
  }
  function orient(tpl, start) {
    var stops = cloneStops(tpl.stops);
    if (!start) return { stops: stops, ok: true, reversed: false };
    if (placeMatchesStart(stops[0].p, start)) return { stops: stops, ok: true, reversed: false };
    if (placeMatchesStart(stops[stops.length - 1].p, start) && !tpl.fixedDir) return { stops: stops.reverse(), ok: true, reversed: true };
    return { stops: stops, ok: false, reversed: false };
  }
  // Template epics (the Loop, a cruise) are the point of a route, so they survive re-picking.
  function finalizeActs(stops, prof, seedEpics) {
    stops.forEach(function (s, i) {
      var keep = (seedEpics[i] || s.acts || []).filter(function (id) { var a = MM.ACTS[id]; return a && a.multi && a.multi.n > 0; });
      var pick = autoActs(s.p, s.n, prof).filter(function (id) { return keep.indexOf(id) < 0; });
      s.acts = keep.concat(pick);
    });
  }
  function fitDays(stops, target, prof, minNights) {
    var guard = 0;
    function days() { return plan(toState(stops, prof)).totals.days; }
    var d = days();
    // shrink: trim biggest stops first, then drop low-value middle stops
    while (d > target && guard++ < 60) {
      var biggest = null; stops.forEach(function (s, i) { var floor = Math.max(1, (minNights || 1)); if (s.n > floor && (!biggest || s.n >= stops[biggest].n)) biggest = i; });
      if (biggest !== null && stops[biggest].n > 1 + (stops.length > 3 ? 0 : 1)) { stops[biggest].n--; }
      else if (stops.length > 2) { // drop the stop with the fewest picks (not first/last if possible)
        var idx = 1, best = Infinity; for (var i = 1; i < stops.length - 1; i++) if (stops[i].acts.length < best) { best = stops[i].acts.length; idx = i; }
        stops.splice(idx, 1);
      } else if (biggest !== null && stops[biggest].n > 1) stops[biggest].n--; else break;
      d = days();
    }
    // grow: add nights where they pay off most (furthest below suggested), up to suggested + 2
    var g2 = 0;
    while (d < target - 1 && g2++ < 80) {
      var cand = -1, gap = -99;
      stops.forEach(function (s, i) { var pl = P()[s.p], cap = pl.sug + 2; if (s.n < cap && (pl.sug - s.n) > gap) { gap = pl.sug - s.n; cand = i; } });
      if (cand < 0) break; stops[cand].n++; d = days();
    }
    return { stops: stops, days: d };
  }
  function extend(stops, target, prof) {
    var used = {}; stops.forEach(function (s) { used[s.p] = 1; });
    var guard = 0; var d = plan(toState(stops, prof)).totals.days;
    while (target - d >= 3 && guard++ < 6) {
      var last = P()[stops[stops.length - 1].p], nxt = null;
      var want = {}; ((prof && prof.vibes) || []).forEach(function (v) { (VIBE_TAGS[v] || []).forEach(function (t) { want[t] = 1; }); });
      var best = -1;
      last.next.forEach(function (id) {
        var pl = P()[id]; if (!pl || used[id] || pl.partner && false) return;
        var s = 1 + pl.tags.filter(function (t) { return want[t]; }).length;
        if (s > best) { best = s; nxt = id; }
      });
      if (!nxt) break;
      var room = target - d, nights = Math.max(1, Math.min(P()[nxt].sug, room - 2));
      stops.push({ p: nxt, n: nights, acts: [], _ext: true }); used[nxt] = 1;
      d = plan(toState(stops, prof)).totals.days;
    }
    return stops;
  }

  function suggest(prof) {
    prof = prof || {}; var out = [];
    var target = Math.max(4, prof.days || 14);
    var vibeTags = {}; (prof.vibes || []).forEach(function (v) { (VIBE_TAGS[v] || []).forEach(function (t) { vibeTags[t] = 1; }); });
    var month = prof.month;

    function evaluate(cand, isAllIn) {
      var tpl = cand.tpl, o = orient(tpl, prof.start);
      var stops = o.stops, fitted, items;
      if (isAllIn) { fitted = { days: tpl.days }; }
      else {
        var seedList = stops.map(function (s0) { return s0.acts.filter(function (id) { var a = MM.ACTS[id]; return a && a.multi && a.multi.n > 0; }); });
        finalizeActs(stops, prof, seedList);
        fitted = fitDays(stops, target, prof);
        if (target - fitted.days >= 3) { stops = extend(stops, target, prof); }
        var seed2 = stops.map(function (s1, i1) { return i1 < seedList.length && !s1._ext ? s1.acts.filter(function (id) { var a = MM.ACTS[id]; return a && a.multi && a.multi.n > 0; }) : []; });
        finalizeActs(stops, prof, seed2);
        fitted.days = plan(toState(stops, prof)).totals.days;
        if (fitted.days > target + 1) { fitted = fitDays(stops, target, prof); finalizeActs(stops, prof, stops.map(function (s2) { return s2.acts; })); fitted.days = plan(toState(stops, prof)).totals.days; }
      }
      var score = 0, why = [];
      // vibe fit
      var tvib = tpl.tags ? tpl.tags.split(' ') : [];
      if (isAllIn) { tvib = []; blockPlaces(tpl).forEach(function (p) { P()[p].tags.forEach(function (t) { if (tvib.indexOf(t) < 0) tvib.push(t); }); }); }
      var vhit = tvib.filter(function (t) { return vibeTags[t]; }).length; score += vhit * 2.2; if (vhit) why.push('matches your vibe');
      // must-dos
      var allActs = []; if (isAllIn) tpl.stops.forEach(function (s) { allActs = allActs.concat(s.acts.map(function (id) { return MM.ACTS[id]; })); });
      else stops.forEach(function (s) { allActs = allActs.concat(s.acts.map(function (id) { return MM.ACTS[id]; })); });
      var musts = prof.must || [], mHit = 0;
      musts.forEach(function (k) { var M = MM.MUSTS.filter(function (x) { return x.k === k; })[0]; if (M && allActs.some(function (a) { return a && M.test(a); })) { mHit++; score += 4; } else score -= 1.5; });
      if (mHit) why.push(mHit + ' of your must-dos');
      // days fit
      var diff = Math.abs(fitted.days - target); score -= diff * 0.9; if (diff <= 1) why.push('fits your ' + target + ' days');
      if (fitted.days > target + 1) score -= 6;
      // start fit: land at an end of the route (+4), or be a short hop away (+1.5), or be far (-4)
      if (prof.start) {
        var first = isAllIn ? blockFirst(tpl) : stops[0].p;
        if (isAllIn ? placeMatchesStart(first, prof.start) : o.ok) { score += 4; why.push('starts where you land' + (o.reversed ? ' (run in reverse)' : '')); }
        else { var hop = route(prof.start, first, 'balanced'); if (hop && hop.h <= 6) { score += 1.5; why.push('one short hop from where you land'); } else score -= 4; }
      }
      // over-trimmed routes feel rushed
      if (!isAllIn && tpl.min && fitted.days < tpl.min) score -= (tpl.min - fitted.days) * 0.8;
      // season
      if (month != null) {
        var places = isAllIn ? blockPlaces(tpl) : stops.map(function (s) { return s.p; });
        var avg = places.reduce(function (a, p) { return a + seasonOf(p, month); }, 0) / places.length;
        score += (avg - 2) * 3; if (avg >= 2.6) why.push('prime season in ' + MONTHN[month]);
      }
      // budget
      var st = isAllIn ? null : plan(toState(stops, prof)), perDay = isAllIn ? tpl.usd / tpl.days : st.totals.total / st.totals.days;
      if (prof.budget === 'cheap' && perDay > 55) score -= 3; if (prof.budget === 'cheap' && perDay < 40) score += 1;
      if (isAllIn) { score += 1.5; if (tpl.status === 'soon') score -= 0.5; if (prof.crew === 'crew' || prof.crew === 'solo') score += 0.5; }
      return { cand: cand, isAllIn: isAllIn, score: score, why: why, state: isAllIn ? { items: [{ kind: 'allin', trip: tpl.id }] } : toState(stops, prof), days: fitted.days, o: o };
    }
    MM.CLASSICS.forEach(function (c) { out.push(evaluate({ tpl: c }, false)); });
    MM.ALL_IN.forEach(function (t) { out.push(evaluate({ tpl: t }, true)); });
    out.sort(function (a, b) { return b.score - a.score; });
    // hybrid: if the user wants more days than the best ALL IN, offer ALL IN + DIY extension
    var topAll = out.filter(function (x) { return x.isAllIn; })[0];
    if (topAll && target - topAll.days >= 4) {
      var tpl = topAll.cand.tpl, used = {}; blockPlaces(tpl).forEach(function (p) { used[p] = 1; });
      var st = defaultState(); st.items = [{ kind: 'allin', trip: tpl.id }];
      st.pref = 'balanced'; st.fund = 20; if (prof.startDate) st.start = prof.startDate; if (prof.month != null) st.month = prof.month;
      var lastP = blockLast(tpl), guard = 0;
      while (guard++ < 5 && target - plan(st).totals.days >= 3) {
        var want = {}; (prof.vibes || []).forEach(function (v) { (VIBE_TAGS[v] || []).forEach(function (t) { want[t] = 1; }); });
        var nx = null, bs = -1;
        P()[lastP].next.forEach(function (id) { if (used[id]) return; var sc = 1 + P()[id].tags.filter(function (t) { return want[t]; }).length; if (sc > bs) { bs = sc; nx = id; } });
        if (!nx) break;
        var room = target - plan(st).totals.days, nights = Math.max(1, Math.min(P()[nx].sug, room - 2));
        st.items.push({ kind: 'stop', p: nx, n: nights, acts: autoActs(nx, nights, prof) }); used[nx] = 1; lastP = nx;
      }
      if (st.items.length > 1) {
        var hyb = { cand: { tpl: tpl, hybrid: true }, isAllIn: true, hybrid: true, score: topAll.score + 0.8, why: topAll.why.concat(['ALL IN, then keep going']), state: st, days: plan(st).totals.days, o: {} };
        out.push(hyb); out.sort(function (a, b) { return b.score - a.score; });
      }
    }
    // from-scratch routes lead; a packaged ALL IN only makes the cut when it genuinely fits
    var gen = generate(prof), bestAll = out.filter(function (x) { return x.isAllIn; })[0];
    var mixed = gen.slice(0, 2);
    if (bestAll && bestAll.score >= 8) mixed.splice(1, 0, bestAll);
    while (mixed.length < 3 && gen[mixed.length]) mixed.push(gen[mixed.length]);
    if (mixed.length) return mixed.slice(0, 3);
    // keep top 3 distinct
    var seen = {}, top = [];
    out.forEach(function (x) { var k = x.cand.tpl.id + (x.hybrid ? '+' : ''); if (!seen[k] && top.length < 3) { seen[k] = 1; top.push(x); } });
    return top;
  }

  /* ============================================================
     GENERATE — build a route from scratch
     Scores every hostel against vibe / must-dos / month / budget, then beam-searches
     the real transport graph for the best sequence that fits the days and the money.
     ============================================================ */
  function vibesGiven(p) { return !!(p && p.vibes && p.vibes.length); }
  var PERDAY = { cheap: 45, mid: 80, splash: 140 };           // all-in USD/day on the ground (no flights home)
  MM.PERDAY = PERDAY;
  var GATES = ['bangkok', 'hanoi', 'uluwatu', 'manila', 'phnom-penh', 'siem-reap', 'chiang-mai', 'luang-prabang', 'hoi-an'];
  function mustHit(placeId, k) { var M = MM.MUSTS.filter(function (x) { return x.k === k; })[0]; return !!M && MM.actsAt(placeId).some(function (a) { return M.test(a); }); }

  function generate(prof) {
    prof = prof || {};
    var D = Math.max(4, prof.days || 14), budget = prof.budget || 'mid', perDay = prof.perDay || PERDAY[budget], cap = perDay * D;
    var fund = budget === 'cheap' ? 14 : budget === 'splash' ? 30 : 20, pref = budget === 'cheap' ? 'cheap' : budget === 'splash' ? 'fast' : 'balanced';
    var maxLeg = budget === 'splash' ? 20 : budget === 'cheap' ? 11 : 13, nightsCap = D - 1, switchPen = D < 12 ? 3.5 : D < 20 ? 1.6 : 0.8;
    var want = {}; (prof.vibes || []).forEach(function (v) { (VIBE_TAGS[v] || []).forEach(function (t) { want[t] = 1; }); });
    var musts = prof.must || [], month = prof.month;
    var ids = Object.keys(P()).filter(function (id) { return !P()[id].partner || id === prof.start; });

    var ps = {};
    ids.forEach(function (id) {
      var p = P()[id], sc = 0;
      p.tags.forEach(function (t) { if (want[t]) sc += 2; });
      MM.actsAt(id).forEach(function (a) { if (a.star) sc += 0.25; a.tags.forEach(function (t) { if (want[t]) sc += 0.12; }); });
      musts.forEach(function (k) { if (mustHit(id, k)) sc += 6; });
      if (month != null) sc += ({ 3: 1.5, 2: 0, 1: -3.5 })[seasonOf(id, month)];
      if (budget === 'cheap') sc += (12 - p.bed) * 0.2; if (budget === 'splash') sc += 0.5;
      if (!(vibesGiven(prof)) && !musts.length) sc += 1;
      ps[id] = sc;
    });
    function nightsFor(id, remaining) {
      var p = P()[id], base = Math.round(p.sug * (0.8 + Math.max(0, ps[id]) / 16));
      return Math.max(1, Math.min(remaining, Math.max(p.min, Math.min(p.sug + 2, base))));
    }
    var starts = prof.start ? [prof.start] : GATES.filter(function (g) { return P()[g]; }).sort(function (a, b) { return ps[b] - ps[a]; }).slice(0, 6);
    var beam = [], done = [];
    starts.forEach(function (s) {
      var n = nightsFor(s, nightsCap - 0), bed = P()[s].bed * n + n * fund + n * 10;
      beam.push({ seq: [{ p: s, n: n }], used: n, cost: bed, score: ps[s] * Math.pow(n, 0.85) + 1, h: 0, sw: 0 });
    });
    for (var depth = 0; depth < 9 && beam.length; depth++) {
      var next = [];
      beam.forEach(function (st) {
        var left = nightsCap - st.used;
        if (left <= 2) { done.push(st); return; }
        var last = st.seq[st.seq.length - 1].p, grew = false;
        ids.forEach(function (q) {
          if (st.seq.some(function (x) { return x.p === q; })) return;
          var leg = route(last, q, pref); if (!leg || leg.h > maxLeg) return;
          var rem = left - leg.nights; if (rem < 1) return;
          var n = nightsFor(q, rem), cost = st.cost + leg.u + P()[q].bed * n + (n + leg.nights) * fund + n * 10;
          if (cost > cap * 1.12) return;
          var same = P()[q].c === P()[last].c, back = !same && st.seq.some(function (x) { return P()[x.p].c === P()[q].c; });
          next.push({ seq: st.seq.concat([{ p: q, n: n }]), used: st.used + leg.nights + n, cost: cost,
            score: st.score + ps[q] * Math.pow(n, 0.85) - 0.7 * leg.h - (same ? 0 : switchPen) - (back ? 12 : 0) + (same ? 0.8 : 0), h: st.h + leg.h, sw: st.sw + (same ? 0 : 1) });
          grew = true;
        });
        done.push(st);                                  // stopping here is always an option
      });
      next.sort(function (a, b) { return b.score - a.score; }); beam = next.slice(0, 60);
    }
    beam.forEach(function (b) { done.push(b); });

    // rank: reward using the days (empty days are wasted), penalise stop-hopping on short trips
    var ranked = done.map(function (st) {
      var cover = Math.min(1, st.used / nightsCap), mh = 0; musts.forEach(function (k) { if (st.seq.some(function (x) { return mustHit(x.p, k); })) mh++; });
      var rush = Math.max(0, st.seq.length - Math.ceil(D / 3.2));
      return { st: st, total: st.score * (0.55 + 0.45 * cover) - rush * 2.5 + mh * 2 - (musts.length - mh) * 4 };
    }).sort(function (a, b) { return b.total - a.total; });

    var well = ranked.filter(function (r) { return r.st.used >= nightsCap * 0.85; }); if (well.length >= 3) ranked = well;
    var seen = {}, picks = [];
    ranked.forEach(function (r) {
      if (picks.length >= 3) return;
      var cset = {}; r.st.seq.forEach(function (x) { cset[P()[x.p].c] = 1; });
      var key = Object.keys(cset).sort().join('') + '|' + r.st.seq[0].p + '|' + r.st.seq[r.st.seq.length - 1].p;
      var key2 = r.st.seq.map(function (x) { return x.p; }).slice().sort().join(',');
      if (seen[key] || seen[key2]) return; seen[key] = seen[key2] = 1;
      // near-duplicates (share >60% of places with a pick already made) are skipped
      var dup = picks.some(function (pk) { var a = pk.st.seq.map(function (x) { return x.p; }), b = r.st.seq.map(function (x) { return x.p; }); var sh = a.filter(function (p) { return b.indexOf(p) > -1; }).length; return sh / Math.max(a.length, b.length) > 0.6; });
      if (dup) return; picks.push(r);
    });
    if (picks.length < 3) ranked.forEach(function (r) { if (picks.length < 3 && picks.indexOf(r) < 0 && !picks.some(function (pk) { return pk.st.seq.map(function (x) { return x.p; }).sort().join() === r.st.seq.map(function (x) { return x.p; }).sort().join(); })) picks.push(r); });

    return picks.map(function (r, i) {
      var stops = r.st.seq.map(function (x) { return { p: x.p, n: x.n, acts: [] }; });
      stops.forEach(function (s) { s.acts = autoActs(s.p, s.n, prof); });
      var fit = fitDays(stops, D, prof);
      // top the days back up if must-do epics ate none and we ended short
      if (D - fit.days >= 2) { var g = 0; while (D - plan(toState(stops, prof)).totals.days >= 2 && g++ < 6) { var b = 0; stops.forEach(function (s, j) { if (P()[s.p].sug + 2 - s.n > P()[stops[b].p].sug + 2 - stops[b].n) b = j; }); if (stops[b].n >= P()[stops[b].p].sug + 2) break; stops[b].n++; } }
      var stt = toState(stops, prof); stt.fund = fund; var pl = plan(stt);
      var cs = {}; stops.forEach(function (s) { cs[P()[s.p].c] = 1; });
      var why = ['built from scratch for you', 'about ' + MM.money(Math.round(pl.totals.total / pl.totals.days), 'USD') + ' a day, inside your budget'];
      if (prof.start && stops[0].p === prof.start) why.push('starts where you land');
      var mh = musts.filter(function (k) { return stops.some(function (s) { return mustHit(s.p, k); }); }).length; if (mh) why.push(mh + ' of your must-dos');
      if (month != null) { var av = stops.reduce(function (a, s) { return a + seasonOf(s.p, month); }, 0) / stops.length; if (av >= 2.5) why.push('prime season in ' + MONTHN[month]); }
      return { cand: { tpl: { id: 'custom-' + i, n: stops.map(function (s) { return P()[s.p].n; }).join(' → '), pitch: 'Picked by scoring every Mad Monkey for your vibe, budget and days, then routing the real buses, boats and flights between them.' } },
        isAllIn: false, generated: true, score: 100 - i, why: why, state: stt, days: pl.totals.days, o: {} };
    });
  }
  MM.generate = generate;

  MM.suggest = suggest; MM.orient = orient;

  /* ============================================================
     SHARE — compact state <-> URL hash
     ============================================================ */
  // Short, stable activity codes keep share links short. Derived from the id (FNV-1a), so
  // adding/reordering activities never breaks old links. Raw ids still decode.
  var codeOf = null, idOf = null;
  function fnv(str) { var h = 0x811c9dc5; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h; }
  function buildCodes() {
    codeOf = {}; idOf = {};
    Object.keys(MM.ACTS).sort().forEach(function (id) {
      var c = ('00000' + fnv(id).toString(36)).slice(-5), k = 0;
      while (idOf[c]) { k++; c = ('00000' + (fnv(id + k)).toString(36)).slice(-5); }
      codeOf[id] = c; idOf[c] = id;
    });
  }
  MM.actCode = function (id) { if (!codeOf) buildCodes(); return codeOf[id]; };
  function encodeState(st) {
    if (!codeOf) buildCodes();
    var parts = (st.items || []).map(function (it) {
      if (it.kind === 'allin') return 'a.' + it.trip;
      return 's.' + it.p + '.' + it.n + (it.acts && it.acts.length ? '.' + it.acts.map(function (id) { return codeOf[id] || encodeURIComponent(id); }).join('+') : '');
    });
    var q = ['i=' + parts.join('~')];
    if (st.start) q.push('d=' + st.start);
    if (st.pref && st.pref !== 'balanced') q.push('p=' + st.pref);
    if (st.fund && st.fund !== 18) q.push('f=' + st.fund);
    if (st.crew) q.push('c=' + st.crew);
    var lp = Object.keys(st.legPick || {}).map(function (k) { return k + ':' + st.legPick[k]; }).join(',');
    if (lp) q.push('l=' + lp);
    if (st.month != null && !st.start) q.push('m=' + st.month);
    return q.join('&');
  }
  function decodeState(str) {
    var st = defaultState(); if (!str) return st;
    str = str.replace(/^#?t?=?/, '');
    var map = {}; str.split('&').forEach(function (kv) { var i = kv.indexOf('='); if (i > 0) map[kv.slice(0, i)] = kv.slice(i + 1); });
    (map.i || '').split('~').forEach(function (tok) {
      var f = tok.split('.');
      if (f[0] === 'a' && MM.ALL_IN.some(function (t) { return t.id === f[1]; })) st.items.push({ kind: 'allin', trip: f[1] });
      else if (f[0] === 's' && P()[f[1]]) {
        var n = Math.max(1, Math.min(30, parseInt(f[2], 10) || 2));
        if (!idOf) buildCodes();
        var acts = (f[3] ? f[3].split('+').map(function (tok) { return idOf[tok] || decodeURIComponent(tok); }) : []).filter(function (id) { return MM.ACTS[id] && MM.ACTS[id].p === f[1]; });
        st.items.push({ kind: 'stop', p: f[1], n: n, acts: acts });
      }
    });
    if (map.d && parseDate(map.d)) st.start = map.d;
    if (map.p && TV[map.p]) st.pref = map.p;
    if (map.f) st.fund = Math.max(0, Math.min(100, parseInt(map.f, 10) || 18));
    if (map.c) st.crew = Math.max(0, Math.min(12, parseInt(map.c, 10) || 0));
    if (map.m != null && map.m !== '') st.month = Math.max(0, Math.min(11, parseInt(map.m, 10) || 0));
    if (map.l) map.l.split(',').forEach(function (kv) { var q = kv.split(':'); if (TV[q[1]]) st.legPick[q[0]] = q[1]; });
    return st;
  }
  MM.encodeState = encodeState; MM.decodeState = decodeState;

  /* ============================================================
     TEXT OUTPUT — for WhatsApp / copy / lead card
     ============================================================ */
  function routeLine(pl) { return pl.places.map(function (p) { return P()[p].n; }).join(' → '); }
  function planText(pl, state, cur) {
    var t = pl.totals, L = [];
    L.push('MY MAD MONKEY TRIP');
    L.push(routeLine(pl));
    L.push(t.days + ' days · ' + t.stops + (t.stops === 1 ? ' stop · ' : ' stops · ') + pl.countries.length + (pl.countries.length === 1 ? ' country · ~' : ' countries · ~') + MM.money(t.total, cur) + ' est.');
    L.push('');
    pl.days.forEach(function (d) {
      if (d.kind === 'depart') { L.push('Day ' + d.n + (d.dateLabel ? ' (' + d.dateLabel + ')' : '') + ': check out + onward travel'); return; }
      var s = 'Day ' + d.n + (d.dateLabel ? ' (' + d.dateLabel + ')' : '') + ': ' + d.title;
      if (d.travel && d.kind === 'stay') s += ' [' + d.travel.chosen.modeLabel + ', ~' + hoursLabel(d.travel.chosen.h) + ']';
      if (d.kind === 'move') s += ' [' + d.travel.chosen.modeLabel + ' to ' + P()[d.travel.to].n + ']';
      var a = (d.acts || []).map(function (x) { return MM.ACTS[x.id].n; });
      if (a.length) s += ' · ' + a.join(', ');
      L.push(s);
    });
    L.push(''); L.push('Built with the Mad Monkey Trip Builder. Prices are estimates; the crew confirms live rates.');
    return L.join('\n');
  }
  function leadPayload(state, pl, contact, meta) {
    var m = pl.match && pl.match[0];
    return {
      v: 1, createdAt: new Date().toISOString(), source: (meta && meta.source) || 'trip-builder', ref: (meta && meta.ref) || '', fromHostel: (meta && meta.fromHostel) || '',
      contact: contact, trip: { link: (meta && meta.link) || '', state: encodeState(state), route: routeLine(pl), days: pl.totals.days, nights: pl.totals.nights, countries: pl.countries,
        stops: pl.places, start: state.start || '', estTotalUsd: pl.totals.total, breakdownUsd: { beds: pl.totals.beds, activities: pl.totals.acts, transport: pl.totals.transport, allIn: pl.totals.allin, squadDiscount: pl.totals.squad, spendFund: pl.totals.fund },
        allInBlocks: (state.items || []).filter(function (i) { return i.kind === 'allin'; }).map(function (i) { return i.trip; }), allInMatch: m ? m.trip.id : '', crewMates: state.crew || 0,
        urgency: urgencyOf(state) },
      itinerary: planText(pl, state, 'USD')
    };
  }
  function urgencyOf(state) {
    var d = parseDate(state.start); if (!d) return 'planning';
    var days = (d.getTime() - Date.now()) / 86400000;
    return days <= 14 ? 'hot' : days <= 60 ? 'warm' : 'cool';
  }
  MM.planText = planText; MM.leadPayload = leadPayload; MM.routeLine = routeLine; MM.autoActs = autoActs; MM.urgencyOf = urgencyOf;

  if (typeof module !== 'undefined' && module.exports) module.exports = MM;
})(typeof window !== 'undefined' ? window : globalThis);
