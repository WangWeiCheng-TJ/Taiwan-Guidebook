# Backlog

The one place that tracks status: what is built, what is next, what waits for the owner. Design lives in [ARCHITECTURE.md](ARCHITECTURE.md), rules for implementers in [SPEC.md](SPEC.md). **City-specific data notes (places, food, free entry, transport) live in [notes/](notes/README.md), one file per city.** Newest status on top within each section. **(agy)** marks pure-logic items with a testable contract that a worker agent can implement (`.claude/skills/delegate-and-gate/SKILL.md`); everything else (research, data, UI) stays with the owner or Claude.

## Status

Built (on `main`; not hosted yet):

- POC: offline PWA, places with distance sort, place detail, show-to-driver, navigation links, trip log with export/import, phrases, tips, Ask AI (near me / plan a day).
- Itineraries (T1 to T3): `?trip=<https url>` links, paste an AI's plan back, the plan on My trip and Explore and in Ask AI prompts.
- Two languages: i18n building blocks (T4a) and the English / 繁中 switch for UI and content.
- Phrases: zhuyin with per-symbol romanization and spoken tones, category tiles, a most-used set, suggestions per place.
- Must-see reasons for all eight places.
- Food picks for Tainan, in Explore and Ask AI.
- Select any text, ask AI what it means (explain-selection).
- City picker when GPS isn't used.

Planned (design in [ARCHITECTURE.md](ARCHITECTURE.md)):

- Knowledge topics (Taiwanese folk religion, Wenchang / Kuixing, temple layout...).
- T4b: per-language data across schema, build, generator and app (not before it is planned; see SPEC.md, "Not in scope yet").
- A `story` content type linking several places.
- An embedded map (optional, online-only).
- More UI and content languages.

## Needs the owner (decisions or review)

- **Review the two places marked "pending owner review"**: `duiyue-gate`, `tainan-coral-stone-house`. Once reviewed, the marker can be dropped from `metadata.generated_by`.
  - 兌悅門: the heritage question is resolved. The Ministry of Culture announced on 2023-01-11 that six gate and wall sites were merged into the national monument, renamed 臺灣府城城門及城垣殘蹟 (per a Tainan City Cultural Affairs Bureau report, added to the place's sources). [notes/tainan.md](notes/tainan.md) still lists it as open: update the note when reviewing.
  - 硓𥑮石芳宅: still open are the build year (1926 or the 1930s), the house number (15 or 17) and the coordinates, which are approximated from 兌悅門. See [notes/tainan.md](notes/tainan.md).
- **Party size** ("how many of us"): templated phrases ("{n}張票", 兩 not 二) and "We are {n} people" in Ask AI prompts. For now the ticket phrase is fixed at two (兩張票). Once the design is decided, the number formatting is **(agy)**.
- **Most-used phrase list** (8 phrases, `"top": true` in `data/phrases.json`).
- City items to decide: see [notes/tainan.md](notes/tainan.md), [notes/taipei.md](notes/taipei.md), [notes/changhua.md](notes/changhua.md).

## Phrases

- Done: situational "sightseeing" phrases (tickets, photos, closing time, English introduction) and food extras (table for two, English menu, recommendations); "useful here" skips generic phrases and skips ticket phrases at free places.
- 兌悅門 is open all day but still gets "what time do you close?": a place-level "always open" flag would fix it. The flag goes into the data by the owner; skipping closing-time phrases for it in `phrasesForPlace` is **(agy)**.
- Mispronunciations by the device voice: listen on a phone; add a `tts` respelling where needed.
- Zhuyin and per-symbol romanization may be too small on phones (15px / 11px).

## Places

- `scripts/generate_spot.py` asks for must-see reasons, with stricter no-invention rules; its output is marked "pending owner review".
- Researched content (agy or Gemini) must be checked against sources before merging; a source-quote check script (does each claimed fact appear in a listed source?) would make that cheaper if many places get added **(agy)**.
- Knowledge topics: see Status, Planned.

## Food picks

- Names are Chinese only; an English line per pick (what it is / what to order) would help European readers.
- No coordinates: picks aren't sorted by distance; Navigate searches Google Maps by name.

## App

- Test on real phones: needs an https URL (GitHub Pages or similar). Deferred, see Infra; ask the owner before publishing anything.
- Place cards are text only; consider a photo per place (licensing!).
- Tab bar icons are text glyphs.

## Infra

- CI (GitHub Actions) and GitHub Pages: deferred by the owner (2026-10-12).
- `scripts/generate_spot.py` writes straight to `data/attractions/` and runs the build, which bypasses notes-before-data: make it write a draft outside `data/` instead.
