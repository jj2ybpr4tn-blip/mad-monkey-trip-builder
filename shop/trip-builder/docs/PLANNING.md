# Planning made easy: search, best order, stages, and a person to ask

Four things that make the builder easier to use than a generic trip planner, and why a Mad Monkey trip planner should be.

## 1. Type where you're going

The home page opens with one question, **"Where to?"**, and one box. The builder has the same box ("Add a place or a tour"), and so does a blank sheet. It finds, as you type:

| It finds | Example | Picking it, on the home page | Picking it, inside a trip |
|---|---|---|---|
| a hostel | `hanoi`, `ho chi minh`, `bali`, `angkor`, `el nido`, `hoian` | starts a trip with it | adds it in the place on the journey where it adds the least travel (or says it's already in) |
| a country | `viet`, `thai`, `phil` | a first draft for the country (the same planner as "Plan it for me": more than one town where the country has them), ready to change | opens the "Add a stop" list, already searching that country |
| something to do | `kayak`, `cooking`, `loop`, `tubing`, `dive` | starts a trip at that place with that tour | adds the tour to its stop; if the place isn't in the trip yet, adds the place too |
| an ALL IN trip | `all in vietnam`, `loop` | starts a trip with it | adds it to the end |
| a classic route or a vibe | `lombok surf`, `party` | opens it, ready to change (your last trip stays under "Pick up where you left off") | the same |

A small typo is forgiven (`hanoy`, `banghok`, `siemreap`). Nothing found says so and suggests what to try; one letter shows nothing; two letters only ever find a place or a country.

- **Data layer:** `search.js` (`MM.search`, `MM.searchHints`), pure and tested (`test/search.test.js`: every hostel, tour, ALL IN trip and route can be found by its own name). Nicknames for places live in `data/places.js` (`MM.PLACE_TERMS`), which the editor (`edit.js`) uses too.
- **The box:** `ui-search.js`, a proper combobox (arrow keys, Enter, Escape; a screen reader hears how many results there are). What a pick does is `searchPick` in `app.js`.
- A blank sheet no longer shows the date, travel style, spending and budget sliders. They appear once there is something to plan.

**Best order** (a button above the itinerary once there are three stops): puts the stops in the order that costs the least travel, keeping where you land first. Exact up to 12 stops, a nearest-stop pass beyond that. It says what it saved ("about 22 h and $141") and Undo takes it back. (`MM.edit.bestOrder`, tested.)

**The quiz** no longer has to be finished: from the second question on, a link under the buttons says **Skip the rest and show my routes**. It uses what was answered and the usual defaults (14 days, any month, comfortable, a mate or two), and the results page still has **Edit answers**. (`finishQuiz` in `app.js`; `test/logic.test.js` plans a profile with nothing but a landing point.)

## 2. Plan in stages: carry on where you left off

Plan Vietnam now, decide the rest once you're there.

1. After sending a trip, the trip page offers **Plan my next stage** (any trip that's with the crew, being checked, ready or booked). The home page lists the trips sent from this device with the same button.
2. A short form asks *where are you now* (it guesses the last stop), *when do you leave* and *anywhere else you've been*. It starts a new trip with those.
3. The builder carries on from there: a **Stage 2 of your journey** bar says where you are and where you've been; the map shows those places dimmed with a tick; the journey from where you are to the first stop is the first leg (with its own travel-style choice); **Where next?** lists good next steps; and nothing you've been to is suggested again (Plan it for me, Surprise me, Don't miss, ALL IN matches, "Guests go next").
4. Sending it makes a new request for the crew, marked **Stage 2**. Their email and review page say where the guest starts from, where they've been, and which trip came first (`summary.stage`; `payload.stage`).

**Log in.** "Not on this device? Log in with your email" asks for the email the guest used, and emails them a link to each trip they've sent. There is no password: the link carries the same signed guest key as the "your trip is checked" emails (90 days; log in again for a new one). The answer is always the same whether or not that address has a trip, so it can't be used to find out who has booked. Backend: `trip-builder-login` (ALL IN repo patch). Config: `LOGIN_ENDPOINT` (blank = derived from `STATUS_ENDPOINT`); without either, the log-in explains itself in demo mode.

How it is kept: the trip itself carries `from` (where you are) and `been` (where you've been) in its share link (`o=` and `v=`), so a stage opens the same on any device. Which stage it is, and which trips came before, live in this browser (`mm-stage`) and travel to the crew with the trip. The planner part (`plan()` in `logic.js`) is covered by 11 stage tests plus the fuzz test, which makes a quarter of its made-up trips later stages.

Not built (ask if you want it): charging a deposit only once for a whole journey. Each stage is its own request, and sending is free, so there is no deposit to repeat.

## 3. A real person checks every trip: "Ask Ewan"

Design it here, confirm it with a person. On every screen:

- A lime bar under the header: **Plan it here. A real human checks it before anything is booked.** with an **Ask Ewan** button.
- The same promise, with the button, in the builder's summary, above "Hold my beds", in the hold-my-beds form, on the trip page, and in the footer.
- **Ask Ewan** opens WhatsApp (`WHATSAPP`) with the trip already in the message (or the trip reference, on a trip page), or an email to `CREW_EMAIL` if there is no number. With neither it's a demo button that says what it would do.
- Config: `ASK_NAME` (default `Ewan`; blank gives "Ask the crew"). The wording is `HUMAN` at the top of the "Ask Ewan" block in `app.js`.

(There is no AI in the builder: the planner is routing and pricing rules, so the bar says "Plan it here", not "planned by AI".)

## Tests

- `npm test`: logic (295), search (28), fuzz, server, pages.
- Browser: `test/ui-xss.js` (hostile data in the crew page, trip page, group page, the sent-trips list, the stage bar and the log-in), `test/ui-lint.js`, `test/ui-smoke.js`.
- ALL IN repo: `handoff/all-in-backend/e2e/run.sh` (114 checks, including logging in and a later stage reaching the crew).
