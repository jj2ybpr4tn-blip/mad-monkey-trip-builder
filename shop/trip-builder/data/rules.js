/* ============================================================
   RULES — the numbers behind the visa-length check and the festival + closure calendar.
   Visa limits mirror the plain-English text in data/entry.js (checked Oct 2026).
   Festival dates were checked against public sources in Oct 2026. Anything marked
   conf:false is a forecast or a proposal (lunar calendars and government holiday
   decisions move), and the app says so. Re-check each autumn.
   ============================================================ */
(function (r) {
  var MM = r.MM = r.MM || {};

  /* ---------- how long a guest can stay, per country and passport ----------
     days: the number the check compares against. how: 'free' | 'voa' | 'evisa' | 'check'.
     null days = we don't know for that passport, so the app asks them to check rather than guess. */
  var P = ['gb', 'us', 'au', 'ca', 'eu', 'other'];
  function all(o, def) { var out = {}; P.forEach(function (p) { out[p] = o[p] || def || { days: null, how: 'check' }; }); return out; }
  var TH30 = { days: 30, how: 'free', extend: 'Extend 30 days at an immigration office (~1,900 THB), or apply for a 60-day TR e-visa before you fly.' };
  var PH30 = { days: 30, how: 'free', extend: 'You can extend at a Bureau of Immigration office in the Philippines.' };
  MM.STAY = {
    TH: all({ gb: TH30, us: TH30, au: TH30, ca: TH30, eu: TH30 }),
    LA: all({}, { days: 30, how: 'voa', extend: 'E-visas can\'t be extended. A visa on arrival can usually be extended once at immigration in Vientiane. Check the official site.' }),
    VN: all({
      gb: { days: 45, how: 'free', extend: 'Apply for an e-visa (up to 90 days) before you fly if you want longer.' },
      eu: { days: 45, how: 'free', note: 'Most EU passports (not Ireland) get 45 days. Ireland needs an e-visa.', extend: 'Apply for an e-visa (up to 90 days) before you fly if you want longer.' },
      us: { days: 90, how: 'evisa', extend: 'The e-visa is for up to 90 days. Apply online before you fly.' },
      au: { days: 90, how: 'evisa', extend: 'The e-visa is for up to 90 days. Apply online before you fly.' },
      ca: { days: 90, how: 'evisa', extend: 'The e-visa is for up to 90 days. Apply online before you fly.' }
    }, { days: 90, how: 'evisa', extend: 'Apply for the e-visa online before you fly.' }),
    KH: all({}, { days: 30, how: 'voa', extend: 'You can extend once at an immigration office in Phnom Penh (about $45).' }),
    ID: all({}, { days: 30, how: 'voa', extend: 'A visa on arrival can be extended once for another 30 days at an immigration office.' }),
    PH: all({ gb: PH30, us: PH30, au: PH30, ca: PH30, eu: PH30 })
  };

  /* ---------- the calendar ----------
     kind: 'closure' (things shut / airport closed), 'festival' (great, but book early), 'peak' (busy + dear), 'info'.
     sev: 1 = good to know, 2 = plan around it, 3 = it will change your trip.
     where: country codes (c) and/or specific hostels (at). If both, a stop matches either.
     spans: explicit date ranges, or a rule: { fixed:'04-13/04-15' } every year, { fullmoon:true }, { holyweek:true }. */
  MM.CALENDAR = [
    { id: 'tet', n: 'Tet (Vietnamese New Year)', kind: 'closure', sev: 3, c: ['VN'],
      spans: [{ from: '2027-02-01', to: '2027-02-11', conf: false, core: '4–10 Feb' }, { from: '2028-01-21', to: '2028-01-31', conf: false, core: '23–29 Jan' }],
      impact: 'Vietnam\'s biggest holiday. Many shops, restaurants and tour operators close for days, trains and buses sell out a week either side, and fares jump.',
      advice: 'Book every bus, train and flight early, expect some closures, and base yourself on the coast. Or travel outside it.' },
    { id: 'cny', n: 'Chinese New Year crowds', kind: 'peak', sev: 2, c: ['TH', 'KH'],
      spans: [{ from: '2027-02-04', to: '2027-02-14', conf: false }, { from: '2028-01-24', to: '2028-02-03', conf: false }],
      impact: 'Big regional travel peak. Flights, hotels and popular day tours fill up and cost more, especially Bangkok, Phuket and Siem Reap.',
      advice: 'Book transport and your Angkor or island trips early.' },
    { id: 'songkran', n: 'Songkran water festival', kind: 'festival', sev: 2, c: ['TH'], spans: [{ fixed: '04-13/04-15' }],
      impact: 'Thailand\'s New Year is a nationwide water fight. It is a brilliant few days. Everyone gets soaked, many shops close, and transport is packed.',
      advice: 'Keep your phone in a dry bag, book buses early, and treat Chiang Mai as the main event.' },
    { id: 'pimai', n: 'Pi Mai (Lao New Year)', kind: 'festival', sev: 2, c: ['LA'], spans: [{ fixed: '04-14/04-16' }],
      impact: 'Water festival and processions. Luang Prabang is at its best and busiest, and many businesses close.',
      advice: 'Book Luang Prabang beds and the Kuang Si trip ahead.' },
    { id: 'khmerny', n: 'Khmer New Year', kind: 'closure', sev: 2, c: ['KH'], spans: [{ fixed: '04-13/04-16' }],
      impact: 'Cambodians travel home. Phnom Penh goes quiet, buses to Siem Reap and the coast fill, and the water-throwing starts.',
      advice: 'Book buses and boats early. Siem Reap is lively, Phnom Penh is sleepy.' },
    { id: 'loy', n: 'Loy Krathong + Yi Peng lanterns', kind: 'festival', sev: 2, c: ['TH'], at: ['chiang-mai', 'pai'],
      spans: [{ from: '2026-11-23', to: '2026-11-26', conf: true }, { from: '2027-11-12', to: '2027-11-15', conf: false }, { from: '2028-11-01', to: '2028-11-03', conf: false }],
      impact: 'Thousands of lanterns over Chiang Mai. Unforgettable, and beds in the north sell out weeks ahead.',
      advice: 'Lock in Chiang Mai and Pai beds early. Dates follow the full moon, so check the official ones closer to the time.' },
    { id: 'fullmoon', n: 'Full Moon Party night', kind: 'info', sev: 1, c: ['TH'], spans: [{ fullmoon: true }],
      impact: 'Koh Phangan\'s famous beach party runs on the full moon. It is not a Mad Monkey stop, so it is a ferry-and-flight detour.',
      advice: 'Only worth planning around if it is on your list.' },
    { id: 'nyepi', n: 'Nyepi (Bali Day of Silence)', kind: 'closure', sev: 3, c: [], at: ['uluwatu', 'nusa-lembongan'],
      // Indonesia's 2027 public holiday list (the three-minister decree) sets Nyepi on Monday 8 March: silence from 6am on the 8th to 6am on the 9th
      spans: [{ from: '2027-03-07', to: '2027-03-09', conf: true, core: '8 Mar' }],
      impact: 'Bali shuts down for 24 hours. The airport closes, nobody goes outside, and there is no traffic or noise. Nusa Lembongan observes it too.',
      advice: 'Be in your hostel the day before and don\'t book a flight or boat that day. It can be a very peaceful day. Confirm the date locally.' },
    { id: 'ramadan', n: 'Ramadan + Eid (Lebaran)', kind: 'closure', sev: 2, c: [], at: ['kuta-lombok', 'gili-trawangan'],
      spans: [{ from: '2027-02-08', to: '2027-03-12', conf: false, core: '8 Feb – 9/10 Mar' }, { from: '2028-01-28', to: '2028-02-29', conf: false, core: '28 Jan – 26/27 Feb' }],
      impact: 'A Muslim-majority part of Indonesia. Some daytime places open late or close, and the days around Eid (Lebaran) are the busiest travel days of the year, so boats and flights are packed.',
      advice: 'Respect fasting hours in public, book boats and flights early around Eid, and expect a quieter, more local feel.' },
    { id: 'holyweek', n: 'Holy Week (Semana Santa)', kind: 'closure', sev: 2, c: ['PH'], spans: [{ holyweek: true }],
      impact: 'The Philippines nearly stops from Maundy Thursday to Easter. Transport is jammed, many shops and bars shut, and some places don\'t sell alcohol. Siquijor has its famous Holy Week healing festival.',
      advice: 'Book ferries and flights early and have a plan for Thursday and Friday.' },
    { id: 'pchumben', n: 'Pchum Ben', kind: 'closure', sev: 2, c: ['KH'],
      spans: [{ from: '2027-09-29', to: '2027-10-01', conf: false }],
      impact: 'Cambodia\'s ancestors\' festival. Many people return to their home towns, so buses fill up and some businesses close.',
      advice: 'Book buses early and don\'t be surprised by closed shops.' },
    { id: 'natday', n: 'Vietnam National Day', kind: 'peak', sev: 1, c: ['VN'],
      spans: [{ from: '2027-09-01', to: '2027-09-05', conf: false }],
      impact: 'A long weekend. Locals travel, so beach towns and Hanoi trains are busy.',
      advice: 'Book trains and coastal beds ahead.' },
    { id: 'xmas', n: 'Christmas + New Year peak', kind: 'peak', sev: 2, c: ['TH', 'LA', 'VN', 'KH', 'ID', 'PH'], spans: [{ fixed: '12-20/01-05' }],
      impact: 'The busiest and dearest weeks of the year across the region. Popular hostels, island boats and flights sell out.',
      advice: 'Book early and avoid one-night stops. It is worth paying for a bed you have held.' }
  ];

  /* ---------- big days: the nights a whole town comes out for, worth building a trip around ----------
     The calendar above is about what to plan around; these are what to aim for. The trip builder shows which ones a trip
     catches, which it just misses (with one tap to move the dates) and, for a trip without dates, when to go (extras.js MM.bigDays).
     Dates checked in November 2026 against official calendars and the local press, the same list the ALL IN site uses.
     conf: true = set by law, by the sky or announced; false = expected from the lunar calendar, confirm closer to the time.
     cal: use that calendar entry's dates. newmoon: the nights around every new moon. w: how big (3 = worth flying for). */
  MM.BIGDAYS = [
    { id: 'songkran', n: 'Songkran', title: 'The world\'s biggest water fight', at: ['chiang-mai', 'bangkok', 'pai', 'phuket'], w: 3, cal: 'songkran',
      blurb: 'Thai New Year. A quiet blessing from the elders in the morning, then three days of water fights. Chiang Mai\'s old city moat is the heart of it.' },
    { id: 'pimai', n: 'Pi Mai', title: 'Lao New Year', at: ['luang-prabang', 'vang-vieng'], w: 2, cal: 'pimai',
      blurb: 'Processions, sand stupas along the Mekong and a water fight that takes over Luang Prabang.' },
    { id: 'yipeng', n: 'Yi Peng and Loy Krathong', title: 'Lanterns over Chiang Mai', at: ['chiang-mai', 'pai'], w: 3, cal: 'loy',
      blurb: 'Candles in every temple doorway and krathongs floating down the river. Releasing sky lanterns in the city is banned: the big releases are licensed, ticketed events outside town.' },
    { id: 'waterfest', n: 'Water Festival', title: 'Long boats racing the river', at: ['siem-reap'], w: 3,
      spans: [{ from: '2026-11-23', to: '2026-11-24', conf: true }, { from: '2027-11-12', to: '2027-11-14', conf: false }],
      blurb: 'Bon Om Touk, when the Tonle Sap turns and flows the other way: crews of dozens race long boats and lit floats drift past after dark. Phnom Penh called its races off in 2025 and 2026; Siem Reap kept racing.' },
    { id: 'firebats', n: 'Lai Heua Fai', title: 'Fire boats on the Mekong', at: ['luang-prabang'], w: 3, spans: [{ from: '2027-10-15', to: '2027-10-16', conf: false }],
      blurb: 'The end of Buddhist Lent: every neighbourhood builds a boat of lights and floats it down the river after dark.' },
    { id: 'ogoh', n: 'Ogoh-ogoh night', title: 'Demons by torchlight, then silence', at: ['uluwatu', 'nusa-lembongan'], w: 3, spans: [{ from: '2027-03-07', to: '2027-03-07', conf: true }],
      blurb: 'On the eve of Nyepi every village parades the giant ogoh-ogoh it has built, then burns it. The next day, 8 March, the whole island stops, the airport too: be in your hostel.' },
    { id: 'tet', n: 'Tet', title: 'Vietnamese New Year\'s Eve in Hanoi', at: ['hanoi'], w: 2, spans: [{ from: '2027-02-05', to: '2027-02-06', conf: true }, { from: '2028-01-25', to: '2028-01-26', conf: true }],
      blurb: 'Peach blossom everywhere, fireworks at midnight, then the quietest days of Hanoi\'s year while families celebrate at home. Book every bus and train early.' },
    { id: 'lantern', n: 'Lantern night', title: 'Hoi An lit only by lanterns', at: ['hoi-an'], w: 1,
      spans: ['2026-11-22', '2026-12-22', '2027-01-21', '2027-02-19', '2027-03-21', '2027-04-20', '2027-05-19', '2027-06-18', '2027-07-17', '2027-08-15', '2027-09-14', '2027-10-13', '2027-11-11', '2027-12-11'].map(function (d) { return { from: d, to: d, conf: false }; }),
      blurb: 'Once a month, the night before the full moon, the old town turns its electric lights off. Silk lanterns along the streets, paper ones floating down the river.' },
    { id: 'equinox', n: 'Equinox sunrise', title: 'The sun on Angkor\'s central tower', at: ['siem-reap'], w: 1,
      spans: [{ from: '2027-03-19', to: '2027-03-23', conf: true }, { from: '2027-09-21', to: '2027-09-25', conf: true }],
      blurb: 'For a few mornings around each equinox the sun comes up right over the central tower of Angkor Wat, seen from the western causeway.' },
    { id: 'galungan', n: 'Galungan', title: 'Bamboo arches over every street', at: ['uluwatu', 'nusa-lembongan'], w: 1,
      spans: [{ from: '2027-01-13', to: '2027-01-23', conf: true }, { from: '2027-08-11', to: '2027-08-21', conf: true }],
      blurb: 'For ten days Bali welcomes its ancestors home: every house raises a penjor, a tall bamboo pole curving over the street, hung with offerings.' },
    { id: 'flowers', n: 'Flower Festival', title: 'A parade made of flowers', at: ['chiang-mai'], w: 1, spans: [{ from: '2027-02-05', to: '2027-02-07', conf: false }],
      blurb: 'The north\'s cool-season blooms built into floats, with the parade on Saturday 6 February 2027, the festival\'s 50th year.' },
    { id: 'vegfest', n: 'Vegetarian Festival', title: 'Nine days of processions', at: ['phuket'], w: 1, spans: [{ from: '2027-09-30', to: '2027-10-08', conf: false }],
      blurb: 'Phuket Town\'s shrines take to the streets for the Nine Emperor Gods: processions, firecrackers and yellow-flag food stalls.' },
    { id: 'buffalo', n: 'Buffalo races', title: 'Buffalo racing to the pagoda', at: ['phnom-penh'], w: 1, spans: [{ from: '2027-09-30', to: '2027-09-30', conf: false }],
      blurb: 'On the last day of Pchum Ben, the village of Vihear Suor, about 40 km from Phnom Penh, races its buffalo down to the pagoda, riders bareback.' },
    { id: 'plankton', n: 'Glowing plankton', title: 'Swim in glowing plankton', at: ['koh-rong'], w: 1, spans: [{ newmoon: 2 }],
      blurb: 'In the dark nights around every new moon, the water off Koh Rong lights up blue wherever you move.' }
  ];

  if (typeof module !== 'undefined') module.exports = { STAY: MM.STAY, CALENDAR: MM.CALENDAR, BIGDAYS: MM.BIGDAYS };
})(typeof window !== 'undefined' ? window : globalThis);
