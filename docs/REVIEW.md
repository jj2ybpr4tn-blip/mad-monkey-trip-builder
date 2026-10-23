# The big review (22–23 Oct 2026)

Every layer of the trip builder was read, scanned and attacked: the planner and the data, security, the screens (accessibility, phones), speed, and the ALL IN backend the live site runs on. This is what was found, what was done about it, and what is still open. Each fix has a test that fails on the old behaviour where one could be written.

## What was found, and fixed

### Security

| Severity | Finding | Fix | Where |
|---|---|---|---|
| **Critical** | The crew server served any file, including the admin token and every guest's details, to a request like `/../server/data/…` (a browser tidies the address, so a normal test missed it; `curl --path-as-is` showed it) | Strict path handling and a list of the only files that may be served; raw-request tests (they fail on the old code) | `server/server.mjs` |
| **High** | ALL IN backend: a request that *says* `Origin: https://evil.example` got our emails built on that address, including the crew's Approve / Not approved / Edit it buttons and the guest's links, which carry keys. Proven end to end: the old code emailed `https://evil.example/trip-builder/#/trip/MM-…?k=<key>` | Links only ever use our own sites (`trustedBase`); the e2e run fails on the old code | ALL IN patch 0005 |
| **High** | Text a guest wrote (route, notes, tour names, a `javascript:` link) was drawn unescaped in places, with no Content-Security-Policy | Everything escaped, numbers drawn as numbers, links only if http(s); a Content-Security-Policy; no inline handlers (`npm run lint` checks). A hostile-data test feeds markup into every field of the crew page, trip page, group page, sent-trips list, stage bar and log-in (22 states) | `ui-*.js`, `index.html`, `test/ui-xss.js` |
| Medium | Behind a proxy, a made-up `X-Forwarded-For` header dodged the rate limit | `TRUST_PROXY` (off by default) and a test | `server/server.mjs`, `docs/SERVER.md` |
| Medium | ALL IN backend: links are signed with the admin password unless `TRIP_BUILDER_LINK_SECRET` is set, so any guest could guess the password offline from their own link | The functions log a warning while it is unset. **Set it (`openssl rand -hex 32`).** | ALL IN patch 0005 |
| Medium | Anyone could fill the crew's list with junk trips | 5 an hour per contact and 10 per address (kept only as a keyed hash), a refusal saves nothing | ALL IN patch 0005 |
| Low | Admin password compared in constant time; a trip's link must lead to our own builder; the admin page links only http(s); a lead link can't be `javascript:` | done | ALL IN patch 0005, `server/` |
| Privacy | A shared (hostel) computer kept the next person's trip, details and the key that lets them change a sent trip | A footer button, **Forget my trip and details on this device** (only shown when something is remembered) | `app.js` |

### Crashes and wrong numbers

