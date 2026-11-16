/* ============================================================
   GROUP MODE — mates vote on stops, the Squad Leader perk ticks up.
   Pure data layer (no DOM). Two adapters:
     • local   — localStorage + storage events. Works across tabs on ONE browser, so you can
                 see it live in demo, but real friends need the remote adapter.
     • remote  — set MM_CONFIG.GROUP_ENDPOINT. Contract in docs/GROUP.md.
   Group shape: { id, trip:'<encodeState>', alt:'<encodeState>'|'' (Route B), organiser:{id,name}, created,
                  members:[{ id, name, in:bool, votes:{ 'i:place': 'y'|'m'|'n', route:'a'|'b' }, wants:['p:<place>'|'a:<actId>'], trip:'<their own route>' }] }
   ============================================================ */
(function (r) {
  var MM = r.MM = r.MM || {};
  function uid(n) { var s = 'abcdefghjkmnpqrstuvwxyz23456789', o = ''; for (var i = 0; i < (n || 6); i++) o += s[Math.floor(Math.random() * s.length)]; return o; }
  function cfg() { return (r.MM_CONFIG && r.MM_CONFIG.GROUP_ENDPOINT) || ''; }
  var KEY = function (id) { return 'mm-group-' + id; };

  function localGet(id) { try { return JSON.parse(localStorage.getItem(KEY(id))); } catch (e) { return null; } }
  function localSet(g) { try { localStorage.setItem(KEY(g.id), JSON.stringify(g)); } catch (e) { /* storage unavailable */ } }
  function http(method, path, body) {
    return fetch(cfg().replace(/\/$/, '') + path, { method: method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
      .then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); });
  }

  var G = MM.Group = {
    mode: function () { return cfg() ? 'remote' : 'local'; },
    create: function (trip, name) {
      var g = { id: uid(6), trip: trip, organiser: { id: uid(8), name: name || 'Squad Leader' }, created: new Date().toISOString(), members: [] };
      if (!cfg()) { localSet(g); return Promise.resolve(g); }
      return http('POST', '/groups', g).then(function (x) { return x && x.id ? x : g; });
    },
    get: function (id) { return cfg() ? http('GET', '/groups/' + encodeURIComponent(id)) : Promise.resolve(localGet(id)); },
    // Per-member operations (never rewrite the whole group), so two people joining or voting at the same moment can't overwrite each other.
    join: function (id, name) {
      if (cfg()) return http('POST', '/groups/' + encodeURIComponent(id) + '/members', { name: name }).then(function (x) { return G.get(id).then(function (g) { return { g: g, me: x.member || x }; }); });
      var g = localGet(id); if (!g) return Promise.reject(new Error('not found'));
      var m = { id: uid(8), name: name, in: false, votes: {} }; g.members.push(m); localSet(g); return Promise.resolve({ g: g, me: m });
    },
    update: function (id, memberId, patch) {
      if (cfg()) return http('PATCH', '/groups/' + encodeURIComponent(id) + '/members/' + encodeURIComponent(memberId), patch).then(function () { return G.get(id); });
      var g = localGet(id); if (!g) return Promise.reject(new Error('not found'));
      g.members.forEach(function (m) { if (m.id === memberId) { if (patch.in != null) m.in = !!patch.in; if (patch.votes) for (var k in patch.votes) m.votes[k] = patch.votes[k]; if (patch.wants) m.wants = patch.wants.slice(0, 24); if (patch.trip != null) m.trip = patch.trip; } });
      localSet(g); return Promise.resolve(g);
    },
    // organiser-only: change the shared trip or the Route B option. orgKey is the organiser id saved on create.
    setGroup: function (id, orgKey, patch) {
      if (cfg()) return http('PATCH', '/groups/' + encodeURIComponent(id), Object.assign({ org: orgKey }, patch)).then(function () { return G.get(id); });
      var g = localGet(id); if (!g) return Promise.reject(new Error('not found'));
      if (patch.trip != null) g.trip = patch.trip; if (patch.alt != null) g.alt = patch.alt;
      if (patch.clearRouteVotes) g.members.forEach(function (m) { delete m.votes.route; });
      localSet(g); return Promise.resolve(g);
    },
    // ideas from the crew: [{ k:'p:pai'|'a:<actId>', who:[names] }], most wanted first
    ideas: function (g) {
      var by = Object.create(null);
      g.members.forEach(function (m) { (Array.isArray(m.wants) ? m.wants : []).forEach(function (k) { (by[k] = by[k] || []).push(m.name); }); });
      return Object.keys(by).map(function (k) { return { k: k, who: by[k] }; }).sort(function (a, b) { return b.who.length - a.who.length; });
    },
    routeVotes: function (g) { var t = { a: 0, b: 0 }; g.members.forEach(function (m) { var v = m.votes.route; if (v === 'a' || v === 'b') t[v]++; }); return t; },
    // live updates: storage events for local, 5s polling for remote
    watch: function (id, cb) {
      var stop = false, t;
      function tick() { if (stop) return; G.get(id).then(function (g) { if (g && !stop) cb(g); }).catch(function () {}).then(function () { if (!stop && cfg()) t = setTimeout(tick, 5000); }); }
      function onStore(e) { if (e.key === KEY(id)) tick(); }
      tick(); r.addEventListener('storage', onStore);
      return function () { stop = true; clearTimeout(t); r.removeEventListener('storage', onStore); };
    },
    tally: function (g, key) {
      var t = { y: 0, m: 0, n: 0 }; g.members.forEach(function (m) { var v = m.votes[key]; if (v && t[v] != null) t[v]++; }); return t;
    },
    ins: function (g) { return g.members.filter(function (m) { return m.in; }).length; }
  };
  if (typeof module !== 'undefined') module.exports = G;
})(typeof window !== 'undefined' ? window : globalThis);
