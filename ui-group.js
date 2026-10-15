/* ============================================================
   GROUP MODE — plan it with mates.
   • Organiser shares a link; mates vote Yes / Maybe / No on every stop and tap "I'm in";
     the Squad Leader perk (3 mates 50% off, 6 free) ticks up live.
   • Plan together: anyone suggests a stop or hearts an activity ("Sam wants Pai");
     the organiser adds the good ones to the one shared trip, which everyone sees.
   • Route A vs B: the organiser can put a second route up for a vote.
   • Meet-ups: mates travelling their own route add it and see where and when they cross.
   Data layer: group.js (local demo adapter, or MM_CONFIG.GROUP_ENDPOINT).
   ============================================================ */
(function () {
  var A = window.MMApp, MM = window.MM, G = MM.Group, u = A.util, esc = u.esc, $ = u.$, P = MM.PLACES;
  var HEART = '<svg viewBox="0 0 24 24" aria-hidden="true" class="ht"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.8 4.5c2.2 0 3.6 1.2 5.2 3.1 1.6-1.9 3-3.1 5.2-3.1 3.8 0 5.9 3.9 4.4 7.3C19.5 16.4 12 21 12 21z"/></svg>';

  function start() {
    var plan = u.getPlan(); if (!plan || !plan.totals.days) { u.toast('Add a stop first'); return; }
    var q = u.store('mm-lead') || {};
    u.openModal('<div class="modal__hd"><div><div class="over">Group mode</div><h2 class="disp">Plan it with<br>your mates.</h2></div><button class="modal__x" data-act="close" aria-label="Close" type="button">×</button></div><div class="modal__bd">' +
      '<p style="font-weight:500">You get one link for the whole crew. Mates open it and:</p><ul class="grp__how"><li><b>Vote</b> Yes / Maybe / No on every stop</li><li><b>Suggest stops</b> and <b>heart activities</b>. You see who wants what and add the good ones</li><li><b>Add their own route</b> if they\'re travelling separately, and see where you cross</li><li>Tap <b>I\'m in</b>. On ALL IN trips the Squad Leader perk ticks up: <b>3 mates for 50% off, 6 to go free</b></li></ul>' +
      '<form id="grpf"><div class="field"><label for="g-name">Your name</label><input class="input" id="g-name" required value="' + esc(q.name || '') + '"></div><div style="display:flex;gap:var(--s-2);margin-top:var(--s-4)"><button class="btn btn--pink" type="submit">Create the group</button><button class="btn btn--ghost" data-act="close" type="button">Cancel</button></div></form></div>', function (m) {
      $('#grpf', m).addEventListener('submit', function (e) {
        e.preventDefault(); var name = $('#g-name', m).value.trim() || 'Squad Leader';
        G.create(MM.encodeState(A.state), name).then(function (g) {
          u.store('mm-org-' + g.id, g.organiser.id);
          // the organiser is a member too, so they can vote and suggest like everyone else
          return G.join(g.id, name).then(function (r) { u.store('mm-me-' + g.id, r.me.id); return g; });
        }).then(function (g) { u.track('group_create'); u.closeModal(); u.go('group', g.id); })
          .catch(function () { u.toast('Couldn\'t create the group. Try again.'); });
      });
    });
  }
  function inviteLink(id) { return u.baseUrl() + '#/group/' + id; }
  function keyOf(sg, i) { return i + ':' + (sg.kind === 'allin' ? 'allin-' + sg.trip.id : sg.p); }
  function segName(sg) { return sg.kind === 'allin' ? 'ALL IN ' + sg.trip.n : P[sg.p].n; }
  function plural(n, w, ws) { return n + ' ' + (n === 1 ? w : (ws || w + 's')); }
  function names(list) { return list.length <= 2 ? list.join(' and ') : list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1]; }
  function builderTrip() { var s = u.store('mm-trip'); return s && s.state && s.state.items && s.state.items.length ? MM.encodeState(Object.assign(MM.defaultState(), s.state)) : ''; }

  // put a stop where it adds the least travel
  function insertStop(state, p, acts) {
    var best = null;
    for (var i = 0; i <= state.items.length; i++) {
      var st = JSON.parse(JSON.stringify(state)); st.items.splice(i, 0, { kind: 'stop', p: p, n: P[p].sug, acts: acts || [] }); st.legPick = {};
      var h = MM.plan(st).legs.reduce(function (a, l) { return a + l.h; }, 0);
      if (!best || h < best.h) best = { h: h, st: st };
    }
    return best.st;
  }
  function addIdea(state, k) {
    var kind = k.slice(0, 1), id = k.slice(2);
    if (kind === 'p') return insertStop(state, id);
    var a = MM.ACTS[id]; if (!a) return state;
    var it = state.items.filter(function (x) { return x.kind === 'stop' && x.p === a.p; })[0];
    if (it) { if (it.acts.indexOf(id) < 0) it.acts.push(id); return state; }
    return insertStop(state, a.p, [id]);
  }
  function ideaDone(pl, k) {
    var kind = k.slice(0, 1), id = k.slice(2);
    if (kind === 'p') return pl.places.indexOf(id) > -1;
    return pl.segs.some(function (s) { return s.kind === 'stop' && s.acts.some(function (a) { return a.id === id; }); });
  }

  function view(id) {
    var root = document.getElementById('app'), me = null, isOrg = false, orgKey = u.store('mm-org-' + id);
    root.innerHTML = '<section class="quiz"><div class="wrap"><div class="qwait"><h2 class="disp">Loading the group…</h2></div></div></section>';
    G.get(id).then(function (g) {
      if (!g) { root.innerHTML = '<section class="quiz"><div class="wrap"><div class="qbox"><span class="over">Group</span><h2 class="disp">Can\'t find that group.</h2><p class="qhelp">' + (G.mode() === 'local' ? 'Demo mode only syncs inside one browser. Set GROUP_ENDPOINT so mates on other phones can join.' : 'The link may be wrong or expired.') + '</p><div class="qnav"><button class="btn" data-go="build" type="button">Back to the builder</button></div></div></div></section>'; return; }
      isOrg = !!orgKey; var meId = u.store('mm-me-' + id); me = g.members.filter(function (m) { return m.id === meId; })[0] || null;
      if (!isOrg && !me) return joinScreen(g);
      var last = '';
      paint(g); A._unwatch = G.watch(id, function (ng) {
        var sig = JSON.stringify(ng); if (sig === last) return; last = sig;          // only redraw when something actually changed
        g = ng; if (me) me = ng.members.filter(function (m) { return m.id === me.id; })[0] || me; paint(ng);
      });
    });

    function joinScreen(g) {
      var st = MM.decodeState(g.trip), pl = MM.plan(st);
      root.innerHTML = '<section class="quiz"><div class="wrap"><div class="qbox"><span class="over">You\'re invited</span><h2 class="disp">' + esc(g.organiser.name) + ' is planning a trip.</h2><p class="qhelp">' + esc(MM.routeLine(pl)) + ' · ' + pl.totals.days + ' days · about ' + u.money(pl.totals.total) + ' each. Vote on the stops, suggest your own and see where your plans cross.</p>' +
        '<form id="joinf"><div class="field" style="max-width:360px"><label for="j-name">Your name</label><input class="input" id="j-name" required></div><div class="qnav"><button class="btn btn--pink" type="submit">See the trip</button></div></form></div></div></section>' + u.footer();
      $('#joinf').addEventListener('submit', function (e) { e.preventDefault(); var n = $('#j-name').value.trim(); if (!n) return; G.join(id, n).then(function (r) { u.store('mm-me-' + id, r.me.id); u.track('group_join'); view(id); }); });
    }

    /* ---------- sections ---------- */
    function routeCard(g, which, enc, rv) {
      var pl = MM.plan(MM.decodeState(enc)), mine = me && me.votes.route === which, n = rv[which];
      return '<div class="vcard' + (mine ? ' on' : '') + '"><div class="vcard__hd"><span class="vcard__tag">Route ' + which.toUpperCase() + '</span><b>' + plural(n, 'vote') + '</b></div>' +
        '<div class="vcard__map">' + MM.staticMap({ places: pl.places, aspect: 2.1, labels: pl.places.length <= 5, px: 420, pad: 0.3, minW: 190 }) + '</div>' +
        '<h3>' + esc(MM.routeLine(pl)) + '</h3><p class="vcard__st">' + pl.totals.days + ' days · ' + plural(pl.countries.length, 'country', 'countries') + ' · ~' + u.money(pl.totals.total) + ' each</p>' +
        '<div class="vcard__ft">' + (me ? '<button class="btn btn--sm ' + (mine ? '' : 'btn--pink') + '" data-act="grv" data-v="' + which + '" type="button">' + (mine ? 'Your pick' : 'Vote Route ' + which.toUpperCase()) + '</button>' : '') +
        (isOrg && which === 'b' ? '<button class="btn btn--sm btn--paper" data-act="gpickb" type="button">Go with Route B</button>' : '') +
        (isOrg && which === 'a' ? '<button class="btn btn--sm btn--paper" data-act="gdropb" type="button">Keep Route A</button>' : '') + '</div></div>';
    }
    function routesHTML(g) {
      if (g.alt) {
        var rv = G.routeVotes(g);
        return '<section class="gsec"><div class="gsec__hd"><span class="over">Can\'t agree?</span><h3 class="disp">Route A or Route B</h3><p>Everyone votes. ' + esc(g.organiser.name) + ' makes the call.</p></div><div class="rvs">' + routeCard(g, 'a', g.trip, rv) + routeCard(g, 'b', g.alt, rv) + '</div></section>';
      }
      if (!isOrg) return '';
      var bt = builderTrip(), can = bt && bt !== g.trip;
      return '<section class="gsec gsec--slim"><div><span class="over">Can\'t agree?</span><p><b>Put a second route up for a vote.</b> ' + (can ? 'Use the trip that\'s in your builder right now as Route B.' : 'Build another version in the builder, then come back here.') + '</p></div>' +
        (can ? '<button class="btn btn--sm btn--pink" data-act="gaddb" type="button">Add Route B</button>' : '<a class="btn btn--sm btn--paper" href="' + esc(u.baseUrl() + '#/build/' + g.trip) + '">Open the builder</a>') + '</section>';
    }
    function stopsHTML(g, pl) {
      var wants = (me && me.wants) || [];
      return '<div class="grp__stops">' + pl.segs.map(function (sg, i) {
        var key = keyOf(sg, i), t = G.tally(g, key), mine = me && me.votes[key], flag = (t.n > t.y && t.n > 0);
        var hearts = sg.kind === 'stop' ? MM.actsAt(sg.p).slice().sort(function (a, b) { return (b.star ? 1 : 0) - (a.star ? 1 : 0); }).slice(0, 4).map(function (a) {
          var k = 'a:' + a.id, who = g.members.filter(function (m) { return (m.wants || []).indexOf(k) > -1; }), on = wants.indexOf(k) > -1;
          return '<button class="heart" type="button" data-act="gwant" data-k="' + esc(k) + '" aria-pressed="' + on + '"' + (me ? '' : ' disabled') + ' title="' + esc(who.length ? names(who.map(function (m) { return m.name; })) + ' want this' : 'Heart it if you want to do it') + '">' + HEART + '<span>' + esc(a.n) + '</span>' + (who.length ? '<em>' + who.length + '</em>' : '') + '</button>';
        }).join('') : '';
        return '<div class="gstop' + (flag ? ' flag' : '') + '"><div class="gstop__hd"><span class="tl__n">' + (i + 1) + '</span><div><b>' + esc(segName(sg)) + '</b><span>' + (sg.kind === 'allin' ? sg.trip.days + ' days' : plural(sg.n, 'night')) + '</span></div></div>' +
          '<div class="tally"><i class="y" style="flex:' + t.y + '"></i><i class="m" style="flex:' + t.m + '"></i><i class="n" style="flex:' + t.n + '"></i></div><div class="tallyl">' + t.y + ' yes · ' + t.m + ' maybe · ' + t.n + ' no' + (flag ? ' · <b>mates aren\'t keen</b>' : '') + '</div>' +
          (me ? '<div class="votes">' + [['y', 'Yes'], ['m', 'Maybe'], ['n', 'No']].map(function (v) { return '<button class="chip" data-act="gvote" data-key="' + esc(key) + '" data-v="' + v[0] + '" aria-pressed="' + (mine === v[0]) + '" type="button">' + v[1] + '</button>'; }).join('') + '</div>' : '') +
          (hearts ? '<div class="hearts"><span class="over">Who wants to do what</span>' + hearts + '</div>' : '') + '</div>';
      }).join('') + '</div>';
    }
    function ideasHTML(g, pl) {
      var list = G.ideas(g).filter(function (x) { return !ideaDone(pl, x.k); });
      var opts = MM.PLACE_ORDER.filter(function (p) { return pl.places.indexOf(p) < 0 && !P[p].partner; }).map(function (p) { return '<option value="' + p + '">' + esc(P[p].n) + ' · ' + MM.COUNTRIES[P[p].c].n + '</option>'; }).join('');
      return '<section class="gsec"><div class="gsec__hd"><span class="over">Plan together</span><h3 class="disp">Crew ideas</h3><p>' + (isOrg ? 'Add the good ones and everyone sees the new trip straight away.' : 'Suggest a stop or heart an activity. ' + esc(g.organiser.name) + ' adds the good ones.') + '</p></div>' +
        (list.length ? '<ul class="ideas">' + list.map(function (x) {
          var kind = x.k.slice(0, 1), id = x.k.slice(2), a = kind === 'a' ? MM.ACTS[id] : null; if (kind === 'a' && !a) return '';
          var what = kind === 'p' ? P[id].n : a.n + ' in ' + P[a.p].n, mineIdea = me && (me.wants || []).indexOf(x.k) > -1;
          return '<li><span class="ideas__who">' + esc(names(x.who)) + '</span> <span>' + (x.who.length === 1 ? 'wants' : 'want') + '</span> <b>' + esc(what) + '</b>' +
            '<span class="ideas__act">' + (isOrg ? '<button class="btn btn--sm btn--pink" data-act="gadd" data-k="' + esc(x.k) + '" type="button">Add to trip</button>' : '') +
            (mineIdea ? '<button class="ideas__x" data-act="gwant" data-k="' + esc(x.k) + '" type="button" aria-label="Take back my idea">Take back</button>' : '') + '</span></li>';
        }).join('') + '</ul>' : '<p class="fine">No ideas yet. ' + (me ? 'Be the first.' : '') + '</p>') +
        (me ? '<div class="ideas__add"><select class="select" id="gsug" aria-label="Suggest a stop"><option value="">Suggest a stop…</option>' + opts + '</select><button class="btn btn--sm" data-act="gsug" type="button">Suggest</button></div>' : '') + '</section>';
    }
    function meetHTML(g, pl) {
      var people = [{ name: 'the group trip', enc: g.trip }];
      g.members.forEach(function (m) { if (m.trip) people.push({ name: m.name, enc: m.trip, me: me && m.id === me.id }); });
      var rows = [];
      for (var i = 0; i < people.length; i++) for (var j = i + 1; j < people.length; j++) {
        var o = MM.overlap(MM.decodeState(people[i].enc), MM.decodeState(people[j].enc)), who = esc(people[j].name) + ' and ' + esc(people[i].name);
        if (o.ranges.length) o.ranges.forEach(function (r) { rows.push('<li class="hit"><b>' + who + '</b> are both in <b>' + esc(P[r.p].n) + '</b> ' + esc(r.label) + '. Same hostel?</li>'); });
        else if (o.near && o.near.length) o.near.forEach(function (n) { rows.push('<li><b>' + who + '</b> just miss each other in <b>' + esc(P[n.p].n) + '</b> (' + esc(n.a) + ' and ' + esc(n.b) + '). Shift ' + plural(n.gap, 'day') + ' and you\'d meet.</li>'); });
        else if (!o.dated && o.shared.length) rows.push('<li><b>' + who + '</b> both go to ' + esc(names(o.shared.map(function (p) { return P[p].n; }))) + '. Add start dates to see if you overlap.</li>');
        else rows.push('<li class="miss"><b>' + who + '</b> don\'t cross this time.</li>');
      }
      var mine = me && me.trip, bt = builderTrip(), canAdd = me && bt && bt !== mine && bt !== g.trip;
      return '<section class="gsec"><div class="gsec__hd"><span class="over">Travelling separately?</span><h3 class="disp">Where you cross</h3><p>Add your own route and see where and when you\'re in the same town.</p></div>' +
        (people.length > 1 ? '<ul class="meets">' + rows.join('') + '</ul>' : '<p class="fine">Nobody has added their own route yet.</p>') +
        (me && !isOrg ? '<div class="ideas__add">' + (canAdd ? '<button class="btn btn--sm btn--pink" data-act="gmytrip" type="button">' + (mine ? 'Update my route from the builder' : 'Add my route from the builder') + '</button>' : '') +
          '<a class="btn btn--sm btn--paper" href="' + esc(u.baseUrl() + '#/build/') + '" data-act="gbuild">' + (mine ? 'Change my route' : 'Build my own route') + '</a>' + (mine ? '<button class="ideas__x" data-act="gmyclear" type="button">Remove my route</button>' : '') + '</div>' : '') + '</section>';
    }

    function paint(g) {
      var st = MM.decodeState(g.trip), pl = MM.plan(st), ins = G.ins(g), hasAll = pl.segs.some(function (s) { return s.kind === 'allin'; });
      var perk = ins >= 6 ? 'Squad Leader travels FREE' : ins >= 3 ? 'Squad Leader gets 50% off' : (3 - ins) + ' more for 50% off';
      var h = '<section class="quiz grp"><div class="wrap"><div class="qbox" style="max-width:960px"><span class="over">' + (isOrg ? 'Your group' : 'Group trip') + '</span><h2 class="disp">' + esc(MM.routeLine(pl)) + '</h2>' +
        '<p class="qhelp">' + pl.totals.days + ' days · ' + plural(pl.countries.length, 'country', 'countries') + ' · about ' + u.money(pl.totals.total) + ' each · planned by ' + esc(g.organiser.name) + '</p>' +
        (G.mode() === 'local' ? '<div class="demo">DEMO: changes only sync between tabs of this browser. Set <code>GROUP_ENDPOINT</code> in config.js so mates on other phones count.</div>' : '') +
        '<div class="grp__top"><div class="meter"><div class="meter__hd"><b>' + plural(ins, 'mate') + ' in</b><span>' + (hasAll ? perk : 'Squad perks apply on ALL IN trips') + '</span></div><div class="meter__bar"><i style="width:' + Math.min(100, ins / 6 * 100) + '%"></i><u style="left:50%"><em>3 · 50% off</em></u><u style="left:100%"><em>6 · free</em></u></div>' +
        '<div class="who">' + (g.members.length ? g.members.map(function (m) { return '<span class="chip" style="' + (m.in ? 'background:var(--lime)' : '') + '">' + esc(m.name) + (m.in ? ' · in' : '') + '</span>'; }).join('') : '<span class="fine">Nobody has joined yet. Send them the link.</span>') + '</div></div>' +
        '<div class="invite"><span class="over">Invite link</span><div class="sharebox"><input class="input" readonly value="' + esc(inviteLink(g.id)) + '" id="invl" aria-label="Invite link"><button class="btn btn--sm" data-act="ginv" type="button">Copy</button></div>' +
        '<a class="btn btn--sm btn--pink" target="_blank" rel="noopener" href="https://wa.me/?text=' + encodeURIComponent('Help plan our trip: ' + MM.routeLine(pl) + ' ' + inviteLink(g.id)) + '">Send on WhatsApp</a></div></div>' +
        routesHTML(g) + stopsHTML(g, pl) + ideasHTML(g, pl) + meetHTML(g, pl) +
        '<div class="qnav">' + (me ? '<button class="btn ' + (me.in ? '' : 'btn--pink') + '" data-act="gin" type="button">' + (me.in ? 'You\'re in. Tap to step out' : 'I\'m in') + '</button>' : '') +
        (isOrg ? '<button class="btn" data-act="gapply" type="button">Apply ' + plural(ins, 'mate') + ' to my trip</button>' : '') + '<a class="btn btn--paper" href="' + esc(u.baseUrl() + '#/build/' + g.trip) + '">Open the trip in the builder</a></div></div></div></section>' + u.footer();
      var y = window.scrollY, sel = document.activeElement && document.activeElement.id === 'gsug' ? $('#gsug').value : null;
      root.innerHTML = h; window.scrollTo({ top: y, behavior: 'instant' });                             // keep the reader's place on live updates
      if (sel != null && $('#gsug')) $('#gsug').value = sel;
      root.onclick = function (e) {
        var b = e.target.closest('[data-act]'); if (!b) return; var act = b.getAttribute('data-act');
        var setG = function (patch, msg) { return G.setGroup(id, orgKey, patch).then(function (ng) { g = ng; paint(ng); if (msg) u.toast(msg); }).catch(function () { u.toast('Only the organiser can change the trip.'); }); };
        var setMe = function (patch) { return G.update(id, me.id, patch).then(function (ng) { g = ng; me = ng.members.filter(function (m) { return m.id === me.id; })[0] || me; paint(ng); }); };
        if (act === 'ginv') { u.copy(inviteLink(g.id)).then(function (ok) { u.toast(ok ? 'Invite link copied' : 'Couldn\'t copy'); }); }
        if (act === 'gvote' && me) { var v = {}; v[b.getAttribute('data-key')] = b.getAttribute('data-v'); me.votes[b.getAttribute('data-key')] = b.getAttribute('data-v'); G.update(id, me.id, { votes: v }).then(paint); }
        if (act === 'grv' && me) { setMe({ votes: { route: b.getAttribute('data-v') } }); u.track('group_route_vote'); }
        if (act === 'gwant' && me) {
          var k = b.getAttribute('data-k'), w = (me.wants || []).slice(), ix = w.indexOf(k); if (ix > -1) w.splice(ix, 1); else w.push(k);
          setMe({ wants: w }); u.track('group_want', { k: k });
        }
        if (act === 'gsug' && me) {
          var p = $('#gsug').value; if (!p) { u.toast('Pick a stop to suggest'); return; }
          var w2 = (me.wants || []).slice(); if (w2.indexOf('p:' + p) < 0) w2.push('p:' + p); setMe({ wants: w2 }).then(function () { u.toast('Suggested ' + P[p].n + ' to the crew'); });
        }
        if (act === 'gadd' && isOrg) { var k2 = b.getAttribute('data-k'), ns = addIdea(MM.decodeState(g.trip), k2); setG({ trip: MM.encodeState(ns) }, 'Added. Everyone sees the new trip now.'); u.track('group_idea_add'); }
        if (act === 'gaddb' && isOrg) { setG({ alt: builderTrip(), clearRouteVotes: true }, 'Route B is up for a vote'); u.track('group_route_b'); }
        if (act === 'gpickb' && isOrg) setG({ trip: g.alt, alt: '', clearRouteVotes: true }, 'Route B is now the trip');
        if (act === 'gdropb' && isOrg) setG({ alt: '', clearRouteVotes: true }, 'Sticking with Route A');
        if (act === 'gmytrip' && me) { setMe({ trip: builderTrip() }).then(function () { u.toast('Your route is in. Check where you cross.'); }); u.track('group_own_route'); }
        if (act === 'gmyclear' && me) setMe({ trip: '' });
        if (act === 'gbuild') { u.store('mm-back-group', id); }
        if (act === 'gin' && me) { me.in = !me.in; G.update(id, me.id, { in: me.in }).then(function (ng) { paint(ng); u.track('group_in', { in: me.in }); }); }
        if (act === 'gapply') { A.state = Object.assign(MM.defaultState(), MM.decodeState(g.trip)); A.state.crew = Math.min(8, G.ins(g)); u.persist(); u.go('build', MM.encodeState(A.state)); u.toast('Crew applied: ' + plural(A.state.crew, 'mate')); }
      };
    }
  }

  A.views.group = view; A.group = { start: start, addIdea: addIdea };
})();
