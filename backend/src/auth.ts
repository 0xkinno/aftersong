// Carer sign-in is a Supabase magic link. The web app sends the Supabase access token; this checks it
// with Supabase's own user endpoint. Nothing is trusted from the token without that call.
export interface AuthEnv {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  DEV_AUTH?: string;
}

export type AuthResult = { ok: true; userId: string; email: string | null } | { ok: false; status: number; message: string };

const cache = new Map<string, { at: number; userId: string; email: string | null }>();

export async function authenticate(env: AuthEnv, headers: Record<string, string | string[] | undefined>): Promise<AuthResult> {
  const dev = headers["x-dev-user"];
  if (env.DEV_AUTH === "on" && typeof dev === "string" && /^[a-z0-9-]{3,40}$/.test(dev)) return { ok: true, userId: dev, email: null };
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return { ok: false, status: 503, message: "Carer sign-in is not configured on this server yet." };
  const h = headers.authorization;
  const token = typeof h === "string" && h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!token) return { ok: false, status: 401, message: "Sign in with your email link first." };
  const hit = cache.get(token);
  if (hit && Date.now() - hit.at < 60000) return { ok: true, userId: hit.userId, email: hit.email };
  try {
    const res = await fetch(`${env.SUPABASE_URL.replace(/\/$/, "")}/auth/v1/user`, { headers: { apikey: env.SUPABASE_ANON_KEY, authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000) });
    if (!res.ok) return { ok: false, status: 401, message: "Your sign-in has expired. Request a new email link." };
    const u = (await res.json()) as { id?: string; email?: string };
    if (!u.id) return { ok: false, status: 401, message: "Your sign-in could not be read." };
    cache.set(token, { at: Date.now(), userId: u.id, email: u.email ?? null });
    return { ok: true, userId: u.id, email: u.email ?? null };
  } catch {
    return { ok: false, status: 503, message: "Sign-in service is not reachable right now." };
  }
}
