# The crew server

`npm run server` runs the whole thing for real: the site, the API, and the crew console at **/admin**. Zero dependencies, Node 18+.

```bash
npm run server                       # http://localhost:8000, admin at /admin
ADMIN_TOKEN=pick-something-long HOLD_HOURS=48 NOTIFY_WEBHOOK=https://hooks.slack.com/… PORT=8000 npm run server
```

If you don't set `ADMIN_TOKEN` it generates one, prints it on start, and saves it to `server/data/admin-token.txt`.
The server rewrites `config.js` on the fly so the site talks to `/api` automatically. No config edits needed.

## What each piece does

| Guest does | Server does | Crew does (at /admin) |
|---|---|---|
| Taps **Hold my beds + get it checked** | Stores the request, issues `MM-XXXXXX`, starts the hold clock (`HOLD_HOURS`), works out a **bed-hold sheet** (hostel, check-in, check-out, nights), pings `NOTIFY_WEBHOOK` | Opens it, holds those beds in your booking system, marks it *Checking* |
| Watches `#/trip/MM-XXXXXX` | Serves status, the crew's note, the payment link (only once *Ready*), and hold expiry | Writes a note to the guest, pastes a payment link, marks *Ready* (or *Can't do it*, which releases the hold) |
| Approves | (your payment link takes them to pay) | Marks *Approved* (hold becomes a booking) |
| Plans with mates | Stores the group; every vote/“I'm in” is its own write, so simultaneous voters never overwrite each other | |
| Browses | Serves **live data** the crew edits: spots left on ALL IN trips, a site banner, real fares for any transport leg, real activity prices (these replace the built-in estimates and show a "live" tag) | Edits them in **Live prices + spots** |
| Reads reviews | Serves approved quotes per hostel | Adds / removes them in **Guest reviews** (only add ones you have permission to use) |
| Sees "guests go next" | Mixes your **imported real stays** with what guests are planning right now | Pastes a `from,to,count` CSV in **Where guests go** |
| Anything | Records anonymous funnel events | Reads the **Funnel** (visit → add stop → plan → review request) and which home door is used |

Holds expire on their own. An unapproved hold lapses after `HOLD_HOURS` and the lead is stamped *hold expired* (the crew can extend it 24h from the console). **The server only records and counts down holds. Actually blocking the beds happens in your booking system**, which the sheet is designed to make quick.

## Deploying

- It is one Node process with a `server/data/` folder of JSON files. Any small VM or container is enough (Fly.io, Railway, Render, a VPS). **Back up `server/data/`.** Put it behind HTTPS (Caddy, nginx, or the platform's TLS).
- Hosting the *site* elsewhere (Netlify, the main Mad Monkey site)? Deploy this server separately, set `ALLOWED_ORIGIN=https://your-site` on it, and set `API_BASE: 'https://your-api/api'` in that site's `config.js`.
- Behind a proxy, make sure it forwards `X-Forwarded-For` so rate limits are per guest, not per proxy.
- Rate limits: 12 review requests, 20 groups per hour per IP; 600 events per hour. Bodies are capped at 256 KB.
- `/admin` and `/api/admin/*` need the token (constant-time comparison). Treat the token like a password; rotate it by changing the env var.
- Personal data (names, emails, WhatsApp numbers) lives in `leads.json`. Decide your retention period and delete old leads; you are the data controller.
- If you outgrow JSON files (thousands of requests a month), swap the tiny `store()` for a database. The routes don't change.

## Tests

`npm test` runs the logic tests and `test/server.test.js`, which boots this server on a temp port and checks the API (auth, validation, holds, status flow, live data, groups under concurrent writes, rate limits).

## Date-specific flight prices (optional)

Without dates the builder shows typical fares. Once a guest sets a start date, each flight in the trip is looked up for its own day and priced at the **lowest fare found**, with the range shown on the leg card ("Fares that day: $31 to $96. We have used the lowest.").

Switch it on by giving the server a fare-provider account (Amadeus Self-Service):

```bash
AMADEUS_CLIENT_ID=... AMADEUS_CLIENT_SECRET=... AMADEUS_ENV=production npm run server
```

- `GET /api/fares?from=HAN&to=DAD&date=2027-01-13` only answers for flight pairs in `data/legs.js`, dates up to 330 days out; results are cached 6 hours; at most 400 upstream lookups an hour.
- No keys, no answer, or a crew-entered fare in `/admin`: the typical fare stays (crew fares always win).
- `AMADEUS_ENV` defaults to `test`, which returns sample data, not real prices.
- Amadeus does not carry every Southeast Asian low-cost airline, so real fares can be higher than the cheapest seat on a budget carrier's own site. Check coverage on your key before promising "lowest".


## Short links and link previews

When the server is running, **Share** turns a trip into a short link like `/t/abc1234`. Sent on WhatsApp, iMessage, Instagram DMs or Facebook, the link shows a preview card: the route on a map, the days, countries and price. Tapping it opens the trip in the builder.

- The guest's browser draws the 1200×630 card and uploads it with the trip (`POST /api/share`). The same trip always gets the same code.
- `/t/<code>` serves the preview tags and forwards to the trip. `/t/<code>.jpg` is the card.
- Preview images need an absolute address. Behind a proxy that sets `X-Forwarded-Host` this works on its own; otherwise set `PUBLIC_URL`, e.g. `https://trips.madmonkeyhostels.com`.
- Shared trips live in `DATA_DIR/shares.json` and `DATA_DIR/og/`. They hold routes only, no personal details.
- On the static GitHub Pages demo there's no server, so Share falls back to the long link with no preview.
