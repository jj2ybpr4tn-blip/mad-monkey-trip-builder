/* Fuzz tests: throw thousands of made-up trips, broken share links, junk saved trips and random edits at the planner, and check it never crashes,
 * never produces a nonsense price, and a trip survives its own share link. Seeded, so a failure is the same failure every run.
 * Run: node test/fuzz.test.js   (part of npm test). Set FUZZ_SEED=<n> to try another run; FUZZ_N=<n> for more. */
['places', 'activities', 'media', 'legs', 'trips', 'entry', 'gallery', 'rules', 'guide'].forEach(function (f) { require('../data/' + f + '.js'); });
var MM = require('../logic.js');
require('../extras.js');
require('../crew.js');
require('../edit.js');

var pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log('PASS  ' + name); } else { fail++; console.log('FAIL  ' + name + (extra ? '  -> ' + extra : '')); } }
function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
var SEED = +process.env.FUZZ_SEED || 12345, SCALE = +process.env.FUZZ_N || 1, R = rng(SEED), ids = Object.keys(MM.PLACES);
function pick(a) { return a[Math.floor(R() * a.length)]; }
function rint(a, b) { return a + Math.floor(R() * (b - a + 1)); }
function iso(y, m, d) { return y + '-' + (m < 10 ? '0' : '') + m + '-' + (d < 10 ? '0' : '') + d; }
function problems() { var bag = {}; return { add: function (kind, ex, e) { var k = kind + ': ' + String(e && e.message || e).slice(0, 110); (bag[k] = bag[k] || { n: 0, ex: String(ex).slice(0, 300) }).n++; }, list: function () { return Object.keys(bag).map(function (k) { return bag[k].n + 'x ' + k + '  e.g. ' + bag[k].ex; }); } }; }

/* ---------- 1. made-up trips: the planner, the prices, the share link, the crew summary ---------- */
function randState() {
  var st = MM.defaultState(), n = rint(0, 8);
  for (var i = 0; i < n; i++) {
    if (R() < 0.08) { st.items.push({ kind: 'allin', trip: pick(MM.ALL_IN).id }); continue; }
    var p = pick(ids), acts = MM.actsAt(p), chosen = [], k = rint(0, 5);
    for (var j = 0; j < k && acts.length; j++) { var a = pick(acts); if (chosen.indexOf(a.id) < 0) chosen.push(a.id); }
    var it = { kind: 'stop', p: p, n: rint(1, R() < 0.1 ? 30 : 7), acts: chosen };
    if (chosen.length && R() < 0.3) { it.pins = {}; chosen.forEach(function (id) { if (R() < 0.5) it.pins[id] = rint(1, it.n); }); }
    st.items.push(it);
  }
  if (R() < 0.25) { st.from = pick(ids); st.been = [st.from]; for (var b = rint(0, 4); b > 0; b--) { var bp = pick(ids); if (st.been.indexOf(bp) < 0) st.been.push(bp); } if (R() < 0.3) st.legPick.o = pick(['cheap', 'fast', 'balanced']); }
  if (R() < 0.7) st.start = iso(rint(2026, 2028), rint(1, 12), rint(1, 28));
  if (R() < 0.3) st.pref = pick(['cheap', 'fast', 'balanced']);
  st.fund = rint(5, 60); if (R() < 0.3) st.crew = rint(0, 8); if (R() < 0.3) st.budget = rint(300, 6000); if (R() < 0.2) st.month = rint(0, 11);
  return st;
}
function checkPlan(st) {
  var pl = MM.plan(st), T = pl.totals;
  ['nights', 'days', 'beds', 'acts', 'transport', 'allin', 'squad', 'fund', 'total'].forEach(function (k) { if (!isFinite(T[k])) throw new Error('non-finite ' + k + '=' + T[k]); });
  if (!isFinite(pl.km)) throw new Error('non-finite km');
  if (T.beds < 0 || T.acts < 0 || T.transport < 0 || T.fund < 0) throw new Error('negative cost ' + JSON.stringify(T));
  var parts = T.beds + T.acts + T.transport + T.allin + T.squad + T.fund; if (Math.abs(parts - T.total) > 3) throw new Error('total ' + T.total + ' is not the sum of its parts ' + parts);
  if (T.nights && T.days !== T.nights + 1) throw new Error('days != nights + 1');
  for (var d = 0; d < pl.days.length; d++) {
    if (pl.days[d].n !== d + 1) throw new Error('day numbering');
    if (st.start && pl.days[d].date && d > 0 && pl.days[d].date - pl.days[d - 1].date !== 86400000) throw new Error('dates are not consecutive');
  }
  return pl;
}
var bad1 = problems(), N1 = Math.round(1500 * SCALE), t0 = Date.now();
for (var i = 0; i < N1; i++) {
  var st = randState();
  try {
    var pl = checkPlan(st), enc = MM.encodeState(st), pl2 = MM.plan(MM.decodeState(enc));
    if (pl2.totals.total !== pl.totals.total || pl2.totals.days !== pl.totals.days) throw new Error('the share link changed the plan: ' + pl.totals.total + '/' + pl.totals.days + ' became ' + pl2.totals.total + '/' + pl2.totals.days);
    JSON.stringify(MM.crewSummary(st, pl, { people: rint(1, 8) }));
    MM.planText(pl, st, 'USD'); MM.leadPayload(st, pl, { name: 'x', via: 'email', email: 'a@b.co', partySize: 2 }, { link: 'https://x/#/build/' + enc });
    MM.doctor(st, { passport: pick(['gb', 'us', 'au', 'ca', 'eu', 'other', null]) }); MM.missed(st, {}); MM.suggestNext(st); MM.tweak(st, 'cheaper'); MM.packing(pl); MM.visaCheck(pl, 'gb'); MM.eventsFor(pl);
  } catch (e) { bad1.add('trip', JSON.stringify(st), e); }
}
ok(N1 + ' made-up trips: plan, prices, share link, crew summary, helpers (' + (Date.now() - t0) + ' ms)', !bad1.list().length, bad1.list().slice(0, 4).join('\n   '));

