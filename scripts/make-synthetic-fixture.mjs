// Writes SYNTHETIC export fixtures for CI. Built from the test stand-in, not from Qloo, so nothing
// here is Qloo data. One honest card and one tampered card.
import { writeFileSync } from "node:fs";
import { runCardAgent } from "../backend/src/agent/agent.ts";
import { QlooClient } from "../backend/src/qloo/client.ts";
import { mockQloo } from "../backend/test/mock-qloo.ts";

const resident = {
  id: "synthetic-resident", homeId: "synthetic", firstName: "Synthetic", birthYear: 1940, careCity: "Synthetic City", hometown: "Synthetic Town",
  favourites: [{ text: "Synthetic Singer", kind: "entity", id: "SYN-FAV-001", name: "Synthetic Singer", type: "urn:entity:artist", confirmed: true }],
  offsets: { from: 10, to: 30 }, consent: true, consentRecord: null, intakeBy: "carer", familySubmittedAt: null, isSample: true, createdAt: "2026-10-28T00:00:00Z", updatedAt: "2026-10-28T00:00:00Z",
};
const client = new QlooClient({ key: "synthetic", transport: mockQloo, spacingMs: 0 });
const r = await runCardAgent({ client, model: null, currentYear: 2026 }, { resident, observations: [], cardId: "synthetic-card", now: Date.parse("2026-10-28T00:00:00Z") });
const evidence = { ...r.evidence, birthYear: 1940, offsets: resident.offsets, currentYear: 2026, allowedNames: ["Synthetic Town", "Synthetic City"] };
const good = { synthetic: true, card: r.card, evidence };
const bad = structuredClone(good);
bad.card.items[0].year = 1999;
bad.card.items[1].connectedTo.id = "SYN-NOT-CONFIRMED";
writeFileSync("backend/test/fixtures/synthetic-export.json", JSON.stringify(good, null, 1));
writeFileSync("backend/test/fixtures/synthetic-export-tampered.json", JSON.stringify(bad, null, 1));
console.log("wrote synthetic fixtures");
