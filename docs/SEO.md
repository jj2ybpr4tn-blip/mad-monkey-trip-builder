# Pages for Google

The builder is one page with `#/hash` routes, which search engines can't index. `scripts/build-pages.mjs` writes about 100 plain HTML pages from the same data so people searching "Hanoi to Hoi An", "Vietnam itinerary" or "backpacking Cambodia" can land on the site. Every page has a **Build this trip** button that opens the builder.

| Folder | What | How many |
|---|---|---|
| `trips/` | Ready-made routes: classics, ALL IN trips, the eight themed trips, a country itinerary each | 34 |
| `routes/` | A to B: every option with time, price, arrival, where to stay at both ends, FAQ | 37 |
| `hostels/` | One page per hostel: price, things to do, best months, local knowledge, FAQ | 23 |
| `guides/` | Backpacking Vietnam, Thailand, Laos, Cambodia, Indonesia, Philippines: visas, money, safety, festivals | 6 |

Each page has a unique title and description, a canonical link, breadcrumbs and structured data (breadcrumbs, FAQ, trip and hostel).

## Build them

```bash
SITE_URL=https://trips.madmonkeyhostels.com npm run build-pages
SITE_URL=https://you.github.io/repo BASE_PATH=/repo npm run build-pages    # if hosted under a sub-folder
```

`SITE_URL` adds canonical links, the sitemap, `robots.txt` and preview images. Without it the pages still work. **Rebuild before every deploy and at least monthly**, because the festival dates and "built" date are stamped in. The page `sitemap.xml` then goes in Google Search Console.

Run `npm test` after changing data. It builds every page into a temp folder and checks titles, descriptions, links, structured data and the sitemap.

## Preview image for the plain homepage link

`npm run og-home` renders `scripts/og-home.html` to `assets/og/home.jpg` with headless Chrome. The crew server puts the absolute preview address into the homepage automatically (set `PUBLIC_URL` if it sits behind a proxy). On other hosting, `build-pages` with `SITE_URL` does it.

## Things to know

- The homepage lists the guides and trips in a plain footer, so search engines can follow them without running JavaScript.
- Pages are built from data, so a wrong price or a missing hostel photo shows up everywhere. Fix the data, rebuild.
- Do not hand-edit the generated folders. Each has a `.generated` marker. Delete and rebuild any time.
