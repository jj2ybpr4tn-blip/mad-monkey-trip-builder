/* Server integration tests. Boots the real server on a temp port + temp data dir and exercises the API.
   Run: node test/server.test.js   (also part of `npm test`) */
const { spawn } = require('node:child_process'); const path = require('node:path'); const fs = require('node:fs'); const os = require('node:os');
const PORT = 8300 + Math.floor(Math.random() * 500), TOKEN = 'test-token-xyz', DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-test-'));
const B = 'http://localhost:' + PORT; let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('PASS  ' + n); } else { fail++; console.log('FAIL  ' + n + (x ? '  -> ' + x : '')); } };
const j = (p, o) => fetch(B + p, o).then(async (r) => ({ s: r.status, b: await r.json().catch(() => null) }));
const post = (p, body, h) => j(p, { method: 'POST', headers: { 'content-type': 'application/json', ...(h || {}) }, body: JSON.stringify(body) });
const adm = { Authorization: 'Bearer ' + TOKEN };
const lead = (extra) => ({ type: 'review_request', contact: { name: 'Sam', email: 'sam@example.com', whatsapp: '+447000000000', partySize: 2, consent: true }, trip: { state: 'i=s.hanoi.3~s.hoi-an.3&d=2026-11-18', route: 'Hanoi → Hoi An', days: 7, start: '2026-11-18', stops: ['hanoi', 'hoi-an'], estTotalUsd: 300 }, hold: { requested: true }, itinerary: 'x', ...(extra || {}) });

const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'server.mjs')], { env: { ...process.env, PORT, DATA_DIR: DIR, ADMIN_TOKEN: TOKEN, HOLD_HOURS: '48' }, stdio: 'ignore' });
const done = (code) => { srv.kill(); fs.rmSync(DIR, { recursive: true, force: true }); console.log('\n' + pass + '/' + (pass + fail) + ' server checks passed'); process.exit(code); };

