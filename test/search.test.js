/* Search tests: the one box that finds hostels, countries, things to do, ALL IN trips, routes and vibes. Run: npm test  (node test/search.test.js) */
['places', 'activities', 'media', 'legs', 'trips', 'entry', 'gallery', 'rules', 'guide'].forEach(function (f) { require('../data/' + f + '.js'); });
var MM = require('../logic.js');
require('../extras.js');
require('../edit.js');
require('../search.js');

var pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log('PASS  ' + name); } else { fail++; console.log('FAIL  ' + name + (extra ? '  -> ' + extra : '')); } }
function top(q, n) { return MM.search(q, { limit: n || 8 }); }
function first(q) { var r = top(q, 1)[0]; return r ? r.kind + ':' + r.id : '(nothing)'; }
function titles(q, n) { return top(q, n).map(function (r) { return r.title; }).join(' | '); }

/* ---------- finding a place ---------- */
ok('a hostel by name', first('hanoi') === 'place:hanoi' && first('Hanoi') === 'place:hanoi' && first('  HANOI  ') === 'place:hanoi', first('hanoi'));
ok('a hostel by the start of its name', first('han') === 'place:hanoi' && first('siem') === 'place:siem-reap' && first('koh r') === 'place:koh-rong', first('siem'));
ok('a hostel by the name with the spaces left out or in', first('hoian') === 'place:hoi-an' && first('siemreap') === 'place:siem-reap' && first('phnom penh') === 'place:phnom-penh' && first('luangprabang') === 'place:luang-prabang');
ok('a hostel by what people call it', first('ho chi minh') === 'place:saigon' && first('saigon') === 'place:saigon' && first('hcmc') === 'place:saigon' && first('angkor') === 'place:siem-reap' && first('el nido') === 'place:nacpan-beach' && first('phi phi') === 'place:phuket' && first('gili t') === 'place:gili-trawangan' && first('bohol') === 'place:panglao', [first('ho chi minh'), first('angkor'), first('el nido'), first('phi phi')].join());
ok('"bali" finds the Bali hostels first', top('bali', 2).map(function (r) { return r.id; }).sort().join() === 'nusa-lembongan,uluwatu', titles('bali', 3));
ok('a small typo is forgiven', first('hanoy') === 'place:hanoi' && first('banghok') === 'place:bangkok' && first('chang mai') === 'place:chiang-mai' && first('phnom pen') === 'place:phnom-penh', [first('hanoy'), first('banghok'), first('chang mai')].join());
ok('accents and punctuation do not matter', first('Hồ Chí Minh') === 'place:saigon' || first('ho-chi-minh') === 'place:saigon');

/* ---------- countries, tours, trips, vibes ---------- */
ok('a country, from a few letters', first('viet') === 'country:VN' && first('vietnam') === 'country:VN' && first('thai') === 'country:TH' && first('phil') === 'country:PH' && first('indo') === 'country:ID' && first('camb') === 'country:KH' && first('laos') === 'country:LA', [first('viet'), first('phil'), first('indo')].join());
ok('two letters only ever find a place or a country', MM.search('th').every(function (r) { return r.kind === 'place' || r.kind === 'country'; }) && first('th') === 'country:TH' && first('la') === 'country:LA' && MM.search('a').length === 0 && MM.search('').length === 0 && MM.search('   ').length === 0);
ok('something to do, by name or by the word for it', first('kayak') === 'tour:' + MM.search('kayak')[0].id && /kayak/i.test(MM.search('kayak')[0].title) && /cooking/i.test(MM.search('cooking')[0].title) && /surf/i.test(titles('surf', 5)) && /dive/i.test(titles('dive', 5)) && /tubing/i.test(titles('tubing', 5)), titles('kayak', 3));
ok('a tour carries the place it belongs to and the tour id', (function () { var r = MM.search('sunrise angkor')[0]; return r.kind === 'tour' && r.p === 'siem-reap' && MM.ACTS[r.act] && MM.ACTS[r.act].p === 'siem-reap' && /Angkor/.test(r.title); })());
ok('the Ha Giang Loop finds the tours and the ALL IN trip', /Ha Giang/.test(titles('ha giang', 6)) && top('loop', 4).some(function (r) { return r.kind === 'allin' && r.id === 'loop'; }) && top('ha giang', 6).some(function (r) { return r.kind === 'tour'; }));
ok('an ALL IN trip', top('all in vietnam', 2)[0].kind === 'allin' && top('all in vietnam', 2)[0].trip === 'vietnam' && top('lombok', 5).some(function (r) { return r.kind === 'allin' && r.id === 'gili-lombok'; }));
ok('a classic route and a vibe', top('lombok surf', 3).some(function (r) { return r.kind === 'route' && r.route === 'lombok-surf'; }) && first('party') === 'theme:party' && first('cheap') === 'theme:cheap' && top('surf', 3).some(function (r) { return r.kind === 'theme' && r.theme === 'surfdive'; }));
ok('nothing sensible: nothing, not rubbish', MM.search('xqzw').length === 0 && MM.search('zzzzz').length === 0 && MM.search('full moon').length === 0);
ok('every word has to match something', MM.search('hanoi surf').every(function (r) { return /surf/i.test(r.title + ' ' + r.sub) || r.kind === 'theme' || r.kind === 'tour' || r.kind === 'place'; }) && MM.search('hanoi zzzz').length === 0);