/* ---------- 2. broken share links: nothing may throw, and what comes out must plan ---------- */
var base = 'i=s.hanoi.4.ykror+v9app~s.hoi-an.4.v5xt4@2+aa1ri~s.saigon.3~a.vietnam&d=2027-02-10&p=cheap&f=20&c=3&l=0:cheap,1:fast&m=3&b=1500';
var specials = ['', '%', 'i=%', 'i=s.hanoi.3.%', 'i=s.hanoi.3.%E0%A4%A', 'i=s.__proto__.3', 'i=s.constructor.3', 'p=constructor&i=s.hanoi.3', 'p=__proto__', 'l=0:constructor', 'l=__proto__:cheap', 'i=a.', 'i=a.__proto__',
  'i=s.hanoi.NaN', 'i=s.hanoi.-5', 'i=s.hanoi.99999999999999999999', 'd=2027-02-31', 'd=0000-01-01', 'd=9999-12-31', 'f=0', 'f=-5', 'c=999', 'b=1e9', 'm=13', 'm=-1', 'i=~~~~', 'i=s.hanoi.3.a+b+c',
  'i=s.hanoi.3.' + 'x'.repeat(5000), 'i=' + Array(300).join('s.hanoi.3~'), 'i=s.hanoi.3.zzzzz@0+zzzzz@-1+zzzzz@999999', '&&&&', '=', '=&=&=', 'i', 'i=&d', '#t=i=s.hanoi.3', 't=i=s.hanoi.3'];
var bad2 = problems();
function runHash(s) { try { var d = MM.decodeState(s); checkPlan(d); JSON.stringify(MM.crewSummary(d, MM.plan(d), {})); MM.encodeState(d); } catch (e) { bad2.add('link', JSON.stringify(s).slice(0, 160), e); } }
specials.forEach(runHash);
for (var m = 0, N2 = Math.round(4000 * SCALE); m < N2; m++) {
  var s = base.split(''), edits = 1 + Math.floor(R() * 4);
  for (var k = 0; k < edits; k++) { var at = Math.floor(R() * s.length), op = R(), ch = String.fromCharCode(32 + Math.floor(R() * 95)); if (op < 0.4) s[at] = ch; else if (op < 0.7) s.splice(at, 1); else s.splice(at, 0, ch); }
  runHash(s.join(''));
}
ok((specials.length + N2) + ' broken or mutated share links: never throw, always plan', !bad2.list().length, bad2.list().slice(0, 4).join('\n   '));

/* ---------- 3. junk saved trips (old or damaged browser storage) ---------- */
var junk = [{ items: [{ kind: 'stop', p: 'atlantis', n: 3, acts: [] }] }, { items: [{ kind: 'allin', trip: 'nope' }] }, { items: [{ kind: 'stop', p: 'hanoi', n: 'x', acts: ['nope'] }] }, { items: [{ kind: 'stop', p: 'hanoi', n: -3, acts: null }] },
  { items: [null] }, { items: 'x' }, { items: [{ kind: 'weird' }] }, { items: [{ p: 'hanoi', n: 3 }] }, { items: [{ kind: 'stop', p: 'hanoi', n: 3, acts: [], pins: { x: 1 } }], start: 'garbage', pref: 'zzz', fund: 'abc', legPick: { 0: 'nope' } },
  {}, null, 5, 'text', [], { items: new Array(5000).fill({ kind: 'stop', p: 'hanoi', n: 1, acts: [] }) }, { items: [{ kind: 'stop', p: '__proto__', n: 2, acts: [] }] }, { items: [{ kind: 'stop', p: 'hanoi', n: 1e9, acts: [] }] }];
