# Architecture

Decisions from the initial design discussion (2026-10-10). Read this before changing the overall structure.

## Audience and scale

Colleagues from Europe visiting Taiwan, plus friends and family. Six or fewer users at a time. No rush, no app store, no review process.

## Three kinds of data, three homes

| Data | Written by | Read by | Lives in |
|---|---|---|---|
| Places, stories, phrases, tips | Owner (with LLM help, owner reviews) | Everyone | This repo, `data/` |
| Trip log: where I went, how it felt | Each traveler | That traveler (and their AI) | The traveler's device (`localStorage`), exportable as JSON |
| Itineraries | Each traveler | That traveler | Their device, or their own repo/gist (phase 2) |

The repo contains no personal data, so it can stay public. Do not put trip logs, hotel addresses or travel dates in this repo.

## No backend

Considered and rejected:

- **Cloudflare Access + D1** for shared writes. Unnecessary once personal data stays on the device.
- **Supabase**. The free tier pauses projects after a week of inactivity, which is exactly how a travel app is used.
- **A feedback system** (ratings, LLM scoring, daily auto-updates). Most feedback is taste ("too salty", "boring"), which is personal and would mislead the next reader if merged into shared content. Small samples make averages meaningless, and processing feedback is an ongoing chore. Factual errors (closed, moved, wrong rule) are reported by message and fixed by hand.

## Personal preferences flow to the traveler's own AI

Instead of feedback, each traveler keeps a short daily log (place or free text, optional stars, one-line note). The **Ask AI** screen builds a prompt from:

1. Guidebook places near the traveler (GPS) or in an area they plan to visit tomorrow.
2. Their trip log, so likes and dislikes travel with every question.
3. Their question.

The prompt is copied to the clipboard and pasted into whatever AI they use (ChatGPT, Claude, Gemini). No API keys, no cost.

Only summaries go into the area prompt. A full place entry is about 7.6 KB bilingual; pasting the whole database stops working at a few dozen places. Full detail for one place is a separate "Copy for AI" button on that place.

## App: offline PWA

`app/` is a static Progressive Web App: installable from the browser ("Add to Home Screen"), works offline through a service worker, refreshes data in the background when online.

- iOS Safari may clear storage for sites not added to the Home Screen after about a week of non-use. Tell users to install it.
- Maps: navigation is a deep link to Google Maps / Apple Maps. "What's near me" is a GPS distance sort, which works offline. An embedded map (Leaflet + OSM) is optional and online-only.

## Content pipeline

`data/attractions/*.json`, `data/phrases.json`, `data/tips.json` are edited in git (by hand or via `scripts/generate_spot.py`). `scripts/build_dataset.py` validates and writes `app/data/guidebook.json`, whose `version` hash lets the app notice new content.

## Code structure and handoff

`app/js/` is split into small ES modules with JSDoc contracts. Pure logic (`util`, `geo`, `triplog`, `prompt`) is covered by `tests/core/`. Remaining work is specified function by function in `docs/SPEC.md`, with stubs in the code and contract tests in `tests/tasks/` and `tests/py/`, so it can be implemented by another agent and checked mechanically.

## Phases

1. **POC (done):** offline PWA, places with distance sort, place detail, show-to-driver, navigation links, trip log with export/import, phrases, tips, Ask AI (near me / plan a day).
2. **Itineraries (done):** load a plan from `?trip=<https url>` or paste the AI's answer back (Ask AI, "Ask for a plan I can paste back"); plan shown on My trip, today's stops on Explore, and fed into later Ask AI prompts. T4a i18n building blocks pending (`docs/SPEC.md`).
3. **Knowledge topics (planned, not built):** general articles to read before the trip or anytime, e.g. Taiwanese folk religion, Wenchang / Kuixing (gods of exams), temple layout, Qing-era academies. Shape: `data/topics/<id>.json` with `title` and `body` per language, `tags`, and `places` (ids). A place links to topics that share its tags (Chihkan Tower's `kuixing_exam_deity` → the Wenchang topic), and a "Learn" section lists all topics. Content first, then UI.
4. **Must-see with reasons (UI done, data partial):** `foreign_visitor_guide.must_see` = `[{ name: {en, zh_TW}, why: {en, zh_TW} }]`, shown tap-to-expand. Only Chihkan Tower has it; others fall back to `must_see_spots_*`. Next: have `scripts/generate_spot.py` produce `must_see` and backfill the other places (review the reasons; they are factual claims).
5. Later: T4b switch data to per-language maps (`{ "zh_TW": ..., "en": ... }`); `story` type linking several places; optional embedded map.
