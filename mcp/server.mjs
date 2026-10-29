// Aftersong MCP server (stdio, official MCP SDK). Exposes the same backend the web app uses, so any
// MCP client, for example Claude Desktop, can build a session card, log what the carer saw, and plan a
// group session. It holds no Qloo key and no rules of its own: every request goes to the Aftersong web
// app's /api door, where the rules and the allowlist run.
//
// Environment:
//   AFTERSONG_URL    base address of the deployed web app, for example https://aftersong.example (no trailing slash)
//   AFTERSONG_TOKEN  a carer's Supabase access token, for carer tools. Sample residents need none.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE = (process.env.AFTERSONG_URL ?? "http://localhost:3000").replace(/\/$/, "");
const TOKEN = process.env.AFTERSONG_TOKEN ?? "";

const headers = (auth) => ({ "content-type": "application/json", ...(auth && TOKEN ? { authorization: `Bearer ${TOKEN}` } : {}) });

async function call(path, { method = "GET", body, auth = false } = {}) {
  const res = await fetch(`${BASE}/api${path}`, { method, headers: headers(auth), body: body === undefined ? undefined : JSON.stringify(body) });
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("ndjson")) {
    let card = null;
    let failure = null;
    const trail = [];
    for (const line of (await res.text()).split("\n")) {
      if (!line.trim()) continue;
      const e = JSON.parse(line);
      if (e.type === "trail") trail.push(`${e.tool}: ${e.summary}`);
      else if (e.type === "card") card = e.card;
      else if (e.type === "error") failure = e;
    }
    if (failure) throw new Error(failure.error);
    return { card, trail };
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Aftersong answered ${res.status}`);
  return data;
}

const text = (t) => ({ content: [{ type: "text", text: t }] });
const fail = (e) => ({ isError: true, content: [{ type: "text", text: `Aftersong could not do that: ${e.message}` }] });

const summarise = (card) =>
  [
    `Session card ${card.id}, years ${card.window.start} to ${card.window.end}, ${card.items.length} items${card.status === "thin" ? " (not enough from these years yet)" : ""}.`,
    ...card.items.map((i, n) => `${n + 1}. [${i.domain}${i.year ? " " + i.year : ""}] ${i.name} (${i.label.replace("_", " ")}) because of ${i.connectedTo.name}. Ask: "${i.opener.text}"`),
    ...(card.decisions ?? []).map((d) => `Decision, ${d.decision.replace(/_/g, " ")}: ${d.why}`),
  ].join("\n");

export function buildServer() {
  const server = new McpServer({ name: "aftersong", version: "0.1.0" });

  server.registerTool(
    "build_session_card",
    {
      title: "Build a session card",
      description: "Build a reminiscence session card for one resident from the years they remember best. Items come from Qloo and are checked by rules in code. Use a sample resident id such as sample-walter without a token, or a carer's resident id with AFTERSONG_TOKEN set.",
      inputSchema: { residentId: z.string().min(1).describe("Resident id, for example sample-walter"), widenByYears: z.number().int().min(0).max(10).optional().describe("Only after the carer agreed to widen the window") },
    },
    async ({ residentId, widenByYears }) => {
      try {
        const sample = residentId.startsWith("sample-");
        const r = sample ? await call(`/sample/residents/${encodeURIComponent(residentId)}/card`, { method: "POST", body: {} }) : await call(`/residents/${encodeURIComponent(residentId)}/cards`, { method: "POST", body: { widenBy: widenByYears ?? 0 }, auth: true });
        return text(summarise(r.card));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "log_observation",
    {
      title: "Log what the carer saw",
      description: "Record one reaction to one item on a card. Only a carer's tap becomes memory. Values: lit_up, sang_or_moved, talked, no_response, upset, skipped. An upset item is never shown to that resident again.",
      inputSchema: { cardId: z.string().min(1), entityId: z.string().min(1), value: z.enum(["lit_up", "sang_or_moved", "talked", "no_response", "upset", "skipped"]), note: z.string().max(280).optional() },
    },
    async ({ cardId, entityId, value, note }) => {
      try {
        const o = await call(`/cards/${encodeURIComponent(cardId)}/observations`, { method: "POST", body: { entityId, value, note: note ?? null }, auth: true });
        return text(`Logged ${o.value} for ${o.entityName}.`);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "plan_group_session",
    {
      title: "Plan a group session",
      description: "Plan one session for a room of 2 to 8 residents. One pool is built from all their years, re-scored for each resident, and the items that work for the person they fit least are kept. An item one resident was upset by is dropped.",
      inputSchema: { residentIds: z.array(z.string().min(1)).min(2).max(8) },
    },
    async ({ residentIds }) => {
      try {
        const sample = residentIds.every((id) => id.startsWith("sample-"));
        const r = await call(sample ? "/sample/group" : "/group", { method: "POST", body: { residentIds }, auth: !sample });
        const items = r.plan.items.map((i, n) => `${n + 1}. [${i.candidate.domain}${i.candidate.year ? " " + i.candidate.year : ""}] ${i.candidate.name}, weakest fit ${Math.round(i.minScore * 100)}`);
        const left = r.plan.coverage.filter((c) => c.leftOut).map((c) => c.firstName);
        return text([`Group plan: ${r.plan.items.length} items for ${residentIds.length} residents.`, ...items, left.length ? `Left out: ${left.join(", ")}.` : "Nobody is left out.", r.explanation?.line ?? ""].filter(Boolean).join("\n"));
      } catch (e) {
        return fail(e);
      }
    },
  );

  return server;
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}` || process.argv[1]?.endsWith("server.mjs")) {
  const server = buildServer();
  await server.connect(new StdioServerTransport());
}
