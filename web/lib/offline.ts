"use client";
// Session mode works offline once loaded. The current card is kept on the phone, and reactions that
// could not be sent wait in a queue and are sent when the connection comes back.
const QUEUE = "aftersong-queue-v1";
const CARD = "aftersong-card-v1-";

export interface Queued {
  id: string;
  path: string;
  body: unknown;
  auth: boolean;
  at: string;
}

const safe = <T,>(fn: () => T, fallback: T): T => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};

export const readQueue = (): Queued[] => safe(() => JSON.parse(localStorage.getItem(QUEUE) ?? "[]") as Queued[], []);
const writeQueue = (q: Queued[]) => safe(() => localStorage.setItem(QUEUE, JSON.stringify(q)), undefined);

export function enqueue(path: string, body: unknown, auth: boolean): number {
  const q = readQueue();
  q.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, path, body, auth, at: new Date().toISOString() });
  writeQueue(q);
  return q.length;
}

/** A failed fetch (no connection) throws a TypeError. A server answer, even an error, does not. */
export const isNetworkError = (e: unknown): boolean => e instanceof TypeError;

let running: Promise<{ sent: number; left: number; rejected: number }> | null = null;

/** One flush at a time, so two online events can never send the same reaction twice. */
export function flush(send: (q: Queued) => Promise<void>): Promise<{ sent: number; left: number; rejected: number }> {
  if (!running) running = doFlush(send).finally(() => { running = null; });
  return running;
}

async function doFlush(send: (q: Queued) => Promise<void>): Promise<{ sent: number; left: number; rejected: number }> {
  const q = readQueue();
  let sent = 0;
  let rejected = 0;
  const left: Queued[] = [];
  for (let i = 0; i < q.length; i++) {
    try {
      await send(q[i] as Queued);
      sent++;
    } catch (e) {
      if (isNetworkError(e)) {
        left.push(...q.slice(i));
        break;
      }
      rejected++; // the server refused it; keeping it would block the queue for ever
    }
  }
  writeQueue(left);
  return { sent, left: left.length, rejected };
}

export const cacheCard = (id: string, card: unknown) => safe(() => localStorage.setItem(CARD + id, JSON.stringify(card)), undefined);
export const readCachedCard = <T,>(id: string): T | null => safe(() => JSON.parse(localStorage.getItem(CARD + id) ?? "null") as T | null, null);
