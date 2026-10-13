/* ============================================================
   LEGS — the transport graph.

   EVERY NUMBER HERE IS A TYPICAL / ESTIMATED backpacker figure
   (researched Oct 2026, aggregator + operator pages, rounded).
   Door-to-door hours include waiting and transfers. Prices are
   one-way USD, economy / standard class. The UI always shows
   them as "~" and the crew confirms live fares before booking.
   Ops: this file is the one to sanity-check before launch.

   Edge: a, b   — place ids or hub/airport codes (both directions)
         m      — flight | bus | train | boat | van | taxi
         h, u   — door-to-door hours, USD
         ovn    — true if the journey is overnight (replaces a bed night)
         nights — nights spent on the move (slow boat = 2)
         mm     — Mad Monkey sells / arranges this leg (slug on madmonkeyhostels.com)
   ============================================================ */
(function (r) {
  var MM = r.MM = r.MM || {};
  MM.EDGES = [];

  function E(a, b, m, h, u, note, o) {
    var e = { a: a, b: b, m: m, h: h, u: u, note: note };
    if (o) for (var k in o) e[k] = o[k];
    MM.EDGES.push(e);
  }
  // flights: h = air time + 2h of airport faff; airport ↔ airport
  function F(a, b, air, u, note) { E(a, b, 'flight', Math.round((air + 2) * 10) / 10, u, note || 'Direct flight (~' + air + ' hr air time)'); }

  /* ---------- Thailand ---------- */
  E('bangkok', 'chiang-mai', 'bus', 11.5, 22, 'Overnight VIP bus', { ovn: true });
  E('bangkok', 'chiang-mai', 'train', 12.5, 32, 'Overnight sleeper train', { ovn: true });
  E('chiang-mai', 'pai', 'van', 3.5, 7, 'Minivan up the 762 bends');
  E('bangkok', 'phuket', 'bus', 13, 28, 'Overnight bus', { ovn: true });

  /* ---------- Laos ---------- */
  E('luang-prabang', 'vang-vieng', 'train', 2.2, 17, 'High-speed train (~1 hr) plus station transfers',
    { mm: 'luang-prabang-to-vang-vieng-second-class-ticket' });
  E('chiang-mai', 'luang-prabang', 'boat', 54, 80, 'Shuttle to Chiang Khong, border, 2-day slow boat, night in Pakbeng', { ovn: true, nights: 2 });
  E('luang-prabang', 'hanoi', 'bus', 24, 40, 'Cross-border sleeper bus (long)', { ovn: true });

  /* ---------- Vietnam ---------- */
  E('hanoi', 'hoi-an', 'bus', 17, 22, 'Sleeper bus', { ovn: true });
  E('hanoi', 'DAD', 'train', 15.5, 35, 'Reunification Express sleeper to Da Nang', { ovn: true });
  E('hoi-an', 'saigon', 'bus', 23, 32, 'Sleeper bus (very long)', { ovn: true });
  E('saigon', 'phnom-penh', 'bus', 7, 13, 'Bus via the Moc Bai border');
  E('DAD', 'saigon', 'train', 17, 40, 'Reunification Express sleeper', { ovn: true });

  /* ---------- Cambodia ---------- */
  E('phnom-penh', 'siem-reap', 'bus', 6.5, 12, 'Bus (~6 hrs)');
  E('phnom-penh', 'SIHA', 'bus', 5.5, 12, 'Bus to Sihanoukville');
  E('phnom-penh', 'koh-sdach', 'boat', 5.5, 24, 'Bus (~4 hrs) to Kiri Sakor + Mad Monkey private boat (~10 min)');
  E('phnom-penh', 'kampot', 'bus', 3.5, 8, 'Bus (~3.5 hrs)');
  E('kampot', 'SIHA', 'van', 2.5, 7, 'Minivan');
  E('siem-reap', 'SIHA', 'bus', 11.5, 20, 'Night bus (long)', { ovn: true });
  E('SIHA', 'koh-rong', 'boat', 1.7, 14, 'Ferry (~45 min) plus pier transfers');
  E('SIHA', 'koh-sdach', 'boat', 2.8, 30, 'Boat (~1h45) plus transfers');

  /* ---------- Indonesia ---------- */
  E('uluwatu', 'nusa-lembongan', 'boat', 2.7, 32, 'Transfer to Sanur + fast boat (~30 min)');
  E('uluwatu', 'gili-trawangan', 'boat', 5, 50, 'Transfer to Padang Bai + fast boat (~2–3 hrs)');
  E('nusa-lembongan', 'gili-trawangan', 'boat', 3.7, 45, 'Fast boat via Padang Bai');
  E('gili-trawangan', 'kuta-lombok', 'boat', 3, 28, 'Boat to Bangsal + shared transfer (~2.5 hrs)');
  E('DPS', 'nusa-lembongan', 'boat', 2, 28, 'Transfer to Sanur + fast boat');
  E('DPS', 'gili-trawangan', 'boat', 4.5, 45, 'Transfer to Padang Bai + fast boat');
  E('gili-trawangan', 'LOP', 'van', 2.4, 22, 'Boat + transfer to Lombok airport');

  /* ---------- Philippines ---------- */
  E('dumaguete', 'siquijor', 'boat', 2, 10, 'Ferry (~1 hr) plus island transfer');
  E('siquijor', 'panglao', 'boat', 3.7, 20, 'Ferry to Tagbilaran (~2 hrs) + transfer to Panglao');
  E('panglao', 'CEB', 'boat', 3.5, 20, 'Ferry to Cebu (~2 hrs) plus transfers');
  E('dumaguete', 'CEB', 'bus', 6.5, 14, 'Bus + ferry via Santander (~6 hrs)');

  /* ---------- Flights (airport ↔ airport) ---------- */
  F('BKK', 'CNX', 1.2, 38);   F('BKK', 'HKT', 1.4, 38);   F('BKK', 'HAN', 2.0, 75);   F('BKK', 'SGN', 1.7, 65);
  F('BKK', 'DAD', 1.9, 85);   F('BKK', 'PNH', 1.2, 70);   F('BKK', 'REP', 1.0, 60);   F('BKK', 'LPQ', 1.8, 125);
  F('BKK', 'DPS', 5.8, 150);  F('BKK', 'MNL', 3.6, 120);  F('CNX', 'LPQ', 0.9, 140);
  F('HAN', 'DAD', 1.3, 45);   F('HAN', 'SGN', 2.0, 55);   F('HAN', 'PNH', 2.1, 110);  F('HAN', 'REP', 1.9, 105);
  F('HAN', 'LPQ', 1.2, 110);  F('DAD', 'SGN', 1.4, 40);   F('SGN', 'PNH', 1.0, 65);   F('SGN', 'REP', 1.3, 75);
  F('SGN', 'DPS', 3.3, 140);  F('SGN', 'MNL', 2.7, 115);  F('PNH', 'REP', 1.0, 55);
  F('DPS', 'LOP', 0.8, 35);
  F('MNL', 'ENI', 1.3, 95);   F('MNL', 'CEB', 1.5, 55);   F('MNL', 'IAO', 1.9, 90);   F('MNL', 'TAG', 1.5, 65);
  F('MNL', 'DGT', 1.5, 70);   F('CEB', 'IAO', 1.0, 65);

  /* ---------- Mad Monkey packages that bundle a leg with experiences ---------- */
  MM.LEG_PKGS = {
    'phnom-penh|siem-reap': [
      { n: 'The Mad Package · 3 days', usd: 50, slug: 'the-mad-package-3-day-phnom-penh-to-siem-reap' },
      { n: 'The Mad Package · 5 days', usd: 60, slug: 'the-mad-package-phnom-penh-to-siem-reap' }],
    'koh-rong|siem-reap': [
      { n: 'The Mad Package · 3 days', usd: 70, slug: 'the-mad-package-koh-rong-to-siem-reap-3-day-package' },
      { n: 'The Mad Package · 5 days', usd: 80, slug: 'the-mad-package-koh-rong-to-siem-reap-5-day-package' }]
  };

  /* ---------- Mad Monkey sells these tickets directly ---------- */
  MM.TICKETS = {
    'luang-prabang|vang-vieng': [
      { n: 'Hard seat', usd: 13, slug: 'luang-prabang-to-vang-vieng-hard-seat-ticket' },
      { n: '2nd class', usd: 17, slug: 'luang-prabang-to-vang-vieng-second-class-ticket' },
      { n: '1st class', usd: 22, slug: 'luang-prabang-to-vang-vieng-first-class-ticket' }]
  };

  /* ---------- Borders ---------- */
  // Flip `open` to true when the Thailand–Cambodia land crossings reopen. There are no
  // overland edges between the two in the graph above, so this is a message for the UI.
  MM.BORDERS = {
    'TH-KH': { open: false, note: 'Thailand ↔ Cambodia: the land border has been reported closed this year, so fly (Bangkok ↔ Siem Reap / Phnom Penh is ~1 hr). Check before you book.' }
  };

  MM.MODE_LABEL = { flight: 'Flight', bus: 'Bus', train: 'Train', boat: 'Boat', van: 'Minivan', taxi: 'Transfer' };

  if (typeof module !== 'undefined') module.exports = { EDGES: MM.EDGES };
})(typeof window !== 'undefined' ? window : globalThis);
