let n = 0;
export default class Stripe {
  constructor(_k: string, _o?: unknown) {}
  checkout = { sessions: { create: async (p: Record<string, unknown>) => {
    const id = "cs_test_" + (++n);
    const li = (p.line_items as { price_data: { unit_amount: number }; quantity: number }[])[0];
    const g = globalThis as unknown as { __checkouts?: unknown[] };
    (g.__checkouts ??= []).push({ id, amount: li.price_data.unit_amount / 100, qty: li.quantity, meta: p.metadata, customer: p.customer, email: p.customer_email, create: p.customer_creation, setup: (p.payment_intent_data as Record<string, unknown> | undefined)?.setup_future_usage });
    return { id, url: (Deno.env.get("CHECKOUT_BASE") ?? "https://checkout.stripe.test/pay/") + id };
  } } };
  paymentIntents = {
    retrieve: async (id: string) => ({ id, payment_method: "pm_test_1", customer: "cus_test_1" }),
    create: async (p: Record<string, unknown>, o?: { idempotencyKey?: string }) => {
      const g = globalThis as unknown as { __stripeFail?: boolean; __charges?: unknown[] };
      (g.__charges ??= []).push({ amount: (p.amount as number) / 100, customer: p.customer, pm: p.payment_method, meta: p.metadata, key: o?.idempotencyKey, off_session: p.off_session });
      if (g.__stripeFail) throw new Error("Your card was declined.");
      return { id: "pi_sched_" + (g.__charges as unknown[]).length, status: "succeeded" };
    },
  };
  refunds = { create: async (p: Record<string, unknown>) => { console.log("STRIPE refund", JSON.stringify(p)); return { id: "re_test_1", amount: 10000 }; } };
}
