// A tiny in-memory stand-in for supabase-js, plus a catcher for outgoing emails. For local testing of the real Edge Functions.
const HERE = new URL(".", import.meta.url).pathname;
const DB: Record<string, Record<string, unknown>[]> = JSON.parse(Deno.readTextFileSync(HERE + "seed.json"));
const TAG = Deno.env.get("MOCK_TAG") ?? "";
const save = () => Deno.writeTextFileSync(HERE + `db${TAG}.json`, JSON.stringify(DB, null, 1));
const OUT: unknown[] = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: Request | URL | string, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (url.startsWith("https://api.resend.com/")) {
    OUT.push(JSON.parse(String(init?.body)));
    Deno.writeTextFileSync(HERE + `outbox${TAG}.json`, JSON.stringify(OUT, null, 1));
    return new Response(JSON.stringify({ id: "re_fake_" + OUT.length }), { status: 200 });
  }
  if (url.includes("fake.supabase.test")) return new Response("", { status: 201 });
  return realFetch(input as string, init);
}) as typeof fetch;

class Q implements PromiseLike<{ data: unknown; error: unknown }> {
  op = "select"; filters: [string, unknown][] = []; patch: Record<string, unknown> = {}; row: Record<string, unknown> = {}; single = false;
  constructor(private t: string) { DB[t] ??= []; }
  sel = false;
  select(_c?: string, _o?: unknown) { this.sel = true; return this; }
  eq(k: string, v: unknown) { this.filters.push([k, v]); return this; }
  in(k: string, vs: unknown[]) { this.filters.push([k, (x: unknown) => vs.includes(x)]); return this; }
  is(k: string, v: unknown) { this.filters.push([k, (x: unknown) => (x ?? null) === v]); return this; }
  like(_k: string, _v: unknown) { return this; }
  gte(_k: string, _v: unknown) { return this; }
  order(_k?: string, _o?: unknown) { return this; }
  limit(_n: number) { return this; }
  upsert(r: Record<string, unknown>, _o?: unknown) { this.op = "upsert"; this.row = r; return this; }
  update(p: Record<string, unknown>) { this.op = "update"; this.patch = p; return this; }
  insert(r: Record<string, unknown>) { this.op = "insert"; this.row = r; return this; }
  maybeSingle() { this.single = true; return this; }
  private match() { return DB[this.t].filter((r) => this.filters.every(([k, v]) => (typeof v === "function" ? (v as (x: unknown) => boolean)(r[k]) : r[k] === v))); }
  then<T>(res?: (v: { data: unknown; error: unknown }) => T) {
    let out: { data: unknown; error: unknown };
    if (this.op === "update") { const hit = this.match(); hit.forEach((r) => Object.assign(r, this.patch)); save(); out = { data: this.sel ? structuredClone(hit) : null, error: null }; }
    else if (this.op === "upsert") { const ex = DB[this.t].find((r) => r.ref === this.row.ref); if (ex) Object.assign(ex, this.row); else DB[this.t].push(this.row); save(); out = { data: null, error: null }; }
    else if (this.op === "insert") { DB[this.t].push(this.row); save(); out = { data: null, error: null }; }
    else { const m = this.match(); out = { data: this.single ? (m[0] ? structuredClone(m[0]) : null) : structuredClone(m), error: null }; }
    return Promise.resolve(out).then(res as never);
  }
}
// The chat's daily counters (trip_builder_chat_hit): counts per bucket, true while under the limit. The e2e can make it fail with __chatRpcFail.
const CHAT_HITS: Record<string, number> = {};
export function createClient(_u: string, _k: string) {
  return {
    from: (t: string) => new Q(t),
    rpc: async (name: string, args?: Record<string, unknown>) => {
      if (name === "trip_builder_chat_hit") {
        if ((globalThis as { __chatRpcFail?: boolean }).__chatRpcFail) return { data: null, error: { message: "relation does not exist" } };
        const b = String(args?.p_bucket); CHAT_HITS[b] = (CHAT_HITS[b] ?? 0) + 1;
        return { data: CHAT_HITS[b] <= Number(args?.p_limit), error: null };
      }
      return { data: name === "get_cron_secret" ? "cron-secret-for-tests" : null, error: null };
    },
  };
}
export const __chatHits = CHAT_HITS;
export const __db = DB;
