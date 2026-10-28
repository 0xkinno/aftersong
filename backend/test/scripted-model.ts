import type { Model, Msg, ModelReply } from "../src/agent/model.ts";

/** A scripted stand-in model for tests and the offline fault switch report. */
export function scripted(): Model {
  let step = 0;
  const domains = ["music", "film", "tv", "food", "place"];
  return {
    provider: "scripted", id: "test",
    async complete(_s: string, messages: Msg[]): Promise<ModelReply> {
      const usage = { inputTokens: 1, outputTokens: 1 };
      const call = (name: string, args: Record<string, unknown>) => ({ text: "", toolCalls: [{ id: `c${step}`, name, args }], usage });
      const s = step++;
      if (s === 0) return call("resolve_favourites", {});
      if (s >= 1 && s <= 5) return call("find_era_items", { domain: domains[s - 1] });
      if (s === 6) return call("build_card", {});
      if (s === 7) {
        const last = [...messages].reverse().find((m) => m.role === "tool" && m.name === "build_card");
        const lines = (last && last.role === "tool" ? last.text : "").split("\n").filter((l) => l.includes(" | "));
        const openers = lines.map((l) => { const [id, , name] = l.split(" | "); return { entityId: id!, text: `Do you remember ${name}?` }; });
        return call("write_openers", { openers });
      }
      return { text: "done", toolCalls: [], usage };
    },
  };
}
