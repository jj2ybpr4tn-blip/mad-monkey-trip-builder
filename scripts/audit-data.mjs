#!/usr/bin/env node
/* Audits the data the builder is made of: hostels, the transport graph, tours, packaged trips, entry rules, photos and the words.
 *   node scripts/audit-data.mjs            prints what looks wrong; exits 1 if anything is an ERROR (a warning is only worth a look)
 *   node scripts/audit-data.mjs --quiet    errors only
 * Part of `npm run check`. The numbers in data/legs.js and data/activities.js are the ones guests plan around, so this is the guard
 * against a typo turning a $14 ferry into a $140 one, a tour that points at the wrong hostel, or a photo that has gone missing.
 */
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { createRequire } from 'node:module';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), require = createRequire(import.meta.url);
['places', 'activities', 'media', 'legs', 'trips', 'entry', 'gallery', 'rules', 'guide'].forEach((f) => require(path.join(ROOT, 'data', f + '.js')));
const MM = require(path.join(ROOT, 'logic.js')); require(path.join(ROOT, 'extras.js'));
const quiet = process.argv.includes('--quiet');
const errors = [], warnings = [];
const err = (m) => errors.push(m), warn = (m) => warnings.push(m);
const P = MM.PLACES, ids = Object.keys(P);
const TODAY = new Date().toISOString().slice(0, 10);

/* ---------- places ---------- */
const TAGS = new Set(['city', 'party', 'culture', 'food', 'nature', 'adventure', 'chill', 'mountains', 'beach', 'water', 'moto', 'surf', 'dive']);
const flightCodes = new Set(); MM.EDGES.forEach((e) => { if (e.m === 'flight') { flightCodes.add(e.a); flightCodes.add(e.b); } });
ids.forEach((id) => {
  const p = P[id], w = 'place ' + id + ': ';
  if (p.id !== id) err(w + 'id mismatch');
  if (!MM.COUNTRIES[p.c]) err(w + 'unknown country ' + p.c);
  if (!(p.ll[0] > -12 && p.ll[0] < 24 && p.ll[1] > 94 && p.ll[1] < 128)) err(w + 'coordinates outside South-East Asia ' + p.ll);
  if (!(p.bed > 0 && p.bed < 60)) err(w + 'dorm price looks wrong: ' + p.bed);
  if (!(p.min >= 1 && p.sug >= p.min && p.sug <= 10)) err(w + 'min/sug nights look wrong: ' + p.min + '/' + p.sug);
  p.tags.forEach((t) => { if (!TAGS.has(t)) err(w + 'unknown tag ' + t); });
  if (!p.hook || p.hook.length > 170) warn(w + 'hook missing or long (' + (p.hook || '').length + ')');
  if (!/[.!]$/.test(p.hook || '')) warn(w + 'hook does not end with a full stop');
  p.next.forEach((n) => { if (!P[n]) err(w + 'next points at unknown place ' + n); else if (n === id) err(w + 'next points at itself'); });
  if (new Set(p.next).size !== p.next.length) err(w + 'duplicate next entries');
  if (!/^[123]{12}$/.test(p.seas || '')) err(w + 'season string must be 12 digits of 1-3: ' + p.seas);
  p.ap.forEach((a) => { if (!flightCodes.has(a[0])) err(w + 'airport ' + a[0] + ' has no flights'); if (!(a[1] > 0 && a[2] >= 0)) err(w + 'airport leg numbers: ' + a); });
  if (p.opens) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.opens)) err(w + 'opens is not a date');
    else if (p.opens < TODAY) warn(w + 'opens ' + p.opens + ' has passed: remove it, and any "Opens ..." wording in the hook');
  }
  if (!p.partner && !MM.hostelImg(id)) err(w + 'no hostel photo');
  if (!p.partner && MM.actsAt(id).length < 3) warn(w + 'fewer than 3 tours');
  if (!p.partner && !MM.actsAt(id).some((a) => a.star)) warn(w + 'no starred tour');
});

