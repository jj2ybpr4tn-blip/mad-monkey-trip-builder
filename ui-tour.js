/* ============================================================
   QUICK TOUR: a short walk around the builder when someone presses "Start building" (and any time from "Show me around").
   It points at the real controls on the real screen. The page underneath stays usable: step 2 asks them to add a stop on the map and carries on
   by itself when they do. Nothing is added or changed for them: it starts from a blank sheet and stays blank.
   ============================================================ */
(function () {
  var A = window.MMApp, u = A.util, esc = u.esc, OFF = 'mm-tour-off';
  var tour = null, root = null;
  var phone = function () { return window.innerWidth < 700; };

  // target: selectors tried in order, first one that's on screen wins. gate: 'stop' waits for a first stop.
  var STEPS = [
    { id: 'welcome', title: 'Build it your way', body: 'This is a blank sheet. Type where you\'re going and add the places you want, and the real bus, boat and flight times and prices appear as you go. Want a 30-second walk around?', primary: 'Show me around', skip: 'No thanks, I\'ll explore', off: true },
    { id: 'map', target: ['.srch--sheet', '#bmap'], title: 'Start with a stop', body: 'Type a city, a country or something to do in the box, or tap a pin on the map to add that Mad Monkey to your trip. Press LIST on the map if you would rather pick from a list.', gate: 'stop', wait: 'Add your first stop to carry on' },
    { id: 'stop', target: ['.stopc', '.blockc'], title: 'Every stop is a card', body: 'Use − and + to change the nights. Swap place changes your mind about where, and Remove stop takes it out. Nothing is final: Undo is always one tap away.' },
    { id: 'add', target: ['.srch--add', '.editbar [data-act="insertat"]', '.addbar__btn'], title: 'Add another stop', body: 'Type a place or a tour here and it goes where it adds the least travel. Or use "+ Add a stop" to choose where it goes: the start, the end or anywhere in between.' },
    { id: 'things', target: ['.stopc__more'], title: 'Pick things to do', body: 'Open "Things to do" to choose tours for each stop. They show up in Day by day, where you can move a tour to another day.' },
    { id: 'summary', target: ['.bsum'], title: 'Dates, budget and travel style', body: 'Set your start date, how you like to travel and a budget. The total and the travel times update as you build.' },
    { id: 'send', target: ['.mbar [data-act="lead"]', '.bsum [data-act="lead"]', '[data-act="lead"]'], title: 'Happy with it? Send it to the crew', body: 'Hold my beds sends your trip to a real person who checks it before you pay anything. You can still change it afterwards.' },
    { id: 'done', title: 'That\'s it', body: 'Start with a search or a pin on the map. You can replay this walk-around any time from "Show me around".', primary: 'Start building' }
  ];

  function visible(el) { if (!el) return false; var r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; }
  function find(step) { if (!step.target) return null; for (var i = 0; i < step.target.length; i++) { var e = document.querySelector(step.target[i]); if (visible(e)) return e; } return null; }
  function hasStop() { return A.state.items.length > 0; }
  function usable(i) { var s = STEPS[i]; return !s.target || s.gate || !!find(s); }   // a step with nothing to point at is skipped

  function build() {
    root = document.createElement('div'); root.className = 'tour'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'false'); root.setAttribute('aria-label', 'Quick tour of the trip builder');
    root.innerHTML = '<div class="tour__dim"></div><div class="tour__ring"></div><div class="tour__card"></div>';
    document.body.appendChild(root);
  }
  function stop(why) {
    if (!tour) return; clearInterval(tour.timer); window.removeEventListener('resize', layout); window.removeEventListener('scroll', layout, true); document.removeEventListener('keydown', onKey, true);
    if (root) { root.remove(); root = null; } document.body.classList.remove('touring');
    u.track('tour_end', { step: STEPS[tour.i] && STEPS[tour.i].id, why: why || 'closed' }); tour = null;
  }
  function onKey(e) { if (e.key === 'Escape') { e.preventDefault(); stop('escape'); } }

  function show(i, dir) {
    dir = dir || 1; while (i > 0 && i < STEPS.length - 1 && !usable(i)) i += dir;
    tour.i = i; var s = STEPS[i], el = find(s), last = i === STEPS.length - 1, first = i === 0, wait = s.gate === 'stop' && !hasStop(); tour.waiting = wait;
    var n = STEPS.length - 2, shown = Math.min(Math.max(i, 1), n);
    var card = root.querySelector('.tour__card');
    card.innerHTML = (!first && !last ? '<div class="over tour__n">Step ' + shown + ' of ' + n + '</div>' : '') +
      '<h2 class="disp">' + esc(s.title) + '</h2><p>' + esc(s.body) + '</p>' + (wait ? '<p class="tour__wait" role="status">' + esc(s.wait) + '</p>' : '') +
      (s.off ? '<label class="tour__off"><input type="checkbox" id="tour-off"> Don\'t show this when I start building</label>' : '') +
      '<div class="tour__btns">' + (first ? '' : '<button class="btn btn--sm btn--ghost" type="button" data-tour="back">Back</button>') +
      '<button class="btn btn--sm btn--pink" type="button" data-tour="next"' + (wait ? ' disabled' : '') + '>' + esc(s.primary || (i === STEPS.length - 2 ? 'Finish' : 'Next')) + '</button>' +
      (last ? '' : '<button class="tour__skip" type="button" data-tour="skip">' + esc(s.skip || 'Skip the tour') + '</button>') + '</div>';
    u.track('tour_step', { step: s.id });
    if (el) { var r = el.getBoundingClientRect(); if (r.top < 70 || r.bottom > window.innerHeight - (phone() ? 100 : 20) || r.height > window.innerHeight * 0.7) window.scrollTo(0, Math.max(0, r.top + window.scrollY - (phone() ? 90 : 100))); }
    layout();
    var b = card.querySelector('[data-tour="next"]'); if (b && !b.disabled) b.focus({ preventScroll: true });
  }

  function layout() {
    if (!tour || !root) return;
    var s = STEPS[tour.i], el = find(s), ring = root.querySelector('.tour__ring'), card = root.querySelector('.tour__card'), dim = root.querySelector('.tour__dim');
    var W = window.innerWidth, H = window.innerHeight, pad = 6;
    if (!el) { ring.style.display = 'none'; dim.style.display = 'block'; card.style.cssText = 'left:50%;top:50%;width:' + Math.min(420, W - 24) + 'px;transform:translate(-50%,-50%)'; return; }
    dim.style.display = 'none'; ring.style.display = 'block';
    var r = el.getBoundingClientRect(), x = Math.max(4, r.left - pad), y = Math.max(4, r.top - pad), w = Math.min(W - 8, r.width + pad * 2), h = Math.min(H - 8, r.height + pad * 2);
    if (r.height > H * 0.9) { y = 4; h = H - 8; }
    ring.style.cssText = 'display:block;left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px';
    if (phone()) { card.style.cssText = 'left:10px;right:10px;width:auto;transform:none;' + (r.top + r.height / 2 > H / 2 ? 'top:66px' : 'bottom:92px'); return; }     // a sheet at the top or bottom, whichever the target isn't under
    var cw = Math.min(360, W - 24), ch = card.offsetHeight || 220, left, top = r.top;
    if (r.left - 18 >= cw) left = r.left - cw - 18;                  // beside it, where there's room
    else if (W - r.right - 18 >= cw) left = r.right + 18;
    else { left = Math.min(Math.max(12, r.left), W - cw - 12); top = r.bottom + 14 + ch < H ? r.bottom + 14 : r.top - ch - 14; }   // otherwise under it, or over it
    left = Math.min(Math.max(12, left), W - cw - 12); top = Math.min(Math.max(70, top), H - ch - 12);
    card.style.cssText = 'left:' + left + 'px;top:' + top + 'px;width:' + cw + 'px;transform:none';
  }

  function go(d) {
    var i = tour.i + d; if (i < 0) i = 0;
    if (i >= STEPS.length) { stop('finished'); return; }
    show(i, d);
  }
  function start(force) {
    if (tour) stop('restart'); var blank = !hasStop();
    if (!force && u.store(OFF)) return;
    build(); document.body.classList.add('touring'); tour = { i: 0, timer: 0 };
    window.addEventListener('resize', layout); window.addEventListener('scroll', layout, true); document.addEventListener('keydown', onKey, true);
    tour.timer = setInterval(function () {      // the screen redraws when a stop is added: follow it, and carry on once the first stop is in
      if (!tour) return; var s = STEPS[tour.i];
      if (tour.waiting && hasStop()) { show(tour.i + 1, 1); return; }
      if (s.target && !find(s) && tour.i > 1 && tour.i < STEPS.length - 1) { if (!usable(tour.i)) show(tour.i + 1, 1); return; }
      layout();
    }, 300);
    show(blank ? 0 : 1, 1);       // someone replaying it with a trip already on screen skips the welcome
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-tour]'); if (t && tour) {
      var k = t.getAttribute('data-tour');
      if (k === 'skip') { var off0 = root.querySelector('#tour-off'); if (off0 && off0.checked) u.store(OFF, 1); stop('skipped'); }
      else if (k === 'back') go(-1);
      else if (k === 'next') { var off = root.querySelector('#tour-off'); if (off && off.checked) u.store(OFF, 1); go(1); }
      return;
    }
    var a = e.target.closest('[data-act="tour"]'); if (a) { e.preventDefault(); start(true); }
  });
  A.tour = { start: start, stop: stop, steps: STEPS };
})();
