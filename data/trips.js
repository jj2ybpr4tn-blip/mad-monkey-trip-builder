/* ============================================================
   TRIPS
   ALL_IN   — the packaged crew trips (prices, departures, inclusions from
              madmonkeyhostels.com/all-in-trips + the trip PDFs, Oct 2026).
              Thailand + Laos are "soon" (launching). Laos is the internal
              proposal's recommended RRP and still needs sign-off.
   SPECIALS — one-off partner events (The Gap Collective).
   CLASSICS — DIY routes we recommend when nobody has a packaged trip for it.
              Used by the quiz matcher. EDITORIAL.

   A stop is { p: placeId, n: hostelNights, acts: [activityId…] }.
   S(place, nights, ['name fragment', …]) finds activities by name so this
   file never has to know generated ids.
   ============================================================ */
(function (r) {
  var MM = r.MM = r.MM || {};

  function find(place, frag) {
    var list = MM.actsAt(place), f = frag.toLowerCase();
    for (var i = 0; i < list.length; i++) if (list[i].n.toLowerCase().indexOf(f) > -1) return list[i].id;
    throw new Error('trips.js: no activity "' + frag + '" at ' + place);
  }
  function S(p, n, frags) { return { p: p, n: n, acts: (frags || []).map(function (f) { return find(p, f); }) }; }

  MM.ALLIN_URL = 'https://madmonkeyhostels.com/all-in-trips';
  MM.DEPOSIT = 99;

  MM.INCLUDED = ['Dorm beds at Mad Monkey', 'All scheduled transport: transfers, buses, island boats', 'Every activity in the itinerary',
    'Loads of free drinks', 'A free pre-night: arrive the night before and it\'s on us', '24/7 local crew', 'A crew of up to 20'];
  MM.NOT_INCLUDED = ['Flights', 'Travel insurance', 'Personal spending', 'Upgrades + add-ons'];
  MM.SQUAD = [{ mates: 3, perk: '50% off', long: 'Rally 3 mates and the Squad Leader gets 50% off.' },
              { mates: 6, perk: 'free', long: 'Rally 6 mates and the Squad Leader goes free.' }];

  MM.ALL_IN = [
    { id: 'vietnam', nStops: 5, n: 'Vietnam', tag: 'Hanoi → Lan Ha Bay → Ha Giang Loop → Ninh Binh → Hoi An', kicker: 'Northern + Central', days: 14, usd: 850,
      dep: 3, until: 'Apr 2027', status: 'live', col: 'lime', max: 20, meals: '11 breakfasts · 7 lunches · 5 dinners',
      pitch: 'Beer Street in Hanoi, an overnight cruise through Lan Ha Bay, the Loop at altitude, Ninh Binh\'s water caves, then Hoi An. Every bucket-list moment, one crew.',
      hl: ['Ma Pi Leng Pass', 'Ninh Binh', 'Bamboo boats', 'Train Street'], img: ['ninh-binh-day-trip-hoa-lu-trang-an-mua-cave', 'hanoi'],
      stops: [S('hanoi', 4, ['Lan Ha', 'Ha Giang Loop · 4 days, Easy', 'Ninh Binh', 'Street food + Train', 'White Party']), S('hoi-an', 4, ['Cooking class', 'Sunset river', 'Basket', 'bike tour'])] },
    { id: 'loop', nStops: 2, n: 'Ha Giang Loop', tag: 'Hanoi → Ha Giang Loop', kicker: 'Short + spicy', days: 7, usd: 310,
      dep: 3, until: 'Apr 2027', status: 'live', col: 'pink', max: 20, meals: '7 breakfasts · 3 lunches · 4 dinners',
      pitch: 'Street food in Hanoi, then four days through towering peaks, epic passes and homestay dinners on the legendary Loop.',
      hl: ['Train Street', 'Khau Lan Waterfall', 'Ma Pi Leng Pass', 'Ancient villages'], img: ['the-ha-giang-loop-tour-4d-3n-easy-rider', 'hanoi'],
      stops: [S('hanoi', 3, ['Ha Giang Loop · 4 days, Easy', 'Street food + Train', 'Hanoi pub crawl'])] },
    { id: 'cambodia', nStops: 4, n: 'Cambodia', tag: 'Phnom Penh → Siem Reap → Koh Rong → Koh Sdach', kicker: 'Coast to coast', days: 14, usd: 600,
      dep: 4, until: 'Apr 2027', status: 'live', col: 'yellow', max: 20, meals: '1 breakfast · 3 lunches · 5 dinners',
      pitch: 'Phnom Penh\'s history and nightlife, Angkor Wat, a beach party and sunrise rave on Koh Rong, then the hidden oasis of Koh Sdach.',
      hl: ['Angkor Wat', 'Beach fire show', 'Koh Rong', 'Koh Sdach'], img: ['sunrise-angkor-wat-temple-tour', 'koh-rong'],
      stops: [S('phnom-penh', 3, ['S21', 'Sunset river', 'Khmer family', 'Pool party']), S('siem-reap', 4, ['Sunrise Angkor', 'Pub Street', 'floating village', 'pizza']),
              S('koh-rong', 3, ['volleyball', 'fire show']), S('koh-sdach', 3, ['E-bike', 'sunset cruise', 'Snorkelling'])] },
    { id: 'indonesia', nStops: 4, n: 'Indonesia', tag: 'Uluwatu → Nusa Lembongan → Gili T → Kuta Lombok', kicker: 'Island hopping', days: 12, usd: 650,
      dep: 6, until: 'Apr 2027', status: 'live', col: 'orange', max: 20, meals: '4 breakfasts · 5 lunches · 5 dinners',
      pitch: 'Cliffside Uluwatu and a Mt Batur sunrise, manta rays off Nusa Penida, a car-free party island on Gili T, then surf camp in Lombok.',
      hl: ['Mt Batur sunrise', 'Snorkel with turtles', 'Foam party', 'Surf camp'], img: ['mt-batur-sunrise-trekking', 'gili-trawangan-boat-party'],
      stops: [S('uluwatu', 2, ['Mt Batur']), S('nusa-lembongan', 3, ['Nusa Penida', 'Snorkelling (three']), S('gili-trawangan', 3, ['Boat party', 'Foam party', 'Snorkelling adventure']),
              S('kuta-lombok', 3, ['Surf lesson', 'Lombok family'])] },
    { id: 'gili-lombok', nStops: 2, n: 'Gili T + Lombok', tag: 'Gili Trawangan → Kuta Lombok', kicker: 'Short + spicy', days: 7, usd: 450,
      dep: 4, until: 'Apr 2027', status: 'live', col: 'cyan', max: 20, meals: '4 breakfasts · 5 dinners',
      pitch: 'The 7-day sun-and-surf escape: boat parties and snorkelling on car-free Gili T, then your first waves at surf camp in Lombok.',
      hl: ['Boat party', 'Foam party', 'Snorkelling', 'Surf camp'], img: ['gili-trawangan-boat-party', 'surf-camp'],
      stops: [S('gili-trawangan', 3, ['Boat party', 'Foam party', 'Snorkelling adventure']), S('kuta-lombok', 3, ['Surf lesson', 'Secret Gili'])] },
    { id: 'thailand', nStops: 3, n: 'Thailand', tag: 'Bangkok → Chiang Mai → Pai', kicker: 'Temples + jungle', days: 11, usd: 340,
      dep: 2, until: '', status: 'soon', col: 'pink', max: 20, meals: 'Welcome BBQ in Chiang Mai + elephant-day lunch',
      pitch: 'Temples, jungle, waterfalls and legendary Mad Monkey nights, from the chaos of Bangkok to the mountains of Pai. 10 nights of beds, every intercity transfer, every activity.',
      hl: ['Elephant sanctuary', 'Bamboo rafting', 'Lod Cave', 'Tipsy tubing'], img: ['karaoke-night-bkk', 'chiang-mai'],
      stops: [S('bangkok', 2, ['Old Town', 'Bangkok pub crawl', 'Beats']), S('chiang-mai', 3, ['Elephant', 'Day Party', 'Ultimate Pub Crawl', 'Grand Canyon']),
              S('pai', 3, ['Tipsy tubing', 'Lod Cave', 'Sunset at Pai']), S('chiang-mai', 1, ['Game Night'])] },
    { id: 'laos', nStops: 4, n: 'Laos', tag: 'Luang Prabang → Nong Khiaw → Muang Ngoi → Vang Vieng', kicker: 'Waterfalls + karsts', days: 10, usd: 449,
      dep: 0, until: '', status: 'soon', col: 'cyan', max: 20, meals: 'Lunch on the Kuang Si + Vang Vieng tours',
      pitch: 'Golden temples and Kuang Si falls, a mountain camp and river villages around Nong Khiaw, then caves, kayaking, ziplines and a sunset paramotor in Vang Vieng.',
      hl: ['Kuang Si Falls', 'Nong Khiaw viewpoint', 'Sunset paramotor', 'Tipsy tubing'], img: ['kuang-si-waterfall', 'vang-vieng-tipsy-tubing'],
      stops: [S('luang-prabang', 4, ['Kuang Si', 'Nong Khiaw', 'Stories of', 'Jewellery', 'Night market']), S('vang-vieng', 3, ['paramotor', 'Blue Lagoons', 'Zipline', 'Tipsy tubing', 'pub crawl'])] }
  ];

  MM.SPECIALS = [
    { id: 'gap', n: 'The Gap Collective', tag: 'Bangkok → Phuket → Chiang Mai → Hanoi → Ha Giang → Hoi An → Phnom Penh → Koh Rong → Koh Sdach',
      kicker: '31 days · 3 countries · 1,500-person island festival', days: 31, gbp: 1995, dates: '16 Nov – 16 Dec 2026', col: 'lime',
      pitch: 'A month, nine stops and the Ha Giang Loop, ending on a private island with a 1,500-person festival. Run with Collective Experiences.',
      url: 'https://madmonkeyhostels.com/gapcollective',
      stops: [S('bangkok', 3, []), S('phuket', 2, []), S('chiang-mai', 3, []), S('hanoi', 5, ['Ha Giang Loop · 4 days, Easy']), S('hoi-an', 3, []), S('phnom-penh', 2, []), S('koh-rong', 3, []), S('koh-sdach', 3, [])] }
  ];

  /* ---------- DIY classics (EDITORIAL) ----------
     tags    — what it feels like; the quiz vibes are matched against these
     gate    — places you can sensibly land at (first or last stop)
     opt     — stop indexes that can be dropped to shorten the trip
     min/ideal — rough day range it works at */
  MM.CLASSICS = [
    { id: 'bkk-phuket', n: 'Bangkok + Phuket', tag: 'Bangkok → Phuket', pitch: 'Big-city neon, then Patong Beach and a Phi Phi day trip. Loud, sunny, easy.', tags: 'city party beach food', gate: ['bangkok', 'phuket'], min: 6, ideal: 8, col: 'pink',
      stops: [S('bangkok', 3, ['Old Town', 'Bangkok pub crawl']), S('phuket', 4, ['Phi Phi', 'Bangla Road'])] },
    { id: 'thai-laos-boat', n: 'Thailand → Laos by slow boat', tag: 'Chiang Mai → Luang Prabang → Vang Vieng', pitch: 'The classic: Chiang Mai, two days down the Mekong, then waterfalls and tubing in Laos.', tags: 'culture nature adventure chill party', gate: ['chiang-mai', 'vang-vieng'], min: 11, ideal: 14, col: 'cyan',
      stops: [S('chiang-mai', 3, ['Elephant', 'Ultimate Pub Crawl']), S('luang-prabang', 3, ['Kuang Si']), S('vang-vieng', 3, ['Tipsy tubing', 'Blue Lagoons'])] },
    { id: 'northern-loop', n: 'Thailand → Laos → Vietnam', tag: 'Bangkok → Chiang Mai → Luang Prabang → Vang Vieng → Hanoi + the Loop', pitch: 'Three countries, one rolling adventure, ending on the Ha Giang Loop. The northern backpacker trail.', tags: 'culture adventure moto party nature food', gate: ['bangkok', 'hanoi'], min: 19, ideal: 24, col: 'lime',
      stops: [S('bangkok', 2, ['Old Town']), S('chiang-mai', 3, ['Elephant']), S('luang-prabang', 3, ['Kuang Si']), S('vang-vieng', 2, ['Tipsy tubing']), S('hanoi', 4, ['Ha Giang Loop · 4 days, Easy', 'Street food + Train'])] },
    { id: 'vietnam-long', n: 'Vietnam, top to bottom', tag: 'Hanoi + Loop → Hoi An → Ho Chi Minh City', pitch: 'The full length of Vietnam: the Loop, lantern-lit Hoi An, then Saigon chaos.', tags: 'moto adventure food culture city', gate: ['hanoi', 'saigon'], min: 14, ideal: 18, col: 'lime',
      stops: [S('hanoi', 4, ['Ha Giang Loop · 4 days, Easy', 'Street food + Train']), S('hoi-an', 4, ['Cooking class', 'Sunset river']), S('saigon', 3, ['Cu Chi', 'Street food by scooter'])] },
    { id: 'vietnam-cambodia', n: 'Vietnam → Cambodia', tag: 'Hoi An → Ho Chi Minh City → Phnom Penh → Siem Reap → Koh Rong', pitch: 'Beach and lanterns, Saigon, then Cambodia\'s history, Angkor and a proper island finish.', tags: 'culture food beach party', gate: ['hoi-an', 'koh-rong', 'saigon'], min: 14, ideal: 17, col: 'yellow',
      stops: [S('hoi-an', 3, ['Cooking class']), S('saigon', 2, ['Cu Chi']), S('phnom-penh', 3, ['S21']), S('siem-reap', 3, ['Sunrise Angkor']), S('koh-rong', 3, ['volleyball'])] },
    { id: 'temples-islands', n: 'Bangkok + Cambodia', tag: 'Bangkok → Siem Reap → Phnom Penh → Koh Rong → Koh Sdach', pitch: 'Fly Bangkok to Siem Reap (the land border is closed), then Angkor, Phnom Penh and two island stops.', tags: 'culture beach party chill', gate: ['bangkok', 'koh-sdach'], min: 14, ideal: 17, col: 'yellow',
      stops: [S('bangkok', 3, ['Old Town']), S('siem-reap', 3, ['Sunrise Angkor']), S('phnom-penh', 3, ['S21']), S('koh-rong', 3, ['volleyball']), S('koh-sdach', 2, ['E-bike'])] },
    { id: 'bali-chill', n: 'Uluwatu + Nusa Lembongan', tag: 'Uluwatu → Nusa Lembongan', pitch: 'Cliff-top surf town, then manta rays and Penida cliffs. A proper Bali week.', tags: 'surf beach chill water party', gate: ['uluwatu', 'nusa-lembongan'], min: 6, ideal: 8, col: 'orange',
      stops: [S('uluwatu', 4, ['Surf lesson', 'Mt Batur']), S('nusa-lembongan', 3, ['Nusa Penida', 'Snorkelling (three'])] },
    { id: 'lombok-surf', n: 'Lombok Surf Camp', tag: 'Kuta Lombok', pitch: 'Seven days learning to surf on empty beaches, with waterfalls and Rinjani on the side.', tags: 'surf beach chill nature', gate: ['kuta-lombok'], min: 5, ideal: 8, col: 'blue',
      stops: [S('kuta-lombok', 7, ['Surf Camp · 7 days'])] },
    { id: 'rinjani-gili', n: 'Gili T + Rinjani', tag: 'Gili Trawangan → Kuta Lombok', pitch: 'Dive and party on Gili T, then trek a volcano and surf Lombok.', tags: 'dive trek adventure party water', gate: ['gili-trawangan', 'kuta-lombok'], min: 8, ideal: 10, col: 'orange',
      stops: [S('gili-trawangan', 4, ['Discover scuba', 'Boat party']), S('kuta-lombok', 5, ['Rinjani', 'Surf lesson'])] },
    { id: 'visayas', n: 'Visayas island trio', tag: 'Panglao → Siquijor → Dumaguete', pitch: 'Dolphins, cliff jumps and waterfalls across three Philippine islands by ferry.', tags: 'beach nature adventure chill water', gate: ['panglao', 'dumaguete', 'siquijor'], min: 7, ideal: 10, col: 'blue',
      stops: [S('panglao', 3, ['Dolphins']), S('siquijor', 3, ['Scooter', 'countryside']), S('dumaguete', 2, ['Valencia', 'Apo Island'])] },
    { id: 'palawan-siargao', n: 'Palawan + Siargao', tag: 'Manila → Nacpan → Siargao', pitch: 'Manila rooftops, El Nido\'s best beach, then surf-capital Siargao.', tags: 'beach surf party chill adventure', gate: ['manila', 'siargao'], min: 11, ideal: 14, col: 'blue',
      stops: [S('manila', 1, ['Manila pub crawl']), S('nacpan-beach', 4, ['island hopping', 'Sunset cruise']), S('siargao', 5, ['Surf lesson', 'Tri Island Party'])] },
    { id: 'siargao-surf', n: 'Siargao Surf Camp', tag: 'Siargao', pitch: 'A week in the Philippines\' surf capital with the all-inclusive Surf Camp.', tags: 'surf beach party chill', gate: ['siargao'], min: 5, ideal: 8, col: 'blue',
      stops: [S('siargao', 6, ['Surf Camp · 7D/6N'])] },
    { id: 'indochina-grand', n: 'The Grand Trail', tag: 'Bangkok → Chiang Mai → Laos → Hanoi + Loop → Hoi An → Phnom Penh → Siem Reap → Koh Rong', pitch: 'Five-week epic across four countries. The whole banana-pancake trail, no shortcuts.', tags: 'culture adventure moto party beach food nature', gate: ['bangkok', 'koh-rong'], min: 32, ideal: 40, col: 'pink',
      stops: [S('bangkok', 3, ['Old Town']), S('chiang-mai', 3, ['Elephant']), S('pai', 2, ['Tipsy tubing']), S('luang-prabang', 3, ['Kuang Si']), S('vang-vieng', 3, ['Tipsy tubing']),
              S('hanoi', 4, ['Ha Giang Loop · 4 days, Easy']), S('hoi-an', 4, ['Cooking class']), S('phnom-penh', 3, ['S21']), S('siem-reap', 3, ['Sunrise Angkor']), S('koh-rong', 3, ['volleyball'])] }
  ];

  /* Official day-by-day (condensed from the ALL IN trip PDFs). Shown inside an ALL IN block. */
  MM.ALL_IN_ROUTE = {
    vietnam: [['1–2', 'Hanoi', 'Welcome drinks, street food + bia hoi night, guided walking tour (Hoan Kiem Lake, Train Street), music quiz.'],
      ['3–4', 'Lan Ha Bay', 'Overnight cruise: swimming, tubing, beach volleyball, sunset boat party, kayaking. Back to Hanoi for the White Party.'],
      ['5–9', 'Ha Giang Loop', '4 days riding the mountains: Ma Pi Leng Pass, ancient villages, hidden waterfalls, local homestays.'],
      ['10', 'Ninh Binh', 'Full-day tour: Tam Coc sampan boat through emerald caves. Then a VIP cabin sleeper bus south.'],
      ['11–14', 'Hoi An', 'Sunset pool party + BBQ, cycling and lantern workshop, basket boats, cooking class, sunset river cruise.']],
    loop: [['1–2', 'Hanoi', 'Welcome drinks, street food + bia hoi night, guided walking tour (Hoan Kiem Lake, St. Joseph\'s, Train Street), music quiz.'],
      ['3', 'To Ha Giang', 'Easy day in Hanoi, then travel north and get ready for the ride.'],
      ['4–7', 'Ha Giang Loop', '4-day mountain ride: winding passes, Ma Pi Leng, ancient villages, hidden waterfalls and homestay dinners.'],
      ['8', 'Departure', 'Last breakfast together. Head home, or ask the team about extending south to Ninh Binh and Hoi An.']],
    cambodia: [['1–3', 'Phnom Penh', 'Khmer family dinner, S21 + Killing Fields tour, sunset river cruise, hostel BBQ and pool party.'],
      ['4–7', 'Siem Reap', 'Make-your-own pizza night, messy pub crawl, Tonle Sap floating village, Angkor Wat sunrise tour.'],
      ['8–11', 'Koh Rong', 'Beach olympics, fireshows, bottomless brunch with live DJ, then Nestival: a beach + jungle rave until sunrise.'],
      ['12–14', 'Koh Sdach', 'E-bike island loop, waterpolo, island-hopping sunset cruises, beach fishing and a final pizza night.']],
    indonesia: [['1–2', 'Uluwatu', 'Welcome sunset at Panorama Point, Mt Batur sunrise trek, then sauna, hot tub and ice bath recovery.'],
      ['3–5', 'Nusa Lembongan', 'Fast boat over, manta ray snorkelling, a full-day Nusa Penida island-hopping trip, karaoke night.'],
      ['6–8', 'Gili Trawangan', 'Mexican family dinner, foam party with a live DJ, the Mad Monkey Boat Party and an unlimited BBQ.'],
      ['9', 'To Lombok', '\'Monkey See, Monkey Do\' snorkel trip, then the boat across to Kuta Lombok.'],
      ['10–12', 'Surf camp', '3 days of surf lessons at the best beach for the swell, with video analysis and nightly hostel events.']],
    'gili-lombok': [['1–3', 'Gili Trawangan', 'Welcome drink + pool, Mexican family dinner, foam party with live DJ, the Boat Party and unlimited BBQ.'],
      ['4', 'To Kuta Lombok', '\'Monkey See, Monkey Do\' snorkel trip, then boat + shuttle to Mad Monkey Kuta Lombok.'],
      ['5–7', 'Surf camp', 'Gear fitting + pop-up practice, morning surf sessions, photo and video analysis, karaoke and a pool party.'],
      ['8', 'Departure', 'Shuttle to Lombok Airport for your onward flight.']],
    thailand: [['1–3', 'Bangkok', 'Pool + Beats and Bingo on arrival, Old Town tour (markets, temples, canals), the Bangkok Pub Crawl. Overnight bus north on day 3.'],
      ['4–6', 'Chiang Mai', 'Day Party + BBQ, Ultimate Pub Crawl, Grand Canyon water park, Game Night, then elephant sanctuary + bamboo rafting.'],
      ['7–9', 'Pai', 'The 762-bend minivan, canyon sunset, tipsy tubing, Lod Cave tour, pub quiz + Pai pub crawl.'],
      ['10', 'Chiang Mai', 'Minivan back down the mountain, Bar Olympics + karaoke to send the trip off.'],
      ['11', 'Onward', 'Check out and carry on: back to Bangkok, on to Hanoi, or wherever is next.']],
    laos: [['1–3', 'Luang Prabang', 'Night market dinner, Kuang Si Falls tour, Stories of Luang Prabang culture tour, jewellery making.'],
      ['4–6', 'Nong Khiaw + Muang Ngoi', 'Mountain-top camp, boat to a Khmu village + waterfall, car-free Muang Ngoi homestay, back to Luang Prabang.'],
      ['7–10', 'Vang Vieng', 'High-speed train, sunset paramotor, Blue Lagoons + cave + kayak day, zipline, tipsy tubing, farewell night out.']]
  };

  MM.gap = MM.SPECIALS[0];
  MM.tripById = function (id) { var all = MM.ALL_IN.concat(MM.SPECIALS, MM.CLASSICS); for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i]; return null; };

  /* quiz: where are you landing? */
  MM.GATEWAYS = [
    { id: 'bangkok', n: 'Bangkok', sub: 'Thailand', place: 'bangkok' },
    { id: 'hanoi', n: 'Hanoi', sub: 'Vietnam', place: 'hanoi' },
    { id: 'saigon', n: 'Ho Chi Minh City', sub: 'Vietnam', place: 'saigon' },
    { id: 'bali', n: 'Bali', sub: 'Indonesia', place: 'uluwatu' },
    { id: 'manila', n: 'Manila', sub: 'Philippines', place: 'manila' },
    { id: 'phnom-penh', n: 'Phnom Penh', sub: 'Cambodia', place: 'phnom-penh' },
    { id: 'any', n: 'Not booked yet', sub: 'You tell me', place: null }
  ];

  if (typeof module !== 'undefined') module.exports = { ALL_IN: MM.ALL_IN, CLASSICS: MM.CLASSICS };
})(typeof window !== 'undefined' ? window : globalThis);