/* ---------- the mix on screen ---------- */
ok('a mix: no more than 8, and no wall of tours', (function () { var r = top('a b', 8); return r.length <= 8; })() && MM.search('tour').length <= 8 && MM.search('tour').filter(function (r) { return r.kind === 'tour'; }).length <= 4);
ok('the limit is honoured', top('koh', 3).length === 3 && top('koh', 1).length === 1 && MM.search('koh').length <= 8);
ok('each result has what the page needs to draw and pick it', MM.search('hanoi').every(function (r) { return r.kind && r.id && r.title && r.sub && r.tag && typeof r.score === 'number'; }) && MM.search('viet').filter(function (r) { return r.kind === 'country'; }).every(function (r) { return !!r.c; }));
ok('places and countries come before tours for the same word', (function () { var r = top('hanoi', 8), pi = r.map(function (x) { return x.kind; }).indexOf('place'), ti = r.map(function (x) { return x.kind; }).indexOf('tour'); return pi === 0 && ti > pi; })());
ok('what to show before anything is typed: the six countries and two vibes', (function () { var h = MM.searchHints(); return h.length === 8 && h.filter(function (x) { return x.kind === 'country'; }).length === 6 && h.filter(function (x) { return x.kind === 'theme'; }).length === 2; })());

/* ---------- every hostel, every tour, every trip can be found by its own name ---------- */
ok('every hostel is the first result for its own name', MM.PLACE_ORDER.every(function (id) { var r = MM.search(MM.PLACES[id].n)[0]; return r && r.kind === 'place' && r.id === id; }), MM.PLACE_ORDER.filter(function (id) { var r = MM.search(MM.PLACES[id].n)[0]; return !(r && r.kind === 'place' && r.id === id); }).join());
ok('every country is the first result for its own name', Object.keys(MM.COUNTRIES).every(function (c) { var r = MM.search(MM.COUNTRIES[c].n)[0]; return r && r.kind === 'country' && r.id === c; }));
ok('every tour can be found by its own full name', (function () { var bad = []; Object.keys(MM.ACTS).forEach(function (id) { var a = MM.ACTS[id]; var r = MM.search(a.n, { limit: 8 }); if (!r.some(function (x) { return x.kind === 'tour' && x.title === a.n && x.p === a.p; })) bad.push(a.n); }); return bad.length === 0; })());
ok('every ALL IN trip and every classic route can be found by its own name', MM.ALL_IN.every(function (t) { return MM.search('ALL IN ' + t.n).some(function (r) { return r.kind === 'allin' && r.id === t.id; }); }) && MM.CLASSICS.every(function (c) { return MM.search(c.n).some(function (r) { return r.kind === 'route' && r.id === c.id; }); }), MM.CLASSICS.filter(function (c) { return !MM.search(c.n).some(function (r) { return r.kind === 'route' && r.id === c.id; }); }).map(function (c) { return c.n; }).join());

/* ---------- it is quick, and it can't be broken ---------- */
ok('fast enough to run on every key press', (function () { var t0 = Date.now(), qs = ['h', 'ha', 'han', 'hano', 'hanoi', 'kay', 'kaya', 'viet', 'siem reap', 'ho chi', 'party', 'loop']; for (var i = 0; i < 300; i++) MM.search(qs[i % qs.length]); return Date.now() - t0 < 1500; })());
ok('junk in is nothing out, never a crash', ['<script>alert(1)</script>', '%', '\\', '()[]*+?', 'constructor', '__proto__', 'toString', 'a'.repeat(5000), null, undefined, 42, {}, []].every(function (q) { try { var r = MM.search(q); return Array.isArray(r); } catch (e) { return false; } }));
ok('results are plain data: titles with markup come back as text for the page to escape', (function () { return MM.search('hanoi').every(function (r) { return typeof r.title === 'string' && typeof r.sub === 'string'; }); })());

console.log('\n' + pass + '/' + (pass + fail) + ' search checks passed'); process.exit(fail ? 1 : 0);
