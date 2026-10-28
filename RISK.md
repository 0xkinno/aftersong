# RISK.md

Aftersong is used with people who have dementia, so its limits are stricter than the sponsor's.

| Risk | Rule, stricter than the event kit | Enforced in |
|---|---|---|
| Medical claims | No sentence says an item will calm, treat, cure, improve memory or reduce agitation. Openers with such wording are blocked and replaced with a template line, labelled as such | `backend/src/core/house-style.ts` |
| Health data to Qloo or the model | The intake holds first name, birth year, home city, favourites. No diagnosis, medication or notes reach Qloo. The model receives item names, years and Qloo tags only | `backend/src/qloo/guard.ts`, `backend/src/agent/context.ts` |
| Painful associations | One `upset` tap suppresses that entity for that resident and lowers its Qloo neighbours. The carer knows, the model does not | `backend/src/core/memory.ts` |
| Model invents an item | Openers may mention only names on the card. A line that names anything else is blocked | `backend/src/core/openers.ts` |
| Padding with guesses | When fewer than the minimum items survive, the card says so and offers a 5 year widening with the carer's consent | `backend/src/core/card.ts` |
| Affinity read as a promise | Every item says "Qloo links this to X for people with similar taste". Never "he will like this" | UI copy and `house-style.ts` |
| Stale memory | Observations expire after 90 days unless reconfirmed. Family can view and delete | `backend/src/core/memory.ts` |
| Public link burns the quota | Public lock, per-visitor and daily caps, kill switch | `backend/src/limits.ts` |
| A key leaks | Qloo key on the backend only. Never in the browser bundle, the repo or a recording | `render.yaml`, `.env` ignored |
| Raw Qloo data published | Qloo data is not stored in the public repository. Committed test fixtures are synthetic | `scripts/check-clean.mjs`, `backend/test/fixtures` |

Maximum harm accepted: a card item the resident does not respond to. The carer's tap records it and the
next card changes.