(async () => {
  for (let i = 0; i < 40; i++) { try { await fetch(B + '/api/live'); break; } catch { await new Promise((r) => setTimeout(r, 150)); } }
  /* static + protection */
  ok('serves the site', (await fetch(B + '/')).status === 200);
  ok('config.js switches the API on', /API_BASE:\s*'\/api'/.test(await (await fetch(B + '/config.js')).text()));
  for (const p of ['/server/server.mjs', '/package.json', '/test/logic.test.js', '/.git/config', '/docs/LEADS.md', '/assets/../server/data/leads.json']) ok('blocks ' + p, (await fetch(B + p)).status === 404);
  /* leads */
  const l = await post('/api/leads', lead());
  ok('accepts a lead, issues an MM- reference + hold', l.s === 200 && /^MM-[A-Z0-9]{6}$/.test(l.b.ref) && l.b.hold && l.b.hold.until);
  ok('refuses a lead without consent', (await post('/api/leads', lead({ contact: { name: 'x', email: 'x@x.io' } }))).s === 400);
  ok('refuses a bad email', (await post('/api/leads', lead({ contact: { name: 'x', email: 'nope', consent: true } }))).s === 400);
  const ref = l.b.ref;
  ok('public status is readable by reference', (await j('/api/status?ref=' + ref)).b.status === 'submitted');
  ok('unknown reference is 404', (await j('/api/status?ref=MM-AAAAAA')).s === 404);
  /* admin */
  ok('admin needs the token', (await j('/api/admin/leads')).s === 401 && (await j('/api/admin/leads', { headers: { Authorization: 'Bearer nope' } })).s === 401);
  const leads = await j('/api/admin/leads', { headers: adm }); const rec = leads.b.find((x) => x.ref === ref);
  ok('bed-hold sheet: Hanoi 18→21 Nov, Hoi An 21→24 Nov', rec.sheet && rec.sheet[0].placeId === 'hanoi' && rec.sheet[0].checkIn === '2026-11-18' && rec.sheet[0].checkOut === '2026-11-21' && rec.sheet[1].checkIn === '2026-11-21' && rec.sheet[1].nights === 3, JSON.stringify(rec.sheet));
  const ready = await j('/api/admin/leads/' + ref, { method: 'PATCH', headers: { 'content-type': 'application/json', ...adm }, body: JSON.stringify({ status: 'ready', publicNote: 'Checked!', payLink: 'https://example.com/pay' }) });
  ok('crew can mark it ready with a note + pay link, guest sees them', ready.b.status === 'ready' && (await j('/api/status?ref=' + ref)).b.payLink === 'https://example.com/pay');
  ok('pay link only shown once ready (hidden while checking)', (await j('/api/admin/leads/' + ref, { method: 'PATCH', headers: { 'content-type': 'application/json', ...adm }, body: JSON.stringify({ status: 'checking' }) })).s === 200 && (await j('/api/status?ref=' + ref)).b.payLink === '');
  await j('/api/admin/leads/' + ref, { method: 'PATCH', headers: { 'content-type': 'application/json', ...adm }, body: JSON.stringify({ payLink: 'http://insecure' }) });
  ok('non-https pay links are dropped', (await j('/api/admin/leads', { headers: adm })).b.find((x) => x.ref === ref).payLink === '');
  const ext = await j('/api/admin/leads/' + ref, { method: 'PATCH', headers: { 'content-type': 'application/json', ...adm }, body: JSON.stringify({ extendHoldHours: 24 }) });
  ok('hold can be extended by 24h', Date.parse(ext.b.hold.until) > Date.parse(rec.hold.until) + 23 * 3600000);
  const dec = await j('/api/admin/leads/' + ref, { method: 'PATCH', headers: { 'content-type': 'application/json', ...adm }, body: JSON.stringify({ status: 'declined' }) });
  ok('declining releases the beds', dec.b.status === 'declined' && dec.b.hold.status === 'released');
  const l2 = await post('/api/leads', lead({ hold: { requested: false } })); ok('no hold when not asked for', (await j('/api/admin/leads', { headers: adm })).b.find((x) => x.ref === l2.b.ref).hold.requested === false);
  /* live, reviews, flow */
  const lv = await j('/api/admin/live', { method: 'PUT', headers: { 'content-type': 'application/json', ...adm }, body: JSON.stringify({ notice: 'hi', spots: { vietnam: { left: 4 }, bogus: { left: 1 } }, legs: { 'HAN|DAD|flight': { u: 39 }, '../x|y|z': { u: 1 } }, acts: { 'hanoi-pub-crawl': 9, nope: 5 } }) });
  ok('live data: keeps valid trips/legs/activities, drops junk', lv.b.spots.vietnam.left === 4 && !lv.b.spots.bogus && lv.b.legs['HAN|DAD|flight'].u === 39 && Object.keys(lv.b.legs).length === 1 && lv.b.acts['hanoi-pub-crawl'] === 9 && !lv.b.acts.nope);
  ok('live data is public', (await j('/api/live')).b.notice === 'hi');
  ok('reviews need admin to add', (await post('/api/admin/reviews', { hostel: 'hanoi', q: 'x' })).s === 401);
  await post('/api/admin/reviews', { hostel: 'hanoi', q: 'Great pub crawl', by: 'Mia, 24', from: 'UK' }, adm); await post('/api/admin/reviews', { hostel: 'narnia', q: 'x' }, adm);
  ok('public reviews show approved quotes, reject unknown hostels', (await j('/api/reviews')).b.hanoi[0].q === 'Great pub crawl' && !(await j('/api/reviews')).b.narnia);
  const fl = await post('/api/admin/flow', { csv: 'from,to,count\nhanoi,hoi-an,300\nbad,row,2\nsiem-reap,koh-rong,90' }, adm);
  ok('flow import: 2 good rows, 1 bad line reported', fl.b.imported === 2 && fl.b.badLines.length === 1);
  ok('flow endpoint combines stays + guests planning', (await j('/api/flow')).b.rows.some((r) => r.src === 'stays' && r.a === 'hanoi') && (await j('/api/flow')).b.rows.some((r) => r.src === 'planning'));
  /* groups: per-member ops are race-safe */
  const g = (await post('/api/groups', { trip: 'i=s.hanoi.3', organiser: { name: 'Ewan' } })).b, m1 = (await post('/api/groups/' + g.id + '/members', { name: 'Sam' })).b.member, m2 = (await post('/api/groups/' + g.id + '/members', { name: 'Ali' })).b.member;
  const patch = (m, body) => j('/api/groups/' + g.id + '/members/' + m.id, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  await Promise.all([1, 2, 3, 4, 5, 6].flatMap((i) => [patch(m1, { votes: { ['s' + i]: 'y' } }), patch(m2, { votes: { ['t' + i]: 'n' }, in: true })]));
  const gg = (await j('/api/groups/' + g.id)).b; ok('groups: 12 simultaneous votes all land', gg.members.find((x) => x.id === m1.id).votes && Object.keys(gg.members[0].votes).length === 6 && Object.keys(gg.members[1].votes).length === 6 && gg.members[1].in === true);
  await patch(m1, { votes: { 'bad key!': 'y', x: 'z', good: 'm' } }); ok('groups: invalid vote keys/values rejected', (await j('/api/groups/' + g.id)).b.members[0].votes.good === 'm' && !(await j('/api/groups/' + g.id)).b.members[0].votes['bad key!'] && !(await j('/api/groups/' + g.id)).b.members[0].votes.x);
  /* events + funnel + limits */
  await post('/api/event', { n: 'door', p: { door: 'quiz' }, s: 'abc' }); await post('/api/event', { n: 'view', s: 'abc' });
  const fu = (await j('/api/admin/funnel', { headers: adm })).b; ok('funnel counts events, sessions and doors', fu.byName.door === 1 && fu.sessions.view === 1 && fu.doors.quiz === 1);
  let last = 0; for (let i = 0; i < 14; i++) last = (await post('/api/leads', lead({ contact: { name: 'x', email: 'bad' } }))).s; ok('rate limit kicks in per IP (429)', last === 429);
  done(fail ? 1 : 0);
})().catch((e) => { console.error(e); done(1); });
