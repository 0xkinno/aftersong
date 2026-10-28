# MOMENT.md (Gate G2)

## Persona
Marisol Reyes, activities coordinator at a 40-bed memory care home in San Antonio, Texas.
The track definition (the event brief) names an agentic tool used for a real problem for a real
audience. The user is the activities coordinator. The buyer is the director of care.
The persona and the resident are invented for the story; the disclosure is in `EVIDENCE.md`.

## Moment and clock
Tuesday, 2:30 pm. A new resident, Mr. Walter Okafor, 84, arrived on Monday. He has moderate dementia,
says little, and is agitated in the afternoons. He grew up in Port Harcourt, Nigeria, and moved to
Texas in 1979. His daughter in London filled in the intake form: Sam Cooke, Casablanca, and his
mother's jollof rice. The afternoon group session starts in 20 minutes.

## Today
Marisol types "music for 80 year olds" into a video site and plays the same Sinatra playlist for every
resident. The intake form sits in a folder. Nothing connects the three favourites to anything else.

## Failure
The playlist reaches nobody in particular. The resident's best-remembered years (roughly ages 10 to 30)
and personal taste are both ignored. Nobody records what worked, so the next session starts blind.

## Cost: what is true, with sources
The figures are added to `docs/SOURCES.md` only after each source is opened and the number is checked
(Phase 5). Candidate sources: WHO dementia fact sheet; Cochrane review of reminiscence therapy
(Woods et al., 2018); Jacobsen et al., Brain, 2015, on preserved music memory; Rubin and Schulkind,
1997, and Munawar et al., 2018, on the reminiscence bump; Alzheimer's Society "This is me"; one
current care-staff turnover figure. A figure that cannot be confirmed is removed.

## The action the system completes
In under a minute it builds a Reminiscence Session Card: six to eight pieces of music, film, TV, food
and place, from the years the resident was 10 to 30 (1952 to 1972), each tied to a confirmed favourite
through Qloo, each with one plain conversation opener. The artifact is a printable card and a phone
session view, plus a one-page "about me" life story, the shape care homes already use.

## The human's physical role
Marisol is the agent's eyes and ears. Only she can see Walter smile or turn away. She taps one of six
reactions per item. Only her taps become memory. The family holds the memories and fills the intake;
the carer holds the observations. Neither can write the other's data.

## Anchor
The reminiscence bump and preserved music memory (sources above) are the research anchor. A real
anchor incident or dataset is not claimed.

## Founder stake or interview
No founder stake claimed. Practitioner interview: not yet done. If Kinnoski reaches an activities
coordinator or a care-home family, notes and exact scope go here with the date. Until then this file
says "no interview" and the README does not imply one.

## Theme verbs, measured
| Brief wording | Property | Measure |
|---|---|---|
| "uses Qloo thoroughly" | Share of card items that come from Qloo calls, calls per card | `docs/FACTS.json` |
| "agentic tool" | Tool calls chosen by the model before a card exists | trail on each card |
| "real problem, real audience" | Items inside the person's years, items tied to his favourites | era-fit and connection rates |
| "non-obvious use of Qloo" | Share of Personal items versus a generic oldies list | personal rate, generic overlap |

## Everyone in this job assumes X; in reality Y
Everyone assumes "music for old people" is one playlist. In reality the songs that reach a person are
from their own reminiscence bump, filtered through their own taste.
