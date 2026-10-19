# Paying for a trip: deposit, approval, then the rest your way

How money flows for a trip someone builds and sends to the crew. This is the guest-facing contract for the builder (`ui-review.js`) and the ALL IN backend that implements it (`handoff/all-in-backend/`).

## The journey

1. **Send it.** The guest sends their trip and pays a deposit per person (`MM_CONFIG.DEPOSIT_PER_PERSON`, $50 on the live site) on a Stripe Checkout page. The deposit holds their beds, counts towards the trip, and is refunded if the crew can't make it work. The checkout **saves the card** (`customer_creation: "always"`, `setup_future_usage: "off_session"`) so the rest can be taken later.
2. **The crew checks it** (the new-trip email, then the review page: Approve / Not approved / Edit it, see [CREW-REVIEW.md](CREW-REVIEW.md)). Approving records the balance: the trip cost for everyone less the deposit. **No payment link is made and nothing is charged.**
3. **The guest chooses how to pay the rest** from the button in the "your trip is checked" email (their trip page, `#/trip/<ref>?k=<key>`):

| Choice | When it's offered | What happens |
| --- | --- | --- |
| **Pay it all now** | always | A Checkout page for the whole balance. Booked and paid in full when it lands. |
| **Pay a week before they leave** | a saved card, a start date, and more than 7 days to go | Booked immediately. The saved card is charged automatically 7 days before departure, with a reminder 3 days before. |
| **Instalments** | a saved card and **60+ days** to departure | Equal payments, the first now on a Checkout page, the rest charged to the saved card every 30 days, the last at least 7 days before departure. Up to 6, each at least $20. |

   Trips with no start date, or sent before cards were saved, can only pay it all now.
4. **Booked.** Their trip page shows the schedule (paid / due). The crew sees the plan and progress in Admin > Trip builder.
5. **Every day a job** (`charge-trip-builder-payments`, 03:00 UTC) sends reminders and charges what's due. A declined card is retried 2 days later, up to 4 times; the guest gets an email with a way to pay it by hand and Ewan is told; a payment that can't be taken by the departure date is marked "not taken" and Ewan is told.

## Why Checkout is made when they choose

Stripe Checkout links expire (24 hours at most). The old flow made the balance link when the crew approved, so a guest opening the email the next day got a dead link. Now the Checkout page is made the moment the guest presses the button.

## Contract

`MM_CONFIG.STATUS_ENDPOINT`: `GET ?ref=MM-XXXXXX[&k=<guest key>]`, adds to the existing fields (without the key they get none of these):

```jsonc
{ "status": "ready", "start": "2027-02-16", "keyed": true,
  "deposit": { "amount": 100, "paid": true, "refunded": false }, "balance": { "amount": 500, "paid": false },
  "pay": { "balance": 500, "daysToGo": 120, "options": [
      { "plan": "now",         "count": 1, "amount": 500, "items": [{ "amount": 500, "due": "2026-10-20" }] },
      { "plan": "later",       "count": 1, "amount": 500, "items": [{ "amount": 500, "due": "2027-02-09" }] },
      { "plan": "instalments", "count": 4, "amount": 500, "items": [{ "amount": 125, "due": "2026-10-20" }, …] } ] },
  "plan": "instalments", "schedule": [{ "n": 1, "amount": 125, "due": "2026-10-20", "status": "paid" }, …],
  "owing": [{ "n": 3, "amount": 125, "due": "2026-12-18" }] }      // card payments that failed or are due and unpaid
```

`MM_CONFIG.PAY_ENDPOINT` (derived from `STATUS_ENDPOINT` when blank): `POST { ref, k, plan }`, `plan` is `now`, `later`, `instalments`, or `due` (pay a missed payment by hand).
Answers `{ ok, checkoutUrl }` (redirect the guest there), or `{ ok, booked: true }` for "later", or `{ error }` with a status of 400 (not on offer), 401 (bad or expired key), 409 (not ready, or already booked on another plan).

The key `k` is `HMAC-SHA256("tbguest:" + ref + ":" + expiry)`, one trip, 90 days, and it's separate from the crew's key: a crew key can't act as a guest and the other way round.

## Rules in one place

`supabase/functions/_shared/trip-builder-pay.ts` holds every rule above as pure functions (`payOptions`, `buildSchedule`, `instalmentCount`, `dueNow`, `needReminder`), covered by `trip-builder-pay.test.ts`. Change the numbers there: `LATE_DAYS`, `INSTALMENT_MIN_DAYS`, `INSTALMENT_EVERY_DAYS`, `MAX_INSTALMENTS`, `MIN_INSTALMENT_USD`, `RETRY_DAYS`, `MAX_ATTEMPTS`.

## Safety

- The deposit's card is the only card used; nothing is charged until the guest has chosen a plan on a page they reached from the crew-approved email.
- Each scheduled charge uses a Stripe idempotency key (`tbpay:<ref>:<n>:<attempt>`), so a double run or a lost database write can't charge twice.
- A trip that has been paid towards can't be declined from the review page (a decline only refunds the deposit): refund the payments in Stripe first.
- A crew key can only act on its own trip while it is still being checked; a guest key can only choose a plan while the trip is `ready` (or pay what's owing).
- Rows hold the card's Stripe ids only (`stripe_customer_id`, `stripe_payment_method_id`), never card details.
