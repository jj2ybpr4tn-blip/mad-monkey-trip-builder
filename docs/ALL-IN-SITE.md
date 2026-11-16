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
| `away` | Nights on the trip the builder can't see (a night boat or bus, a partner hotel) | Clamped to 9 |
| `ref` | Ambassador or campaign code, as before | Unchanged |
| `#/build/…` | The trip itself, in the builder's usual share-link format | Unchanged |

The site opens it in the same tab, and so does **Trip builder** in its menus (`<site>/trip-builder/?via=allin#/build`, a blank map).
A trip sent to the crew from the site always carries the live builder's address, whichever copy it was sent from: the backend only
keeps links to madmonkeyhostels.com.

The builder **never takes a price from the link**. It shows its own estimate, says so, and the crew prices the trip before
anyone pays.

## What the builder does with it (ui-allin.js)

- A bar at the top of the trip, in the ALL IN site's colours, names the trip and says which stops are the ALL IN trip, what the
  guest added either side, anything they changed inside it, and the nights it can't show. Those stops carry an **ALL IN** tag.
- The "this looks a lot like ALL IN Cambodia, swap it in" card stays away while the trip is there: it would push a different trip on
  someone who has just picked one.
- **Back to the trip** goes to `<ALLIN_SITE>#trip-<id>` in the same tab, which opens that trip's page on the site.
- The lead carries `allinSite: { site, trip, name, stops: [first, last], intact, changed, before, after, away }`, and the crew's text
  (what the "Trip to check" email shows) gets a **FROM THE ALL IN SITE** section saying the same in words. No backend change needed.
- What was marked on arrival is kept for the session, so a reload doesn't lose it. **Start over** forgets the trip (they're still a
  guest from the site); **Forget my trip and details** forgets everything.

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

## Publishing the preview: one command for both

```
npm run publish-preview                 # after pushing main; add -- --dry-run to build it into .site/ and push nothing
```

`scripts/publish-preview.sh` (`npm run deploy-demo` runs it too) builds the builder from the last commit into `shop/trip-builder/`
with `ALLIN_SITE '../'`, puts the redirect where the builder used to be, carries over everything else in `shop/` (the videos in
`shop/v/`), and adds one commit on top of `gh-pages` without force-pushing. The shop: on the Mac that holds `drafts/all-in-store`, it's
rebuilt from its source with this same builder inside it and locked with the key its link uses (never a new key); anywhere else it's
kept exactly as it is. So publishing the builder can never wipe the shop, and the other way round.

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
