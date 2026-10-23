/* Layout lint: finds the layout defects a person notices on a phone, on whatever screen is showing.
   Run it in a browser tab (resize to phone width first):   await import('/test/ui-lint.js?' + Date.now()); __lint()
   Reports, for visible elements only:
     squeezed  text squeezed into a column so narrow it wraps a word per line
     overlap   two buttons / links / fields drawn on top of each other
     tiny      tap targets smaller than 32px
     overflow  anything wider than the screen (the page scrolls sideways)
     clipped   text cut off by its own box
     contrast  text that fails WCAG AA against the colour behind it (4.5:1, or 3:1 for large text)               */
(function () {
  function vis(el) { var r = el.getBoundingClientRect(), cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0'; }
  function path(el) { var s = el.tagName.toLowerCase(); if (el.id) s += '#' + el.id; else if (el.className && typeof el.className === 'string') s += '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.'); var t = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 24); return s + (t ? ' "' + t + '"' : ''); }
  function inFixed(el) { for (var e = el; e && e !== document.body; e = e.parentElement) if (getComputedStyle(e).position === 'fixed') return true; return false; }
  window.__lint = function () {
    var vw = document.documentElement.clientWidth, out = { squeezed: [], overlap: [], tiny: [], overflow: [], clipped: [], contrast: [] }, seen = {};
    function add(k, el, extra) { var key = k + path(el); if (seen[key]) return; seen[key] = 1; out[k].push(path(el) + (extra ? ' (' + extra + ')' : '')); }
    var all = Array.prototype.slice.call(document.querySelectorAll('#app *, .mbar *, .hdr *'));
    all.forEach(function (el) {
      if (!vis(el) || el.closest('svg') || el.closest('[aria-hidden="true"]')) return;
      var r = el.getBoundingClientRect(), cs = getComputedStyle(el);
      // squeezed: a text block narrower than ~70px that holds a long word run
      var own = Array.prototype.filter.call(el.childNodes, function (n) { return n.nodeType === 3 && n.textContent.trim().length > 7; }).length;
      if (own && r.width < 72 && cs.display !== 'inline' && el.tagName !== 'OPTION') {
        var lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.3; if (r.height / lh >= 3) add('squeezed', el, Math.round(r.width) + 'px wide, ' + Math.round(r.height / lh) + ' lines');
      }
      // overflow past the screen (ignore the map's own canvas and things that scroll on purpose)
      if (r.right > vw + 2 && !inFixed(el) && !el.closest('#bmap') && !el.closest('.nextbar,.tl,.regions,.bmap__regions,.gal,.chips,.reco__chips,.seg,.tgrid,.hscroll,[data-scroll]')) {
        var scr = false; for (var p = el.parentElement; p && p !== document.body; p = p.parentElement) { var o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden') { scr = true; break; } }
        if (!scr) add('overflow', el, 'right edge at ' + Math.round(r.right) + 'px of ' + vw);
      }
      // clipped text
      if ((cs.overflow === 'hidden' || cs.overflowX === 'hidden') && el.scrollWidth > el.clientWidth + 3 && el.clientWidth > 0 && !el.classList.contains('sr') && (el.textContent || '').trim() && cs.textOverflow !== 'ellipsis' && !el.closest('#bmap')) add('clipped', el, el.scrollWidth + ' > ' + el.clientWidth);
    });

    // contrast: walk up to the first solid background (skip anything sitting on an image or gradient, where we can't know)
    function rgba(c) { var m = /rgba?\(([^)]+)\)/.exec(c); if (!m) return null; var p = m[1].split(/[ ,/]+/).filter(Boolean).map(parseFloat); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; }
    function lum(c) { var f = function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); }
    function bgOf(el) { for (var e = el; e; e = e.parentElement) { var cs = getComputedStyle(e); if (cs.backgroundImage !== 'none') return null; var c = rgba(cs.backgroundColor); if (c && c.a > 0.95) return c; } return { r: 245, g: 239, b: 226, a: 1 }; }
    all.forEach(function (el) {
      if (!vis(el) || el.closest('svg') || el.closest('#bmap') || el.closest('.sr') || el.disabled || el.getAttribute('aria-hidden') === 'true') return;
      var own = Array.prototype.filter.call(el.childNodes, function (n) { return n.nodeType === 3 && n.textContent.trim().length > 1; }).length; if (!own) return;
      var cs = getComputedStyle(el); if (+cs.opacity < 1 || (cs.webkitTextStrokeWidth && parseFloat(cs.webkitTextStrokeWidth) > 0)) return;
      var fg = rgba(cs.color), bg = bgOf(el); if (!fg || !bg) return;
      var L1 = lum(fg), L2 = lum(bg), ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05), px = parseFloat(cs.fontSize), bold = parseInt(cs.fontWeight, 10) >= 700, large = px >= 24 || (px >= 18.66 && bold);
      if (ratio < (large ? 3 : 4.5)) add('contrast', el, ratio.toFixed(2) + ':1 needs ' + (large ? 3 : 4.5) + ', ' + cs.color.replace(/\s/g, '') + ' on ' + 'rgb(' + bg.r + ',' + bg.g + ',' + bg.b + ')');
    });
    // tap targets and overlaps between controls
    var ctl = all.filter(function (el) { return /^(BUTTON|A|INPUT|SELECT|TEXTAREA|SUMMARY)$/.test(el.tagName) || el.getAttribute('role') === 'button'; }).filter(function (el) { return vis(el) && !el.closest('#bmap') && el.type !== 'hidden' && el.type !== 'range' && !el.classList.contains('sr'); });
    var stuck = function (el) { return !!el.closest('.hdr,.mbar,.crewbar,.toast,.modal'); };   // sticky bars are meant to float over the page
    ctl.forEach(function (el) { var r = el.getBoundingClientRect(); if ((r.width < 32 || r.height < 32) && !el.closest('.chk') && el.type !== 'checkbox' && el.type !== 'radio' && !(el.tagName === 'A' && getComputedStyle(el).display === 'inline')) add('tiny', el, Math.round(r.width) + 'x' + Math.round(r.height)); });
    for (var i = 0; i < ctl.length; i++) for (var j = i + 1; j < ctl.length; j++) {
      var a = ctl[i], b = ctl[j]; if (a.contains(b) || b.contains(a) || stuck(a) !== stuck(b)) continue;
      var ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(), w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left), h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      if (w > 4 && h > 4 && (w * h) / Math.min(ra.width * ra.height, rb.width * rb.height) > 0.2) add('overlap', a, 'covers ' + path(b));
    }
    if (document.documentElement.scrollWidth > vw + 1) out.overflow.unshift('PAGE scrolls sideways: ' + document.documentElement.scrollWidth + 'px wide on a ' + vw + 'px screen');
    var n = 0; Object.keys(out).forEach(function (k) { n += out[k].length; });
    out.total = n; out.width = vw; out.hash = location.hash.slice(0, 40);
    return out;
  };
  // Runs the lint over each main screen in turn (builder with trips, home, quiz, results, pack, status).
  window.__lintAll = async function (screens) {
    var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); }, res = {};
    screens = screens || [['home', '#/'], ['builder: empty', '#/build'], ['builder: 3 stops', '#/build/i=s.hanoi.4~s.hoi-an.4~s.saigon.3&d=2027-02-10&f=20&b=1500'], ['builder: ALL IN block', '#/build/i=a.vietnam~s.saigon.2&d=2027-02-10'], ['pack', '#/pack/i=s.hanoi.4~s.hoi-an.4~s.saigon.3&d=2027-02-10']];
    for (var i = 0; i < screens.length; i++) { location.hash = screens[i][1]; await wait(900); res[screens[i][0]] = window.__lint(); }
    return res;
  };
})();
