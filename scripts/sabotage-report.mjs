// Offline report for the fault switch: the model tries to inject an off-card line and entity.
// Runs on the synthetic Qloo stand-in, so it spends nothing. Writes docs/sabotage-result.json.
import { writeFileSync } from "node:fs";
import { runCardAgent } from "../backend/src/agent/agent.ts";
import { QlooClient } from "../backend/src/qloo/client.ts";
import { verifyCard } from "../backend/src/core/verify.ts";
import { mockQloo } from "../backend/test/mock-qloo.ts";
import { scripted } from "../backend/test/scripted-model.ts";

const resident = { id: "synthetic-resident", homeId: "synthetic", firstName: "Synthetic", birthYear: 1940, careCity: "Synthetic City", hometown: "Synthetic Town",
  favourites: [{ text: "Synthetic Singer", kind: "entity", id: "SYN-FAV-001", name: "Synthetic Singer", type: "urn:entity:artist", confirmed: true }],
  offsets: { from: 10, to: 30 }, consent: true, intakeBy: "carer", familySubmittedAt: null, isSample: true, createdAt: "", updatedAt: "" };
const client = new QlooClient({ key: "synthetic", transport: mockQloo, spacingMs: 0 });
const r = await runCardAgent({ client, model: scripted(), sabotage: "model_injects", currentYear: 2026 }, { resident, observations: [], cardId: "sabotage" });
const blockedLines = r.card.items.filter((i) => i.opener.source === "template" && i.opener.blocked?.length).length;
const injected = r.card.items.some((i) => i.entityId === "off-card-entity");
const v = verifyCard(r.card, { ...r.evidence, birthYear: 1940, offsets: resident.offsets, currentYear: 2026, allowedNames: ["Synthetic Town", "Synthetic City"] });
const out = { ranAt: new Date().toISOString(), stand_in: "synthetic Qloo stand-in, offline", blockedLines, blockedEntities: injected ? 0 : 1, verifierOk: v.ok };
const text = JSON.stringify(out, null, 2) + "\n";
writeFileSync("docs/sabotage-result.json", text);
writeFileSync("web/lib/sabotage-result.json", text);
console.log(out);
if (blockedLines < 1 || injected || !v.ok) process.exit(1);
