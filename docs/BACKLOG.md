# Backlog

Collected from usage review. Newest status on top within each section.

## Needs the owner (decisions or review)

- **Review the two new Tainan places** (兌悅門, 台南硓𥑮石芳宅). agy's draft had invented or wrong facts; Claude rewrote both from the sources listed in each file's `metadata.sources` and kept the hedges the sources use. Open points:
  - 芳宅 coordinates are approximate (兌悅門's point, same street); sources disagree on the house number (信義街46巷 15 vs 17) and on the build date (1926 vs 1930s).
  - 兌悅門 is listed as 國定古蹟: the 2020 review upgraded it; Wikipedia says the formal announcement was still to follow.
- **Free entry**: only 兌悅門 has `foreign_visitor_guide.free_entry: true` (from its source). Temples and other places don't say, so they still get ticket phrases. Fill in where you know.
- **Party size** ("how many of us"): templated phrases ("{n}張票", 兩 not 二) and "We are {n} people" in Ask AI prompts. For now the ticket phrase is fixed at two (兩張票).
- **Most-used phrase list** (8 phrases, `"top": true` in `data/phrases.json`).
- **Food picks**: ALMONd 漢堡 and FULA 巴斯克 left out with the pizza places; 入街 and 阿富師 not marked as Tainan specialties (unclear what they're known for); any personal tips you want published.

## Phrases

- Done: situational "sightseeing" phrases (tickets, photos, closing time, English introduction) and food extras (table for two, English menu, recommendations); "useful here" skips generic phrases and skips ticket phrases at free places.
- 兌悅門 is open all day but still gets "what time do you close?": a place-level "always open" flag would fix it.
- Mispronunciations by the device voice: listen on a phone; add a `tts` respelling where needed.
- Zhuyin and per-symbol romanization may be too small on phones (15px / 11px).

## Places

- Must-see reasons: done for all eight places. `scripts/generate_spot.py` now asks for them, with stricter no-invention rules; its output is marked "pending owner review".
- Researched content (agy or Gemini) must be checked against sources before merging; a source-quote check script would make that cheaper if many places get added.
- Knowledge topics (Taiwanese folk religion, Wenchang / Kuixing, temple layout...): design in `docs/ARCHITECTURE.md`.

## Food picks

- Names are Chinese only; an English line per pick (what it is / what to order) would help European readers.
- No coordinates: picks aren't sorted by distance; Navigate searches Google Maps by name.

## App

- Test on real phones: needs an https URL (GitHub Pages or similar). Ask before publishing.
- Place cards are text only; consider a photo per place (licensing!).
- Tab bar icons are text glyphs.
