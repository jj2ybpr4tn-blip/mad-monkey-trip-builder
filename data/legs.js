/* ============================================================
   LEGS — the transport graph.

   EVERY NUMBER HERE IS A TYPICAL / ESTIMATED backpacker figure
   (researched Oct 2026, aggregator + operator pages, rounded).
   Door-to-door hours include waiting and transfers. Prices are
   one-way USD, economy / standard class. The UI always shows
   them as "~" and the crew confirms live fares before booking.
   Ops: this file is the one to sanity-check before launch.

   Edge: a, b   — place ids or hub/airport codes (both directions). Hubs in capitals are airports, or towns a journey
                  passes through that aren't stops of their own (SIHA, KRATIE, DONDET, PAKSE, HUAYXAI, CORON)
         m      — flight | bus | train | boat | van | taxi
         h, u   — door-to-door hours, USD
         ovn    — true if the journey is overnight (replaces a bed night)
         stay   — true if the journey takes a night or two in a guesthouse on the way (the slow boat's Pakbeng); its bed is in u,
                  and h is the hours on the move, not counting the nights
         nights — nights spent on the way (an overnight journey is 1 unless it says; the slow boat = 2)
         mm     — Mad Monkey sells / arranges this leg (slug on madmonkeyhostels.com)
         dows   — the weekdays a flight runs (0 = Sun), when it doesn't fly every day
         at     — { airport: hour } when a flight leaves at a set time from that end (19.5 = 7:30pm)
         leaves — { place: hour } when a bus or boat leaves at a known hour from that end

   The Smart pick goes by land and sea wherever there's a reasonable way (logic.js, route): so every overland and sea
   link the crews use belongs here, with flights only where there's nothing else.
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
  function F(a, b, air, u, note, o) { E(a, b, 'flight', Math.round((air + 2) * 10) / 10, u, note || 'Direct flight (~' + air + ' hr air time)', o); }

  /* ---------- Thailand ---------- */
  E('bangkok', 'chiang-mai', 'bus', 11.5, 22, 'Overnight VIP bus', { ovn: true });
  E('bangkok', 'chiang-mai', 'train', 12.5, 32, 'Overnight sleeper train', { ovn: true });
  E('chiang-mai', 'pai', 'van', 3.5, 7, 'Minivan up the 762 bends');
  E('bangkok', 'phuket', 'bus', 13, 28, 'Overnight bus', { ovn: true });

  /* ---------- Laos ---------- */
  E('luang-prabang', 'vang-vieng', 'train', 2.2, 17, 'High-speed train (~1 hr) plus station transfers',
    { mm: 'luang-prabang-to-vang-vieng-second-class-ticket' });
  E('luang-prabang', 'hanoi', 'bus', 24, 40, 'Cross-border sleeper bus (long)', { ovn: true });
  E('VTE', 'vang-vieng', 'train', 2.2, 15, 'Transfer to Vientiane station + high-speed train (~1 hr)');

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

  /* ---------- Overland and by sea, the way the crews travel (Nov 2026): typical fares from the booking sites (goasia.cc, 12Go, Giant Ibis,
     bustickets.ph), rounded ---------- */
  // Saigon to Siem Reap in one go: Giant Ibis leaves Saigon at 15:45 and gets in about 05:00; Siem Reap to Saigon leaves at 21:45.
  E('saigon', 'siem-reap', 'bus', 13.5, 50, 'Night bus over the Moc Bai border, through Phnom Penh', { ovn: true, leaves: { saigon: 15.75, 'siem-reap': 21.75 } });
  // Phnom Penh to southern Laos and Vientiane: Kratie, the border at Trapeang Kriel, the 4,000 Islands, Pakse, then the night bus.
  E('phnom-penh', 'KRATIE', 'bus', 5.5, 13, 'Bus up the Mekong to Kratie (~5 hrs)');
  E('KRATIE', 'DONDET', 'van', 6, 28, 'Van over the Trapeang Kriel border and the boat to Don Det, with a night on the island (guesthouse in the price)', { stay: true, nights: 1 });
  E('DONDET', 'PAKSE', 'boat', 3.5, 11, 'Boat to Nakasong and the van to Pakse (~3 hrs)');
  E('PAKSE', 'VTE', 'bus', 10.5, 22, 'VIP night bus to Vientiane (~10 hrs, from about 20:00)', { ovn: true });
  // The Mekong slow boat between Luang Prabang and Huay Xai (2 days), and over the Friendship Bridge to Chiang Mai: together, Chiang Mai to Luang Prabang.
  E('luang-prabang', 'HUAYXAI', 'boat', 19, 40, 'Slow boat on the Mekong, 2 days, with a night in Pakbeng and one in Huay Xai (guesthouses in the price)', { stay: true, nights: 2 });
  E('HUAYXAI', 'chiang-mai', 'van', 7, 27, 'Over the Friendship Bridge to Chiang Khong, then the van or bus to Chiang Mai (~6–7 hrs)');
  // Manila to Palawan by sea: the night ferry to Coron (Atienza or 2GO, a few sailings a week, about 12 hrs, can run late), then the fast ferry to El Nido.
  E('manila', 'CORON', 'boat', 13, 25, 'Night ferry to Coron (~12 hrs; a few sailings a week, so the crew checks the day)', { ovn: true, leaves: { manila: 16 } });
  E('CORON', 'nacpan-beach', 'boat', 4.5, 45, 'Fast ferry from Coron to El Nido (~3.5 hrs) and the van up to Nacpan Beach');

  /* ---------- Philippines ---------- */
  E('dumaguete', 'siquijor', 'boat', 2, 10, 'Ferry (~1 hr) plus island transfer');
  E('siquijor', 'panglao', 'boat', 3.7, 20, 'Ferry to Tagbilaran (~2 hrs) + transfer to Panglao');
  E('panglao', 'CEB', 'boat', 3.5, 20, 'Ferry to Cebu (~2 hrs) plus transfers');
  E('dumaguete', 'CEB', 'bus', 6.5, 14, 'Bus + ferry via Santander (~6 hrs)');

  /* ---------- Flights (airport ↔ airport) ---------- */
  F('BKK', 'CNX', 1.2, 38);   F('BKK', 'HKT', 1.4, 38);   F('BKK', 'HAN', 2.0, 75);   F('BKK', 'SGN', 1.7, 65);
  F('BKK', 'DAD', 1.9, 85);   F('BKK', 'PNH', 1.2, 70);   F('BKK', 'REP', 1.0, 60);   F('BKK', 'LPQ', 1.8, 125);
  F('BKK', 'DPS', 5.8, 150);  F('BKK', 'MNL', 3.6, 120);  F('CNX', 'LPQ', 0.9, 140);
  F('BKK', 'VTE', 1.3, 115, 'Direct flight to Vientiane (~1h20 air time): THAI from Suvarnabhumi, Thai AirAsia from Don Mueang');
  F('HAN', 'DAD', 1.3, 45);   F('HAN', 'SGN', 2.0, 55);   F('HAN', 'PNH', 2.1, 110);  F('HAN', 'REP', 1.9, 105);
  // Vietnam Airlines is the only direct one, and it doesn't fly Tuesdays or Sundays (Google Flights, 3 Nov 2026, Apr–May 2027 and Dec 2026)
  F('HAN', 'LPQ', 1.1, 150, 'Direct flight, Vietnam Airlines (~1 hr air time): Mon, Wed, Thu, Fri and Sat', { dows: [1, 3, 4, 5, 6], at: { LPQ: 19.5, HAN: 13.2 } });
  F('DAD', 'SGN', 1.4, 40);   F('SGN', 'PNH', 1.0, 65);   F('SGN', 'REP', 1.3, 75);
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
