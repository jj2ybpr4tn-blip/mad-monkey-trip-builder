# Mad Monkey Trip Builder

Guests build a Southeast Asia trip on a map, see the real bus / boat / flight between every stop, the cost, and a
day-by-day plan, then send it to the crew. Or the builder spots that an **ALL IN** crew trip already covers it.

Plain static site. No build step, no framework, no server.

```bash
npm start        # python3 -m http.server 8000  → http://localhost:8000
npm test         # 91 logic checks (routing, costs, dates, share links, quiz matcher)
```

## What's in it

| | |
|---|---|
| **Map builder** | All 23 Mad Monkey hostels (+ Ho Chi Minh City as a partner stop) as pins. Tap to add. Animated route, mode + time on every leg, zoom by country. |
| **Transport engine** | ~60 ground / sea links + ~35 flights, shortest-path routed. Every leg offers *Smart pick / Cheapest / Fastest*; overnight buses replace a bed night; slow boats add nights. |
| **152 activities** | Real Mad Monkey tours with live prices, photos and deep links to the booking page. Scheduled onto the right weekday when a start date is set. |
| **7 ALL IN trips** | Vietnam, Ha Giang Loop, Cambodia, Indonesia, Gili T + Lombok, **Thailand** and **Laos** (both "launching soon"), plus The Gap Collective. "Build on this" bolts days on either end; "Customise" turns one into a DIY route. |
| **ALL IN matcher** | If a DIY route looks like an ALL IN trip, it shows DIY cost vs ALL IN price and next departure, and can swap it in. Squad Leader perk (3 mates 50% off, 6 free) built in. |
| **Quiz** | 7 questions → 3 best-fit routes (ALL IN, DIY classic, or *ALL IN + keep going*). Fits days, vibe, must-dos, budget, month. Runs a route in reverse if you land at the other end. |
| **Season + event flags** | Wet / rough-sea months per hostel, Rinjani closure, Kampot's 1 Nov opening, Halloween parties, the Thailand–Cambodia border. |
| **Share** | Link that reopens the exact trip (short, stable, editable), WhatsApp share, 1080×1920 story card PNG, print / PDF. |
| **Lead capture** | Sends the whole plan to your endpoint. Runs in clearly-labelled **demo mode** until you set one. |
| **USD / GBP** | Fixed indicative rate (1.27). Real conversion belongs to the booking engine. |

## Go live (3 steps)

1. **Lead endpoint.** Set `LEAD_ENDPOINT` in [config.js](config.js) to a URL that accepts a JSON `POST`. Payload in [docs/LEADS.md](docs/LEADS.md). Until then guests see a yellow "DEMO MODE: nothing was sent" banner; nothing leaves the browser.
2. **Optional contact buttons.** `WHATSAPP` (digits, with country code) adds "Message the crew on WhatsApp"; `CREW_EMAIL` adds an email fallback; `SITE_URL` fixes share links to your public address; `PRIVACY_URL` adds a privacy link under the form.
3. **Host it.** Any static host. Drop the folder on the Mad Monkey site / a subdomain / Netlify / Cloudflare Pages / S3.

Attribution params work out of the box: `?ref=exeter` (ambassador / campaign) and `?from=hanoi` (QR in the Hanoi common room → opens at "Where next from Mad Monkey Hanoi?"). Both land in the lead payload.

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
| Season ratings, "guests go next", hostel hooks | **Editorial judgement**, not booking data. Swap `next` ordering for real booking flow data when you have it. |
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
test/               logic tests (node, no dependencies)
```

## Brand notes

Follows the Mad Monkey core design system: Montserrat 900 uppercase display, the eight poster colours (never more than three at once) on Mad Black / Bone / Paper, 3px outlines, hard-offset shadows with no blur, sharp-or-pill corners, one brand device per layout (ALL IN sticker, lime starburst), official logo files only. Copy is British English and in voice. No decorative emoji.

## Ideas worth building next

1. **Live availability + deposit.** Pull real "spots left" and the $99 deposit straight into the ALL IN cards (the booking engine already has both).
2. **Rank "guests go next" with real booking data** (where people checked out → checked in next). It's editorial today; this makes it the best cross-hostel funnel you have.
3. **Common-room QR / reception iPad.** `?from=<hostel>` is already supported: one QR per property, leads arrive tagged with where the guest is standing.
4. **Ambassador + university links.** `?ref=` is captured; wire it to the uni-ambassador giveaway so every shared trip credits the referrer.
5. **Group mode.** Share link → friends vote on stops → Squad Leader sees the crew and the 50% / free perk tick up.
6. **MadPass / Mad Loyalty hook** on long trips (30+ days).
7. **Live transport feed** (12Go / Rome2Rio) replacing the typical-fare table, keeping the table as fallback.
