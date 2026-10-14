/* ============================================================
   GROUP MODE — plan with mates. Organiser shares a link, mates vote Yes / Maybe / No on every
   stop and tap "I'm in"; the Squad Leader perk (3 mates 50% off, 6 free) ticks up live.
   Data layer: group.js (local demo adapter, or MM_CONFIG.GROUP_ENDPOINT).
   ============================================================ */
(function () {
  var A = window.MMApp, MM = window.MM, G = MM.Group, C = window.MM_CONFIG || {}, u = A.util, esc = u.esc, $ = u.$, P = MM.PLACES;

  function start() {
    var plan = u.getPlan(); if (!plan || !plan.totals.days) { u.toast('Add a stop first'); return; }
    var q = u.store('mm-lead') || {};
    u.openModal('<div class="modal__hd"><div><div class="over">Group mode</div><h2 class="disp">Plan it with<br>your mates.</h2></div><button class="modal__x" data-act="close" aria-label="Close" type="button">×</button></div><div class="modal__bd">' +
      '<p style="font-weight:500">You get a link. Your mates open it, vote <b>Yes / Maybe / No</b> on every stop and tap <b>I\'m in</b>. You see who\'s keen, and on an ALL IN trip the Squad Leader perk ticks up as people join: <b>3 mates for 50% off, 6 to go free</b>.</p>' +
      '<form id="grpf"><div class="field"><label for="g-name">Your name</label><input class="input" id="g-name" required value="' + esc(q.name || '') + '"></div><div style="display:flex;gap:var(--s-2);margin-top:var(--s-4)"><button class="btn btn--pink" type="submit">Create the group</button><button class="btn btn--ghost" data-act="close" type="button">Cancel</button></div></form></div>', function (m) {
      $('#grpf', m).addEventListener('submit', function (e) {
        e.preventDefault(); var name = $('#g-name', m).value.trim() || 'Squad Leader';
        G.create(MM.encodeState(A.state), name).then(function (g) { u.store('mm-org-' + g.id, g.organiser.id); u.track('group_create'); u.closeModal(); u.go('group', g.id); })
          .catch(function () { u.toast('Couldn\'t create the group. Try again.'); });
      });
    });
  }
  function inviteLink(id) { return u.baseUrl() + '#/group/' + id; }
  function keyOf(sg, i) { return i + ':' + (sg.kind === 'allin' ? 'allin-' + sg.trip.id : sg.p); }
  function segName(sg) { return sg.kind === 'allin' ? 'ALL IN ' + sg.trip.n : P[sg.p].n; }

  function view(id) {
    var root = document.getElementById('app'), me = null, isOrg = false;
    root.innerHTML = '<section class="quiz"><div class="wrap"><div class="qwait"><h2 class="disp">Loading the group…</h2></div></div></section>';
    G.get(id).then(function (g) {
      if (!g) { root.innerHTML = '<section class="quiz"><div class="wrap"><div class="qbox"><span class="over">Group</span><h2 class="disp">Can\'t find that group.</h2><p class="qhelp">' + (G.mode() === 'local' ? 'Demo mode only syncs inside one browser. Set GROUP_ENDPOINT so mates on other phones can join.' : 'The link may be wrong or expired.') + '</p><div class="qnav"><button class="btn" data-go="build" type="button">Open the builder</button></div></div></div></section>' + u.footer(); return; }
      isOrg = u.store('mm-org-' + id) === g.organiser.id; var meId = u.store('mm-me-' + id); me = g.members.filter(function (m) { return m.id === meId; })[0] || null;
      if (!isOrg && !me) return joinScreen(g);
      paint(g); A._unwatch = G.watch(id, function (ng) { g = ng; if (me) me = ng.members.filter(function (m) { return m.id === me.id; })[0] || me; paint(ng); });
    });

    function joinScreen(g) {
      var st = MM.decodeState(g.trip), pl = MM.plan(st);
      root.innerHTML = '<section class="quiz"><div class="wrap"><div class="qbox"><span class="over">You\'re invited</span><h2 class="disp">' + esc(g.organiser.name) + ' is planning a trip.</h2><p class="qhelp">' + esc(MM.routeLine(pl)) + ' · ' + pl.totals.days + ' days · about ' + u.money(pl.totals.total) + ' each. Say what you think of every stop.</p>' +
        '<form id="joinf"><div class="field" style="max-width:360px"><label for="j-name">Your name</label><input class="input" id="j-name" required></div><div class="qnav"><button class="btn btn--pink" type="submit">See the trip</button></div></form></div></div></section>' + u.footer();
      $('#joinf').addEventListener('submit', function (e) { e.preventDefault(); var n = $('#j-name').value.trim(); if (!n) return; G.join(id, n).then(function (r) { u.store('mm-me-' + id, r.me.id); u.track('group_join'); view(id); }); });
    }

    function paint(g) {
      var st = MM.decodeState(g.trip), pl = MM.plan(st), ins = G.ins(g), hasAll = pl.segs.some(function (s) { return s.kind === 'allin'; });
      var perk = ins >= 6 ? 'Squad Leader travels FREE' : ins >= 3 ? 'Squad Leader gets 50% off' : (3 - ins) + ' more for 50% off';
      var h = '<section class="quiz grp"><div class="wrap"><div class="qbox" style="max-width:960px"><span class="over">' + (isOrg ? 'Your group' : 'Group trip') + '</span><h2 class="disp">' + esc(MM.routeLine(pl)) + '</h2>' +
        '<p class="qhelp">' + pl.totals.days + ' days · ' + plural(pl.countries.length, 'country', 'countries') + ' · about ' + u.money(pl.totals.total) + ' each · planned by ' + esc(g.organiser.name) + '</p>' +
        (G.mode() === 'local' ? '<div class="demo">DEMO: votes only sync between tabs of this browser. Set <code>GROUP_ENDPOINT</code> in config.js so mates on other phones count.</div>' : '') +
        '<div class="grp__top"><div class="meter"><div class="meter__hd"><b>' + plural(ins, 'mate') + ' in</b><span>' + (hasAll ? perk : 'Squad perks apply on ALL IN trips') + '</span></div><div class="meter__bar"><i style="width:' + Math.min(100, ins / 6 * 100) + '%"></i><u style="left:50%"><em>3 · 50% off</em></u><u style="left:100%"><em>6 · free</em></u></div>' +
        '<div class="who">' + (g.members.length ? g.members.map(function (m) { return '<span class="chip" style="' + (m.in ? 'background:var(--lime)' : '') + '">' + esc(m.name) + (m.in ? ' · in' : '') + '</span>'; }).join('') : '<span class="fine">Nobody has joined yet. Send them the link.</span>') + '</div></div>' +
        '<div class="invite"><span class="over">Invite link</span><div class="sharebox"><input class="input" readonly value="' + esc(inviteLink(g.id)) + '" id="invl" aria-label="Invite link"><button class="btn btn--sm" data-act="ginv" type="button">Copy</button></div>' +
        '<a class="btn btn--sm btn--pink" target="_blank" rel="noopener" href="https://wa.me/?text=' + encodeURIComponent('Vote on our trip: ' + MM.routeLine(pl) + ' ' + inviteLink(g.id)) + '">Send on WhatsApp</a></div></div>' +
        '<div class="grp__stops">' + pl.segs.map(function (sg, i) {
          var key = keyOf(sg, i), t = G.tally(g, key), mine = me && me.votes[key], flag = (t.n > t.y && t.n > 0);
          return '<div class="gstop' + (flag ? ' flag' : '') + '"><div class="gstop__hd"><span class="tl__n">' + (i + 1) + '</span><div><b>' + esc(segName(sg)) + '</b><span>' + (sg.kind === 'allin' ? sg.trip.days + ' days' : plural(sg.n, 'night')) + '</span></div></div>' +
            '<div class="tally"><i class="y" style="flex:' + t.y + '"></i><i class="m" style="flex:' + t.m + '"></i><i class="n" style="flex:' + t.n + '"></i></div><div class="tallyl">' + t.y + ' yes · ' + t.m + ' maybe · ' + t.n + ' no' + (flag ? ' · <b>mates aren\'t keen</b>' : '') + '</div>' +
            (me ? '<div class="votes">' + [['y', 'Yes'], ['m', 'Maybe'], ['n', 'No']].map(function (v) { return '<button class="chip" data-act="gvote" data-key="' + esc(key) + '" data-v="' + v[0] + '" aria-pressed="' + (mine === v[0]) + '" type="button">' + v[1] + '</button>'; }).join('') + '</div>' : '') + '</div>';
        }).join('') + '</div>' +
        '<div class="qnav">' + (me ? '<button class="btn ' + (me.in ? '' : 'btn--pink') + '" data-act="gin" type="button">' + (me.in ? 'You\'re in. Tap to step out' : 'I\'m in') + '</button>' : '') +
        (isOrg ? '<button class="btn" data-act="gapply" type="button">Apply ' + plural(ins, 'mate') + ' to my trip</button>' : '') + '<a class="btn btn--paper" href="' + esc(u.baseUrl() + '#/build/' + g.trip) + '">Open the trip in the builder</a></div></div></div></section>' + u.footer();
      root.innerHTML = h;
      root.onclick = function (e) {
        var b = e.target.closest('[data-act]'); if (!b) return; var act = b.getAttribute('data-act');
        if (act === 'ginv') { u.copy(inviteLink(g.id)).then(function (ok) { u.toast(ok ? 'Invite link copied' : 'Couldn\'t copy'); }); }
        if (act === 'gvote' && me) { var v = {}; v[b.getAttribute('data-key')] = b.getAttribute('data-v'); me.votes[b.getAttribute('data-key')] = b.getAttribute('data-v'); G.update(id, me.id, { votes: v }).then(paint); }
        if (act === 'gin' && me) { me.in = !me.in; G.update(id, me.id, { in: me.in }).then(function (ng) { paint(ng); u.track('group_in', { in: me.in }); }); }
        if (act === 'gapply') { A.state = Object.assign(MM.decodeState(g.trip)); A.state.crew = Math.min(8, G.ins(g)); u.persist(); u.go('build', MM.encodeState(A.state)); u.toast('Crew applied: ' + plural(A.state.crew, 'mate')); }
      };
    }
    function plural(n, w, ws) { return n + ' ' + (n === 1 ? w : (ws || w + 's')); }
  }

  A.views.group = view; A.group = { start: start };
})();
