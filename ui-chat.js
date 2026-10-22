/* ============================================================
   TRIP CHAT (screen): a panel beside the trip where the traveller says what to change and watches it happen.
   The logic is in chat.js. With MM_CONFIG.CHAT_ENDPOINT set it is the AI assistant; without it (or if the AI can't be reached) it is the
   quick helper, which understands short instructions. Either way every change goes through MM.edit, shows what it changed, and can be undone.
   ============================================================ */
(function () {
  var A = window.MMApp, MM = window.MM, C = window.MM_CONFIG || {}, u = A.util, esc = u.esc, $ = u.$, T = MM.chat;
  var conv = T.newConv(), log = [], busy = false, aiDown = false, root, fab;
  var aiOn = function () { return !!C.CHAT_ENDPOINT && !aiDown; };
  var isOpen = function () { return document.body.classList.contains('chat-open'); };

  /* ---------- talking to the server ---------- */
  function post(url, body) {
    var ctl = typeof AbortController === 'function' ? new AbortController() : null, timer = ctl ? setTimeout(function () { ctl.abort(); }, 100000) : null;
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctl ? ctl.signal : undefined })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (b) { return { status: r.status, body: b }; }); })
      .then(function (x) { if (timer) clearTimeout(timer); return x; }, function (e) { if (timer) clearTimeout(timer); throw e; });
  }

  /* ---------- what is shown ---------- */
  function para(t) { return esc(t).replace(/\n/g, '<br>'); }
  function chipsFor() {
    var st = A.state, items = st.items.filter(function (it) { return it.kind === 'stop'; }), first = items[0] && MM.PLACES[items[0].p], last = items.length ? MM.PLACES[items[items.length - 1].p] : null;
    if (aiOn()) {
      if (!st.items.length) return ['Two weeks in Vietnam, mostly beaches and food', 'Start in Bangkok and head north', 'A relaxed trip to Bali and the Gilis'];
      return ['Make it cheaper', 'Add a beach stop at the end', 'More time in ' + (first ? first.n : 'my first stop'), 'What would you cut to save a day?', 'Add a cooking class'];
    }
    if (!st.items.length) return ['Add Bangkok', 'Add Hanoi for 4 nights', 'Add Bali'];
    var c = [];
    if (last) c.push('Remove ' + last.n); if (first) c.push('2 more nights in ' + first.n); c.push('Cheapest way'); c.push('What does it cost?'); c.push('Add Bangkok first');
    return c;
  }
  function render() {
    var l = $('.chat__log', root); if (!l) return;
    var h = '';
    if (!log.length) h += '<div class="cmsg cmsg--bot">' + (aiOn() ? 'Tell me what you want to change and I\'ll do it: swap a stop, give a place more nights, drop a tour, move things around, bring the price down. You can undo anything.' : 'Tell me what to change in short instructions, like "remove Hoi An", "add Bangkok for 3 nights" or "swap Hanoi for Bangkok". You can undo anything.') + '</div>';
    log.forEach(function (m, i) {
      if (m.k === 'me') h += '<div class="cmsg cmsg--me">' + para(m.text) + '</div>';
      else if (m.k === 'bot') h += '<div class="cmsg cmsg--bot">' + para(m.text) + '</div>';
      else if (m.k === 'note') h += '<div class="cmsg cmsg--note">' + esc(m.text) + '</div>';
      else if (m.k === 'chg') h += '<div class="cchg">' + (m.list ? '<div class="over">Changed in your trip</div><ul>' + m.changes.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ul>' : '') +
        (m.live ? '<button class="btn btn--sm btn--paper" type="button" data-act="chatundo" data-i="' + i + '">↶ Undo' + (m.list ? ' these' : '') + '</button>' : m.undone ? '<span class="cchg__done">Undone</span>' : '') + '</div>';
    });
    if (busy) h += '<div class="cmsg cmsg--bot cmsg--typing" role="status" aria-label="Thinking"><i></i><i></i><i></i></div>';
    l.innerHTML = h; l.scrollTop = l.scrollHeight;
    $('.chat__chips', root).innerHTML = log.length ? '' : chipsFor().map(function (t) { return '<button class="chip" type="button" data-act="chatchip" data-t="' + esc(t) + '">' + esc(t) + '</button>'; }).join('');
    $('.chat__sub', root).textContent = aiOn() ? 'AI assistant · changes your trip as you chat' : 'Quick helper · short instructions';
    $('.chat__note', root).innerHTML = aiOn() ? 'Your messages and trip are sent to an AI service to write the answers. Please don\'t share passport or payment details.' + (C.PRIVACY_URL ? ' <a href="' + esc(C.PRIVACY_URL) + '" target="_blank" rel="noopener">Privacy</a>' : '') : 'Anything you change here can be undone.';
    updateSend();
  }
  function updateSend() { var t = $('#chat-in', root), b = $('.chat__send', root); if (b) b.disabled = busy || !(t && t.value.trim()); }     // nothing to send, nothing to press
  function build() {
    root = document.createElement('aside'); root.className = 'chat'; root.id = 'chat'; root.hidden = true; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Chat to change your trip');
    root.innerHTML = '<div class="chat__hd"><div><div class="over">Trip chat</div><h2 class="disp">Make it yours</h2><p class="chat__sub"></p></div><div class="chat__tools"><button class="btn btn--sm btn--paper" type="button" data-act="chatnew">New chat</button><button class="iconbtn" type="button" data-act="chatclose" aria-label="Close the chat">×</button></div></div>' +
      '<div class="chat__log" role="log" aria-live="polite"></div><div class="chat__chips" data-scroll="1"></div>' +
      '<form class="chat__form" autocomplete="off"><label class="sr" for="chat-in">Your message</label><textarea id="chat-in" class="input" rows="1" maxlength="1000" placeholder="Ask for a change…"></textarea><button class="btn btn--pink chat__send" type="submit">Send</button></form><p class="chat__note"></p>';
    document.body.appendChild(root);
    fab = document.createElement('button'); fab.type = 'button'; fab.className = 'btn btn--pink chatfab'; fab.setAttribute('data-act', 'chat'); fab.textContent = 'Chat to change it'; document.body.appendChild(fab);
    root.querySelector('form').addEventListener('submit', function (e) { e.preventDefault(); var t = $('#chat-in', root); var v = t.value.trim(); if (v) { t.value = ''; t.style.height = ''; send(v); } updateSend(); });
    var ta = $('#chat-in', root);
    ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); root.querySelector('form').requestSubmit ? root.querySelector('form').requestSubmit() : $('.chat__send', root).click(); } });
    ta.addEventListener('input', function () { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight + 6, 120) + 'px'; updateSend(); });
    render();
  }

  /* ---------- open / close ---------- */
  function open() { if (!root) build(); root.hidden = false; document.body.classList.add('chat-open'); render(); setTimeout(function () { var t = $('#chat-in', root); if (t) t.focus(); }, 30); u.track('chat_open', { mode: aiOn() ? 'ai' : 'helper' }); }
  function close() { if (!root) return; root.hidden = true; document.body.classList.remove('chat-open'); if (fab && document.body.getAttribute('data-view') === 'build') fab.focus(); }

  /* ---------- sending ---------- */
  function note(t) { log.push({ k: 'note', text: t }); }
  function receipt(changes, steps, list) {
    log.forEach(function (m) { if (m.k === 'chg') m.live = false; });          // only the latest change can be taken back from here (history is a line)
    log.push({ k: 'chg', changes: changes, n: steps, after: A.hist.cur, live: true, list: list });
  }
  function viaHelper(text) {
    var res = T.local(text, A.state);
    if (res.action === 'undo') { var did = A.undo(); log.push({ k: 'bot', text: did ? 'Undone.' : 'There is nothing to undo.' }); return; }
    if (res.action === 'redo') { var did2 = A.redo(); log.push({ k: 'bot', text: did2 ? 'Redone.' : 'There is nothing to redo.' }); return; }
    log.push({ k: 'bot', text: res.reply });
    if (res.state) { A.commit(res.state, '', true); receipt(res.changes || [], 1, false); }
  }
  function send(text) {
    if (busy) return; log.push({ k: 'me', text: text }); busy = true; render();
    u.track('chat_send', { mode: aiOn() ? 'ai' : 'helper' });
    if (!aiOn()) { try { viaHelper(text); } catch (e) { log.push({ k: 'bot', text: 'Sorry, I couldn\'t do that one. Try the buttons on your trip.' }); } busy = false; render(); return; }
    var steps = 0;
    (function run(retried) {
      return T.send(conv, text, { endpoint: C.CHAT_ENDPOINT, post: post, getState: function () { return A.state; }, setState: function (s) { steps++; A.commit(s, '', true); } }).then(function (r) {
        if (r.error === 'down' && r.status === 422 && !retried && !r.edits.length) { conv = T.newConv(); return run(true); }   // the server couldn't read our history: start the conversation again, once, with the trip as it is now
        if (r.error === 'down' && !r.edits.length) {
          if (r.status === 404 || r.status === 503 || r.status === 401) aiDown = true;          // not switched on: use the helper for the rest of the visit
          note(aiDown ? 'The AI isn\'t switched on here, so I\'m using the quick helper.' : 'I couldn\'t reach the AI just now, so I\'m using the quick helper for this one.');
          try { viaHelper(text); } catch (e) { log.push({ k: 'bot', text: 'Sorry, I couldn\'t do that one.' }); }
        } else if (r.error === 'limit') {
          log.push({ k: 'bot', text: (r.reply || 'The assistant is busy right now.') + (r.retryAfter && r.retryAfter < 600 ? ' Try again in ' + (r.retryAfter < 90 ? 'a minute' : Math.ceil(r.retryAfter / 60) + ' minutes') + '.' : '') + (/quick helper/.test(r.reply || '') ? '' : ' The quick helper still works: try "remove Hoi An".') });
        } else {
          if (r.edits.length) receipt([].concat.apply([], r.edits.map(function (e) { return e.changes; })), steps, true);
          if (r.reply) log.splice(r.edits.length ? log.length - 1 : log.length, 0, { k: 'bot', text: r.reply });
          else if (!r.edits.length) log.push({ k: 'bot', text: 'Sorry, I couldn\'t do that one.' });
        }
      });
    })(false).catch(function () { log.push({ k: 'bot', text: 'Something went wrong on my side. Your trip is as it was.' }); }).then(function () { busy = false; render(); });
  }

  /* ---------- buttons ---------- */
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]'); if (!el) return; var act = el.getAttribute('data-act');
    if (act === 'chat') { if (isOpen()) close(); else open(); }
    else if (act === 'chatclose') close();
    else if (act === 'chatnew') { if (busy) return; conv = T.newConv(); log = []; render(); var t = $('#chat-in', root); if (t) t.focus(); }
    else if (act === 'chatchip') { if (!busy) send(el.getAttribute('data-t')); }
    else if (act === 'chatundo') {
      var m = log[+el.getAttribute('data-i')]; if (!m || !m.live) return;
      if (A.hist.cur !== m.after) { u.toast('You\'ve changed things since. Use Undo on your trip.'); return; }
      A.undoMany(m.n); m.live = false; m.undone = true; render();
    }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && isOpen() && !document.querySelector('.modal')) close(); });
  window.addEventListener('hashchange', function () { setTimeout(function () { if (document.body.getAttribute('data-view') !== 'build') close(); }, 0); });
  build();
  A.chat = { open: open, close: close, send: send };
})();
