// One small storage interface with two backends. Supabase is the real one; the file store is for
// local development and tests, and the status endpoint reports which one is running.
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";

export interface Meta {
  homeId?: string | null;
  residentId?: string | null;
}
export interface Filter {
  homeId?: string;
  residentId?: string;
}
export interface Store {
  kind: "file" | "supabase";
  get<T>(col: string, id: string): Promise<T | null>;
  put(col: string, id: string, row: unknown, meta?: Meta): Promise<void>;
  /** Create-only claim: true when this call created the row. */
  putIfAbsent(col: string, id: string, row: unknown, meta?: Meta): Promise<boolean>;
  list<T>(col: string, filter?: Filter): Promise<T[]>;
  delete(col: string, id: string): Promise<void>;
}

interface Rec {
  col: string;
  id: string;
  homeId: string | null;
  residentId: string | null;
  data: unknown;
  at: string;
}

export class FileStore implements Store {
  kind = "file" as const;
  private rows = new Map<string, Rec>();
  private chain: Promise<void> = Promise.resolve();
  private path: string | null;
  constructor(path: string | null) {
    this.path = path;
    if (path && existsSync(path)) {
      for (const r of JSON.parse(readFileSync(path, "utf8")) as Rec[]) this.rows.set(`${r.col}/${r.id}`, r);
    }
  }
  private flush() {
    if (!this.path) return;
    const p = this.path;
    const snapshot = JSON.stringify([...this.rows.values()]);
    this.chain = this.chain.then(() => {
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, snapshot);
    });
  }
  async get<T>(col: string, id: string) {
    return (this.rows.get(`${col}/${id}`)?.data as T | undefined) ?? null;
  }
  async put(col: string, id: string, row: unknown, meta: Meta = {}) {
    this.rows.set(`${col}/${id}`, { col, id, homeId: meta.homeId ?? null, residentId: meta.residentId ?? null, data: structuredClone(row), at: new Date().toISOString() });
    this.flush();
  }
  async putIfAbsent(col: string, id: string, row: unknown, meta: Meta = {}) {
    if (this.rows.has(`${col}/${id}`)) return false;
    await this.put(col, id, row, meta);
    return true;
  }
  async list<T>(col: string, f: Filter = {}) {
    return [...this.rows.values()]
      .filter((r) => r.col === col && (!f.homeId || r.homeId === f.homeId) && (!f.residentId || r.residentId === f.residentId))
      .sort((a, b) => a.at.localeCompare(b.at))
      .map((r) => structuredClone(r.data) as T);
  }
  async delete(col: string, id: string) {
    this.rows.delete(`${col}/${id}`);
    this.flush();
  }
  async settled() {
    await this.chain;
  }
}

/** PostgREST over fetch. Table and policies are in supabase/schema.sql. Uses the service role key. */
export class SupabaseStore implements Store {
  kind = "supabase" as const;
  private url: string;
  private key: string;
  constructor(url: string, key: string) {
    this.url = url;
    this.key = key;
  }
  private h(extra: Record<string, string> = {}) {
    return { apikey: this.key, authorization: `Bearer ${this.key}`, "content-type": "application/json", ...extra };
  }
  private async call(path: string, init: RequestInit = {}) {
    const res = await fetch(`${this.url}/rest/v1/${path}`, { ...init, signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`storage ${res.status}`);
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }
  async get<T>(col: string, id: string) {
    const r = (await this.call(`records?collection=eq.${encodeURIComponent(col)}&id=eq.${encodeURIComponent(id)}&select=data`, { headers: this.h() })) as Array<{ data: T }>;
    return r[0]?.data ?? null;
  }
  private body(col: string, id: string, row: unknown, meta: Meta) {
    return JSON.stringify({ collection: col, id, home_id: meta.homeId ?? null, resident_id: meta.residentId ?? null, data: row });
  }
  async put(col: string, id: string, row: unknown, meta: Meta = {}) {
    await this.call("records?on_conflict=collection,id", { method: "POST", headers: this.h({ Prefer: "resolution=merge-duplicates,return=minimal" }), body: this.body(col, id, row, meta) });
  }
  async putIfAbsent(col: string, id: string, row: unknown, meta: Meta = {}) {
    const r = (await this.call("records?on_conflict=collection,id", { method: "POST", headers: this.h({ Prefer: "resolution=ignore-duplicates,return=representation" }), body: this.body(col, id, row, meta) })) as unknown[] | null;
    return Array.isArray(r) && r.length > 0;
  }
  async list<T>(col: string, f: Filter = {}) {
    let q = `records?collection=eq.${encodeURIComponent(col)}&select=data&order=created_at.asc`;
    if (f.homeId) q += `&home_id=eq.${encodeURIComponent(f.homeId)}`;
    if (f.residentId) q += `&resident_id=eq.${encodeURIComponent(f.residentId)}`;
    const r = (await this.call(q, { headers: this.h() })) as Array<{ data: T }>;
    return r.map((x) => x.data);
  }
  async delete(col: string, id: string) {
    await this.call(`records?collection=eq.${encodeURIComponent(col)}&id=eq.${encodeURIComponent(id)}`, { method: "DELETE", headers: this.h() });
  }
}

export function storeFromEnv(env: Record<string, string | undefined>, dataPath: string): Store {
  if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) return new SupabaseStore(env.SUPABASE_URL.replace(/\/$/, ""), env.SUPABASE_SERVICE_ROLE_KEY);
  return new FileStore(dataPath);
}
