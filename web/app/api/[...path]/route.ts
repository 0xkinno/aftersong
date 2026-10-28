// Single door to the backend. The browser never sees the backend URL, the shared secret or the Qloo key.
// Only these prefixes are forwarded. Authorization (the carer's sign-in token) is passed through.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ALLOWED = new Set(["sample", "try", "residents", "cards", "group", "family", "stats", "trace"]);

async function forward(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  if (!ALLOWED.has(path[0] ?? "")) return Response.json({ error: "Not found." }, { status: 404 });
  const base = process.env.BACKEND_URL;
  if (!base) return Response.json({ error: "The backend address is not configured on the web app." }, { status: 503 });
  const url = new URL(req.url);
  const target = new URL(`/${path.map(encodeURIComponent).join("/")}${url.search}`, base);
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || "unknown";
  const headers: Record<string, string> = { "x-shared-secret": process.env.BACKEND_SHARED_SECRET ?? "", "x-visitor-ip": ip, "content-type": req.headers.get("content-type") ?? "application/json" };
  const auth = req.headers.get("authorization");
  if (auth) headers.authorization = auth;
  try {
    const res = await fetch(target, {
      method: req.method,
      headers,
      body: req.method === "GET" || req.method === "DELETE" ? undefined : await req.text(),
      cache: "no-store",
      signal: AbortSignal.timeout(58000),
    });
    return new Response(res.body, { status: res.status, headers: { "content-type": res.headers.get("content-type") ?? "application/json", "cache-control": "no-store" } });
  } catch {
    return Response.json({ error: "The backend did not answer. It may be waking up; try again in a minute." }, { status: 503 });
  }
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const DELETE = forward;
