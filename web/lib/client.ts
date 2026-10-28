"use client";
import { getToken } from "./supabase";
import type { SessionCard, TrailEvent } from "./types";

async function headers(auth: boolean): Promise<Record<string, string>> {
  const h: Record<string, string> = { "content-type": "application/json" };
  if (auth) {
    const t = await getToken();
    if (t) h.authorization = `Bearer ${t}`;
  }
  return h;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function api<T>(path: string, init: { method?: string; body?: unknown; auth?: boolean } = {}): Promise<T> {
  const res = await fetch(`/api${path}`, { method: init.method ?? "GET", headers: await headers(init.auth ?? false), body: init.body === undefined ? undefined : JSON.stringify(init.body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? "Something went wrong.", data.code);
  return data as T;
}

export interface StreamHandlers {
  onTrail?: (e: TrailEvent) => void;
}

/** Reads the NDJSON stream a card build returns: trail lines, then one card or one error. */
export async function streamCard(path: string, body: unknown, auth: boolean, h: StreamHandlers = {}): Promise<{ card: SessionCard; modelNote: string | null; extra: Record<string, unknown> }> {
  const res = await fetch(`/api${path}`, { method: "POST", headers: await headers(auth), body: JSON.stringify(body ?? {}) });
  if (!res.ok && !res.body) throw new ApiError(res.status, "The server did not answer.");
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("ndjson")) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(res.status, data.error ?? "Something went wrong.", data.code);
  }
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let result: { card: SessionCard; modelNote: string | null; extra: Record<string, unknown> } | null = null;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line) continue;
      const e = JSON.parse(line);
      if (e.type === "trail") h.onTrail?.(e);
      else if (e.type === "error") throw new ApiError(e.status ?? 500, e.error, e.code);
      else if (e.type === "card") {
        const { type: _t, card, modelNote, ...extra } = e;
        result = { card, modelNote: modelNote ?? null, extra };
      }
    }
  }
  if (!result) throw new ApiError(500, "The build ended without a card.");
  return result;
}
