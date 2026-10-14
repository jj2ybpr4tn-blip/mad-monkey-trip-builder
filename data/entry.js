/* ============================================================
   ENTRY RULES + TRUST
   ENTRY: a light "what to expect" per country and passport group, with the OFFICIAL link.
   Checked against current web sources in Oct 2026 (see MM.ENTRY_CHECKED). They change often
   (Thailand cut its visa-free stay from 60 to 30 days on 15 Sep 2026; Vietnam's exemption list
   keeps growing). Re-check before launch and every few months. Sources: docs/ENTRY-SOURCES.md.
   The UI always says "confirm on the official site".

   TRUST: the overall rating and the three named quotes Mad Monkey already publishes on its
   ALL IN pages. No hostel-level reviews are published, so none are shown (see REVIEWS).
   ============================================================ */
(function (r) {
  var MM = r.MM = r.MM || {};

  MM.PASSPORTS = [{ k: 'gb', n: 'UK' }, { k: 'us', n: 'USA' }, { k: 'au', n: 'Australia' }, { k: 'ca', n: 'Canada' }, { k: 'eu', n: 'EU / Ireland' }, { k: 'other', n: 'Other' }];

  function by(def, o) { var out = {}; MM.PASSPORTS.forEach(function (p) { out[p.k] = (o && o[p.k]) || def; }); return out; }
  MM.ENTRY_CHECKED = 'Oct 2026';
  MM.ENTRY = {
    TH: { link: 'https://tdac.immigration.go.th', cta: 'Thailand arrival card (TDAC)',
      extra: 'Visa-free stays are tourism only. Fill in the free Thailand Digital Arrival Card online before you fly. Entering by land under the exemption is capped at two crossings a calendar year, and the Cambodia land border has been closed.',
      by: by('Check your passport on the official site.', { gb: '30 days visa-free (cut from 60 on 15 Sep 2026). Extend 30 days in country (~1,900 THB), or apply for a 60-day TR e-visa first.', us: '30 days visa-free (cut from 60 on 15 Sep 2026). Extend 30 days in country (~1,900 THB), or apply for a 60-day TR e-visa first.', au: '30 days visa-free (cut from 60 on 15 Sep 2026). Extend 30 days in country (~1,900 THB), or apply for a 60-day TR e-visa first.', ca: '30 days visa-free (cut from 60 on 15 Sep 2026). Extend 30 days in country (~1,900 THB), or apply for a 60-day TR e-visa first.', eu: '30 days visa-free (cut from 60 on 15 Sep 2026). Extend 30 days in country (~1,900 THB), or apply for a 60-day TR e-visa first.' }) },
    LA: { link: 'https://laoevisa.gov.la', cta: 'Laos e-visa',
      extra: 'Visa on arrival at the main entry points, or e-visa online (e-visas can\'t be extended). Fees are reported anywhere from about $30 to $55, so check the official figure. Laos also wants an electronic arrival form (immigration.gov.la), filled in up to 3 days before entry.',
      by: by('Visa on arrival or e-visa, usually 30 days. Fees vary by passport.') },
    VN: { link: 'https://evisa.gov.vn', cta: 'Vietnam e-visa (official portal only)',
      extra: 'Apply only on the official portal; look-alike sites charge extra. Passport needs at least 6 months\' validity.',
      by: by('E-visa likely. Check your passport.', { gb: '45 days visa-free (exemption runs to March 2028).', eu: 'Germany, France, Italy, Spain, Denmark, Sweden and Finland get 45 days visa-free; so do Belgium, Bulgaria, Croatia, Czechia, Hungary, Luxembourg, Netherlands, Poland, Romania, Slovakia and Slovenia (tourism only). Ireland isn\'t listed: e-visa.', us: 'E-visa (about $25, 90 days). Apply online first.', au: 'E-visa (about $25 single entry, 90 days). Apply online first.', ca: 'E-visa (about $25, 90 days). Apply online first.' }) },
    KH: { link: 'https://www.evisa.gov.kh', cta: 'Cambodia e-visa',
      extra: 'E-visa online or visa on arrival, 30 days, extendable once (about $45, in Phnom Penh). Some sites still list the old $36 e-visa fee: check the official one.',
      by: by('E-visa or visa on arrival, about $30.') },
    ID: { link: 'https://molina.imigrasi.go.id', cta: 'Indonesia e-VOA', link2: 'https://madmonkeyhostels.com/blogs/indonesia-visa-requirements/', cta2: 'Mad Monkey\'s Indonesia visa guide',
      extra: 'Visa on arrival or e-VOA online (IDR 500,000, about $30–35; 30 days, extendable once). Also complete the free All Indonesia Arrival Card before landing, and expect the IDR 150,000 Bali tourist levy.',
      by: by('Visa on arrival or e-VOA (about $30–35).') },
    PH: { link: 'https://etravel.gov.ph', cta: 'Philippines eTravel', link2: 'https://madmonkeyhostels.com/blogs/philippines-visa-guide-tourist-entry-requirements/', cta2: 'Mad Monkey\'s Philippines visa guide',
      extra: 'Complete the free eTravel registration within 72 hours before arrival. Carry proof of onward travel.',
      by: by('Check your passport on the official site.', { gb: '30 days visa-free, extendable in country.', us: '30 days visa-free, extendable in country.', au: '30 days visa-free, extendable in country.', ca: '30 days visa-free, extendable in country.', eu: '30 days visa-free, extendable in country.' }) }
  };

  MM.TRUST = {
    rating: '4.9/5', raters: '53,000+',
    quotes: [
      { q: 'I met 15 amazing girls who will be friends for life. There is no going back once you do a monkey trip.', by: 'Mia, 24', from: 'UK' },
      { q: 'I had an amazing experience on the Ha Giang Loop group tour. I felt safe every second.', by: 'Aston, 25', from: 'Australia' },
      { q: 'Booked the Vietnam tour solo and was so nervous, but I\'d met half the group within an hour. 10/10.', by: 'Sofia, 23', from: 'Ireland' }]
  };
  // Hostel-level reviews: Mad Monkey does not publish any on its destination pages. Drop real ones in here
  // (e.g. exported from Google / Hostelworld with permission) and the UI shows them: { hanoi: [{ q, by, from }] }
  MM.REVIEWS = {};

  if (typeof module !== 'undefined') module.exports = { ENTRY: MM.ENTRY, TRUST: MM.TRUST };
})(typeof window !== 'undefined' ? window : globalThis);
