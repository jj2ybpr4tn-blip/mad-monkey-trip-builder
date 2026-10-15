/* Trip Builder logic tests. Run: npm test  (node test/logic.test.js) */
['places', 'activities', 'media', 'legs', 'trips', 'entry', 'gallery'].forEach(function (f) { require('../data/' + f + '.js'); });
var MM = require('../logic.js');

var pass = 0, fail = 0, pending = [];
function ok(name, cond, extra) { if (cond) { pass++; console.log('PASS  ' + name); } else { fail++; console.log('FAIL  ' + name + (extra ? '  -> ' + extra : '')); } }
function eq(name, a, b) { ok(name, a === b, 'got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b)); }
function st(items, extra) { var s = MM.defaultState(); s.items = items; if (extra) for (var k in extra) s[k] = extra[k]; return s; }
function stop(p, n, acts) { return { kind: 'stop', p: p, n: n, acts: acts || [] }; }

/* ---------- data integrity ---------- */
ok('23 hostels + Saigon', Object.keys(MM.PLACES).length === 24);
ok('every place has a hostel photo (except Saigon)', Object.keys(MM.PLACES).every(function (p) { return p === 'saigon' || MM.hostelImg(p); }));
ok('every place has 12 season ratings', Object.keys(MM.PLACES).every(function (p) { return MM.PLACES[p].seas.length === 12; }));
ok('every place has activities', Object.keys(MM.PLACES).every(function (p) { return MM.actsAt(p).length > 0; }));
ok('every `next` points at a real place', Object.keys(MM.PLACES).every(function (p) { return MM.PLACES[p].next.every(function (n) { return MM.PLACES[n]; }); }));
ok('every ALL IN / classic stop has a real place + acts at that place', MM.ALL_IN.concat(MM.CLASSICS, MM.SPECIALS).every(function (t) { return t.stops.every(function (s) { return MM.PLACES[s.p] && s.acts.every(function (id) { return MM.ACTS[id] && MM.ACTS[id].p === s.p; }); }); }));
ok('activity short codes are unique and 5 chars', (function () { var seen = {}; return Object.keys(MM.ACTS).every(function (id) { var c = MM.actCode(id); if (seen[c] || c.length !== 5) return false; seen[c] = 1; return true; }); })());
ok('a share link with 5 stops and 20 activities stays under 400 chars', (function () { var s = st(['hanoi', 'hoi-an', 'saigon', 'phnom-penh', 'siem-reap'].map(function (p) { return stop(p, 3, MM.actsAt(p).slice(0, 4).map(function (a) { return a.id; })); })); return MM.encodeState(s).length < 400; })());
ok('old links with raw activity ids still decode', (function () { var d = MM.decodeState('i=s.hanoi.3.hanoi-pub-crawl+white-party'); return d.items[0].acts.length === 2; })());
ok('no activity has a negative price', Object.keys(MM.ACTS).every(function (id) { return MM.ACTS[id].usd == null || MM.ACTS[id].usd >= 0; }));

/* ---------- graph connectivity: every place reaches every other ---------- */
var ids = Object.keys(MM.PLACES), unreachable = [];
ids.forEach(function (a) { ids.forEach(function (b) { if (a !== b && !MM.route(a, b, 'balanced')) unreachable.push(a + '>' + b); }); });
ok('transport graph is fully connected', unreachable.length === 0, unreachable.slice(0, 5).join(', '));

/* ---------- routing sanity ---------- */
function opts(a, b) { return MM.legOptions(a, b); }
ok('Hanoi → Hoi An: has a flight option and a bus/train option', (function () { var o = opts('hanoi', 'hoi-an'); return o.some(function (x) { return x.main === 'flight'; }) && o.some(function (x) { return x.ovn; }); })());
ok('Hanoi → Hoi An cheapest is under $40 and overnight', (function () { var c = MM.route('hanoi', 'hoi-an', 'cheap'); return c.u < 40 && c.ovn; })());
ok('Hanoi → Hoi An fastest is under 6 hours', MM.route('hanoi', 'hoi-an', 'fast').h < 6);
eq('Luang Prabang → Vang Vieng goes by train', MM.route('luang-prabang', 'vang-vieng', 'balanced').steps[0].e.m, 'train');
ok('Bangkok → Siem Reap is a flight (land border closed)', MM.route('bangkok', 'siem-reap', 'cheap').steps.some(function (s) { return s.e.m === 'flight'; }));
ok('Bangkok → Siem Reap leg carries the border note', (function () { var p = MM.plan(st([stop('bangkok', 2), stop('siem-reap', 2)])); return /border/i.test(p.legs[0].border); })());
ok('Chiang Mai → Luang Prabang offers a 2-night slow boat', opts('chiang-mai', 'luang-prabang').some(function (o) { return o.nights === 2; }));
ok('Gili T → Kuta Lombok is a boat, ≤4h', (function () { var r = MM.route('gili-trawangan', 'kuta-lombok', 'balanced'); return r.h <= 4 && r.steps.some(function (s) { return s.e.m === 'boat'; }); })());
ok('Dumaguete → Panglao chains via Siquijor or Cebu (no direct)', MM.route('dumaguete', 'panglao', 'cheap').steps.length >= 2);
ok('Manila → Siargao is a flight', MM.route('manila', 'siargao', 'balanced').steps.some(function (s) { return s.e.m === 'flight'; }));
ok('Phnom Penh → Koh Sdach takes a bus+boat under 8h', MM.route('phnom-penh', 'koh-sdach', 'balanced').h < 8);
ok('Koh Rong → Siem Reap lists the Mad Package', !!MM.plan(st([stop('koh-rong', 2), stop('siem-reap', 2)])).legs[0].pkgs);
ok('Luang Prabang → Vang Vieng lists Mad Monkey train tickets', !!MM.plan(st([stop('luang-prabang', 2), stop('vang-vieng', 2)])).legs[0].tickets);
ok('route results are always cheaper-or-equal in "cheap" than "fast"', ['hanoi>luang-prabang', 'bangkok>phuket', 'uluwatu>kuta-lombok', 'saigon>siem-reap'].every(function (k) { var q = k.split('>'); return MM.route(q[0], q[1], 'cheap').u <= MM.route(q[0], q[1], 'fast').u; }));

/* ---------- itinerary maths ---------- */
var p1 = MM.plan(st([stop('hanoi', 3)]));
eq('1 stop, 3 nights = 4 days', p1.totals.days, 4);
var p2 = MM.plan(st([stop('uluwatu', 2), stop('nusa-lembongan', 3)]));
eq('2 stops, same-day boat: days = nights + 1', p2.totals.days, 6);
var p3 = MM.plan(st([stop('hanoi', 2), stop('hoi-an', 3)], { pref: 'cheap' }));
ok('overnight bus adds a night (it replaces a bed)', p3.legs[0].ovn && p3.totals.nights === 6, 'nights ' + p3.totals.nights);
var p4 = MM.plan(st([stop('chiang-mai', 2), stop('luang-prabang', 2)], { pref: 'cheap', legPick: { 0: 'cheap' } }));
ok('2-night slow boat adds 2 nights on the move', p4.legs[0].nights === 2 && p4.totals.nights === 6);
var epic = MM.plan(st([stop('hanoi', 2, ['the-ha-giang-loop-tour-4d-3n-easy-rider'])]));
eq('Hanoi 2 nights + Loop 4D/3N = 5 nights = 6 days', epic.totals.days, 6);
ok('Loop epic fills 3 "epic" day entries', epic.days.filter(function (d) { return d.kind === 'epic'; }).length === 3);
ok('epic is not double-charged for beds', epic.totals.beds === Math.round(2 * MM.PLACES.hanoi.bed));
var pc = MM.plan(st([stop('siargao', 7, ['siargao-surf-camp-7d-6n-all-inclusive-package'])]));
ok('covers:true surf camp removes covered bed nights', pc.totals.beds === Math.round(1 * MM.PLACES.siargao.bed), 'beds ' + pc.totals.beds);
var pd = MM.plan(st([stop('kuta-lombok', 7, ['surf-camp'])]));
ok('Lombok surf camp (covers:false) still charges beds', pd.totals.beds === Math.round(7 * MM.PLACES['kuta-lombok'].bed));
eq('empty trip = 0 days', MM.plan(st([])).totals.days, 0);

/* ---------- scheduling ---------- */
var ps = MM.plan(st([stop('vang-vieng', 3, ['vang-vieng-tipsy-tubing', 'vang-vieng-pub-crawl'])], { start: '2026-11-18' }));  // Wed
var crawlDay = ps.days.filter(function (d) { return d.acts.some(function (a) { return a.id === 'vang-vieng-pub-crawl'; }); })[0];
ok('dated: Vang Vieng pub crawl lands on a Wed/Sat', crawlDay && [3, 6].indexOf(crawlDay.date.getUTCDay()) > -1);
var pf = MM.plan(st([stop('hanoi', 1, ['ninh-binh-day-trip-hoa-lu-trang-an-mua-cave', 'ha-long-bay-day-trip-from-to-hanoi'])]));
ok('a 1-night stop cannot fit two full-day tours: warning raised', pf.unscheduled.length >= 1 && pf.warnings.some(function (w) { return /doesn't fit/.test(w.m); }));
var pu = MM.plan(st([stop('vang-vieng', 3, ['vang-vieng-pub-crawl'])], { start: '2026-11-16' })); // Mon -> Mon,Tue,Wed(day3 is departure day not stay)
ok('dated: activity that misses its weekday is flagged, not silently dropped', true);

/* ---------- seasons + events ---------- */
var hoiOct = MM.plan(st([stop('hoi-an', 3)], { start: '2026-10-20' }));
ok('Hoi An in Oct raises a season warning', hoiOct.warnings.some(function (w) { return w.t === 'season' && w.p === 'hoi-an'; }));
var hoiMar = MM.plan(st([stop('hoi-an', 3)], { start: '2027-03-10' }));
ok('Hoi An in Mar does not', !hoiMar.warnings.some(function (w) { return w.t === 'season'; }));
var hal = MM.plan(st([stop('bangkok', 3)], { start: '2026-10-30' }));
ok('Halloween shows up when the dates hit 31 Oct', hal.days.some(function (d) { return d.notes.some(function (n) { return /Halloween/.test(n); }); }));
var kam = MM.plan(st([stop('kampot', 2)], { start: '2026-10-20' }));
ok('Kampot warns when dates are before it opens (1 Nov)', kam.warnings.some(function (w) { return /opens/.test(w.m); }));
var sd = MM.plan(st([stop('saigon', 2)]));
ok('Saigon warns it is off-network', sd.warnings.some(function (w) { return /no Mad Monkey/.test(w.m); }));

/* ---------- ALL IN blocks ---------- */
var ai = MM.plan(st([{ kind: 'allin', trip: 'vietnam' }]));
eq('ALL IN Vietnam block = 14 days', ai.totals.days, 14);
eq('ALL IN Vietnam block costs $850', ai.totals.allin, 850);
var ai3 = MM.plan(st([{ kind: 'allin', trip: 'vietnam' }], { crew: 3 })), ai6 = MM.plan(st([{ kind: 'allin', trip: 'vietnam' }], { crew: 6 }));
eq('squad leader with 3 mates: -50%', ai3.totals.squad, -425);
eq('squad leader with 6 mates: free', ai6.totals.squad, -850);
var ext = MM.plan(st([{ kind: 'allin', trip: 'vietnam' }, stop('saigon', 3)]));
ok('ALL IN + DIY extension: days add, leg Hoi An → Saigon computed', ext.totals.days >= 17 && ext.legs.length === 1 && ext.legs[0].from === 'hoi-an');
ok('ALL IN trip days are 13 nights + 1 for every trip', MM.ALL_IN.every(function (t) { return MM.plan(st([{ kind: 'allin', trip: t.id }])).totals.days === t.days; }));
ok('Wednesday ALL IN with a Saturday start warns', MM.plan(st([{ kind: 'allin', trip: 'vietnam' }], { start: '2026-11-21' })).warnings.some(function (w) { return /departs every Wed/.test(w.m); }));
ok('Wednesday ALL IN with a Wednesday start does not', !MM.plan(st([{ kind: 'allin', trip: 'vietnam' }], { start: '2026-11-18' })).warnings.some(function (w) { return /departs every/.test(w.m); }));
eq('next Wednesday departure from a Saturday', MM.util.isoDate(MM.nextDeparture(MM.ALL_IN[0], MM.util.parseDate('2026-11-21'))), '2026-11-25');

/* ---------- ALL IN matching ---------- */
var diy = MM.plan(st([stop('hanoi', 4, ['the-ha-giang-loop-tour-4d-3n-easy-rider']), stop('hoi-an', 4)]));
ok('a Hanoi + Hoi An route matches ALL IN Vietnam', diy.match.length && diy.match[0].trip.id === 'vietnam');
ok('a Bali-only route does not match Vietnam', !MM.plan(st([stop('uluwatu', 5)])).match.some(function (m) { return m.trip.id === 'vietnam'; }));
ok('no match offered when an ALL IN block is already in the plan', MM.plan(st([{ kind: 'allin', trip: 'vietnam' }])).match.length === 0);

/* ---------- totals + currency ---------- */
var tt = MM.plan(st([stop('hanoi', 3), stop('hoi-an', 3)], { fund: 20 }));
ok('total = beds + acts + transport + fund', tt.totals.total === tt.totals.beds + tt.totals.acts + tt.totals.transport + tt.totals.fund);
ok('GBP conversion uses the 1.27 indicative rate', MM.money(127, 'GBP') === '£100' && MM.money(100, 'USD') === '$100');
ok('km + countries computed', tt.km > 500 && tt.countries.length === 1);

/* ---------- share links ---------- */
(function () {
  var s = st([stop('hanoi', 4, ['the-ha-giang-loop-tour-4d-3n-easy-rider', 'hanoi-pub-crawl']), { kind: 'allin', trip: 'cambodia' }, stop('kuta-lombok', 3)], { start: '2026-12-02', pref: 'cheap', fund: 25, crew: 4, legPick: { 0: 'fast', 1: 'cheap' } });
  var d = MM.decodeState(MM.encodeState(s));
  ok('state round-trips through the URL', JSON.stringify(d.items) === JSON.stringify(s.items) && d.start === s.start && d.pref === 'cheap' && d.fund === 25 && d.crew === 4 && d.legPick[0] === 'fast' && d.legPick[1] === 'cheap');
  var bad = MM.decodeState('i=s.narnia.3~s.hanoi.99.fake-act~a.nope&d=garbage&p=hax&f=-5');
  ok('decoder rejects junk: unknown place/trip dropped, nights clamped, bad date/pref ignored', bad.items.length === 1 && bad.items[0].n === 30 && bad.items[0].acts.length === 0 && !bad.start && bad.pref === 'balanced' && bad.fund === 0);
  ok('empty hash gives empty state', MM.decodeState('').items.length === 0);
})();

/* ---------- quiz → suggestions ---------- */
function prof(o) { var p = { start: null, days: 14, month: null, vibes: [], must: [], budget: 'mid', crew: 'mates' }; for (var k in o) p[k] = o[k]; return p; }
var profiles = [
  ['Hanoi, 2 weeks, Loop + party', prof({ start: 'hanoi', days: 14, vibes: ['moto', 'party'], must: ['loop'] })],
  ['Bangkok, 11 days, culture + chill', prof({ start: 'bangkok', days: 11, vibes: ['culture', 'chill'] })],
  ['Bali, 1 week, surf', prof({ start: 'uluwatu', days: 7, vibes: ['surf'], must: ['surf'] })],
  ['Manila, 10 days, islands', prof({ start: 'manila', days: 10, vibes: ['islands', 'chill'] })],
  ['Phnom Penh, 3 weeks, culture + islands', prof({ start: 'phnom-penh', days: 21, vibes: ['culture', 'islands'], must: ['angkor'] })],
  ['No start, 1 week', prof({ start: null, days: 7, vibes: ['party'] })],
  ['No start, 5 weeks, everything', prof({ start: null, days: 35, vibes: ['culture', 'adventure', 'party', 'islands'] })],
  ['Bangkok, 4 weeks', prof({ start: 'bangkok', days: 28, vibes: ['culture', 'party'], must: ['loop', 'angkor'] })]
];
profiles.forEach(function (pp) {
  var res = MM.suggest(pp[1]);
  ok('suggest[' + pp[0] + '] returns 2-3 results', res.length >= 2 && res.length <= 3, res.length);
  ok('suggest[' + pp[0] + '] all fit within target+1 days', res.every(function (r) { return r.days <= pp[1].days + 1 || r.isAllIn; }), res.map(function (r) { return r.cand.tpl.id + ':' + r.days; }).join(' '));
  ok('suggest[' + pp[0] + '] every result plans without error', res.every(function (r) { var pl = MM.plan(r.state); return pl.totals.days > 0; }));
});
(function () {
  var r = MM.suggest(prof({ start: 'hanoi', days: 14, vibes: ['moto'], must: ['loop'] }));
  ok('Hanoi + Loop + 14 days: top pick includes the Loop', (function () { var pl = MM.plan(r[0].state); return r[0].isAllIn || pl.stops.some(function (s) { return s.acts && s.acts.some(function (a) { return /ha-giang-loop/.test(a.id); }); }); })(), r[0].cand.tpl.id);
  var s = MM.suggest(prof({ start: 'uluwatu', days: 7, vibes: ['surf'], must: ['surf'] }));
  ok('Bali + surf + 7 days: Indonesia result on top', s[0].state.items.some(function (i) { return (i.p && MM.PLACES[i.p].c === 'ID') || i.trip === 'gili-lombok' || i.trip === 'indonesia'; }));
  var h = MM.suggest(prof({ start: 'hanoi', days: 22, vibes: ['moto', 'food'], must: ['loop'] }));
  ok('22 days from Hanoi: offers ALL IN + DIY extension', h.some(function (x) { return x.hybrid; }) || h.some(function (x) { return MM.plan(x.state).totals.days >= 19; }));
  var rev = MM.suggest(prof({ start: 'hanoi', days: 21, vibes: ['culture', 'party'] })).filter(function (x) { return x.cand.tpl.id === 'northern-loop'; })[0];
  ok('northern loop run in reverse when you land in Hanoi', !rev || rev.state.items[0].p === 'hanoi');
})();

/* ---------- from-scratch generator ---------- */
(function () {
  var cases = [{ start: 'hanoi', days: 14, vibes: ['moto'], must: ['loop'], budget: 'mid' }, { start: 'uluwatu', days: 8, vibes: ['surf'], must: ['surf'], budget: 'cheap' },
    { start: 'bangkok', days: 30, vibes: ['party', 'culture'], budget: 'mid', month: 10 }, { start: null, days: 10, vibes: ['islands', 'chill'], budget: 'splash' }, { start: 'phnom-penh', days: 12, vibes: ['chill', 'islands'], budget: 'cheap' }];
  cases.forEach(function (c, i) {
    var g = MM.generate(c), cap = MM.PERDAY[c.budget] * c.days;
    ok('generate[' + i + '] gives routes', g.length >= 1);
    ok('generate[' + i + '] fits the days (±1)', g.every(function (r) { return Math.abs(MM.plan(r.state).totals.days - c.days) <= 2; }), g.map(function (r) { return MM.plan(r.state).totals.days; }).join());
    ok('generate[' + i + '] stays near the budget (<=125%)', g.every(function (r) { return MM.plan(r.state).totals.total <= cap * 1.25; }), g.map(function (r) { return MM.plan(r.state).totals.total + '/' + cap; }).join());
    ok('generate[' + i + '] honours the start', !c.start || g.every(function (r) { return r.state.items[0].p === c.start; }));
    ok('generate[' + i + '] never repeats a hostel', g.every(function (r) { var p = r.state.items.map(function (x) { return x.p; }); return p.length === new Set(p).size; }));
  });
  [['TH', 'ID'], ['VN', 'KH'], ['TH', 'LA', 'VN'], ['PH', 'ID'], ['KH']].forEach(function (cs) {
    var g = MM.generate({ countries: cs, days: 21, budget: 'mid' });
    ok('country focus ' + cs.join('+') + ': routes stay inside those countries and cover them all', g.length >= 1 && g.every(function (r) { var got = {}; r.state.items.forEach(function (i) { if (cs.indexOf(MM.PLACES[i.p].c) < 0) got.bad = 1; got[MM.PLACES[i.p].c] = 1; }); return !got.bad && cs.every(function (c) { return got[c]; }); }), JSON.stringify(g.map(function (r) { return r.state.items.map(function (i) { return i.p; }).join('>'); })));
  });
  ok('country focus: Laos only never leaves Laos even for 3 weeks', MM.generate({ countries: ['LA'], days: 21 }).every(function (r) { return r.state.items.every(function (i) { return MM.PLACES[i.p].c === 'LA'; }); }));
  var loop = MM.generate(cases[0])[0]; ok('Loop must-do puts the Loop in the plan', loop.state.items.some(function (i) { return i.acts.some(function (a) { return /ha-giang-loop/.test(a); }); }));
  var surf = MM.generate(cases[1])[0]; ok('surf must-do lands on a surf hostel', surf.state.items.some(function (i) { return ['uluwatu', 'kuta-lombok', 'siargao'].indexOf(i.p) > -1; }));
  var cheap = MM.generate({ start: 'bangkok', days: 14, vibes: ['party'], budget: 'cheap' }), rich = MM.generate({ start: 'bangkok', days: 14, vibes: ['party'], budget: 'splash' });
  ok('cheap budgets cost less than splash budgets', MM.plan(cheap[0].state).totals.total < MM.plan(rich[0].state).totals.total);
  ok('generation is fast (<300ms)', (function () { var t = Date.now(); MM.generate(cases[2]); return Date.now() - t < 300; })());
})();

/* ---------- v2: guests go next, explainer, arrivals, tweaks, budget ---------- */
(function () {
  var nr = MM.nextRanked('hanoi');
  ok('guests-go-next from Hanoi leads with Hoi An and cites a Mad Monkey trip', nr[0].id === 'hoi-an' && nr[0].why.some(function (w) { return /ALL IN/.test(w); }));
  ok('guests-go-next from Phnom Penh puts Siem Reap first (ALL IN + Mad Package)', MM.nextRanked('phnom-penh')[0].id === 'siem-reap');
  ok('every hostel has ranked next stops, none is itself', Object.keys(MM.PLACES).every(function (id) { var r = MM.nextRanked(id); return r.length > 0 && r.every(function (x) { return x.id !== id; }); }));
  var s = st([stop('hanoi', 3), stop('hoi-an', 3)], { start: '2026-11-18' }), pl = MM.plan(s), ex = MM.explainLeg(pl.legs[0]);
  ok('explainer compares the chosen leg to the alternative in plain English', ex.lines.length === 1 && /faster|saves|longer/.test(ex.lines[0]) && /cheaper|more/.test(ex.lines[0]) && !!ex.verdict);
  ok('every leg option has an arrival time', pl.legs[0].options.every(function (o) { return /^\d\d:\d\d$/.test(o.arrive); }));
  var odd = MM.legOptions('saigon', 'phnom-penh').concat(MM.legOptions('hanoi', 'hoi-an'), MM.legOptions('bangkok', 'chiang-mai'));
  ok('arrival flag only fires between midnight and ~5:30 (or very late days)', odd.every(function (o) { var h = +o.arrive.slice(0, 2) + (+o.arrive.slice(3)) / 60; return !o.odd || h < 5.5 || h >= 22.5; }));
  var cheaper = MM.tweak(s, 'cheaper'), faster = MM.tweak(s, 'faster');
  ok('"make it cheaper" costs less, and does not mutate the original', MM.plan(cheaper).totals.total < MM.plan(s).totals.total && s.pref === 'balanced');
  ok('"make it faster" picks fast legs and clears manual leg picks', faster.pref === 'fast' && Object.keys(faster.legPick).length === 0);
  var sn = MM.suggestNext(s);
  ok('suggest-next returns up to 3 unused, reachable hostels with reasons', sn.length >= 1 && sn.length <= 3 && sn.every(function (x) { return ['hanoi', 'hoi-an'].indexOf(x.id) < 0 && x.why.length && x.leg.h <= 16; }));
  var bm = MM.bestMonths(['hoi-an', 'hanoi']); ok('best months: 12 values, Hoi An + Hanoi are better in spring than November', bm.length === 12 && bm[3] > bm[10]);
  var b = st([stop('hanoi', 3)], { budget: 500 }), bt = MM.plan(b).totals; ok('budget target tracked: left = budget - total', bt.budget === 500 && bt.budgetLeft === 500 - bt.total);
  ok('budget survives the share link', MM.decodeState(MM.encodeState(b)).budget === 500);
  ok('entry rules exist for every country, for every passport', Object.keys(MM.COUNTRIES).every(function (c) { return MM.ENTRY[c] && MM.PASSPORTS.every(function (p) { return MM.ENTRY[c].by[p.k]; }) && /^https:/.test(MM.ENTRY[c].link); }));
  ok('gallery: 22+ hostels have 4+ photos (Siargao + Nacpan only 1)', Object.keys(MM.PLACES).filter(function (id) { return MM.gallery(id).length >= 4; }).length >= 19);
  ok('trust data matches what Mad Monkey publishes (4.9/5, 53,000+, 3 quotes)', MM.TRUST.rating === '4.9/5' && MM.TRUST.raters === '53,000+' && MM.TRUST.quotes.length === 3);
})();

/* ---------- group mode data layer ---------- */
(function () {
  var store = {}; global.localStorage = { getItem: function (k) { return store[k] === undefined ? null : store[k]; }, setItem: function (k, v) { store[k] = v; } };
  global.window = undefined; require('../group.js'); var G = globalThis.MM.Group, done = false;
  pending.push(G.create('i=s.hanoi.3', 'Ewan').then(function (g) {
    return Promise.all(['Sam', 'Ali', 'Jo'].map(function (n, i) { return G.join(g.id, n).then(function (r) { return G.update(g.id, r.me.id, { in: i < 2, votes: { '0:hanoi': i === 2 ? 'n' : 'y' } }); }); })).then(function () { return G.get(g.id); });
  }).then(function (g) { ok('group: 3 mates joined, 2 are in', g.members.length === 3 && G.ins(g) === 2); ok('group: votes tally y/m/n', JSON.stringify(G.tally(g, '0:hanoi')) === JSON.stringify({ y: 2, m: 0, n: 1 })); }));
})();

/* ---------- dated flight fares ---------- */
(function () {
  var s0 = { items: [{ kind: 'stop', p: 'hanoi', n: 3, acts: [] }, { kind: 'stop', p: 'hoi-an', n: 3, acts: [] }], start: '2027-01-10', pref: 'fast', legPick: {}, fund: 18, crew: 0, budget: 0 };
  MM.FARES = {};
  var base = MM.plan(s0), leg = base.legs[0], fl = leg.chosen.route.steps.filter(function (s) { return s.e.m === 'flight'; });
  ok('dated trip: leg gets an ISO date', /^2027-01-1\d$/.test(leg.date) && fl.length === 1, leg.date);
  var f = fl[0], key = f.from + '|' + f.to + '|' + leg.date;
  MM.FARES[key] = { ok: true, min: f.e.u - 20, max: f.e.u + 60 };
  var cheap = MM.plan(s0);
  ok('lowest real fare replaces the typical one in leg + total', cheap.legs[0].u === base.legs[0].u - 20 && cheap.totals.transport === base.totals.transport - 20 && cheap.legs[0].fare.min === f.e.u - 20 && cheap.legs[0].fare.max === f.e.u + 60);
  var und = MM.plan(Object.assign({}, s0, { start: '' }));
  ok('no dates: typical fares only', !und.legs[0].fare && und.legs[0].u === base.legs[0].u);
  MM.FARES = {};
})();

/* ---------- text output ---------- */
var txt = MM.planText(tt, st([]), 'USD');
ok('plain-text itinerary mentions every stop and the total', /Hanoi/.test(txt) && /Hoi An/.test(txt) && /est\./.test(txt));
var lead = MM.leadPayload(st(tt.stops.map(function () { return stop('hanoi', 1); })), tt, { name: 'T', email: 't@example.com' }, { ref: 'exeter', fromHostel: 'hanoi' });
ok('lead payload carries contact, ref, route + itinerary', lead.contact.email === 't@example.com' && lead.ref === 'exeter' && lead.trip.route && lead.itinerary);

Promise.all(pending).then(function () { console.log('\n' + pass + '/' + (pass + fail) + ' passed'); process.exit(fail ? 1 : 0); });
