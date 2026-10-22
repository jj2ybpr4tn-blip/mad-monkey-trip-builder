/* ============================================================
   TRIP CHAT: the logic behind "chat to change your trip". No screen code in here (that's ui-chat.js), so it runs in Node tests too.

     MM.chat.local(text, state)        -> { reply, state?, changes?, action? }   the simple helper: short instructions in plain words, no AI needed
     MM.chat.newConv()                 -> a fresh conversation (what the AI has been told so far)
     MM.chat.send(conv, text, ctx)     -> Promise<{ reply, mode, edits[], ... }>  one message to the AI, running its tool calls against the trip
     MM.chat.stateText / MM.chat.helpText   copy for the screen

   The AI itself lives behind MM_CONFIG.CHAT_ENDPOINT (an Edge Function that holds the key, the system prompt and the tools: chat-spec.json).
   This file only ever sends it the conversation. The AI changes the trip with edit_trip, and edit_trip is MM.edit.apply: the same validated
   operations the buttons use, so the AI can't do anything a traveller couldn't, and every change can be undone.
   ============================================================ */
(function (r) {
  var MM = r.MM = r.MM || {}, E = MM.edit, U = MM.util;
  function norm(s) { return String(s == null ? '' : s).toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim(); }
  function money(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
  function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }
  function pname(id) { return MM.PLACES[id].n; }
  MM.chat = { MAX_ROUNDS: 6, MAX_MESSAGES: 40 };

  /* ---------- the simple helper ---------- */
  var NUM = { a: 1, an: 1, one: 1, another: 1, two: 2, couple: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 }, ORD = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8 };
  var MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  var STOPW = { the: 1, and: 1, tour: 1, trip: 1, day: 1, half: 1, full: 1, with: 1, for: 1, from: 1 };
  function idxOf(S, id) { for (var i = 0; i < S.items.length; i++) if (S.items[i].kind === 'stop' && S.items[i].p === id) return i; return -1; }
  function num(s) { return /^\d+$/.test(s) ? +s : NUM[s]; }
  function totalsLine(st) { var T = MM.plan(st).totals; return 'That is ' + plural(T.days, 'day') + ' now, about ' + money(T.total) + ' a person.'; }
  function tidyErr(e) { return String(e).replace(/^Change \d+ \([a-z_]+\): /, ''); }

  // The tour (at the given stops' places) that a bit of text is talking about. A tour matches when the text has two of its distinctive words, or one that no other tour
  // at that place uses ("cooking", "bike"). Two tours matching equally well is a tie, and a tie is a question, not a guess.
  function findTour(n, stops, S, onlyPicked) {
    var best = null, tie = false, padded = ' ' + n + ' ';
    stops.forEach(function (i) {
      var it = S.items[i]; if (!it || it.kind !== 'stop') return;
      var pool = MM.actsAt(it.p), freq = {}, words = function (a) { return norm(a.n).split(' ').filter(function (w) { return w.length > 2 && !STOPW[w]; }); };
      pool.forEach(function (a) { words(a).filter(function (w, k, arr) { return arr.indexOf(w) === k; }).forEach(function (w) { freq[w] = (freq[w] || 0) + 1; }); });
      (onlyPicked ? (it.acts || []).map(function (id) { return MM.ACTS[id]; }) : pool).forEach(function (a) {
        if (!a) return;
        var hit = words(a).filter(function (w) { return padded.indexOf(' ' + w) > -1; });
        if (!hit.length || (hit.length < 2 && !(hit[0].length >= 4 && freq[hit[0]] === 1))) return;
        var sc = hit.reduce(function (t, w) { return t + 1 / (freq[w] || 1); }, 0);
        if (!best || sc > best.sc + 1e-9) { best = { id: a.id, i: i, sc: sc, n: a.n }; tie = false; } else if (Math.abs(sc - best.sc) < 1e-9 && a.id !== best.id) tie = true;
      });
    });
    return tie ? { ambiguous: true } : best;
  }

  function parseDate(raw, today) {
    var t = String(raw).toLowerCase(), m, y, mo, d, iso = t.match(/(\d{4})-(\d{2})-(\d{2})/); if (iso) return iso[0];
    if ((m = t.match(/\b(\d{1,2})(?:st|nd|rd|th)?(?: of)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?(?:,?\s+(\d{4}))?/))) { d = +m[1]; mo = MONTHS[m[2]]; y = m[3] ? +m[3] : 0; }
    else if ((m = t.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b(?:,?\s+(\d{4}))?/))) { mo = MONTHS[m[1]]; d = +m[2]; y = m[3] ? +m[3] : 0; }
    else return null;
    var now = today || new Date(); if (!y) { y = now.getFullYear(); if (new Date(Date.UTC(y, mo - 1, d)) < new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))) y++; }
    if (d < 1 || d > 31) return null;
    return y + '-' + (mo < 10 ? '0' : '') + mo + '-' + (d < 10 ? '0' : '') + d;
  }

  MM.chat.helpText = 'I can do short instructions: "remove Hoi An", "add Bangkok for 3 nights", "swap Hanoi for Bangkok", "move Hoi An to the start", "2 more nights in Hanoi", "add the cooking class in Hoi An", "start on 3 March", "cheapest way", "budget $1500". Or tap Undo any time.';

  function localOne(text, state, today) {
    var S = JSON.parse(JSON.stringify(state || MM.defaultState())), raw = String(text || ''), n = norm(raw), pad = ' ' + n + ' ';
    var men = E.mentions(raw), inTrip = men.filter(function (m) { return idxOf(S, m.id) > -1; }), outTrip = men.filter(function (m) { return idxOf(S, m.id) < 0; });
    function R(reply, extra) { var o = { reply: reply }; for (var k in extra) o[k] = extra[k]; return o; }
    function go(ops, lead) {
      var res = E.apply(S, ops); if (!res.ok) return R(tidyErr(res.errors[0]));
      return R((lead ? lead + ' ' : '') + res.changes.join('. ') + '. ' + totalsLine(res.state), { state: res.state, changes: res.changes });
    }
    function has(re) { return re.test(pad); }
    var cnt = (n.match(/\b(\d+|a|an|one|another|two|couple|three|four|five|six|seven|eight|nine|ten)\s+(?:more |extra |additional |less |fewer )?nights?\b/) || [])[1];
    var N = cnt ? num(cnt) : null, more = has(/ (more|extra|additional|another|longer|add) /), less = has(/ (less|fewer|shorter|cut|remove|drop|take off|take away|lose|minus) /);

    // which stop is being talked about: a place that's in the trip, "stop 2", "the second one", "the last stop"
    function target() {
      if (inTrip.length) return idxOf(S, inTrip[0].id);
      var m = n.match(/\bstop (\d+)\b/); if (m) return +m[1] - 1;
      m = n.match(/\b(first|second|third|fourth|fifth|sixth|seventh|eighth)\b/); if (m) return ORD[m[1]] - 1;
      if (has(/ (last|final) /)) return S.items.length - 1;
      return S.items.length === 1 ? 0 : -1;
    }
    function which(what) { return R('Which stop do you mean? ' + (S.items.length ? 'You have ' + S.items.map(function (it, i) { return (i + 1) + ' ' + (it.kind === 'allin' ? 'ALL IN' : pname(it.p)); }).join(', ') + '.' : 'Your trip has no stops yet.')); }

    if (!n) return R(MM.chat.helpText);
    if (/^(undo|undo that|go back|revert|put it back|take that back)\b/.test(n)) return R('Undone.', { action: 'undo' });
    if (/^redo\b/.test(n)) return R('Redone.', { action: 'redo' });
    if (has(/ (start over|clear everything|clear it all|clear the trip|scrap it all|scrap everything|empty the trip|wipe it) /)) return S.items.length ? go([{ op: 'clear' }], 'Done.') : R('Your trip is already empty.');

    // how much / what's in it
    if (has(/ (summary|summarise|summarize|overview|what s in|whats in|how much|total cost|what does it cost|what will it cost|my trip) /) && !has(/ (add|remove|swap|move|delete|drop|replace) /)) {
      if (!S.items.length) return R('Your trip is empty. Try "add Bangkok" to begin.');
      var pl = MM.plan(S); return R(S.items.map(function (it, i) { return (i + 1) + '. ' + (it.kind === 'allin' ? 'ALL IN ' + (MM.ALL_IN.filter(function (t) { return t.id === it.trip; })[0] || {}).n : pname(it.p) + ' (' + plural(it.n, 'night') + ')'); }).join('\n') + '\n' + plural(pl.totals.days, 'day') + ', about ' + money(pl.totals.total) + ' a person with beds, tours, travel and spending money.');
    }

    // swap one place for another
    if (has(/ (swap|replace|switch|change|instead of) /) && men.length >= 2 && inTrip.length >= 1 && has(/ (for|with|to|into|instead of) /)) {
      var oldP, newP, io = pad.indexOf(' instead of ');
      if (io > -1) { newP = men.filter(function (m) { return m.at < io; })[0]; oldP = men.filter(function (m) { return m.at > io; })[0]; }
      else { oldP = inTrip[0]; newP = men.filter(function (m) { return m.id !== oldP.id && idxOf(S, m.id) < 0; })[0] || men.filter(function (m) { return m.id !== oldP.id; })[0]; }
      if (oldP && newP && idxOf(S, oldP.id) > -1) return go([{ op: 'swap_stop', stop: idxOf(S, oldP.id) + 1, place: newP.id }]);
    }

    // put a tour on another day
    var dayM = n.match(/\bday (\d+)\b/);
    if (dayM && has(/ (move|put|shift|do|have|schedule) /)) {
      var tm = findTour(n, S.items.map(function (_, i) { return i; }), S, true);
      if (tm && tm.id) return go([{ op: 'move_tour', stop: tm.i + 1, tour: tm.id, day: +dayM[1] }]);
    }

    // reorder
    if (has(/ (move|put|shift|bring|send|reorder) /) && S.items.length > 1 && (inTrip.length || has(/ (stop|first|last) /))) {
      var i = target(), to = null, other = inTrip[1] ? idxOf(S, inTrip[1].id) : -1;
      if (i < 0) return which();
      if (has(/ (first|start|beginning|front|top) /) && !has(/ (after|before) /)) to = 1;
      else if (has(/ (last|end|back|bottom) /) && !has(/ (after|before) /)) to = S.items.length;
      else if (other > -1 && has(/ after /)) to = i < other ? other + 1 : other + 2;
      else if (other > -1 && has(/ before /)) to = i < other ? other : other + 1;
      else { var pn = n.match(/\b(?:position|spot|number) (\d+)\b/); if (pn) to = +pn[1]; }
      if (to) return go([{ op: 'move_stop', stop: i + 1, to: to }]);
    }

    // nights
    var newPlaceNights = N && outTrip.length && !inTrip.length;       // "3 nights in Kampot": a new stop, not a change to an existing one
    if ((N || has(/ (longer|shorter|more time|less time|extra night|one more night|another night) /)) && !newPlaceNights) {
      var k = target();
      if (k >= 0 && S.items[k] && S.items[k].kind === 'stop') {
        var cur = S.items[k].n, nn;
        if (N && more && !less) nn = cur + N; else if (N && less) nn = cur - N; else if (N) nn = N; else nn = cur + (less ? -1 : 1);
        return go([{ op: 'set_nights', stop: k + 1, nights: Math.max(1, nn) }]);
      }
      if (k < 0 && (N || has(/ (longer|shorter|more time|less time|extra night|one more night|another night) /))) return which();
    }

    // remove: a tour or a whole stop
    if (has(/ (remove|delete|drop|cut|take out|get rid of|ditch|skip|scrap|lose|cancel|no more) /)) {
      var stops = inTrip.length ? [idxOf(S, inTrip[0].id)] : S.items.map(function (_, i) { return i; }), tr = findTour(n, stops, S, true);
      if (tr && tr.id) return go([{ op: 'remove_tour', stop: tr.i + 1, tour: tr.id }]);
      if (tr && tr.ambiguous) return R('More than one of your tours matches that. Which one?');
      if (inTrip.length > 1) return R('I take out one stop at a time, so there\'s no mix-up. Say "remove ' + pname(inTrip[0].id) + '" and then "remove ' + pname(inTrip[1].id) + '".');
      var rk = target(); if (rk >= 0 && S.items[rk]) return go([{ op: 'remove_stop', stop: rk + 1 }]);
      if (!S.items.length) return R('Your trip is empty, so there is nothing to remove.');
      if (outTrip.length) return R(pname(outTrip[0].id) + ' isn\'t in your trip.');
      return which();
    }

    // add: a tour at a stop you have, or a new place
    if (newPlaceNights || has(/ (add|include|put in|stick in|throw in|squeeze in|fit in|visit|go to|stop at|stop in|pop in|head to|take me to|i want|i d like|let s do|can i have|more) /)) {
      var all = inTrip.length ? [idxOf(S, inTrip[0].id)] : S.items.map(function (_, i) { return i; }), ta = findTour(n, all, S, false);
      if (ta && ta.id && (S.items[ta.i].acts || []).indexOf(ta.id) < 0) return go([{ op: 'add_tour', stop: ta.i + 1, tour: ta.id }]);
      if (ta && ta.id) return R(MM.ACTS[ta.id].n + ' is already in your trip.');
      if (outTrip.length) {
        var np = outTrip[0].id, pos = null, ref = inTrip[0] ? idxOf(S, inTrip[0].id) : -1;
        if (has(/ (first|start|beginning|front|top) /) && ref < 0) pos = 1;
        else if (ref > -1 && has(/ after /)) pos = ref + 2; else if (ref > -1 && has(/ before /)) pos = ref + 1;
        if (outTrip.length > 1 && !pos && !N) return go(outTrip.map(function (m) { return { op: 'add_stop', place: m.id }; }));      // "add Bangkok and Chiang Mai"
        var op = { op: 'add_stop', place: np }; if (N) op.nights = N; if (pos) op.position = pos;
        return go([op]);
      }
      if (inTrip.length) return R(pname(inTrip[0].id) + ' is already stop ' + (idxOf(S, inTrip[0].id) + 1) + '. Want more nights there? Try "2 more nights in ' + pname(inTrip[0].id) + '".');
    }

    // start date
    var dt = parseDate(raw, today);
    if (dt && has(/ (start|starting|begin|beginning|leave|leaving|depart|departing|go|fly|flying|date|from) /)) return go([{ op: 'set_start', date: dt }]);

    // style, budget, spending money
    var bm = raw.match(/budget[^\d$]{0,20}\$?\s?(\d[\d,]*)\s?(k)?/i) || raw.match(/\$\s?(\d[\d,]*)\s?(k)?\s*(?:budget|total|max|limit)/i) || raw.match(/\bunder\s+\$?\s?(\d[\d,]*)\s?(k)?/i);
    if (bm) return go([{ op: 'set_budget', amount: parseInt(bm[1].replace(/,/g, ''), 10) * (bm[2] ? 1000 : 1) }]);
    var sm = raw.match(/\$?\s?(\d+)\s*(?:a|per|\/)\s*day/i);
    if (sm && has(/ (spending|spend|food|fun|pocket|money|fund) /)) return go([{ op: 'set_spending', per_day: +sm[1] }]);
    if (has(/ (cheapest|cheaper|cheap|save money|saving) /)) return go([{ op: 'set_style', style: 'cheapest' }]);
    if (has(/ (fastest|quickest|faster|quicker|fewer hours) /)) return go([{ op: 'set_style', style: 'fastest' }]);
    if (has(/ (smart|balanced|best value) /)) return go([{ op: 'set_style', style: 'smart' }]);

    return R('I didn\'t catch that. ' + MM.chat.helpText);
  }

  // "swap Hoi An for Bangkok and 2 more nights in Hanoi": several instructions in one message are done in order, but only when every one of them is understood
  // (otherwise nothing is half done: the whole message is read as one instruction).
  MM.chat.local = function (text, state, today) {
    var parts = String(text || '').split(/\s*(?:[,;]|\b(?:and then|and also|and|then|also|plus)\b)\s*/i).map(function (x) { return x.trim(); }).filter(Boolean);
    if (parts.length > 1 && parts.length <= 6) {
      var st = state || MM.defaultState(), changes = [], all = true;
      for (var i = 0; i < parts.length && all; i++) { var r = localOne(parts[i], st, today); if (r.state) { st = r.state; changes = changes.concat(r.changes); } else all = false; }
      if (all) return { reply: 'Done. ' + changes.join('. ') + '. ' + totalsLine(st), state: st, changes: changes };
    }
    return localOne(text, state, today);
  };

  /* ---------- the AI conversation ---------- */
  MM.chat.newConv = function () { return { api: [], seen: null, today: null }; };
  function textOf(content) { return (content || []).filter(function (b) { return b && b.type === 'text'; }).map(function (b) { return b.text; }).join('\n').trim(); }

  // ctx: { endpoint, post(url, body) -> Promise<{ status, body }>, getState(), setState(state, changes), today?: 'YYYY-MM-DD' }
  MM.chat.send = function (conv, text, ctx) {
    var mark = conv.api.length, edits = [], rounds = 0, wasSeen = conv.seen, wasToday = conv.today;
    if (conv.api.length >= MM.chat.MAX_MESSAGES) return Promise.resolve({ mode: 'ai', reply: 'This chat has got long. Start a fresh one with "New chat" and I\'ll pick up your trip as it is now.', full: true, edits: edits });
    var snap = E.snapshot(ctx.getState()), lead = '';
    if (!conv.today) { conv.today = ctx.today || U.isoDate(new Date()); lead += 'Today\'s date is ' + conv.today + '.\n\n'; }
    if (snap !== conv.seen) lead += '<trip_state>\n' + snap + '\n</trip_state>\n\n';
    conv.api.push({ role: 'user', content: [{ type: 'text', text: lead + text }] }); conv.seen = snap;
    function undoTurn() { conv.api.length = mark; conv.seen = wasSeen; conv.today = wasToday; }     // a failed turn leaves no trace, so the history the AI sees stays exactly what it said and was told

    function step() {
      if (++rounds > MM.chat.MAX_ROUNDS) { undoTurn(); return Promise.resolve({ mode: 'ai', error: 'busy', reply: 'That took too many steps. Try asking for one thing at a time.', edits: edits }); }
      return ctx.post(ctx.endpoint, { messages: conv.api }).then(function (res) {
        var b = res && res.body || {};
        if (!res || res.status !== 200 || !Array.isArray(b.content)) {
          undoTurn();
          return { mode: 'ai', error: res && res.status === 429 ? 'limit' : 'down', status: res && res.status, retryAfter: b.retry_after, reply: b.error || '', edits: edits };
        }
        if (b.stop_reason === 'refusal') { undoTurn(); return { mode: 'ai', refused: true, reply: 'I can\'t help with that one. I\'m here for your trip: ask me to add, remove, move or swap things.', edits: edits }; }
        conv.api.push({ role: 'assistant', content: b.content });
        var uses = b.content.filter(function (x) { return x && x.type === 'tool_use'; });
        if (b.stop_reason !== 'tool_use' || !uses.length) {
          var out = textOf(b.content);
          if (b.stop_reason === 'max_tokens') out = (out ? out + '\n\n' : '') + '(I ran out of room there. Ask again and I\'ll keep it shorter.)';
          return { mode: 'ai', reply: out || 'Done.', edits: edits, usage: b.usage };
        }
        var results = uses.map(function (u) {
          var before = ctx.getState(), run = E.run(u.name, u.input, before), isErr = !!(run.result && (run.result.error || run.result.ok === false));
          if (run.state !== before && !isErr) { ctx.setState(run.state, run.result.changes || []); edits.push({ changes: run.result.changes || [], total: run.result.total_usd, was: run.result.was_usd, days: run.result.days }); conv.seen = E.snapshot(run.state); }
          return { type: 'tool_result', tool_use_id: u.id, content: typeof run.result === 'string' ? run.result : JSON.stringify(run.result), is_error: isErr };
        });
        conv.api.push({ role: 'user', content: results });
        return step();
      }, function () { undoTurn(); return { mode: 'ai', error: 'down', reply: '', edits: edits }; });
    }
    return step();
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = MM;
})(typeof window !== 'undefined' ? window : globalThis);
