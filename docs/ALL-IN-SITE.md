# The ALL IN site and the trip builder

The new ALL IN site (the rebrand) runs its prices and "Make it yours" on this builder's
own code. When a guest wants more than the site's editor gives them, **Carry on in the trip builder** hands the trip over here.
This page is the contract between the two.

## The link the site sends

```
<builder>/?via=allin&trip=cambodia&tn=Temples%20%26%20Beaches&part=1.5&away=1&ref=exeter#/build/<trip>
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

The builder **never takes a price from the link**. It shows its own estimate, says so, and the crew prices the trip before
anyone pays.

## What the builder does with it (ui-allin.js)

- A bar at the top of the trip, in the ALL IN site's colours, names the trip and says which stops are the ALL IN trip, what the
  guest added either side, anything they changed inside it, and the nights it can't show. Those stops carry an **ALL IN** tag.
- The "this looks a lot like ALL IN Cambodia, swap it in" card stays away while the trip is there: it would push a different trip on
  someone who has just picked one.
- **Back to the trip** goes to `<ALLIN_SITE>#trip-<id>`, which opens that trip's page on the site. With `ALLIN_SITE` blank (today)
  there's no back link and the ALL IN nav button goes to `ALLIN_BASE` as before.
- The lead carries `allinSite: { site, trip, name, stops: [first, last], intact, changed, before, after, away }`, and the crew's text
  (what the "Trip to check" email shows) gets a **FROM THE ALL IN SITE** section saying the same in words. No backend change needed.
- What was marked on arrival is kept for the session, so a reload doesn't lose it. **Start over** forgets the trip (they're still a
  guest from the site); **Forget my trip and details** forgets everything.

## Switching it on

Set `ALLIN_SITE` in `config.js` when the new site is live: its full https address, or `'../'` if the builder sits inside it (the
way the live copy sits at `/all-in-trips/trip-builder/`). `scripts/sync-allin.mjs` adds the key to the live copy's config, blank.

The private preview of the site (`drafts/all-in-store`, GitHub Pages `/shop/`) links to the demo builder beside it, so the whole
round trip can be tried there before anything goes live.

## The look

The builder wears the ALL IN site's look by default (`look-allin.css`, `LOOK: 'allin'` in `config.js`), so a guest moving between
the two doesn't feel they've changed sites. A guest handed over with `?via=allin` always gets it. The live copy inside today's ALL IN
site keeps the core Mad Monkey look until its config says `LOOK: 'allin'`: `scripts/sync-allin.mjs` adds `LOOK: 'core'` there and
leaves its page on the core look until then.
