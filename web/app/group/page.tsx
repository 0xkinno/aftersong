import GroupView from "@/components/GroupView";

export const metadata = { title: "Group session, Aftersong" };

export default function GroupPage() {
  return (
    <div className="wrap py-10">
      <p className="kicker">Sample  Group session</p>
      <h1 className="text-40 md:text-64">One room, several lives</h1>
      <p className="mt-3 max-w-2xl text-ink-2">Pick two to eight sample residents. Aftersong builds one pool from all their years, scores it again for each person, and keeps the items that work for the person it fits least. If one resident was upset by an item, it is dropped for the room.</p>
      <div className="mt-8"><GroupView mode="sample" /></div>
    </div>
  );
}
