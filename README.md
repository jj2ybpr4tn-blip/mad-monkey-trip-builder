# Mad Monkey Trip Builder

Guests build a Southeast Asia trip on a map, see the real bus / boat / flight between every stop, the cost, and a
day-by-day plan, then send it to the crew. Or the builder spots that an **ALL IN** crew trip already covers it.

Plain static site. No build step, no framework, no server.

```bash
npm start        # static preview only (demo mode: nothing is sent anywhere)
npm test         # logic, server and page checks (routing, costs, dates, Trip Doctor, visas, festivals, crew server, 104 Google pages)
npm run server   # the crew server: review + bed holds, waitlist, groups, short links, crew console at /admin
npm run build-pages   # the pages for Google (see docs/SEO.md)
```

## What's in it

| | |
|---|---|
| **Map builder** | All 23 Mad Monkey hostels (+ Ho Chi Minh City as a partner stop) as pins. Tap to add. Animated route, mode + time on every leg, zoom by country. |
| **Transport engine** | ~60 ground / sea links + ~35 flights, shortest-path routed. Every leg offers *Smart pick / Cheapest / Fastest*; overnight buses replace a bed night; slow boats add nights. |
| **152 activities** | Real Mad Monkey tours with live prices, photos and deep links to the booking page. Scheduled onto the right weekday when a start date is set. |
| **7 ALL IN trips** | Vietnam, Ha Giang Loop, Cambodia, Indonesia, Gili T + Lombok, **Thailand** and **Laos** (both "launching soon"). "Build on this" bolts days on either end; "Customise" turns one into a DIY route. |
| **ALL IN matcher** | If a DIY route looks like an ALL IN trip, it shows DIY cost vs ALL IN price and next departure, and can swap it in. Squad Leader perk (3 mates 50% off, 6 free) built in. |
| **Quiz** | 7 questions → 3 best-fit routes (ALL IN, DIY classic, or *ALL IN + keep going*). Fits days, vibe, must-dos, budget, month. Runs a route in reverse if you land at the other end. |
| **Season + event flags** | Wet / rough-sea months per hostel, Rinjani closure, Kampot's 1 Nov opening, Halloween parties, the Thailand–Cambodia border. |
| **Share** | Link that reopens the exact trip (short, stable, editable), WhatsApp share, 1080×1920 story card PNG, print / PDF. |
| **Lead capture** | Sends the whole plan to your endpoint. Runs in clearly-labelled **demo mode** until you set one. |
| **Country-aware recommendations** | Tick 1–3 countries and the itinerary re-plans itself to cover all of them (real transport, your budget style, 7–30 days). Edit anything by hand and it stops overriding you and just recommends. |
| **Declutter map** | Nearby hostels merge into numbered bubbles that split as you zoom; country chips are a multi-select focus (Indonesia + Thailand dims everything else); mode/time pills show only on hover or when you tap a leg; drag, scroll or pinch to move, +/− and FIT buttons. |
| **Drag-and-drop + timeline** | Reorder stops by dragging the grip (mouse or touch), with a colour-coded timeline strip across the top. |
| **"Why this leg?"** | Plain-English trade-offs ("flight saves 11h25, costs ~$43 more; the bus doubles as your bed") plus arrival times, with a warning when something lands at 3am. |
| **Guests go next** | Ranked from Mad Monkey's own products (ALL IN itineraries, the featured partner trip, Mad Packages, the LP↔VV tickets), each chip tagged with where it comes from. |
| **Smarter planning** | Best months for the route (your month highlighted), budget target with live bar, *Suggest my next stop*, *Make it cheaper / faster*, entry rules by passport with official links. |
| **Photos + trust** | Real photo strips + lightbox for every hostel (127 photos), the published 4.9/5 from 53,000+ travellers and the three named quotes. No hostel-level reviews are published, so none are shown (drop real ones into `MM.REVIEWS`). |
| **Human review + bed hold** | "Hold my beds + get it checked": the trip goes to a real crew member, beds are held while they check, the guest gets a reference and a status page, and approves before paying. Highlighted across the site. See [docs/LEADS.md](docs/LEADS.md). |
| **Pay your way** | After the crew approves a trip, the deposit already paid counts and the guest chooses how to pay the rest: all now, a week before they leave, or in instalments when they leave 60+ days out. See [docs/PAYMENTS.md](docs/PAYMENTS.md). |
| **Crew review** | What the team receives when a trip is sent: the whole trip as the guest built it (stops, tours, travel, money, heads-up) in the email, with **Approve / Not approved / Edit it** buttons that open a review page. See [docs/CREW-REVIEW.md](docs/CREW-REVIEW.md). |
| **Group mode** | Share a link; mates vote Yes / Maybe / No per stop and tap "I'm in"; the Squad Leader meter ticks up (3 = 50% off, 6 = free). Demo mode until `GROUP_ENDPOINT` is set: [docs/GROUP.md](docs/GROUP.md). |
| **USD / GBP** | Fixed indicative rate (1.27). Real conversion belongs to the booking engine. |
| **Trip Doctor** | Scores the pace of a trip and fixes it in one tap: back-to-back night buses, 14-hour journeys, one-night stops, too many stops, odd arrival times, visa length, festival clashes. |
| **Visa length check** | Compares days in each country with what the guest's passport allows. Limits in `data/rules.js`, official links in `data/entry.js`. |
| **Festivals + closures** | Tet, Songkran, Nyepi, Ramadan, Holy Week, Loy Krathong, Christmas peak and more, checked against the trip's dates with a suggested better week. |
| **Know before you go** | Money, SIMs, getting around, scooters and licences, safety, manners and health per country, plus local knowledge per hostel (`data/guide.js`). |
| **Don't miss** | Flags hostels the route passes through and the standout activity at each stop. |
| **Themed trips + Surprise me** | Eight hand-picked routes and a remix button. |
| **Trip pack** | A designed, printable itinerary (`#/pack/...`): hostels, transport, day by day, local knowledge, visas, festivals, packing list. |
| **Groups** | Vote, suggest stops, heart activities ("Sam wants Pai"), Route A vs B, and see where friends' trips cross. Short share links with rich previews. |
| **Launch waitlist** | "Tell me when it launches" on Thailand and Laos, by WhatsApp or email, as the guest prefers. |
| **Crew console** | Reviews + holds, assign, reply templates, wait timers, CSV, waitlist, hostel details, live prices, funnel. |
| **Pages for Google** | 104 plain pages (trips, routes, hostels, country guides) with structured data and a sitemap. See `docs/SEO.md`. |
| **Currencies** | USD, GBP, EUR, AUD, CAD, with local currency hints per country. |

