# ALL IN launch pack

For Charlie. The new ALL IN site, ready to host at madmonkeyhostels.com/all-in-trips, with what it needs around it.
Before launch: it names the 2027 trips and their prices, so please don't share the link. It's on its own branch of the
trip builder repo (`launch-pack`), which comes down once the site is live. Nothing switches until Ewan says it's launching.

To get it: `git clone -b launch-pack --single-branch https://github.com/jj2ybpr4tn-blip/mad-monkey-trip-builder.git all-in-launch`

Built 24 Nov 2026 from concept v22 (the same page as the private preview, without the preview's bar, notes or code
comments) with the trip builder at main `3e7de8d`. Today's ALL IN trips have their own pages inside the site and book right
through to Stripe, the way today's pages do (below). `BUILD.txt` says exactly what went in and how to build it again.

**New since 21 Nov** (more under "What's new on 24 Nov" below): the trips' new names (The Big One is the 100-day trip, at the
same `/all-asia` address), the ALL IN business WhatsApp (+66 96 689 4646) beside Ask Ewan and in the footer, Ask Ewan and
Book in a bar at the bottom of every trip page on a laptop too, and the trip builder at its latest main.

## What's in it

| Path | What it is |
|---|---|
| `all-in-trips/index.html` | The whole site in one file (about 1 MB): every trip, The Big One, the festival trips, checkout, Ask Ewan and the business WhatsApp. No preview bar, no lock. |
| `all-in-trips/v/` | Our own films, which the page loads from `/all-in-trips/v/`: Ewan's Ha Giang Loop clip (1080p for laptops, 720p for phones) and 1080p copies of the four stock films still in use. |
| `CHECKLIST.md` | Go-live, step by step, with the checks on a phone and a laptop. |
| `BUILD.txt` | What it was built from, the file checksums, and how to rebuild it. |

## Hosting it

1. **One file at every trip's address.** Serve `all-in-trips/index.html` at `/all-in-trips` and at each trip's own address
   below. It's the same file every time: the page reads the address and opens that trip. These replace today's ALL IN
   pages, and the first six are today's addresses, so links already in ads, bios and creator posts keep working.

   `/all-in-trips/vietnam` `/cambodia` `/indonesia` `/laos` `/thailand` `/all-asia` (The Big One, the 100-day trip), and the new ones:
   `/philippines` `/tet` `/nyepi` `/newyear` `/lightboats` `/yipeng` `/raceday`

   And today's trips, which keep selling until the 2027 trips replace them (new in v22, decided by Ewan on 19 Nov). The 2027
   trips take today's `/vietnam`, `/cambodia`, `/indonesia`, `/laos` and `/thailand`, so those five of today's trips get their
   length added, the way today's 7-day trips are already named, and the two 7-day trips keep theirs:

   `/all-in-trips/vietnam-14` `/cambodia-14` `/indonesia-12` `/laos-10` `/thailand-11` `/vietnam-7` `/indonesia-7`

   (`/thailand-11` is link-only: noindex and linked from nowhere, as today's Thailand page is.)

   Only those. Everything else under `/all-in-trips/` stays as it is: the trip builder (`/all-in-trips/trip-builder/`),
   Admin, and anything else today's app serves there. A trailing slash (`/all-in-trips/vietnam/`) should redirect to the
   address without one.
2. **The films.** Put `v/` at `/all-in-trips/v/`, served as `video/mp4` with range requests (any static host does both).
   Phones play the four stock films from Mixkit's own site, as the preview does; only Ewan's clip has a phone copy here.
3. **Tags.** The page loads no tags of its own. Paste the site's Cookiebot script, then its Google Tag Manager script, where
   the comment near the top of `<head>` says, and Tag Manager's `<noscript>` part where the comment after `<body>` says. The
   page pushes the same dataLayer events as today's ALL IN pages (`view_item_list`, `select_item`, `view_item`,
   `begin_checkout`, `generate_lead`, with `conversion_type: 'all_in'`), so reports and ad conversions carry on.
4. **The microphone (new).** "Not sure which one?" lets guests talk instead of typing (more below). It needs the page on
   https, and the microphone allowed for the site's own pages. If the site sends a `Permissions-Policy` header, it needs
   `microphone=(self)` for `/all-in-trips/`. With `microphone=()` nothing breaks: the page hides its mic and points phones
   to the mic on their keyboard, but nobody can talk to it. No CSP change: the page makes no new requests for it.
