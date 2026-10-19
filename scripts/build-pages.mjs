#!/usr/bin/env node
/* ============================================================
   BUILD PAGES — real, indexable pages for Google.
   The builder is a single-page app with #hash routes, which search engines can't index. This script
   writes plain HTML pages from the same data and logic, each with a "Build this trip" button that opens
   the builder. Run it whenever data changes and before every deploy:

     SITE_URL=https://trips.example.com npm run build-pages
     SITE_URL=https://you.github.io/repo BASE_PATH=/repo npm run build-pages     (hosted under a sub-folder)

   Writes:  trips/  routes/  hostels/  guides/  sitemap.xml  robots.txt   (each folder holds a .generated marker)
   Without SITE_URL the pages still work; canonical links, the sitemap and preview images are skipped.
   NOINDEX=1 adds a robots noindex tag (used for the demo site, so it never competes with the real one).
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
for (const f of ['places', 'activities', 'media', 'legs', 'trips', 'entry', 'gallery', 'rules', 'guide']) require(path.join(ROOT, 'data', f + '.js'));
const MM = require(path.join(ROOT, 'logic.js'));
require(path.join(ROOT, 'extras.js'));

const OUT = process.env.OUT_DIR ? path.resolve(process.env.OUT_DIR) : ROOT;      // where pages are written (tests use a temp folder)
const SITE = (process.env.SITE_URL || '').replace(/\/$/, '');
const BASE = (process.env.BASE_PATH != null ? process.env.BASE_PATH : SITE ? new URL(SITE).pathname : '').replace(/\/$/, '');
const CSS_V = crypto.createHash('md5').update(fs.readFileSync(path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'styles.css'))).digest('hex').slice(0, 8);
const BUILT = new Date(), BUILT_LABEL = BUILT.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
const P = MM.PLACES, C = MM.COUNTRIES, U = MM.util;
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const usd = (n) => '$' + Math.round(n).toLocaleString('en-GB');
const plural = (n, w, ws) => n + ' ' + (n === 1 ? w : (ws || w + 's'));
const href = (p) => BASE + p;
const abs = (p) => SITE ? SITE + p.replace(BASE, '') : '';
const listHostels = () => Object.keys(P).filter((id) => !P[id].partner);
const joinNames = (a) => a.length <= 2 ? a.join(' and ') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
const slugs = {};                                    // every page we write: path -> { title, desc }

/* ---------- photos: use the self-hosted copies when we have them ---------- */
const hasFile = (rel) => fs.existsSync(path.join(ROOT, rel));
function hostelPhoto(id) { return hasFile(`assets/photos/hostel/${id}.jpg`) ? href(`/assets/photos/hostel/${id}.jpg`) : null; }
function galleryPhotos(id) { const out = []; for (let i = 0; i < 8; i++) if (hasFile(`assets/photos/gallery/${id}-${i}.jpg`)) out.push(href(`/assets/photos/gallery/${id}-${i}.jpg`)); return out; }
function actPhoto(a) { return a.slug && hasFile(`assets/photos/tour/${a.slug}.jpg`) ? href(`/assets/photos/tour/${a.slug}.jpg`) : null; }
const img = (src, alt, cls) => src ? `<img${cls ? ` class="${cls}"` : ''} src="${esc(src)}" alt="${esc(alt)}" loading="lazy" decoding="async" width="640" height="420">` : '';

