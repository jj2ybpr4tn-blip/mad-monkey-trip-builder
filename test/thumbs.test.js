/* Small photo copies: where the page finds them, with the full photos hot-linked (the live ALL IN site) or hosted beside them (PHOTO_BASE).
   Run: node test/thumbs.test.js   (part of npm test) */
var fs = require('fs'), path = require('path');
var ROOT = path.join(__dirname, '..'), PH = path.join(ROOT, 'assets', 'photos');
['places', 'activities', 'media', 'gallery'].forEach(function (f) { require('../data/' + f + '.js'); });
var MM = globalThis.MM, media = require('../data/media.js');
var pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log('PASS  ' + name); } else { fail++; console.log('FAIL  ' + name + (extra ? '  -> ' + extra : '')); } }
function config(o) { globalThis.MM_CONFIG = Object.assign({ PHOTO_BASE: '', THUMB_BASE: '', PHOTO_THUMBS: true }, o); }
var exists = function (rel) { return fs.existsSync(path.join(PH, rel)); };

// every photo the builder can show, as the page asks for it when the full photos are hot-linked
config({});
var all = [];     // { url, name }
Object.keys(media.HOSTEL).forEach(function (id) { all.push({ url: MM.hostelImg(id), name: 'hostel/' + id }); });
// (a few tour photos are listed but no activity uses them, and they were never copied: scripts/audit-data.mjs only asks for the ones an activity shows)
var shown = {}; Object.keys(MM.ACTS).forEach(function (id) { if (MM.ACTS[id].slug) shown[MM.ACTS[id].slug] = 1; });
Object.keys(media.TOUR).filter(function (slug) { return shown[slug]; }).forEach(function (slug) { all.push({ url: MM.tourImg(slug), name: 'tour/' + slug }); });
Object.keys(MM.PLACES).forEach(function (id) { MM.gallery(id).forEach(function (u, k) { all.push({ url: u, name: 'gallery/' + id + '-' + k }); }); });
ok('there are photos to check', all.length > 200, String(all.length));
ok('every one is a hot-linked madmonkeyhostels.com address', all.every(function (a) { return /^https:\/\/madmonkeyhostels\.com\//.test(a.url); }));

config({ THUMB_BASE: 'assets/photos' });
['s', 'm'].forEach(function (size) {
  var bad = all.filter(function (a) { var want = 'assets/photos/' + size + '/' + a.name + '.webp'; return MM.thumb(a.url, size) !== want || !exists(size + '/' + a.name + '.webp'); });
  ok('with THUMB_BASE every photo maps to a small copy that exists (' + size + ')', bad.length === 0, bad.slice(0, 3).map(function (a) { return a.name + ' -> ' + MM.thumb(a.url, size); }).join(', '));
});
ok('a trailing slash on THUMB_BASE is fine', (config({ THUMB_BASE: 'assets/photos/' }), MM.thumb(all[0].url, 's') === 'assets/photos/s/' + all[0].name + '.webp'));
ok('a CDN address works as the base', (config({ THUMB_BASE: 'https://cdn.example/p' }), MM.thumb(all[0].url, 'm') === 'https://cdn.example/p/m/' + all[0].name + '.webp'));

config({ THUMB_BASE: 'assets/photos' });
var other = 'https://madmonkeyhostels.com/api/share-image/property/hanoi/not-a-real-photo.jpg';
ok('a photo we have no small copy of comes back unchanged', MM.thumb(other, 's') === other);
ok('so does an address that is not a photo of ours', MM.thumb('https://example.com/x.jpg', 's') === 'https://example.com/x.jpg');
ok('and an unknown size, nothing, or a number', MM.thumb(all[0].url, 'xl') === all[0].url && MM.thumb(all[0].url) === all[0].url && MM.thumb('', 's') === '' && MM.thumb(null, 's') === null);
config({ THUMB_BASE: 'assets/photos', PHOTO_THUMBS: false });
ok('PHOTO_THUMBS false switches them off', MM.thumb(all[0].url, 's') === all[0].url);
config({ THUMB_BASE: '' });
ok('with no THUMB_BASE (the default) nothing changes', MM.thumb(all[0].url, 's') === all[0].url);
ok('with no config at all nothing changes (the page builder and the tests)', (delete globalThis.MM_CONFIG, MM.thumb(all[0].url, 's') === all[0].url));

// hosting our own full copies (PHOTO_BASE) keeps working as before, and wins over THUMB_BASE
config({ PHOTO_BASE: 'assets/photos' });
var h = MM.hostelImg('hanoi');
ok('PHOTO_BASE: the small copy sits beside the full one', h === 'assets/photos/hostel/hanoi.jpg' && MM.thumb(h, 's') === 'assets/photos/s/hostel/hanoi.webp' && MM.thumb(h, 'm') === 'assets/photos/m/hostel/hanoi.webp');
ok('PHOTO_BASE: a gallery photo too', MM.thumb(MM.gallery('hanoi')[0], 's') === 'assets/photos/s/gallery/hanoi-0.webp');
config({ PHOTO_BASE: 'assets/photos', THUMB_BASE: 'elsewhere' });
ok('PHOTO_BASE wins when both are set', MM.thumb(MM.hostelImg('hanoi'), 's') === 'assets/photos/s/hostel/hanoi.webp');
ok('PHOTO_BASE: an address outside it comes back unchanged', MM.thumb('https://example.com/a.jpg', 's') === 'https://example.com/a.jpg');

// and the folders hold exactly the photos the page can ask for
var onDisk = [];
['hostel', 'tour', 'gallery'].forEach(function (k) { (fs.existsSync(path.join(PH, k)) ? fs.readdirSync(path.join(PH, k)) : []).forEach(function (f) { if (/\.jpe?g$/i.test(f)) onDisk.push(k + '/' + f.replace(/\.jpe?g$/i, '')); }); });
var mapped = {}; all.forEach(function (a) { mapped[a.name] = 1; });
var unmapped = onDisk.filter(function (n) { return !mapped[n]; });
ok('every photo on disk can be reached through a small copy (nothing left out)', unmapped.length === 0, unmapped.slice(0, 5).join(', '));
var smallFiles = []; (function walk(d, rel) { fs.readdirSync(d, { withFileTypes: true }).forEach(function (e) { if (e.isDirectory()) walk(path.join(d, e.name), rel + e.name + '/'); else if (/\.webp$/.test(e.name)) smallFiles.push(rel + e.name); }); })(path.join(PH, 's'), '');
ok('and there is no small copy that no photo asks for', smallFiles.every(function (f) { return mapped[f.replace(/\.webp$/, '')]; }), smallFiles.filter(function (f) { return !mapped[f.replace(/\.webp$/, '')]; }).slice(0, 5).join(', '));

console.log('\n' + pass + '/' + (pass + fail) + ' thumbnail checks passed');
process.exit(fail ? 1 : 0);
