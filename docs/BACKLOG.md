# Backlog

Collected from usage review. Fix together at the end unless noted. Newest decisions on top within each section.

## Phrases

- **"Useful here" should be situational, not generic.** Drop thank you / excuse me / I don't speak Chinese from place suggestions; keep "where is the toilet". Add situational phrases first (they don't exist yet): two tickets please, where do I buy tickets, can I take photos here, is there an English guide, what time do you close. Then tune `PLACE_PHRASES` in `app/js/phrases.js` (and mark generic phrases so `phrasesForPlace` skips them).
- **Party size.** A "how many of us" setting (stored on the phone like the notes). Uses:
  - templated phrases: "{n} tickets", "a table for {n}". Chinese uses 兩 (ㄌㄧㄤˇ) for 2 with measure words, not 二, so the template must swap characters and zhuyin together, not insert a digit.
  - Ask AI prompt: "We are {n} people."
- **Most-used list** (8 phrases, `"top": true` in `data/phrases.json`): user to review.
- **Mispronunciations by the device voice**: listen to all phrases on a phone; for any that sound wrong, add a `tts` respelling in `data/phrases.json` (display stays unchanged).
- Zhuyin and per-symbol romanization may be too small on phones (15px / 11px).

## Places

- **Must-see reasons** exist only for Chihkan Tower. Generate `foreign_visitor_guide.must_see` for the other places with `scripts/generate_spot.py`, then review (they are factual claims).
- **Knowledge topics** (Taiwanese folk religion, Wenchang / Kuixing, temple layout...): design in `docs/ARCHITECTURE.md`, phase 3.

## App

- Test on real phones: needs an https URL (GitHub Pages or similar). Ask before publishing.
- Place cards are text only; consider a photo per place (licensing!).
- Tab bar icons are text glyphs.

## Food picks

- Names are Chinese only; for European readers add an English line per pick (what it is / what to order). Owner to approve any tip text: personal notes stay out of the public repo.
- No coordinates: picks aren't sorted by distance. Navigate searches Google Maps by name. A one-time geocoding step would enable "near me".
- Pending decision: Western-food group (27 Pizza Italy, PIZZA FACE, 溫度窯烤, 紅眼披薩, ALMONd 漢堡) and FULA 巴斯克 left out for now.
- Historic sites from the same list: 兌悅門 and 台南硓𥑮石．芳宅 (temporarily closed) to be added as full attractions.
