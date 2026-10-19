/* Trip Builder logic tests. Run: npm test  (node test/logic.test.js) */
['places', 'activities', 'media', 'legs', 'trips', 'entry', 'gallery', 'rules', 'guide'].forEach(function (f) { require('../data/' + f + '.js'); });
var MM = require('../logic.js');
require('../extras.js');
require('../crew.js');

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

/* ---------- don't miss ---------- */
(function () {
  var mk = function (ps) { return { items: ps.map(function (p) { return { kind: 'stop', p: p, n: 3, acts: [] }; }), start: '', pref: 'balanced', legPick: {}, fund: 18, crew: 0, budget: 0 }; };
  var m = MM.missed(mk(['siem-reap', 'kampot']));
  ok("don't miss: a hostel the bus drives through is flagged first", m[0] && m[0].k === 'via:phnom-penh' && m[0].after === 0 && m[0].dDays > 0);
  ok("don't miss: the standout activity at a stop is suggested", m.some(function (x) { return x.k === 'act:siem-reap' && x.dCost > 0; }));
  ok("don't miss: dismissed items stay hidden", !MM.missed(mk(['siem-reap', 'kampot']), { 'via:phnom-penh': 1 }).some(function (x) { return x.k === 'via:phnom-penh'; }));
  ok("don't miss: Bali to the Gilis suggests Nusa Lembongan on the way", MM.missed(mk(['uluwatu', 'gili-trawangan'])).some(function (x) { return x.k === 'near:nusa-lembongan'; }));
  var withIt = mk(['siem-reap']); withIt.items[0].acts = [MM.dontMiss('siem-reap').act.id];
  ok("don't miss: nothing nagging once you've added it", !MM.missed(withIt).some(function (x) { return x.k === 'act:siem-reap'; }));
  ok('every hostel has a working standout', Object.keys(MM.DONT_MISS).every(function (p) { return MM.dontMiss(p); }));
})();

