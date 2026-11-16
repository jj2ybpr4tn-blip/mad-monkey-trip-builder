/* ============================================================
   INSIDE THE ALL IN SITE: when the builder lives inside the ALL IN site (MM_CONFIG.ALLIN_SITE set, e.g. '../' at
   <site>/trip-builder/) and wears its look, it shows that site's bar and menu instead of its own header, so the two feel
   like one site. The builder's own pages (Ideas, Your trip, Quiz) and the currency picker sit in a slim row under the bar.
     • <html data-site="allin"> turns it on (the preview build and the live copy's sync set it up front, so there's no flash;
       this file puts it on or takes it off to match the config either way)
     • the bar's links go to the site (ALLIN_SITE + #section); "Trip builder" is marked as the page you're on
     • the full menu comes from the site itself, never from these public files: what the site left in this browser
       (localStorage 'allin-site-menu', written by the locked preview's own page once it's open) or, failing that, the
       site page's <nav data-site-menu="bar|menu"> links. Without either, the short public menu in index.html stays.
   Every label is set as text and every address is checked (MM.siteMenu): only the site's own origin gets through.
   docs/ALL-IN-SITE.md has the contract.
   ============================================================ */
(function () {
  'use strict';
  var MM = window.MM, A = window.MMApp, C = window.MM_CONFIG || {}, de = document.documentElement;
  var KEY = 'allin-site-menu';
  var site = A && A.allinSite ? A.allinSite() : '';
  var on = !!(MM && MM.siteMenu && site && de.getAttribute('data-look') === 'allin');
  var ids = ['sitebar', 'subnav', 'sitemenu'];
  if (!on) {
    de.removeAttribute('data-site');
    ids.forEach(function (id) { var el = document.getElementById(id); if (el && el.parentNode) el.parentNode.removeChild(el); });
    return;
  }
  de.setAttribute('data-site', 'allin');

  var base = new URL(site, location.href), here = new URL('./', location.href);
  var siteHref = base.href.replace(/#.*$/, '');
  function to(hash) { return siteHref + (hash || ''); }

  // the static links (wordmark, short menu, Enquire, Book a trip) point at the site wherever ALLIN_SITE says it is
  Array.prototype.forEach.call(document.querySelectorAll('[data-site-href]'), function (a) {
    var h = a.getAttribute('data-site-href'); if (h === '' || /^#[A-Za-z][\w-]{0,40}$/.test(h)) a.href = to(h);
  });
  Array.prototype.forEach.call(document.querySelectorAll('#sitebar [data-here], #sitemenu [data-here]'), function (a) { a.href = '#/build'; });

  // the builder's own currency picker moves into its row
  var cur = document.querySelector('#hdr .cur'), slot = document.getElementById('subnav-cur');
  if (cur && slot) slot.appendChild(cur);

  /* ---------- the site's menu ---------- */
  function fill(nav, items) {
    if (!nav || !items || !items.length) return;
    var frag = document.createDocumentFragment();
    items.forEach(function (x) {
      var a = document.createElement('a');
      a.textContent = x.t;
      if (x.here) { a.href = '#/build'; a.setAttribute('aria-current', 'page'); a.setAttribute('data-here', ''); }
      else a.href = x.href;
      frag.appendChild(a);
    });
    nav.textContent = '';
    nav.appendChild(frag);
  }
  function show(menu) {
    if (!menu) return false;
    fill(document.getElementById('sitebar-links'), menu.bar);
    fill(document.getElementById('sitemenu-links'), menu.menu);
    return true;
  }
  var stored = null;
  try { stored = localStorage.getItem(KEY); } catch (e) { stored = null; }
  if (!show(stored && MM.siteMenu(stored, siteHref, here.href)) && base.origin === location.origin && window.fetch && window.DOMParser) {
    // a site page that carries its menu (the launched site): read it once and keep it for next time
    fetch(siteHref, { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.text() : ''; }).then(function (html) {
      if (!html || html.indexOf('data-site-menu') < 0) return;
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var grab = function (sel) { return Array.prototype.slice.call(doc.querySelectorAll(sel), 0, 16).map(function (a) { return [a.textContent, a.getAttribute('href') || '', a.hasAttribute('data-builder-blank') ? 1 : 0]; }); };
      var raw = { v: 1, at: Date.now(), bar: grab('nav[data-site-menu="bar"] a'), menu: grab('nav[data-site-menu="menu"] a') };
      if (show(MM.siteMenu(raw, siteHref, here.href))) { try { localStorage.setItem(KEY, JSON.stringify(raw)); } catch (e) { /* private mode: it's read again next time */ } }
    }).catch(function () { /* offline or blocked: the short menu stays */ });
  }

  /* ---------- the full-screen menu ---------- */
  var dlg = document.getElementById('sitemenu'), btn = document.getElementById('sitebar-menu');
  function close() { if (dlg && dlg.open) { if (dlg.close) dlg.close(); else dlg.removeAttribute('open'); } }
  if (dlg && btn) {
    btn.addEventListener('click', function () {
      if (dlg.showModal) { if (!dlg.open) dlg.showModal(); } else dlg.setAttribute('open', '');
      btn.setAttribute('aria-expanded', 'true');
    });
    dlg.addEventListener('close', function () { btn.setAttribute('aria-expanded', 'false'); });
    dlg.addEventListener('click', function (e) { if (e.target.closest('[data-close]') || e.target.closest('a')) close(); });
    window.addEventListener('hashchange', close);
  }
})();
