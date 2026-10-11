# Backlog

App and cross-city items. **City-specific data notes (places, food, free entry, transport) live in [notes/](notes/README.md), one file per city.** Newest status on top within each section.

## Needs the owner (decisions or review)

- **Party size** ("how many of us"): templated phrases ("{n}張票", 兩 not 二) and "We are {n} people" in Ask AI prompts. For now the ticket phrase is fixed at two (兩張票).
- **Most-used phrase list** (8 phrases, `"top": true` in `data/phrases.json`).
- City items to decide: see [notes/tainan.md](notes/tainan.md), [notes/taipei.md](notes/taipei.md), [notes/changhua.md](notes/changhua.md).

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
