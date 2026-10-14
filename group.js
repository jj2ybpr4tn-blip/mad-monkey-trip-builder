/* ============================================================
   GROUP MODE — mates vote on stops, the Squad Leader perk ticks up.
   Pure data layer (no DOM). Two adapters:
     • local   — localStorage + storage events. Works across tabs on ONE browser, so you can
                 see it live in demo, but real friends need the remote adapter.
     • remote  — set MM_CONFIG.GROUP_ENDPOINT. Contract in docs/GROUP.md.
   Group shape: { id, trip:'<encodeState string>', organiser:{id,name}, created, members:[{id,name,in:bool,votes:{ 'i:place': 'y'|'m'|'n' }}] }
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
      g.members.forEach(function (m) { if (m.id === memberId) { if (patch.in != null) m.in = !!patch.in; if (patch.votes) for (var k in patch.votes) m.votes[k] = patch.votes[k]; } });
      localSet(g); return Promise.resolve(g);
    },
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
