# Crew review: the new-trip email and the review page

What the crew gets when a guest sends a trip, and how they act on it.

1. **The email** shows the whole trip as the guest built it (who, dates, every stop with tours and the travel between, the money,
   a heads-up list, their note) with three buttons: **Approve**, **Not approved**, **Edit it**.
2. **The review page** (`#/crew/<ref>?k=<key>[&do=approve|decline|edit]`, `ui-crew.js`) shows the same trip with the guest's details
   and the three decisions. Opening a link only reads: nothing is sent, charged or refunded until a person presses the button inside a panel.
3. **Edit it** opens the trip in the builder with a "Save our version" bar (crew edit mode). Saving stores the crew's version, keeps the guest's own,
   and goes back to the review page to approve it.

`crew.js` builds the summary (`MM.crewSummary`) and the plain-text version (`MM.crewText`). The lead payload carries both (see `LEADS.md`).
Trips sent before this existed have no summary: the review page rebuilds it from the guest's own link.

## The endpoint the page talks to

`MM_CONFIG.CREW_ENDPOINT` (with the ALL IN backend: the `trip-builder-admin` function). `POST` JSON `{ action, ref, key, ... }`; any 2xx with `ok: true` is success,
anything else shows `error` to the crew. `key` is the `k` from the link.

| action | body | returns |
| --- | --- | --- |
| `view` | | `{ ok, request, summary, suggestedBalance, revision, original, canAct }` |
| `balance` | `amount`, `note?` | `{ ok, url, emailed }`: records the balance and emails the guest to choose how to pay it (`url` is their trip page, with their key). See [PAYMENTS.md](PAYMENTS.md) |
| `decline` | `note?`, `refund` | `{ ok, refunded }` |
| `revise` | `trip{link,state,route,days,nights,stops,countries,start,estTotalUsd}`, `summary`, `crewText`, `note?` | `{ ok }`: the crew's edited version; status becomes *checking* |
| `checking`, `note`, `booked` | `note?` | `{ ok }` |

Keys are `HMAC-SHA256("tbcrew:" + ref + ":" + expiry)`, one trip each, 30 days, kept in the `#fragment` so they never reach a server log.
A key can only act while the trip is still *submitted*, *checking* or *ready*. See `handoff/all-in-backend/` for the ALL IN implementation.

## Try it without a backend

The review page needs a backend, so on the demo site it says "Not switched on here". To see it locally, run the ALL IN functions
(see the handoff notes) or point `CREW_ENDPOINT` at any server that implements the table above.
