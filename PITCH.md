# PITCH.md

For the on-air finalist pitch (Mode G: accelerator-style, an investor on the panel). Timings are for a
3 minute slot. The README and video follow the same order.

## Spoken pitch
| Time | Beat | Line |
|---|---|---|
| 0:00 | Hook (20 s) | The 20-second hook in `THESIS.md` |
| 0:20 | Moment | "Tuesday, 2:30 pm. Marisol runs activities in a 40-bed memory care home. A new resident arrives with three favourites on a form and twenty minutes on the clock." |
| 0:40 | Live (60 s) | Open the live app, pick the sample resident, watch the agent place six items, each with the Qloo link and the year. Print the card |
| 1:40 | Proof (30 s) | One wild-set number from `FACTS.json` and the plain-AI comparison: how many of its items fell outside his years |
| 2:10 | Loop | Marisol taps what she saw. The next card walks outward from what worked, and drops what upset |
| 2:30 | Business | Buyer: director of care at memory care operators and home care agencies. User: the activities coordinator. Price hypothesis: per resident per month, free for a family with one resident |
| 2:50 | Next | Group sessions across a floor, family memory app, care-plan software export |

## Business case (short, honest)
- Buyer: memory care operators and home care agencies. The director of care signs.
- Hypothesis, not a result: per resident per month (for example $4); free for families with one resident.
- Why now: person-centred care requirements, staffing pressure, and a taste graph that makes "his era, his taste" computable.
- Traction: none claimed. Pilot ask: three care homes and one session a week for a month.

## Fallback plan
1. Recorded run of the same flow (screen capture of the deployed app).
2. Offline mode: `/judge` shows the stored run and `npm run verify` on an exported card.
3. Hotspot and a printed card in a bag.

## Q&A bank
| Question | Answer, with the file |
|---|---|
| What is live and what is sample? | Table in README, "What is live, sample, and designed" |
| What does a card cost? | `docs/FACTS.json` cost per card |
| What fails? | Misses listed in `EVIDENCE.md` |
| Who pays? | Care operator, per resident per month |
| Why Qloo? | Remove it and the year window plus personal ranking disappear; see `DISCOVERY.md` |
| Is this medical? | No. `RISK.md`: no diagnosis, no claims, carer taps only |
| What if Qloo is down? | The screen says so. No guessing |
| Privacy? | Qloo receives IDs, tags, years, a place. Never names or health data |

Rehearse against a timer on the device used on stage. QR code to `/judge`.