5. **Today's trips book from day one, so the page needs the site's public key.** Today's trip pages get their dates and
   prices from `trips-get` and take payment through `create-checkout-session`, the same calls today's pages make, with the
   site's public anon key (the one today's app already ships). Add it in `<head>`, just above the tags:
   `<script>window.ALLIN_LIVE = {key: '<the anon key>'}</script>`. Without it, today's trip pages say their dates didn't load
   and can't book. The 2027 trips stay as free requests to the crew until each is in the booking system.
6. **Old links to today's trips still land right.** Stripe's "back" link (`/all-in-trips/<slug>?cancelled=1#booking`) and
   Admin's one-click links (`?date=…&spots=…&code=…#booking`) on `/vietnam`, `/cambodia`, `/indonesia`, `/laos` or `/thailand`
   open today's trip (the address changes to the new one, the rest of the link kept), not the 2027 one. A plain `/vietnam`
   is the 2027 page. Worth pointing both at the new addresses in today's backend anyway.
7. **Cache.** After each upload, clear Cloudflare for `/all-in-trips*`.

## What's new on 24 Nov

- **The trips' new names** (decided by Ewan on 21 Nov): Angkor to the Islands (Cambodia), North to Hoi An (Vietnam), Volcanoes &
  Beaches (Indonesia), Mountains & Lagoons (Thailand), Rivers & Balloons (Laos), the Island Hopper (the Philippines, unchanged),
  Tết in the North, Ogoh-ogoh & Nyepi, Songkran to Pi Mai, Fire Boats on the Mekong, Yi Peng Lanterns, The Water Festival, and
  The Big One (the 100-day trip that was ALL ASIA). Only the names changed: every address, price and date is as it was, so
  `/all-in-trips/all-asia` is The Big One's page. The titles, share cards and structured data carry the new names. The trip
  builder's own Cambodia route is now Islands + Hammocks, so the site has one Island Hopper.
- **The ALL IN business WhatsApp, +66 96 689 4646** (Ewan, 24 Nov). Under every Ask Ewan form ("Rather WhatsApp? Message us
  on +66 96 689 4646", with the trip they're looking at in the first line of the message), in the footer, on today's trip
  pages beside "Want to talk it through?", and offered with their question in it if an Ask Ewan message fails to send. The
  trip builder's Ask Ewan has it too (main `3e7de8d` or later, `WHATSAPP` in its config.js). Ask Ewan still sends to the crew as
  before. Each tap pushes `{event: 'whatsapp_click', conversion_type: 'all_in', placement}` to the dataLayer, if you want it
  as a conversion in Tag Manager. Please check the number rings the right phone once it's live.
- **Ask Ewan and Book on every trip page, on a laptop too.** A trip page covers the site's bar, and on a laptop its Ask Ewan
  was only far down the page. It now has the same bar along the bottom as on a phone: the trip, its price, Ask Ewan and Book
  (it steps aside while the trip's own booking panel is on screen).
- **Make it yours matches the trips.** North to Hoi An's Hanoi to Hoi An and The Big One's Manila to El Nido fly in the trip
  builder, as their days say, now that the builder goes by land and sea first. The day counts stay at 14 and 100.

## The trip builder switch

Unchanged from the launch switch doc: in `mm-squad-trips`, `public/trip-builder/config.js`, set `ALLIN_SITE: '../'` and
`LOOK: 'allin'`, then from the trip builder repo's latest main run `node scripts/sync-allin.mjs /path/to/mm-squad-trips --check`
and the same again without `--check`. The builder then wears the ALL IN site's bar and menu, and "Back to the trip" opens
the trip's page on the new site. Contract: `docs/ALL-IN-SITE.md` in the trip builder repo.

## The backend

Same endpoints as now. The site sends trips and questions to `trip-builder-request`; once a trip is in the booking system,
its $99 deposit goes through `create-checkout-session`, as today's site does (off in this build: see `BUILD.txt`).

- **New in v21, nothing to build:** when a guest has told "Not sure which one?" what they're after (typed or said), their words
  and any TikTok link go with whatever they send: in the notes ("TikTok they shared: …", "In their words: “…”", as much as
  fits the 2,000 characters), in the crew text ("IN THEIR OWN WORDS", "TIKTOK THEY SHARED", in full), and as
  `payload.told = {words, tiktok, from}`. It's all in the payload already. Nice to have: show `payload.told` in Admin.
  The $99 checkout doesn't carry them.
- **Today's trips (v22), nothing to build:** they call `trips-get`, `validate-discount` (squad, discount, creator and second
  codes, checked as typed), `create-checkout-session` (the same body as today's page: tripSlug, departureId, groupSize,
  leadBooker, travelers, discountCode, secondDiscountCode, squadCode, travellerMode, whatsappOptIn, utm, gaClientId,
  saleKey) and `advisor-enquiry` ("Want to talk it through?"). Inside 7 days the trip is paid in full, otherwise $99 a spot
  and the balance 7 days before; the pricing calendar and the Black Friday prices work as on today's page. `/checkout`,
  `/booking-success`, `/pay-balance`, `/squad-leader`, `/admin`, `/staff-leaderboard` and `/students` stay on today's app.
- **Still to build before launch** (briefs in the launch switch doc): the Island Hopper's $99 deposit after the crew approves,
  the free night yes or no (`freeNight`), and a question type for Ask Ewan.

## Talking instead of typing: what it does

In "Not sure which one?" there's a mic inside the box. Tap it, talk (as long as you like), and the words go into the box as
you speak; tap again to stop, or it stops by itself after a few seconds of quiet. Then "Find my trip" reads it, however long
and rambling: months, how long, budget, who's coming, what they love, places and things they name (the Ha Giang Loop,
waterfalls, a boat party they saw on TikTok), and places they've already done.