/* ---------- transport graph ---------- */
const nodeLL = {};
ids.forEach((id) => { nodeLL[id] = P[id].ll; P[id].ap.forEach((a) => { if (!nodeLL[a[0]]) nodeLL[a[0]] = P[id].ll; }); });
nodeLL.SIHA = [10.63, 103.5]; nodeLL.CEB = [10.31, 123.89]; nodeLL.DAD = [16.06, 108.2];       // hubs that aren't a hostel
const MODES = { flight: [150, 900], bus: [12, 75], train: [20, 110], boat: [8, 70], van: [14, 75], taxi: [6, 80] };
const seenEdge = {};
MM.EDGES.forEach((e, i) => {
  const w = 'leg ' + e.a + ' - ' + e.b + ' (' + e.m + '): ';
  [e.a, e.b].forEach((n) => { if (!nodeLL[n]) err(w + 'unknown node ' + n); });
  if (e.a === e.b) err(w + 'goes nowhere');
  if (!MODES[e.m]) err(w + 'unknown mode');
  if (!(e.h > 0)) err(w + 'hours must be positive');
  if (!(e.u >= 0)) err(w + 'price must not be negative');
  if (e.nights && !e.ovn) err(w + 'nights without overnight');
  if (e.ovn && e.h < 5) err(w + 'overnight but only ' + e.h + ' hours');
  if (!e.note) warn(w + 'no note');
  const k = [e.a, e.b].sort().join('|') + '|' + e.m + (e.ovn ? '|ovn' : '');
  if (seenEdge[k]) warn(w + 'duplicate of another leg'); seenEdge[k] = 1;
  const a = nodeLL[e.a], b = nodeLL[e.b];
  if (a && b && e.a !== e.b && MODES[e.m]) {
    const km = MM.util.hav(a, b), sp = km / e.h, lim = MODES[e.m];
    // a taxi to the airport is short: skip the speed rule for those
    if (e.m !== 'taxi' && km > (e.m === 'flight' ? 400 : 15) && (sp < lim[0] * 0.6 || sp > lim[1] * 1.4)) warn(w + 'door-to-door speed ' + Math.round(sp) + ' km/h over ~' + Math.round(km) + ' km looks off for a ' + e.m + ' (' + e.h + ' h)');
    if (e.m !== 'taxi' && km > 15) { const per100 = e.u / km * 100; if (e.m !== 'flight' && per100 > (e.m === 'boat' ? 90 : 18) && (e.m === 'boat' || km > 100)) warn(w + '$' + e.u + ' over ~' + Math.round(km) + ' km is $' + per100.toFixed(1) + ' per 100 km: dear for a ' + e.m); if (e.m === 'flight' && per100 > 60) warn(w + 'flight $' + e.u + ' over ~' + Math.round(km) + ' km looks dear'); if (e.u === 0) warn(w + 'free journey'); }
  }
});
// every pair of hostels is reachable, and the answer is sensible (not more than 3 days door to door)
ids.forEach((a) => ids.forEach((b) => {
  if (a === b) return; const r = MM.route(a, b, 'balanced');
  if (!r) { err('no route ' + a + ' to ' + b); return; }
  if (r.h > 72) warn('route ' + a + ' to ' + b + ' takes ' + r.h + ' h');
}));

/* ---------- tours ---------- */
const CATS = new Set(['epic', 'day', 'night']), SLOTS = new Set(['full', 'half', 'eve']);
Object.values(MM.ACTS).forEach((a) => {
  const w = 'tour ' + a.id + ': ';
  if (!P[a.p]) err(w + 'unknown place ' + a.p);
  if (!CATS.has(a.cat)) err(w + 'unknown category ' + a.cat);
  if (!SLOTS.has(a.slot)) err(w + 'unknown slot ' + a.slot);
  if (a.usd != null && !(a.usd >= 0 && a.usd < 700)) err(w + 'price looks wrong: ' + a.usd);
  if (a.usd === 0) warn(w + 'free tour: is that right?');
  if (a.usd == null && a.cat !== 'night') warn(w + 'no price but not a night out');
  if (a.dows) a.dows.forEach((d) => { if (!(d >= 0 && d <= 6)) err(w + 'bad weekday in "' + a.when + '"'); });
  a.tags.forEach((t) => { if (!/^[a-z]+$/.test(t)) err(w + 'odd tag ' + t); });
  if (a.cat === 'epic' && !a.multi) err(w + 'an epic with no multi-day info');
  if (a.multi) {
    if (!(a.multi.d >= 1 && a.multi.d <= 14)) err(w + 'multi.d ' + a.multi.d);
    if (a.multi.n != null && !(a.multi.n >= 0 && a.multi.n <= a.multi.d)) err(w + 'multi.n ' + a.multi.n + ' more than days ' + a.multi.d);
    if (a.cat === 'day' || a.cat === 'night') warn(w + 'multi-day but category ' + a.cat);
  }
  if (a.slot === 'eve' && a.cat === 'epic') warn(w + 'an evening epic?');
  if (/\s{2,}|^\s|\s$/.test(a.n)) warn(w + 'stray spaces in the name');
  if (a.slug && !MM.tourImg(a.slug) && a.cat !== 'night') warn(w + 'no photo');
});
const dupNames = {}; Object.values(MM.ACTS).forEach((a) => { const k = a.p + '|' + a.n.toLowerCase(); (dupNames[k] = dupNames[k] || []).push(a.id); });
Object.keys(dupNames).forEach((k) => { if (dupNames[k].length > 1) warn('two tours called "' + k.split('|')[1] + '" at ' + k.split('|')[0] + ': ' + dupNames[k].join(', ')); });

