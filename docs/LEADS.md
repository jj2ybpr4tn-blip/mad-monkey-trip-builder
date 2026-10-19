# Lead / review-request payload

When a guest taps **Send it**, the builder `POST`s this JSON (`Content-Type: application/json`) to `LEAD_ENDPOINT`
in `config.js`. Any 2xx response shows the guest a success screen; anything else shows an error with a copy fallback.

The main button is **"Hold my beds + get it checked"**. It sends the same payload with three extra fields so the crew knows it is a *review request* and whether beds should be held:

```jsonc
  "type": "review_request",                      // always, from the main CTA
  "status": "submitted",
  "hold": { "requested": true, "hours": 48 }     // true only if the guest ticked it AND picked a start date; hours = HOLD_HOURS in config.js
```

Respond with JSON `{ "ref": "MM-ABC123", "status": "submitted" }` if you want to issue your own reference; otherwise the browser makes one. **The hold itself happens on your side**: when `hold.requested` is true, place a soft hold on the beds for those nights for `hold.hours`, and let it lapse if the trip isn't confirmed.

### Trip status page (optional)

The guest lands on `#/trip/<ref>` after sending. With `STATUS_ENDPOINT` set, it calls `GET <STATUS_ENDPOINT>?ref=MM-ABC123` and expects:

```jsonc
{ "status": "submitted | checking | ready | approved", "note": "Everything checks out, here's your confirmed plan", "payLink": "https://…" }
```

`ready` shows the guest an **Approve + pay deposit** button (it opens `payLink`). Without the endpoint the page runs in demo mode with buttons that step through each state so you can see them.

### Full payload

```jsonc
{
  "v": 1,
  "createdAt": "2026-10-14T09:12:44.000Z",
  "source": "trip-builder",
  "ref": "exeter",              // ?ref= (ambassador / campaign), "" if none
  "fromHostel": "hanoi",        // ?from= (QR placement), "" if none
  "contact": {
    "name": "Sam", "via": "whatsapp", "email": "", "whatsapp": "+447700900123", "from": "Manchester",
    "partySize": 2, "dates": "fixed | flex | open", "notes": "…", "consent": true
  },
  "trip": {
    "link": "https://…/#/build/i=s.hanoi.4.…",   // reopens the exact trip, editable
    "state": "i=s.hanoi.4.…&d=2026-11-18",
    "route": "Hanoi → Hoi An → Ho Chi Minh City",
    "days": 15, "nights": 14,
    "countries": ["VN"],
    "stops": ["hanoi", "hoi-an", "saigon"],       // madmonkeyhostels.com /destination/ slugs
    "start": "2026-11-18",                         // "" if undecided
    "estTotalUsd": 797,
    "breakdownUsd": { "beds": 73, "activities": 349, "transport": 123, "allIn": 0, "squadDiscount": 0, "spendFund": 252 },
    "allInBlocks": [],                             // ALL IN trips already in the plan, e.g. ["vietnam"]
    "allInMatch": "vietnam",                       // closest ALL IN trip if the route looks like one, else ""
    "crewMates": 0,                                // mates the Squad Leader says they're rallying
    "urgency": "hot | warm | cool | planning"      // from start date: ≤14d hot, ≤60d warm
  },
  "itinerary": "MY MAD MONKEY TRIP\nHanoi → …"     // plain-text day-by-day, ready to paste into WhatsApp / a CRM note
}
```

Notes for whoever builds the receiver

- It is a **lead, not a booking.** Prices are estimates; the crew confirms live rates before anything is charged.
- `consent` is always `true` (the form won't submit otherwise) and means "OK to contact me about this trip". It is **not** marketing consent.
- Add CORS for the site's origin, or proxy it from the same domain.
- A hidden honeypot field short-circuits bots in the browser; add your own rate limit server-side.
- Suggested first reply is in the `itinerary` + `allInMatch`: if `allInMatch` is set, lead with the ALL IN departure that lines up with `start`.
- Open `trip.link` in a browser to see exactly what the guest built.

Quick local receiver for testing (logs each lead, allows CORS):

```bash
node scripts/test-receiver.mjs
# then set LEAD_ENDPOINT: 'http://localhost:9000' in config.js
```


## How to contact the guest

The guest picks **one** way to be contacted: WhatsApp or email. Only that field is filled in and `contact.via` says which (`"whatsapp"` or `"email"`). Reply on that channel. The server accepts a request with either a valid email or a WhatsApp number (8–15 digits); it refuses one with neither.


## What the crew sees: `summary` and `crewText`

Every lead now also carries the trip laid out for a human reviewer (built by `crew.js`), so the email, the admin tab and the
crew review page all show the same thing without re-doing the maths:

```jsonc
"summary": {                          // JSON-safe, about 3 KB for a 3-stop trip
  "headline": "Hanoi → Hoi An → Ho Chi Minh City", "days": 12, "nights": 11, "stopCount": 3, "countries": ["Vietnam"],
  "start": "2026-11-13", "end": "2026-11-24", "datesLabel": "Dates are fixed", "people": 2, "pref": "Smart pick",
  "stops": [{
    "kind": "stop | allin", "name": "Hanoi", "country": "Vietnam", "nights": 4, "from": "2026-11-13", "to": "2026-11-17",
    "bedUsd": 6.76, "bedsUsd": 27, "partner": false,
    "tours": [{ "name": "Ninh Binh · Trang An boats + Mua Cave", "usd": 48, "est": false, "payOnDay": false, "date": "2026-11-14", "day": 2, "fits": true }],
    "next": { "to": "Hoi An", "mode": "Flight", "hours": "5h35", "usd": 65, "overnight": false, "date": "2026-11-17" }   // travel to the next stop; null on the last
  }],
  "budget": { "beds": 73, "tours": 155, "transport": 123, "allIn": 0, "squadDiscount": 0, "tripCost": 351, "spendPerDay": 20, "spendFund": 220,
              "total": 571, "people": 2, "tripCostAllPeople": 702, "totalAllPeople": 1142, "guestBudget": 1500, "budgetLeft": 929 },   // US dollars, per person unless it says AllPeople
  "flags": [{ "level": "warn | info", "text": "Ho Chi Minh City has no Mad Monkey yet. Find them a partner hostel and confirm the bed price." }],
  "allInMatch": { "id": "vietnam", "name": "Vietnam", "days": 14, "usd": 850, "nextDeparture": "2026-11-18" }   // or null
},
"crewText": "TRIP TO CHECK\nSam Carter · party of 2 · from Leeds\n…"   // the same thing as plain text, for WhatsApp / a CRM note
```

`itinerary` (the day-by-day text) is unchanged. A receiver that ignores `summary` and `crewText` keeps working.
"Spending money" (`spendFund`) is the guest's own food-and-fun budget: it is in the estimate but is never something to charge.
`MM.suggestBalance(summary, deposit)` gives a starting balance (trip cost for everyone less the deposit).
