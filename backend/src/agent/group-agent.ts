// The room planner as an agent tool. The agent decides when to call plan_group_session and with which
// residents; the server computes the result. If no model is configured the same call is made with
// everyone listed, and the trail says so.
import type { GroupResult } from "./group.ts";
import type { Model, Msg, ToolDef } from "./model.ts";

export interface GroupAgentResident {
  id: string;
  firstName: string;
  birthYear: number;
}

export const GROUP_TOOLS: ToolDef[] = [
  {
    name: "plan_group_session",
    description: "Plan one session for a room. Give the ids of the residents who will be in the room (2 to 8). The server builds one pool from their years, re-scores it for each resident and keeps what works for the person it fits least.",
    schema: { type: "object", properties: { residentIds: { type: "array", items: { type: "string" } } }, required: ["residentIds"], additionalProperties: false },
  },
];

const SYSTEM = `You help a carer plan a group session. Call plan_group_session once with the ids of the residents who will be in the room. Use only the ids you are given. Do not choose any music, film or food yourself.`;

export interface GroupAgentResult {
  result: GroupResult;
  trail: Array<{ at: string; tool: string; summary: string }>;
  modelNote: string | null;
}

export async function runGroupAgent(deps: { model: Model | null }, residents: GroupAgentResident[], planFn: (ids: string[]) => Promise<GroupResult>): Promise<GroupAgentResult> {
  const trail: GroupAgentResult["trail"] = [];
  const note = (tool: string, summary: string) => trail.push({ at: new Date().toISOString(), tool, summary });
  const known = new Set(residents.map((r) => r.id));
  let result: GroupResult | null = null;
  let modelNote: string | null = null;

  const run = async (ids: string[], by: string) => {
    const clean = [...new Set(ids)].filter((id) => known.has(id));
    if (clean.length < 2 || clean.length > 8) return "ERROR: give 2 to 8 residents from the list.";
    result = await planFn(clean);
    note("plan_group_session", `${by} planned a room of ${clean.length}: ${result.plan.items.length} items, ${result.plan.excluded.length} dropped.`);
    return `planned ${result.plan.items.length} items for ${clean.length} residents`;
  };

  if (!deps.model) {
    modelNote = "No model is configured, so the room was planned for everyone listed.";
    note("agent", modelNote);
    await run(residents.map((r) => r.id), "The server");
  } else {
    const messages: Msg[] = [{ role: "user", text: `Residents in the room: ${residents.map((r) => `${r.id} (${r.firstName}, born ${r.birthYear})`).join("; ")}. Plan the session.` }];
    try {
      for (let i = 0; i < 4 && !result; i++) {
        const reply = await deps.model.complete(SYSTEM, messages, GROUP_TOOLS);
        messages.push({ role: "assistant", text: reply.text, toolCalls: reply.toolCalls });
        if (reply.toolCalls.length === 0) break;
        for (const c of reply.toolCalls) {
          const ids = Array.isArray(c.args.residentIds) ? (c.args.residentIds as unknown[]).map(String) : [];
          const out = c.name === "plan_group_session" ? await run(ids, "The agent") : "ERROR: unknown tool";
          messages.push({ role: "tool", callId: c.id, name: c.name, text: out });
        }
      }
    } catch (e) {
      if ((e as { name?: string }).name === "QlooError") throw e;
      console.error(`[model] unavailable: ${(e as Error).message}`);
      modelNote = "The model was unavailable, so the room was planned for everyone listed.";
      note("agent", modelNote);
    }
    if (!result) {
      modelNote ??= "The model did not call the planner. The room was planned for everyone listed.";
      if (!trail.some((t) => t.tool === "agent")) note("agent", modelNote);
      await run(residents.map((r) => r.id), "The server");
    }
  }
  return { result: result as unknown as GroupResult, trail, modelNote };
}
