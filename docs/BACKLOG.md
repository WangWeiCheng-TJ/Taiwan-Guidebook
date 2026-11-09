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
- Ask AI about a photo: menu, sign, departure board, ticket machine or form, food label; "Ask AI about the menu" on food pick and dish sheets.
- My stay: the traveler's hotel (Chinese name and address, phone), one per city, on the device only; "Take me back" on My trip and Explore opens it on the show card.
- Full backup: one file with notes, plan and party size (version 2; older files still import), shared to the traveller's own chat or mail where the browser can share files, else downloaded; "Last backup 3 days ago · 5 notes since" on My trip; `navigator.storage.persist()` after the first saved note or plan.
- Party size: a People stepper on the phrase pages and Ask AI; templated phrases (兩, not 二) and "We are {n} people" in prompts, the prompt naming the party only after the traveler sets it. Still open: a `party` field for `two-tickets` and `table-for-two` in `data/phrases.json` (`{ zh_TW: '兩', zhuyin: 'ㄌㄧㄤˇ', pinyin: 'liǎng', en_one, en_other }`), owner to write; until then those phrases stay fixed at two.
- The place page: a photo with its credit (online only, when `photo` is complete), a collapsed OpenStreetMap iframe (online only), "Learn more" topics; the Tips tab links to Apps and Learn pages (no content yet, see Planned); SVG tab icons; bigger zhuyin on phones; tap to hear a place name or phrase.
- The show card reads aloud (second tap slower), turns 180°, keeps the screen awake.
- My stay, the full backup, Ask AI about a photo, the survival of notes across guide updates (above), and Ask later: every copied prompt kept in a list of 10 on the device, with a dot on Ask AI when questions copied offline can now be sent.
- "Taiwan through the places": one timeline across every place's events, under the eras of Taiwan's history (`#/learn/timeline`), with Copy for AI.
- A boot watchdog: when the app fails to start, a message and a Repair button (clears the service worker and caches, keeps the traveler's data).
- Accessibility and tap targets: aria-pressed chips, language tags on text only, announcements, 44px taps, contrast tokens, enforced by `tests/core/css.test.js`.
- `scripts/check_sources.py` (`npm run check:sources`): checks that the quotes in `docs/claims/<subject>.json` appear in their sources. No claims files exist yet; the script treats a missing folder as nothing to check.
- The trip log survives guide updates: a note keeps its place's name (also through export and import); a guide update names the logged or planned places it dropped.

Planned (design in [ARCHITECTURE.md](ARCHITECTURE.md)):

- Knowledge topics content (Taiwanese folk religion, Wenchang / Kuixing, temple layout...): the Learn pages and the build loader for `data/topics/<id>.json` exist (the build validates them and bundles them when present); the topics themselves, and `data/apps.json` for Recommended apps, are still to be written.
- T4b: per-language data across schema, build, generator and app (not before it is planned; see SPEC.md, "Not in scope yet").
- A `story` content type linking several places.
- More UI and content languages.

## Feature ideas waiting for the owner

From a research pass over how other travel apps work (ranked by value, fit and risk). The ideas below were not built; each says what it needs from the owner. Ideas that were built are under Status.

- **Food pick location**: optional `address_zh`, a "near <landmark>" line, coordinates and a checked month per pick, so the driver card and "Eat nearby" work offline. Needs: the Chinese address and coordinates of the 13 Tainan picks, a near line in his own words, the checked month, the "Eat nearby" radius.
- **Know before you walk in**: an English line, meal slots, price band and practical tags (cash only, order sheet, queue) per pick. Needs: those fields for the 13 picks and 5 `to_try` dishes, the enum values, price band edges and slot boundaries, the English line.
- **Help sheet with tap-to-call numbers**: correct the emergency tip (VoLTE warning), add `tel:` buttons. Needs: the numbers and VoLTE wording checked against Taiwan.net.tw and the NCC or operators; whether to list 112, 1990 and 0800-011765 and whether 0800 numbers work from a roaming SIM; optional earthquake and typhoon tips from official sources.
- **How ordering works primer**: the steps at a small-eats counter (paper order sheet, pay first, small bills). Needs: the steps from his experience, an annotated order-sheet photo, any facts from the commercial source confirmed, and tip category or Learn topic.
- **Order card at the stall**: a show card with dish, count, measure word and modifiers. Needs: the measure word (one 份 or per dish), a dish line for picks without one, the modifier phrases with checked zhuyin, whether the count defaults to the party size or 1.
- **Browser-to-app handoff**: a banner and copy/paste to move a plan from Safari into the installed app. Needs: a test on an iPhone and an Android phone with a hosted URL (hosting is deferred) and which chat apps (WhatsApp, LINE) plan links go through.
- **"What I don't eat" card**: owner-checked diet lines (no pork, shellfish, vegan 全素...). Needs: each line (zh, zhuyin, en) checked by a native speaker (safety-critical), disclaimer wording, how far to go into allergies, a checked source for hidden-ingredient tips.
- **Ate here / want to go for food picks**: a log link per pick and a want-to-go list. Needs: approval of the `LogEntry` change (food ref, name snapshot) and whether the list goes into the export.
- **Opening hours with a checked date**: `hours`, closed days and a source per place, with a closed-day warning in the plan. Needs: hours, closing days and an official source for the 8 places with the check date, and a re-check cadence. (`always_open` for 兌悅門 exists.)
- **Eating-route day plan**: a "Food day" preset whose stops link to picks. Needs: approval of the `TripItem` change (food ref); works best after meal slots exist.
- **Numbers and prices helper**: type digits, get large Chinese, zhuyin and 🔊 for prices, counts, bus numbers and times. Needs: Taiwanese usage confirmed (塊 vs 元, 兩 before 百/千/萬, how a 1 is read in bus and room numbers) and the "please write it down" phrase with zhuyin.
- **Save to an offline map app (KML/GPX)**: export places and the day plan for Organic Maps or OsmAnd. Needs: a try-out of Organic Maps on his phone (Taiwan offline walking and transit routing are unverified), the decision to recommend it in `data/apps.json`, and coordinates for any food pick that should appear.
- **Before-you-fly checklist and "ready offline" check**: a checklist and a status line on Explore. Needs: iOS and Android install wording, every factual line verified (Google Maps offline areas, Translate packs, the iOS storage rule), `data/apps.json`, where it appears, and a test on real phones once hosting is decided.
- **Dish glossary with "contains" flags**: pork, beef, seafood, organ, blood and peanut flags per dish and an owner-picked glossary. Needs: 20 to 30 dishes with descriptions, each flag checked against a source (unknowns left empty), zhuyin if dishes get pronunciation blocks.
- **Show card taxi lines** (the rest of the show-card upgrade): a row of extra taxi phrases under the driver card. Needs: which lines, with wording and zhuyin (is "please use the meter" needed or rude), and a listening test of each place's name and address on a real phone, adding `tts` respellings where wrong.
- **Atomic app updates** (the rest of the boot watchdog item): serve shell files cache-first and update them as a set, with a hash of the SHELL files in `sw.js`. Needs: a decision to accept that every code commit updates the hash constant (by a test or written by the build).

## Needs the owner (decisions or review)

- **Review the two places marked "pending owner review"**: `duiyue-gate`, `tainan-coral-stone-house`. Once reviewed, the marker can be dropped from `metadata.generated_by`.
  - 兌悅門: the heritage question is resolved. The Ministry of Culture announced on 2023-01-11 that six gate and wall sites were merged into the national monument, renamed 臺灣府城城門及城垣殘蹟 (per a Tainan City Cultural Affairs Bureau report, added to the place's sources). The note in [notes/tainan.md](notes/tainan.md) already says so.
  - 硓𥑮石芳宅: still open are the build year (1926 or the 1930s), the house number (15 or 17) and the coordinates, which are approximated from 兌悅門. See [notes/tainan.md](notes/tainan.md).
- **Most-used phrase list** (8 phrases, `"top": true` in `data/phrases.json`).
- City items to decide: see [notes/tainan.md](notes/tainan.md), [notes/taipei.md](notes/taipei.md), [notes/changhua.md](notes/changhua.md).

## Phrases

- Done: situational "sightseeing" phrases (tickets, photos, closing time, English introduction) and food extras (table for two, English menu, recommendations); "useful here" skips generic phrases and skips ticket phrases at free places.
- 兌悅門 is open all day but still gets "what time do you close?": a place-level "always open" flag would fix it. The flag goes into the data by the owner; skipping closing-time phrases for it in `phrasesForPlace` is **(agy)**.
- Mispronunciations by the device voice: listen on a phone; add a `tts` respelling where needed.
- Zhuyin and per-symbol romanization were enlarged on phones; confirm on a real phone.

## Places

- `scripts/generate_spot.py` asks for must-see reasons, with stricter no-invention rules; its output is marked "pending owner review".
- Researched content (agy or Gemini) must be checked against sources before merging; `npm run check:sources` automates the quote check once claims files exist in `docs/claims/`.
- Knowledge topics: see Status, Planned.

## Food picks

- Names are Chinese only; an English line per pick (what it is / what to order) would help European readers.
- No coordinates: picks aren't sorted by distance; Navigate searches Google Maps by name. Candidate coordinates for the Tainan picks are in [notes/tainan.md](notes/tainan.md) (owner to confirm).

## App

- Test on real phones: needs an https URL (GitHub Pages or similar). Deferred, see Infra; ask the owner before publishing anything.
- The place page can show a photo, but no place has one yet: add `photo` `{ src, author, license, ... }` per place (licensing; the credit is mandatory).
- Learn and Apps pages are built but empty: `data/topics/<id>.json` and `data/apps.json` are still to be written.

## Infra

- CI (GitHub Actions) and GitHub Pages: deferred by the owner (2026-10-12).
- `scripts/generate_spot.py` writes straight to `data/attractions/` and runs the build, which bypasses notes-before-data: make it write a draft outside `data/` instead.
