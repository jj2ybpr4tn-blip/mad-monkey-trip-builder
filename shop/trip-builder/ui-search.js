/* ============================================================
   THE SEARCH BOX: type where you're going, or what you want to do, and pick.
   One box on the home page ("Where to?") and one in the builder ("Add a place or a tour"). It finds hostels, countries, tours, ALL IN trips,
   routes and vibes (search.js), and what happens on a pick lives in app.js (searchPick). It is a proper combobox: arrow keys, Enter, Escape,
   a screen reader hears how many results there are, and nothing here ever puts data on the page as anything but text.

     MMApp.search.html({ mode: 'start' | 'add', label, placeholder, cls })   the markup for one box
   ============================================================ */
(function () {
  var A = window.MMApp, MM = window.MM, u = A.util, esc = u.esc;
  var seq = 0, current = null, closeTimer = 0;
  var ICON = '<svg class="srch__ico" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" stroke-width="3"/><path d="M15 15l6 6" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>';

  function html(o) {
    o = o || {}; var id = 'srch' + (++seq);
    return '<div class="srch' + (o.cls ? ' ' + o.cls : '') + '" data-srch="' + (o.mode === 'add' ? 'add' : 'start') + '">' +
      '<label class="srch__lbl" for="' + id + '">' + esc(o.label || 'Where to?') + '</label>' +
      '<div class="srch__box">' + ICON +
        '<input class="srch__in" id="' + id + '" type="text" role="combobox" aria-expanded="false" aria-controls="' + id + '-list" aria-autocomplete="list" aria-haspopup="listbox" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="go" placeholder="' + esc(o.placeholder || 'Hanoi, Vietnam, kayaking…') + '">' +
        '<button class="srch__x" type="button" aria-label="Clear" hidden>×</button>' +
      '</div>' +
      '<ul class="srch__list" id="' + id + '-list" role="listbox" aria-label="Suggestions" hidden></ul>' +
      '<p class="srch__msg" hidden></p>' +
      '<p class="srch__status sr" role="status" aria-live="polite"></p>' +
    '</div>';
  }

  function tagClass(kind) { return 'srch__tag srch__tag--' + kind; }
  function optHTML(r, i, id) {
    return '<li class="srch__opt" role="option" id="' + id + '-o' + i + '" aria-selected="false" data-i="' + i + '">' +
      (r.c ? '<i class="dotc" data-c="' + esc(r.c) + '" aria-hidden="true"></i>' : '<i class="dotc dotc--none" aria-hidden="true"></i>') +
      '<span class="srch__main"><b>' + esc(r.title) + '</b><small>' + esc(r.sub) + '</small></span><i class="' + tagClass(r.kind) + '">' + esc(r.tag) + '</i></li>';
  }
  function parts(box) { return { input: box.querySelector('.srch__in'), list: box.querySelector('.srch__list'), x: box.querySelector('.srch__x'), status: box.querySelector('.srch__status'), msg: box.querySelector('.srch__msg') }; }

  function show(box, q) {
    var p = parts(box), id = p.input.id, text = q.trim(), res, note = '';
    if (!text) res = MM.searchHints(); else if (text.length < 2) res = []; else res = MM.search(text, { limit: 8 });
    box._res = res; p.x.hidden = !q;
    var h = '';
    if (!text && res.length) h += '<li class="srch__hd" role="presentation">Try a country or a vibe, or just start typing</li>';
    h += res.map(function (r, i) { return optHTML(r, i, id); }).join('');
    var msg = '';
    if (text.length >= 2 && !res.length) { msg = 'Nothing called “' + text.slice(0, 40) + '”. Try a city, a country, or something to do, like kayaking or a cooking class.'; note = 'No matches'; }
    else if (res.length) note = res.length + (res.length === 1 ? ' suggestion' : ' suggestions') + (text ? '' : '. Type to search.');
    if (text.length === 1) note = 'Keep typing';
    p.list.innerHTML = h; p.list.hidden = !h; p.input.setAttribute('aria-expanded', h ? 'true' : 'false'); p.input.removeAttribute('aria-activedescendant'); p.status.textContent = note;
    p.msg.textContent = msg; p.msg.hidden = !msg;                                      // "nothing found" sits outside the list: a listbox with no options in it isn't valid
    box._active = -1; if (h) current = box;
  }
  function hide(box) { if (!box) return; var p = parts(box); p.list.hidden = true; p.msg.hidden = true; p.input.setAttribute('aria-expanded', 'false'); p.input.removeAttribute('aria-activedescendant'); box._active = -1; if (current === box) current = null; }
  function setActive(box, i) {
    var opts = box.querySelectorAll('.srch__opt'); if (!opts.length) return;
    i = (i + opts.length) % opts.length; box._active = i;
    Array.prototype.forEach.call(opts, function (o, k) { o.setAttribute('aria-selected', k === i ? 'true' : 'false'); o.classList.toggle('on', k === i); });
    parts(box).input.setAttribute('aria-activedescendant', opts[i].id); opts[i].scrollIntoView({ block: 'nearest' });
  }
  function pick(box, i) {
    var r = (box._res || [])[i]; if (!r) return;
    var p = parts(box), mode = box.getAttribute('data-srch'); p.input.value = ''; hide(box); p.x.hidden = true;
    try { p.input.blur(); } catch (e) { /* ignore */ }
    A.searchPick(r, mode);
  }
  function boxOf(el) { return el && el.closest ? el.closest('.srch') : null; }

  document.addEventListener('input', function (e) { var b = e.target.classList && e.target.classList.contains('srch__in') ? boxOf(e.target) : null; if (b) show(b, e.target.value); });
  document.addEventListener('focusin', function (e) {
    var b = e.target.classList && e.target.classList.contains('srch__in') ? boxOf(e.target) : null;
    clearTimeout(closeTimer); if (current && current !== b) hide(current);
    if (b && !b.querySelector('.srch__list').children.length) show(b, e.target.value);
    else if (b) { var l = b.querySelector('.srch__list'); if (l.children.length) { l.hidden = false; e.target.setAttribute('aria-expanded', 'true'); current = b; } }
  });
  document.addEventListener('focusout', function (e) {
    var b = boxOf(e.target); if (!b) return;
    closeTimer = setTimeout(function () { if (!b.contains(document.activeElement)) hide(b); }, 160);
  });
  document.addEventListener('mousedown', function (e) {                                  // keep the focus in the box while a result is pressed, so it isn't closed first
    if (e.target.closest && e.target.closest('.srch__list, .srch__x')) e.preventDefault();
    else if (current && !boxOf(e.target)) hide(current);
  });
  document.addEventListener('click', function (e) {
    var opt = e.target.closest && e.target.closest('.srch__opt');
    if (opt) { var b = boxOf(opt); if (b) pick(b, +opt.getAttribute('data-i')); return; }
    var x = e.target.closest && e.target.closest('.srch__x');
    if (x) { var b2 = boxOf(x), p = parts(b2); p.input.value = ''; show(b2, ''); p.input.focus(); }
  });
  document.addEventListener('keydown', function (e) {
    var inp = e.target; if (!(inp.classList && inp.classList.contains('srch__in'))) return;
    var b = boxOf(inp), open = !b.querySelector('.srch__list').hidden;
    if (e.key === 'ArrowDown') { e.preventDefault(); if (!open) show(b, inp.value); setActive(b, (b._active == null ? -1 : b._active) + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (open) setActive(b, (b._active == null ? 0 : b._active) - 1); }
    else if (e.key === 'Home' && open && b._active >= 0) { e.preventDefault(); setActive(b, 0); }
    else if (e.key === 'End' && open && b._active >= 0) { e.preventDefault(); setActive(b, (b._res || []).length - 1); }
    else if (e.key === 'Enter') { if (open && (b._res || []).length) { e.preventDefault(); pick(b, b._active >= 0 ? b._active : 0); } }
    else if (e.key === 'Escape') { if (open) { e.preventDefault(); e.stopPropagation(); hide(b); } else if (inp.value) { e.preventDefault(); inp.value = ''; parts(b).x.hidden = true; } }
    else if (e.key === 'Tab') hide(b);
  }, true);

  // "/" jumps to the search box from anywhere on the page, as on most sites with a search
  document.addEventListener('keydown', function (e) {
    if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target, tag = t && t.tagName; if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
    if (document.querySelector('#modal-root .modal')) return;
    var inp = document.querySelector('#app .srch__in'); if (!inp) return;
    e.preventDefault(); inp.scrollIntoView({ block: 'center' }); inp.focus();
  });

  A.search = { html: html };
})();
