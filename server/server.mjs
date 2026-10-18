#!/usr/bin/env node
/* ============================================================
   MAD MONKEY TRIP BUILDER — crew server (zero dependencies, Node 18+)

     npm run server        → http://localhost:8000  (site + API + /admin)

   What it does
     • serves the static site, with the API switched on (config.js gets API_BASE=/api)
     • POST /api/leads       review requests from guests -> stored, bed-hold sheet computed, crew notified
     • GET  /api/status      what the guest's trip-status page shows
     • /api/groups…          group mode (votes, ideas, Route A/B, own routes for meet-ups)
     • POST /api/share       short link + preview image for a trip  →  /t/<code> (rich previews on WhatsApp etc.)
     • GET  /api/live        spots left + price overrides the crew maintains
     • GET  /api/fares       ?from=BKK&to=CNX&date=YYYY-MM-DD  lowest + highest real fare for that day (needs AMADEUS_CLIENT_ID/SECRET)
     • GET  /api/reviews     approved guest quotes per hostel
     • GET  /api/flow        "where guests go next" from real data
     • POST /api/event       anonymous funnel events
     • /admin                the crew console (token login)

   Environment
     PORT            default 8000
     ADMIN_TOKEN     crew password. If unset, one is generated and saved to server/data/admin-token.txt
     HOLD_HOURS      default 48
     NOTIFY_WEBHOOK  optional Slack / Discord-style webhook that gets a message per new request
     AMADEUS_CLIENT_ID / AMADEUS_CLIENT_SECRET   optional, switches on date-specific flight prices
     AMADEUS_ENV     'production' for real fares (default 'test' returns sample data)
     PUBLIC_URL      optional, e.g. https://trips.madmonkeyhostels.com (used for absolute preview-image links)
     ALLOWED_ORIGIN  optional, only if the site is hosted somewhere other than this server (adds CORS)
     DATA_DIR        default server/data

   Data lives in plain JSON files in DATA_DIR. Back that folder up. To scale past a few thousand
   requests a month, swap the tiny store() below for a real database; the routes stay the same.
   ============================================================ */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);
for (const f of ['places', 'activities', 'media', 'legs', 'trips', 'entry', 'gallery', 'rules', 'guide']) require(path.join(ROOT, 'data', f + '.js'));
const MM = require(path.join(ROOT, 'logic.js'));
require(path.join(ROOT, 'extras.js'));

const PORT = +process.env.PORT || 8000;
const DATA = process.env.DATA_DIR || path.join(__dirname, 'data');
const HOLD_HOURS = +process.env.HOLD_HOURS || 48;
const NOTIFY = process.env.NOTIFY_WEBHOOK || '';
const ORIGIN = process.env.ALLOWED_ORIGIN || '';
fs.mkdirSync(DATA, { recursive: true });

/* ---------- tiny JSON store ---------- */
const stores = [];
function store(name, init) {
  const file = path.join(DATA, name + '.json'); let data, t;
  try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { data = init; }
  const s = {
    get: () => data, set: (v) => { data = v; },
    flush() { clearTimeout(t); const tmp = file + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(data)); fs.renameSync(tmp, file); },
    save() { clearTimeout(t); t = setTimeout(() => s.flush(), 200); }
  };
  stores.push(s); return s;
}
const leads = store('leads', []), groups = store('groups', {}), events = store('events', []), live = store('live', { updated: null, notice: '', spots: {}, legs: {}, acts: {} }),
  reviews = store('reviews', []), flowRows = store('flow', { rows: [] }), shares = store('shares', {});
const OG_DIR = path.join(DATA, 'og'); fs.mkdirSync(OG_DIR, { recursive: true });
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { stores.forEach((s) => s.flush()); process.exit(0); });

/* ---------- admin token ---------- */
let TOKEN = process.env.ADMIN_TOKEN || '';
if (!TOKEN) {
  const tf = path.join(DATA, 'admin-token.txt');
  try { TOKEN = fs.readFileSync(tf, 'utf8').trim(); } catch { TOKEN = crypto.randomBytes(12).toString('base64url'); fs.writeFileSync(tf, TOKEN + '\n', { mode: 0o600 }); }
}
const authed = (req) => {
  const h = req.headers.authorization || ''; const got = h.startsWith('Bearer ') ? h.slice(7) : '';
  const a = Buffer.from(got), b = Buffer.from(TOKEN); return a.length === b.length && crypto.timingSafeEqual(a, b);
};

