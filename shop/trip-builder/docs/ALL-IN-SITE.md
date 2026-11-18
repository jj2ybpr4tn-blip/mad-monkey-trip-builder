# The ALL IN site and the trip builder

The new ALL IN site (the rebrand) runs its prices and "Make it yours" on this builder's own code, and the builder lives
**inside** it: one site, not two linked ones. When a guest wants more than the site's editor gives them, **Carry on in the trip
builder** hands the trip over, in the same tab, and **Back to the trip** brings them back. This page is the contract between the two.

## Where the builder lives

| | The ALL IN site | The trip builder | `ALLIN_SITE` |
|---|---|---|---|
| At launch | `madmonkeyhostels.com/all-in-trips/` | `madmonkeyhostels.com/all-in-trips/trip-builder/` | `'../'` |
| The private preview (GitHub Pages) | `<repo>/shop/` (locked: it opens only with the key link) | `<repo>/shop/trip-builder/` | `'../'` |
| `main`, and the live copy until launch | | wherever it's served | `''` (nothing below happens) |

The builder's old preview address (the top of the GitHub Pages site, and any old page under it) sends people on to
`shop/trip-builder/`, keeping the rest of the link, so old links still work.

## The link the site sends

```
<site>/trip-builder/?via=allin&trip=cambodia&tn=Temples%20%26%20Beaches&part=1.5&away=1&ref=exeter#/build/<trip>
```

| Part | What it is | Checked how (`MM.allinFrom`, extras.js) |
|---|---|---|
| `via=allin` | The guest came from the ALL IN site | Must be exactly `allin`, or nothing below is read |
| `trip` | The trip's id on the site | Lowercase letters, digits and dashes, 40 at most. A bad id drops the trip, its name and its stops |
| `tn` | The trip's name, shown on the builder | Letters (accents included), spaces and `& ' ’ , : ( ) + -` only, 60 at most. No digits or dots, so a link can't put a price or a web address on our page |
| `part` | Which stops are the ALL IN trip: first stop (from 0) `.` how many | Clamped to 40. Stops either side are days the guest added |
| `away` | Nights on the trip away from a Mad Monkey (a night boat or bus, a partner hotel) | Clamped to 9. The builder counts them as days, after the ALL IN part's last stop, at no price: the crew prices them |
| `ref` | Ambassador or campaign code, as before | Unchanged |
| `#/build/…` | The trip itself, in the builder's usual share-link format | Unchanged |

The site opens it in the same tab, and so does **Trip builder** in its menus (`<site>/trip-builder/?via=allin#/build`, a blank map).
A trip sent to the crew from the site always carries the live builder's address, whichever copy it was sent from: the backend only
keeps links to madmonkeyhostels.com.

The builder **never takes a price from the link**. It shows its own estimate, except where the site has an approved price for its
trip (below), and the crew prices the trip before anyone pays.

## What the builder does with it (ui-allin.js)

- A bar at the top of the trip, in the ALL IN site's colours, names the trip and says which stops are the ALL IN trip, what the
  guest added either side and anything they changed inside it. Those stops carry an **ALL IN** tag.
- The trip is as long as the site says: its `away` nights go in as days of their own ("Away on your ALL IN trip") straight after the
  ALL IN part's last stop, so the day count, the end date and every date after it match the site. The link doesn't say where inside
  the trip they really fall, so dates inside the ALL IN part can be a night or two early; the crew's text says so. They cost nothing
  in the builder (the crew prices them), and no beds are held for them. Once the guest changes the ALL IN part's stops, it's their
  own route and the crew is simply told about the nights.
- The "this looks a lot like ALL IN Cambodia, swap it in" card stays away while the trip is there: it would push a different trip on
  someone who has just picked one.
- **Back to the trip** goes to `<ALLIN_SITE>#trip-<id>` in the same tab, which opens that trip's page on the site.
- The lead carries `allinSite: { site, trip, name, stops: [first, last], intact, changed, before, after, away }`, and the crew's text
  (what the "Trip to check" email shows) gets a **FROM THE ALL IN SITE** section saying the same in words. No backend change needed.
- What was marked on arrival is kept for the session, so a reload doesn't lose it. **Start over** forgets the trip (they're still a
  guest from the site); **Forget my trip and details** forgets everything.

## The site's approved prices

Where the site sells a trip at a fixed, approved price, that's the price the guest saw, so the builder uses it instead of its own
figures while the guest keeps the trip as it is. The site leaves its approved prices in the browser on the same origin, each time its
page opens: `localStorage['allin-site-prices'] = { v: 1, at: <ms>, trips: { <id>: { usd: <per person> } } }`. With an unchanged trip
(`part` found and intact), those stops are priced at it in the **ALL IN trips** line, in place of the builder's beds, tours and the
journeys between them; whatever the guest adds around it is estimated as usual, and food and fun money is on top, as everywhere. Change
anything inside the trip and it goes back to the builder's estimate, and the crew is told to price it. The lead carries
`allinSite.approvedUsd` and the builder's own figure for those days (`approvedEst`). A price is only read for the trip in the link, only
between $50 and $20,000 a person, and nothing older than 30 days (`MM.sitePrice`). Never from the link itself.

