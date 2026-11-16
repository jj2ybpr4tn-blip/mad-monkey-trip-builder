#!/usr/bin/env node
/* Sample travellers for trying "Find your crew" on the bundled crew server. Each one sends a real trip with Find your crew ticked, through the same
   API a guest's browser uses, so the crew console's Find your crew tab has matches to show.
     npm run server                                  (in one terminal)
     node scripts/seed-crew-demo.mjs [http://localhost:8000]
   Every sample is marked as one: source "demo-seed" (the console shows a "sample" tag), @example.com emails and numbers from the UK's drama range
   (+44 7700 900xxx), so none of them can be mistaken for, or reach, a real person. Run it once on a fresh server: the server takes 12 trips an hour
   from one address. Dates are counted from today, so the samples are always in the future. */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
for (const f of ['places', 'activities', 'media', 'legs', 'trips', 'entry', 'gallery', 'rules', 'guide']) require(path.join(ROOT, 'data', f + '.js'));
const MM = require(path.join(ROOT, 'logic.js'));
require(path.join(ROOT, 'extras.js')); require(path.join(ROOT, 'crew.js'));

const BASE = (process.argv[2] || 'http://localhost:8000').replace(/\/$/, '');
const day = (n) => { const d = new Date(Date.now() + n * 86400000); return d.toISOString().slice(0, 10); };
const T0 = 100;                                   // the Philippines crew starts about 100 days from now; the others are spread around it

// [name, home, age, gender, party, life, vibes, about, wants { who, ages, solo }, stops [[place, nights]], start (days from now, or null)]
const PEOPLE = [
  ['Sophie', 'UK', '22-25', 'woman', 1, ['gap-year'], ['party', 'islands'], 'Gap year before a grad job. Sunsets, snorkelling and one big night a week.', { who: 'women', ages: 'near', solo: true }, [['dumaguete', 2], ['siquijor', 3], ['panglao', 3], ['siargao', 4]], T0],
  ['Mia', 'Ireland', '22-25', 'woman', 1, ['quit-job'], ['party', 'surf'], 'Quit my job in finance. Learning to surf and saying yes to everything.', { who: 'women', ages: 'near', solo: false }, [['siquijor', 3], ['panglao', 3], ['siargao', 4]], T0 + 2],
  ['Leah', 'Australia', '26-29', 'woman', 1, ['career-break'], ['chill', 'food'], 'On a career break. Hammocks, street food and early nights (mostly).', { who: 'anyone', ages: 'near', solo: false }, [['panglao', 3], ['siargao', 4]], T0 + 5],
  ['Tom', 'UK', '22-25', 'man', 1, ['graduated'], ['party', 'adventure'], 'Just finished uni. Cliff jumps first, questions later.', { who: 'anyone', ages: 'near', solo: false }, [['siquijor', 3], ['panglao', 3]], T0 + 2],
  ['Zoe', 'New Zealand', '18-21', 'woman', 1, ['gap-year'], ['islands', 'adventure'], 'First big trip on my own. Dates still to sort.', { who: 'women', ages: 'any', solo: false }, [['dumaguete', 2], ['siquijor', 3]], null],
  ['Jess', 'Canada', '18-21', 'woman', 1, ['gap-year'], ['moto', 'party'], 'Gap year. Want to ride the Loop and find people for Hoi An.', { who: 'anyone', ages: 'any', solo: false }, [['hanoi', 3], ['hoi-an', 3]], T0 - 30],
  ['Ben', 'Netherlands', '22-25', 'man', 1, ['uni-break'], ['moto', 'culture'], 'Between uni years. Coffee, old towns and a motorbike.', { who: 'anyone', ages: 'near', solo: false }, [['hanoi', 4], ['hoi-an', 3]], T0 - 31],
  ['Priya', 'UK', '26-29', 'woman', 1, ['sabbatical'], ['culture', 'food'], 'Sabbatical. Temples, cooking classes and good company.', { who: 'women', ages: 'any', solo: false }, [['bangkok', 2], ['chiang-mai', 4], ['pai', 3]], T0 - 20],
  ['Anna', 'Germany', '30-35', 'woman', 1, ['remote'], ['chill', 'food'], 'Working remotely for a month. Free most evenings and weekends.', { who: 'women', ages: 'near', solo: false }, [['chiang-mai', 5], ['pai', 3]], T0 - 17]
];

let n = 0, made = 0;
for (const [name, home, age, gender, party, life, vibes, about, want, stops, start] of PEOPLE) {
  n++;
  const st = MM.defaultState(); st.items = stops.map(([p, nights]) => ({ kind: 'stop', p, n: nights, acts: [] })); if (start != null) st.start = day(start);
  const pl = MM.plan(st), link = BASE + '/#/build/' + MM.encodeState(st);
  const contact = { name, via: 'whatsapp', whatsapp: '+447700900' + String(100 + n), email: name.toLowerCase() + '@example.com', from: '', partySize: party, dates: start == null ? 'open' : 'fixed', notes: 'Sample traveller for trying Find your crew.', consent: true };
  const payload = MM.leadPayload(st, pl, contact, { source: 'demo-seed', link });
  payload.type = 'review_request'; payload.status = 'submitted'; payload.hold = { requested: false };
  payload.findCrew = { on: true, age, gender, home, life, vibes, about, want, consent: true, adult: true };
  const res = await fetch(BASE + '/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).catch((e) => ({ ok: false, status: 0, err: e }));
  if (!res.ok) {
    if (res.status === 429) { console.error('The server takes 12 trips an hour from one address and has had enough. Restart it with a fresh DATA_DIR, or wait an hour.'); break; }
    console.error(res.status ? 'Sending ' + name + ' failed: HTTP ' + res.status : 'Is the server running at ' + BASE + '? (npm run server)'); process.exit(1);
  }
  const d = await res.json(); made++;
  console.log((d.ref || '?') + '  ' + name.padEnd(7) + MM.routeLine(pl) + (st.start ? '  from ' + st.start : '  (no dates)'));
}
console.log('\n' + made + ' sample travellers sent. Open ' + BASE + '/admin and the "Find your crew" tab.');
