# JUDGE.md

Three paths, by how much time you have. No sign-in is needed for any of them.

## 60 seconds
1. Open the live app (link in README) and choose "Try a sample resident".
2. Build or open the saved card for the resident born in 1940. Every item shows its year, the favourite Qloo links it to, and a Personal, Shared era or Widely known tag.
3. Open "What the rules turned away" to see candidates dropped for being outside his years or not linked to a favourite.

## 3 minutes
1. `/judge`: run the hard case (a favourite Qloo cannot resolve). The screen says what it could not find and builds nothing.
2. `/judge`: read the fault switch result. A model tried to put an off-card name into a line and to add an item that does not exist; both were blocked.
3. `/compare`: run the plain AI list for the same resident and see which items fail the same rules and why.
4. `/sample/sample-walter/session` on a phone: one item per screen, six big taps. In the sample the taps are not saved.
5. `/group`: plan a room of four.
6. `/trace` and `/api/status`: the system's own account of itself, from real probes with times.

## 10 minutes, from a clean clone
```bash
git clone https://github.com/0xkinno/aftersong
cd aftersong
npm --prefix backend ci
npm test                    # unit and agent tests, offline
npm run verify:fixtures     # offline verifier: one honest card passes, one tampered card fails
npm run sabotage            # fault switch, offline
npm run check               # house style, clean check, FACTS matches its source
```
To verify a live card: on `/sample`, choose "Download for the offline verifier", then
`npm run verify -- path/to/card.json`. The verifier calls neither Qloo nor a model.
Read [SDK_SURFACE.md](SDK_SURFACE.md) for every Qloo call with file and line.

## What is sample and what is live
Sample residents are labelled Sample. Their cards are built by the real agent from real Qloo results.
Live builds are capped per visitor and per day; the saved sample card is shown on /compare without a build.
