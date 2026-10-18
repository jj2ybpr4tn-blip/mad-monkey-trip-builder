/* ============================================================
   KNOW BEFORE YOU GO — local knowledge per country and per hostel.
   Practical planning advice, not legal advice. Rules and prices change, so the app says "check" wherever
   it matters and links to the official source. Drafted Oct 2026 from public sources; the crew in each
   country should localise it (add what only a local knows) before launch.
   ============================================================ */
(function (r) {
  var MM = r.MM = r.MM || {};
  var G = MM.GUIDE = { checked: 'Oct 2026' };

  G.topics = [
    { k: 'money', t: 'Money', icon: 'coin' }, { k: 'online', t: 'Getting online', icon: 'wifi' }, { k: 'moving', t: 'Getting around', icon: 'bus' },
    { k: 'scooters', t: 'Scooters + licences', icon: 'bike' }, { k: 'safe', t: 'Staying safe', icon: 'shield' }, { k: 'manners', t: 'Manners', icon: 'temple' }, { k: 'health', t: 'Health', icon: 'heart' }];

  // the "read this before you hire a bike" card is shown prominently wherever a trip has a scooter or a loop
  G.scooterHead = 'Riding a scooter? Read this first.';
  G.scooterCore = [
    'Most travel insurers will only pay out if you hold the right licence for the bike you were riding. Read your policy wording, and ask them in writing.',
    'Wear a proper helmet every ride, closed shoes and long trousers. Don\'t ride tired, drunk or in the dark.',
    'Photograph the bike on all sides before you ride, and never hand over your passport as a deposit.',
    'If you\'ve never ridden, the road is not the place to learn. Take a lesson, or join a guided ride with a driver.'];

  G.countries = {
    TH: {
      money: ['Thailand uses baht (THB). Cash is king at markets, street food stalls and for tuk-tuks. Cards are fine in malls, 7-Elevens and bigger restaurants.',
        'Foreign cards pay a fixed fee on every ATM withdrawal (around 220 to 250 baht, and AEON machines are usually cheaper), so take out the most the machine allows, less often.',
        'If the ATM asks whether to convert to your home currency, say no and take baht. The "dynamic conversion" rate is worse.',
        'Tipping isn\'t expected. Rounding up a taxi fare or leaving small change is plenty.'],
      online: ['A tourist eSIM is the easiest way. Set it up before you land and you\'re online as you walk out of the airport.',
        'Local SIMs (AIS, True, dtac) are sold at airports and 7-Elevens. Take your passport.',
        'Hostel wifi is fine for messages and maps. Download offline maps before long bus rides.'],
      moving: ['Grab and Bolt work in Bangkok, Chiang Mai and Phuket and save you haggling. In a taxi, insist on the meter.',
        'In Bangkok the BTS Skytrain and MRT beat the traffic every time. In Chiang Mai the red songthaew trucks are a cheap shared ride.',
        'Overnight buses and trains blast the aircon. Bring a hoodie or a sarong.'],
      scooters: ['To ride legally you need a motorcycle licence from home plus an International Driving Permit with the motorcycle category (a car-only permit doesn\'t cover a scooter). Many shops will still rent without checking, which is no protection if something goes wrong.',
        'Police check tourists at hotspots, and helmets are enforced. Pai\'s roads and Phuket\'s hills cause a lot of accidents every year.',
        'Rental scams are common: photograph every scratch first, and don\'t leave your passport.'],
      safe: ['Vapes and e-cigarettes are illegal in Thailand. Leave yours at home.',
        'Drugs carry some of the harshest penalties in the region. Don\'t.',
        'If a stranger tells you the temple or palace is "closed today" and offers a tuk-tuk tour, it is a scam. Walk on.',
        'Watch your drink on nights out, and keep your phone and wallet in a front pocket.'],
      manners: ['Cover shoulders and knees at temples and the Grand Palace, and take your shoes off before going inside.',
        'Never point your feet at a Buddha statue or a person, and don\'t touch anyone\'s head.',
        'The monarchy is protected by law. Don\'t joke about it or criticise it, including online.',
        'Women shouldn\'t touch or hand things directly to monks.'],
      health: ['Don\'t drink the tap water. Refill at your hostel or buy bottles.',
        'Mosquitoes carry dengue. Use repellent at dawn and dusk.',
        'Book a travel clinic appointment 6 to 8 weeks before you fly, and carry travel insurance. Bangkok and Chiang Mai have excellent hospitals.',
        'Alcohol sales stop on some Buddhist holidays and election days. Check before you plan a big night.']
    },
    LA: {
      money: ['Laos uses the kip (LAK), and the notes are huge. Bring clean US dollars or Thai baht as a backup.',
        'ATMs are in the main towns, with low limits and fees. Take out what you need before heading to small places.',
        'Many places take cash only. Cards work in some larger hotels and restaurants.',
        'Haggling at markets is friendly and expected, but keep it light.'],
      online: ['Tourist eSIMs work in the main towns, and coverage thins out in the mountains.',
        'Local SIMs (Lao Telecom, Unitel) are sold with a passport. Download maps offline.',
        'Hostel wifi can be slow. Don\'t plan on streaming.'],
      moving: ['The Laos-China railway makes Luang Prabang to Vang Vieng and Vientiane quick and easy. Book tickets ahead, and allow time for the station transfers.',
        'The slow boat from Thailand takes two days with a night in Pakbeng. Take food, a cushion and a warm layer.',
        'Tuk-tuks are priced per vehicle. Agree before you set off.'],
      scooters: ['Foreigners are expected to carry a valid licence plus an International Driving Permit, and an accident without one can become very expensive.',
        'Roads are narrow and often unlit, with animals on them. Avoid riding after dark.',
        'Laos insurance for a rental is often thin. Ask exactly what is covered, and check your travel insurance too.'],
      safe: ['Vapes are banned in Laos. Leave yours at home.',
        'Unexploded bombs from the war still lie in parts of the country. Stay on marked paths and never touch anything metal in the countryside.',
        'In Vang Vieng, river levels change fast. Don\'t tube drunk, and skip it when the water is high.',
        'Tap water is not safe. Watch your drink on nights out.'],
      manners: ['Dress modestly at temples, and never point your feet at a Buddha statue.',
        'At the dawn alms giving in Luang Prabang, watch quietly from a respectful distance and don\'t buy from the sellers who push you. Don\'t use flash.',
        'Don\'t touch a person\'s head, and use two hands (or touch your right elbow) when giving or receiving.'],
      health: ['Drink only bottled or filtered water.',
        'Malaria risk exists in rural areas, and dengue is widespread. Ask a travel clinic about both.',
        'Medical care is basic outside Vientiane. Make sure your insurance covers evacuation.']
    },
    VN: {
      money: ['Vietnam uses the dong (VND), and the numbers are big. Take care with the zeros on notes.',
        'ATMs are everywhere in cities. Limits per withdrawal are low, so you pay a fee more often.',
        'Cash is still needed for street food, markets and small shops. Cards work in malls and bigger restaurants.',
        'Haggle at markets, but not over a few thousand dong.'],
      online: ['A tourist eSIM is the easiest. Local SIMs (Viettel, Vinaphone) are cheap with a passport.',
        'Grab works in Hanoi and Saigon for rides, food and parcels, so it is useful for much more than taxis.',
        'Some websites and apps are blocked or slow. Download maps and translations before you go.'],
      moving: ['Use Grab for taxis and bikes. It is cheaper and removes the meter arguments.',
        'Crossing the road: walk at a steady pace, don\'t stop or run, and the traffic flows round you.',
        'Sleeper buses and the train from Hanoi to Hue, Da Nang and Saigon are comfortable. Book ahead around public holidays.',
        'In Hanoi, "Train Street" cafés have been restricted and reopened over the years. Check locally before going, and listen to staff about trains.'],
      scooters: ['Vietnam wants a valid motorcycle licence plus an International Driving Permit under the 1968 convention with the motorcycle category (A or A1). Many US, Canadian and Australian permits are issued under the older 1949 convention and may not count.',
        'Riding without the right licence risks a fine and the bike being impounded, and it is likely to affect your insurance.',
        'The Ha Giang Loop is stunning and dangerous. If you are not an experienced rider, take an easy rider with a local driver. Don\'t ride tired or in fog.',
        'Never hand over your passport as a deposit.'],
      safe: ['Vapes and e-cigarettes are banned in Vietnam, and tourists have been fined for vaping.',
        'Bags and phones are snatched from motorbikes. Carry your bag away from the road, and don\'t hold your phone out near traffic.',
        'Only use the official e-visa site. Look-alike sites charge extra.',
        'Agree the price before any taxi or cyclo ride, or just use Grab.'],
      manners: ['Cover shoulders and knees at pagodas and temples.',
        'Take your shoes off when you enter a home, and point your feet away from the family altar.',
        'The flag and Ho Chi Minh are treated with respect. Keep opinions about politics for another time.'],
      health: ['Drink bottled or filtered water, and brush your teeth with it.',
        'Air quality in Hanoi can be poor in winter. Check the AQI if you have asthma.',
        'Pharmacies are plentiful and cheap. Bring your own prescriptions in their original packaging.',
        'Dengue is a risk in the rainy season. Use repellent.']
    },
    KH: {
      money: ['Cambodia runs on US dollars alongside the riel. ATMs dispense dollars, and small change comes back in riel (4,000 riel is about $1).',
        'Bring crisp, undamaged notes. Torn or marked dollars are often refused.',
        'There are few ATMs on the islands. Take cash with you to Koh Rong, Koh Sdach and Kampot\'s countryside.',
        'Tuk-tuk drivers quote a price, and a polite bargain is normal.'],
      online: ['Local SIMs (Cellcard, Smart, Metfone) are cheap and sold at the airport with your passport. A tourist eSIM is easier.',
        'Coverage is good in towns and patchy on the islands.',
        'Download maps offline for island and temple days.'],
      moving: ['PassApp and Grab work in Phnom Penh and Siem Reap. Tuk-tuks are great for temple days: agree a day rate with the driver.',
        'Buses between Phnom Penh, Siem Reap, Kampot and the coast are cheap and frequent. Book the day before in busy periods.',
        'The Thailand land border has been closed, so check the current status before planning a crossing.'],
      scooters: ['Check the rules and the rental company\'s insurance before you ride. Riding without a valid licence can void your insurance and leave you liable.',
        'Roads outside the cities are rough and shared with animals and unlit trucks. Avoid riding at night.',
        'Never leave your passport as a deposit.'],
      safe: ['Vapes are banned in Cambodia. Leave yours at home.',
        'Bag-snatching from passing motorbikes is common in Phnom Penh. Carry your bag away from the road, and keep your phone away from the kerb.',
        'Don\'t buy drugs. Penalties are real.',
        'Don\'t give money to children who beg, or visit orphanage "tours". Both feed the problem.'],
      manners: ['Cover your shoulders and knees at Angkor and at every pagoda. Temples can turn you away.',
        'Don\'t touch monks (women), don\'t point your feet at Buddha images, and don\'t touch heads.',
        'S21 and the Killing Fields are sites of genocide. Be quiet and respectful, and don\'t pose for photos.'],
      health: ['Drink bottled or filtered water.',
        'Dengue is common. Use repellent and wear light long sleeves at dusk.',
        'Rabies is a risk from stray dogs and monkeys. If bitten, get medical help immediately.',
        'Hospitals in Phnom Penh and Siem Reap are fine, and the islands have only clinics. Check your insurance covers a transfer.']
    },
    ID: {
      money: ['Indonesia uses the rupiah (IDR), in notes of tens of thousands. A couple of million rupiah can be a few dozen dollars.',
        'Use ATMs attached to banks, not stand-alone ones in shops, and cover the PIN pad. Card skimming happens.',
        'Cash is needed on the Gilis, Lombok and Nusa Lembongan, where machines run out and cards are patchy.',
        'The Bali tourist levy (IDR 150,000) is charged once you arrive. Pay it online beforehand to save time.'],
      online: ['Tourist eSIMs work well in Bali and Lombok. Local SIMs (Telkomsel is the strongest) are sold at the airport.',
        'Grab and Gojek work for rides and food in Bali. On the Gilis there are no apps, only bikes and horse carts.',
        'Coverage is poor on boats and treks. Download maps offline.'],
      moving: ['Bali traffic is slow. Allow double the time you expect, and use Grab or Gojek for fixed prices.',
        'Fast boats from Bali to the Gilis and Lembongan are weather-dependent, can be rough, and sometimes leave late. Take sea-sickness tablets and don\'t cut a boat day close to a flight home.',
        'The Gilis have no motor vehicles: bikes, horse carts (cidomo) and walking. Agree the cidomo price first.'],
      scooters: ['Foreign riders must carry their home licence and an International Driving Permit with the motorcycle category. Police run regular checks in Bali hotspots, and fines are on the spot.',
        'Bali\'s traffic and roads cause many tourist injuries every year, and your travel insurance may not pay out if you weren\'t correctly licensed.',
        'Wear a helmet, and never ride after drinking.'],
      safe: ['Methanol poisoning from fake spirits is a real danger in Bali, Lombok and the Gilis. Stick to sealed bottles, beer, and venues you trust, and be wary of cheap cocktails and free shots.',
        'Monkeys at Uluwatu Temple snatch sunglasses and phones. Hold your things tight.',
        'Rip currents are strong off Uluwatu and Nusa Lembongan. Swim where the locals do, and ask first.',
        'Drug laws are severe. Don\'t.'],
      manners: ['Cover shoulders and knees at temples, wear a sarong where asked, and don\'t step on the offerings on the pavement.',
        'On Lombok and the Gilis most people are Muslim. Dress modestly away from the beach, and be respectful during Ramadan.',
        'Use your right hand for giving, receiving and eating.'],
      health: ['Don\'t drink tap water, even to brush your teeth, and avoid ice if you\'re unsure.',
        '"Bali belly" is common. Take rehydration salts and go easy on street food in your first days.',
        'Rabies is present in Bali. Avoid stray dogs and monkeys, and get medical help immediately after a bite.',
        'Mountain treks like Rinjani need proper fitness and a reputable operator.']
    },
    PH: {
      money: ['The Philippines uses pesos (PHP). ATMs are plentiful in cities and sparse on islands, so bring cash for Siquijor, Siargao and El Nido.',
        'Many island tours charge a small environmental fee at the dock. Keep small notes.',
        'GCash is popular with locals, but most visitors will rely on cash and cards.'],
      online: ['A tourist eSIM is the easiest. Local SIMs (Globe, Smart) are sold at the airport.',
        'Island signal is patchy and boat rides have none. Download maps and boarding passes offline.',
        'Register on the eTravel site before you fly, and keep the QR code.'],
      moving: ['Between islands you use ferries and short flights. Weather can cancel both, so leave a spare day before an international flight home.',
        'In cities, Grab works in Manila and Cebu. Jeepneys are the cheap, crowded local option. Ask the driver or the person next to you where to get off.',
        'Tricycles are priced per ride. Agree before you set off.'],
      scooters: ['Scooters are the way to see Siquijor and Siargao, but check the rental company\'s insurance and keep your licence with you. Local conditions mean many tourists end up in the clinic.',
        'Wear a helmet, and avoid riding at night or after rain on loose roads.',
        'Never hand over your passport as a deposit.'],
      safe: ['Typhoon season runs roughly June to November. Check the forecast and have a flexible plan.',
        'Keep a copy of your passport, and don\'t flash expensive gear in crowded areas in Manila.',
        'Don\'t buy drugs. The law and its enforcement are harsh.',
        'Choose island-hopping boats with life jackets, and say no to overloaded ones.'],
      manners: ['Filipinos are warm and talkative. A smile and "salamat" (thank you) go a long way.',
        'Dress modestly at churches, and keep quiet during Mass.',
        'Holy Week (Semana Santa) is a deeply felt, serious time, and many places close. Plan around it.'],
      health: ['Drink bottled or filtered water.',
        'Dengue spikes in the rainy season. Use repellent, especially at dawn and dusk.',
        'Island clinics are basic. Make sure your insurance covers evacuation to a bigger hospital.',
        'Heat and humidity are strong. Drink more than you think you need.']
    }
  };

  // what only a hostel-by-hostel look can tell you. Two or three lines each.
  G.places = {
    hanoi: ['The Old Quarter is chaos in the best way. Weekend nights close some streets for a night market.', 'It gets properly cold from December to February, so bring a warm layer for the Ha Giang Loop and Sapa.', 'Try egg coffee and bun cha. Both are Hanoi originals.'],
    'hoi-an': ['The Old Town charges a small ticket to enter some of the sights, and it is cars-free at night.', 'Tailors can turn out clothes in a day or two. Take reference photos, and check the fabric and fit.', 'Floods hit the old town in October and November. Check the forecast, and leave a flexible day.'],
    'luang-prabang': ['Watch the dawn alms giving quietly from a distance. Don\'t join in unless you\'re properly guided.', 'Kuang Si Falls is best early, before the tour buses. Bring swimmers.', 'The town is very quiet at night. The night market is lovely, and bars wind down early.'],
    'vang-vieng': ['Tubing is a day of drinking and rope swings. Don\'t do it drunk, and skip it when the river is high.', 'Blue lagoons and caves are the nicer side of the town. Bring a dry bag for your phone.', 'Hot air balloons fly at sunrise, so book the night before.'],
    bangkok: ['The BTS and MRT beat the traffic. Use them to get to the Grand Palace area as well, then walk.', 'Ignore anyone who says a temple is "closed today". It is a scam.', 'Street food is some of the world\'s best. Go where there\'s a queue of locals.'],
    'chiang-mai': ['From February to April farmers burn the fields and the air gets bad. Check the AQI before you book.', 'Pick elephant sanctuaries that don\'t allow riding or bathing. Ask what happens to the animals at night.', 'The Sunday Walking Street market is worth the crowd.'],
    pai: ['The road in has around 760 bends. If you get carsick, take a tablet before the minivan.', 'Pai Canyon is a narrow ridge with no barriers. Go at sunset with care, and don\'t go in a rush.', 'Mornings are cool from November to February. Bring a jumper.'],
    phuket: ['West-coast beaches have dangerous rip currents in the monsoon, from about May to October. Obey the red flags.', 'Taxis and tuk-tuks quote high. Use Grab or Bolt, or agree the price first.', 'Jet-ski rental scams are common. Never hand over your passport.'],
    'phnom-penh': ['Carry your bag on the side away from the road, because motorbike snatch thefts happen here.', 'S21 and the Killing Fields are very heavy. Give yourself a quiet afternoon afterwards.', 'The riverfront at sunset is the place for a beer.'],
    'siem-reap': ['Buy your Angkor pass only from the official ticket centre. Prices are about $37 for a day, $62 for three days and $72 for seven. Check the current price and window.', 'Sunrise at Angkor Wat means leaving about 4:30am. Bring a layer and a torch.', 'Cover your shoulders and knees. Guards turn people away.'],
    kampot: ['Kampot is slow and gorgeous. Sunset on the river is the thing to do.', 'Pepper farms and Bokor Mountain are easy days out. Book the Bokor trip early in the day.', 'Durian season is a smell you\'ll remember.'],
    'koh-rong': ['Bring enough cash from the mainland. There are very few ATMs on the island.', 'There are no cars. You walk, take boats and kayak. Pack light.', 'Look for glowing plankton on dark nights. Sandflies bite at dusk, so bring repellent.'],
    'koh-sdach': ['Very few ATMs and slow wifi. Bring cash and a book.', 'Boats depend on the weather. Leave a spare day before a flight.', 'It is wonderfully quiet. That is the whole point.'],
    uluwatu: ['Surf breaks here are over reef and cliffs. Learn at the beginner beaches with an instructor.', 'Monkeys at Uluwatu Temple snatch sunglasses and phones.', 'Traffic is slow, so allow plenty of time to the airport.'],
    'nusa-lembongan': ['The fast boat from Sanur can be rough. Take tablets if you\'re prone to seasickness.', 'Penida\'s roads and viewpoints are steep, so go with a driver on your first trip.', 'Currents are strong at Dream Beach. Don\'t swim out far.'],
    'gili-trawangan': ['There are no motor vehicles. Bikes, horse carts and walking only.', 'Stick to sealed bottles and trusted bars. Methanol poisoning is a real risk across Indonesia.', 'Don\'t touch the turtles or stand on the coral.'],
    'kuta-lombok': ['Rinjani treks are usually closed from about January to March. Check before you book.', 'The surf is for people with some experience. Beginners should book lessons at the gentler breaks.', 'Roads outside town are rough. Ride carefully or take a driver.'],
    manila: ['Allow lots of time for traffic. Grab beats a jeepney if you\'re carrying bags.', 'Intramuros is best early, before the heat.', 'Keep small bills for jeepneys and tricycles.'],
    'nacpan-beach': ['This is a remote stretch of the El Nido coast. Bring cash, as ATMs are limited.', 'Island-hopping tours charge a small environmental fee. Keep small notes.', 'Weather can cancel boats. Leave a spare day.'],
    panglao: ['Dolphin and island tours leave very early. Book the night before.', 'Don\'t flash photograph the tarsiers, and choose the sanctuary that keeps its distance.', 'Chocolate Hills day trips are long. Go with a driver.'],
    dumaguete: ['It is the gateway to Apo Island, with turtles you can snorkel beside. Go early and don\'t touch them.', 'There is a small fee to land on Apo. Keep cash.', 'The seafront at sunset is a student hangout.'],
    siquijor: ['The scooter loop around the island is the thing to do. Take care with the gravel and the cliff-jump roads.', 'It has only small clinics. Take the first aid kit seriously.', 'Holy Week brings the island\'s traditional healers, and a lot of visitors.'],
    siargao: ['Getting here is the hard part. Book the flight or ferry early, and leave a spare day at each end.', 'Cloud 9 is for experienced surfers. Learn at the gentler breaks.', 'Bring cash for island hops. Scooters are how you get around.']
  };

  // helpers
  G.forCountries = function (cs) { return (cs || []).filter(function (c) { return G.countries[c]; }); };
  // true if the plan has a scooter, a loop or similar
  G.hasRiding = function (pl) {
    return pl.segs.some(function (s) { return s.kind === 'stop' && s.acts.some(function (a) { return /moto|scooter|ha-giang|quad|atv|self-riding/i.test(a.id + ' ' + (a.tags || []).join(' ')); }); }) ||
      pl.places.some(function (p) { return /pai|siquijor|siargao|kampot|nacpan/.test(p); });
  };

  if (typeof module !== 'undefined') module.exports = G;
})(typeof window !== 'undefined' ? window : globalThis);
