"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import CompareView from "@/components/CompareView";

function Inner() {
  const q = useSearchParams();
  const r = q.get("r") ?? "sample-walter";
  return (
    <div className="wrap py-10">
      <p className="kicker">Sample  Compare</p>
      <h1 className="text-40 md:text-64">A plain AI list, next to the card</h1>
      <p className="mt-3 max-w-2xl text-ink-2">Most care homes get one playlist for everyone. A plain model does a little better, but it still drifts outside the years that matter and names things Qloo cannot link to the person.</p>
      <div className="mt-8"><CompareView residentId={r} /></div>
    </div>
  );
}
export default function ComparePage() {
  return <Suspense fallback={<p className="wrap py-16 text-ink-2">Loading</p>}><Inner /></Suspense>;
}
