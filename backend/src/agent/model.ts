// Model adapters over fetch: Anthropic Messages, and OpenAI-compatible chat (OpenRouter, NVIDIA).
// The agent only needs: messages in, text and tool calls out.
export interface ToolDef {
  name: string;
  description: string;
  schema: Record<string, unknown>;
}
export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}
export type Msg =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; toolCalls: ToolCall[] }
  | { role: "tool"; callId: string; name: string; text: string };

export interface ModelReply {
  text: string;
  toolCalls: ToolCall[];
  usage: { inputTokens: number; outputTokens: number };
}

export interface Model {
  provider: string;
  id: string;
  complete(system: string, messages: Msg[], tools: ToolDef[], signal?: AbortSignal): Promise<ModelReply>;
}

export class ModelError extends Error {
  status: number | null;
  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = "ModelError";
    this.status = status;
  }
}

const j = async (res: Response) => {
  const text = await res.text();
  try {
    return JSON.parse(text) as Record<string, any>;
  } catch {
    throw new ModelError(`model returned a non-JSON body (${res.status})`, res.status);
  }
};

export function anthropicModel(key: string, id: string): Model {
  return {
    provider: "anthropic",
    id,
    async complete(system, messages, tools, signal) {
      const out: any[] = [];
      for (const m of messages) {
        if (m.role === "user") out.push({ role: "user", content: m.text });
        else if (m.role === "assistant") {
          out.push({ role: "assistant", content: [...(m.text ? [{ type: "text", text: m.text }] : []), ...m.toolCalls.map((t) => ({ type: "tool_use", id: t.id, name: t.name, input: t.args }))] });
        } else {
          const last = out[out.length - 1];
          const block = { type: "tool_result", tool_use_id: m.callId, content: m.text };
          if (last && last.role === "user" && Array.isArray(last.content)) last.content.push(block);
          else out.push({ role: "user", content: [block] });
        }
      }
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: id, max_tokens: 6000, system, messages: out, tools: tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.schema })) }),
        signal: signal ?? AbortSignal.timeout(60000),
      });
      const body = await j(res);
      if (!res.ok) throw new ModelError(`anthropic ${res.status}: ${body?.error?.type ?? "error"}`, res.status);
      const content: any[] = body.content ?? [];
      return {
        text: content.filter((c) => c.type === "text").map((c) => c.text).join("\n"),
        toolCalls: content.filter((c) => c.type === "tool_use").map((c) => ({ id: c.id, name: c.name, args: c.input ?? {} })),
        usage: { inputTokens: body.usage?.input_tokens ?? 0, outputTokens: body.usage?.output_tokens ?? 0 },
      };
    },
  };
}

export function openAiCompatModel(provider: string, baseUrl: string, key: string, id: string): Model {
  return {
    provider,
    id,
    async complete(system, messages, tools, signal) {
      const out: any[] = [{ role: "system", content: system }];
      for (const m of messages) {
        if (m.role === "user") out.push({ role: "user", content: m.text });
        else if (m.role === "assistant") {
          out.push({ role: "assistant", content: m.text || null, ...(m.toolCalls.length ? { tool_calls: m.toolCalls.map((t) => ({ id: t.id, type: "function", function: { name: t.name, arguments: JSON.stringify(t.args) } })) } : {}) });
        } else out.push({ role: "tool", tool_call_id: m.callId, content: m.text });
      }
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: id, max_tokens: 6000, messages: out, ...(tools.length ? { tools: tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.schema } })) } : {}) }),
        signal: signal ?? AbortSignal.timeout(60000),
      });
      const body = await j(res);
      // Gemini returns its error body as an array; the others return an object.
      if (!res.ok) throw new ModelError(`${provider} ${res.status} (${id}): ${String((Array.isArray(body) ? body[0] : body)?.error?.message ?? "error").slice(0, 80)}`, res.status);
      const msg = body.choices?.[0]?.message ?? {};
      let calls_i = 0;
      const calls: ToolCall[] = (msg.tool_calls ?? []).map((t: any) => {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(t.function?.arguments || "{}");
        } catch {
          args = {};
        }
        return { id: t.id || `call_${calls_i++}`, name: t.function?.name, args };
      });
      return { text: msg.content ?? "", toolCalls: calls, usage: { inputTokens: body.usage?.prompt_tokens ?? 0, outputTokens: body.usage?.completion_tokens ?? 0 } };
    },
  };
}

export interface ModelEnv {
  MODEL_PROVIDER?: string;
  MODEL_ID?: string;
  ANTHROPIC_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  NVIDIA_API_KEY?: string;
  GROQ_API_KEY?: string;
  GROQ_MODEL_ID?: string;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL_ID?: string;
}

const BASES = { openrouter: "https://openrouter.ai/api/v1", nvidia: "https://integrate.api.nvidia.com/v1", groq: "https://api.groq.com/openai/v1", gemini: "https://generativelanguage.googleapis.com/v1beta/openai" } as const;
const DEFAULT_IDS = { groq: "llama-3.3-70b-versatile", gemini: "gemini-2.5-flash" } as const;

/**
 * Free-tier model ids are retired often. Tries the configured and default ids; when they are gone or the service is overloaded,
 * asks the provider which models this key can use now and tries the best few. A bad key or other error is thrown at once.
 */
