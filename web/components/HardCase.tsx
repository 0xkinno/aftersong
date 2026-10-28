"use client";
import { useState } from "react";
import { api } from "@/lib/client";

export default function HardCase() {
  const [out, setOut] = useState<{ birthYear: number; favourite: string; matches: number; message: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="card p-5">
      <p className="kicker">Try a hard case</p>
      <p className="mt-2">A resident born in 1925 whose only favourite is a name Qloo cannot resolve. Aftersong should say what it could not find and stop.</p>
      <button className="btn mt-4" disabled={busy} onClick={async () => {
        setBusy(true); setErr(null);
        try { setOut(await api("/sample/hard-case", { method: "POST", body: {} })); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
      }}>{busy ? "Asking Qloo" : "Run the hard case"}</button>
      {out && <p role="status" className="mt-4"><strong>{out.favourite}</strong>, born {out.birthYear}: {out.matches} matches. {out.message}</p>}
      {err && <p role="alert" className="mt-4" style={{ color: "var(--clay-text)" }}>{err}</p>}
    </div>
  );
}
