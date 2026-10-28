"use client";
import { useEffect, useState, type ReactNode } from "react";
import { supabase, supabaseConfigured } from "@/lib/supabase";

export default function AuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"loading" | "out" | "in" | "unconfigured">("loading");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const s = supabase();
    if (!s) {
      setState("unconfigured");
      return;
    }
    s.auth.getSession().then(({ data }) => setState(data.session ? "in" : "out"));
    const { data: sub } = s.auth.onAuthStateChange((_e, session) => setState(session ? "in" : "out"));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (state === "loading") return <p className="wrap py-16 text-ink-2">Checking sign-in</p>;
  if (state === "unconfigured")
    return (
      <div className="wrap py-16 max-w-xl">
        <h1 className="text-40">Carer sign-in is not set up here yet</h1>
        <p className="mt-3 text-ink-2">{supabaseConfigured() ? "" : "This deployment has no Supabase project connected, so carer accounts and saved residents are off. "}The saved sample works without sign-in.</p>
        <a className="btn btn-primary mt-6" href="/sample">Open the sample</a>
      </div>
    );
  if (state === "out")
    return (
      <div className="wrap py-16 max-w-xl">
        <p className="kicker">Carers</p>
        <h1 className="text-40 mt-2">Sign in with an email link</h1>
        <p className="mt-3 text-ink-2">No password. We send a link to your email address.</p>
        {sent ? (
          <p role="status" className="card p-4 mt-6">Check your email for the link. It opens this page signed in.</p>
        ) : (
          <form
            className="mt-6 grid gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setErr(null);
              const { error } = await supabase()!.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.href } });
              if (error) setErr(error.message);
              else setSent(true);
            }}
          >
            <label htmlFor="email">Email address</label>
            <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button className="btn btn-primary" type="submit">Send the link</button>
            {err && <p role="alert" className="text-clay-text" style={{ color: "var(--clay-text)" }}>{err}</p>}
          </form>
        )}
      </div>
    );
  return <>{children}</>;
}
