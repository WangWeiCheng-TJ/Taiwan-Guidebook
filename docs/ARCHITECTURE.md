# Architecture

Design decisions, starting from the initial discussion (2026-10-10). Read this before changing the overall structure. What is built and what is next: `docs/BACKLOG.md`. Rules and module map for implementers: `docs/SPEC.md`.

## Audience and scale

Colleagues from Europe visiting Taiwan, plus friends and family. Six or fewer users at a time. No rush, no app store, no review process.

## Three kinds of data, three homes

| Data | Written by | Read by | Lives in |
|---|---|---|---|
| Places, phrases, tips, food picks | Owner (with LLM help, owner reviews) | Everyone | This repo, `data/` |
| Trip log: where I went, how it felt | Each traveler | That traveler (and their AI) | The traveler's device (`localStorage`), exportable as JSON |
| Itineraries | Each traveler | That traveler | Their device, or a JSON file at any https URL they control (`?trip=<url>`) |

The repo holds no private trip data, so it can stay public: no travel dates, accommodation, companions or day-by-day logs. The owner's shop and place recommendations are guidebook content and are fine.

## No backend

Considered and rejected:

- **Cloudflare Access + D1** for shared writes. Unnecessary once personal data stays on the device.
- **Supabase**. The free tier pauses projects after a week of inactivity, which is exactly how a travel app is used.
- **A feedback system** (ratings, LLM scoring, daily auto-updates). Most feedback is taste ("too salty", "boring"), which is personal and would mislead the next reader if merged into shared content. Small samples make averages meaningless, and processing feedback is an ongoing chore. Factual errors (closed, moved, wrong rule) are reported by message and fixed by hand.

## Personal preferences flow to the traveler's own AI

Instead of feedback, each traveler keeps a short daily log (place or free text, optional stars, one-line note). The **Ask AI** screen builds a prompt from:

1. Guidebook places near the traveler (GPS) or in an area they plan to visit today or tomorrow.
2. Their trip log, so likes and dislikes travel with every question.
3. Their plan for that day, if they loaded one, and the owner's food picks for the city.
4. Their question.

The prompt is copied to the clipboard and pasted into whatever AI they use (ChatGPT, Claude, Gemini). No API keys, no cost. The same idea covers any text in the app: select it and an "Ask AI" bar copies a short "what does this mean here?" prompt with its context.

Only summaries go into the area prompt. A full place entry is about 8-9 KB minified with both languages; pasting the whole database stops working at a few dozen places. Full detail for one place is a separate "Copy for AI" button on that place.

## App: offline PWA

`app/` is a static Progressive Web App: installable from the browser ("Add to Home Screen"), works offline through a service worker, refreshes data in the background when online and tells the user when the guide changed.

- iOS Safari may clear storage for sites not added to the Home Screen after about a week of non-use. Tell users to install it.
- Maps: navigation is a deep link to Google Maps / Apple Maps. "What's near me" is a GPS distance sort, which works offline; without GPS the user picks a city. An embedded map (Leaflet + OSM) would be optional and online-only.
- Language: the UI is English or Traditional Chinese, switchable at any time; content shows in the chosen language and falls back to English. Phrases always show Chinese with zhuyin, per-symbol romanization and spoken tones, because they are meant to be shown or read aloud to locals.

## Content pipeline

Sources, edited in git by hand or with LLM help:

- `data/attractions/<id>.json`: one place each, validated against `schema/attraction.schema.json`.
- `data/phrases.json`, `data/tips.json`.
- `data/food/<city>.json`: the owner's food picks per city.

`scripts/build_dataset.py` validates them and writes two outputs:

- `app/data/guidebook.json`: the offline bundle the app reads. Its `version` is a hash of the content, so the app notices new content.
- `data/taiwan_attractions.json`: the public open dataset (attractions only).

The app reads only the bundle, so it is committed, and `npm test` fails when it no longer matches `data/` (`tests/py/test_bundle_fresh.py`).

`scripts/generate_spot.py` drafts a new place with the Gemini API. Its output is marked "pending owner review": researched facts are checked against the listed sources before they are published. New information from the owner goes into `docs/notes/<city>.md` first and is integrated into `data/` by the owner.

## Must-see with reasons

`foreign_visitor_guide.must_see` = `[{ name: {en, zh_TW}, why: {en, zh_TW} }]`, one item per `must_see_spots_*` entry in the same order, shown tap-to-expand. The reasons are factual claims and are reviewed like the rest of the entry. Entries without `must_see` fall back to the plain `must_see_spots_*` list.

## Knowledge topics

General articles to read before the trip or anytime, e.g. Taiwanese folk religion, Wenchang / Kuixing (gods of exams), temple layout, Qing-era academies. Shape: `data/topics/<id>.json` with `title` and `body` per language, `tags`, and `places` (ids). A place would link to topics that share its tags (Chihkan Tower's `kuixing_exam_deity` → the Wenchang topic), and a "Learn" section would list all topics. Content first, then UI.

## Code structure and handoff

`app/js/` is split into small ES modules with JSDoc contracts; views are pure functions from state to HTML, and only `main.js` mutates state or writes storage (`ui.js`, `storage.js` and the fetch helpers wrap the browser APIs; module map: `docs/SPEC.md`). `tests/core/` covers the logic modules (views, `state.js`, `storage.js`, `ui.js` and `main.js` are checked in the browser) and the data the app depends on (phrase zhuyin alignment, food kinds, must-see reasons, the service worker file list); `tests/py/` covers the i18n converter and checks the committed bundle against `data/`. Work that can be specified function by function is handed to another agent: Claude writes the stub and contract tests in `tests/tasks/`, the worker implements, a gate script checks it mechanically (`.claude/skills/delegate-and-gate/SKILL.md`). `tests/tasks/` holds contracts only while a delegated task is open; finished tests move to `tests/core/`.

## Roadmap

The order the design grows in. Status of each step: `docs/BACKLOG.md`.

1. **POC:** offline PWA, places with distance sort, place detail, show-to-driver, navigation links, trip log with export/import, phrases, tips, Ask AI (near me / plan a day).
2. **Itineraries:** load a plan from `?trip=<https url>` or paste the AI's answer back (Ask AI, "Ask for a plan I can paste back"); the plan shows on My trip, today's stops on Explore, and feeds later Ask AI prompts.
3. **Two languages:** UI string table with an English / 繁中 switch, per-language lookup building blocks (T4a), then per-language data maps `{ "zh_TW": ..., "en": ... }` across schema, build, generator and app (T4b).
4. **Content depth:** must-see reasons, food picks per city, knowledge topics.
5. **Later:** a `story` type linking several places; an optional embedded map; more languages.