## Go live

**The fast way: the bundled crew server.** `npm run server` runs the site, the API and a crew console together
(see **[docs/SERVER.md](docs/SERVER.md)**). It turns on, with no config:

- **Human review + bed holds.** Requests land in `/admin` with a ready-made **bed-hold sheet** (hostel, check-in, check-out). The crew marks them *Checking / Ready / Approved / Can't do it*, writes the guest a note and pastes a payment link, and the guest's status page updates.
- **Live prices + spots left** edited by the crew; real fares replace the built-in estimates.
- **Real guest reviews** per hostel, **real "guests go next"** (paste a CSV of stays), **group mode** across devices, and a **funnel** view.

**The other way: your own backend.** Leave `API_BASE` blank and set `LEAD_ENDPOINT` etc. in [config.js](config.js) to endpoints you build. Contracts: [docs/LEADS.md](docs/LEADS.md), [docs/GROUP.md](docs/GROUP.md).

Optional switches in `config.js`: `WHATSAPP`, `CREW_EMAIL`, `SITE_URL`, `PRIVACY_URL`, `HOLD_HOURS`, and **`PHOTO_BASE`** (serve photos from your own copies: run `npm run mirror-photos` first).

Attribution params work out of the box: `?ref=exeter` (ambassador / campaign) and `?from=hanoi` (QR in the Hanoi common room → opens at "Where next from Mad Monkey Hanoi?"). Both land in the lead.

## Before launch: things that are estimates (please check)

The brief was to build it from what Mad Monkey already publishes, so **every number is sourced, and every guess is labelled**:

