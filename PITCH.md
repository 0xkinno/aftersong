# PITCH.md

For the finalist slot, live on air on Nov 5 (Mode G: an investor on the panel). Numbers quoted aloud
come from `docs/FACTS.json` and `FINDINGS.md` on the day of the pitch. None is written here by hand.

## 60-second spoken version
| Time | What is said | What is on screen |
|---|---|---|
| 0:00 | "Walter has dementia. He barely speaks. His daughter remembers three things he loved: Sam Cooke, Casablanca, and his mother's jollof rice." | The landing page, phone in hand |
| 0:12 | "Most care homes play one playlist for everyone. The carer, Marisol, has twenty minutes before the afternoon session." | |
| 0:20 | "Aftersong asks Qloo for what Walter's own taste points to, from the years he remembers best, 1950 to 1970." | The card builds; the agent's steps appear one by one |
| 0:32 | "Here is the card. Each item says why it is here: because of Sam Cooke. This one is Personal: it ranks high for Walter and low for people his age. A generic list would miss it." | One card, the Personal tag, "Because of" |
| 0:42 | "Marisol runs it on her phone. One item at a time. She taps what she sees: lit up, sang along, upset." | Session mode, a tap |
| 0:50 | "Only her taps become memory. The next card starts from what lit up and never shows what upset him." | The next card, the Walk line |
| 0:57 | "That is Aftersong." | Logo and the URL |

## One live click path, under 90 seconds, on a phone
1. Open the live address (QR code on the slide). Tap **Try a sample resident**. 0:05
2. The saved Walter card is already there. Scroll once, point at "Because of" and a **Personal** tag. 0:20
3. Open **How this card was made** and show one decision (for example, a favourite that was dropped and why). 0:35
4. Tap **Run the session on a phone**. Tap **Lit up** on the first item, **Next**. Turn the phone offline and tap again: "1 waiting to sync". Turn it back on. 1:05
5. Back on `/judge`, tap **Run the abstention preset**. The card says "Not enough from these years yet" and adds nothing. 1:25

If the connection fails, the saved sample and the recorded run (below) still work.

## Three answers ready
- **Who pays?** Memory care operators and home care agencies, per resident per month. The activities coordinator is the user; the director of care buys. The price is a hypothesis to test, about four dollars per resident per month and free for a family with one resident. No customer has paid yet.
- **Why does this need Qloo?** Show F1 and F2 from `FINDINGS.md`: with only a person's generation as the signal, the top results lean on famous names for everyone; with what the family remembered, they do not. Remove Qloo and there is no year-window ranking across music, film, TV, food and places, and no Personal against generation split. The plain AI list on the compare page shows the difference.
- **What about privacy?** Only entity IDs, tag IDs, an age bracket, years and a hometown reach Qloo. Never names or health details. The code refuses anything else before it leaves the server, and the offline verifier can prove it from a stored card.

## One sentence on what is next
After the hackathon: a month-long pilot with three care homes, one session a week, with the carers' own reactions as the measure.

## Business case (short, honest)
- Buyer: memory care operators and home care agencies. The director of care signs.
- Hypothesis, not a result: per resident per month (for example $4); free for families with one resident.
- Why now: person-centred care requirements, staffing pressure, and a taste graph that makes "his era, his taste" computable.
- Traction: none claimed. A real session with an older person has not been run yet; see `EVIDENCE.md`.

## Fallback plan
1. Recorded run of the same flow (screen capture of the deployed app).
2. Offline mode: `/judge` shows the saved run and `npm run verify` on an exported card.
3. Hotspot and a printed card in a bag.

## Q&A bank
| Question | Answer, with the file |
|---|---|
| What is live and what is sample? | Table in README, "What is live, sample, and designed" |
| What does a card cost? | `docs/FACTS.json`, live Qloo calls and tokens per card |
| What fails? | Misses in `EVIDENCE.md` and null results in `FINDINGS.md` |
| Is it significant? | Sign tests in `docs/FACTS.json`; where not significant, the page says so |
| Is this medical? | No. `RISK.md`: no diagnosis, no claims, carer taps only |
| What if Qloo is down? | The screen says so. No guessing |
| Has a real person used it? | Not yet, in plain words, until a consented session is logged |

Rehearse against a timer on the device used on stage. QR code to `/judge`.
