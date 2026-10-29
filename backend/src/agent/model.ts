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
      if (!res.ok) throw new ModelError(`${provider} ${res.status}: ${body?.error?.message?.slice?.(0, 80) ?? "error"}`, res.status);
      const msg = body.choices?.[0]?.message ?? {};
      const calls: ToolCall[] = (msg.tool_calls ?? []).map((t: any) => {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(t.function?.arguments || "{}");
        } catch {
          args = {};
        }
        return { id: t.id, name: t.function?.name, args };
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
}

/** Returns null when no usable key is set, so callers can say so plainly. */
export function modelFromEnv(env: ModelEnv): Model | null {
  const p = (env.MODEL_PROVIDER || "").toLowerCase();
  const pick = p || (env.ANTHROPIC_API_KEY ? "anthropic" : env.OPENROUTER_API_KEY ? "openrouter" : env.NVIDIA_API_KEY ? "nvidia" : "");
  if (pick === "anthropic" && env.ANTHROPIC_API_KEY && env.MODEL_ID) return anthropicModel(env.ANTHROPIC_API_KEY, env.MODEL_ID);
  if (pick === "openrouter" && env.OPENROUTER_API_KEY && env.MODEL_ID) return openAiCompatModel("openrouter", "https://openrouter.ai/api/v1", env.OPENROUTER_API_KEY, env.MODEL_ID);
  if (pick === "nvidia" && env.NVIDIA_API_KEY && env.MODEL_ID) return openAiCompatModel("nvidia", "https://integrate.api.nvidia.com/v1", env.NVIDIA_API_KEY, env.MODEL_ID);
  return null;
}
