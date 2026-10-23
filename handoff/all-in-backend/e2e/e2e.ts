// End to end: deposit -> crew review (view, edit, decline) -> approve -> guest chooses how to pay -> booked -> daily job charges.
// Runs the REAL Edge Function handlers against in-memory fakes for Supabase, Stripe and Resend. See run.sh.
// @ts-nocheck
import { createClient, __db } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { handleTripBuilderPaid } from "./functions/_shared/trip-builder.ts";

const RealDate = Date; let offset = 0;
class FakeDate extends RealDate { constructor(...a) { if (a.length === 0) super(RealDate.now() + offset * 86400000); else super(...a); } static now() { return RealDate.now() + offset * 86400000; } }
globalThis.Date = FakeDate;
const setDay = (n: number) => { offset = n; };
const iso = (d = new Date()) => d.toISOString().slice(0, 10);

const H: Record<string, (r: Request) => Promise<Response>> = {};
async function load(name: string) { let h; Deno.serve = (x) => { h = x; return {}; }; await import(`./functions/${name}/index.ts`); H[name] = h; }
for (const n of ["trip-builder-request", "trip-builder-admin", "trip-builder-status", "trip-builder-pay", "charge-trip-builder-payments", "trip-builder-revise", "trip-builder-login"]) await load(n);

