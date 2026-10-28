// Reports what real probes returned in this request. Nothing here is hard-coded as healthy.
export const dynamic = "force-dynamic";

type BackendResult =
  | { reachable: true; httpStatus: number; latencyMs: number; at: string; body: unknown }
  | { reachable: false; at: string; detail: string };

async function probeBackend(): Promise<BackendResult> {
  const base = process.env.BACKEND_URL;
  const at = new Date().toISOString();
  if (!base) return { reachable: false, at, detail: "BACKEND_URL is not set on the web app" };
  const started = Date.now();
  try {
    const res = await fetch(new URL("/status", base), {
      headers: { "x-shared-secret": process.env.BACKEND_SHARED_SECRET ?? "" },
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    const body = await res.json().catch(() => null);
    return { reachable: true, httpStatus: res.status, latencyMs: Date.now() - started, at, body };
  } catch (err) {
    return { reachable: false, at, detail: `request failed: ${(err as Error).name}` };
  }
}

export async function GET() {
  const backend = await probeBackend();
  return Response.json(
    { service: "aftersong-web", at: new Date().toISOString(), backend },
    { headers: { "cache-control": "no-store" } },
  );
}
