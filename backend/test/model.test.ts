import test from "node:test";
import assert from "node:assert/strict";
import { ModelError, geminiModel, modelFromEnv, withFallback, type Model } from "../src/agent/model.ts";

const ok = (id: string): Model => ({ provider: "p", id, complete: async () => ({ text: id, toolCalls: [], usage: { inputTokens: 1, outputTokens: 1 } }) });
const down = (id: string, status = 429): Model => ({ provider: "p", id, complete: async () => { throw new ModelError("rate limit", status); } });

test("fallback moves to the next model on a rate limit and reports which one answered", async () => {
  const m = withFallback([down("a"), ok("b")]);
  assert.equal(m.id, "a");
  const r = await m.complete("", [], []);
  assert.equal(r.text, "b");
  assert.equal(m.id, "b");
});

test("fallback throws the last error when every model fails", async () => {
  await assert.rejects(() => withFallback([down("a"), down("b", 503)]).complete("", [], []), /rate limit/);
});

test("groq and gemini need only a key, and back up the primary", () => {
  assert.equal(modelFromEnv({}), null);
  const g = modelFromEnv({ GROQ_API_KEY: "k" });
  assert.equal(g?.provider, "groq");
  assert.equal(g?.id, "llama-3.3-70b-versatile");
  const both = modelFromEnv({ MODEL_PROVIDER: "openrouter", MODEL_ID: "x/y:free", OPENROUTER_API_KEY: "k", GROQ_API_KEY: "k", GEMINI_API_KEY: "k" });
  // a free-tier id is demoted: a credited key answers first
  assert.equal(both?.provider, "groq");
  const paid = modelFromEnv({ MODEL_PROVIDER: "openrouter", MODEL_ID: "x/y", OPENROUTER_API_KEY: "k", GROQ_API_KEY: "k" });
  assert.equal(paid?.provider, "openrouter");
  assert.equal(paid?.id, "x/y");
  assert.equal(modelFromEnv({ MODEL_PROVIDER: "openrouter", MODEL_ID: "x/y:free", OPENROUTER_API_KEY: "k" })?.id, "x/y:free");
  const gem = modelFromEnv({ MODEL_PROVIDER: "gemini", GEMINI_API_KEY: "k" });
  assert.equal(gem?.id, "gemini-2.5-flash");
});

test("gemini discovers a usable model when the configured and default ids are gone, and reads array error bodies", async () => {
  const seen: string[] = [];
  const real = globalThis.fetch;
  const gone = () => new Response(JSON.stringify([{ error: { message: "models/x is not found" } }]), { status: 404 });
  globalThis.fetch = (async (u: string, init?: { body?: string }) => {
    if (String(u).endsWith("/models")) return new Response(JSON.stringify({ data: [{ id: "models/gemini-3-flash" }, { id: "models/gemini-2.5-flash" }, { id: "models/gemini-3-pro" }] }), { status: 200 });
    const id = JSON.parse(init!.body!).model;
    seen.push(id);
    if (id === "gemini-3-flash") return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }], usage: {} }), { status: 200 });
    return gone();
  }) as unknown as typeof fetch;
  try {
    const m = geminiModel("k", "gemini-retired");
    assert.equal((await m.complete("", [], [])).text, "ok");
    assert.deepEqual(seen, ["gemini-retired", "gemini-2.5-flash", "gemini-3-flash"]);
    assert.equal(m.id, "gemini-3-flash");
    globalThis.fetch = (async () => new Response(JSON.stringify([{ error: { message: "API key not valid" } }]), { status: 403 })) as unknown as typeof fetch;
    await assert.rejects(() => geminiModel("k", undefined).complete("", [], []), /API key not valid/);
  } finally {
    globalThis.fetch = real;
  }
});

test("a model that hangs does not use up the time the next model needs", async () => {
  const hang: Model = { provider: "p", id: "hang", complete: (_s, _m, _t, signal) => new Promise((_, rej) => signal?.addEventListener("abort", () => rej(new ModelError("timed out")))) };
  const t0 = Date.now();
  // AbortSignal.timeout timers do not keep Node alive, so hold the loop open while the hung model waits for its limit.
  const keep = setInterval(() => {}, 20);
  let r;
  try {
    r = await withFallback([hang, ok("b")], 50).complete("", [], []);
  } finally {
    clearInterval(keep);
  }
  assert.equal(r.text, "b");
  assert.ok(Date.now() - t0 < 5000);
});
