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
for (const n of ["trip-builder-request", "trip-builder-admin", "trip-builder-status", "trip-builder-pay", "charge-trip-builder-payments"]) await load(n);

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
  const r = await send("trip-builder-request", p); const ref = r.b.ref;
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
  const rev = await send("trip-builder-admin", { action: "revise", ref, key: k, note: "Added a night in Hoi An.", trip: { link: "https://x.test/#/build/i=s.hanoi.4~s.hoi-an.5~s.saigon.3", route: "Hanoi → Hoi An → Ho Chi Minh City", days: 13, nights: 12, stops: ["hanoi", "hoi-an", "saigon"], countries: ["VN"], start: iso(new Date(Date.now() + 120 * 86400000)), estTotalUsd: 596 }, summary: { stops: [], budget: { tripCostAllPeople: 712 }, days: 13 }, crewText: "EDITED" });
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

console.log(`\n${pass}/${pass + fail} checks passed`);
Deno.exit(fail ? 1 : 0);
