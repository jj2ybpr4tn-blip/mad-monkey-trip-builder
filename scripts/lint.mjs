#!/usr/bin/env node
/* Quick checks that need nothing installed:  node scripts/lint.mjs   (also the first step of: npm run check)
 *   1. every .js / .mjs file parses
 *   2. nothing builds an inline event handler (onclick="…", onerror="…"): the page's Content-Security-Policy would silently block it
 *   3. nothing loads a script, style or font from a host the Content-Security-Policy in index.html doesn't allow
 *   4. every file index.html loads exists, and its ?v= is the same on every script and style, so one change can't be served half-old
 */
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['node_modules', '.git', '.demo-build', 'handoff', 'assets', 'hostels', 'guides', 'trips', 'routes', 'server-data']);
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => SKIP.has(e.name) ? [] : e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const files = walk(ROOT), js = files.filter((f) => /\.(m?js)$/.test(f)), problems = [];
const rel = (f) => path.relative(ROOT, f);

for (const f of js) {                                                                              // 1
  try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); } catch (e) { problems.push(rel(f) + ': does not parse\n    ' + String(e.stderr || e.message).split('\n').slice(0, 4).join('\n    ')); }
}
const INLINE = /[\s"'<]on(click|error|load|change|input|submit|keydown|keyup|focus|blur|mouse\w+|touch\w+)\s*=\s*\\?["']/i;
for (const f of [...js.filter((x) => !x.includes(path.sep + 'test' + path.sep) && !x.includes(path.sep + 'scripts' + path.sep) && !x.includes(path.sep + 'server' + path.sep)), ...files.filter((x) => /(^|\/)index\.html$/.test(rel(x)) && !rel(x).includes('/'))]) {   // 2
  fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => { if (INLINE.test(line) && !/^\s*(\/\/|\*)/.test(line)) problems.push(rel(f) + ':' + (i + 1) + ': inline event handler (blocked by the Content-Security-Policy). Use data-act and the delegated handler.'); });
}

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const csp = (html.match(/Content-Security-Policy"\s+content="([^"]*)"/) || [])[1] || '';
const dir = (name) => ((csp.match(new RegExp('(?:^|;)\\s*' + name + '\\s+([^;]*)')) || [])[1] || '').split(/\s+/).filter(Boolean);
const allowed = { script: dir('script-src'), style: dir('style-src'), font: dir('font-src') };
const hostOk = (url, list) => { try { const u = new URL(url); return list.some((s) => s === u.origin || (s.startsWith('https://') && s.endsWith('*') && u.origin.startsWith(s.slice(0, -1)))); } catch { return false; } };
for (const m of html.matchAll(/<script[^>]+src="(https?:[^"]+)"/g)) if (!hostOk(m[1], allowed.script)) problems.push('index.html: script from ' + m[1] + ' is not allowed by the Content-Security-Policy');   // 3
for (const m of html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="(https?:[^"]+)"/g)) if (!hostOk(m[1], allowed.style)) problems.push('index.html: stylesheet from ' + m[1] + ' is not allowed by the Content-Security-Policy');
if (!csp) problems.push('index.html: no Content-Security-Policy meta tag');

const versions = new Set();                                                                          // 4
for (const m of html.matchAll(/(?:src|href)="((?!https?:|\/\/|#|data:)[^"?]+\.(?:js|css))(?:\?v=([^"]+))?"/g)) {
  if (!fs.existsSync(path.join(ROOT, m[1]))) problems.push('index.html: ' + m[1] + ' does not exist');
  if (m[2]) versions.add(m[2]); else if (!m[1].startsWith('config')) problems.push('index.html: ' + m[1] + ' has no ?v= (browsers will keep serving an old copy)');
}
if (versions.size > 1) problems.push('index.html: scripts and styles have different ?v= numbers (' + [...versions].join(', ') + '): bump them together');

if (problems.length) { console.error(problems.join('\n')); console.error('\n' + problems.length + ' problem(s)'); process.exit(1); }
console.log(js.length + ' scripts parse, no inline handlers, Content-Security-Policy matches what index.html loads, ?v=' + [...versions].join(''));