export function discoveringModel(provider: string, baseUrl: string, key: string, ids: Array<string | undefined>, pick: (all: string[]) => string[]): Model {
  const first = [...new Set(ids.filter((x): x is string => !!x))];
  let models = first.map((x) => openAiCompatModel(provider, baseUrl, key, x));
  let current = models[0];
  let discovered = false;
  const retryable = (e: unknown) => e instanceof ModelError && [400, 404, 429, 500, 503].includes(e.status ?? 0);
  const discover = async (): Promise<Model[]> => {
    try {
      const res = await fetch(`${baseUrl}/models`, { headers: { authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15000) });
      const body = (await res.json()) as { data?: Array<{ id: string }> };
      const all = (body.data ?? []).map((m) => m.id.replace(/^models\//, ""));
      return pick(all).slice(0, 3).map((x) => openAiCompatModel(provider, baseUrl, key, x));
    } catch {
      return [];
    }
  };
  return {
    get provider() { return current.provider; },
    get id() { return current.id; },
    async complete(system, messages, tools, signal) {
      let last: unknown = null;
      for (let round = 0; round < 2; round++) {
        for (const m of models) {
          try {
            const own = AbortSignal.timeout(20000);
            const r = await m.complete(system, messages, tools, signal ? AbortSignal.any([own, signal]) : own);
            current = m;
            return r;
          } catch (e) {
            last = e;
            if (signal?.aborted || !(retryable(e) || (e as Error).name === "TimeoutError")) throw e;
          }
        }
        if (discovered) break;
        discovered = true;
        const found = await discover();
        if (!found.length) break;
        models = found;
      }
      throw last;
    },
  };
}

const flashIds = (all: string[]) => all.filter((n) => /^gemini-[\d.]+-flash$/.test(n)).sort((a, b) => parseFloat(b.split("-")[1]) - parseFloat(a.split("-")[1]));
const groqIds = (all: string[]) => all.filter((n) => /^(llama|openai\/gpt-oss|qwen|moonshot|meta-llama)/.test(n) && !/guard|whisper|tts|prompt/i.test(n)).sort((a, b) => (/70b|120b|large/.test(b) ? 1 : 0) - (/70b|120b|large/.test(a) ? 1 : 0));

export function geminiModel(key: string, id: string | undefined): Model {
  return discoveringModel("gemini", BASES.gemini, key, [id, DEFAULT_IDS.gemini], flashIds);
}

/** One provider by name, or null when its key (or, where there is no default, its model id) is missing. */
function one(name: string, env: ModelEnv, id: string | undefined): Model | null {
  if (name === "anthropic") return env.ANTHROPIC_API_KEY && id ? anthropicModel(env.ANTHROPIC_API_KEY, id) : null;
  if (name === "openrouter") return env.OPENROUTER_API_KEY && id ? openAiCompatModel(name, BASES.openrouter, env.OPENROUTER_API_KEY, id) : null;
  if (name === "nvidia") return env.NVIDIA_API_KEY && id ? openAiCompatModel(name, BASES.nvidia, env.NVIDIA_API_KEY, id) : null;
  if (name === "groq") return env.GROQ_API_KEY ? discoveringModel("groq", BASES.groq, env.GROQ_API_KEY, [id, DEFAULT_IDS.groq], groqIds) : null;
  if (name === "gemini") return env.GEMINI_API_KEY ? geminiModel(env.GEMINI_API_KEY, id) : null;
  return null;
}

/** Tries each model in order. A failure (rate limit, outage, bad key, timeout) moves to the next; the last error is thrown if all fail. */
export function withFallback(models: Model[]): Model {
  let current = models[0];
  let stickUntil = 0;
  return {
    get provider() {
      return current.provider;
    },
    get id() {
      return current.id;
    },
    async complete(system, messages, tools, signal) {
      let last: unknown = null;
      const errs: string[] = [];
      // After a fallback answered, start with it for ten minutes so a dead primary does not cost its full wait on every call.
      const order = Date.now() < stickUntil ? [current, ...models.filter((x) => x !== current)] : models;
      for (const [i, m] of order.entries()) {
        // A model that hangs must not use up the time the next one needs, so every model but the last gets its own limit.
        const own = i < order.length - 1 ? AbortSignal.timeout(25000) : undefined;
        const sig = own && signal ? AbortSignal.any([own, signal]) : (own ?? signal);
        try {
          const r = await m.complete(system, messages, tools, sig);
          current = m;
          stickUntil = m === models[0] ? 0 : Date.now() + 10 * 60 * 1000;
          return r;
        } catch (e) {
          last = e;
          errs.push(`${m.provider}: ${(e as Error).message}`.slice(0, 110));
          if (signal?.aborted) throw e;
        }
      }
      throw last instanceof ModelError ? new ModelError(errs.join(" | "), last.status) : last;
    },
  };
}

/**
 * The primary model comes from MODEL_PROVIDER and MODEL_ID. Every other provider that has a key becomes a
 * fallback, in this order: anthropic, openrouter, nvidia, groq, gemini. Groq and Gemini need only a key.
 * Returns null when no usable key is set, so callers can say so plainly.
 */
export function modelFromEnv(env: ModelEnv): Model | null {
  const order = ["anthropic", "openrouter", "nvidia", "groq", "gemini"];
  const p = (env.MODEL_PROVIDER || "").toLowerCase();
  const own = (name: string) => (name === "groq" ? env.GROQ_MODEL_ID : name === "gemini" ? env.GEMINI_MODEL_ID : undefined);
  const primary = p ? one(p, env, env.MODEL_ID || own(p)) : null;
  const rest: Model[] = [];
  for (const name of order) {
    if (name === p) continue;
    // a provider without its own model id (anthropic, openrouter, nvidia) can only back up when MODEL_ID names it, so groq and gemini are the natural fallbacks
    const m = one(name, env, own(name) ?? (p ? undefined : env.MODEL_ID));
    if (m) rest.push(m);
  }
  const all = primary ? [primary, ...rest] : rest;
  if (!all.length) return null;
  return all.length === 1 ? all[0] : withFallback(all);
}
