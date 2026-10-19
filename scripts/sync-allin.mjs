#!/usr/bin/env node
/* Sync the trip builder into the ALL IN site's copy (CFSiteDesign/mm-squad-trips, public/trip-builder/).
 *
 *   node scripts/sync-allin.mjs /path/to/mm-squad-trips            copy the files across
 *   node scripts/sync-allin.mjs /path/to/mm-squad-trips --check    change nothing, say what would change (exit 1 if anything would)
 *
 * The live copy is this builder plus three things that are ITS OWN and are never overwritten:
 *   config.js    its endpoints, deposit and ALL IN base (only missing keys are added, with this repo's defaults commented in)
 *   assets/      only the files that already exist there are refreshed
 *   index.html   rebuilt from this repo's: the SEO footer (links to pages that don't exist on that site) is removed, versions follow ours
 * Everything else is copied as is, so the two builders can't drift apart again. Run it, then commit in that repo.
 */
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), check = args.includes('--check'), target = args.find((a) => !a.startsWith('--'));
if (!target) { console.error('usage: node scripts/sync-allin.mjs <path to mm-squad-trips> [--check]'); process.exit(2); }
const DEST = path.join(path.resolve(target), 'public', 'trip-builder');
if (!fs.existsSync(DEST)) { console.error('No public/trip-builder in ' + target); process.exit(2); }

const SHARED = ['app.js', 'logic.js', 'extras.js', 'crew.js', 'group.js', 'ui-map.js', 'ui-story.js', 'ui-review.js', 'ui-group.js', 'ui-live.js', 'ui-extras.js', 'ui-pack.js', 'ui-crew.js', 'styles.css', 'crew.css'];
const DATA = fs.readdirSync(path.join(ROOT, 'data')).filter((f) => f.endsWith('.js')).map((f) => 'data/' + f);
const changes = [];
function put(rel, text) {
  const out = path.join(DEST, rel), prev = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : null;
  if (prev === text) return;
  changes.push((prev === null ? 'new      ' : 'changed  ') + rel);
  if (!check) { fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, text); }
}
for (const f of [...SHARED, ...DATA]) put(f, fs.readFileSync(path.join(ROOT, f), 'utf8'));

// index.html: ours, without the SEO footer, and with the live copy's own title of nav unchanged (the ALL IN button is in ours already)
let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
html = html.replace(/<!--seo:start-->[\s\S]*?<!--seo:end-->/, '  <!-- The Google pages (guides, trips, routes, hostels) aren\'t part of the ALL IN copy, so their footer links are left out. -->\n  <noscript><p style="padding:24px;text-align:center">The trip builder needs JavaScript. <a href="../">See the ALL IN trips</a>.</p></noscript>').replace(/\n\s*<noscript><p style="padding:24px;text-align:center">The trip builder needs JavaScript\. The guides[^\n]*<\/noscript>/, '');
put('index.html', html);

// assets: refresh only what the live copy already has
const aroot = path.join(ROOT, 'assets');
(function walk(dir, rel = 'assets') {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name), r = rel + '/' + e.name;
    if (e.isDirectory()) { if (e.name !== 'photos') walk(p, r); continue; }
    if (fs.existsSync(path.join(DEST, r)) && !fs.readFileSync(path.join(DEST, r)).equals(fs.readFileSync(p))) { changes.push('changed  ' + r); if (!check) fs.copyFileSync(p, path.join(DEST, r)); }
  }
})(aroot);

// config.js: add any key the live copy doesn't have yet, never touch the ones it has
const cfgPath = path.join(DEST, 'config.js'), live = fs.readFileSync(cfgPath, 'utf8'), mine = fs.readFileSync(path.join(ROOT, 'config.js'), 'utf8');
const ALLIN_DEFAULTS = { CREW_ENDPOINT: "'https://bilhhkzcmicygufsdfxi.supabase.co/functions/v1/trip-builder-admin'", PAY_ENDPOINT: "'https://bilhhkzcmicygufsdfxi.supabase.co/functions/v1/trip-builder-pay'", ALLIN_BASE: "'../'", DEPOSIT_PER_PERSON: '50' };
let cfg = live;
const missingKeys = Object.keys(ALLIN_DEFAULTS).filter((k) => !new RegExp('^\\s*' + k + '\\s*:', 'm').test(cfg));
if (missingKeys.length) {
  const end = cfg.search(/\n\};\s*\n/);                      // the closing of MM_CONFIG
  if (end < 0) { console.error('config.js: could not find the end of MM_CONFIG'); process.exit(4); }
  let head = cfg.slice(0, end).replace(/([^,\s{])(\s*)$/, '$1,$2'), add = '';   // the last existing key needs a comma before we add more
  for (const k of missingKeys) {
    const doc = (mine.match(new RegExp('((?:^[ \\t]*//[^\\n]*\\n)+)[ \\t]*' + k + '\\s*:', 'm')) || [])[1] || '';
    add += '\n\n' + doc.replace(/\n$/, '') + '\n  ' + k + ': ' + ALLIN_DEFAULTS[k] + ',';
    changes.push('config   + ' + k);
  }
  cfg = head + add + cfg.slice(end);
  try { new Function('window', cfg); } catch (e) { console.error('config.js would not parse after the change: ' + e.message); process.exit(4); }
}
if (cfg !== live && !check) fs.writeFileSync(cfgPath, cfg);

// every asset index.html asks for must exist there
const missing = [...html.matchAll(/(?:src|href)="((?!https?:|\/\/|#|data:|\.\.\/)[^"?]+\.(?:js|css|png|jpg|svg))/g)].map((m) => m[1]).filter((f) => !fs.existsSync(path.join(DEST, f)) && !changes.some((c) => c.endsWith(f)));
if (missing.length) { console.error('index.html refers to files that aren\'t there: ' + missing.join(', ')); process.exit(3); }
console.log(changes.length ? changes.join('\n') + '\n' + changes.length + ' file(s) ' + (check ? 'would change' : 'updated') : 'already in sync');
process.exit(check && changes.length ? 1 : 0);