/* ---------- helpers ---------- */
const now = () => new Date().toISOString();
const rid = (n, alpha) => { const a = alpha || 'abcdefghjkmnpqrstuvwxyz23456789'; let o = ''; const b = crypto.randomBytes(n); for (let i = 0; i < n; i++) o += a[b[i] % a.length]; return o; };
const clip = (s, n) => String(s == null ? '' : s).slice(0, n);
function json(res, code, obj, extra) { const body = JSON.stringify(obj); res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...(extra || {}) }); res.end(body); }
function readBody(req, limit = 262144) {
  return new Promise((resolve, reject) => {
    let n = 0; const chunks = [];
    req.on('data', (c) => { n += c.length; if (n > limit) { reject(Object.assign(new Error('too large'), { code: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch { reject(Object.assign(new Error('bad json'), { code: 400 })); } });
    req.on('error', reject);
  });
}
const hits = new Map();
function limited(key, max, windowMs) {
  const t = Date.now(); const arr = (hits.get(key) || []).filter((x) => t - x < windowMs); arr.push(t); hits.set(key, arr); return arr.length > max;
}
setInterval(() => { const t = Date.now(); for (const [k, v] of hits) if (!v.some((x) => t - x < 3600000)) hits.delete(k); }, 600000).unref();
const ipOf = (req) => (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '?';
async function notify(text) { if (!NOTIFY) return; try { await fetch(NOTIFY, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, content: text }) }); } catch { /* notifications are best-effort */ } }


/* ---------- dated flight fares (optional) ---------- */
const AMA = { id: process.env.AMADEUS_CLIENT_ID || '', secret: process.env.AMADEUS_CLIENT_SECRET || '', host: process.env.AMADEUS_ENV === 'production' ? 'api.amadeus.com' : 'test.api.amadeus.com' };
const FARES_ON = !!(AMA.id && AMA.secret);
const flightPairs = new Set(MM.EDGES.filter((e) => e.m === 'flight').flatMap((e) => [e.a + '>' + e.b, e.b + '>' + e.a]));
const fareCache = new Map(), FARE_TTL = 6 * 3600e3; let amaTok = null, upstream = [];
async function amaToken() {
  if (amaTok && amaTok.exp > Date.now() + 60e3) return amaTok.v;
  const r = await fetch('https://' + AMA.host + '/v1/security/oauth2/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'client_credentials', client_id: AMA.id, client_secret: AMA.secret }) });
  if (!r.ok) throw new Error('token ' + r.status);
  const j = await r.json(); amaTok = { v: j.access_token, exp: Date.now() + (j.expires_in || 1500) * 1000 }; return amaTok.v;
}
async function lookupFare(from, to, date) {
  const key = from + '|' + to + '|' + date, hit = fareCache.get(key);
  if (hit && Date.now() - hit.t < FARE_TTL) return hit.v;
  const now = Date.now(); upstream = upstream.filter((t) => now - t < 3600e3);
  if (upstream.length >= 400) throw new Error('quota');            // hard cap on paid/queried calls per hour
  upstream.push(now);
  const q = new URLSearchParams({ originLocationCode: from, destinationLocationCode: to, departureDate: date, adults: '1', currencyCode: 'USD', max: '40' });
  const r = await fetch('https://' + AMA.host + '/v2/shopping/flight-offers?' + q, { headers: { Authorization: 'Bearer ' + await amaToken() } });
  let v;
  if (r.status === 400 || r.status === 404) v = { ok: false, reason: 'none' };
  else if (!r.ok) throw new Error('upstream ' + r.status);
  else {
    const j = await r.json(), prices = (j.data || []).map((o) => parseFloat(o.price && o.price.grandTotal)).filter((x) => x > 0).sort((a, b) => a - b);
    v = prices.length ? { ok: true, min: Math.round(prices[0]), max: Math.round(prices[prices.length - 1]), median: Math.round(prices[Math.floor(prices.length / 2)]), n: prices.length, currency: 'USD', from, to, date, test: AMA.host.startsWith('test.') } : { ok: false, reason: 'none' };
  }
  fareCache.set(key, { t: Date.now(), v }); if (fareCache.size > 5000) fareCache.delete(fareCache.keys().next().value);
  return v;
}

/* ---------- bed-hold sheet: what the crew needs to hold, by hostel and date ---------- */
function holdSheet(tripState) {
  try {
    const st = MM.decodeState(tripState); if (!st.start || !st.items.length) return null;
    const pl = MM.plan(st), rows = []; let cur = null;
    pl.days.forEach((d) => {
      if (d.kind !== 'stay' && d.kind !== 'block') { cur = null; return; }
      const seg = pl.segs[d.si], allin = seg.kind === 'allin';
      if (cur && cur.si === d.si) { cur.nights++; cur.last = d.date; }
      else { cur = { si: d.si, place: allin ? 'ALL IN ' + seg.trip.n : MM.PLACES[seg.p].n, placeId: allin ? null : seg.p, allin, nights: 1, first: d.date, last: d.date }; rows.push(cur); }
    });
    return rows.map((r) => ({ place: r.place, placeId: r.placeId, allin: r.allin, nights: r.nights, checkIn: MM.util.isoDate(r.first), checkOut: MM.util.isoDate(MM.util.addDays(r.last, 1)) }));
  } catch { return null; }
}
const publicStatus = (l) => ({ ref: l.ref, status: l.status === 'declined' ? 'declined' : l.status, note: l.publicNote || '', payLink: (l.status === 'ready' || l.status === 'approved') ? (l.payLink || '') : '',
  hold: l.hold && l.hold.status === 'active' ? { until: l.hold.until } : null });
const mmFlows = () => {
  const m = {}; const add = (a, b, n, src) => { if (a === b || !MM.PLACES[a] || !MM.PLACES[b]) return; const k = a + '>' + b + '|' + src; m[k] = m[k] || { a, b, n: 0, src }; m[k].n += n; };
  leads.get().forEach((l) => { if (l.status === 'declined') return; const ps = ((l.trip && l.trip.stops) || []).filter((p, i, arr) => i === 0 || p !== arr[i - 1]); for (let i = 1; i < ps.length; i++) add(ps[i - 1], ps[i], 1, 'planning'); });
  (flowRows.get().rows || []).forEach((r) => add(r.a, r.b, r.n, 'stays'));
  return Object.values(m);
};

/* expire holds that nobody has acted on */
setInterval(() => {
  let changed = false; const t = Date.now();
  leads.get().forEach((l) => { if (l.hold && l.hold.status === 'active' && l.status !== 'approved' && Date.parse(l.hold.until) < t) { l.hold.status = 'expired'; l.history.push({ at: now(), event: 'hold expired' }); changed = true; } });
  if (changed) leads.save();
}, 600000).unref();

/* ============================================================ API ============================================================ */
async function api(req, res, url) {
  const p = url.pathname.replace(/^\/api/, ''), m = req.method, ip = ipOf(req);
  const cors = ORIGIN ? { 'Access-Control-Allow-Origin': ORIGIN, 'Access-Control-Allow-Headers': 'content-type, authorization', 'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS' } : {};
  if (m === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  const J = (code, obj) => json(res, code, obj, cors);

  /* ---- public ---- */
  if (p === '/leads' && m === 'POST') {
    if (limited('lead:' + ip, 12, 3600000)) return J(429, { error: 'slow down' });
    const b = await readBody(req);
    const c = b.contact || {}, t = b.trip || {};
    const okEmail = /^\S+@\S+\.\S+$/.test(c.email || ''), waDigits = String(c.whatsapp || '').replace(/[^\d]/g, ''), okWa = waDigits.length >= 8 && waDigits.length <= 15;
    if (!(okEmail || okWa) || !clip(c.name, 80).trim() || !c.consent) return J(400, { error: 'name, consent and an email or WhatsApp number are required' });
    const via = c.via === 'email' && okEmail ? 'email' : c.via === 'whatsapp' && okWa ? 'whatsapp' : okWa ? 'whatsapp' : 'email';
    if (typeof t.state !== 'string' || t.state.length > 6000) return J(400, { error: 'trip is missing' });
    const ref = (() => { let r; do { r = 'MM-' + rid(6, 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'); } while (leads.get().some((l) => l.ref === r)); return r; })();
    const wantHold = !!(b.hold && b.hold.requested) && !!t.start;
    const rec = {
      ref, createdAt: now(), status: 'submitted', type: b.type || 'lead',
      contact: { name: clip(c.name, 80), via, email: okEmail ? clip(c.email, 120) : '', whatsapp: okWa ? clip(c.whatsapp, 40) : '', from: clip(c.from, 80), partySize: Math.max(1, Math.min(30, +c.partySize || 1)), dates: clip(c.dates, 10), notes: clip(c.notes, 1500) },
      trip: { link: clip(t.link, 1500), state: t.state, route: clip(t.route, 400), days: +t.days || 0, nights: +t.nights || 0, countries: (t.countries || []).slice(0, 8), stops: (t.stops || []).slice(0, 40).map((x) => clip(x, 40)), start: clip(t.start, 10),
        estTotalUsd: +t.estTotalUsd || 0, breakdownUsd: t.breakdownUsd || {}, allInBlocks: (t.allInBlocks || []).slice(0, 5), allInMatch: clip(t.allInMatch, 40), crewMates: +t.crewMates || 0, urgency: clip(t.urgency, 12) },
      attribution: { ref: clip(b.ref, 40), fromHostel: clip(b.fromHostel, 40), source: clip(b.source, 40) },
      itinerary: clip(b.itinerary, 20000),
      hold: wantHold ? { requested: true, hours: HOLD_HOURS, until: new Date(Date.now() + HOLD_HOURS * 3600000).toISOString(), status: 'active' } : { requested: false },
      sheet: holdSheet(t.state), publicNote: '', payLink: '', notes: [], history: [{ at: now(), event: 'submitted' }]
    };
    leads.get().unshift(rec); leads.save();
    notify(`New trip for review ${ref}: ${rec.contact.name} (${rec.contact.via === 'email' ? 'email ' + rec.contact.email : 'WhatsApp ' + rec.contact.whatsapp}) · ${rec.trip.route} · ${rec.trip.days} days · ~$${rec.trip.estTotalUsd}${wantHold ? ' · BED HOLD requested' : ''}${rec.trip.start ? ' · starts ' + rec.trip.start : ''}`);
    return J(200, { ref, status: 'submitted', hold: rec.hold.requested ? { until: rec.hold.until } : null });
  }
  if (p === '/status' && m === 'GET') {
    const l = leads.get().find((x) => x.ref === (url.searchParams.get('ref') || ''));
    return l ? J(200, publicStatus(l)) : J(404, { error: 'not found' });
  }
  if (p === '/event' && m === 'POST') {
    if (limited('ev:' + ip, 600, 3600000)) return J(429, {});
    const b = await readBody(req, 4096);
    if (!b.n || typeof b.n !== 'string') return J(400, {});
    events.get().push({ t: now(), n: clip(b.n, 40), p: b.p && typeof b.p === 'object' ? JSON.parse(clip(JSON.stringify(b.p), 400) || '{}') : {}, s: clip(b.s, 24) });
    if (events.get().length > 100000) events.set(events.get().slice(-80000));
    events.save(); return J(204, {});
  }
  if (p === '/live' && m === 'GET') return J(200, live.get());
  if (p === '/fares' && m === 'GET') {
    if (!FARES_ON) return J(503, { ok: false, reason: 'not-configured' });
    if (limited('fares:' + ip, 90, 60000)) return J(429, { ok: false, reason: 'slow-down' });
    const from = (url.searchParams.get('from') || '').toUpperCase(), to = (url.searchParams.get('to') || '').toUpperCase(), date = url.searchParams.get('date') || '';
    const dt = /^\d{4}-\d{2}-\d{2}$/.test(date) ? Date.parse(date + 'T00:00:00Z') : NaN, today = Date.parse(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
    if (!/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to) || !flightPairs.has(from + '>' + to)) return J(400, { ok: false, reason: 'unknown-route' });
    if (!(dt >= today && dt <= today + 330 * 86400e3)) return J(400, { ok: false, reason: 'bad-date' });
    try { return J(200, await lookupFare(from, to, date)); } catch (e) { return J(502, { ok: false, reason: 'upstream' }); }
  }
  if (p === '/reviews' && m === 'GET') { const out = {}; reviews.get().forEach((r) => { if (r.approved) (out[r.hostel] = out[r.hostel] || []).push({ q: r.q, by: r.by, from: r.from }); }); return J(200, out); }
  if (p === '/flow' && m === 'GET') return J(200, { rows: mmFlows() });

  /* ---- short links + link previews ---- */
  if (p === '/share' && m === 'POST') {
    if (limited('share:' + ip, 40, 3600000)) return J(429, {});
    const b = await readBody(req, 900000);
    if (typeof b.state !== 'string' || !b.state || b.state.length > 6000 || !/^[A-Za-z0-9=&~.+_,:-]+$/.test(b.state)) return J(400, { error: 'trip is missing' });
    let st; try { st = MM.decodeState(b.state); } catch { return J(400, { error: 'bad trip' }); }
    if (!st.items || !st.items.length) return J(400, { error: 'empty trip' });
    const all = shares.get(), hash = crypto.createHash('sha1').update(b.state).digest('hex').slice(0, 16);
    let code = Object.keys(all).find((k) => all[k].hash === hash);
    if (!code) { do { code = rid(7); } while (all[code]); all[code] = { hash, state: b.state, created: now(), views: 0 }; }
    const img = typeof b.img === 'string' && b.img.match(/^data:image\/(jpeg|png);base64,([A-Za-z0-9+/=]+)$/);
    if (img) { const buf = Buffer.from(img[2], 'base64'); if (buf.length < 800000) { fs.writeFileSync(path.join(OG_DIR, code + '.' + (img[1] === 'png' ? 'png' : 'jpg')), buf); all[code].img = img[1] === 'png' ? 'png' : 'jpg'; } }
    shares.save(); return J(200, { code, path: '/t/' + code });
  }
  let shm = p.match(/^\/share\/([a-z0-9]{7})$/);
  if (shm && m === 'GET') { const sh = shares.get()[shm[1]]; return sh ? J(200, { state: sh.state }) : J(404, {}); }

  /* ---- groups ---- */
  if (p === '/groups' && m === 'POST') {
    if (limited('grp:' + ip, 20, 3600000)) return J(429, {});
    const b = await readBody(req, 8192);
    if (typeof b.trip !== 'string' || b.trip.length > 6000) return J(400, { error: 'trip is missing' });
    const id = rid(6); const g = { id, trip: b.trip, organiser: { id: rid(8), name: clip(b.organiser && b.organiser.name, 40) || 'Squad Leader' }, created: now(), members: [] };
    groups.get()[id] = g; groups.save(); return J(200, g);
  }
  let gm = p.match(/^\/groups\/([a-z0-9]+)(?:\/members(?:\/([a-z0-9]+))?)?$/);
  if (gm) {
    const g = groups.get()[gm[1]]; if (!g) return J(404, { error: 'not found' });
    if (m === 'GET' && !/members/.test(p)) return J(200, { ...g, organiser: { name: g.organiser.name } });   // the organiser id is their key: never hand it out
    if (m === 'PATCH' && !/members/.test(p)) {
      const b = await readBody(req, 16384);
      if (!b.org || b.org !== g.organiser.id) return J(403, { error: 'only the organiser can change the trip' });
      const okState = (x) => typeof x === 'string' && x.length <= 6000;
      if (b.trip != null) { if (!okState(b.trip) || !b.trip) return J(400, {}); g.trip = b.trip; }
      if (b.alt != null) { if (!okState(b.alt)) return J(400, {}); g.alt = b.alt; }
      if (b.clearRouteVotes) g.members.forEach((x) => { delete x.votes.route; });
      groups.save(); return J(200, { ok: true });
    }
    if (m === 'POST' && /\/members$/.test(p)) {
      if (g.members.length >= 30) return J(400, { error: 'group is full' });
      const b = await readBody(req, 2048), mem = { id: rid(8), name: clip(b.name, 40).trim() || 'Mate', in: false, votes: {} };
      g.members.push(mem); groups.save(); return J(200, { member: mem });
    }
    if (m === 'PATCH' && gm[2]) {
      const mem = g.members.find((x) => x.id === gm[2]); if (!mem) return J(404, {});
      const b = await readBody(req, 8192);
      if (b.in != null) mem.in = !!b.in;
      if (b.votes && typeof b.votes === 'object') for (const [k, v] of Object.entries(b.votes)) {
        if (k === 'route') { if (['a', 'b'].includes(v)) mem.votes.route = v; continue; }
        if (/^[a-z0-9:_-]{1,60}$/i.test(k) && ['y', 'm', 'n'].includes(v)) mem.votes[k] = v;
      }
      if (Array.isArray(b.wants)) mem.wants = [...new Set(b.wants.filter((x) => typeof x === 'string' && /^[pa]:[a-z0-9-]{1,100}$/.test(x)))].slice(0, 24);
      if (b.trip != null && typeof b.trip === 'string' && b.trip.length <= 6000) mem.trip = b.trip;
      groups.save(); return J(200, { ok: true });
    }
    return J(405, {});
  }

  /* ---- admin ---- */
  if (p.startsWith('/admin/')) {
    if (!authed(req)) return J(401, { error: 'unauthorised' });
    const ap = p.slice(6);
    if (ap === '/leads' && m === 'GET') return J(200, leads.get().map((l) => ({ ...l, holdLeftMs: l.hold && l.hold.status === 'active' ? Date.parse(l.hold.until) - Date.now() : null })));
    let lm = ap.match(/^\/leads\/(MM-[A-Z0-9]{6})$/);
    if (lm && m === 'PATCH') {
      const l = leads.get().find((x) => x.ref === lm[1]); if (!l) return J(404, {});
      const b = await readBody(req, 8192);
      if (b.status && ['submitted', 'checking', 'ready', 'approved', 'declined'].includes(b.status) && b.status !== l.status) {
        l.status = b.status; l.history.push({ at: now(), event: 'status → ' + b.status });
        if (b.status === 'declined' && l.hold && l.hold.status === 'active') { l.hold.status = 'released'; l.history.push({ at: now(), event: 'hold released' }); }
        if (b.status === 'approved' && l.hold && l.hold.status === 'active') { l.hold.status = 'converted'; l.history.push({ at: now(), event: 'hold converted to booking' }); }
      }
      if (typeof b.publicNote === 'string') l.publicNote = clip(b.publicNote, 1500);
      if (typeof b.payLink === 'string') l.payLink = /^https:\/\//.test(b.payLink) ? clip(b.payLink, 600) : '';
      if (typeof b.note === 'string' && b.note.trim()) l.notes.push({ at: now(), text: clip(b.note, 1500) });
      if (b.releaseHold && l.hold && l.hold.status === 'active') { l.hold.status = 'released'; l.history.push({ at: now(), event: 'hold released' }); }
      if (b.extendHoldHours && l.hold && l.hold.requested) { const h = Math.max(1, Math.min(168, +b.extendHoldHours)); l.hold.until = new Date(Math.max(Date.now(), Date.parse(l.hold.until)) + h * 3600000).toISOString(); l.hold.status = 'active'; l.history.push({ at: now(), event: `hold extended ${h}h` }); }
      leads.save(); return J(200, l);
    }
    if (ap === '/live' && m === 'GET') return J(200, live.get());
    if (ap === '/live' && m === 'PUT') {
      const b = await readBody(req, 65536), L = { updated: now(), notice: clip(b.notice, 300), spots: {}, legs: {}, acts: {} };
      for (const [k, v] of Object.entries(b.spots || {})) if (MM.ALL_IN.some((t) => t.id === k)) L.spots[k] = { left: v.left === '' || v.left == null ? null : Math.max(0, +v.left | 0), next: clip(v.next, 10) };
      for (const [k, v] of Object.entries(b.legs || {})) if (/^[a-zA-Z-]+\|[a-zA-Z-]+\|[a-z]+$/.test(k) && v) { const o = {}; if (v.u != null && +v.u >= 0) o.u = +v.u; if (v.h != null && +v.h >= 0) o.h = +v.h; if (Object.keys(o).length) L.legs[k] = o; }
      for (const [k, v] of Object.entries(b.acts || {})) if (MM.ACTS[k] && +v >= 0) L.acts[k] = +v;
      live.set(L); live.save(); return J(200, L);
    }
    if (ap === '/reviews' && m === 'GET') return J(200, reviews.get());
    if (ap === '/reviews' && m === 'POST') {
      const b = await readBody(req, 4096); if (!MM.PLACES[b.hostel] || !clip(b.q, 400).trim()) return J(400, { error: 'hostel and quote required' });
      const r = { id: rid(6), hostel: b.hostel, q: clip(b.q, 400), by: clip(b.by, 60), from: clip(b.from, 40), approved: b.approved !== false, at: now() }; reviews.get().push(r); reviews.save(); return J(200, r);
    }
    let rm = ap.match(/^\/reviews\/([a-z0-9]+)$/);
    if (rm && m === 'DELETE') { reviews.set(reviews.get().filter((r) => r.id !== rm[1])); reviews.save(); return J(200, { ok: true }); }
    if (ap === '/flow' && m === 'GET') return J(200, { imported: flowRows.get().rows, derived: mmFlows() });
    if (ap === '/flow' && m === 'POST') {
      const b = await readBody(req, 131072), rows = [], bad = [];
      String(b.csv || '').split(/\r?\n/).forEach((line, i) => {
        line = line.trim(); if (!line || /^from[,;\t]/i.test(line)) return; const [a, c, n] = line.split(/[,;\t]/).map((x) => x.trim());
        if (MM.PLACES[a] && MM.PLACES[c] && a !== c && +n > 0) rows.push({ a, b: c, n: Math.min(100000, +n) }); else bad.push(i + 1);
      });
      flowRows.set({ rows }); flowRows.save(); return J(200, { imported: rows.length, badLines: bad.slice(0, 20) });
    }
    if (ap === '/funnel' && m === 'GET') {
      const since = Date.now() - 30 * 86400000, ev = events.get().filter((e) => Date.parse(e.t) >= since), byName = {}, sess = {}, doors = {}, perDay = {};
      ev.forEach((e) => { byName[e.n] = (byName[e.n] || 0) + 1; (sess[e.n] = sess[e.n] || new Set()).add(e.s); if (e.n === 'door' && e.p) doors[e.p.door] = (doors[e.p.door] || 0) + 1; const d = e.t.slice(0, 10); perDay[d] = (perDay[d] || 0) + 1; });
      return J(200, { days: 30, events: ev.length, byName, sessions: Object.fromEntries(Object.entries(sess).map(([k, v]) => [k, v.size])), doors, perDay, leads: leads.get().length });
    }
    return J(404, { error: 'unknown admin route' });
  }
  return J(404, { error: 'unknown route' });
}

/* ============================================================ static ============================================================ */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8' };
const PUBLIC_ROOT_FILES = new Set(['index.html', 'styles.css', 'app.js', 'logic.js', 'extras.js', 'group.js', 'config.js', 'ui-map.js', 'ui-story.js', 'ui-review.js', 'ui-group.js', 'ui-live.js']);
function serveStatic(req, res, url) {
  const tm = url.pathname.match(/^\/t\/([a-z0-9]{7})(\.(jpg|png))?$/);
  if (tm) return sharePage(req, res, tm[1], tm[3]);
  let rel = decodeURIComponent(url.pathname); if (rel === '/') rel = '/index.html';
  if (rel === '/admin' || rel === '/admin/') { res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' }); return fs.createReadStream(path.join(__dirname, 'admin.html')).pipe(res); }
  rel = rel.replace(/^\/+/, ''); const top = rel.split('/')[0];
  const ok = (rel.indexOf('/') === -1 && PUBLIC_ROOT_FILES.has(rel)) || top === 'data' || top === 'assets';
  const file = path.resolve(ROOT, rel);
  if (!ok || !file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
  const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const headers = { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': rel === 'index.html' ? 'no-cache' : 'public, max-age=300' };
  if (rel === 'config.js') {                                                  // switch the API on when served from here
    let src = fs.readFileSync(file, 'utf8').replace(/API_BASE:\s*'[^']*'/, "API_BASE: '/api'");
    // photos mirrored to assets/photos (npm run mirror-photos) are used automatically
    if (fs.existsSync(path.join(ROOT, 'assets', 'photos', 'hostel'))) src = src.replace(/PHOTO_BASE:\s*'[^']*'/, "PHOTO_BASE: '/assets/photos'");
    res.writeHead(200, { ...headers, 'Cache-Control': 'no-cache' }); return res.end(src);
  }
  res.writeHead(200, headers); fs.createReadStream(file).pipe(res);
}

/* ---------- /t/<code>: the page link-preview bots read (title, description, map image), then on to the trip ---------- */
const escH = (x) => String(x).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
function publicBase(req) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, '');
  const proto = (req.headers['x-forwarded-proto'] || '').split(',')[0] || 'http', host = (req.headers['x-forwarded-host'] || req.headers.host || 'localhost').split(',')[0];
  return proto + '://' + host.replace(/[^a-zA-Z0-9.:-]/g, '');
}
function sharePage(req, res, code, ext) {
  const sh = shares.get()[code];
  if (!sh) { res.writeHead(302, { Location: '/' }); return res.end(); }
  if (ext) {
    const f = path.join(OG_DIR, code + '.' + (sh.img || 'jpg'));
    if (!sh.img || !fs.existsSync(f)) { res.writeHead(302, { Location: '/assets/logo/mad-monkey-block.png' }); return res.end(); }
    res.writeHead(200, { 'Content-Type': sh.img === 'png' ? 'image/png' : 'image/jpeg', 'Cache-Control': 'public, max-age=86400', 'X-Content-Type-Options': 'nosniff' }); return fs.createReadStream(f).pipe(res);
  }
  let title = 'A Mad Monkey trip', desc = 'Built with the Mad Monkey Trip Builder.';
  try {
    const pl = MM.plan(MM.decodeState(sh.state)), t = pl.totals;
    title = MM.routeLine(pl) + ' · ' + t.days + ' days';
    desc = t.days + ' days · ' + pl.countries.length + (pl.countries.length === 1 ? ' country' : ' countries') + ' · about $' + Math.round(t.total).toLocaleString('en-GB') + ' each. Every bus, boat and bed between Mad Monkey hostels. Open it, change it, make it yours.';
  } catch { /* keep the defaults */ }
  sh.views = (sh.views || 0) + 1; shares.save();
  const base = publicBase(req), target = '/#/build/' + sh.state, img = base + '/t/' + code + '.' + (sh.img || 'jpg');
  const html = '<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + escH(title) + ' · Mad Monkey</title><meta name="description" content="' + escH(desc) + '">' +
    '<meta property="og:type" content="website"><meta property="og:site_name" content="Mad Monkey Trip Builder"><meta property="og:title" content="' + escH(title) + '"><meta property="og:description" content="' + escH(desc) + '">' +
    '<meta property="og:url" content="' + escH(base + '/t/' + code) + '"><meta property="og:image" content="' + escH(img) + '"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">' +
    '<meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="' + escH(img) + '">' +
    '<meta http-equiv="refresh" content="0;url=' + escH(target) + '"><link rel="icon" href="/assets/logo/favicon.png">' +
    '<style>body{margin:0;background:#0a0a0a;color:#fff;font-family:Montserrat,system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;text-align:center}a{color:#ccff01}</style></head>' +
    '<body><p>Opening the trip… <a href="' + escH(target) + '">Tap here if nothing happens</a></p><script>location.replace(' + JSON.stringify(target).replace(/</g, '\\u003c') + ')</script></body></html>';
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' }); res.end(html);
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
    return serveStatic(req, res, url);
  } catch (e) {
    if (!res.headersSent) json(res, e.code === 413 ? 413 : e.code === 400 ? 400 : 500, { error: e.code ? e.message : 'server error' });
    if (!e.code) console.error(e);
  }
}).listen(PORT, () => {
  console.log(`\n  Mad Monkey Trip Builder: http://localhost:${PORT}`);
  console.log(`  Crew console:             http://localhost:${PORT}/admin`);
  console.log(`  Admin token:              ${process.env.ADMIN_TOKEN ? '(from ADMIN_TOKEN)' : TOKEN + '   (saved in ' + path.relative(process.cwd(), path.join(DATA, 'admin-token.txt')) + ')'}`);
  console.log(`  Bed holds:                ${HOLD_HOURS}h · notifications: ${NOTIFY ? 'on' : 'off (set NOTIFY_WEBHOOK)'}\n`);
});