/* ---------- packaged + classic trips ---------- */
const checkTrip = (t, kind) => {
  const w = kind + ' ' + t.id + ': ';
  if (!t.stops || !t.stops.length) { err(w + 'no stops'); return; }
  let nights = 0;
  t.stops.forEach((s, i) => {
    if (!P[s.p]) { err(w + 'stop ' + (i + 1) + ' unknown place ' + s.p); return; }
    nights += s.n || 0;
    (s.acts || []).forEach((id) => { const a = MM.ACTS[id]; if (!a) err(w + 'stop ' + (i + 1) + ' unknown tour ' + id); else if (a.p !== s.p) err(w + 'tour ' + id + ' belongs to ' + a.p + ', not ' + s.p); });
    if (!(s.n >= 1 && s.n <= 14)) err(w + 'stop ' + (i + 1) + ' nights ' + s.n);
  });
  for (let i = 1; i < t.stops.length; i++) if (t.stops[i].p !== t.stops[i - 1].p && !MM.route(t.stops[i - 1].p, t.stops[i].p, 'balanced')) err(w + 'no route between stops ' + i + ' and ' + (i + 1));
  return nights;
};
MM.ALL_IN.forEach((t) => {
  const nights = checkTrip(t, 'ALL IN'), w = 'ALL IN ' + t.id + ': ';
  if (!(t.usd > 0 && t.usd < 3000)) err(w + 'price ' + t.usd);
  if (!(t.dep >= 0 && t.dep <= 6)) err(w + 'departure weekday ' + t.dep);
  if (!['live', 'soon'].includes(t.status)) err(w + 'status ' + t.status);
  if (nights != null && nights > t.days - 1) warn(w + 'stops add up to ' + nights + ' nights but it is only sold as ' + t.days + ' days');            // the stops are the hostel stays; days with partners or on the road aren't listed, so fewer is fine
  if (t.nStops && t.nStops < new Set(t.stops.map((s) => s.p)).size) warn(w + 'nStops says ' + t.nStops + ' but ' + new Set(t.stops.map((s) => s.p)).size + ' different places are listed');
  if (!MM.allInUrl(t.id)) err(w + 'no details link');
});
MM.CLASSICS.forEach((t) => checkTrip(t, 'classic'));
(MM.SPECIALS || []).forEach((t) => checkTrip(t, 'special'));
MM.THEMES.forEach((t) => { t.route.forEach((x) => { if (!P[x[0]]) err('theme ' + t.id + ': unknown place ' + x[0]); (x[2] || []).forEach((f) => { if (!MM.themeActs(x[0], [f]).length) err('theme ' + t.id + ': "' + f + '" matches no tour at ' + x[0]); }); }); });

/* ---------- entry rules + visa lengths ---------- */
Object.keys(MM.COUNTRIES).forEach((c) => {
  const e = MM.ENTRY[c], s = MM.STAY[c];
  if (!e) { err('entry ' + c + ': missing'); return; }
  if (!/^https:\/\//.test(e.link)) err('entry ' + c + ': link is not https');
  MM.PASSPORTS.forEach((pp) => { if (!e.by[pp.k]) err('entry ' + c + ': no text for passport ' + pp.k); if (!s || !s[pp.k]) err('stay ' + c + ': no rule for passport ' + pp.k); else if (s[pp.k].days != null && !(s[pp.k].days >= 7 && s[pp.k].days <= 365)) err('stay ' + c + '/' + pp.k + ': ' + s[pp.k].days + ' days'); });
});
(MM.CALENDAR || []).forEach((ev) => {
  const w = 'calendar ' + ev.id + ': ';
  if (!(ev.sev >= 1 && ev.sev <= 3)) err(w + 'severity ' + ev.sev);
  (ev.c || []).forEach((c) => { if (!MM.COUNTRIES[c]) err(w + 'unknown country ' + c); }); (ev.at || []).forEach((p) => { if (!P[p]) err(w + 'unknown place ' + p); });
  (ev.spans || []).forEach((s) => { if (s.from && (!/^\d{4}-\d{2}-\d{2}$/.test(s.from) || !/^\d{4}-\d{2}-\d{2}$/.test(s.to) || s.to < s.from)) err(w + 'bad span ' + s.from + ' to ' + s.to); });
  const last = (ev.spans || []).filter((s) => s.to).map((s) => s.to).sort().pop();
  if (last && last < TODAY) warn(w + 'every dated span is in the past (last ends ' + last + '): add next year');
});

/* ---------- photos ---------- */
const PH = path.join(ROOT, 'assets', 'photos'), used = new Set();
const need = (rel) => { used.add(rel); if (!fs.existsSync(path.join(PH, rel))) err('photo missing: assets/photos/' + rel); };
ids.forEach((id) => { if (MM.hostelImg(id)) need('hostel/' + id + '.jpg'); MM.galleryRaw(id).forEach((_, k) => need('gallery/' + id + '-' + k + '.jpg')); });
Object.values(MM.ACTS).forEach((a) => { if (a.slug && MM.tourImg(a.slug)) need('tour/' + a.slug + '.jpg'); });
const walk = (d, rel = '') => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? (rel === '' && (e.name === 's' || e.name === 'm') ? [] : walk(path.join(d, e.name), rel + e.name + '/')) : [rel + e.name]);   // s/ and m/ are the small copies
const onDisk = fs.existsSync(PH) ? walk(PH) : [];
used.forEach((rel) => { ['s', 'm'].forEach((k) => { if (fs.existsSync(path.join(PH, rel)) && !fs.existsSync(path.join(PH, k, rel.replace(/\.jpe?g$/i, '.webp')))) warn('no small copy: assets/photos/' + k + '/' + rel.replace(/\.jpe?g$/i, '.webp') + ' (run: node scripts/make-thumbs.mjs)'); }); });
onDisk.forEach((f) => { if (!used.has(f)) warn('photo on disk but not used: assets/photos/' + f); const sz = fs.statSync(path.join(PH, f)).size; if (sz > 450000) warn('photo is heavy (' + Math.round(sz / 1024) + ' KB): assets/photos/' + f); });

