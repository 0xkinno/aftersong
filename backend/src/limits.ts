// Public lock: per-visitor and daily caps on anything that spends Qloo or model budget without a
// sign-in, plus a kill switch. Caps are explained in plain words in the UI.
import { createHash } from "node:crypto";

export interface LimitConfig {
  publicLock: boolean;
  perVisitorPerDay: number;
  publicBuildsPerDay: number;
  kill: boolean;
}

export const limitConfigFromEnv = (env: Record<string, string | undefined>): LimitConfig => ({
  publicLock: (env.PUBLIC_LOCK ?? "on") !== "off",
  perVisitorPerDay: Number(env.PER_VISITOR_PER_DAY ?? 4),
  publicBuildsPerDay: Number(env.PUBLIC_BUILDS_PER_DAY ?? 60),
  kill: (env.KILL_SWITCH ?? "off") === "on",
});

export class Limiter {
  private day = "";
  private perVisitor = new Map<string, number>();
  private total = 0;
  cfg: LimitConfig;
  private now: () => number;
  private salt: string;
  constructor(cfg: LimitConfig, now: () => number = Date.now, salt = "aftersong") {
    this.cfg = cfg;
    this.now = now;
    this.salt = salt;
  }

  private roll() {
    const d = new Date(this.now()).toISOString().slice(0, 10);
    if (d !== this.day) {
      this.day = d;
      this.perVisitor.clear();
      this.total = 0;
    }
  }

  visitorId(ip: string): string {
    return createHash("sha256").update(`${this.salt}|${this.day || "x"}|${ip}`).digest("hex").slice(0, 16);
  }

  /** Reserves one public live build. Returns why not, in plain words. */
  take(ip: string): { ok: true; remainingForVisitor: number } | { ok: false; reason: string } {
    this.roll();
    if (this.cfg.kill) return { ok: false, reason: "Live building is switched off for now. The saved sample still works." };
    const v = this.visitorId(ip);
    const used = this.perVisitor.get(v) ?? 0;
    if (used >= this.cfg.perVisitorPerDay) return { ok: false, reason: `You have used today's ${this.cfg.perVisitorPerDay} live builds. The saved sample still works.` };
    if (this.total >= this.cfg.publicBuildsPerDay) return { ok: false, reason: "The public daily limit for live builds has been reached. The saved sample still works." };
    this.perVisitor.set(v, used + 1);
    this.total += 1;
    return { ok: true, remainingForVisitor: this.cfg.perVisitorPerDay - used - 1 };
  }

  snapshot() {
    this.roll();
    return { day: this.day, publicLock: this.cfg.publicLock, kill: this.cfg.kill, perVisitorPerDay: this.cfg.perVisitorPerDay, publicBuildsPerDay: this.cfg.publicBuildsPerDay, publicBuildsToday: this.total };
  }
}