- A damaged saved trip or a share link with a stray `%` blanked the home page or the builder. Now: `sanitizeState` (drops places that no longer exist, clamps numbers, never throws), a safe link decoder, and an error boundary that shows "That didn't load" with a way out instead of a white page.
- A made-up trip with `n: 1e9` nights ran the browser out of memory. Clamped.
- Found by the new fuzz test (about 8,000 made-up trips, broken links and random edits per run, seeded): a stored trip with a nonsense food fund priced as NaN; "Unpin" on an ALL IN block crashed; `__proto__` and `constructor` were accepted as place names.
- Arrival times for overnight journeys (a sum of 5-minute steps), the "opens on …" warning (it used the trip's start, not the day you arrive), calendar files with over-long lines, a "Kampot opens 1 Nov." line that would be wrong from 1 Nov (it now goes by itself).
- **Currency**: GBP was 5.7% off and IDR 11% off. Updated to the 22 Oct rates, and `FX_ENDPOINT` can keep them fresh (off by default: it makes each visitor's browser call a third party).

### Accessibility and phones

- Modals: labelled, the page behind is inert, focus is trapped and returned; a route announcer, the title changes per screen, a skip link, one `h1` per screen, headings never skip a level (a small normaliser sets `aria-level`), tour cards are real buttons. axe-core (WCAG 2.2 AA + best practice) is clean on every main screen and modal, and so is the new search box in every state (open, no match, one letter).
- 320px phones: the logo was squashed to 28px wide and the header overflowed; the hero grew sideways when the search list opened; wrapped links overlapped. All fixed; `test/ui-lint.js` is clean at 320, 375, 414 and 767 (as a touch screen, where every tap target is 44px).

### Speed

- Photos are the weight, not the code. `npm run thumbs` makes two small WebP copies of each of the 260 photos (12 MB in all). A three-stop builder page went from **3.3 MB of photos to 170 KB**; the Google pages use them through `<picture>` with the JPEG as fallback; a missing small copy falls back to the full photo. The pages also gained fetch timeouts everywhere a screen waits on a server. The live ALL IN site hot-links the full photos, so it gets the same speed-up with one command, `node scripts/sync-allin.mjs <site> --with-thumbs`: it hosts just the 13 MB of small copies beside the builder and sets `THUMB_BASE` (the page finds each small copy from the hot-linked address it would have used; `test/thumbs.test.js` proves every photo maps to a copy that exists).

### The data

`npm run audit` checks prices, legs, tours, ALL IN trips, photos and wording against each other (0 errors). The entry rules were checked again against current sources on 23 Oct (Thailand 30 days from 15 Sep 2026, Vietnam, Cambodia, Indonesia, the Philippines, Laos): nothing needed changing ([ENTRY-SOURCES.md](ENTRY-SOURCES.md)). Two small content gaps remain for a person (see the list at the end): **Nacpan Beach lists only two things to do**, and **the Nusa Lembongan sauna + ice bath has no price**.

## What was added

- **Type where you're going.** "Where to?" on the home page and in the builder; **Best order**. [PLANNING.md](PLANNING.md)
- **Plan in stages**, with **log in by email** (no password). [PLANNING.md](PLANNING.md)
- **A real human checks every trip**, and **Ask Ewan** on every screen. [PLANNING.md](PLANNING.md)
- **Free to send** (Ewan, 23 Oct). Sending a trip for checking costs nothing: no deposit, no payment on the way in. The crew checks it and sets the price; only then does the guest pay, their way (all now, a week before they leave, or instalments), and a card is saved as part of choosing. The deposit is still there as a switch. [PAYMENTS.md](PAYMENTS.md)
- **Skip the rest of the quiz** after the landing point.

## How to check it yourself

```bash
npm run check          # lint, data audit, thumbnails up to date, then every test
handoff/all-in-backend/e2e/run.sh /path/to/mm-squad-trips      # the backend, end to end (needs Deno 2)
```

In a browser tab on `npm start`: `test/ui-xss.js` (hostile data), `test/ui-lint.js` (phone layout), `test/ui-smoke.js` (presses every button), `test/ui-free.js` (free to send).

| Check | Result |
|---|---|
| logic / planner | 295 |
| search | 28 |
| fuzz (seeded, about 8,000 cases) | 5 checks, clean over 8 seeds |
| server | 70 |
| Google pages | 12 |
| photo copies (`test/thumbs.test.js`) | 18 |
| ALL IN backend: Deno tests / end to end / vitest | 58 / 161 / 45 |
| free to send, in the browser (`test/ui-free.js`: the form, the trip page in every state, the crew page) | 37 |
| hostile data in the browser | 22 screens, clean |
| axe-core | clean on every main screen and modal |
| phone layout (320 / 375 / 414 / 767 touch) | clean |
| dead buttons (`test/ui-smoke.js`: 323 presses on 6 screens) | 0 did nothing, 0 script errors |

## What a person still has to do

1. **Send the ALL IN patches to Charlie** (`handoff/all-in-backend/`, seven of them, [README](../handoff/all-in-backend/README.md)) and set `TRIP_BUILDER_LINK_SECRET`. Until the backend patches are live the live site still asks for a deposit, its login and stage features can't email anything, and the forged-origin hole is open.
2. **Try it end to end with a small real payment** once it is live: send a trip (it should be free and Ewan should get the email at once), approve it, then pay a small amount each of the three ways (all now; "a week before" through the card page; instalments). None of this was run against live Stripe, Resend or the Supabase gateway.
3. **Fill two small gaps in the data if you know the answers.** They are optional and don't hold anything up. *Nacpan Beach* (El Nido, Palawan) lists only two things to do, "Nacpan ultimate island hopping" ($39) and "Sunset cruise" ($21), where every other hostel has three or more; if there is a third (or more), send its name and price. *"Sauna + ice bath" at Nusa Lembongan* has no price in the data; send the price, or "free" if guests don't pay for it, and it is added. (Kampot: confirmed by Ewan, it opens on 1 Nov 2026 as the data says.)
4. **Optional: the photo speed-up on the live site.** Charlie runs `node scripts/sync-allin.mjs <site> --with-thumbs` from this repo. It adds 13 MB of small photos beside the builder and needs nothing else.
5. **Check the wording.** The builder says "Plan it here. A real human checks it before anything is booked." It does not say "designed with AI", because nothing in the builder is AI (the chat was removed; the planner is routing and pricing rules). If AI is added later, the line in `HUMAN` at the top of the Ask Ewan block in `app.js` is the one place to change.
6. **Free requests still ask the crew to hold beds** for up to 48 hours (the new-trip email says "beds held until ..."). Free means more requests, so more holds. If you'd rather only hold once a trip is approved, say so and the wording and the email change.
7. **Watch for junk.** The deposit used to keep it out. Now a trip is limited to 5 an hour per contact and 10 an hour per address, and nothing a sender types is printed in an email to someone else. If junk still comes, the next steps are a Turnstile check on the form, or set `TRIP_BUILDER_DEPOSIT_PER_PERSON` to 50 again (and `DEPOSIT_PER_PERSON` in the builder's `config.js`).
8. **Not built:** working offline (Wanderlog charges for it; a service worker would be the way, with care over stale files), notes on a stop, real-time editing together, one payment for a whole journey of stages.