/* ---------- the words ---------- */
const strings = [];
const collect = (o, where) => { if (typeof o === 'string') strings.push([where, o]); else if (Array.isArray(o)) o.forEach((x, i) => collect(x, where + '[' + i + ']')); else if (o && typeof o === 'object') Object.keys(o).forEach((k) => { if (typeof o[k] !== 'function') collect(o[k], where + '.' + k); }); };
ids.forEach((id) => { collect(P[id].hook, id + '.hook'); collect(P[id].note || '', id + '.note'); });
Object.values(MM.ACTS).forEach((a) => { collect(a.n, a.id + '.n'); collect(a.note, a.id + '.note'); });
collect(MM.ALL_IN.map((t) => ({ n: t.n, tag: t.tag, pitch: t.pitch, kicker: t.kicker })), 'allin'); collect(MM.ENTRY, 'entry'); collect(MM.CALENDAR.map((e) => ({ n: e.n, impact: e.impact, advice: e.advice })), 'calendar'); collect(MM.THEMES.map((t) => ({ n: t.n, tag: t.tag, blurb: t.blurb })), 'themes');
if (MM.GUIDE) collect(MM.GUIDE, 'guide');
const US = [[/\bcolor(s|ed|ful)?\b/i, 'colour'], [/\bcenter(s|ed)?\b/i, 'centre'], [/\bfavorite(s)?\b/i, 'favourite'], [/\btraveler(s)?\b/i, 'traveller'], [/\btheater\b/i, 'theatre'], [/\bgray\b/i, 'grey'], [/\borganiz(e|ed|ing)\b/i, 'organise'], [/\d\s*meters?\b/i, 'metre'], [/\blicense\b/i, 'licence (noun)'], [/\bcancell?ed\b/i, null], [/\bfulfill\b/i, 'fulfil'], [/\bmom\b/i, 'mum'], [/\bvacation\b/i, 'holiday'], [/\bapartment\b/i, null]];
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
strings.forEach(([where, s]) => {
  if (EMOJI.test(s)) warn('emoji in ' + where + ': ' + s.slice(0, 60));
  if (/\s{2,}/.test(s)) warn('double space in ' + where);
  if (/^\s|\s$/.test(s) && s.length) warn('stray space at the edge of ' + where);
  if (/[‘’“”]/.test(s)) warn('curly quote in ' + where + ': ' + s.slice(0, 60));
  if (/—/.test(s)) warn('em dash in ' + where + ': ' + s.slice(0, 60));
  US.forEach(([re, uk]) => { if (uk && re.test(s)) warn('American spelling "' + (s.match(re) || [''])[0] + '" (use ' + uk + ') in ' + where); });
});

/* ---------- report ---------- */
if (!quiet) warnings.forEach((m) => console.log('warn   ' + m));
errors.forEach((m) => console.log('ERROR  ' + m));
console.log('\n' + ids.length + ' places, ' + MM.EDGES.length + ' legs, ' + Object.keys(MM.ACTS).length + ' tours, ' + MM.ALL_IN.length + ' ALL IN trips, ' + onDisk.length + ' photos: ' + errors.length + ' error(s), ' + warnings.length + ' warning(s)');
process.exit(errors.length ? 1 : 0);
