/* ============================================================
   PLACES — every Mad Monkey hostel (22) + Saigon (off-network).
   Hostel list, "from" dorm prices and Kampot's 1 Nov opening are
   from madmonkeyhostels.com (Oct 2026). Everything marked EDITORIAL
   (hooks, `next`, season ratings) is judgement, not booking data.

   id     — matches the madmonkeyhostels.com /destination/<id> slug
   c      — country code (TH LA VN KH ID PH)
   ll     — [lat, lon]
   bed    — dorm bed "from" price, USD / night
   sug    — suggested nights    min — fewest nights worth stopping
   ap     — airports/hubs this place connects to: [code, hours, USD]
   next   — EDITORIAL: where guests tend to go next (best first)
   tags   — vibe tags used by the matcher
   seas   — EDITORIAL: Jan→Dec, 3 = great, 2 = fine, 1 = wet / rough
   ============================================================ */
(function (r) {
  var MM = r.MM = r.MM || {};

  MM.COUNTRIES = {
    TH: { n: 'Thailand',    col: 'pink',   visa: 'Visa-free for most Western passports (30–60 days). Check yours.' },
    LA: { n: 'Laos',        col: 'cyan',   visa: 'Visa on arrival / e-visa for most passports. Check yours.' },
    VN: { n: 'Vietnam',     col: 'lime',   visa: 'E-visa for most passports (apply online before you fly). Check yours.' },
    KH: { n: 'Cambodia',    col: 'yellow', visa: 'E-visa or visa on arrival for most passports. Check yours.' },
    ID: { n: 'Indonesia',   col: 'orange', visa: 'Visa on arrival / e-VOA for most passports. Check yours.' },
    PH: { n: 'Philippines', col: 'blue',   visa: 'Visa-free for most Western passports (30 days). Check yours.' }
  };

  function P(id, n, c, ll, bed, sug, min, tags, hook, ap, next, seas, extra) {
    var o = { id: id, n: n, c: c, ll: ll, bed: bed, sug: sug, min: min, tags: tags.split(' '), hook: hook, ap: ap || [], next: next ? next.split(' ') : [], seas: seas };
    if (extra) for (var k in extra) o[k] = extra[k];
    MM.PLACES[id] = o; MM.PLACE_ORDER.push(id);
  }
  MM.PLACES = {}; MM.PLACE_ORDER = [];

  /* ---------- THAILAND ---------- */
  P('bangkok', 'Bangkok', 'TH', [13.7563, 100.5018], 11.92, 3, 2, 'city party culture food',
    'Neon, temples, street food and a rooftop pool. Everyone starts here.',
    [['BKK', 1.0, 12]], 'chiang-mai phuket siem-reap hanoi', '332222222233',
    { note: 'Hot Mar–May, wet May–Oct (it never stops the nights out).' });
  P('chiang-mai', 'Chiang Mai', 'TH', [18.7883, 98.9853], 8.94, 3, 2, 'culture food nature adventure party',
    'Temples, night markets, ethical elephants and the Ultimate Pub Crawl.',
    [['CNX', 0.4, 5]], 'pai luang-prabang bangkok', '321122222233',
    { note: 'Burning-season haze hits Feb–Apr. Best Nov–Jan.' });
  P('pai', 'Pai', 'TH', [19.3583, 98.44], 7.30, 3, 2, 'chill nature mountains party',
    'Hill-town hangs, canyon sunsets, tipsy tubing. 762 bends to get there.',
    [], 'chiang-mai luang-prabang', '321122222233',
    { note: 'Haze Feb–Apr. Rainy season turns it jungle-green.' });
  P('phuket', 'Phuket', 'TH', [7.8964, 98.2967], 11.92, 3, 2, 'beach party water city',
    'Patong Beach, Bangla Road, Phi Phi day trips. Loud on purpose.',
    [['HKT', 1.3, 20]], 'bangkok chiang-mai', '333211111123',
    { note: 'Andaman monsoon May–Oct: rough seas, some boat trips cancelled.' });

  /* ---------- LAOS ---------- */
  P('luang-prabang', 'Luang Prabang', 'LA', [19.8845, 102.1347], 6, 3, 2, 'culture chill nature food',
    'Golden temples, Kuang Si falls and a night market that runs the evening.',
    [['LPQ', 0.4, 5]], 'vang-vieng hanoi chiang-mai', '321122222233',
    { note: 'Smoky Mar–Apr. Waterfalls are at their best Jul–Nov.' });
  P('vang-vieng', 'Vang Vieng', 'LA', [18.9229, 102.4478], 6, 3, 2, 'adventure party nature',
    'Limestone karsts, blue lagoons, tipsy tubing. Pure chaos with a view.',
    [], 'luang-prabang hanoi', '321122222233',
    { note: 'River is wildest Jun–Oct; tubing is best in the drier months.' });

  /* ---------- VIETNAM ---------- */
  P('hanoi', 'Hanoi', 'VN', [21.0285, 105.8542], 6.76, 3, 2, 'city food culture party adventure moto',
    'Old Quarter chaos, bia hoi, Train Street. The gateway to the Loop and Ha Long.',
    [['HAN', 0.9, 10]], 'hoi-an luang-prabang bangkok saigon', '222322222332',
    { note: 'Oct–Nov and April are the sweet spots. Cool and drizzly Dec–Mar.' });
  P('hoi-an', 'Hoi An', 'VN', [15.8801, 108.338], 5.41, 4, 2, 'culture food beach chill',
    'Lantern-lit nights, bike rides, basket boats and beach days.',
    [['DAD', 0.75, 10]], 'saigon phnom-penh hanoi', '233333332112',
    { note: 'Wet and flood-prone Oct–Nov (typhoon season). Driest Feb–Aug.' });
  P('saigon', 'Ho Chi Minh City', 'VN', [10.8231, 106.6297], 8, 2, 1, 'city food culture party',
    'Motorbike madness, war history, rooftop bars. No Mad Monkey here yet.',
    [['SGN', 0.7, 8]], 'phnom-penh hoi-an', '333322222223',
    { partner: true, note: 'Off-network: we point you to a partner hostel (price is an estimate).' });

  /* ---------- CAMBODIA ---------- */
  P('phnom-penh', 'Phnom Penh', 'KH', [11.5564, 104.9282], 7, 3, 2, 'city culture party food',
    'Rooftop sunsets, hard history and a pool party that does not behave.',
    [['PNH', 0.7, 10]], 'siem-reap koh-rong kampot koh-sdach', '332222222233');
  P('siem-reap', 'Siem Reap', 'KH', [13.3633, 103.8564], 5, 3, 2, 'culture party adventure food',
    'Angkor at sunrise, Pub Street by night. Cambodia\'s big two-parter.',
    [['REP', 0.4, 7]], 'phnom-penh koh-rong bangkok', '332222222233');
  P('koh-rong', 'Koh Rong', 'KH', [10.727, 103.27], 9, 3, 2, 'beach party chill water',
    'Barefoot beach life, fire shows and a jungle rave that goes till sunrise.',
    [], 'koh-sdach kampot phnom-penh siem-reap', '333321111123',
    { note: 'Calm seas Nov–Apr. Rough, wet crossings May–Oct.' });
  P('koh-sdach', 'Koh Sdach', 'KH', [11.4608, 103.0105], 9, 3, 2, 'beach chill nature',
    'A tiny fishing island you will not find on most itineraries. Proper escape.',
    [], 'koh-rong phnom-penh kampot', '333321111123',
    { note: 'Calm seas Nov–Apr. Boats can be rough May–Oct.' });
  P('kampot', 'Kampot', 'KH', [10.6104, 104.1815], 10.5, 2, 1, 'chill nature food',
    'Riverside hangs, pepper farms and sunsets from the water. Opens 1 Nov.',
    [], 'koh-rong phnom-penh', '333222222233',
    { opens: '2026-11-01' });

  /* ---------- INDONESIA ---------- */
  P('uluwatu', 'Uluwatu', 'ID', [-8.8291, 115.0849], 16.22, 3, 2, 'surf beach party chill',
    'Cliff-top sunsets, world-class waves, beach clubs and an ice bath.',
    [['DPS', 1.2, 15]], 'nusa-lembongan gili-trawangan kuta-lombok', '112333333321',
    { note: 'Dry season Apr–Oct is surf season. Wetter Nov–Mar.' });
  P('nusa-lembongan', 'Nusa Lembongan', 'ID', [-8.6782, 115.4466], 7.27, 3, 2, 'beach water chill adventure',
    'Manta rays, mangroves and a day trip to Nusa Penida\'s postcard cliffs.',
    [], 'gili-trawangan uluwatu', '112333333321',
    { note: 'Dry season Apr–Oct is calmest. Mantas show up year-round.' });
  P('gili-trawangan', 'Gili Trawangan', 'ID', [-8.3524, 116.039], 8.11, 3, 2, 'beach party water dive chill',
    'Car-free party island. Boat parties, foam parties, turtles on tap.',
    [], 'kuta-lombok nusa-lembongan uluwatu', '112233333321',
    { note: 'Driest and calmest May–Oct.' });
  P('kuta-lombok', 'Kuta Lombok', 'ID', [-8.8886, 116.2818], 9.51, 4, 2, 'surf beach nature chill adventure',
    'Empty beaches, surf camp, waterfalls and the Rinjani trek on your doorstep.',
    [['LOP', 0.75, 10]], 'gili-trawangan uluwatu', '112333333321',
    { note: 'Surf best Apr–Oct. Rinjani trek is closed roughly Jan–Mar.' });

  /* ---------- PHILIPPINES ---------- */
  P('manila', 'Manila', 'PH', [14.5995, 120.9842], 10.36, 2, 1, 'city party culture food',
    'Rooftop sunsets, drag shows and the most underrated city in Southeast Asia.',
    [['MNL', 0.9, 8]], 'nacpan-beach panglao siargao', '333321111223');
  P('nacpan-beach', 'Nacpan Beach', 'PH', [11.2547, 119.3558], 8.93, 3, 2, 'beach chill party water',
    'Beachfront hostel, live DJs, front-row sunsets. El Nido\'s best beach, no queue.',
    [['ENI', 0.8, 6]], 'manila panglao', '333322111123',
    { note: 'Dry Dec–May. Typhoon-prone Jul–Oct.' });
  P('panglao', 'Panglao', 'PH', [9.5667, 123.7833], 7.57, 3, 2, 'beach water chill dive',
    'Dolphins at dawn, Balicasag snorkelling, Chocolate Hills on a day trip.',
    [['TAG', 0.4, 5]], 'siquijor dumaguete siargao', '333332222223');
  P('dumaguete', 'Dumaguete', 'PH', [9.3068, 123.3054], 7.97, 2, 1, 'chill city food adventure',
    'Easy university-town base for waterfalls, Apo Island and island-hopping onward.',
    [['DGT', 0.3, 4]], 'siquijor panglao', '333332222223');
  P('siquijor', 'Siquijor', 'PH', [9.1572, 123.5025], 8.37, 3, 2, 'beach nature chill adventure',
    'Cliff jumps, waterfall swims, scooter loops. Days vanish.',
    [], 'panglao dumaguete', '333332222223');
  P('siargao', 'Siargao', 'PH', [9.784, 126.1543], 10.36, 4, 2, 'surf beach party chill adventure',
    'Surf capital of the Philippines. Cloud 9 by day, island boat party by night.',
    [['IAO', 0.9, 8]], 'panglao manila', '223333333322',
    { note: 'Surf season Aug–Nov, but typhoon risk Oct–Dec.' });

  /* ---------- helpers ---------- */
  MM.isBeds = function (id) { var p = MM.PLACES[id]; return !!p && !p.partner; };

  if (typeof module !== 'undefined') module.exports = { PLACES: MM.PLACES, COUNTRIES: MM.COUNTRIES };
})(typeof window !== 'undefined' ? window : globalThis);
