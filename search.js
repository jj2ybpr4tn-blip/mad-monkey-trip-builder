/* ============================================================
   SEARCH: one box for everything a traveller might type.
   A hostel ("hanoi", "ho chi minh", "bali"), a country ("viet"), something to do ("kayak", "cooking", "loop"), an ALL IN trip,
   a classic route or a vibe ("party", "surf"). Pure functions, no DOM (ui-search.js draws the box).

     MM.search(query, { limit })  -> [{ kind, id, title, sub, tag, score, p?, c? }]   best first; [] when nothing matches
     MM.searchHints()             -> what to show before they type anything: the six countries and two ready-made vibes

   kind: 'place' | 'country' | 'tour' | 'allin' | 'route' | 'theme'
   Every word they type has to match something (a name, a nickname, the country, a tag); the earlier in a name it matches, the higher it scores.
   Nothing found? it tries a small typo ("hanoy", "hoian", "siemreap") before giving up.
   ============================================================ */
(function (r) {
  var MM = r.MM = r.MM || {};
  var P = function () { return MM.PLACES; };

  function norm(s) {
    s = String(s == null ? '' : s).toLowerCase();
    if (s.normalize) s = s.normalize('NFD').replace(/[̀-ͯ]/g, '');
    return s.replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function words(s) { return s ? s.split(' ') : []; }
  function uniq(a) { var o = [], seen = {}; a.forEach(function (x) { if (x && !seen[x]) { seen[x] = 1; o.push(x); } }); return o; }

  // what people call things, beyond the name: tag -> words that mean it
  var TAG_WORDS = {
    dive: ['scuba', 'diving', 'snorkel', 'snorkelling', 'snorkeling', 'reef'], surf: ['surfing', 'surfer', 'surf lesson', 'waves'], party: ['nightlife', 'pub crawl', 'bar crawl', 'club', 'clubbing', 'drinks', 'rave'],
    moto: ['motorbike', 'scooter', 'bike', 'motorcycle', 'riding'], trek: ['hike', 'hiking', 'trekking', 'volcano'], wildlife: ['elephant', 'elephants', 'animals', 'monkeys', 'turtles'],
    beach: ['beaches', 'sand', 'swim'], water: ['boat', 'boats', 'kayak', 'kayaking', 'paddle', 'cruise', 'island hopping'], food: ['cooking', 'street food', 'eat', 'eating', 'foodie', 'cooking class'],
    culture: ['temple', 'temples', 'history', 'museum', 'heritage'], chill: ['relax', 'relaxing', 'yoga', 'spa', 'slow', 'hammock'], adventure: ['zipline', 'cave', 'caves', 'canyon', 'cliff jump', 'abseil'],
    nature: ['jungle', 'waterfall', 'waterfalls', 'forest'], mountains: ['hills', 'peaks', 'mountain'], city: ['urban', 'nightlife']
  };
  var TAG_NAME = { moto: 'motorbikes', water: 'on the water', party: 'party', beach: 'beach', chill: 'chill', food: 'food', culture: 'culture', adventure: 'adventure', nature: 'nature', dive: 'diving', surf: 'surf', wildlife: 'wildlife', mountains: 'mountains', trek: 'trekking', city: 'city' };
  var BIAS = { place: 12, country: 10, allin: 5, theme: 6, route: 4, tour: -6 };
  var TAGLABEL = { place: 'Hostel', country: 'Country', tour: 'Tour', allin: 'ALL IN', route: 'Route', theme: 'Vibe' };

  var index = null;
  function entry(kind, id, title, sub, extra) {
    var t = norm(title), e = { kind: kind, id: id, title: title, sub: sub, tag: TAGLABEL[kind], t: t, w: words(t), c: t.replace(/ /g, ''), bias: BIAS[kind], aliases: [], kw: [], kwText: ' ', tagText: ' ' };
    if (extra) for (var k in extra) e[k] = extra[k];
    return e;
  }
  function finish(e, keywords, tagwords) {
    var kw = []; (keywords || []).forEach(function (k) { var n = norm(k); if (n) { kw.push(n); words(n).forEach(function (w) { kw.push(w); }); } });
    e.kw = uniq(kw); e.kwText = ' ' + e.kw.join(' ') + ' ';
    var tg = []; (tagwords || []).forEach(function (k) { var n = norm(k); if (n) { tg.push(n); words(n).forEach(function (w) { tg.push(w); }); } });
    e.tagText = ' ' + uniq(tg).join(' ') + ' ';
    e.aliases = e.aliases.map(norm).filter(Boolean);
    return e;
  }
  function money(n) { return MM.money ? MM.money(n, 'USD') : '$' + Math.round(n); }
  function build() {
    var list = [], countryName = function (c) { return MM.COUNTRIES[c] ? MM.COUNTRIES[c].n : ''; };
    Object.keys(MM.COUNTRIES || {}).forEach(function (c) {
      var hostels = MM.PLACE_ORDER.filter(function (id) { return P()[id].c === c && !P()[id].partner; }).length, tours = Object.keys(MM.ACTS || {}).filter(function (id) { return P()[MM.ACTS[id].p] && P()[MM.ACTS[id].p].c === c; }).length;
      var e = entry('country', c, countryName(c), hostels + (hostels === 1 ? ' hostel' : ' hostels') + ' · ' + tours + ' things to do', { c: c });
      e.cc = e.t.replace(/ /g, ''); e.aliases = (MM.COUNTRY_TERMS && MM.COUNTRY_TERMS[c]) || [];
      list.push(finish(e, e.aliases.concat(['country'])));
    });
    MM.PLACE_ORDER.forEach(function (id) {
      var p = P()[id], terms = (MM.PLACE_TERMS && MM.PLACE_TERMS[id]) || [], tags = [];
      p.tags.forEach(function (t) { tags.push(t); (TAG_WORDS[t] || []).forEach(function (w) { tags.push(w); }); });
      var e = entry('place', id, p.n, countryName(p.c) + (p.partner ? ' · partner stay' : ' · dorm from ' + money(p.bed) + ' a night'), { p: id, c: p.c });
      e.aliases = terms.concat(id.replace(/-/g, ' '));
      list.push(finish(e, terms.concat([countryName(p.c), 'hostel', 'mad monkey'], words(norm(p.hook)).filter(function (w) { return w.length > 3; })), tags));
    });
    Object.keys(MM.ACTS || {}).forEach(function (id) {
      var a = MM.ACTS[id], p = P()[a.p]; if (!p) return;
      var tags = []; (a.tags || []).forEach(function (t) { tags.push(t); (TAG_WORDS[t] || []).forEach(function (w) { tags.push(w); }); });
      var price = a.usd == null ? 'pay on the day' : (a.est ? '~' : '') + money(a.usd);
      var e = entry('tour', id, a.n, p.n + ' · ' + price, { p: a.p, c: p.c, act: id });
      list.push(finish(e, [p.n, countryName(p.c), a.cat === 'night' ? 'night out' : a.cat, 'tour', 'activity'].concat((MM.PLACE_TERMS && MM.PLACE_TERMS[a.p]) || []), tags));
    });
    (MM.ALL_IN || []).forEach(function (t) {
      var e = entry('allin', t.id, 'ALL IN ' + t.n, t.days + ' days · from ' + money(t.usd) + (t.status === 'soon' ? ' · launching soon' : ''), { trip: t.id });
      list.push(finish(e, [t.tag, t.kicker, 'crew trip', 'group trip', 'package', 'tour', 'guided']));
    });
    (MM.CLASSICS || []).forEach(function (c) {
      var names = c.stops.map(function (s) { return P()[s.p] ? P()[s.p].n : ''; }), e = entry('route', c.id, c.n, 'A classic route · ' + names.slice(0, 3).join(' → ') + (names.length > 3 ? ' → …' : ''), { route: c.id });
      list.push(finish(e, names.concat([c.tag, c.tags || '', 'route', 'itinerary', 'classic'])));
    });
    (MM.THEMES || []).forEach(function (t) {
      var e = entry('theme', t.id, t.n, 'A route the crew recommends · ' + t.tag, { theme: t.id });
      list.push(finish(e, [t.tag, t.blurb, 'vibe', 'route', 'itinerary'].concat(t.route.map(function (x) { return P()[x[0]] ? P()[x[0]].n : ''; }))));
    });
    return list;
  }

  // How well one entry matches the words typed (0 = it doesn't). Every word has to match something, and two words can't both lean on the same word of the name.
  function scoreEntry(e, tokens, whole) {
    if (e.aliases.indexOf(whole) > -1) return 150 + e.bias;                        // "ho chi minh", "bali", "angkor": what they typed IS a name for it
    var total = 0, usedW = {};
    for (var i = 0; i < tokens.length; i++) {
      var tk = tokens[i], s = 0, wi = -1, short = tk.length <= 2 && tokens.length === 1;
      if (short && e.kind !== 'place' && e.kind !== 'country') return 0;           // "th" or "la" is the start of a place, not of half the tours
      if (e.t === tk) s = 100;
      else if (e.t.indexOf(tk) === 0 && !usedW[0]) { s = 80 * (0.5 + 0.5 * tk.length / e.t.length); wi = 0; }        // the closer to the whole name, the better
      else {
        for (var k = 0; k < e.w.length; k++) if (!usedW[k] && e.w[k].indexOf(tk) === 0) { s = 60 * (0.4 + 0.6 * tk.length / e.w[k].length); wi = k; break; }
        if (!s && !short) {
          if (e.aliases.some(function (a) { return a === tk; })) s = 70;
          else if (tk.length >= 4 && e.t.indexOf(tk) > -1 && tokens.length === 1) s = 35;
          else if (e.kwText.indexOf(' ' + tk + ' ') > -1) s = 30;
          else if (e.kwText.indexOf(' ' + tk) > -1) s = tk.length <= 4 ? 12 : 20;
          else if (e.tagText.indexOf(' ' + tk + ' ') > -1 || e.tagText.indexOf(' ' + tk) > -1) s = 14;
          else if (tk.length >= 3 && e.kwText.indexOf(tk) > -1) s = 8;
        }
      }
      if (!s) return 0;
      if (wi >= 0) usedW[wi] = 1; total += s;
    }
    // the phrase as a whole: the start of the name, whole words inside it, or the start of a word in it ("viet" in "ALL IN Vietnam")
    if (e.t.indexOf(whole) === 0) total += 20; else if ((' ' + e.t + ' ').indexOf(' ' + whole + ' ') > -1) total += 14 * tokens.length; else if ((' ' + e.t).indexOf(' ' + whole) > -1) total += 12;
    if (whole.indexOf(' ') > -1 && (' ' + e.t).indexOf(' ' + whole) > -1) total += 60;                                     // a phrase that appears in the name beats a lookalike word ("phi phi" is not Philippines)
    return total / tokens.length + e.bias;
  }
  function lev(a, b, max) {                                   // edit distance, bailing out above max
    if (Math.abs(a.length - b.length) > max) return max + 1;
    var prev = [], cur, i, j; for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur = [i]; var best = i;
      for (j = 1; j <= b.length; j++) { cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1)); if (cur[j] < best) best = cur[j]; }
      if (best > max) return max + 1; prev = cur;
    }
    return prev[b.length];
  }
  function typo(q, list) {
    var qc = q.replace(/ /g, ''); if (qc.length < 4) return [];
    var max = qc.length >= 7 ? 2 : 1, out = [];
    list.forEach(function (e) {
      if (e.kind === 'tour') return;                           // names of places and trips only: a typo in a tour name is too vague
      var cands = [e.c].concat(e.w.filter(function (w) { return w.length >= 4; }), e.aliases.map(function (a) { return a.replace(/ /g, ''); }));
      var best = 9; cands.forEach(function (c) { var pre = c.slice(0, qc.length + 1); var d = Math.min(lev(qc, c, max), lev(qc, pre, max)); if (d < best) best = d; });
      if (best <= max) out.push({ e: e, s: 40 - best * 10 + e.bias });
    });
    return out;
  }
  function present(e, score) {
    var o = { kind: e.kind, id: e.id, title: e.title, sub: e.sub, tag: e.tag, score: Math.round(score * 10) / 10 };
    ['p', 'c', 'act', 'trip', 'route', 'theme'].forEach(function (k) { if (e[k] && !(k === 'c' && e.kind === 'country')) o[k] = e[k]; });
    if (e.kind === 'country') o.c = e.id;
    return o;
  }

  MM.search = function (query, opts) {
    if (!index) index = build();
    var q = norm(query); if (q.length < 2) return [];
    var limit = (opts && opts.limit) || 8, tokens = uniq(words(q)), qc = q.replace(/ /g, ''), hits = [];
    index.forEach(function (e) {
      var s = scoreEntry(e, tokens, q);
      if (!s && qc.length >= 3 && tokens.length > 1) {                         // "hoian", "siemreap": the name with the spaces left out
        if (e.c.indexOf(qc) === 0) s = 65 + e.bias; else if (e.aliases.some(function (a) { return a.replace(/ /g, '').indexOf(qc) === 0; })) s = 55 + e.bias;
      } else if (!s && qc.length >= 4 && e.kind !== 'tour' && e.c.indexOf(qc) === 0) s = 50 + e.bias;
      if (s > 0) hits.push({ e: e, s: s });
    });
    if (!hits.length) hits = typo(q, index);
    hits.sort(function (a, b) { return b.s - a.s || a.e.title.length - b.e.title.length || (a.e.title < b.e.title ? -1 : 1); });
    // a mix, not forty tours: at most 5 places and countries, 4 tours and 3 of anything else
    var caps = { place: 5, country: 3, tour: 4, allin: 2, route: 2, theme: 2 }, used = {}, out = [];
    hits.forEach(function (h) {
      if (out.length >= limit) return; var k = h.e.kind;
      if ((used[k] || 0) >= caps[k]) return; used[k] = (used[k] || 0) + 1; out.push(present(h.e, h.s));
    });
    return out;
  };

  MM.searchHints = function () {
    if (!index) index = build();
    var out = index.filter(function (e) { return e.kind === 'country'; }).map(function (e) { return present(e, 100); });
    ['party', 'surfdive'].forEach(function (id) { var e = index.filter(function (x) { return x.kind === 'theme' && x.id === id; })[0]; if (e) out.push(present(e, 50)); });
    return out;
  };
  MM.searchTagName = function (t) { return TAG_NAME[t] || t; };
  MM._searchReset = function () { index = null; };       // for tests that change the data

  if (typeof module !== 'undefined') module.exports = { norm: norm };
})(typeof window !== 'undefined' ? window : globalThis);