It's the browser's own speech-to-text, in English. The browser turns the voice into text with its own speech service (Google's
in Chrome, Apple's in Safari, Microsoft's in Edge). The page never gets or keeps audio, only the words, and a line under the box
says so. Firefox has no speech-to-text, so it shows no mic. If someone says no to the mic, it goes and a note points them to
their keyboard's mic.

**Privacy notice:** worth a line in the site's privacy notice, for whoever looks after it: on the ALL IN pages, guests can talk
instead of typing in the trip finder; their browser's speech service turns it into text; the site receives only the words,
kept in their browser for that visit, and they reach Mad Monkey only if the guest sends a trip or a question.

## Before it goes live

- **Prices.** Every trip has its set price per person, flights not included (Ewan, 18 Nov 2026): Cambodia $749, Vietnam
  $849, Indonesia $849, Thailand $899, Laos $499, the Island Hopper $800, Tết $699,
  Nyepi $649, Songkran & Pi Mai $749, Lai Heua Fai $499, Yi Peng $599, Bon Om Touk $649 and The Big One $4,999. Today's
  trips keep their live prices. Instant booking stays off until each trip is loaded into the booking system; then this
  pack is rebuilt with it on.
- **Footage.** Four stock films are still in use (Cambodia's waterfall, the Philippines' surf, Tết's lion dance, the sunset in
  the story). Real footage can replace them before or after launch.

## What the page uses from elsewhere

- Fonts from Google Fonts (`fonts.googleapis.com`, `fonts.gstatic.com`).
- Photos: Mad Monkey's own through `wsrv.nl` (resizing), and a few place photos from Unsplash.
- The four stock films on phones, and as a fallback, from Mixkit (`assets.mixkit.co`).
- The backend at `bilhhkzcmicygufsdfxi.supabase.co`.
- Links out: WhatsApp share, the ALL IN business WhatsApp (`wa.me/66966894646`), and the six governments' visa sites.

## Checked, and not

Checked in a test browser with madmonkeyhostels.com answered from this pack (nothing reached the real site), on a phone and a
laptop: the site opens at `/all-in-trips/` with no preview bar or notes; each of the 13 trip addresses opens its trip with its
own canonical address; Ewan's clip and the stock films come from `/all-in-trips/v/` (1080p on a laptop, 720p on a phone), and
nothing comes from the GitHub preview; the builder links go to `/all-in-trips/trip-builder/`; the mic works; no page errors.
19 Nov, the same way: today's seven trip addresses open today's trips, the old Stripe and Admin links on `/cambodia` and
`/laos` open today's trip, the home page's cards open them in the same tab, nothing called the backend without the key, no
page errors. Booking itself was checked by the Luxury ALL IN chat against a stand-in backend (104 checks), never the real
one. Everything else is the private preview's page, checked there. Not checked: a real booking with the key in (one on
staging, please, in Stripe's test mode), the real madmonkeyhostels.com, its headers and tags,
and a real voice on real phones.
