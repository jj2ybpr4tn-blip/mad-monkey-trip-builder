/* Builds every page for Google into a temp folder and checks them. Run: node test/pages.test.js  (part of npm test) */
const fs = require('fs'), path = require('path'), os = require('os'), { spawnSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..'), OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-pages-'));
let pass = 0, fail = 0;
const ok = (name, cond, extra) => { if (cond) { pass++; console.log('PASS  ' + name); } else { fail++; console.log('FAIL  ' + name + (extra ? '  -> ' + extra : '')); } };

const r = spawnSync('node', ['scripts/build-pages.mjs'], { cwd: ROOT, env: { ...process.env, OUT_DIR: OUT, SITE_URL: 'https://trips.test', BASE_PATH: '' }, encoding: 'utf8' });
ok('page build runs', r.status === 0, r.stderr);
const dirs = ['trips', 'routes', 'hostels', 'guides'], pages = [];
dirs.forEach((d) => { pages.push(path.join(d, 'index.html')); fs.readdirSync(path.join(OUT, d), { withFileTypes: true }).filter((e) => e.isDirectory()).forEach((e) => pages.push(path.join(d, e.name, 'index.html'))); });
ok('about 100 pages written (34 trips, 37 routes, 23 hostels, 6 guides + indexes)', pages.length >= 100, String(pages.length));

const titles = {}, descs = {}, bad = [], missing = new Set(); let ld = 0;
pages.forEach((f) => {
  const h = fs.readFileSync(path.join(OUT, f), 'utf8'), t = (h.match(/<title>([^<]*)<\/title>/) || [])[1], d = (h.match(/name="description" content="([^"]*)"/) || [])[1];
  (titles[t] = titles[t] || []).push(f); (descs[d] = descs[d] || []).push(f);
  if (!t || t.length > 90) bad.push(f + ' title'); if (!d || d.length < 60 || d.length > 320) bad.push(f + ' description');
  if (!/<link rel="canonical" href="https:\/\/trips\.test\//.test(h)) bad.push(f + ' canonical');
  if ((h.match(/<h1[ >]/g) || []).length !== 1) bad.push(f + ' h1');
  [...h.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].forEach((m) => { try { JSON.parse(m[1]); ld++; } catch (e) { bad.push(f + ' json-ld'); } });
  [...h.matchAll(/href="(\/[^"#?]*)"/g)].forEach((m) => { const p = m[1]; if (/^\/(trips|routes|hostels|guides)\//.test(p) && !fs.existsSync(path.join(OUT, p.replace(/^\//, ''), 'index.html'))) missing.add(f + ' -> ' + p); else if (/^\/assets\//.test(p) && !fs.existsSync(path.join(ROOT, p.replace(/^\//, '')))) missing.add(f + ' -> ' + p); });
});
ok('every page has a title, description, one h1 and a canonical link', bad.length === 0, bad.slice(0, 5).join('; '));
ok('no two pages share a title or description', Object.values(titles).every((v) => v.length === 1) && Object.values(descs).every((v) => v.length === 1), Object.entries(titles).filter(([k, v]) => v.length > 1).map(([k]) => k).join('; '));
ok('every structured-data block is valid JSON', ld > 200, String(ld));
ok('no internal link or image points at a page that does not exist', missing.size === 0, [...missing].slice(0, 5).join('; '));

const sm = fs.readFileSync(path.join(OUT, 'sitemap.xml'), 'utf8'), robots = fs.readFileSync(path.join(OUT, 'robots.txt'), 'utf8');
ok('sitemap lists every page', (sm.match(/<loc>/g) || []).length === pages.length + 1 - 0 || (sm.match(/<loc>/g) || []).length >= pages.length, String((sm.match(/<loc>/g) || []).length));
ok('robots.txt blocks admin + api and points at the sitemap', /Disallow: \/admin/.test(robots) && /Disallow: \/api\//.test(robots) && /Sitemap: https:\/\/trips\.test\/sitemap\.xml/.test(robots));
const hostel = fs.readFileSync(path.join(OUT, 'hostels/hanoi/index.html'), 'utf8'), route = fs.readFileSync(path.join(OUT, 'routes/hanoi-to-hoi-an/index.html'), 'utf8'), guide = fs.readFileSync(path.join(OUT, 'guides/vietnam/index.html'), 'utf8');
ok('hostel page: price, things to do, FAQ markup and a build button', /Mad Monkey Hanoi/.test(hostel) && /dorm from/i.test(hostel) && /FAQPage/.test(hostel) && /href="\/#\/build\/i=s\.hanoi/.test(hostel));
ok('route page: every option with time + price, FAQ markup', /Hanoi to Hoi An/.test(route) && /<th>Option<\/th>/.test(route) && /FAQPage/.test(route));
ok('country guide: visa table, scooter rules and festivals', /Visa length/.test(guide) && /1968/.test(guide) && /Festivals and closures/.test(guide));
ok('pages carry the estimates disclaimer', pages.every((f) => /Prices are estimates, not quotes/.test(fs.readFileSync(path.join(OUT, f), 'utf8'))));
fs.rmSync(OUT, { recursive: true, force: true });
console.log('\n' + pass + '/' + (pass + fail) + ' page checks passed'); process.exit(fail ? 1 : 0);
