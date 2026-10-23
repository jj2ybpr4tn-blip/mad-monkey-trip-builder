#!/usr/bin/env node
/* Makes small copies of every photo in assets/photos, so a phone downloads a 15 KB picture for a 64 px thumbnail instead of the 190 KB original.
 *   node scripts/make-thumbs.mjs            writes assets/photos/s/<kind>/<name>.webp (320 px wide) and assets/photos/m/<kind>/<name>.webp (720 px wide)
 *   node scripts/make-thumbs.mjs --check    changes nothing; exits 1 if a thumbnail is missing or older than its photo
 * Needs `cwebp` (brew install webp). Safe to re-run: only photos that changed are redone.
 * The builder uses them when MM_CONFIG.PHOTO_THUMBS is true (and PHOTO_BASE points at these photos), and quietly falls back to the original if one is missing.
 *   s  gallery strips, tour cards, stop thumbnails, lists          m  the big cards (ALL IN trips, the featured trip)
 */
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), PH = path.join(ROOT, 'assets', 'photos'), check = process.argv.includes('--check');
const SIZES = { s: { w: 320, q: 68 }, m: { w: 720, q: 70 } };
const have = (() => { try { execFileSync('cwebp', ['-version'], { stdio: 'ignore' }); return true; } catch { return false; } })();
if (!have && !check) { console.error('cwebp not found. Install it (macOS: brew install webp) and run this again.'); process.exit(2); }
const walk = (d, rel = '') => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? (rel === '' && (e.name === 's' || e.name === 'm') ? [] : walk(path.join(d, e.name), rel + e.name + '/')) : /\.jpe?g$/i.test(e.name) ? [rel + e.name] : []);
const originals = walk(PH); let made = 0, stale = 0, bytes = { s: 0, m: 0 }, full = 0;
for (const f of originals) {
  const src = path.join(PH, f); full += fs.statSync(src).size;
  for (const [k, { w, q }] of Object.entries(SIZES)) {
    const out = path.join(PH, k, f.replace(/\.jpe?g$/i, '.webp'));
    const fresh = fs.existsSync(out) && fs.statSync(out).mtimeMs >= fs.statSync(src).mtimeMs;
    if (!fresh) { stale++; if (!check) { fs.mkdirSync(path.dirname(out), { recursive: true }); execFileSync('cwebp', ['-quiet', '-q', String(q), '-m', '6', '-resize', String(w), '0', src, '-o', out]); made++; } }
    if (fs.existsSync(out)) bytes[k] += fs.statSync(out).size;
  }
}
const mb = (n) => (n / 1048576).toFixed(1) + ' MB';
console.log(originals.length + ' photos (' + mb(full) + ' as originals) -> small ' + mb(bytes.s) + ', medium ' + mb(bytes.m) + (check ? '' : ', ' + made + ' written'));
if (check && stale) { console.error(stale + ' thumbnail(s) missing or out of date. Run: node scripts/make-thumbs.mjs'); process.exit(1); }