var bad3 = problems();
junk.forEach(function (j, i) {
  try { var clean = MM.sanitizeState(j); checkPlan(clean); if (clean.items.length > 40) throw new Error('kept ' + clean.items.length + ' stops'); checkPlan(Object.assign(MM.defaultState(), j && typeof j === 'object' ? j : {})); } catch (e) { bad3.add('junk#' + i, JSON.stringify(j).slice(0, 120), e); }
});
ok(junk.length + ' junk saved trips are cleaned up or planned without crashing', !bad3.list().length, bad3.list().slice(0, 4).join('\n   '));

/* ---------- 4. random edits: all or nothing, never corrupts the trip, never changes the one it was given ---------- */
var E = MM.edit, OPN = E.OPS;
function randOp(s) {
  var op = pick(OPN), n = s.items.length, stopIdx = R() < 0.9 ? rint(1, Math.max(1, n)) : pick([0, -1, n + 1, 99, 'x', null, 1.5]), it = s.items[stopIdx - 1], place = R() < 0.85 ? pick(ids) : pick(['atlantis', '', null, '__proto__', 'hanoi ']);
  var tourId = it && it.kind === 'stop' && MM.PLACES[it.p] ? (R() < 0.7 ? pick(MM.actsAt(it.p).concat([{ id: 'nope' }])).id : 'zzz') : 'zzz';
  return {
    add_stop: { op: op, place: place, nights: R() < 0.8 ? rint(1, 7) : pick([0, 31, -2, 'x', null, 1e9]), position: R() < 0.5 ? rint(0, n + 2) : undefined },
    remove_stop: { op: op, stop: stopIdx }, move_stop: { op: op, stop: stopIdx, to: rint(0, n + 1) }, set_nights: { op: op, stop: stopIdx, nights: R() < 0.8 ? rint(1, 12) : pick([0, 31, 'x', NaN]) },
    swap_stop: { op: op, stop: stopIdx, place: place }, add_tour: { op: op, stop: stopIdx, tour: tourId }, remove_tour: { op: op, stop: stopIdx, tour: tourId },
    move_tour: { op: op, stop: stopIdx, tour: tourId, day: rint(0, 20) }, unpin_tour: { op: op, stop: stopIdx, tour: tourId },
    set_start: { op: op, date: R() < 0.6 ? iso(rint(2027, 2028), rint(1, 12), rint(1, 28)) : pick(['', null, 'soon', '2001-01-01', '2027-02-31']) },
    set_style: { op: op, style: pick(['cheapest', 'smart', 'fastest', 'zzz']) }, set_travel: { op: op, stop: stopIdx, mode: pick(['cheapest', 'smart', 'fastest', 'zzz']) },
    set_spending: { op: op, per_day: pick([0, 10, 25, 100, 101, -1, 'x']) }, set_budget: { op: op, amount: pick([0, 500, 4000, 99999, 100000, -1, 'x']) }, clear: { op: op }
  }[op] || { op: op };
}
var bad4 = problems(), N4 = Math.round(1200 * SCALE), applied = 0, refused = 0;
for (var e = 0; e < N4; e++) {
  var s0 = randState(), before = JSON.stringify(s0), ops = [], c = rint(1, 4);
  for (var q = 0; q < c; q++) ops.push(randOp(s0));
  try {
    var r = E.apply(s0, ops);
    if (JSON.stringify(s0) !== before) throw new Error('the trip it was given was changed');
    if (r.ok) {
      applied++;
      var after = checkPlan(r.state); if (r.state.items.length > 14 + 26) throw new Error('too many stops: ' + r.state.items.length);
      var back = MM.plan(MM.decodeState(MM.encodeState(r.state))); if (back.totals.total !== after.totals.total) throw new Error('an edited trip changed through its share link');
      if (!r.changes.length) throw new Error('it worked but said nothing changed');
    } else {
      refused++;
      if (JSON.stringify(r.state) !== before) throw new Error('refused, but the trip changed');
      if (!r.errors.length) throw new Error('refused without a reason');
    }
  } catch (x) { if (process.env.FUZZ_DEBUG) console.log(x.stack + '\n   ' + JSON.stringify(ops)); bad4.add('edit', JSON.stringify({ state: before.slice(0, 120), ops: ops }), x); }
}
ok(N4 + ' random batches of edits (' + applied + ' applied, ' + refused + ' refused): all or nothing, the original is never touched, edited trips stay valid', !bad4.list().length, bad4.list().slice(0, 4).join('\n   '));
ok('the random edits exercised both outcomes', applied > N4 * 0.1 && refused > N4 * 0.1, applied + ' applied, ' + refused + ' refused');

console.log('\n' + pass + '/' + (pass + fail) + ' fuzz checks passed (seed ' + SEED + ')'); process.exit(fail ? 1 : 0);