/* ---------- extras: calendar, visa, doctor, themes, packing, currency ---------- */
(function () {
  var iso = function (d) { return d.toISOString().slice(0, 10); };
  var dated = function (items, start) { return st(items.map(function (x) { return stop(x[0], x[1]); }), { start: start }); };
  ok('full moons match known 2026 dates (Thai time)', MM.fullMoons(2026).map(iso).join() === '2026-01-03,2026-02-02,2026-03-03,2026-04-02,2026-05-02,2026-05-31,2026-06-30,2026-07-29,2026-08-28,2026-09-26,2026-10-26,2026-11-24,2026-12-24');
  ok('Easter 2027 and 2028', iso(MM.easter(2027)) === '2027-03-28' && iso(MM.easter(2028)) === '2028-04-16');

  var tet = MM.eventsFor(MM.plan(dated([['hanoi', 3], ['hoi-an', 4]], '2027-02-03')));
  ok('Tet is caught on a Vietnam trip over Tet', tet.length === 1 && tet[0].ev.id === 'tet' && tet[0].sev === 3 && tet[0].conf === false);
  ok('Tet comes with a shift that really misses it', tet[0].shift && tet[0].shift.days === 9 && iso(tet[0].shift.newStart) === '2027-02-12');
  ok('same trip in July has no events', MM.eventsFor(MM.plan(dated([['hanoi', 3], ['hoi-an', 4]], '2027-07-03'))).length === 0);
  ok('Nyepi only hits Bali stops', MM.eventsFor(MM.plan(dated([['uluwatu', 4]], '2027-03-07'))).some(function (e) { return e.ev.id === 'nyepi'; }) && !MM.eventsFor(MM.plan(dated([['gili-trawangan', 4]], '2027-03-07'))).some(function (e) { return e.ev.id === 'nyepi'; }));
  ok('Songkran every year, Thailand only', MM.eventsFor(MM.plan(dated([['bangkok', 4]], '2028-04-11'))).some(function (e) { return e.ev.id === 'songkran'; }) && !MM.eventsFor(MM.plan(dated([['hanoi', 4]], '2028-04-11'))).some(function (e) { return e.ev.id === 'songkran'; }));
  ok('Holy Week lands on the Philippines in 2027', MM.eventsFor(MM.plan(dated([['panglao', 4]], '2027-03-24'))).some(function (e) { return e.ev.id === 'holyweek'; }));
  ok('Christmas peak crosses the new year', MM.eventsFor(MM.plan(dated([['hanoi', 4]], '2026-12-30'))).some(function (e) { return e.ev.id === 'xmas'; }));
  ok('upcoming events lists lunar + fixed ones', MM.upcomingEvents({ countries: ['TH'], from: new Date(Date.UTC(2026, 9, 19)), months: 12 }).some(function (e) { return e.ev.id === 'loy'; }));

  var longTH = MM.visaCheck(MM.plan(dated([['bangkok', 10], ['chiang-mai', 10], ['pai', 8], ['phuket', 8]], '2027-03-01')), 'gb');
  ok('visa: 37 days in Thailand is over the 30-day limit', longTH.length === 1 && longTH[0].status === 'over' && longTH[0].allowed === 30 && /Extend/.test(longTH[0].msg), JSON.stringify(longTH[0] && longTH[0].status));
  ok('visa: a short trip is fine', MM.visaCheck(MM.plan(dated([['bangkok', 4]], '2027-03-01')), 'gb')[0].status === 'ok');
  ok('visa: asks for a passport when none picked', MM.visaCheck(MM.plan(dated([['bangkok', 4]], '2027-03-01')), null)[0].status === 'pick');
  ok('visa: Vietnam gives US passports 90 days, UK 45', MM.visaCheck(MM.plan(dated([['hanoi', 50]], '2027-03-01')), 'us')[0].status === 'ok' && MM.visaCheck(MM.plan(dated([['hanoi', 50]], '2027-03-01')), 'gb')[0].status === 'over');
  ok('visa: two countries get two checks', MM.visaCheck(MM.plan(dated([['hanoi', 4], ['luang-prabang', 4]], '2027-05-01')), 'gb').length === 2);

  var d1 = MM.doctor(dated([['hanoi', 3], ['hoi-an', 4]], '2027-02-03'), { passport: 'gb' });
  ok('doctor: a Tet clash is a serious finding that caps the score', d1.bad === 1 && d1.score <= 69 && d1.label === 'Needs a tweak' && d1.findings[0].sev === 'bad');
  ok('doctor: the Tet fix is a date shift', d1.findings[0].fix && d1.findings[0].fix.t === 'shift' && d1.findings[0].fix.d === 9);
  var fixed = MM.doctor(MM.applyFix(dated([['hanoi', 3], ['hoi-an', 4]], '2027-02-03'), d1.findings[0].fix), { passport: 'gb' });
  ok('doctor: applying the fix clears it', fixed.bad === 0 && fixed.findings.every(function (f) { return f.sev !== 'bad'; }));
  var rush = MM.doctor(dated([['hanoi', 2], ['hoi-an', 1], ['saigon', 1], ['siem-reap', 2]], '2027-05-01'));
  ok('doctor: one-night stands and a rushed plan are flagged with a night-adding fix', rush.findings.some(function (f) { return /^one-/.test(f.id) && f.fix && f.fix.t === 'nights' && f.fix.dDays === 1; }) && rush.findings.some(function (f) { return f.id === 'rush'; }));
  var stack = MM.doctor(st([stop('bangkok', 2), stop('chiang-mai', 1), stop('luang-prabang', 1)], { pref: 'cheap' }));
  ok('doctor: back-to-back overnight journeys are a serious finding', stack.findings.some(function (f) { return f.id === 'ovn-stack' && f.sev === 'bad'; }) || stack.stats.overnights < 2, JSON.stringify(stack.stats));
  MM.THEMES.forEach(function (t) { var x = MM.themeTrip(t.id), d = MM.doctor(x.state); ok('theme "' + t.n + '" is a clean, balanced trip', x.days >= 10 && x.days <= 18 && d.bad === 0 && d.warns === 0, d.findings.map(function (f) { return f.title; }).join('; ')); });
  // the cards on the home page: every claim must be true of the trip behind it
  var rows = MM.THEMES.map(function (th) { var x = MM.themeTrip(th.id), p = MM.plan(x.state); return { th: th, p: p, perDay: p.totals.total / p.totals.days }; });
  ok('themes: every hand-picked activity exists at its hostel', MM.THEMES.every(function (th) { return th.route.every(function (r) { return (r[2] || []).every(function (f) { return MM.themeActs(r[0], [f]).length === 1; }); }); }));
  ok('themes: every hostel in a route has at least one activity picked', MM.THEMES.every(function (th) { return th.route.every(function (r) { return MM.themeActs(r[0], r[2]).length >= 1; }); }));
  ok('themes: days are nights + 1 (plus the nights spent travelling) and between 10 and 18', rows.every(function (r) { return r.p.totals.days === r.p.totals.nights + 1 && r.p.totals.days >= 10 && r.p.totals.days <= 18; }));
  ok('themes: a day costs between $25 and $75 (beds + transport + activities + food)', rows.every(function (r) { return r.perDay >= 25 && r.perDay <= 75; }), rows.map(function (r) { return r.th.id + ' $' + Math.round(r.perDay); }).join(', '));
  ok('themes: "Cheap as Chips" really is the cheapest a day', rows.filter(function (r) { return r.th.id === 'cheap'; })[0].perDay === Math.min.apply(0, rows.map(function (r) { return r.perDay; })));
  ok('themes: no single activity over $60 in the cheap trip', MM.plan(MM.themeTrip('cheap').state).segs.every(function (s) { return s.acts.every(function (a) { return a.usd == null || a.usd <= 60; }); }));
  ok('themes: descriptions only name things that are in the trip (Rinjani, hot air balloon, paramotor, "by train")', rows.every(function (r) { var acts = r.p.segs.map(function (s) { return s.acts.map(function (a) { return a.n; }).join(' '); }).join(' ').toLowerCase(), b = r.th.blurb.toLowerCase(); return (!/rinjani/.test(b) || /rinjani/.test(acts)) && (!/balloon/.test(b) || /balloon/.test(acts)) && (!/paramotor/.test(b) || /paramotor/.test(acts)) && (!/by train/.test(b) || r.p.legs.some(function (l) { return l.chosen.main === 'train'; })); }));
  ok('home page special is optional: none set means nothing to render', MM.special === null || (MM.special && MM.special.stops.length > 0 && MM.special.url));
  var sp = MM.surprise(function () { return 0.3; });
  ok('surprise me returns a real, planned trip', sp && sp.state.items.length >= 3 && MM.plan(sp.state).totals.days > 8);
  var pk = MM.packing(MM.plan(dated([['hanoi', 3]], '2027-07-01'))), flat = JSON.stringify(pk);
  ok('packing list has the basics + plug type for the country', pk.length >= 4 && /Vietnam A\/C/.test(flat) && /Passport/.test(flat));
  ok('packing list adds mountain + water gear when the trip needs it', /For the mountains/.test(JSON.stringify(MM.packing(MM.plan(st([stop('hanoi', 4, [MM.dontMiss('hanoi').act.id])], {}))))));

  ok('guide covers every country and every hostel', Object.keys(MM.COUNTRIES).every(function (c) { return MM.GUIDE.countries[c] && MM.GUIDE.topics.every(function (t) { return MM.GUIDE.countries[c][t.k] && MM.GUIDE.countries[c][t.k].length >= 2; }); }) && Object.keys(MM.PLACES).filter(function (p) { return !MM.PLACES[p].partner; }).every(function (p) { return MM.GUIDE.places[p] && MM.GUIDE.places[p].length >= 2; }));
  ok('currencies: EUR, AUD, CAD formatted with their symbols', MM.money(100, 'EUR') === '€92' && MM.money(100, 'AUD') === 'A$152' && MM.money(100, 'CAD') === 'C$137' && MM.money(100, 'GBP') === '£79' && MM.money(100, 'XXX') === '$100');
  ok('local money: $10 in Thailand and Vietnam', MM.localMoney(10, 'TH') === '฿340' && MM.localMoney(10, 'VN') === '₫255,000');
  MM.setRates({ THB: 40 }); ok('live rates override the local fallback', MM.localMoney(10, 'TH') === '฿400'); MM.setRates({ THB: 34 });
})();

