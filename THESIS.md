# THESIS.md (Gate G4)

```
NAME:       Aftersong
MOMENT:     Marisol, activities coordinator at a memory care home, has 20 minutes before an afternoon
            session with a new resident who barely speaks and only three favourites on an intake form.
ACTION:     The agent builds a reminiscence session card from the resident's own bump years across
            music, film, TV, food and place. Marisol runs it and logs what she saw. The next card
            learns only from her observations.
DISCOVERY:  Everyone assumes a model already knows "music from his era". In reality a plain model
            returns the same famous songs for everyone and drifts outside the years that matter;
            Qloo's affinity graph inside a year window returns things this person's taste points to.
PROOF:      Era-fit rate and personalisation rate of Aftersong against a plain model on the same intake
            forms, curated and wild, with misses published. Numbers from docs/FACTS.json only.
```

## 20-second hook (spoken first in the video and the live pitch)
"Walter has dementia. He barely speaks. His daughter remembers three things he loved. Most care homes
play the same Sinatra playlist for everyone. Aftersong uses Qloo to find what Walter's own taste points
to, from the years he remembers best, so the carer walks in with something that might make him sing."

## X without Y
A reminiscence session built from one person's years and taste, without a generic oldies playlist and
without the carer guessing.

## Primary guarantee (about the person)
Nothing on a session card is placed there by the model's opinion. Every item is a real Qloo entity, tied
to a confirmed favourite or a confirmed reaction, and every "he liked this" in memory came from a
carer's tap. Dated items sit inside the person's bump window.

## Human loop
| Who | Does what | Cannot do |
|---|---|---|
| Family | Fills the intake from anywhere through a private link, confirms favourites, views and deletes memory, reads the weekly digest | Write observations |
| Carer | Confirms Qloo matches, runs the session, taps six reactions, adds a note | Edit the family's intake |
| Agent | Chooses which tools to call and in what order, writes one opener per item | Choose what goes on the card, or what the resident liked |

## Interruption budget
The agent asks the carer at most two questions per card: confirm a favourite match when Qloo returns
several, and consent to widen the window by 5 years when too little comes back. Always surfaced:
a failed lookup, an empty window, a blocked model line.

## Abstention
"Not enough from these years yet." The card never pads with model guesses. A favourite Qloo cannot
resolve is shown as not found with the reason. If Qloo or the model is down, the screen says so.

## Memory policy
Observation values: lit_up, sang_or_moved, talked, no_response, upset, skipped. Only carer taps are
stored, with who, when, card and entity. `upset` suppresses the entity and down-weights its Qloo
neighbours. lit_up and sang_or_moved become new confirmed signals. Entries expire after 90 days unless
reconfirmed. The family can view and delete. A model guess never becomes memory.

## Crew (job titles, one responsibility, tools, identity)
These are responsibilities inside one agent loop, not separate model identities. The model chooses the order of tool calls. The group route runs the Room Planner deterministically; the model does not choose it.

| Role | Responsibility | Tools it may call | Identity |
|---|---|---|---|
| Intake Clerk | Resolve typed favourites to Qloo entities | `resolve_favourites` | model, no write access |
| Era Scout | Find dated items per domain inside the window | `find_era_items` | model, read-only |
| Card Builder | Assemble the card under the rules | `build_card` | model chooses when; code decides content |
| Room Planner | Items that work for 4 to 8 residents | `plan_group_session` | model chooses residents |
| Memory Keeper | Read the carer's logged reactions | `read_observations` | read-only |
| Opener Writer | One plain line per item | none | model, output filtered |

## Name rationale
In dementia care, music is often the last thing to go. Aftersong is what remains after the words do.
Collision check: `docs/NAME_CHECK.md`.

## Guard against drift
Every session diff this file, `SPONSOR_INTEL.md`, `PLATFORM_PROBE.md` and `SDK_SURFACE.md` against the
code. Claims the code does not back are fixed or removed that session (logged in `PROGRESS.md`).
