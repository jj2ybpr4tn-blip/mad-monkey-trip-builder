# Editing your trip: before you send it, and after

A traveller is never stuck with what they were given. They can change anything on the screen, start again from a blank sheet whenever they like, and change a trip they have already sent to the crew. There is no AI and nothing here costs anything to run.

## Starting

**Start building** (the home button, "Build it yourself", and "Start from a blank map" on the quiz results) always opens a **blank sheet**. The trip you were building is kept: the home page shows "Pick up where you left off" with a **Continue this trip** button. The **Builder** button in the header still takes you back to the trip you are working on.

A short **walk-around** starts when a blank sheet opens: it points at the real controls (the map, a stop's card, Add a stop, things to do, dates and budget, Hold my beds). Step 2 asks them to add a stop on the map and carries on by itself when they do; nothing is added for them. "Don't show this when I start building" switches it off; **Show me around** (above the itinerary, and on the blank sheet) replays it any time. (`ui-tour.js`)

## Changing the trip on the screen

| To | They |
|---|---|
| Take a stop out | **Remove stop** on its card (a worded button, with Undo) |
| Take a tour out | the **×** on its chip under the stop, or in Day by day |
| Add a stop | **+ Add a stop** (above the list, in the bar, and a big **+ Add another stop** at the end of the list). It asks *where does it go* (the start, or after any stop) and ranks places by how little they add to the journey, with places already in the trip last |
| Add a stop between two stops | **+ Add a stop in between**, on the journey between them |
| Swap a stop for another place | **Swap place** on its card (keeps the nights) |
| Reorder | **Move** ↑ ↓ on the card, or drag |
| Change nights | − / + on the card |
| Move a tour to another day | the day picker beside it, in Day by day (the tour stays on that day, including in share links) |
| Take anything back | **Undo** / **Redo** above the itinerary, on every message, or Cmd/Ctrl+Z (Shift for redo). "Start over" is undoable too. 60 steps, kept in the browser only |

All of it goes through `edit.js`: one set of validated, all-or-nothing operations (`add_stop`, `remove_stop`, `move_stop`, `set_nights`, `swap_stop`, `add_tour`, `remove_tour`, `move_tour`, `unpin_tour`, `set_start`, `set_style`, `set_travel`, `set_spending`, `set_budget`, `clear`). Stops and days are numbered as the traveller sees them. ALL IN trips are packaged by the crew: they can be moved or removed, but not given other nights or tours. Tests: `test/logic.test.js` ("editing").

## Changing a trip after sending it

A guest can change the trip they sent **until it is booked**. The change **replaces** the trip on the same request (same reference, same deposit, same beds held), so the crew only ever reviews the latest plan and never a plan the guest has already moved on from.

1. On their trip page (`#/trip/<ref>`) they press **Change my trip**. The builder opens the version the crew has, with a pink bar: *Changing trip MM-XXXXXX. Your changes replace what the crew is checking.*
2. They edit it like any other trip. The header button becomes **Send my changes** (disabled until something changes).
3. A box lists what they changed, takes an optional note, and sends it. They land back on their trip page.

What happens, by where the trip is:

| Status | Guest changes it | The crew |
|---|---|---|
| deposit not paid yet | the trip is replaced quietly | isn't told (they haven't seen it); their first email will already be the new version |
| submitted / checking | replaced | gets an **UPDATED (v2)** email: what moved, what it was before, the guest's note, and the usual Approve / Not approved / Edit it buttons |
| ready (crew approved and set a price) | the approval and price are **withdrawn**, back to *checking* | email says so; nothing is waiting for the guest to pay |
| booked | not here: "message the crew" (money is moving, so a payment is never left pointing at a plan that has moved) | |
| declined | not possible: they start a new trip | |

The guest gets a "we've got your changes" email. Sending the same trip again changes nothing and emails nobody. A trip can be changed 30 times, then it asks them to message the crew.

**Crew side.** The review page shows a pink banner (*Sam changed this trip after sending it*, version, what changed, their note, what it replaced). The page remembers which version it showed: if the guest changes the trip while the crew is looking at it, **Approve / Not approved / Save our version is refused until the page is reloaded**, so nobody approves a plan they haven't seen.

**How the guest proves it is them.** Their *guest key* (the same one that lets them choose how to pay) is handed to their browser when they send the trip and is in the link in their confirmation email, in the `#` part of the address, so it never reaches a server log. It is bound to one trip. Links in a change must be into our own trip builder (the crew opens them from an email), so a guest can't smuggle in someone else's address.

**Backend.** `trip-builder-revise` (ALL IN backend, patch 0004; no migration: it uses the `payload` the request already stores), plus the status page returning `canEdit`, the version and party size, and the admin `view` returning what the guest changed. The reference server in this repo doesn't do any of this (it has no guest keys); the builder only shows **Change my trip** when the status endpoint says it will work, and in demo mode it simulates it.

Config: `REVISE_ENDPOINT` (blank = derived from `STATUS_ENDPOINT`).

## Tests

- `npm test`: the editing operations (logic), the server, the pages.
- ALL IN repo: `_shared/trip-builder-revise.test.ts` (the rules: who can edit when, withdrawing an approval, history, link checks) and `handoff/all-in-backend/e2e/run.sh <repo>` (the real handlers end to end against in-memory Supabase, Stripe and Resend, including a guest changing a trip at every status and the crew's stale-version refusal).
- Browser: `test/ui-smoke.js` (dead buttons) and `test/ui-lint.js` (phone layout).
