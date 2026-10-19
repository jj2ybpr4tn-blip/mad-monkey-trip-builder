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

const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'server.mjs')], { env: { ...process.env, PORT, DATA_DIR: DIR, ADMIN_TOKEN: TOKEN, HOLD_HOURS: '48', MM_TEST_SOON: 'laos,indonesia' }, stdio: 'ignore' });
const done = (code) => { srv.kill(); console.log('\n' + pass + '/' + (pass + fail) + ' server checks passed'); setTimeout(() => { try { fs.rmSync(DIR, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch { /* temp dir, the OS cleans it */ } process.exit(code); }, 300); };

(async () => {
  for (let i = 0; i < 40; i++) { try { await fetch(B + '/api/live'); break; } catch { await new Promise((r) => setTimeout(r, 150)); } }
  /* static + protection */
  ok('serves the site', (await fetch(B + '/')).status === 200);
  { const html = await (await fetch(B + '/')).text(), bad = [];
    const files = [...html.matchAll(/(?:src|href)="((?!https?:|\/\/|#|data:)[^"?]+\.(?:js|css))(?:\?[^"]*)?"/g)].map((m) => m[1]);
    for (const f of files) if ((await fetch(B + '/' + f)).status !== 200) bad.push(f);
    ok('every script and stylesheet index.html loads is served (' + files.length + ')', files.length > 20 && !bad.length, bad.join(', ')); }
  ok('config.js switches the API on', /API_BASE:\s*'\/api'/.test(await (await fetch(B + '/config.js')).text()));
  for (const p of ['/server/server.mjs', '/package.json', '/test/logic.test.js', '/.git/config', '/docs/LEADS.md', '/assets/../server/data/leads.json']) ok('blocks ' + p, (await fetch(B + p)).status === 404);
  /* leads */
  const l = await post('/api/leads', lead());
  ok('accepts a lead, issues an MM- reference + hold', l.s === 200 && /^MM-[A-Z0-9]{6}$/.test(l.b.ref) && l.b.hold && l.b.hold.until);
  ok('refuses a lead without consent', (await post('/api/leads', lead({ contact: { name: 'x', email: 'x@x.io' } }))).s === 400);
  ok('refuses a bad email with no WhatsApp', (await post('/api/leads', lead({ contact: { name: 'x', email: 'nope', consent: true } }))).s === 400);
  { const r = await post('/api/leads', lead({ contact: { name: 'Wa', via: 'whatsapp', whatsapp: '+44 7700 900123', consent: true } }));
    ok('accepts WhatsApp only, no email', r.s === 200 && r.b.ref); }
  { const r = await post('/api/leads', lead({ contact: { name: 'Em', via: 'email', email: 'em@example.com', consent: true } }));
    ok('accepts email only, no WhatsApp', r.s === 200 && r.b.ref); }
  ok('refuses a lead with neither', (await post('/api/leads', lead({ contact: { name: 'x', consent: true } }))).s === 400);
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
  /* dated fares: off without keys, and inputs are policed */
  ok('fares: 503 when no provider keys are set', (await j('/api/fares?from=HAN&to=DAD&date=2099-01-01')).s === 503);
  /* groups: plan together, Route A/B, own routes, organiser key */
  const gp = (body, h) => j('/api/groups/' + g.id, { method: 'PATCH', headers: { 'content-type': 'application/json', ...(h || {}) }, body: JSON.stringify(body) });
  ok('groups: the organiser key is never sent out', !(await j('/api/groups/' + g.id)).b.organiser.id && g.organiser.id);
  ok('groups: strangers cannot change the trip', (await gp({ org: 'nope', trip: 'i=s.pai.3' })).s === 403);
  ok('groups: organiser can add Route B', (await gp({ org: g.organiser.id, alt: 'i=s.bangkok.3' })).s === 200 && (await j('/api/groups/' + g.id)).b.alt === 'i=s.bangkok.3');
  await patch(m1, { wants: ['p:pai', 'a:x-hoi-an-y', 'bad idea', 'p:pai'], votes: { route: 'b' }, trip: 'i=s.hoi-an.3&d=2027-01-10' });
  const g2 = (await j('/api/groups/' + g.id)).b, s1 = g2.members.find((x) => x.id === m1.id);
  ok('groups: ideas kept, junk + duplicates dropped; route vote + own route saved', JSON.stringify(s1.wants) === '["p:pai","a:x-hoi-an-y"]' && s1.votes.route === 'b' && s1.trip === 'i=s.hoi-an.3&d=2027-01-10');
  await gp({ org: g.organiser.id, trip: 'i=s.bangkok.3', alt: '', clearRouteVotes: true });
  const g3 = (await j('/api/groups/' + g.id)).b;
  ok('groups: picking Route B swaps the trip and clears route votes', g3.trip === 'i=s.bangkok.3' && !g3.alt && !g3.members.find((x) => x.id === m1.id).votes.route);
  /* short links + link previews */
  const px = 'data:image/jpeg;base64,' + Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString('base64');
  const sh = await post('/api/share', { state: 'i=s.hanoi.3~s.hoi-an.4&d=2027-01-10', img: px });
  ok('share: short code issued', sh.s === 200 && /^[a-z0-9]{7}$/.test(sh.b.code));
  ok('share: same trip gets the same code', (await post('/api/share', { state: 'i=s.hanoi.3~s.hoi-an.4&d=2027-01-10' })).b.code === sh.b.code);
  ok('share: rejects junk trips', (await post('/api/share', { state: '<script>' })).s === 400 && (await post('/api/share', { state: 'i=' })).s === 400);
  const tp = await fetch(B + '/t/' + sh.b.code).then((r) => r.text());
  ok('share: /t/ page has route title, price and image for previews', /og:title" content="Hanoi → Hoi An · 8 days/.test(tp) && /og:image" content="http[^"]+\/t\/[a-z0-9]{7}\.jpg/.test(tp) && /location\.replace\("\/#\/build\/i=s\.hanoi/.test(tp));
  ok('share: preview image served', (await fetch(B + '/t/' + sh.b.code + '.jpg')).headers.get('content-type') === 'image/jpeg');
  ok('share: code resolves back to the trip', (await j('/api/share/' + sh.b.code)).b.state === 'i=s.hanoi.3~s.hoi-an.4&d=2027-01-10');
  /* launch waitlist, assignment, hostel details */
  const soonTrip = 'indonesia', liveTrip = 'vietnam';
  ok('waitlist: rejects a trip that is already live', (await post('/api/waitlist', { trip: liveTrip, contact: { name: 'A', whatsapp: '+447700900123', consent: true } })).s === 400);
  ok('waitlist: rejects without consent or contact', (await post('/api/waitlist', { trip: soonTrip, contact: { name: 'A', whatsapp: '+447700900123' } })).s === 400 && (await post('/api/waitlist', { trip: soonTrip, contact: { name: 'A', consent: true } })).s === 400);
  ok('waitlist: accepts WhatsApp only', (await post('/api/waitlist', { trip: soonTrip, contact: { name: 'Wa', via: 'whatsapp', whatsapp: '+44 7700 900123', consent: true } })).s === 200);
  ok('waitlist: accepts email only, and ignores a duplicate', (await post('/api/waitlist', { trip: 'laos', contact: { name: 'Em', via: 'email', email: 'em@example.com', consent: true } })).s === 200 && (await post('/api/waitlist', { trip: 'laos', contact: { name: 'Em', via: 'email', email: 'EM@example.com', consent: true } })).s === 200 && (await j('/api/admin/waitlist', { headers: adm })).b.filter((x) => x.trip === 'laos').length === 1);
  ok('waitlist: list needs admin', (await j('/api/admin/waitlist')).s === 401);
  { const wl = (await j('/api/admin/waitlist', { headers: adm })).b; await j('/api/admin/waitlist/' + wl[0].id, { method: 'DELETE', headers: adm }); ok('waitlist: entries can be removed', (await j('/api/admin/waitlist', { headers: adm })).b.length === wl.length - 1); }
  { const ls = (await j('/api/admin/leads', { headers: adm })).b; const ref = ls[0].ref;
    await j('/api/admin/leads/' + ref, { method: 'PATCH', headers: { ...adm, 'content-type': 'application/json' }, body: JSON.stringify({ assignee: 'Kyle' }) });
    const l2 = (await j('/api/admin/leads', { headers: adm })).b.find((x) => x.ref === ref); ok('assignee: saved and logged in the history', l2.assignee === 'Kyle' && l2.history.some((h) => /assigned to Kyle/.test(h.event))); }
  { await j('/api/admin/live', { method: 'PUT', headers: { ...adm, 'content-type': 'application/json' }, body: JSON.stringify({ notice: '', spots: {}, legs: {}, acts: {}, hostels: { hanoi: { addr: '1 Test Street', checkin: 'from 2pm', phone: '+84 1', directions: 'Taxi from the station' }, narnia: { addr: 'x' } } }) });
    const L = (await j('/api/live')).b; ok('hostel details: saved for real hostels only, public for trip packs', L.hostels.hanoi && L.hostels.hanoi.addr === '1 Test Street' && !L.hostels.narnia); }
  /* events + funnel + limits */
  await post('/api/event', { n: 'door', p: { door: 'quiz' }, s: 'abc' }); await post('/api/event', { n: 'view', s: 'abc' });
  const fu = (await j('/api/admin/funnel', { headers: adm })).b; ok('funnel counts events, sessions and doors', fu.byName.door === 1 && fu.sessions.view === 1 && fu.doors.quiz === 1);
  let last = 0; for (let i = 0; i < 14; i++) last = (await post('/api/leads', lead({ contact: { name: 'x', email: 'bad' } }))).s; ok('rate limit kicks in per IP (429)', last === 429);
  done(fail ? 1 : 0);
})().catch((e) => { console.error(e); done(1); });
