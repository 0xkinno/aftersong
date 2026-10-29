// Runs the real MCP server over stdio against a small stand-in for the Aftersong API. The stand-in
// returns invented data, so this checks the plumbing, not Qloo.
import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const card = { id: "card-syn", window: { start: 1950, end: 1970 }, status: "ok", items: [{ domain: "film", year: 1960, name: "Synthetic Film", label: "personal", connectedTo: { name: "Synthetic Favourite" }, opener: { text: "Do you remember Synthetic Film?" } }], decisions: [{ decision: "route_signals", why: "Synthetic routing note." }] };

function api() {
  const seen = [];
  const s = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      seen.push({ method: req.method, url: req.url, auth: req.headers.authorization ?? null, body });
      if (req.url.startsWith("/api/sample/residents/") && req.method === "POST") {
        res.writeHead(200, { "content-type": "application/x-ndjson" });
        return res.end(JSON.stringify({ type: "trail", tool: "find_era_items", summary: "film: 10 candidates" }) + "\n" + JSON.stringify({ type: "card", card }) + "\n");
      }
      if (req.url.includes("/observations")) {
        if (!req.headers.authorization) { res.writeHead(401, { "content-type": "application/json" }); return res.end(JSON.stringify({ error: "Sign in with your email link first." })); }
        res.writeHead(200, { "content-type": "application/json" });
        return res.end(JSON.stringify({ value: "lit_up", entityName: "Synthetic Film" }));
      }
      res.writeHead(404, { "content-type": "application/json" });
      res.end("{}");
    });
  });
  return new Promise((resolve) => s.listen(0, "127.0.0.1", () => resolve({ s, seen, port: s.address().port })));
}

async function connect(port, token) {
  const transport = new StdioClientTransport({ command: process.execPath, args: [new URL("../server.mjs", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")], env: { ...process.env, AFTERSONG_URL: `http://127.0.0.1:${port}`, ...(token ? { AFTERSONG_TOKEN: token } : { AFTERSONG_TOKEN: "" }) } });
  const client = new Client({ name: "test", version: "0" });
  await client.connect(transport);
  return client;
}

test("the server lists three tools and builds a sample card with no token", async () => {
  const { s, seen, port } = await api();
  const client = await connect(port);
  try {
    const tools = (await client.listTools()).tools.map((t) => t.name).sort();
    assert.deepEqual(tools, ["build_session_card", "log_observation", "plan_group_session"]);
    const r = await client.callTool({ name: "build_session_card", arguments: { residentId: "sample-walter" } });
    const t = r.content[0].text;
    assert.match(t, /Session card card-syn, years 1950 to 1970, 1 items/);
    assert.match(t, /because of Synthetic Favourite/);
    assert.match(t, /Decision, route signals/);
    assert.equal(seen[0].auth, null, "a sample build needs no token");
  } finally {
    await client.close();
    s.close();
  }
});

test("a carer tool without a token is refused in plain words, and with a token passes it through", async () => {
  const { s, seen, port } = await api();
  const noTok = await connect(port);
  try {
    const r = await noTok.callTool({ name: "log_observation", arguments: { cardId: "card-syn", entityId: "SYN-1", value: "lit_up" } });
    assert.equal(r.isError, true);
    assert.match(r.content[0].text, /Sign in with your email link/);
  } finally {
    await noTok.close();
  }
  const withTok = await connect(port, "carer-token");
  try {
    const r = await withTok.callTool({ name: "log_observation", arguments: { cardId: "card-syn", entityId: "SYN-1", value: "lit_up" } });
    assert.match(r.content[0].text, /Logged lit_up for Synthetic Film/);
    assert.equal(seen.at(-1).auth, "Bearer carer-token");
    const bad = await withTok.callTool({ name: "log_observation", arguments: { cardId: "c", entityId: "e", value: "loved_it" } }).catch((e) => ({ isError: true, content: [{ text: String(e.message) }] }));
    assert.equal(bad.isError, true, "an unknown reaction is refused by the schema");
  } finally {
    await withTok.close();
    s.close();
  }
});