## The site's bar and menu on the builder (ui-site.js)

With `ALLIN_SITE` set and the ALL IN look on, the builder wears the site's own bar instead of its header: the **ALL IN** wordmark,
the site's sections, **Trip builder** marked as the page you're on, **Enquire**, **Book a trip** and, on smaller screens, **Menu**,
which opens the site's full-screen menu. The builder's own pages (Ideas, Your trip, Quiz) and the currency picker sit in a slim row
under it. `<html data-site="allin">` turns it on: the preview build and the live copy's sync put it there up front, so the page never
flashes the builder's own header, and ui-site.js keeps it in step with the config either way.

The builder's files are public, so the site's menu (which can name trips that aren't public yet) is never written into them. The
builder reads it from the site, in this order:

1. **What the site left in this browser:** `localStorage['allin-site-menu']`, on the same origin, written by the site's page each time
   it opens: `{ v: 1, at: <ms>, bar: [[label, href, toBuilder], …], menu: [[label, href, toBuilder], …] }`. `bar` is the sticky bar's
   links, `menu` the full menu's; `toBuilder` is `1` for a link to the builder. This is how the locked preview does it: its page only
   exists once it's unlocked, so only a browser that has opened it with the key ever sees the full menu.
2. **The site page itself** (at launch, when it's public): the builder fetches `<ALLIN_SITE>` and reads the links in
   `<nav data-site-menu="bar">` and `<nav data-site-menu="menu">`, then keeps them as in 1.
3. Otherwise the short public menu in index.html: Trips, Dates and prices, Trip builder, Questions.

Every label is set as plain text and every address is checked (`MM.siteMenu`, extras.js): at most 16 links a list, labels cut to 40
characters, only addresses on the site's own origin (a `#section` of the site page or a page on it), nothing older than 30 days.

The bar's links go to `<ALLIN_SITE>#<section>`, and Enquire to `<ALLIN_SITE>#enquire`. The site opens on that section, or with its
enquiry form open; the preview's locked page keeps `#trip-<id>`, `#<section>` and `#enquire` while it unlocks.

## The front door (ui-start.js, start.css)

Where the builder starts since 18 Nov 2026 (Ewan picked the "Trip builder try-out"): you build a trip from nothing, one stop at a time.

- **Screens.** `#/start` where you land (six gateways, any other place, or start with an ALL IN trip; "Carry on with your trip" when
  one is saved on the device), `#/start/how-long` (six answers, or "Not sure yet"), `#/start/next` (the map with the route drawing
  itself, three different next stops with photos, the ALL IN trip that fits as a fourth, Surprise me, More places, the nights stepper
  and Don't miss in each stop's sheet, the price and what's in it), `#/start/trip` (the whole route on the moving map, looping, the day
  by day, the vibe, who's coming, Hold my beds, Copy my trip). The map is the try-out's, unchanged.
- **Where you land.** A visit with no address, and `#/build` with no trip open, go to `#/start`. A trip in the address
  (`#/build/i=...`: a shared link, "Make it yours" from an ALL IN trip) opens the full editor with it, as before, and so does
  `#/build` once a trip is open. `#/build/i=` is the empty editor. Inside the ALL IN site only the site's bar sits above it.
- **One trip.** The front door works on the builder's own trip (`MMApp.state`, saved as `mm-trip`), so "Open the full editor"
  (on the start screen, under the next stops and on the trip page) opens the same trip with every detail. A few extras live in
  `mm-start`: how long they've got, who's coming, the screen they were on.
- **Days.** Counted the way every Mad Monkey trip is (14 days is 13 nights): 3 nights in Bangkok takes you to day 4, when you move
  on, and a night on a sleeper bus, train or boat is a day too. The bar ("Day 4 of 14"), the trip page and its day by day agree: the
  day by day takes each stop's days from the engine's own (`pl.days`, with multi-day tours and the free night before an ALL IN trip)
  and ends on the day the trip finishes. With a date picked, the finish date shows too: in the bar ("Day 4 of 14 · Sat 6 Mar"), under
  the trip page's name ("Sun 27 Dec 2026 to Thu 14 Jan 2027"), at the end of the day by day, in Hold my beds and in Copy my trip.
- **Hold my beds, it's free** sends the same request as the editor's form (`MMApp.review.send`, LEAD_ENDPOINT: trip-builder-request
  on the ALL IN backend): first name, email, WhatsApp if they like, the tick, and with it who's coming (partySize, and "Travelling
  solo: happy to be introduced..." when they ticked Find me a crew), the dates (`contact.dates` fixed or open, `trip.start`, and
  the beds held when there's a date), `freeNight` and what they told the site's "Not sure which one?" (sessionStorage `allin-told`:
  shown first, with Leave it off; it goes in `told`, the crew's text and the notes).
- **The free night.** Every ALL IN trip comes with a free bed the night before it starts, at the Mad Monkey where it starts, subject
  to availability. Whenever a trip has an ALL IN trip in it (first or later on), Hold my beds asks first, on its own: "Your first
  night is on us", yes or no. The answer goes as `freeNight` (the same field as the ALL IN site's checkout) and the first line of the
  crew's notes; mid-trip, the notes say so. The full editor's Hold form asks the same (a required yes or no at the top), and sends
  the finder's words too, with Leave it off. The shared pieces are in ui-review.js (`MMApp.review.freeNight`, `MMApp.review.told`).
- **Copy my trip** copies a line about the trip and the share link (`#/build/...`, the same link as the editor's Share).
- **Its look** is the ALL IN look, in `start.css` inside a shadow root: the editor's styles and its own never touch.
- **Tests.** `await import('/test/ui-start.js?' + Date.now()); await __startcheck()` in a browser tab (27 checks, about 30 seconds).

## The moving map (route-film.js)

The route draws itself, like a travel film's map: a line runs from stop to stop with the right vehicle on it (bus, boat, scooter or
plane; train, van and car too), each place's dot pops in and its name fades up as the line arrives. One file, no dependencies, the
same piece on the builder's map and the site's maps: `MMRouteFilm(map, stops, options)`.

```html
<script src="trip-builder/route-film.js"></script>   <!-- or inline it with the builder's other files -->
```

```js
var film = MMRouteFilm(tripMapSvg, [
  { place: 'hanoi', by: 'bus' },                                   // `by`: how you get from this stop to the next
  { place: 'ha-giang', x: 265, y: 61, name: 'Ha Giang', by: 'scooter' },  // a place the builder doesn't know: its spot and name
  { place: 'hoi-an' }                                              // the last stop needs no `by`
], { loop: true });                                                // the site's trip maps: replay it while it's on screen
```

- **Stops.** `place` is a builder place id (data/places.js, when that's loaded): the film takes its spot and name from there, in the
  builder's map projection (`MM.MAP`), which the site's maps already use. For any other place give `x, y` in the map's own units and a
  `name`, or pass `project: function (place) { return [x, y]; }` and `name: function (place) { … }`. `by` is read loosely: plane,
  flight, fly · bus, coach · boat, ferry, speedboat, junk · scooter, motorbike, easy rider · train · van, minivan · taxi, car, transfer,
  tuk-tuk. Anything else is a bus.
- **Timing.** Each leg takes 1 to 2 seconds by its length on screen, with a short pause (0.45 s) at each stop, and the whole film is
  kept to about 24 seconds however long the trip (`speed`, `pause`, `maxTotal` change that).
- **When it plays.** `autoplay: 'view'` (the default): the first time a third of the map is on screen; until then only the first
  stop shows. `true`: straight away. `false`: when you call `film.play()`.
- **Loop** (off unless asked). `loop: true`: when the route has drawn, it holds the finished route for `hold` ms (5000; anything from
  4000 to 6000 suits), fades it and draws it again, only while the map is on screen. Off screen it waits; back on screen after the
  hold, it plays at once. Skip stops the loop until Replay. The builder never loops: it plays once when a trip opens, on Replay, and
  only the new leg when someone adds a stop.
- **Replay and Skip** sit in the map's bottom-right corner (the map's parent is made `position: relative` if it isn't). Skip shows the
  finished route at once. `controls: false` hides them: call `film.replay()` and `film.skip()` from your own buttons.
- **Reduced motion** (the device's setting): the finished route at once. No film, no loop, no buttons.
- **Our own style only**: no footage, fonts or sound. Colours come from CSS variables on the map or any parent: `--rf-line` (the route,
  amber `#FFB238`), `--rf-case` (its outline, `#0E2B26`), `--rf-dot`, `--rf-name`, `--rf-halo` (the outline round names),
  `--rf-veh-bg`, `--rf-veh`, `--rf-veh-ring`. Names use the page's font. Its own rules have no weight (`:where()`), so any rule of yours
  on `.rf-line`, `.rf-case`, `.rf-dot`, `.rf-name`, `.rf-veh` or `.rf-btn` wins.
- **Let the film draw the route.** Leave the map's own route line and stop dots out: the film draws the line, the dots and the names,
  and keeps them when it ends. (A map that draws its own route, like the builder's, uses `keep: false` and the `onHide`, `onLeg`,
  `onArrive` and `onEnd` callbacks to show its own pieces as the film reaches them.)
- It adds one small `<style id="rf-style">`. If the page's Content-Security-Policy blocks inline styles, put `MMRouteFilm.CSS` in your
  stylesheet and give that `<link>` or `<style>` the id `rf-style`, and the film won't add its own.

It returns `{ play(), replay(), skip(), set(stops, how), destroy(), playing, looping }`. `set(stops)` is for a trip that changed: only
what's new draws (`'all'` plays the lot, `'none'` just shows it). Call `destroy()` before throwing the map away.

Tests: `node test/route-film.test.js` (in `npm test`: vehicles, timing, which legs draw) and, in a tab on the builder,
`await import('/test/ui-film.js?' + Date.now()); await __film()` (plays, loops only on screen, Skip, Replay, reduced motion).

## Publishing the preview: one command for both

```
npm run publish-preview                 # after pushing main; add -- --dry-run to build it into .site/ and push nothing
```

`scripts/publish-preview.sh` (`npm run deploy-demo` runs it too) builds the builder from the last commit into `shop/trip-builder/`
with `ALLIN_SITE '../'`, puts the redirect where the builder used to be, carries over everything else in `shop/` (the videos in
`shop/v/`), and adds one commit on top of `gh-pages` without force-pushing. The shop: on the Mac that holds `drafts/all-in-store`, it's
rebuilt from its source with this same builder inside it and locked with the key its link uses (never a new key); anywhere else it's
kept exactly as it is. So publishing the builder can never wipe the shop, and the other way round.

The preview's builder talks to the same crew backend as the site and the live builder (LEAD_ENDPOINT and STATUS_ENDPOINT on the ALL IN
backend), the way it will at launch: a trip sent from it, and every Ask question, lands in Admin. `PREVIEW_BACKEND=none npm run
publish-preview` keeps it a demo that sends nothing.

## Ask Ewan: one button, a short form, the crew backend (ui-ask.js, extras.js)

Every page of the site and the builder has ONE Ask button: in the bar on a laptop, and on a phone in the bar along the bottom of the
screen, as on the site (while building, next to **Hold my beds**; elsewhere next to **Your trip** once there is one; inside a trip page,
the checkout or a form that covers the page, the button there). Nothing floats over other buttons. It opens a short form: a name, an email or a WhatsApp number in one box
(`MM.askContact` reads which), and the question. It goes to the crew backend the way a trip does (`MM.askPayload`; the builder posts to
`ASK_ENDPOINT`, or `LEAD_ENDPOINT` when that's blank, and the site to the same backend), so it lands in Admin and the crew is emailed.
Nothing opens the guest's own email app or WhatsApp, and no personal number or address is in either.

- With a trip on screen (the trip they're building, a trip page on the site, a trip they sent), the trip goes along. The guest can leave
  it off with one tap.
- The payload is a trip request with `type: 'question'` and `question: {text, page, trip}`. The backend saves a request only with a route
  and at least a day, so a question with no trip carries a stand-in route (`Question, no trip yet`, 1 day) and a question about a trip has
  `Question: ` in front of its route: Admin and the crew's email tell questions and trips apart. A question never carries a start date,
  so it holds no beds, and a trip's link gets `q=<time>` on the end, so the same trip sent for checking a minute later isn't taken for a
  duplicate.
- The name on the button is `ASK_NAME` in the builder's config ("Ewan" makes "Ask Ewan") and `ASK_NAME` at the top of the site's
  `shop.js`: change both when the team grows.
- `WHATSAPP` and `CREW_EMAIL` in config.js are no longer used anywhere: leave them blank.

## Switching it on at launch

The live copy (`CFSiteDesign/mm-squad-trips`, `public/trip-builder/`) needs two lines in its own `config.js`, then a sync:

```js
  ALLIN_SITE: '../',
  LOOK: 'allin',
```

```
node scripts/sync-allin.mjs /path/to/mm-squad-trips     # then commit and deploy that repo
```

The sync ships ui-site.js and, once that config is in place, marks the page as inside the site (`data-site="allin"`) and keeps the ALL
IN look on it. The new site's page should carry `data-site-menu="bar"` and `data-site-menu="menu"` on its two navs, as the preview does.

## The look

The builder wears the ALL IN site's look by default (`look-allin.css`, `LOOK: 'allin'` in `config.js`), so a guest moving between
the two doesn't feel they've changed sites. A guest handed over with `?via=allin` always gets it. The live copy inside today's ALL IN
site keeps the core Mad Monkey look until its config says `LOOK: 'allin'`: `scripts/sync-allin.mjs` adds `LOOK: 'core'` there and
leaves its page on the core look until then.