let pass = 0, fail = 0;
const ok = (name: string, c: unknown, extra = "") => { if (c) { pass++; console.log("PASS  " + name); } else { fail++; console.log("FAIL  " + name + (extra ? "  -> " + extra : "")); } };
const HERE = new URL(".", import.meta.url).pathname;
const outbox = () => { try { return JSON.parse(Deno.readTextFileSync(HERE + "outbox-pay.json")); } catch { return []; } };
const send = async (fn: string, body: unknown, method = "POST", headers: Record<string, string> = {}) => {
  const r = await H[fn](new Request("http://x/" + (method === "GET" ? "?" + new URLSearchParams(body as Record<string, string>) : ""), { method, headers: { "Content-Type": "application/json", Origin: "https://madmonkeyhostels.com", ...headers }, ...(method === "POST" ? { body: JSON.stringify(body) } : {}) }));
  return { s: r.status, b: await r.json().catch(() => ({})) };
};
const sb = createClient("x", "y");
const row = (ref: string) => __db.trip_builder_requests.find((r) => r.ref === ref);
const base = JSON.parse(Deno.readTextFileSync(HERE + "guest-payload.json"));
const last = (to: string) => outbox().filter((m) => m.to.includes(to)).pop();
const text = (m) => (m ? m.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ") : "");

async function newTrip(startIn: number, email: string, card = true) {
  const p = JSON.parse(JSON.stringify(base)); p.trip.start = iso(new Date(Date.now() + startIn * 86400000)); p.contact.email = email;
  const r = await send("trip-builder-request", p); const ref = r.b.ref; globalThis.__guestKey = r.b.key;
  await handleTripBuilderPaid(sb, { metadata: { kind: "trip_builder_deposit", ref, origin: "https://madmonkeyhostels.com" }, payment_intent: "pi_dep_" + ref, customer: card ? "cus_test_1" : null, customer_details: { email } });
  if (!card) { row(ref).stripe_payment_method_id = null; row(ref).stripe_customer_id = null; }
  return ref;
}
async function approve(ref: string, amount: number) {
  const a = await send("trip-builder-admin", { action: "balance", ref, amount, note: "All checked.", password: "test-admin-pw" });
  const m = last(row(ref).guest_email), k = m && /#\/trip\/MM-[A-Z0-9]{6}\?k=([^"&\s]+)/.exec(m.html.replace(/&amp;/g, "&"));
  return { a, key: k && decodeURIComponent(k[1]), mail: m };
}

/* ---- 1. instalments (departure 120 days out) ---- */
{
  const ref = await newTrip(120, "inst@example.com");
  ok("deposit checkout saves the card (customer_creation + setup_future_usage)", globalThis.__checkouts?.[0]?.create === "always" && globalThis.__checkouts?.[0]?.setup === "off_session");
  ok("the deposit payment stores the customer and card on the request", row(ref).stripe_customer_id === "cus_test_1" && row(ref).stripe_payment_method_id === "pm_test_1");
  const { a, key, mail } = await approve(ref, 500);
  ok("approving records the balance, status ready, and makes NO checkout link", a.s === 200 && a.b.ok && row(ref).status === "ready" && row(ref).balance_amount === 500 && !row(ref).balance_url);
  ok("the ready email links to the guest's trip page with a key and lists the choices", !!key && /Choose how to pay/.test(text(mail)) && /instalments/.test(text(mail)) && /automatically on/.test(text(mail)) && /Pay all \$500 now/.test(text(mail)));
  const st = await send("trip-builder-status", { ref, k: key }, "GET");
  ok("status with the key offers now + later + instalments", st.b.pay && st.b.pay.options.map((o) => o.plan).join() === "now,later,instalments", JSON.stringify(st.b.pay && st.b.pay.options.map((o) => o.plan)));
  const sn = await send("trip-builder-status", { ref }, "GET");
  ok("status without the key shows no payment options and no schedule", sn.b.pay === null && sn.b.schedule.length === 0 && sn.b.keyed === false);
  const bad = await send("trip-builder-pay", { ref, k: key + "x", plan: "now" });
  ok("a wrong guest key is refused", bad.s === 401);
  const crewKey = await send("trip-builder-admin", { action: "link", ref, password: "test-admin-pw" });
  const ck = new URL(crewKey.b.url.replace("#", "")).searchParams.get("k");
  ok("a CREW key is refused on the guest payment endpoint", (await send("trip-builder-pay", { ref, k: ck, plan: "now" })).s === 401);
  const pay = await send("trip-builder-pay", { ref, k: key, plan: "instalments" });
  const co = globalThis.__checkouts.at(-1);
  ok("choosing instalments sends them to pay the first one on Checkout (customer re-used, kind instalment)", pay.s === 200 && pay.b.checkoutUrl && co.meta.kind === "trip_builder_instalment" && co.meta.n === "1" && co.customer === "cus_test_1");
  const sched = row(ref).pay_schedule;
  ok("the schedule is 4 payments (120 days out), first today on Checkout, the rest on the card every 30 days, summing to the balance",
    sched.length === 4 && sched[0].how === "checkout" && sched.slice(1).every((i, k) => i.how === "card" && i.due === iso(new Date(Date.now() + 30 * (k + 1) * 86400000))) && Math.round(sched.reduce((a, i) => a + i.amount * 100, 0)) === 50000, JSON.stringify(sched.map((i) => i.amount)));
  ok("not booked until the first payment lands", row(ref).status === "ready");
  ok("first payment is for a quarter of the balance", co.amount === 125);
  await handleTripBuilderPaid(sb, { metadata: { kind: "trip_builder_instalment", ref, n: "1", origin: "https://madmonkeyhostels.com" }, payment_intent: "pi_inst1", amount_total: 12500, customer_details: { email: "inst@example.com" } });
  ok("when the first payment lands: booked, item 1 paid, plan stored", row(ref).status === "approved" && row(ref).pay_plan === "instalments" && row(ref).pay_schedule[0].status === "paid" && !row(ref).balance_paid_at);
  ok("the guest gets a 'You're booked' email with their payment table", /You're booked/.test(last("inst@example.com").subject) && /Your payments/.test(text(last("inst@example.com"))));
  await handleTripBuilderPaid(sb, { metadata: { kind: "trip_builder_instalment", ref, n: "1", origin: "x" }, payment_intent: "pi_inst1", amount_total: 12500, customer_details: { email: "inst@example.com" } });
  ok("a webhook delivered twice changes nothing", row(ref).pay_schedule.filter((i) => i.status === "paid").length === 1);
  ok("choosing again once booked on a different plan is refused", (await send("trip-builder-pay", { ref, k: key, plan: "later" })).s === 409);
  ok("choosing the same plan again is a harmless 'already booked'", (await send("trip-builder-pay", { ref, k: key, plan: "instalments" })).b.booked === true);
  ok("declining a trip that has been paid towards is refused", (await send("trip-builder-admin", { action: "decline", ref, refund: true, password: "test-admin-pw" })).s === 409);

  // day 27: reminder for payment 2 (due day 30)
  globalThis.__charges = []; setDay(27);
  let j = await send("charge-trip-builder-payments", {}, "POST", { "x-cron-secret": "cron-secret-for-tests" });
  ok("3 days before payment 2: a reminder, no charge", j.s === 200 && globalThis.__charges.length === 0 && /comes out/.test(text(last("inst@example.com"))) && row(ref).pay_schedule[1].reminded === true);
  j = await send("charge-trip-builder-payments", {}, "POST", { "x-cron-secret": "cron-secret-for-tests" });
  ok("running the job again the same day sends no second reminder", outbox().filter((m) => /comes out/.test(m.subject)).length === 1);
  ok("the job refuses a missing/wrong cron secret", (await send("charge-trip-builder-payments", {}, "POST", { "x-cron-secret": "nope" })).s === 403);

  // day 30: payment 2 charged to the saved card
  setDay(30); globalThis.__stripeFail = false; globalThis.__charges = [];
  j = await send("charge-trip-builder-payments", {}, "POST", { "x-cron-secret": "cron-secret-for-tests" });
  const ch = globalThis.__charges;
  ok("day 30: payment 2 charged off-session to the saved card", ch.length === 1 && ch[0].amount === 125 && ch[0].off_session === true && ch[0].customer === "cus_test_1" && ch[0].pm === "pm_test_1" && /tbpay:/.test(ch[0].key));
  ok("payment 2 is marked paid and the guest gets a receipt saying what's left", row(ref).pay_schedule[1].status === "paid" && /We've taken/.test(text(last("inst@example.com"))) && /to go/.test(text(last("inst@example.com"))));

  // day 60: payment 3 declined
  setDay(60); globalThis.__stripeFail = true; globalThis.__charges = [];
  await send("charge-trip-builder-payments", {}, "POST", { "x-cron-secret": "cron-secret-for-tests" });
  let r3 = row(ref).pay_schedule[2];
  ok("a declined card: item failed, attempt counted, retry set 2 days out", r3.status === "failed" && r3.attempts === 1 && /declined/.test(r3.last_error) && r3.retry_after && r3.retry_after.slice(0, 10) === iso(new Date(Date.now() + 2 * 86400000)));
  ok("the guest is told, with a way to pay it by hand, and Ewan is alerted", /didn't go through/.test(last("inst@example.com").subject) && /didn't go through/.test(outbox().filter((m) => m.to.includes("ewan@madmonkeyhostels.com")).pop().subject));
  const st2 = await send("trip-builder-status", { ref, k: key }, "GET");
  ok("status shows what is owing so the guest can pay it by hand", st2.b.owing.length === 1 && st2.b.owing[0].n === 3 && st2.b.owing[0].amount === 125);
  globalThis.__charges = [];
  await send("charge-trip-builder-payments", {}, "POST", { "x-cron-secret": "cron-secret-for-tests" });
  ok("it does not retry before the retry date", globalThis.__charges.length === 0);
  const due = await send("trip-builder-pay", { ref, k: key, plan: "due" });
  ok("'pay it now' makes a Checkout for the missed payment", due.s === 200 && due.b.checkoutUrl && globalThis.__checkouts.at(-1).amount === 125 && globalThis.__checkouts.at(-1).meta.n === "3");
  await handleTripBuilderPaid(sb, { metadata: { kind: "trip_builder_instalment", ref, n: "3", origin: "x" }, payment_intent: "pi_inst3", amount_total: 12500, customer_details: { email: "inst@example.com" } });
  ok("paying the missed one by hand marks it paid", row(ref).pay_schedule[2].status === "paid");

  // day 90: last payment succeeds -> paid in full
  setDay(90); globalThis.__stripeFail = false;
  await send("charge-trip-builder-payments", {}, "POST", { "x-cron-secret": "cron-secret-for-tests" });
  ok("the last payment completes the trip: balance_paid_at set, 'paid in full' email", !!row(ref).balance_paid_at && row(ref).pay_schedule.every((i) => i.status === "paid") && /paid in full/i.test(last("inst@example.com").subject));
  setDay(0);
}

/* ---- 2. pay later (departure 40 days out) ---- */
{
  setDay(0); globalThis.__charges = [];
  const ref = await newTrip(40, "later@example.com");
  const { key } = await approve(ref, 450);
  const st = await send("trip-builder-status", { ref, k: key }, "GET");
  ok("40 days out: now + later offered, no instalments", st.b.pay.options.map((o) => o.plan).join() === "now,later");
  ok("instalments are refused when they're not on offer", (await send("trip-builder-pay", { ref, k: key, plan: "instalments" })).s === 400);
  const pay = await send("trip-builder-pay", { ref, k: key, plan: "later" });
  ok("'later' books them straight away with no checkout", pay.s === 200 && pay.b.booked && row(ref).status === "approved" && row(ref).pay_plan === "later");
  const s = row(ref).pay_schedule;
  ok("one card payment of the full balance, a week before departure", s.length === 1 && s[0].how === "card" && s[0].amount === 450 && s[0].due === iso(new Date(Date.now() + 33 * 86400000)));
  ok("they get a booked email and so does Ewan", /You're booked/.test(last("later@example.com").subject) && /is booked/.test(outbox().filter((m) => m.to.includes("ewan@madmonkeyhostels.com")).pop().subject));
  setDay(30); globalThis.__charges = [];
  await send("charge-trip-builder-payments", {}, "POST", { "x-cron-secret": "cron-secret-for-tests" });
  ok("3 days before: reminder only", globalThis.__charges.length === 0 && row(ref).pay_schedule[0].reminded);
  setDay(33);
  await send("charge-trip-builder-payments", {}, "POST", { "x-cron-secret": "cron-secret-for-tests" });
  ok("the day: charged, paid in full", globalThis.__charges.length === 1 && globalThis.__charges[0].amount === 450 && !!row(ref).balance_paid_at);
  setDay(0);
}

/* ---- 3. pay now ---- */
{
  const ref = await newTrip(40, "now@example.com");
  const { key } = await approve(ref, 300);
  const pay = await send("trip-builder-pay", { ref, k: key, plan: "now" });
  const co = globalThis.__checkouts.at(-1);
  ok("'now' makes one Checkout for the whole balance (kind balance)", pay.s === 200 && co.amount === 300 && co.meta.kind === "trip_builder_balance");
  await handleTripBuilderPaid(sb, { metadata: { kind: "trip_builder_balance", ref, n: "1", origin: "x" }, payment_intent: "pi_bal", amount_total: 30000, customer_details: { email: "now@example.com" } });
  ok("paid: approved + paid in full + the confirmation email", row(ref).status === "approved" && !!row(ref).balance_paid_at && row(ref).pay_plan === "now" && /You're booked/.test(last("now@example.com").subject));
}

/* ---- 4. no saved card (a trip sent before this existed) / no date ---- */
{
  const ref = await newTrip(120, "old@example.com", false);
  const { key } = await approve(ref, 400);
  const st = await send("trip-builder-status", { ref, k: key }, "GET");
  ok("no saved card: only 'pay now' is offered", st.b.pay.options.map((o) => o.plan).join() === "now");
  ok("and 'later' is refused", (await send("trip-builder-pay", { ref, k: key, plan: "later" })).s === 400);
  const nodate = await newTrip(120, "nodate@example.com"); row(nodate).start_date = null;
  const k2 = (await approve(nodate, 400)).key;
  ok("no departure date: only 'pay now'", (await send("trip-builder-status", { ref: nodate, k: k2 }, "GET")).b.pay.options.map((o) => o.plan).join() === "now");
}

/* ---- 5. safety ---- */
{
  const ref = await newTrip(120, "safe@example.com");
  const k = (await send("trip-builder-admin", { action: "link", ref, password: "test-admin-pw" }));
  ok("paying before the crew has approved is refused", (await send("trip-builder-pay", { ref, k: "x", plan: "now" })).s === 401);
  const { key } = await approve(ref, 500);
  row(ref).status = "checking";
  ok("choosing a plan while the trip is not 'ready' is refused", (await send("trip-builder-pay", { ref, k: key, plan: "now" })).s === 409);
  row(ref).status = "ready";
  ok("junk plan names are refused", (await send("trip-builder-pay", { ref, k: key, plan: "free" })).s === 400);
  ok("another trip's key doesn't open this one", (await send("trip-builder-status", { ref, k: (await approve(await newTrip(120, "other@example.com"), 200)).key }, "GET")).b.keyed === false);
}


/* ---- 6. the crew review page: view, edit, decline ---- */
{
  setDay(0);
  const ref = await newTrip(120, "crew@example.com");
  const adminKey = async (r) => { const l = await send("trip-builder-admin", { action: "link", ref: r, password: "test-admin-pw" }); return new URL(l.b.url.replace("#", "")).searchParams.get("k"); };
  const k = await adminKey(ref);
  const v = await send("trip-builder-admin", { action: "view", ref, key: k });
  ok("the crew key can view its own trip: the summary, the suggested balance, no card ids", v.s === 200 && v.b.summary.stops.length === 3 && v.b.suggestedBalance === 602 && !("stripe_payment_method_id" in v.b.request) && !("deposit_payment_intent" in v.b.request));
  ok("a crew key can't list every request or mint links", (await send("trip-builder-admin", { action: "list", ref, key: k })).s === 401 && (await send("trip-builder-admin", { action: "link", ref, key: k })).s === 401);
  const rev = await send("trip-builder-admin", { action: "revise", ref, key: k, note: "Added a night in Hoi An.", trip: { link: "https://madmonkeyhostels.com/all-in-trips/trip-builder/#/build/i=s.hanoi.4~s.hoi-an.5~s.saigon.3", route: "Hanoi → Hoi An → Ho Chi Minh City", days: 13, nights: 12, stops: ["hanoi", "hoi-an", "saigon"], countries: ["VN"], start: iso(new Date(Date.now() + 120 * 86400000)), estTotalUsd: 596 }, summary: { stops: [], budget: { tripCostAllPeople: 712 }, days: 13 }, crewText: "EDITED" });
  ok("Edit it saves the crew's version, moves it to 'checking' and keeps the guest's own", rev.s === 200 && row(ref).status === "checking" && row(ref).days === 13 && row(ref).payload.original.trip.days === 12 && row(ref).payload.revision.note === "Added a night in Hoi An.");
  ok("a revise with a broken link is refused", (await send("trip-builder-admin", { action: "revise", ref, key: k, trip: { link: "javascript:alert(1)", route: "x", days: 3 }, summary: {} })).s === 400);
  const dec = await send("trip-builder-admin", { action: "decline", ref, key: k, note: "Sorry, full that week.", refund: true });
  ok("Not approved refunds the deposit and emails the guest the reason", dec.s === 200 && dec.b.refunded === 100 && row(ref).status === "declined" && /full that week/.test(text(last("crew@example.com"))));
  ok("once declined, the crew link can't act any more", (await send("trip-builder-admin", { action: "balance", ref, key: k, amount: 300 })).s === 409);
}

/* ---- 7. a double tap books once ---- */
{
  setDay(0);
  const ref = await newTrip(40, "double@example.com");
  const { key } = await approve(ref, 450);
  const before = outbox().filter((m) => /booked/i.test(m.subject) && m.to.includes("double@example.com")).length;
  const [a, b] = await Promise.all([send("trip-builder-pay", { ref, k: key, plan: "later" }), send("trip-builder-pay", { ref, k: key, plan: "later" })]);
  const after = outbox().filter((m) => /booked/i.test(m.subject) && m.to.includes("double@example.com")).length;
  ok("two taps at once both succeed but the booking email goes out once", a.s === 200 && b.s === 200 && a.b.booked && b.b.booked && after - before === 1, `emails: ${after - before}`);
}

/* ---- 8. the guest changes the trip after sending it ---- */
{
  setDay(0);
  const SITE = "https://madmonkeyhostels.com/all-in-trips/trip-builder/#/build/";
  const LINK = (n: number) => SITE + "i=s.hanoi.4~s.hoi-an.4&d=2027-03-01&n=" + n;
  const ewan = () => outbox().filter((m) => m.to.includes("ewan@madmonkeyhostels.com")).pop();
  const change = (ref: string, key: unknown, n: number, extra: Record<string, unknown> = {}) => send("trip-builder-revise", {
    ref, k: key, note: "Dropped Saigon.", changes: ["Removed Ho Chi Minh City", "Hoi An: 4 nights"],
    trip: { ...base.trip, link: LINK(n), route: "Hanoi → Hoi An", days: 9, nights: 8, stops: ["hanoi", "hoi-an"], estTotalUsd: 420, start: "2027-03-01" },
    summary: base.summary, crewText: "CREW TEXT v" + n, itinerary: "ITIN " + n, ...extra });
  const ref = await newTrip(120, "rev@example.com"), key = globalThis.__guestKey;
  const oldRoute = row(ref).route, oldDays = row(ref).days, dep = row(ref).deposit_amount;
  ok("sending a trip hands the guest their key, and the deposit email links to their trip page with it", !!key && new RegExp("#/trip/" + ref + "\\?k=").test(last("rev@example.com").html.replace(/&amp;/g, "&")));
  ok("a wrong, missing or CREW key can't change the trip", (await change(ref, key + "x", 1)).s === 401 && (await change(ref, undefined, 1)).s === 401
    && (await change(ref, new URL((await send("trip-builder-admin", { action: "link", ref, password: "test-admin-pw" })).b.url.replace("#", "")).searchParams.get("k"), 1)).s === 401);
  ok("a link to someone else's site is refused", (await change(ref, key, 1, { trip: { ...base.trip, link: "https://evil.example/#/build/i=s.hanoi.4" } })).s === 400);
  ok("a trip with no stops is refused", (await change(ref, key, 1, { trip: { ...base.trip, link: LINK(1), route: "", days: 0 } })).s === 400);
  ok("nothing changed while those were refused", row(ref).route === oldRoute && !row(ref).payload.rev);

  const n0 = outbox().length, c = await change(ref, key, 1);
  ok("changing a trip the crew is yet to look at replaces it on the SAME request", c.s === 200 && c.b.ok && c.b.rev === 1 && c.b.status === "submitted" && row(ref).route === "Hanoi → Hoi An" && row(ref).days === 9 && row(ref).trip_link === LINK(1) && row(ref).start_date === "2027-03-01" && row(ref).est_total_usd === 420);
  ok("same reference, same deposit, still paid, no second row", __db.trip_builder_requests.filter((r) => r.ref === ref).length === 1 && row(ref).deposit_amount === dep && !!row(ref).deposit_paid_at);
  ok("the crew's text and itinerary are the new version", /CREW TEXT v1/.test(row(ref).itinerary) && row(ref).payload.rev === 1 && row(ref).payload.history.length === 1 && row(ref).payload.history[0].was.route === oldRoute);
  const upd = ewan();
  ok("the crew gets ONE UPDATED email that says what moved, what it was before, the guest's note, and has the approve buttons",
    outbox().length - n0 === 2 && /^UPDATED \(v1\)/.test(upd.subject) && /Removed Ho Chi Minh City/.test(text(upd)) && text(upd).includes(oldRoute) && /Dropped Saigon/.test(text(upd)) && /changed their plan after sending it/.test(text(upd)) && /#\/crew\/MM-/.test(upd.html) && /do=approve/.test(upd.html.replace(/&amp;/g, "&")), upd && upd.subject);
  ok("the guest is told we've got their changes, with a link back to their trip page", /We've got your changes/.test(last("rev@example.com").subject) && /Removed Ho Chi Minh City/.test(text(last("rev@example.com"))) && /\?k=/.test(last("rev@example.com").html));
  const n1 = outbox().length; const same = await change(ref, key, 1, { note: "" });
  ok("sending the very same trip again changes nothing and emails nobody", same.s === 200 && same.b.unchanged === true && outbox().length === n1 && row(ref).payload.rev === 1);

  const st = await send("trip-builder-status", { ref, k: key }, "GET"), stn = await send("trip-builder-status", { ref }, "GET");
  ok("the status page says they can edit (with their key), what version it is, and the party size; no key, no editing", st.b.canEdit === true && st.b.rev === 1 && st.b.people === 2 && stn.b.canEdit === false && stn.b.keyed === false);
  const ak = new URL((await send("trip-builder-admin", { action: "link", ref, password: "test-admin-pw" })).b.url.replace("#", "")).searchParams.get("k");
  const view = await send("trip-builder-admin", { action: "view", ref, key: ak });
  ok("the crew's review page is told the version and what the guest changed", view.b.rev === 1 && view.b.guestRevision.rev === 1 && view.b.guestRevision.changes.length === 2 && view.b.guestRevision.note === "Dropped Saigon." && view.b.guestRevision.was.route === oldRoute);
  const stale = await send("trip-builder-admin", { action: "balance", ref, key: ak, amount: 300, rev: 0 });
  ok("approving a version the guest has since changed is refused, so nobody approves a plan they haven't seen", stale.s === 409 && stale.b.stale === true && row(ref).status === "submitted");
  const good = await send("trip-builder-admin", { action: "balance", ref, key: ak, amount: 300, rev: 1 });
  ok("approving the current version works", good.s === 200 && row(ref).status === "ready" && row(ref).balance_amount === 300);

  // changing it after the crew approved: the approval and the price are withdrawn
  const n2 = outbox().length, w = await change(ref, key, 2, { note: "One more tweak.", changes: ["Hanoi: 5 nights"] });
  ok("changing an approved trip puts it back to 'checking' and withdraws the price", w.s === 200 && w.b.withdrawn === true && w.b.status === "checking" && row(ref).status === "checking" && row(ref).balance_amount === null && row(ref).pay_plan === null && row(ref).payload.rev === 2);
  ok("the crew is told the approval is withdrawn; the guest is told nothing is due", /withdrawn/.test(text(ewan())) && /UPDATED \(v2\)/.test(ewan().subject) && /nothing is due|Nothing is due/.test(text(last("rev@example.com"))) && outbox().length - n2 === 2);
  ok("the guest can't pay the withdrawn price", (await send("trip-builder-pay", { ref, k: key, plan: "now" })).s === 409);

  // a crew edit is replaced by the guest's new version
  const ck = ak;
  await send("trip-builder-admin", { action: "revise", ref, key: ck, note: "We tweaked it.", trip: { link: "https://madmonkeyhostels.com/all-in-trips/trip-builder/#/build/i=s.hanoi.5", route: "Hanoi", days: 6 }, summary: base.summary });
  ok("(a crew edit exists)", !!row(ref).payload.revision);
  await change(ref, key, 3);
  ok("and the guest's next version replaces the crew's edit", !row(ref).payload.revision && !row(ref).payload.original && row(ref).payload.rev === 3 && row(ref).trip_link === LINK(3));

  // booked and declined trips can't be changed here
  row(ref).status = "approved"; const bk = await change(ref, key, 4);
  ok("a booked trip can't be changed here: it tells them to message the crew", bk.s === 409 && bk.b.locked === true && /booked/.test(bk.b.error) && row(ref).trip_link === LINK(3));
  row(ref).status = "declined"; ok("a declined trip can't be changed", (await change(ref, key, 5)).s === 409);
  ok("a booked trip shows no 'edit' on the status page", (row(ref).status = "approved", (await send("trip-builder-status", { ref, k: key }, "GET")).b.canEdit === false));
  row(ref).status = "checking";

  // a runaway script
  row(ref).payload.rev = 30; ok("after 30 changes it stops, so the crew isn't emailed forever", (await change(ref, key, 6)).s === 409);

  // before the deposit is paid, nobody has seen the trip: replace it quietly, and the crew's first email is the new one
  const p = JSON.parse(JSON.stringify(base)); p.trip.start = iso(new Date(Date.now() + 120 * 86400000)); p.contact.email = "unpaid@example.com";
  const un = await send("trip-builder-request", p), uref = un.b.ref, n3 = outbox().length;
  const uc = await change(uref, un.b.key, 7);
  ok("before the deposit is paid the trip is replaced quietly: nobody is emailed", uc.s === 200 && row(uref).status === "pending_payment" && row(uref).route === "Hanoi → Hoi An" && outbox().length === n3);
  await handleTripBuilderPaid(sb, { metadata: { kind: "trip_builder_deposit", ref: uref, origin: "https://madmonkeyhostels.com" }, payment_intent: "pi_dep_" + uref, customer: "cus_test_1", customer_details: { email: "unpaid@example.com" } });
  ok("when the deposit lands the crew's first email is the changed version, not the old one", /Hanoi → Hoi An/.test(ewan().subject + text(ewan())) && !/^UPDATED/.test(ewan().subject));
}

/* ---- 9. links in our emails only ever lead to our own sites ---- */
{
  setDay(0);
  const EVIL = "https://evil.example";
  const sendAs = (origin: string, email: string, link: string, headers: Record<string, string> = {}) => {
    const p = JSON.parse(JSON.stringify(base)); p.trip.start = iso(new Date(Date.now() + 120 * 86400000)); p.contact.email = email; p.trip.link = link;
    return send("trip-builder-request", p, "POST", { Origin: origin, ...headers });
  };
  const OWN = "https://madmonkeyhostels.com/all-in-trips/trip-builder/#/build/i=s.hanoi.4";

  // someone who makes up the Origin header, to get our emails to point at their site (the crew's buttons carry a key)
  const before = outbox().length;
  const forged = await sendAs(EVIL, "forged@example.com", EVIL + "/#/build/i=s.hanoi.4");
  const fref = forged.b.ref;
  await handleTripBuilderPaid(sb, { metadata: { kind: "trip_builder_deposit", ref: fref, origin: EVIL }, payment_intent: "pi_dep_" + fref, customer: "cus_test_1", customer_details: { email: "forged@example.com" } });
  const mails = outbox().slice(before), everything = JSON.stringify(mails);
  ok("a request that claims to come from another site still gets emails with our own links", mails.length >= 2 && !/evil\.example/.test(everything) && /madmonkeyhostels\.com\/all-in-trips\/trip-builder\/#\/(crew|trip)\//.test(everything), everything.match(/https?:\/\/[^"\s\\<]*evil[^"\s\\<]*/)?.[0] ?? "");
  ok("the link they sent to a site of their own is not kept", row(fref).trip_link === null);
  const co = globalThis.__checkouts.find((c) => c.meta?.ref === fref);
  ok("the guest's return from Stripe goes to our site too", !!co && /^https:\/\/madmonkeyhostels\.com\/all-in-trips\/trip-builder\/#\/trip\/MM-/.test(co.success), String(co?.success));

  // links that aren't a trip on our own site
  for (const [what, link] of [["a javascript: link", "javascript:alert(document.cookie)"], ["another site's link", "https://madmonkeyhostels.com.evil.example/#/build/i=s.hanoi.4"], ["a link with no trip in it", "https://madmonkeyhostels.com/all-in-trips/"], ["a data: link", "data:text/html,<script>alert(1)</script>"]]) {
    const r = await sendAs("https://madmonkeyhostels.com", "links@example.com", link, { "cf-connecting-ip": "203.0.113." + (10 + Math.floor(Math.random() * 200)) });
    ok("not kept: " + what, r.s === 200 && row(r.b.ref).trip_link === null, String(row(r.b.ref)?.trip_link));
  }
  const good = await sendAs("https://madmonkeyhostels.com", "good@example.com", OWN);
  ok("a link to a trip on our own site is kept", good.s === 200 && row(good.b.ref).trip_link === OWN);

  // an old request whose link was saved before this check existed: it is left out of the email, not printed
  const oldRef = await newTrip(120, "old@example.com"), editRef = await newTrip(120, "edit@example.com");
  row(oldRef).trip_link = "javascript:alert(1)";
  const ready = await approve(oldRef, 500);
  ok("an unsafe link already saved on a request never reaches an email", !!ready.mail && !/javascript:/i.test(ready.mail.html) && /Choose how to pay/.test(text(ready.mail)));
  const crewKey = (await send("trip-builder-admin", { action: "link", ref: editRef, password: "test-admin-pw" })).b.url.match(/k=([^&]+)/)[1];
  const edit = (link: string) => send("trip-builder-admin", { action: "revise", ref: editRef, key: crewKey, note: "x", trip: { link, route: "Hanoi", days: 6 }, summary: base.summary });
  ok("the crew's edited version has to link to one of our own sites too", (await edit(EVIL + "/#/build/i=s.hanoi.5")).s === 400 && (await edit(OWN)).s === 200);

  // a runaway script: a few trips an hour from one contact, and from one address
  let last429 = 0, sent = 0;
  for (let i = 0; i < 8; i++) { const r = await sendAs("https://madmonkeyhostels.com", "spam@example.com", OWN); if (r.s === 200) sent++; else last429 = r.s; }
  ok("one contact can send 5 trips an hour, then it says so (429)", sent === 5 && last429 === 429, sent + " sent, last status " + last429);
  ok("the refusal tells them what to do", /few trips|check your email/i.test(JSON.stringify((await sendAs("https://madmonkeyhostels.com", "spam@example.com", OWN)).b)));
  const countBefore = __db.trip_builder_requests.length;
  await sendAs("https://madmonkeyhostels.com", "spam@example.com", OWN);
  ok("a refused request saves nothing", __db.trip_builder_requests.length === countBefore);
  ok("someone else is not held up by it", (await sendAs("https://madmonkeyhostels.com", "fresh@example.com", OWN)).s === 200);
  ok("after an hour they can try again", (setDay(1), (await sendAs("https://madmonkeyhostels.com", "spam@example.com", OWN)).s === 200));
  setDay(0);
  const ipHeaders = { "cf-connecting-ip": "198.51.100.7" }; let ipSent = 0, ipLast = 0;
  for (let i = 0; i < 13; i++) { const r = await sendAs("https://madmonkeyhostels.com", `ip${i}@example.com`, OWN, ipHeaders); if (r.s === 200) ipSent++; else ipLast = r.s; }
  ok("one address can send 10 trips an hour, whoever they say they are", ipSent === 10 && ipLast === 429, ipSent + " sent, last status " + ipLast);
  ok("a different address is fine", (await sendAs("https://madmonkeyhostels.com", "ip-other@example.com", OWN, { "cf-connecting-ip": "198.51.100.8" })).s === 200);
  ok("the address itself is never saved, only a keyed hash of it", !JSON.stringify(__db.trip_builder_requests).includes("198.51.100.7") && /^[0-9a-f]{24}$/.test(String(__db.trip_builder_requests.find((r) => r.email === "ip0@example.com")?.payload?.ipHash ?? "")));
  ok("a made-up X-Forwarded-For can't dodge it: only the last entry counts", await (async () => { const r = await sendAs("https://madmonkeyhostels.com", "xff@example.com", OWN, { "x-forwarded-for": "9.9.9.9, 198.51.100.7" }); return r.s === 429; })());
}

/* ---- 10. logging in by email, and a later stage of a journey ---- */
{
  setDay(0);
  const toGuest = (email: string) => outbox().filter((m) => m.to.includes(email));
  const login = (email: unknown, extra: Record<string, unknown> = {}, headers: Record<string, string> = {}) => send("trip-builder-login", { email, ...extra }, "POST", headers);
  const keyIn = (m: { html: string }, ref: string) => { const x = new RegExp("#/trip/" + ref + "\\?k=([^\"&\\s<]+)").exec(m.html.replace(/&amp;/g, "&")); return x ? decodeURIComponent(x[1]) : ""; };

  const ref = await newTrip(120, "login.guest@example.com");            // paid, with the crew
  const before = toGuest("login.guest@example.com").length;
  const r1 = await login("Login.Guest@Example.com ");
  const mail = toGuest("login.guest@example.com").slice(before).pop();
  ok("logging in with the email they used sends them a link to the trip", r1.s === 200 && r1.b.ok === true && !!mail && mail.html.includes(ref) && /Open this trip/.test(mail.html) && /plan your next stage/i.test(text(mail)), JSON.stringify(r1));
  const k = mail ? keyIn(mail, ref) : "";
  ok("the link carries a real guest key: it opens their trip and lets them change it", !!k && (await send("trip-builder-status", { ref, k }, "GET")).b.keyed === true && (await send("trip-builder-status", { ref, k }, "GET")).b.canEdit === true);
  ok("the answer for an email with no trip is the same, and nothing is sent", await (async () => { const n = outbox().length; const r = await login("nobody.at.all@example.com"); return r.s === 200 && JSON.stringify(r.b) === JSON.stringify(r1.b) && outbox().length === n; })());
  ok("a trip whose deposit is unpaid, or that was declined, isn't sent", await (async () => {
    const p = JSON.parse(JSON.stringify(base)); p.trip.start = iso(new Date(Date.now() + 120 * 86400000)); p.contact.email = "unpaid.login@example.com"; const un = await send("trip-builder-request", p);   // never paid
    const dref = await newTrip(120, "declined.login@example.com"); row(dref).status = "declined";
    const n = outbox().length; await login("unpaid.login@example.com"); await login("declined.login@example.com"); return un.s === 200 && outbox().length === n; })());
  ok("a booked trip is included, newest first, with each trip's own link", await (async () => {
    const a = await newTrip(120, "two.trips@example.com"), b = await newTrip(90, "two.trips@example.com"); row(a).status = "approved"; row(a).created_at = new Date(Date.now() - 86400000).toISOString();
    const n = toGuest("two.trips@example.com").length; await login("two.trips@example.com"); const m = toGuest("two.trips@example.com").slice(n).pop();
    return !!m && m.html.indexOf(b) > -1 && m.html.indexOf(a) > m.html.indexOf(b) && !!keyIn(m, a) && !!keyIn(m, b) && keyIn(m, a) !== keyIn(m, b) && /Your Mad Monkey trips/.test(m.subject); })());
  ok("a key from the log-in email is for that trip only", await (async () => { const o = await newTrip(120, "other.guest@example.com"); return (await send("trip-builder-status", { ref: o, k }, "GET")).b.keyed === false; })());

  // the same answer, whatever they type: junk is refused, a bot's hidden field is ignored, and an address with a wildcard in it matches only itself
  ok("an email that isn't one is refused", (await login("not an email")).s === 400 && (await login("")).s === 400 && (await login(null)).s === 400 && (await login({ x: 1 })).s === 400);
  ok("a filled hidden field is a bot: it gets the same answer and nothing is sent", await (async () => { const n = outbox().length; const r = await login("login.guest@example.com", { website: "http://spam.example" }); return r.s === 200 && r.b.ok === true && outbox().length === n; })());
  ok("an address with a _ or % in it doesn't match someone else's trips", await (async () => {
    const v = await newTrip(120, "aXb.victim@example.com"); __db.trip_builder_requests.find((r) => r.ref === v).guest_email = "aXb@example.com"; __db.trip_builder_requests.find((r) => r.ref === v).email = "other@example.org";
    const n = outbox().length; await login("a_b@example.com"); await login("a%b@example.com"); await login("%@example.com"); await login("a*b@example.com"); await login("*@example.com"); return outbox().length === n; })());
  ok("the receipts address counts too, however it was capitalised", await (async () => {
    const g = await newTrip(120, "contact.addr@example.com"); __db.trip_builder_requests.find((r) => r.ref === g).guest_email = "Pay.Er@Example.com";
    const n = toGuest("pay.er@example.com").length; await login("pay.er@example.com"); return toGuest("pay.er@example.com").length === n + 1; })());
  ok("three a hour per address, and the fourth gets the same answer without another email", await (async () => {
    const e = "throttle@example.com"; await newTrip(120, e); const n = toGuest(e).length; const rs = [] as number[];
    for (let i = 0; i < 5; i++) rs.push((await login(e)).s);
    return rs.every((x) => x === 200) && toGuest(e).length === n + 3; })());
  ok("after an hour it works again", await (async () => { const e = "throttle@example.com", n = toGuest(e).length; setDay(1); await login(e); setDay(0); return toGuest(e).length === n + 1; })());
  ok("a link in that email is never on a site that isn't ours, whatever the Origin says", await (async () => {
    const e = "origin.check@example.com"; await newTrip(120, e); const n = toGuest(e).length; await login(e, {}, { Origin: "https://evil.example" }); const m = toGuest(e).slice(n).pop();
    return !!m && !/evil\.example/.test(m.html) && /madmonkeyhostels\.com\/all-in-trips\/trip-builder\/#\/trip\//.test(m.html); })());

  // a later stage reaches the crew with where they start, where they have been, and which trip came first
  const sp = JSON.parse(JSON.stringify(base)); sp.trip.start = iso(new Date(Date.now() + 120 * 86400000)); sp.contact.email = "stage.two@example.com";
  sp.summary.stage = { n: 2, parent: ref, from: { id: "saigon", name: "Ho Chi Minh City" }, been: ["Hanoi", "Hoi An", "Ho Chi Minh City"], arrival: { to: "Phnom Penh", mode: "Bus", hours: "7h", usd: 13, overnight: false, date: sp.trip.start } };
  sp.stage = { n: 2, parent: ref, from: "saigon", been: ["hanoi", "hoi-an", "saigon"] };
  const st = await send("trip-builder-request", sp), sref = st.b.ref;
  await handleTripBuilderPaid(sb, { metadata: { kind: "trip_builder_deposit", ref: sref, origin: "https://madmonkeyhostels.com" }, payment_intent: "pi_dep_" + sref, customer: "cus_test_1", customer_details: { email: "stage.two@example.com" } });
  const crew = outbox().filter((m) => m.to.includes("ewan@madmonkeyhostels.com")).pop();
  ok("the crew's email for a later stage says so, with where they start, where they have been and the earlier trip", !!crew && /^Stage 2 · /.test(crew.subject) && /Stage 2 of their journey/.test(text(crew)) && /Ho Chi Minh City/.test(text(crew)) && /Already been to Hanoi, Hoi An, Ho Chi Minh City/.test(text(crew)) && text(crew).includes(ref), crew && crew.subject);
  const view = await send("trip-builder-admin", { action: "view", ref: sref, password: "test-admin-pw" });
  ok("the crew's review page is given the stage too", view.b.summary?.stage?.n === 2 && view.b.summary.stage.parent === ref && view.b.summary.stage.been.length === 3);
  const junk = JSON.parse(JSON.stringify(sp)); junk.contact.email = "stage.junk@example.com"; junk.summary.stage = { n: "<b>", parent: "<img>", from: { id: 1, name: "<script>x</script>" }, been: ["<img src=x>"] };
  const jr = await send("trip-builder-request", junk); await handleTripBuilderPaid(sb, { metadata: { kind: "trip_builder_deposit", ref: jr.b.ref, origin: "https://madmonkeyhostels.com" }, payment_intent: "pi_dep_" + jr.b.ref, customer: "cus_test_1", customer_details: { email: "stage.junk@example.com" } });
  const jc = outbox().filter((m) => m.to.includes("ewan@madmonkeyhostels.com")).pop();
  ok("a made-up stage is printed as text, never as markup", !!jc && !/<script>x|<img src=x/.test(jc.html));
}

console.log(`\n${pass}/${pass + fail} checks passed`);
Deno.exit(fail ? 1 : 0);
