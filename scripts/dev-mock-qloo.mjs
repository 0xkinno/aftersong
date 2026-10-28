// DEV ONLY. Serves the synthetic Qloo stand-in on localhost so the UI can be checked without a key.
// Everything it returns is invented. Never point a deployed service at it, never use its output as a result.
import { createServer } from "node:http";
import { mockQloo } from "../backend/test/mock-qloo.ts";

const port = Number(process.env.MOCK_PORT || 9999);
createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  const r = await mockQloo(url, { headers: {}, signal: AbortSignal.timeout(5000) });
  res.writeHead(r.status, { "content-type": "application/json" });
  res.end(JSON.stringify(await r.json()));
}).listen(port, "127.0.0.1", () => console.log(`SYNTHETIC Qloo stand-in on ${port}`));
