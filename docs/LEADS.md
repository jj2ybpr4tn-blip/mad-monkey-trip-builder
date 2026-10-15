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