/* ---------- the page shell ---------- */
function shell({ path: p, title, desc, h1, crumbs, body, ld, image }) {
  const url = abs(p), fullTitle = title.length > 52 ? title : title + ' · Mad Monkey';
  const crumbList = [['Mad Monkey Trip Builder', '/'], ...(crumbs || []), [h1, p]];
  const breadcrumbLd = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: crumbList.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c[0], item: SITE ? abs(c[1] === '/' ? href('/') : c[1]) : undefined })) };
  const og = image && SITE ? image.replace(href('/'), abs(href('/'))) : '';
  slugs[p] = { title: h1, desc };
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(desc)}">
${SITE ? `<link rel="canonical" href="${esc(url)}">\n` : ''}<meta property="og:type" content="website"><meta property="og:site_name" content="Mad Monkey Trip Builder"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">${SITE ? `<meta property="og:url" content="${esc(url)}">` : ''}${og ? `<meta property="og:image" content="${esc(og)}"><meta name="twitter:card" content="summary_large_image">` : ''}
<meta name="theme-color" content="#0a0a0a">
${process.env.NOINDEX ? '<meta name="robots" content="noindex">\n' : ''}<link rel="icon" type="image/png" href="${href('/assets/logo/favicon.png')}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;700;900&family=Bungee&display=swap">
<link rel="stylesheet" href="${href('/styles.css')}?v=${CSS_V}">
<script type="application/ld+json">${JSON.stringify(breadcrumbLd)}</script>
${(ld || []).map((o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`).join('\n')}
</head>
<body data-view="seo" class="seo">
<header class="hdr"><a class="hdr__logo" href="${href('/')}" aria-label="Mad Monkey Trip Builder, home"><img src="${href('/assets/logo/mad-monkey-white.png')}" alt="Mad Monkey" width="100" height="30"></a>
<nav class="hdr__nav" aria-label="Main"><a class="navbtn opt" href="${href('/')}">Trips</a><a class="navbtn" href="${href('/#/build/')}">Builder</a><a class="navbtn opt" href="${href('/#/quiz')}">Quiz</a></nav></header>
<main class="seo__main"><div class="wrap seo__wrap">
<nav class="crumbs" aria-label="Breadcrumb">${crumbList.map((c, i) => i === crumbList.length - 1 ? `<span aria-current="page">${esc(c[0])}</span>` : `<a href="${esc(c[1] === '/' ? href('/') : c[1])}">${esc(c[0])}</a>`).join(' <i>/</i> ')}</nav>
${body}
</div></main>
<footer class="foot"><div class="wrap"><nav class="seo__foot" aria-label="Explore">
<div><b>Trips</b>${Object.keys(C).map((c) => `<a href="${href('/trips/' + C[c].n.toLowerCase() + '-itinerary/')}">${esc(C[c].n)} itinerary</a>`).join('')}<a href="${href('/trips/')}">All trips</a></div>
<div><b>Guides</b>${Object.keys(C).map((c) => `<a href="${href('/guides/' + C[c].n.toLowerCase() + '/')}">Backpacking ${esc(C[c].n)}</a>`).join('')}</div>
<div><b>Explore</b><a href="${href('/hostels/')}">All 23 hostels</a><a href="${href('/routes/')}">Getting around</a><a href="${href('/#/quiz')}">Build it for me</a><a href="${href('/#/build/')}">Start from scratch</a></div></nav>
<p class="fine">Prices are estimates, not quotes. Dorm beds are "from" prices, transport is typical fares and activities are listed prices (or marked est.). A real person on the crew checks every trip before you pay. Page built ${esc(BUILT_LABEL)}.</p></div></footer>
</body></html>`;
}

function write(p, html) { const dir = path.join(OUT, p.replace(/^\//, '')); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, 'index.html'), html); }
const buildLink = (state, label, cls) => `<a class="btn ${cls || 'btn--pink'}" href="${esc(href('/#/build/' + MM.encodeState(state)))}">${esc(label)}</a>`;
const blank = () => MM.defaultState();

/* ---------- small content blocks ---------- */
function faqHTML(items) { return `<section class="seo__sec"><h2 class="disp">Questions people ask</h2><div class="faq">${items.map((q) => `<details><summary>${esc(q[0])}</summary><p>${esc(q[1])}</p></details>`).join('')}</div></section>`; }
const faqLd = (items) => ({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: items.map((q) => ({ '@type': 'Question', name: q[0], acceptedAnswer: { '@type': 'Answer', text: q[1] } })) });
function monthsLine(places) {
  const av = MM.bestMonths(places), mx = Math.max(...av), thr = mx >= 2.6 ? 2.6 : mx - 0.15, best = [];
  av.forEach((v, m) => { if (v >= thr) best.push(U.MONTHN[m]); });
  const wet = []; av.forEach((v, m) => { if (v < 2.0) wet.push(U.MONTHN[m]); });
  return { best, wet, text: `Best months: ${joinNames(best)}.` + (wet.length ? ` Expect rain or rough seas in ${joinNames(wet)}.` : '') };
}
function seasonBars(places) {
  const av = MM.bestMonths(places);
  return `<div class="seasbar" role="img" aria-label="Best months">${av.map((v, m) => `<i class="s${v >= 2.6 ? 3 : v >= 2.1 ? 2 : 1}"><u></u><span>${U.MONTHN[m][0]}</span></i>`).join('')}</div>`;
}
function stopsHTML(pl) {
  return `<ol class="seo__stops">${pl.segs.filter((s) => s.kind === 'stop').map((s, i) => {
    const p = P[s.p], pic = hostelPhoto(s.p), acts = s.acts.slice(0, 3).map((a) => a.n);
    const hl = p.partner ? null : href('/hostels/' + s.p + '/');
    return `<li>${pic && hl ? `<a class="seo__pic" href="${hl}">${img(pic, `Mad Monkey ${p.n}`)}</a>` : ''}<div><b>${hl ? `<a href="${hl}">Mad Monkey ${esc(p.n)}</a>` : esc(p.n) + ' (partner)'}</b><span>${esc(C[p.c].n)} · ${plural(s.n, 'night')} · dorm from ${usd(p.bed)}</span><p>${esc(p.hook)}</p>${acts.length ? `<p class="seo__acts"><i>Things to do:</i> ${esc(acts.join(', '))}</p>` : ''}</div></li>`;
  }).join('')}</ol>`;
}
function legsHTML(pl) {
  if (!pl.legs.length) return '';
  return `<div class="seo__tw"><table class="seo__t"><thead><tr><th>Journey</th><th>How</th><th>Time</th><th>About</th></tr></thead><tbody>${pl.legs.map((l) => `<tr><td>${hasRoute(l.from, l.to) ? `<a href="${href('/routes/' + routeSlug(l.from, l.to) + '/')}">${esc(P[l.from].n)} to ${esc(P[l.to].n)}</a>` : `${esc(P[l.from].n)} to ${esc(P[l.to].n)}`}</td><td>${esc(l.chosen.modeLabel)}${l.ovn ? ' (overnight)' : ''}</td><td>${U.hoursLabel(l.h)}</td><td>${usd(l.u)}</td></tr>`).join('')}</tbody></table></div>`;
}
function costHTML(pl) {
  const T = pl.totals, fundOnly = Math.max(0, T.total - T.beds - T.transport - T.acts - (T.allin || 0));
  return `<div class="seo__tw"><table class="seo__t"><tbody><tr><td>Dorm beds</td><td>${usd(T.beds)}</td></tr><tr><td>Transport between stops</td><td>${usd(T.transport)}</td></tr><tr><td>Activities listed above</td><td>${usd(T.acts)}</td></tr>${T.allin ? `<tr><td>ALL IN trips</td><td>${usd(T.allin)}</td></tr>` : ''}<tr><td>Food and fun fund</td><td>${usd(fundOnly)}</td></tr><tr class="tot"><td>Estimated total, per person</td><td>~${usd(T.total)}</td></tr></tbody></table></div><p class="fine">Estimates, not quotes. Flights to and from the region aren't included.</p>`;
}
function dayByDay(pl) {
  return `<ol class="seo__days">${pl.days.filter((d) => d.kind !== 'depart').map((d) => {
    const acts = (d.acts || []).map((x) => MM.ACTS[x.id] && MM.ACTS[x.id].n).filter(Boolean);
    const tr = d.travel && (d.kind === 'stay' || d.kind === 'move') ? `Travel from ${P[d.travel.from].n} to ${P[d.travel.to].n} (${d.travel.chosen.modeLabel.toLowerCase()}, ${U.hoursLabel(d.travel.h)}).` : '';
    return `<li><span>${d.n}</span><div><b>${esc(d.title || (d.loc ? P[d.loc].n : ''))}</b>${tr ? `<p>${esc(tr)}</p>` : ''}${acts.length ? `<p>${esc(acts.join(' · '))}</p>` : ''}${d.note ? `<p class="seo__muted">${esc(d.note)}</p>` : ''}</div></li>`;
  }).join('')}</ol>`;
}
function kbBlock(cs, opts) {
  opts = opts || {}; const G = MM.GUIDE;
  return cs.filter((c) => G.countries[c]).map((c) => `<div class="seo__kb"><h3 class="disp">${esc(C[c].n)}</h3>${G.topics.map((t) => { const items = (G.countries[c][t.k] || []).slice(0, opts.short ? 2 : 9); return items.length ? `<h4>${esc(t.t)}</h4><ul>${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''; }).join('')}</div>`).join('');
}
function visaBlock(cs) {
  const names = { gb: 'UK', us: 'USA', au: 'Australia', ca: 'Canada', eu: 'EU / Ireland' };
  return `<div class="seo__tw"><table class="seo__t"><thead><tr><th>Country</th>${Object.values(names).map((n) => `<th>${n}</th>`).join('')}</tr></thead><tbody>${cs.map((c) => `<tr><td><b>${esc(C[c].n)}</b></td>${Object.keys(names).map((p) => { const r = MM.STAY[c][p]; return `<td>${r.days ? r.days + ' days' + (r.how === 'free' ? '<br><i>visa-free</i>' : r.how === 'evisa' ? '<br><i>e-visa</i>' : '<br><i>on arrival / e-visa</i>') : 'check'}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div><p class="fine">Checked ${esc(MM.ENTRY_CHECKED)}. Entry rules change, so confirm on the official site before you fly. ${cs.map((c) => `<a href="${esc(MM.ENTRY[c].link)}" rel="noopener">${esc(C[c].n)}</a>`).join(', ')}.</p>`;
}
function eventsBlock(cs, places) {
  const up = MM.upcomingEvents({ countries: cs, places: places || [], from: BUILT, months: 13 }).slice(0, 7);
  if (!up.length) return '';
  return `<section class="seo__sec"><h2 class="disp">Festivals and closures to plan around</h2><ul class="seo__ev">${up.map((e) => `<li><b>${esc(e.ev.n)}</b> <span>${esc(e.core ? e.core + ', ' : '')}${esc(U.fmtDate(e.from) + (e.from.getTime() === e.to.getTime() ? '' : ' to ' + U.fmtDate(e.to)))}</span><p>${esc(e.ev.impact)} ${esc(e.ev.advice)}</p></li>`).join('')}</ul><p class="fine">Lunar and government holiday dates can move. Checked ${esc(MM.ENTRY_CHECKED)}.</p></section>`;
}
const cta = (state, label) => `<div class="seo__cta"><div><b>Make it yours.</b><p>Change the stops, nights and activities. Get the real cost, then send it to the crew. A real person checks it before you pay anything.</p></div>${buildLink(state, label || 'Build this trip')}</div>`;

/* ---------- route helpers ---------- */
const routePairs = new Set(), routeList = [];
function addPair(a, b) { if (!P[a] || !P[b] || P[a].partner || P[b].partner || a === b) return; const k = [a, b].sort().join('|'); if (routePairs.has(k)) return; const r = MM.route(a, b, 'balanced'); if (!r || r.h > 40) return; routePairs.add(k); routeList.push([a, b]); }
listHostels().forEach((a) => (P[a].next || []).forEach((b) => addPair(a, b)));
[['hanoi', 'luang-prabang'], ['chiang-mai', 'luang-prabang'], ['bangkok', 'siem-reap'], ['bangkok', 'phnom-penh'], ['hanoi', 'siem-reap'], ['manila', 'panglao'], ['phnom-penh', 'hoi-an'], ['bangkok', 'hanoi'], ['uluwatu', 'gili-trawangan'], ['siem-reap', 'koh-rong'], ['luang-prabang', 'vang-vieng'], ['chiang-mai', 'bangkok'], ['hoi-an', 'siem-reap']].forEach(([a, b]) => addPair(a, b));
const pairMap = {}; routeList.forEach(([a, b]) => { pairMap[[a, b].sort().join('|')] = [a, b]; });
// one stable URL per pair, in the order the pair was first added (e.g. hanoi-to-hoi-an)
function hasRoute(a, b) { return !!pairMap[[a, b].sort().join('|')]; }
function routeSlug(a, b) { return (pairMap[[a, b].sort().join('|')] || [a, b]).join('-to-'); }

/* ---------- 1. trip pages ---------- */
const trips = [];
function addTrip(slug, o) { trips.push({ slug, ...o }); }
const stateOf = (stops, pref) => { const s = blank(); stops.forEach((x) => s.items.push({ kind: 'stop', p: x.p || x[0], n: x.n || x[1], acts: (x.acts || []).slice() })); s.pref = pref || 'balanced'; return s; };

MM.CLASSICS.forEach((c) => { const st = stateOf(c.stops, c.pref || 'cheap'); addTrip(c.id, { title: `${c.n}: ${MM.plan(st).totals.days}-day route`, kicker: 'Route guide', pitch: c.pitch + ' ' + c.tag + '.', state: st, name: c.n }); });
MM.ALL_IN.forEach((t) => addTrip('all-in-' + t.id, { title: `ALL IN ${t.n}: ${t.days}-day crew trip`, kicker: t.status === 'soon' ? 'ALL IN trip, launching soon' : 'ALL IN trip', pitch: t.pitch, state: stateOf(t.stops, 'balanced'), name: `ALL IN ${t.n}`, allin: t }));
MM.THEMES.forEach((t) => { const x = MM.themeTrip(t.id); addTrip(t.id === 'cheap' ? 'cheap-backpacking-route' : t.id + '-route', { title: `${t.n}: ${MM.plan(x.state).totals.days}-day route`, kicker: 'Hand-picked by the crew', pitch: t.blurb, state: x.state, name: t.n }); });
const COUNTRY_PAGES = { VN: { slug: 'vietnam-itinerary', days: 10 }, TH: { slug: 'thailand-itinerary', days: 12 }, KH: { slug: 'cambodia-itinerary', days: 12 }, LA: { slug: 'laos-itinerary', days: 7 }, ID: { slug: 'indonesia-itinerary', days: 12 }, PH: { slug: 'philippines-itinerary', days: 12 } };
Object.keys(COUNTRY_PAGES).forEach((c) => {
  const g = MM.generate({ days: COUNTRY_PAGES[c].days, budget: 'mid', countries: [c], vibes: ['culture', 'food', 'islands'] });
  if (g && g[0]) { const pl = MM.plan(g[0].state); addTrip(COUNTRY_PAGES[c].slug, { title: `${C[c].n} itinerary: ${pl.totals.days} days`, kicker: `${C[c].n} itinerary`, pitch: `A ${pl.totals.days}-day route through ${C[c].n} between Mad Monkey hostels, with the real buses, boats and flights worked out.`, state: g[0].state, name: `${C[c].n} itinerary`, country: c }); }
});

trips.forEach((t) => {
  const pl = MM.plan(t.state), T = pl.totals, cs = pl.countries, places = pl.places, route = MM.routeLine(pl), m = monthsLine(places), p = `/trips/${t.slug}/`;
  const faq = [
    [`How many days does this trip take?`, `${T.days} days (${T.nights} nights) as planned: ${route}. You can add or remove nights in the builder.`],
    [`How much does this trip cost?`, `About ${usd(T.total)} per person including dorm beds, transport between stops, the activities listed and a daily food and fun fund. Flights to and from the region aren't included. These are estimates and the crew checks them before you pay.`],
    [`When is the best time to go?`, m.text],
    [`Is it safe to do this trip solo?`, `Yes. Staying in Mad Monkey hostels means you're meeting other travellers from the first night, and the crew can help you with transport and plans on the way. Read the know-before-you-go notes below, especially if you plan to ride a scooter.`],
    [`Can I change the route?`, `Yes. Open it in the builder and add, remove or reorder stops, change the nights and pick different activities. A real person on the crew checks the final trip before you pay.`]];
  const ld = [{ '@context': 'https://schema.org', '@type': 'TouristTrip', name: t.title, description: t.pitch, touristType: 'Backpackers', itinerary: { '@type': 'ItemList', itemListElement: places.map((id, i) => ({ '@type': 'ListItem', position: i + 1, name: `Mad Monkey ${P[id].n}` })) } }, faqLd(faq)];
  const body = `<header class="seo__hd"><span class="doc__tag">${esc(t.kicker)}</span><h1 class="disp">${esc(t.title)}</h1><p class="seo__lede">${esc(t.pitch)}</p>
<div class="seo__facts"><div><b>${T.days}</b><span>days</span></div><div><b>${places.length}</b><span>${places.length === 1 ? 'stop' : 'stops'}</span></div><div><b>${cs.length}</b><span>${cs.length === 1 ? 'country' : 'countries'}</span></div><div><b>~${usd(T.total)}</b><span>est. each</span></div></div>${cta(t.state)}</header>
<section class="seo__sec"><h2 class="disp">The route</h2><p>${esc(route)}</p>${stopsHTML(pl)}</section>
${pl.legs.length ? `<section class="seo__sec"><h2 class="disp">Getting between stops</h2>${legsHTML(pl)}</section>` : ''}
<section class="seo__sec"><h2 class="disp">Day by day</h2>${dayByDay(pl)}</section>
<section class="seo__sec"><h2 class="disp">What it costs</h2>${costHTML(pl)}</section>
<section class="seo__sec"><h2 class="disp">When to go</h2><p>${esc(m.text)}</p>${seasonBars(places)}</section>
${eventsBlock(cs, places)}
<section class="seo__sec"><h2 class="disp">Visa length</h2>${visaBlock(cs)}</section>
<section class="seo__sec"><h2 class="disp">Know before you go</h2>${MM.GUIDE.hasRiding(pl) ? `<div class="seo__ride"><b>${esc(MM.GUIDE.scooterHead)}</b><ul>${MM.GUIDE.scooterCore.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}${kbBlock(cs, { short: true })}<p class="fine"><a href="${href('/guides/' + C[cs[0]].n.toLowerCase() + '/')}">Read the full ${esc(C[cs[0]].n)} guide</a></p></section>
${faqHTML(faq)}${cta(t.state)}`;
  const first = hostelPhoto(places[0]);
  write(p, shell({ path: p, title: t.title, desc: `${t.pitch} ${T.days} days, ${places.length} ${places.length === 1 ? 'stop' : 'stops'}, about ${usd(T.total)} each. Open it in the builder and make it yours.`.slice(0, 300), h1: t.title, crumbs: [['Trips', href('/trips/')]], body, ld, image: first }));
});
write('/trips/', shell({ path: '/trips/', title: 'Southeast Asia trips and itineraries', desc: 'Ready-made routes across Vietnam, Thailand, Laos, Cambodia, Indonesia and the Philippines, between Mad Monkey hostels, with real transport and prices.', h1: 'Trips and itineraries', body: `<header class="seo__hd"><h1 class="disp">Trips and itineraries</h1><p class="seo__lede">Every route here is a real plan: real buses, boats and flights, real prices, and a human check before you pay. Open any of them in the builder and change what you like.</p></header>
<div class="seo__grid">${trips.map((t) => { const pl = MM.plan(t.state); return `<a class="seo__card" href="${href('/trips/' + t.slug + '/')}"><span>${esc(t.kicker)}</span><b>${esc(t.name)}</b><em>${esc(MM.routeLine(pl))}</em><i>${pl.totals.days} days · ~${usd(pl.totals.total)}</i></a>`; }).join('')}</div>` }));

/* ---------- 2. route pages ---------- */
routeList.forEach(([a, b]) => {
  const A = P[a], B = P[b], p = `/routes/${a}-to-${b}/`, opts = MM.legOptions(a, b), best = opts.find((o) => o.key === 'balanced') || opts[0];
  if (!opts.length) return;
  const pkgs = MM.LEG_PKGS[a + '|' + b] || MM.LEG_PKGS[b + '|' + a], tix = MM.TICKETS[a + '|' + b] || MM.TICKETS[b + '|' + a];
  const crossing = A.c !== B.c, bordNote = (() => { const s = [A.c, B.c].sort().join('-'); return s === 'KH-TH' && !MM.BORDERS['TH-KH'].open ? MM.BORDERS['TH-KH'].note : ''; })();
  const st = stateOf([[a, A.sug], [b, B.sug]]), pl = MM.plan(st);
  const faq = [
    [`How do I get from ${A.n} to ${B.n}?`, `${best.label}: ${best.modeLabel.toLowerCase()}, about ${U.hoursLabel(best.h)} door to door and roughly ${usd(best.u)}. ${opts.length > 1 ? 'There are other options below, including the cheapest and the fastest.' : 'It is the only sensible way to do it.'}`],
    [`How long is the journey from ${A.n} to ${B.n}?`, `${opts.map((o) => `${o.label.toLowerCase()} is about ${U.hoursLabel(o.h)}`).join('; ')}.`],
    [`What is the cheapest way from ${A.n} to ${B.n}?`, `${(opts.slice().sort((x, y) => x.u - y.u)[0]).modeLabel} at about ${usd(opts.slice().sort((x, y) => x.u - y.u)[0].u)}. Prices are typical fares and move with the season.`],
    ...(crossing ? [[`Do I need a visa to go from ${C[A.c].n} to ${C[B.c].n}?`, `This crosses a border, so check how long your passport allows in each country and whether the crossing is open. See the visa notes below and confirm on the official sites.`]] : [])];
  const ld = [faqLd(faq)];
  const body = `<header class="seo__hd"><span class="doc__tag">Getting around</span><h1 class="disp">${esc(A.n)} to ${esc(B.n)}</h1><p class="seo__lede">${esc(best.modeLabel)} is the usual way: about ${esc(U.hoursLabel(best.h))} and roughly ${usd(best.u)}. Here's every option, what it's like, and what to do at both ends.</p>${cta(st, `Plan ${A.n} to ${B.n}`)}</header>
<section class="seo__sec"><h2 class="disp">Your options</h2><div class="seo__tw"><table class="seo__t"><thead><tr><th>Option</th><th>How</th><th>Time</th><th>About</th><th>Arrives</th></tr></thead><tbody>${opts.map((o) => `<tr><td><b>${esc(o.label)}</b></td><td>${esc(o.modeLabel)}${o.ovn ? ' (overnight)' : ''}<br><i>${esc(o.route.steps.filter((s) => s.e.m !== 'taxi').map((s) => s.e.note).join('. '))}</i></td><td>${U.hoursLabel(o.h)}</td><td>${usd(o.u)}</td><td>${o.arrive}${o.arriveNext ? ' next day' : ''}${o.odd ? ' (odd hour)' : ''}</td></tr>`).join('')}</tbody></table></div>
${bordNote ? `<p class="seo__warn">${esc(bordNote)}</p>` : ''}
${tix ? `<p>Mad Monkey sells the train tickets for this one: ${tix.map((t) => `${esc(t.n)} ${usd(t.usd)}`).join(', ')}. <a href="https://madmonkeyhostels.com/tours-events/${esc(tix[1] ? tix[1].slug : tix[0].slug)}" rel="noopener">Book on madmonkeyhostels.com</a>.</p>` : ''}${pkgs ? `<p>Or bundle it: ${pkgs.map((k) => `<a href="https://madmonkeyhostels.com/tours-events/${esc(k.slug)}" rel="noopener">${esc(k.n)} ${usd(k.usd)}</a>`).join(', ')}.</p>` : ''}
<p class="fine">Prices and times are typical, not live. The builder shows the lowest real fare it can find once you add dates.</p></section>
<section class="seo__sec"><h2 class="disp">Where you'll stay</h2><div class="seo__two">${[a, b].map((id) => `<a class="seo__stay" href="${href('/hostels/' + id + '/')}">${hostelPhoto(id) ? img(hostelPhoto(id), `Mad Monkey ${P[id].n}`) : ''}<b>Mad Monkey ${esc(P[id].n)}</b><span>${esc(P[id].hook)}</span><i>Dorm from ${usd(P[id].bed)} · most people stay ${P[id].sug} nights</i></a>`).join('')}</div></section>
${crossing ? `<section class="seo__sec"><h2 class="disp">Visa length</h2>${visaBlock([A.c, B.c])}</section>` : ''}
${faqHTML(faq)}${cta(st, `Plan ${A.n} to ${B.n}`)}`;
  write(p, shell({ path: p, title: `${A.n} to ${B.n}: how to get there, how long and what it costs`, desc: `${A.n} to ${B.n} by ${best.modeLabel.toLowerCase()}: about ${U.hoursLabel(best.h)} and ${usd(best.u)}. Every option, with times, prices and where to stay at both ends.`, h1: `${A.n} to ${B.n}`, crumbs: [['Getting around', href('/routes/')]], body, ld, image: hostelPhoto(b) }));
});
write('/routes/', shell({ path: '/routes/', title: 'Getting around Southeast Asia between Mad Monkey hostels', desc: 'Buses, boats, trains and flights between 23 Mad Monkey hostels in Vietnam, Thailand, Laos, Cambodia, Indonesia and the Philippines, with times and prices.', h1: 'Getting around', body: `<header class="seo__hd"><h1 class="disp">Getting around</h1><p class="seo__lede">How to get between Mad Monkey hostels: every option, with real times and typical prices.</p></header><ul class="seo__links">${routeList.map(([a, b]) => `<li><a href="${href('/routes/' + a + '-to-' + b + '/')}">${esc(P[a].n)} to ${esc(P[b].n)}</a></li>`).join('')}</ul>` }));

/* ---------- 3. hostel pages ---------- */
listHostels().forEach((id) => {
  const p = P[id], page = `/hostels/${id}/`, acts = MM.actsAt(id).slice().sort((a, b) => (b.star ? 1 : 0) - (a.star ? 1 : 0)), dm = MM.dontMiss(id), gal = galleryPhotos(id), m = monthsLine([id]);
  const nextTo = (p.next || []).filter((n) => P[n] && !P[n].partner && hasRoute(id, n));
  const st = stateOf([[id, p.sug]]), faq = [
    [`How much is a dorm bed at Mad Monkey ${p.n}?`, `Dorm beds start from about ${usd(p.bed)} a night. Prices move with the season and room type, and the crew confirms the real rate when you send your trip.`],
    [`How many nights should I stay in ${p.n}?`, `Most travellers stay about ${p.sug} nights. ${p.min > 1 ? `Give it at least ${p.min}.` : ''}`],
    [`When is the best time to visit ${p.n}?`, m.text],
    [`What is there to do in ${p.n}?`, acts.length ? `Mad Monkey runs ${acts.slice(0, 4).map((a) => a.n).join(', ')} and more. ${dm ? dm.pitch : ''}` : p.hook]];
  const ld = [{ '@context': 'https://schema.org', '@type': 'Hostel', name: `Mad Monkey ${p.n}`, description: p.hook, brand: { '@type': 'Brand', name: 'Mad Monkey' }, image: hostelPhoto(id) || undefined, areaServed: p.n + ', ' + C[p.c].n }, faqLd(faq)];
  const body = `<header class="seo__hd"><span class="doc__tag">${esc(C[p.c].n)}</span><h1 class="disp">Mad Monkey ${esc(p.n)}</h1><p class="seo__lede">${esc(p.hook)}</p><div class="seo__facts"><div><b>${usd(p.bed)}</b><span>dorm from</span></div><div><b>${p.sug}</b><span>nights is typical</span></div><div><b>${acts.length}</b><span>things to do</span></div></div>${cta(st, `Add ${p.n} to a trip`)}</header>
${hostelPhoto(id) ? `<div class="seo__hero">${img(hostelPhoto(id), `Mad Monkey ${p.n}`)}</div>` : ''}
${gal.length > 1 ? `<div class="seo__gal">${gal.slice(1, 6).map((g, i) => img(g, `Inside Mad Monkey ${p.n}, photo ${i + 2}`)).join('')}</div>` : ''}
<section class="seo__sec"><h2 class="disp">Things to do in ${esc(p.n)}</h2>${dm ? `<div class="seo__dm"><span class="doc__tag">Don't miss</span><b>${esc(dm.act.n)}</b><p>${esc(dm.pitch)}</p></div>` : ''}<ul class="seo__acts2">${acts.map((a) => `<li>${actPhoto(a) ? img(actPhoto(a), a.n) : ''}<div><b>${esc(a.n)}</b><span>${a.usd == null ? 'Pay on the day' : (a.est ? '~' : 'from ') + usd(a.usd)}${a.star ? ' · top pick' : ''}</span>${a.slug ? `<a href="https://madmonkeyhostels.com/tours-events/${esc(a.slug)}" rel="noopener">Book on madmonkeyhostels.com</a>` : ''}</div></li>`).join('')}</ul></section>
<section class="seo__sec"><h2 class="disp">When to go</h2><p>${esc(m.text)}</p>${seasonBars([id])}</section>
${nextTo.length ? `<section class="seo__sec"><h2 class="disp">Where to go next</h2><ul class="seo__links">${nextTo.map((n) => { const r = MM.route(id, n, 'balanced'); return `<li><a href="${href('/routes/' + routeSlug(id, n) + '/')}">${esc(p.n)} to ${esc(P[n].n)}</a>${r ? ` <span>${U.hoursLabel(r.h)} · about ${usd(r.u)}</span>` : ''}</li>`; }).join('')}</ul></section>` : ''}
<section class="seo__sec"><h2 class="disp">Local knowledge</h2><ul>${(MM.GUIDE.places[id] || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ul><p class="fine"><a href="${href('/guides/' + C[p.c].n.toLowerCase() + '/')}">The full ${esc(C[p.c].n)} guide</a></p></section>
${eventsBlock([p.c], [id])}${faqHTML(faq)}${cta(st, `Add ${p.n} to a trip`)}`;
  write(page, shell({ path: page, title: `Mad Monkey ${p.n}: dorm beds from ${usd(p.bed)}, what to do and how to get there`, desc: `${p.hook} Dorm from ${usd(p.bed)} a night. Things to do, best time to go and how to get there from the other Mad Monkey hostels.`, h1: `Mad Monkey ${p.n}`, crumbs: [['Hostels', href('/hostels/')]], body, ld, image: hostelPhoto(id) }));
});
write('/hostels/', shell({ path: '/hostels/', title: 'All 23 Mad Monkey hostels in Southeast Asia', desc: 'Every Mad Monkey hostel across Vietnam, Thailand, Laos, Cambodia, Indonesia and the Philippines, with dorm prices, things to do and how to get between them.', h1: 'All 23 Mad Monkey hostels', body: `<header class="seo__hd"><h1 class="disp">All 23 Mad Monkey hostels</h1><p class="seo__lede">Six countries, one crew. Pick a hostel for what to do, when to go and how to get there.</p></header>${Object.keys(C).map((c) => `<section class="seo__sec"><h2 class="disp">${esc(C[c].n)}</h2><div class="seo__grid">${listHostels().filter((id) => P[id].c === c).map((id) => `<a class="seo__card" href="${href('/hostels/' + id + '/')}">${hostelPhoto(id) ? img(hostelPhoto(id), `Mad Monkey ${P[id].n}`) : ''}<b>${esc(P[id].n)}</b><em>${esc(P[id].hook)}</em><i>Dorm from ${usd(P[id].bed)}</i></a>`).join('')}</div></section>`).join('')}` }));

/* ---------- 4. country guides ---------- */
Object.keys(C).forEach((c) => {
  const name = C[c].n, p = `/guides/${name.toLowerCase()}/`, hs = listHostels().filter((id) => P[id].c === c), m = monthsLine(hs), tripsHere = trips.filter((t) => MM.plan(t.state).countries.indexOf(c) > -1).slice(0, 6);
  const st = stateOf([[hs[0], P[hs[0]].sug]]);
  const faq = [
    [`Do I need a visa for ${name}?`, `It depends on your passport. UK, US, Australian, Canadian and EU passports get ${[...new Set(['gb', 'us', 'au', 'ca', 'eu'].map((x) => MM.STAY[c][x].days + (MM.STAY[c][x].how === 'free' ? ' days visa-free' : MM.STAY[c][x].how === 'evisa' ? ' days on an e-visa' : ' days on a visa on arrival or e-visa')))].join(' or ')}. Check the official site before you fly. Checked ${MM.ENTRY_CHECKED}.`],
    [`What is the best time to visit ${name}?`, m.text],
    [`How much does it cost to backpack ${name}?`, `Dorm beds at Mad Monkey in ${name} start from about ${usd(Math.min(...hs.map((id) => P[id].bed)))} a night. With transport, activities and food, most travellers plan on roughly $40 to $80 a day depending on style.`],
    [`Is ${name} safe for solo travellers?`, `Millions of people backpack ${name} solo. Stay in social hostels, keep your valuables close, use app-based taxis where they exist and read the safety notes below, especially if you plan to ride a scooter.`]];
  const body = `<header class="seo__hd"><span class="doc__tag">Country guide</span><h1 class="disp">Backpacking ${esc(name)}</h1><p class="seo__lede">What to know before you go: visas, money, getting around, staying safe, and where to stay and what to do in ${esc(name)}. By the people who run ${hs.length} hostels there.</p>${cta(st, `Plan a ${name} trip`)}</header>
<section class="seo__sec"><h2 class="disp">Where to stay in ${esc(name)}</h2><div class="seo__grid">${hs.map((id) => `<a class="seo__card" href="${href('/hostels/' + id + '/')}">${hostelPhoto(id) ? img(hostelPhoto(id), `Mad Monkey ${P[id].n}`) : ''}<b>Mad Monkey ${esc(P[id].n)}</b><em>${esc(P[id].hook)}</em><i>Dorm from ${usd(P[id].bed)}</i></a>`).join('')}</div></section>
<section class="seo__sec"><h2 class="disp">Visa length</h2>${visaBlock([c])}</section>
<section class="seo__sec"><h2 class="disp">When to go</h2><p>${esc(m.text)}</p>${seasonBars(hs)}</section>
${eventsBlock([c], hs)}
<section class="seo__sec"><h2 class="disp">The practical stuff</h2>${kbBlock([c])}<p class="fine">Planning advice drafted ${esc(MM.GUIDE.checked)}. Rules and prices change, so check official sources for anything that matters.</p></section>
${tripsHere.length ? `<section class="seo__sec"><h2 class="disp">Routes that include ${esc(name)}</h2><div class="seo__grid">${tripsHere.map((t) => { const pl = MM.plan(t.state); return `<a class="seo__card" href="${href('/trips/' + t.slug + '/')}"><span>${esc(t.kicker)}</span><b>${esc(t.name)}</b><em>${esc(MM.routeLine(pl))}</em><i>${pl.totals.days} days · ~${usd(pl.totals.total)}</i></a>`; }).join('')}</div></section>` : ''}
${faqHTML(faq)}${cta(st, `Plan a ${name} trip`)}`;
  write(p, shell({ path: p, title: `Backpacking ${name}: visa, money, safety and where to stay`, desc: `Backpacking ${name}: how long you can stay, money, SIMs, scooters and safety, best time to go and where to stay across ${hs.length} Mad Monkey hostels.`, h1: `Backpacking ${name}`, crumbs: [['Guides', href('/guides/')]], body, ld: [faqLd(faq)], image: hostelPhoto(hs[0]) }));
});
write('/guides/', shell({ path: '/guides/', title: 'Southeast Asia backpacking guides', desc: 'Country guides for backpacking Vietnam, Thailand, Laos, Cambodia, Indonesia and the Philippines: visas, money, safety, getting around and where to stay.', h1: 'Backpacking guides', body: `<header class="seo__hd"><h1 class="disp">Backpacking guides</h1><p class="seo__lede">The practical stuff for each country, from the people who run the hostels.</p></header><ul class="seo__links">${Object.keys(C).map((c) => `<li><a href="${href('/guides/' + C[c].n.toLowerCase() + '/')}">Backpacking ${esc(C[c].n)}</a></li>`).join('')}</ul>` }));

/* ---------- homepage preview tags (only when SITE_URL is set, for hosting that isn't our server) ---------- */
if (SITE && OUT === ROOT) {
  const f = path.join(ROOT, 'index.html'), html = fs.readFileSync(f, 'utf8'), im = abs(href('/assets/og/home.jpg'));
  const tags = `<meta property="og:type" content="website"><meta property="og:url" content="${esc(abs(href('/')))}"><meta property="og:image" content="${esc(im)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${esc(im)}"><link rel="canonical" href="${esc(abs(href('/')))}">`;
  fs.writeFileSync(f, html.replace(/<!--og:start-->[\s\S]*?<!--og:end-->/, '<!--og:start-->' + tags + '<!--og:end-->'));
}

/* ---------- sitemap + robots ---------- */
const markers = ['trips', 'routes', 'hostels', 'guides'];
markers.forEach((d) => fs.writeFileSync(path.join(OUT, d, '.generated'), 'Written by scripts/build-pages.mjs. Safe to delete and rebuild.\n'));
const urls = ['/', ...Object.keys(slugs)];
if (SITE) {
  fs.writeFileSync(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${esc(abs(href(u)))}</loc><lastmod>${BUILT.toISOString().slice(0, 10)}</lastmod></url>`).join('\n')}\n</urlset>\n`);
  fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nSitemap: ${abs(href('/sitemap.xml'))}\n`);
} else { for (const f of ['sitemap.xml', 'robots.txt']) { try { fs.unlinkSync(path.join(OUT, f)); } catch { /* none yet */ } } }
console.log(`Wrote ${Object.keys(slugs).length} pages (${trips.length} trips, ${routeList.length} routes, ${listHostels().length} hostels, ${Object.keys(C).length} guides)` + (SITE ? ` for ${SITE}` : ' (no SITE_URL: no canonical links, sitemap or preview images)'));