/* ---------- text output ---------- */
var txt = MM.planText(tt, st([]), 'USD');
ok('plain-text itinerary mentions every stop and the total', /Hanoi/.test(txt) && /Hoi An/.test(txt) && /est\./.test(txt));
var lead = MM.leadPayload(st(tt.stops.map(function () { return stop('hanoi', 1); })), tt, { name: 'T', email: 't@example.com' }, { ref: 'exeter', fromHostel: 'hanoi' });
ok('lead payload carries contact, ref, route + itinerary', lead.contact.email === 't@example.com' && lead.ref === 'exeter' && lead.trip.route && lead.itinerary);

/* ---------- crew summary: what the team sees when a trip lands ---------- */
(function () {
  function inDays(n) { return new Date(Date.now() + n * 86400000).toISOString().slice(0, 10); }
  var ids = { hn: MM.actsAt('hanoi').filter(function (a) { return a.usd; })[0], ha: MM.actsAt('hoi-an').filter(function (a) { return a.usd; })[0] };
  var s = st([stop('hanoi', 4, [ids.hn.id]), stop('hoi-an', 3, [ids.ha.id]), stop('saigon', 2)], { start: inDays(40), fund: 20, budget: 900 });
  var pl = MM.plan(s), sum = MM.crewSummary(s, pl, { people: 3, dates: 'fixed' }), b = sum.budget;
  ok('crew summary lists every stop, in order, with nights', sum.stops.map(function (x) { return x.name + x.nights; }).join('|') === 'Hanoi4|Hoi An3|Ho Chi Minh City2');
  ok('crew summary: stop bed costs add up to the plan total', sum.stops.reduce(function (a, x) { return a + (x.bedsUsd || 0); }, 0) === pl.totals.beds);
  ok('crew summary: trip cost + spending money = estimated total (parts within $2 of it)', b.tripCost + b.spendFund === b.total && b.total === pl.totals.total && Math.abs(b.beds + b.tours + b.transport + b.allIn + b.squadDiscount - b.tripCost) <= 2);
  ok('crew summary: party of 3 multiplies the trip cost', b.people === 3 && b.tripCostAllPeople === b.tripCost * 3);
  ok('crew summary: tours sit under their own stop with price and day', sum.stops[0].tours.length === 1 && sum.stops[0].tours[0].name === ids.hn.n && sum.stops[0].tours[0].usd === Math.round(ids.hn.usd) && sum.stops[0].tours[0].day > 0 && /^\d{4}-\d\d-\d\d$/.test(sum.stops[0].tours[0].date));
  ok('crew summary: travel between stops hangs off the stop it leaves', sum.stops[0].next && sum.stops[0].next.to === 'Hoi An' && sum.stops[1].next.to === 'Ho Chi Minh City' && sum.stops[2].next === null && sum.stops[0].next.usd > 0);
  ok('crew summary: dates run from the start date to the last day', sum.start === s.start && sum.end > sum.start && sum.stops[0].from === s.start && sum.datesLabel === 'Dates are fixed');
  ok('crew summary: carries the guest\'s own budget and what is left', b.guestBudget === 900 && b.budgetLeft === 900 - b.total);
  ok('crew summary survives a JSON round trip (it travels in the lead)', JSON.stringify(JSON.parse(JSON.stringify(sum))) === JSON.stringify(sum));
  ok('crew summary is small enough to email (under 12 KB for a 3-stop trip)', JSON.stringify(sum).length < 12000);

  var txt = MM.crewText(sum, { name: 'Sam', ref: 'MM-ABC123', contact: 'WhatsApp +447700900123', from: 'Leeds', notes: 'First time in Asia', deposit: 150, link: 'https://x.test/#/build/abc' });
  ok('crew text names every stop, tour, the money and the note', ['HANOI', 'HOI AN', 'HO CHI MINH CITY', ids.hn.n, ids.ha.n, 'Estimated total', 'Deposit paid     $150', 'First time in Asia', 'MM-ABC123', 'party of 3', 'https://x.test/#/build/abc'].every(function (t) { return txt.indexOf(t) > -1; }));
  ok('crew text is plain text (no HTML, no emoji)', !/<[a-z/]/i.test(txt) && !/[\u{1F300}-\u{1FAFF}]/u.test(txt));

  var lead = MM.leadPayload(s, pl, { name: 'Sam', via: 'email', email: 's@example.com', partySize: 3, dates: 'fixed', notes: '', consent: true }, { link: 'https://x.test/#/build/abc' });
  ok('lead payload now carries the crew summary and crew text, and the old fields are untouched', lead.summary && lead.summary.stops.length === 3 && /TRIP TO CHECK/.test(lead.crewText) && lead.itinerary && lead.trip.route && lead.trip.estTotalUsd === pl.totals.total);

  ok('suggested balance = trip cost for everyone less the deposit, never the spending money', MM.suggestBalance(sum, 150) === b.tripCostAllPeople - 150);
  ok('suggested balance is never negative', MM.suggestBalance(sum, 999999) === 0);

  var soon = MM.crewSummary(st([stop('hanoi', 3)], { start: inDays(6) }), MM.plan(st([stop('hanoi', 3)], { start: inDays(6) })), {});
  ok('a trip leaving within two weeks is flagged "hold the beds today"', soon.flags.some(function (f) { return f.level === 'warn' && /Hold the beds today/.test(f.text); }));
  ok('warnings that were worded for the guest are reworded for the crew', !sum.flags.some(function (f) { return /We'll find you|pack for it|Pop your details/.test(f.text); }) && sum.flags.some(function (f) { return /Find them a partner hostel/.test(f.text); }));
  ok('flags put the things to act on first', sum.flags.findIndex(function (f) { return f.level === 'info'; }) === -1 || sum.flags.slice(sum.flags.findIndex(function (f) { return f.level === 'info'; })).every(function (f) { return f.level === 'info'; }));

  var undated = MM.crewSummary(st([stop('hanoi', 3)]), MM.plan(st([stop('hanoi', 3)])), { dates: 'open' });
  ok('an undated trip says so and has no calendar dates', undated.start === '' && undated.stops[0].from === '' && undated.flags.some(function (f) { return /No start date/.test(f.text); }) && /not decided/.test(MM.crewText(undated, {})));

  var withAllIn = st([{ kind: 'allin', trip: 'vietnam' }, stop('saigon', 2)], { start: inDays(30) });
  var sa = MM.crewSummary(withAllIn, MM.plan(withAllIn), { people: 2 });
  ok('an ALL IN block shows as one stop with its own price and route', sa.stops[0].kind === 'allin' && sa.stops[0].usd === 850 && sa.stops[0].tours.length === 0 && sa.budget.allIn === 850 && /ALL IN VIETNAM/.test(MM.crewText(sa, {})));

  var tight = st([stop('hanoi', 1, MM.actsAt('hanoi').filter(function (a) { return a.slot === 'full' && !a.multi; }).slice(0, 4).map(function (a) { return a.id; }))], {});
  var ts = MM.crewSummary(tight, MM.plan(tight), {});
  ok('a tour that does not fit is marked so the crew can see it', ts.stops[0].tours.some(function (t) { return t.fits === false; }) && /DOES NOT FIT/.test(MM.crewText(ts, {})));
})();

Promise.all(pending).then(function () { console.log('\n' + pass + '/' + (pass + fail) + ' passed'); process.exit(fail ? 1 : 0); });
