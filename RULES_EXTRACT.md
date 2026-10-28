# RULES_EXTRACT.md

Source: the official rules page and event brief, read on 2026-10-28. The live submission form is the
final authority. Copy its exact field names into `SUBMISSION_DEVPOST.md` during Phase 7.

## Event
- Name: Qloo Agentic Hackathon, `qloo.devpost.com`. Platform: Devpost.
- Registration and submission: Sep 30, 2026 9:00 am ET to **Oct 30, 2026 11:45 pm ET**.
- In WAT: **Oct 31, 2026, 4:45 am WAT**. Internal target: submit at least 2 hours earlier, by Oct 31, 2:45 am WAT.
- Judging: Nov 2, 2026 12:00 pm ET to Nov 5, 2026 11:45 pm ET. Winners on or around Nov 5, 3:00 pm ET.
- Sponsor and administrator: Qloo, New York.

## Prizes
| Place | Amount |
|---|---|
| 1st | $15,000 |
| 2nd | $6,000 |
| 3rd | $4,000 |

One prize per project. A separate $25,000 investment from Jason Calacanis in his favourite entry is
described in the event brief, not in the rules page.

## What to build
A working software application that integrates the Qloo API and either (a) functions as an agentic
tool, (b) is built using an agent framework, or (c) integrates the Qloo API into an existing agent.

## Judging
- Stage One: pass or fail. The project reasonably fits the theme and reasonably applies the required APIs.
- Stage Two: four equally weighted criteria, exact words:
  1. **Technological Implementation:** How thoroughly and skillfully does the project use Qloo? Does the code reflect genuine effort and a working, non-trivial implementation?
  2. **Design:** Does the project deliver a complete, coherent product experience, not just a technical proof of concept?
  3. **Potential Impact:** Does the project make a credible, specific case for solving a real problem for a real audience and does the solution actually address that problem based on what's demonstrated?
  4. **Quality of the Idea:** Is this a creative, non-obvious use of Qloo and does the team demonstrate genuine understanding of the problem space they're working in?
- Tie-break: highest score on the first criterion, then the next in the order above, then a judge vote.
- Judges may be sponsor staff or third parties. Judging may use expert panels, peer review or automated analysis.

## Required submission items
1. A link to a functional demo application. The project must be free to test, without restriction, until judging ends. If private, login credentials go in the testing instructions.
2. A URL to a public code repository (GitHub, GitLab or Bitbucket) with all source, assets and instructions. It must carry an open source licence file that is visible in the repository About section.
3. A text description of the features and functionality.
4. English for all materials, or an English translation.
5. The rules text mentions "the video and/or text description". A video is not listed as a required item on the rules page. Confirm on the live form.

## Project rules that affect the build
- New work, or an existing project significantly updated during the submission period, with the update explained.
- Third-party SDKs, APIs and data must be used within their licences.
- The submission must be original work, solely owned by the entrant, with no one else's IP.
- No financial or preferential support from the sponsor or administrator.
- Open source dependencies are allowed when their licences are followed and the entry builds on them.
- Qloo may use the entry to promote the event and uses name, likeness and voice for three years.

## Qloo access and safe use (from the event kit)
- Key by Google form in the developer guide: https://docs.qloo.com/reference/qloo-llm-hackathon-developer-guide#getting-your-api-key
- Supported surfaces: `qloo explore`, `qloo exec`, `qloo api`, `qloo mcp` from `@qloo/qloo-harness` (0.1.26 or newer, Node 22.19 or newer). All share one key and one quota.
- Never put the key in source control, a browser app, a public MCP config or a recording.
- Send Qloo no names, emails, device or account IDs, or location histories. Aggregate concepts and entity IDs only.
- Do not use results to infer identity, health, finances or eligibility. State source and limits. Separate a Qloo result from our own interpretation.
- Retries must be bounded. Do not bulk scrape.

## Criterion to README heading, demo moment and file
| Criterion | README heading | Where to see it | File |
|---|---|---|---|
| Technological Implementation | How Qloo is used | The card trail and `/method` | `SDK_SURFACE.md`, `backend/`, `web/` |
| Design | Try it in 2 minutes | Landing, session mode, printed card | `web/app` |
| Potential Impact | The problem | Sourced table, life-story export | `docs/SOURCES.md` |
| Quality of the Idea | What it does | Year-window card, personal versus generation split | `PROOF.md`, `EVIDENCE.md` |
