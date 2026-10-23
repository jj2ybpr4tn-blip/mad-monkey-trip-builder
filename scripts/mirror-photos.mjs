#!/usr/bin/env node
// Copy every photo the builder uses onto your own hosting, resized, so the page no longer depends on madmonkeyhostels.com.
//   node scripts/mirror-photos.mjs            → writes assets/photos/{hostel,tour,gallery}/…
// Then set  PHOTO_BASE: '/assets/photos'  (or your CDN URL) in config.js, and run  node scripts/make-thumbs.mjs  for the small copies the page loads first.
// Resizing uses `sips` (macOS) or ImageMagick `magick`/`convert` if present; otherwise originals are copied as-is.
// The main site sits behind Cloudflare, which can refuse scripted downloads. Anything that fails is listed at the end;
// for those, fetch the files from a browser session (or ask web ops for an export) and drop them in the same folders.
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process'; import { fileURLToPath } from 'node:url'; import { createRequire } from 'node:module';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), require = createRequire(import.meta.url);
for (const f of ['places', 'activities', 'media', 'legs', 'trips', 'entry', 'gallery']) require(path.join(ROOT, 'data', f + '.js'));
const MM = globalThis.MM, OUT = path.join(ROOT, 'assets', 'photos'), UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36';
const SRC = 'https://madmonkey-wp.sgp1.cdn.digitaloceanspaces.com/';
const have = (c) => { try { execFileSync('which', [c], { stdio: 'ignore' }); return true; } catch { return false; } };
const resizer = have('sips') ? 'sips' : have('magick') ? 'magick' : have('convert') ? 'convert' : null;
const jobs = [];
Object.keys(MM.PLACES).forEach((id) => { const u = MM.hostelImg(id); if (u) jobs.push({ u, to: `hostel/${id}.jpg` }); });
Object.values(MM.ACTS).forEach((a) => { const u = MM.actImg(a); if (u) jobs.push({ u, to: `tour/${a.slug}.jpg` }); });
Object.keys(MM.PLACES).forEach((id) => { MM.galleryRaw(id).forEach((p, k) => jobs.push({ u: SRC + p, to: `gallery/${id}-${k}.jpg`, direct: true })); });
let ok = 0; const failed = [];
for (const j of jobs) {
  const dest = path.join(OUT, j.to); if (fs.existsSync(dest)) { ok++; continue; }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  try {
    const res = await fetch(j.u, { headers: { 'User-Agent': UA } }); if (!res.ok) throw new Error('HTTP ' + res.status);
    const tmp = dest + '.src'; fs.writeFileSync(tmp, Buffer.from(await res.arrayBuffer()));
    try {
      if (resizer === 'sips') execFileSync('sips', ['-Z', '1100', '-s', 'format', 'jpeg', '-s', 'formatOptions', '72', tmp, '--out', dest], { stdio: 'ignore' });
      else if (resizer) execFileSync(resizer, [tmp, '-resize', '1100x1100>', '-quality', '72', dest], { stdio: 'ignore' });
      else fs.copyFileSync(tmp, dest);
    } finally { fs.rmSync(tmp, { force: true }); }
    ok++; process.stdout.write('.');
  } catch (e) { failed.push(j.to + ' (' + e.message + ')'); process.stdout.write('x'); }
}
console.log(`\n${ok}/${jobs.length} photos in ${path.relative(process.cwd(), OUT)}${resizer ? ' (resized with ' + resizer + ')' : ' (not resized: install ImageMagick)'}`);
if (failed.length) { console.log(`\n${failed.length} failed:\n  ` + failed.slice(0, 25).join('\n  ') + (failed.length > 25 ? '\n  …' : '')); }
console.log('\nNext: set PHOTO_BASE: \'/assets/photos\' in config.js, then run: node scripts/make-thumbs.mjs');
