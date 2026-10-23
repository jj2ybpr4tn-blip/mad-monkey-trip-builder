/* ============================================================
   ACTIVITIES — what you can do at each Mad Monkey.

   Real tours: names/prices/days are from madmonkeyhostels.com/tours-events
   (Oct 2026). Each has a `slug` that deep-links to its booking page.
   `est: true` = no public price yet (Thailand + Laos trips launching
   soon, plus Kampot). Those are marked "est." in the UI and must be
   confirmed by ops. `usd: null` = "price on the day" (nights out).

   A(place, slug, name, cat, usd, slot, when, tags, flags)
     cat   epic (multi-day) | day | night
     slot  full | half | eve   (how much of a day it eats)
     when  weekdays it runs, e.g. 'Wed Sat' ('' = every day)
     flags star, est, multi:{d,n,covers}, note
       multi.n  = nights away (extends the stop; those nights are covered)
       multi.covers = package includes beds, so no hostel bed is charged
   ============================================================ */
(function (r) {
  var MM = r.MM = r.MM || {};
  MM.ACTS = {}; MM.ACT_BY_PLACE = {};
  var DOW = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

  function A(place, slug, name, cat, usd, slot, when, tags, f) {
    f = f || {};
    var id = slug || ('x-' + place + '-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40));
    if (MM.ACTS[id]) throw new Error('duplicate activity id ' + id);
    var dows = when ? when.split(/\s+/).map(function (d) { return DOW[d]; }) : null;
    var a = { id: id, slug: slug, p: place, n: name, cat: cat, usd: usd, slot: slot, dows: dows,
      when: when ? when.replace(/ /g, ', ') : 'Every day', tags: (tags || '').split(' ').filter(Boolean),
      est: !!f.est, star: !!f.star, multi: f.multi || null, note: f.note || '' };
    MM.ACTS[id] = a;
    (MM.ACT_BY_PLACE[place] = MM.ACT_BY_PLACE[place] || []).push(id);
  }
  var EST = { est: true };
  function st(o) { o.star = true; return o; }

  /* ---------------- HANOI ---------------- */
  A('hanoi', 'the-ha-giang-loop-tour-4d-3n-easy-rider', 'Ha Giang Loop · 4 days, Easy Rider', 'epic', 267, 'full', 'Sun Mon Wed Thu Fri', 'moto adventure mountains', st({ multi: { d: 4, n: 3 }, note: 'You ride pillion with a local rider. No licence needed.' }));
  A('hanoi', 'the-ha-giang-loop-tour-3d2n-easy-rider', 'Ha Giang Loop · 3 days, Easy Rider', 'epic', 215.3, 'full', 'Sun Mon Wed Thu Fri', 'moto adventure mountains', { multi: { d: 3, n: 2 } });
  A('hanoi', 'the-ha-giang-loop-tour-4d-3n-self-riding', 'Ha Giang Loop · 4 days, self-riding', 'epic', 205.27, 'full', 'Sun Mon Wed Thu Fri', 'moto adventure mountains', { multi: { d: 4, n: 3 }, note: 'You ride your own bike. Valid licence + real riding experience needed.' });
  A('hanoi', 'lan-ha-bay-2days-1night', 'Lan Ha Bay cruise · 2D/1N', 'epic', 152.41, 'full', '', 'water adventure chill', st({ multi: { d: 2, n: 1 } }));
  A('hanoi', 'ha-long-bay-legend-cruise-3-days-2-nights', 'Ha Long Bay Legend cruise · 3D/2N', 'epic', 265.84, 'full', '', 'water chill', { multi: { d: 3, n: 2 } });
  A('hanoi', 'sapa-trekking-tour-2d1n-homestay-group', 'Sapa trek + homestay · 2D/1N', 'epic', 88.17, 'full', '', 'trek mountains adventure culture', { multi: { d: 2, n: 1 } });
  A('hanoi', 'ha-long-bay-day-trip-from-to-hanoi', 'Ha Long Bay day trip', 'day', 55.95, 'full', '', 'water chill');
  A('hanoi', 'ninh-binh-day-trip-hoa-lu-trang-an-mua-cave', 'Ninh Binh · Trang An boats + Mua Cave', 'day', 48.23, 'full', '', 'nature culture adventure', { star: true });
  A('hanoi', 'hanoi-street-food-tour-train-street', 'Street food + Train Street', 'day', 40.52, 'eve', '', 'food culture', st({}));
  A('hanoi', 'hanoi-michelin-street-food-water-puppet-show', 'Michelin street food + water puppets', 'day', 40.52, 'eve', '', 'food culture');
  A('hanoi', 'hanoi-cooking-class', 'Hanoi cooking class', 'day', 25.08, 'half', '', 'food culture');
  A('hanoi', 'hanoi-pub-crawl', 'Hanoi pub crawl', 'night', 7.72, 'eve', 'Wed Sun', 'party');
  A('hanoi', 'white-party', 'Weekly White Party', 'night', 11.39, 'eve', 'Sat', 'party');

  /* ---------------- HOI AN ---------------- */
  A('hoi-an', 'sunset-river-cruise', 'Sunset river cruise', 'night', 19.3, 'eve', 'Mon Wed Fri', 'party chill', st({}));
  A('hoi-an', 'bicycle-tour', 'Countryside bike tour', 'day', 16.21, 'half', 'Sun Tue Thu', 'culture nature');
  A('hoi-an', 'basket-boats', 'Basket boats', 'day', 8.11, 'half', '', 'water culture');
  A('hoi-an', 'cooking-class', 'Cooking class + bamboo boats', 'day', 22, 'half', '', 'food culture', { star: true });
  A('hoi-an', 'vietnamese-coffee-making-class', 'Vietnamese coffee class', 'day', 17.37, 'half', '', 'food');
  A('hoi-an', 'sunrise-sunset-paddle-boarding', 'Sunrise / sunset paddle boarding', 'day', 27.78, 'half', '', 'water chill');
  A('hoi-an', 'cham-island-snorkelling-experience', 'Cham Island snorkelling', 'day', 57.88, 'full', '', 'water dive');
  A('hoi-an', 'cham-island-diving-non-certified', 'Cham Island try-dive (no cert)', 'day', 81.03, 'full', '', 'water dive adventure');
  A('hoi-an', 'my-son-sanctuary-morning', 'My Son sanctuary (morning)', 'day', 30.49, 'half', '', 'culture');
  A('hoi-an', 'marble-mountain-morning', 'Marble Mountain (morning)', 'day', 23.54, 'half', '', 'culture nature');
  A('hoi-an', 'ba-na-hills', 'Ba Na Hills + Golden Bridge', 'day', 65.98, 'full', '', 'adventure');
  A('hoi-an', 'hai-van-pass-hoi-an-day-trip-pillion-tour', 'Hai Van Pass · pillion day trip', 'day', 50.16, 'full', '', 'moto adventure mountains');
  A('hoi-an', 'the-weekly-foam-party', 'Weekly Foam Party', 'night', null, 'eve', 'Sat', 'party');

  /* ---------------- SAIGON (off-network) ---------------- */
  A('saigon', null, 'Cu Chi tunnels half-day', 'day', 25, 'half', '', 'culture', EST);
  A('saigon', null, 'Street food by scooter', 'day', 40, 'eve', '', 'food', EST);
  A('saigon', null, 'Mekong Delta day trip', 'day', 30, 'full', '', 'nature culture', EST);

  /* ---------------- LUANG PRABANG ---------------- */
  A('luang-prabang', 'kuang-si-waterfall', 'Kuang Si Falls · moon bears + swim', 'day', 15, 'full', '', 'nature water', st({}));
  A('luang-prabang', null, 'Nong Khiaw + Muang Ngoi adventure (3D/2N)', 'epic', 95, 'full', '', 'nature adventure culture', st({ est: true, multi: { d: 3, n: 2 }, note: 'Mountain camp above Nong Khiaw, Nam Ou river boat, homestay in car-free Muang Ngoi.' }));
  A('luang-prabang', null, 'Stories of Luang Prabang culture tour', 'day', 14, 'half', '', 'culture', EST);
  A('luang-prabang', null, 'Jewellery making at Garden of Eden', 'day', 8, 'half', '', 'culture', EST);
  A('luang-prabang', null, 'MandaLao ethical elephants', 'day', 99, 'half', '', 'wildlife', EST);
  A('luang-prabang', null, 'Night market food walk', 'night', null, 'eve', '', 'food culture');

  /* ---------------- VANG VIENG ---------------- */
  A('vang-vieng', 'vang-vieng-tipsy-tubing', 'Tipsy tubing on the Nam Song', 'day', 7.05, 'half', '', 'party water adventure', st({}));
  A('vang-vieng', 'vang-vieng-pub-crawl', 'Vang Vieng pub crawl', 'night', 6.82, 'eve', 'Wed Sat', 'party');
  A('vang-vieng', null, 'Blue Lagoons, Nang Far cave + kayak (full day)', 'day', 45, 'full', '', 'nature water adventure', st(EST));
  A('vang-vieng', null, 'Sunset paramotor over the karsts', 'day', 130, 'eve', '', 'adventure', st(EST));
  A('vang-vieng', null, 'Zipline + Phakai viewpoint', 'day', 20, 'half', '', 'adventure nature', EST);
  A('vang-vieng', null, 'Sunrise hot air balloon', 'day', 110, 'half', '', 'adventure nature', EST);

  /* ---------------- BANGKOK ---------------- */
  A('bangkok', null, 'Old Town tour · markets, temples + canals', 'day', 25, 'half', '', 'culture food', st(EST));
  A('bangkok', null, 'Bangkok pub crawl', 'night', 12, 'eve', '', 'party', st(EST));
  A('bangkok', null, 'Beats + Bingo', 'night', null, 'eve', '', 'party');
  A('bangkok', 'karaoke-night-bkk', 'Karaoke night', 'night', null, 'eve', 'Wed', 'party');
  A('bangkok', null, 'Floating market + railway market day', 'day', 35, 'full', '', 'culture food', EST);

  /* ---------------- CHIANG MAI ---------------- */
  A('chiang-mai', null, 'Elephant sanctuary + bamboo rafting', 'day', 60, 'full', '', 'wildlife water nature', st(EST));
  A('chiang-mai', null, 'Mad Monkey Day Party + BBQ', 'night', 15, 'eve', '', 'party', EST);
  A('chiang-mai', null, 'Chiang Mai Ultimate Pub Crawl', 'night', 12, 'eve', '', 'party', st(EST));
  A('chiang-mai', null, 'Grand Canyon water park', 'day', 12, 'half', '', 'water adventure', EST);
  A('chiang-mai', null, 'Doi Suthep temple + sunset', 'day', 15, 'half', '', 'culture nature', EST);
  A('chiang-mai', null, 'Thai cooking class', 'day', 30, 'half', '', 'food culture', EST);
  A('chiang-mai', null, 'Ultimate Game Night', 'night', null, 'eve', '', 'party');

  /* ---------------- PAI ---------------- */
  A('pai', null, 'Tipsy tubing', 'day', 12, 'half', '', 'party water adventure', st(EST));
  A('pai', null, 'Lod Cave day tour', 'day', 25, 'full', '', 'nature adventure water', st(EST));
  A('pai', null, 'Sunset at Pai Canyon / Two Huts', 'day', 8, 'eve', '', 'nature chill', EST);
  A('pai', null, 'Pai pub crawl', 'night', 10, 'eve', '', 'party', EST);
  A('pai', 'pub-quiz-mmpai', 'Pub quiz', 'night', null, 'eve', 'Mon', 'party');

  /* ---------------- PHUKET ---------------- */
  A('phuket', null, 'Phi Phi Islands day trip', 'day', 50, 'full', '', 'water beach adventure', st(EST));
  A('phuket', null, 'Bangla Road crawl', 'night', 15, 'eve', '', 'party', st(EST));
  A('phuket', null, 'Sundown Sessions beach club', 'night', null, 'eve', '', 'party beach');
  A('phuket', 'phuket-bar-olympics', 'Bar Olympics', 'night', null, 'eve', 'Mon', 'party');
  A('phuket', 'pool-and-foam-party', 'Pool + Foam Party', 'night', null, 'eve', 'Sat', 'party');

  /* ---------------- PHNOM PENH ---------------- */
  A('phnom-penh', 's21-and-killing-fields-tour', 'S21 + Killing Fields', 'day', 32, 'half', '', 'culture', st({}));
  A('phnom-penh', 'tuk-tuk-city-tour', 'Tuk-tuk city tour', 'day', 10, 'half', 'Mon Wed Sat', 'culture');
  A('phnom-penh', 'phnom-penh-bike-boat-adventure', 'Bike + boat adventure', 'day', 55, 'full', '', 'adventure nature');
  A('phnom-penh', 'sunset-boat-cruise', 'Sunset river cruise', 'night', 17, 'eve', '', 'chill party', st({}));
  A('phnom-penh', 'phnom-penh-evening-food-tour', 'Evening food tour', 'day', 49, 'eve', '', 'food');
  A('phnom-penh', 'cooking-class-bustling-market-experience', 'Cooking class + market', 'day', 35, 'half', '', 'food culture');
  A('phnom-penh', 'cycle-the-mekong-island', 'Cycle the Mekong island', 'day', 39, 'half', '', 'nature adventure');
  A('phnom-penh', 'free-the-bears-bear-care-tour', 'Bear care + wildlife rescue', 'day', 90, 'full', '', 'wildlife');
  A('phnom-penh', 'phnom-penh-pub-crawl', 'Phnom Penh pub crawl', 'night', 10, 'eve', 'Mon Thu', 'party');
  A('phnom-penh', 'khmer-family-dinner', 'Khmer family dinner', 'night', 8, 'eve', 'Tue', 'food culture');
  A('phnom-penh', 'phnom-penh-pool-party', 'Pool party + BBQ', 'night', null, 'eve', 'Sat', 'party');

  /* ---------------- SIEM REAP ---------------- */
  A('siem-reap', 'sunrise-angkor-wat-temple-tour', 'Sunrise Angkor Wat tour', 'day', 18, 'half', '', 'culture', st({}));
  A('siem-reap', 'floating-village-tour', 'Tonle Sap floating village', 'day', 21, 'half', '', 'culture water');
  A('siem-reap', 'kulen-waterfalls-tour', 'Kulen waterfalls', 'day', 40, 'full', '', 'nature water');
  A('siem-reap', 'quad-bike-tour', 'Quad bike tour', 'day', 33, 'half', '', 'adventure');
  A('siem-reap', 'wake-park-wakebording-experience', 'Wake park wakeboarding', 'day', 19.2, 'half', 'Wed Sun', 'water adventure');
  A('siem-reap', 'phare-circus-experience', 'Phare Cambodian Circus', 'night', 18, 'eve', '', 'culture');
  A('siem-reap', 'elephant-discovery-morning-tour', 'Elephant discovery morning', 'day', 90, 'half', '', 'wildlife');
  A('siem-reap', 'sunset-countryside-cycling-tour', 'Sunset countryside cycle', 'day', 12, 'eve', 'Tue Sat', 'nature chill');
  A('siem-reap', 'siem-reap-pub-crawl', 'Pub Street crawl', 'night', 10, 'eve', 'Mon Fri', 'party', st({}));
  A('siem-reap', 'make-your-own-pizza', 'Make-your-own pizza night', 'night', 10, 'eve', 'Sat', 'food party');
  A('siem-reap', 'kun-khmer-boxing-experience', 'Kun Khmer boxing', 'night', 12.5, 'eve', 'Wed Sun', 'culture');

  /* ---------------- KOH RONG ---------------- */
  A('koh-rong', 'sup-paddle-board-hire', 'Paddle board hire', 'day', 5, 'half', '', 'water chill');
  A('koh-rong', 'kayak-hire-koh-rong', 'Kayak hire', 'day', 10, 'half', '', 'water chill');
  A('koh-rong', 'volleyball-tournament-koh-rong', 'Beach volleyball tournament', 'night', null, 'eve', 'Mon Thu', 'party beach', { star: true });
  A('koh-rong', null, 'Beach fire show + BBQ', 'night', null, 'eve', '', 'party beach', { star: true });

  /* ---------------- KOH SDACH ---------------- */
  A('koh-sdach', null, 'E-bike island loop', 'day', 8, 'half', '', 'nature chill', st(EST));
  A('koh-sdach', null, 'Island-hopping sunset cruise', 'day', 20, 'eve', '', 'water chill', st(EST));
  A('koh-sdach', null, 'Snorkelling + beach fishing', 'day', 20, 'half', '', 'water', EST);
  A('koh-sdach', 'killer-pool-games-night', 'Pool tournament', 'night', null, 'eve', 'Fri', 'party');
  A('koh-sdach', 'beach-olympics', 'Beach / Bar Olympics', 'night', null, 'eve', 'Wed', 'party');

  /* ---------------- KAMPOT (opens 1 Nov) ---------------- */
  A('kampot', null, 'Bokor Hill Station day trip', 'day', 30, 'full', '', 'nature culture', EST);
  A('kampot', null, 'Pepper farms + salt fields', 'day', 20, 'half', '', 'food culture nature', EST);
  A('kampot', null, 'Sunset river cruise', 'day', 10, 'eve', '', 'chill', EST);
  A('kampot', null, 'River kayak', 'day', 8, 'half', '', 'water chill', EST);

  /* ---------------- ULUWATU ---------------- */
  A('uluwatu', 'mt-batur-sunrise-trekking', 'Mt Batur sunrise trek', 'day', 33.55, 'full', '', 'trek adventure nature', st({}));
  A('uluwatu', 'surf-lesson-group-of-4', 'Surf lesson (group of 4)', 'day', 22.37, 'half', '', 'surf water', st({}));
  A('uluwatu', 'bukit-sari-atv-adventure-experience', 'ATV adventure', 'day', 53.11, 'half', '', 'adventure');
  A('uluwatu', 'kuber-bali-adventure-tour-premium-atv-solo-and-white-water-rafting', 'ATV + white-water rafting', 'day', 139.77, 'full', '', 'adventure water');
  A('uluwatu', 'uluwatu-pub-crawl', 'Uluwatu pub crawl', 'night', 17.89, 'eve', 'Fri', 'party');
  A('uluwatu', 'music-quiz-2', 'Music quiz + all-you-can-eat tacos', 'night', 5.54, 'eve', 'Thu', 'party food');

  /* ---------------- NUSA LEMBONGAN ---------------- */
  A('nusa-lembongan', 'snorkeling', 'Snorkelling (three spots)', 'day', 16.78, 'half', '', 'water dive', st({}));
  A('nusa-lembongan', 'island-hopping-penida', 'Nusa Penida island hopping', 'day', 27.96, 'full', '', 'water nature adventure', st({}));
  A('nusa-lembongan', 'mangrove-tour', 'Mangrove tour', 'day', 8.39, 'half', '', 'nature chill');
  A('nusa-lembongan', 'sauna-gym-ice-bath', 'Sauna + ice bath', 'day', null, 'eve', '', 'chill');

  /* ---------------- GILI TRAWANGAN ---------------- */
  A('gili-trawangan', 'gili-trawangan-boat-party', 'Boat party + BBQ + free flow', 'night', 33.55, 'eve', 'Wed Sat', 'party water', st({}));
  A('gili-trawangan', 'snorkeling-adventure', 'Snorkelling adventure (turtles)', 'day', 15.66, 'half', 'Tue Wed Fri Sat', 'water dive', st({}));
  A('gili-trawangan', 'snorkeling-mexican-family-dinner', 'Snorkel + Mexican family dinner', 'day', 25.16, 'half', 'Thu', 'water food');
  A('gili-trawangan', 'bbq-and-free-flow-dinner-gili-t', 'BBQ + free flow dinner', 'night', 19.57, 'eve', 'Wed Sat', 'party food');
  A('gili-trawangan', 'discover-scuba-diving', 'Discover scuba diving', 'day', 75.48, 'half', '', 'dive water');
  A('gili-trawangan', 'fun-scuba-diving-exploration', 'Fun dive (certified)', 'day', 35.78, 'half', '', 'dive water');
  A('gili-trawangan', 'padi-advance-open-water-course-certification', 'PADI Open Water course', 'epic', 357.8, 'full', '', 'dive water', { multi: { d: 3, n: 0 }, note: 'Takes ~3 full days while you stay on Gili T.' });
  A('gili-trawangan', 'mt-rinjani-summit-trek-2-days-1-night-mmglt', 'Mt Rinjani summit trek · 2D/1N', 'epic', 139.77, 'full', '', 'trek adventure mountains', { multi: { d: 2, n: 1 }, note: 'Seasonal: the trail is usually closed roughly Jan–Mar.' });
  A('gili-trawangan', 'gili-t-foam-party', 'Foam party', 'night', null, 'eve', 'Tue Fri', 'party');

  /* ---------------- KUTA LOMBOK ---------------- */
  A('kuta-lombok', 'surf-camp-4-day', 'Surf Camp · 4 days', 'epic', 251.58, 'full', '', 'surf water', st({ multi: { d: 4, n: 0 }, note: 'Lessons, coaching + gear. Beds not assumed included: confirm on booking.' }));
  A('kuta-lombok', 'surf-camp', 'Surf Camp · 7 days', 'epic', 503.15, 'full', '', 'surf water', { multi: { d: 7, n: 0 }, note: 'Lessons, coaching + gear. Beds not assumed included: confirm on booking.' });
  A('kuta-lombok', 'surf-leson-intermediate-level', 'Surf lesson (intermediate)', 'day', 27.96, 'half', '', 'surf water');
  A('kuta-lombok', 'lombok-waterfall-tour-mad-family-dinner', 'Waterfall tour + Mad family dinner', 'day', 19.57, 'half', 'Mon Thu', 'nature food');
  A('kuta-lombok', 'madventure-snorkeling-secret-gili-s', 'Secret Gili snorkelling', 'day', 30.75, 'full', 'Wed Fri', 'water dive');
  A('kuta-lombok', 'mt-rinjani-summit-trek-2-days-1-night', 'Mt Rinjani summit trek · 2D/1N', 'epic', 139.77, 'full', '', 'trek adventure mountains', st({ multi: { d: 2, n: 1 }, note: 'Seasonal: the trail is usually closed roughly Jan–Mar.' }));
  A('kuta-lombok', 'lombok-family-dinner', 'Lombok family dinner', 'night', 4.2, 'eve', 'Mon Thu', 'food');

  /* ---------------- MANILA ---------------- */
  A('manila', 'pub-crawl-2', 'Manila pub crawl', 'night', 12.75, 'eve', 'Tue Thu Sun', 'party', st({}));
  A('manila', 'unlimited-drinks', 'Unlimited drinks night', 'night', 15.92, 'eve', '', 'party');
  A('manila', null, 'Intramuros + Binondo food walk', 'day', 25, 'half', '', 'culture food', EST);

  /* ---------------- NACPAN BEACH ---------------- */
  A('nacpan-beach', 'tour-m-island-hopping', 'Nacpan ultimate island hopping', 'day', 39.04, 'full', 'Tue Thu Fri Sat', 'water beach adventure', st({}));
  A('nacpan-beach', 'sunset-cruise', 'Sunset cruise', 'night', 20.72, 'eve', 'Mon Wed Fri Sun', 'chill party', st({}));

  /* ---------------- PANGLAO ---------------- */
  A('panglao', 'dolphin-watching-and-island-hopping-tour-balicasag-and-virgin-island', 'Dolphins + Balicasag + Virgin Island', 'day', 39.84, 'full', '', 'water dive wildlife', st({}));
  A('panglao', 'bohol-countryside-tour', 'Chocolate Hills countryside tour', 'day', 44.62, 'full', '', 'nature culture', st({}));
  A('panglao', 'panglao-cave-beach-tour', 'Cave + beach tour', 'day', 23.9, 'half', 'Wed Sun', 'nature water');
  A('panglao', 'panglao-sunset-cruise', 'Sunset cruise', 'night', 19.12, 'eve', 'Tue Thu Sat', 'chill party');
  A('panglao', 'sunset-beer-yoga-panglao', 'Sunset beer yoga', 'night', 6.38, 'eve', 'Sun', 'chill party');
  A('panglao', 'panglao-mojito-masterclass', 'Mojito masterclass', 'night', 9.56, 'eve', 'Mon', 'party');

  /* ---------------- DUMAGUETE ---------------- */
  A('dumaguete', 'valencia-tour', 'Valencia tour · waterfalls + hot springs', 'day', 31.87, 'half', '', 'nature adventure', st({}));
  A('dumaguete', null, 'Apo Island turtle snorkel day', 'day', 45, 'full', '', 'water dive wildlife', st(EST));
  A('dumaguete', 'mad-golf', 'Mad Golf', 'night', 2.39, 'eve', '', 'party');
  A('dumaguete', 'mojito-masterclass', 'Cocktail masterclass', 'night', 6.38, 'eve', '', 'party');

  /* ---------------- SIQUIJOR ---------------- */
  A('siquijor', 'siquijor-sunset-cruise', 'Sunset cruise', 'night', 31.87, 'eve', 'Mon Wed Fri', 'chill party', st({}));
  A('siquijor', 'siquijor-island-countryside-tour', 'Island countryside tour', 'day', 28.68, 'half', '', 'nature adventure', st({}));
  A('siquijor', 'siquijor-pub-crawl', 'Siquijor pub crawl', 'night', 12.75, 'eve', 'Fri Sat', 'party');
  A('siquijor', null, 'Scooter loop · cliff jumps + falls', 'day', 8, 'full', '', 'adventure nature moto', st(EST));

  /* ---------------- SIARGAO ---------------- */
  A('siargao', 'tri-island-tour', 'Tri Island Party Boat', 'day', 44.62, 'full', 'Wed Sat', 'party water beach', st({}));
  A('siargao', 'tri-island-classic-boat-tour', 'Tri Island classic boat tour', 'day', 28.68, 'full', 'Wed Sat', 'water beach');
  A('siargao', 'surf-lesson', 'Surf lesson', 'day', 25.5, 'half', '', 'surf water', st({}));
  A('siargao', 'siargao-surf-camp-4d-3n-all-inclusive-package', 'Surf Camp · 4D/3N all-inclusive', 'epic', 446.11, 'full', 'Tue', 'surf water', { multi: { d: 4, n: 0, covers: true }, note: 'All-inclusive package: beds included.' });
  A('siargao', 'siargao-surf-camp-7d-6n-all-inclusive-package', 'Surf Camp · 7D/6N all-inclusive', 'epic', 525.77, 'full', 'Sat', 'surf water', { multi: { d: 7, n: 0, covers: true }, note: 'All-inclusive package: beds included.' });
  A('siargao', 'adventure-land-tour', 'Adventure Land tour', 'day', 35.06, 'half', 'Mon Tue Thu Fri', 'adventure');
  A('siargao', 'land-madness-tour', 'Land Madness tour', 'day', 39.84, 'full', '', 'adventure nature');
  A('siargao', 'siargao-sohoton-tour', 'Sohoton cove tour', 'day', 56.56, 'full', '', 'nature water adventure');
  A('siargao', 'wakeboarding', 'Wakeboarding', 'day', 23.9, 'half', '', 'water adventure');

  /* ---------------- dated events ---------------- */
  MM.EVENTS = [
    { date: '2026-10-31', n: 'Halloween party', at: 'bangkok chiang-mai pai phuket phnom-penh vang-vieng panglao siargao siquijor dumaguete nacpan-beach gili-trawangan kuta-lombok nusa-lembongan uluwatu'.split(' ') },
    { date: '2026-12-23', n: 'Ha Giang Loop Christmas special', at: ['hanoi'] }
  ];

  /* ---------------- don't miss ----------------
     One standout per hostel: the thing guests regret skipping. Used by the "you skipped this" nudges.
     Matched against the end of the activity id. Judgement, not booking data. */
  MM.DONT_MISS = {
    'hanoi': ['ha-giang-loop-tour-3d2n-easy-rider', 'The Ha Giang Loop. Ask anyone who has done Vietnam what the best bit was.'],
    'hoi-an': ['sunset-river-cruise', 'The old town on the water as the lanterns come on.'],
    'luang-prabang': ['kuang-si-waterfall', 'Kuang Si. Turquoise pools you can swim in, 45 minutes out of town.'],
    'vang-vieng': ['vang-vieng-tipsy-tubing', 'Tubing is the reason Vang Vieng is famous. $7.'],
    'bangkok': ['old-town-tour-markets-temples-canals', 'Temples, markets and canals in one go, with people who know the shortcuts.'],
    'chiang-mai': ['elephant-sanctuary-bamboo-rafting', 'An ethical elephant sanctuary, then bamboo rafting home.'],
    'pai': ['sunset-at-pai-canyon-two-huts', 'Sunset at Pai Canyon. Everyone in town ends up here.'],
    'phuket': ['phi-phi-islands-day-trip', 'Phi Phi. The islands from every Thailand poster.'],
    'phnom-penh': ['s21-and-killing-fields-tour', 'S21 and the Killing Fields. Hard, important, unforgettable.'],
    'siem-reap': ['sunrise-angkor-wat-temple-tour', 'Sunrise at Angkor Wat. Set the alarm, it is worth it.'],
    'kampot': ['bokor-hill-station-day-trip', 'Bokor Mountain: abandoned casino, jungle roads, views to the sea.'],
    'koh-rong': ['beach-fire-show-bbq', 'Beach BBQ and fire show. The best night on the island.'],
    'koh-sdach': ['island-hopping-sunset-cruise', 'Island hopping into sunset across the archipelago.'],
    'uluwatu': ['mt-batur-sunrise-trekking', 'Climb Mt Batur in the dark, watch the sun come up over Bali.'],
    'nusa-lembongan': ['island-hopping-penida', 'Nusa Penida: Kelingking Beach and manta rays in one day.'],
    'gili-trawangan': ['snorkeling-adventure', 'Snorkel with turtles. They are everywhere off the Gilis.'],
    'kuta-lombok': ['mt-rinjani-summit-trek-2-days-1-night', 'Rinjani: two days, a crater lake and the best view in Indonesia.'],
    'manila': ['intramuros-binondo-food-walk', 'Old Manila and the oldest Chinatown in the world, by the mouthful.'],
    'nacpan-beach': ['tour-m-island-hopping', 'El Nido island hopping: lagoons, limestone and white sand.'],
    'panglao': ['dolphin-watching-and-island-hopping-tour-balicasag-and-virgin-island', 'Dolphins at dawn, then Balicasag and Virgin Island.'],
    'dumaguete': ['apo-island-turtle-snorkel-day', 'Apo Island: swim with sea turtles on one of the best reefs in Asia.'],
    'siquijor': ['scooter-loop-cliff-jumps-falls', 'Scooter loop of the island with cliff jumps and waterfalls.'],
    'siargao': ['tri-island-tour', 'Naked, Daku and Guyam islands. The Siargao day out.']
  };
  MM.dontMiss = function (placeId) {
    var d = MM.DONT_MISS[placeId]; if (!d) return null;
    var a = MM.actsAt(placeId).filter(function (x) { return x.id === d[0] || x.id.slice(-d[0].length) === d[0]; })[0];
    return a ? { act: a, pitch: d[1] } : null;
  };

  /* ---------------- helpers ---------------- */
  MM.actsAt = function (placeId) { var l = typeof placeId === 'string' && Object.prototype.hasOwnProperty.call(MM.ACT_BY_PLACE, placeId) ? MM.ACT_BY_PLACE[placeId] : []; return l.map(function (i) { return MM.ACTS[i]; }); };
  MM.actUrl = function (a) { return a.slug ? 'https://madmonkeyhostels.com/tours-events/' + a.slug : null; };

  if (typeof module !== 'undefined') module.exports = { ACTS: MM.ACTS };
})(typeof window !== 'undefined' ? window : globalThis);
