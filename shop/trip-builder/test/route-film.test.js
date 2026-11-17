/* Route film tests (route-film.js): the parts that need no browser. Which vehicle each way of travelling gets, how long each leg
 * takes, which legs draw when the trip changes, and the curve each leg follows. The film itself (drawing, the loop, Skip, Replay,
 * reduced motion, only looping while the map is on screen) is checked in a browser tab by test/ui-film.js.
 * Run: node test/route-film.test.js   (part of npm test). */
require('../data/map-data.js');
require('../data/places.js');
var F = require('../route-film.js');

var pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log('PASS  ' + name); } else { fail++; console.log('FAIL  ' + name + (extra ? '  -> ' + extra : '')); } }
function same(name, got, want) { var g = JSON.stringify(got), w = JSON.stringify(want); ok(name, g === w, 'got ' + g + ', want ' + w); }

/* ---------- 1. the vehicle for each way of travelling ---------- */
var modes = {
  flight: 'plane', Fly: 'plane', 'Short flight': 'plane', plane: 'plane',
  bus: 'bus', 'Sleeper bus': 'bus', 'airport bus': 'bus', coach: 'bus', '': 'bus', unknown: 'bus',
  boat: 'boat', ferry: 'boat', speedboat: 'boat', 'Slow boat': 'boat', 'Junk cruise': 'boat',
  scooter: 'scooter', motorbike: 'scooter', 'Easy rider': 'scooter',
  train: 'train', 'Night train': 'train', van: 'van', minivan: 'van', shuttle: 'van',
  taxi: 'car', Grab: 'car', 'Private transfer': 'car', 'tuk-tuk': 'car'
};
Object.keys(modes).forEach(function (m) { same('mode("' + m + '") is ' + modes[m], F.mode(m), modes[m]); });
same('mode(null) is a bus', F.mode(null), 'bus');
Object.keys({ plane: 1, bus: 1, van: 1, train: 1, boat: 1, car: 1, scooter: 1 }).forEach(function (m) { ok('there is an icon for ' + m, Array.isArray(F.ICONS[m]) && F.ICONS[m].length > 0); });

/* ---------- 2. timing: a second or two a leg, a short pause at each stop, long trips kept watchable ---------- */
var t = F.timing([50, 300, 800]);
same('legs take 1 to 2 seconds by length', t.legs, [1000, 1450, 2000]);
same('a short pause at each stop', t.pause, 450);
same('the total adds up', t.total, 1000 + 1450 + 2000 + 3 * 450);
same('speed 2 halves each leg', F.timing([50, 300, 800], { speed: 2 }).legs, [500, 725, 1000]);
var long = F.timing(new Array(20).fill(800));
ok('a long trip is kept to about 24 seconds', long.total <= 24000 + 20 * 650 && long.total >= 20000, long.total);
ok('a long trip keeps each leg visible (at least 0.65 s)', long.legs.every(function (x) { return x >= 650; }), long.legs[0]);
ok('a long trip still pauses at each stop (at least 0.2 s)', long.pause >= 200, long.pause);
same('no legs, no time', F.timing([]).total, 0);

/* ---------- 3. which legs draw when the trip changes ---------- */
var cases = [
  ['a stop added at the end draws the new leg', ['hanoi', 'hoi-an'], ['hanoi', 'hoi-an', 'saigon'], { from: 1, to: 1, stops: [2] }],
  ['a stop put in the middle draws the two legs either side', ['hanoi', 'saigon'], ['hanoi', 'hoi-an', 'saigon'], { from: 0, to: 1, stops: [1] }],
  ['a new first stop draws its leg', ['hoi-an', 'saigon'], ['hanoi', 'hoi-an', 'saigon'], { from: 0, to: 0, stops: [0] }],
  ['a stop swapped for another redraws its legs', ['hanoi', 'hue', 'saigon'], ['hanoi', 'hoi-an', 'saigon'], { from: 0, to: 1, stops: [1] }],
  ['a stop taken out draws nothing', ['hanoi', 'hoi-an', 'saigon'], ['hanoi', 'saigon'], null],
  ['stops moved round draw nothing', ['hanoi', 'hoi-an', 'saigon'], ['hanoi', 'saigon', 'hoi-an'], null],
  ['the same trip draws nothing', ['hanoi', 'hoi-an'], ['hanoi', 'hoi-an'], null],
  ['a whole new trip draws it all', [], ['hanoi', 'hoi-an', 'saigon'], { from: 0, to: 1, stops: [0, 1, 2] }],
  ['a second stop draws the first leg', ['hanoi'], ['hanoi', 'hoi-an'], { from: 0, to: 0, stops: [1] }],
  ['going back to a place draws the leg back', ['hanoi', 'hoi-an', 'saigon'], ['hanoi', 'hoi-an', 'saigon', 'hoi-an'], { from: 2, to: 2, stops: [] }],
  ['an ALL IN trip dropped in draws its legs', ['hanoi', 'saigon'], ['hanoi', 'hue', 'hoi-an', 'dalat', 'saigon'], { from: 0, to: 3, stops: [1, 2, 3] }]
];
cases.forEach(function (c) { same(c[0], F.fresh(c[1], c[2]), c[3]); });

/* ---------- 4. the curve each leg follows ---------- */
var a = F.arc([100, 200], [300, 200]);
ok('a leg is a curve from one stop to the next', /^M100(\.0+)? 200(\.0+)? Q/.test(a.d.replace(/,/g, ' ')), a.d);
ok('the curve is a little longer than the straight line', a.len > 200 && a.len < 240, a.len);
ok('a leg bends upwards', +a.d.replace(/,/g, ' ').split(/[ QM]+/).filter(Boolean)[3] < 200, a.d);
ok('a stop on top of the last one is not a crash', isFinite(F.arc([5, 5], [5, 5]).len));

/* ---------- 5. it loads anywhere ---------- */
ok('MMRouteFilm is a function', typeof F === 'function');
var threw = false; try { F(null, []); } catch (e) { threw = /no <svg>/.test(e.message); }
ok('MMRouteFilm says so when it gets no map', threw);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
