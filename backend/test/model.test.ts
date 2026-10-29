import test from "node:test";
import assert from "node:assert/strict";
import { ModelError, modelFromEnv, withFallback, type Model } from "../src/agent/model.ts";

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
  assert.equal(both?.provider, "openrouter");
  assert.equal(both?.id, "x/y:free");
  const gem = modelFromEnv({ MODEL_PROVIDER: "gemini", GEMINI_API_KEY: "k" });
  assert.equal(gem?.id, "gemini-2.5-flash");
});
