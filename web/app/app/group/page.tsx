"use client";
import AuthGate from "@/components/AuthGate";
import GroupView from "@/components/GroupView";

export default function Page() {
  return (
    <AuthGate>
      <div className="wrap py-10">
        <p className="kicker">Carer  Group session</p>
        <h1 className="text-40 md:text-64">Plan a room</h1>
        <p className="mt-3 max-w-2xl text-ink-2">Pick two to eight residents. Items that any of them was upset by are dropped for the room.</p>
        <div className="mt-8"><GroupView mode="carer" /></div>
      </div>
    </AuthGate>
  );
}
