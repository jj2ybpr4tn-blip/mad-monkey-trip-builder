/* ============================================================
   ENTRY RULES + TRUST
   ENTRY: a light "what to expect" per country and passport group, with the OFFICIAL link.
   These are from general knowledge, NOT checked against 2026 rules. They change often
   (Thailand's stay length, Vietnam's exemption list). Ops: verify before launch, or replace
   with a link-only version. The UI always says "confirm on the official site".

   TRUST: the overall rating and the three named quotes Mad Monkey already publishes on its
   ALL IN pages. No hostel-level reviews are published, so none are shown (see REVIEWS).
   ============================================================ */
(function (r) {
  var MM = r.MM = r.MM || {};

  MM.PASSPORTS = [{ k: 'gb', n: 'UK' }, { k: 'us', n: 'USA' }, { k: 'au', n: 'Australia' }, { k: 'ca', n: 'Canada' }, { k: 'eu', n: 'EU / Ireland' }, { k: 'other', n: 'Other' }];

  function by(def, o) { var out = {}; MM.PASSPORTS.forEach(function (p) { out[p.k] = (o && o[p.k]) || def; }); return out; }
  MM.ENTRY = {
    TH: { link: 'https://tdac.immigration.go.th', cta: 'Thailand arrival card', extra: 'Fill in the Thailand Digital Arrival Card online before you fly.',
      by: by('Check your passport on the official site.', { gb: 'Visa-free for tourists (stay length has changed before: check).', us: 'Visa-free for tourists (stay length has changed before: check).', au: 'Visa-free for tourists (stay length has changed before: check).', ca: 'Visa-free for tourists (stay length has changed before: check).', eu: 'Visa-free for tourists (stay length has changed before: check).' }) },
    LA: { link: 'https://laoevisa.gov.la', cta: 'Laos e-visa', extra: 'Visa on arrival at the main entry points, or apply online first.',
      by: by('Visa on arrival or e-visa. Fees vary by passport.') },
    VN: { link: 'https://evisa.gov.vn', cta: 'Vietnam e-visa', extra: 'Apply online before you fly if you need a visa.',
      by: by('E-visa likely. Check your passport.', { gb: 'UK passports have had a visa-free stay (45 days). Check it still applies.', eu: 'Several EU passports have a visa-free stay (45 days). Check yours.', us: 'E-visa needed. Apply online first.', au: 'E-visa needed. Apply online first.', ca: 'E-visa needed. Apply online first.' }) },
    KH: { link: 'https://www.evisa.gov.kh', cta: 'Cambodia e-visa', extra: 'E-visa online, or visa on arrival at the main airports and crossings.',
      by: by('E-visa or visa on arrival (about $30). Fees vary.') },
    ID: { link: 'https://molina.imigrasi.go.id', cta: 'Indonesia e-VOA', extra: 'Visa on arrival or e-VOA online. Bali also charges a tourist levy.',
      by: by('Visa on arrival or e-VOA (about $35). Fees vary.') },
    PH: { link: 'https://etravel.gov.ph', cta: 'Philippines eTravel', extra: 'Register on eTravel shortly before arrival. Carry an onward ticket.',
      by: by('Check your passport on the official site.', { gb: 'Visa-free for tourists (30 days). Onward ticket needed.', us: 'Visa-free for tourists (30 days). Onward ticket needed.', au: 'Visa-free for tourists (30 days). Onward ticket needed.', ca: 'Visa-free for tourists (30 days). Onward ticket needed.', eu: 'Visa-free for tourists (30 days). Onward ticket needed.' }) }
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