| Area | Status |
|---|---|
| Hostel list, dorm "from" prices, Kampot opening | **Live from madmonkeyhostels.com** (Oct 2026). `data/places.js` |
| Activity names, prices, run-days (≈110 tours) | **Live from madmonkeyhostels.com/tours-events.** Prices will drift; re-pull before big pushes. `data/activities.js` |
| ALL IN prices, durations, departures, inclusions | From the website + ALL IN PDF. Vietnam stops differ slightly between web (Danang) and PDF (Ninh Binh); the PDF is used. |
| **Thailand** activity prices, **Laos** activity prices, Kampot, Koh Sdach extras, a few Saigon / Manila / Apo Island items | **Estimates, shown as "~$X est."** Thailand + Laos have no public tour pages yet. Laos trip price ($449) is the recommended RRP from the internal proposal and **still needs sign-off**. Internal cost / margin data is deliberately not used anywhere. |
| **Transport legs** (`data/legs.js`) | **Typical / researched figures**, rounded, always shown with "~". Aggregator + operator pages, Oct 2026. Ops should sanity-check this file; it's the one most likely to be wrong in places (flights especially move weekly). |
| Surf-camp beds | Siargao packages are "all-inclusive" so beds are treated as included. **Lombok surf camp isn't assumed to include beds**: confirm. |
| Season ratings, hostel hooks | **Editorial judgement**, not booking data. |
| "Guests go next" | Ranked from Mad Monkey's own trips and packages (see above), **not** from booking data. Real check-out → check-in flows would be better. |
| **Entry rules** (`data/entry.js`) | **Checked against current web sources in Oct 2026** ([docs/ENTRY-SOURCES.md](docs/ENTRY-SOURCES.md)), including Thailand's cut to 30 days on 15 Sep 2026. Laos fees conflict between sources, so the app says to check. These change often: re-check every few months. |
| **Bed hold** | The server records and counts down the hold and gives the crew the sheet; **the crew has to actually block the beds** in your booking system. `HOLD_HOURS` (48) is a placeholder: set a number ops can honour. |
| Photos | All 260 (hostels, tours, galleries) are **mirrored into `assets/photos`** at 1100px (`npm run mirror-photos`; re-run to refresh). The crew server uses them automatically; for a static host set `PHOTO_BASE: '/assets/photos'`. They're Mad Monkey's own published photography. |
| Photos | Hot-linked from madmonkeyhostels.com share images. They fall back to a flat block if one 404s. Copy into `/assets` or your CDN before launch so the page doesn't depend on the main site. |

**Thailand ↔ Cambodia border:** reports from Feb–Jul 2026 say the land crossings are closed, so Bangkok ↔ Siem Reap / Phnom Penh is flights-only in the graph and every such leg shows a warning. When it reopens, flip `open` in `MM.BORDERS` and add bus edges.

## Where to change things

| To change… | Edit |
|---|---|
| A hostel, price, season, "guests go next" | `data/places.js` |
| An activity or price | `data/activities.js` (`est: true` marks estimates) |
| A bus / boat / flight, or a closed border | `data/legs.js` |
| An ALL IN trip, a DIY classic, the day-by-day text | `data/trips.js` |
| Matching, routing, pricing rules | `logic.js` (all pure functions, covered by `test/logic.test.js`) |
| Look and feel | `styles.css` (tokens at the top; Mad Monkey core brand) |
| Where leads go | `config.js` |

Share links stay valid when you edit data: activities are referenced by short codes derived from their id, and place ids match madmonkeyhostels.com slugs. Unknown ids are dropped gracefully rather than breaking the link.

## Files

```
index.html          shell            config.js     go-live switches
app.js              views + events   logic.js      routing, plan, costs, matcher, quiz, share
ui-map.js           SVG map          ui-story.js   story-card canvas
styles.css          brand system     scripts/build-map.mjs   regenerates data/map-data.js (Natural Earth)
data/               places, activities, legs, trips, media, map-data
assets/logo/        the official wordmarks (downloaded, never redrawn) + favicon
docs/LEADS.md       lead payload for whoever builds the endpoint
docs/CREW-REVIEW.md the crew email + review page, and the endpoint it talks to
docs/PAYMENTS.md    deposit, approval, then the rest your way (now / a week before / instalments)
test/               logic tests (node, no dependencies)
```

## Brand notes

Follows the Mad Monkey core design system: Montserrat 900 uppercase display, the eight poster colours (never more than three at once) on Mad Black / Bone / Paper, 3px outlines, hard-offset shadows with no blur, sharp-or-pill corners, one brand device per layout (ALL IN sticker, lime starburst), official logo files only. Copy is British English and in voice. No decorative emoji.

## Still to do
- **Live fares** from a real provider. Today the crew enters real fares in `/admin`; the built-in table is the fallback. (12Go / Rome2Rio style feeds need paid API keys.)
- **Real reviews.** The slot, the admin screen and the display are built; Mad Monkey publishes no per-hostel reviews, so add real ones in `/admin`.
- **Booking-system link:** a button that creates the hold and the deposit in your booking engine, rather than the crew doing it by hand.

## Ideas worth building next

1. **One-tap booking.** Connect the builder to your booking engine so the crew's "Ready" step creates the hold and the deposit link for them.
2. **Live fares feed** (12Go / Rome2Rio / airline APIs) behind the same override mechanism the crew console already uses.
3. **Real stays data** imported nightly (the `/admin` CSV import is the manual version of this).
4. **Pre-trip emails** from the status page: "your trip is confirmed", visa reminders for the countries on the route, a day-before checklist.
5. **Group mode → group booking:** when 6 mates are in, hand the whole crew to the booking engine with the Squad Leader perk applied.
6. **Multi-language** (the audience is UK and US today; Spanish, German and French travellers are the next obvious markets).
7. **Post-trip loop:** invite guests to leave a real review for each hostel they stayed in; those feed the reviews slot.
