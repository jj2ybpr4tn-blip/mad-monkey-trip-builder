# Find your crew

A guest who's travelling solo, or keen for company, can ask to be introduced to other travellers on a similar route at the same time. A real person on the crew makes every introduction, and only once both travellers have said yes. Nothing is automatic and nothing is shared without that yes.

This first version is **run by people**: the builder collects who opted in and what they asked for, the crew console shows who matches, and the crew does the asking and introducing on WhatsApp or email.

## What the guest sees

On the send form ("Hold my beds + get it checked") there is a **Find your crew** box, unticked. Ticking it opens a few quick questions:

| Question | Options | Notes |
| --- | --- | --- |
| Your age | 18–21, 22–25, 26–29, 30–35, 36+ | Required. There is no option under 18. |
| You are | Prefer not to say (the default), a woman, a man, non-binary | |
| Where you're from | free text, 40 characters | |
| Who you'd like to meet | Anyone, Women only | "Women only" is only offered to women. |
| Their age | Around my age (the same bracket or the next one either side), Any age (18+) | |
| Only people travelling solo | tick | Leaves out anyone travelling with others. |
| Where you're at (up to 3) | Gap year, Between uni years, Just graduated, Career break, Quit my job, Sabbatical, Working remotely | |
| Your vibe (up to 3) | the quiz's vibes; their quiz answers are ticked already | |
| One line about you | free text, 140 characters | The people they're introduced to see it. |
| I'm 18 or over, and the crew can share my first name, age, where I'm from, this line and where our trips cross, only after we've both said yes | tick | Required. |

The wording says "travelling solo", never "single": this is about company on the road, not a dating app.

After sending, the confirmation and the trip page say **Find your crew is on**, and that a person will message them first. To stop, they ask (the Ask Ewan button), and the crew switches it off.

## What the crew sees

A **Find your crew** tab in the crew console (`/admin`):

- **Matches**: every pair of opted-in travellers who fit what *each other* asked for, best first:
  - **together**: the same town on the same nights (scored by nights shared, then vibes and life stage in common);
  - **near miss**: the same town a day to three apart;
  - **same stops, no dates yet**: two or more of the same stops, when one of them hasn't picked dates.

  For each pair: where and when they cross, what they have in common, both profiles, and buttons that open each traveller's chosen channel (WhatsApp or email) with the **ask-first message** already written, plus **Copy the intro** for a WhatsApp group once both have said yes. The crew records where each introduction is: *Not asked yet, Asked them both, Both said yes, Introduced, Not now*. Each change is logged in both trips' history.
- **Hot spots**: towns and nights where two or more opted-in travellers stack up, whatever they asked for. Good nights for a meet-up at the hostel bar.
- **Everyone who opted in**, with **Switch off** for anyone who asks to stop. They drop out of every match.

Type your name in the "I'm…" box first: it signs the messages.

Trips that have finished drop off the board. The same person never matches themselves (a later stage of their own trip, the same email or number).

## How a match is worked out

`MM.crewPairs` and `MM.crewSpots` in `logic.js`. They use the same night-by-night overlap as group mode's meet-ups (`MM.overlap`), worked out once per trip. Two travellers match when both directions hold:

- if A asked for women only, B is a woman;
- if A asked for "around my age", B's bracket is A's or the next one either side;
- if A asked for solo travellers only, B is travelling alone;

and their trips cross (together, near miss, or same stops without dates).

`MM.cleanCrew` is the only way answers get in, on the guest's side and again on the server: only known values survive, picks are capped at three, the free text is plain single-line text, it needs the 18+ and consent ticks, and "women only" from anyone who isn't a woman becomes "anyone".

## Data and privacy

- It is **off unless they tick it**, with its own consent, separate from the trip's.
- What we keep: the answers above, with the trip. Nothing about relationships, sexuality, religion or health is asked.
- Nothing is shown to another guest by the builder. The crew shares only what the consent box lists, and only after both have said yes.
- Retention: decide it with the rest of the guest data (see SERVER.md). The board ignores finished trips; delete them on your usual schedule.
- Update the privacy notice (`PRIVACY_URL`) to mention introductions before switching it on for real guests.

## Payload

The send form adds `findCrew` to the [lead payload](LEADS.md) when it's ticked (absent when it isn't):

```jsonc
"findCrew": {
  "on": true, "consent": true, "adult": true,
  "age": "22-25",                              // 18-21 | 22-25 | 26-29 | 30-35 | 36+
  "gender": "woman",                           // woman | man | nonbinary | "" (prefer not to say)
  "home": "UK",                                // up to 40 characters, plain text
  "life": ["gap-year", "quit-job"],            // up to 3 of: gap-year, uni-break, graduated, career-break, quit-job, sabbatical, remote
  "vibes": ["party", "islands"],               // up to 3 of the quiz vibes (MM.VIBES)
  "about": "Just quit finance. Here for sunsets.", // up to 140 characters, plain text, shown to matches
  "want": { "who": "women", "ages": "near", "solo": false }   // who: anyone | women · ages: near | any
}
```

The trip status endpoint can answer `"findCrew": true` so the trip page shows the line even on another device.

## Switching it on

- **The bundled crew server** (`npm run server`) keeps it and switches it on by itself (it sets `FIND_CREW: true` in the `config.js` it serves). Admin API: `GET /api/admin/crew` (travellers, pairs, hot spots, labels), `PATCH /api/admin/crew/intro` `{ a, b, status, by }`, and `PATCH /api/admin/leads/<ref>` `{ findCrewOff: true }`.
- **Another backend** (the ALL IN site): leave `FIND_CREW: false` until it stores `findCrew` with the trip (run it through the same rules as `MM.cleanCrew`) and answers the calls below. Until then the form doesn't offer it, so nobody ticks a box that goes nowhere. The screens are the builder's own, so they arrive with a sync and the backend builds none of them:
  - **The crew review page** (`#/crew/<ref>`) shows a **Find your crew: on** box with their answers and a **See their matches** button, when `trip-builder-admin` `view` returns the request with `find_crew`.
  - **The board** (`#/crewfind`, or `#/crewfind/<ref>` for one traveller's matches) is the console's tab for a backend without the console. It asks for the admin password (kept for that browser tab only), works the matches out in the browser with `MM.crewBoard` (the same function the bundled server uses), and calls `trip-builder-admin` (`CREW_ENDPOINT`) with the password in the body:

    | Action | Sends | Answers |
    | --- | --- | --- |
    | `crew-list` | `{ password }` | `{ ok, travellers: [{ ref, name, party_size, contact_via, email, whatsapp, route, start_date, days, trip_link, find_crew }], intros: [{ a, b, status, by, at }] }` for everyone opted in whose trip isn't declined or over. 401 for a wrong password. |
    | `crew-intro` | `{ password, a, b, status, by }`, status one of `new`, `asked`, `yes`, `introduced`, `no` | `{ ok }`. One status per pair (the two refs in either order). |
    | `crew-off` | `{ password, ref }` | `{ ok }`. Their `find_crew` is switched off, so they drop out of every match. |

    The board cleans every traveller again with `MM.cleanCrew` and drops finished trips itself, so a backend that sends a little too much can't show anything it shouldn't.
  - **`trip-builder-status`** answers `findCrew: true` for a trip that has it on, so the trip page says so on any device.
- **Demo mode** (no `LEAD_ENDPOINT`) always offers it, so it can be tried. Nothing is sent.

## Try it

```bash
npm run server                          # http://localhost:8000, crew console at /admin
node scripts/seed-crew-demo.mjs         # 9 sample travellers (Philippines, Vietnam, Thailand), all marked "sample"
```

Then build a trip through Siquijor and Panglao starting in about 100 days, send it with Find your crew ticked, and open the console's **Find your crew** tab. The samples use @example.com emails and UK drama-range numbers (+44 7700 900xxx), so the message buttons never reach a real person.

## Tests

`test/logic.test.js` (cleaning, the matching rules, hot spots, the board), `test/server.test.js` (stored cleaned, the board, introductions, switching off) and, in a browser on the builder, `test/ui-crewfind.js` (the send form: `await import('/test/ui-crewfind.js?' + Date.now()); await __findcrew()`) and `test/ui-crewboard.js` (the review page box and the `#/crewfind` board against a stubbed `trip-builder-admin`: `await __crewboard()`).

## Next steps

1. **The ALL IN backend** (Charlie): store `findCrew` on the trip request, put it in the crew email, and answer `view` / `crew-list` / `crew-intro` / `crew-off` above. The review page box and the board are built (Nov 2026). Then the privacy notice, and `FIND_CREW: true` on the live site.
2. **Counts on the plan**: "+5 travellers here the same nights" on each stop, from the same matching, without names. Social proof that sells trips.
3. **Crews from matches**: three or more who all fit each other become a crew, with the Squad Leader perks.
4. **Meet-ups**: a Find your crew night at each hostel on its hot-spot nights.
