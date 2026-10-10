# Implementation spec

For any agent (human or AI) implementing tasks in this repo. Read `docs/ARCHITECTURE.md` first for the why.

## Ground rules

1. **Contracts are fixed.** Exported function names, parameters and return shapes in `app/js/` and `scripts/` are defined in JSDoc / docstrings. Do not change them. If one seems wrong, stop and ask the owner.
2. **Tests are the contract.** Never edit existing tests in `tests/core/`, `tests/tasks/` or `tests/py/` to make them pass. You may add new tests.
3. **No dependencies, no build step.** Vanilla ES modules in the browser, Node's built-in `node:test`, Python standard library only.
4. **Views are pure**: `(state) => HTML string`, no side effects, no listeners. Interactive elements declare `data-action` / `data-change` / `data-input`; `app/js/main.js` dispatches them. Only `main.js` mutates `state` or writes storage.
5. **Escape everything.** Any data inserted into HTML goes through `esc()` from `app/js/util.js`.
6. **Offline.** Every new file under `app/` must be added to `SHELL` in `app/sw.js`, and `CACHE` bumped (`tg-v1` to `tg-v2`, ...). `tests/core/sw-shell.test.js` fails if you forget the list.
7. **No personal data in the repo.** No trip logs, real itineraries, hotel addresses or travel dates.
8. **English only in the UI** for now. Content strings come from data.

### Definition of done

```bash
npm test
```

```bash
uv run --no-project --python 3.12 python -m unittest discover -s tests/py
```

Both green, plus the manual checks listed under the task. To run the app locally, serve `app/` on localhost (for example `python -m http.server 8765 --directory app`; a service worker needs localhost or https).

## Module map (`app/js/`)

| Module | Kind | Responsibility |
|---|---|---|
| `types.js` | types only | All shared shapes (`Place`, `LogEntry`, `AskContext`, `Trip`, ...) |
| `util.js` | pure | `esc`, `clip`, dates, `stars`, `titleCase` |
| `geo.js` | pure | `km`, `fmtKm`, `distanceTo`, `sortByDistance`, `mapsLinks` |
| `data.js` | pure + fetch | `loadGuidebook`, `placeById`, `cities`, `districtsOf` |
| `storage.js` | side effect | `readJSON`, `writeJSON` (never throw) |
| `triplog.js` | pure | Personal log: validate, make, remove, export, import, day numbers, grouping |
| `prompt.js` | pure | Ask AI text: `buildAskPrompt(AskContext)`, `buildPlacePrompt`, area and nearby selection |
| `state.js` | state | The single `state` object, `places()` |
| `ui.js` | DOM | `toast`, `copyText`, `showBig`, `hideBig`, `speak` |
| `views/*.js` | pure | One render function per screen |
| `main.js` | wiring | Router, event dispatch, persistence, service worker registration |
| `trip.js` | **T1 stub** | Itineraries |
| `aiplan.js` | **T2 stub** | Paste an AI answer back as a trip |
| `i18n.js` | **T4a stub** | Per-language text lookup |

Routes: `#/explore`, `#/place/<id>`, `#/log`, `#/log/<placeId>` (prefills the form), `#/ask`, `#/phrases`, `#/tips`.

Storage keys: `tg.log.v1` (LogEntry[]), `tg.trip.v1` (Trip, from T3).

## Tasks

Do them in order. T1, T2 and T4a are pure functions with contract tests; T3 is UI wiring with manual checks.

### T1: itineraries (`app/js/trip.js`)

Implement every function in the file. The JSDoc on each function is the spec; `tests/tasks/trip.test.js` is the contract.

| Function | Input | Output |
|---|---|---|
| `parseTrip(raw)` | untrusted JSON value | `{ trip: Trip \| null, errors: string[] }`; cleaned copy, days sorted |
| `resolveItem(item, places)` | `TripItem`, `Place[]` | `{ place: Place \| null, label: string, missing: boolean }` |
| `tripDayFor(trip, date)` | `Trip`, `YYYY-MM-DD` | `TripDay \| null` |
| `tripUrlFrom(search)` | `location.search` | https URL string or `null` |
| `loadTrip(url, fetchFn?)` | URL | `Promise<{ trip, errors }>`, never throws |
| `tripBlock(trip, places, date)` | `Trip`, `Place[]`, date | prompt text for that day, `""` if none |

Done when: `npm run test:tasks` shows `trip.test.js` green.

### T2: paste-back (`app/js/aiplan.js`)

| Function | Input | Output |
|---|---|---|
| `planRequestSuffix()` | none | instruction text asking the AI for one ` ```json ` block in the Trip shape |
| `extractJsonBlock(text)` | AI answer | raw JSON text or `null` |
| `planFromAiText(text, places)` | AI answer, `Place[]` | `{ trip, errors }`; names matched to guidebook ids |

Done when: `aiplan.test.js` green.

### T3: trip UI (wiring T1 + T2 into the app)

Contract changes allowed in this task, and only these:

- `types.js`: `AskContext` gains `trip: Trip | null` and `wantPlan: boolean`.
- `state.js`: `state.trip` (loaded from `TRIP_KEY` at startup) and `state.ask.wantPlan = false`.
- `prompt.js` `buildAskPrompt`: when `ctx.trip` has a day for the target date (near mode: `ctx.today`; plan mode: today or tomorrow per `ctx.day`), insert `tripBlock(...)` as a paragraph right after the trip log paragraph. When `ctx.wantPlan`, append `planRequestSuffix()` as the last paragraph. Existing `tests/core/prompt.test.js` must stay green (both new fields absent or null/false means the old output); add new tests for the two new paragraphs.

New view `app/js/views/trip.js`:

| Function | Input | Output |
|---|---|---|
| `renderTripSection(s)` | `AppState` | HTML shown at the top of `#/log` |

`renderTripSection` behaviour:
- No trip: heading "My plan", a textarea `data-input="ai-answer"` (placeholder "Paste the AI's answer here"), a button `data-action="paste-plan"`.
- With a trip: trip title; today's day if present, otherwise the next upcoming day, otherwise the last day; each stop as `time label note`, guidebook stops link to `#/place/<id>`, `missing` stops show a small "not in guidebook" badge; buttons `data-action="paste-plan-again"` (shows the textarea again) and `data-action="clear-trip"`.

`main.js` additions:
- On startup: `tripUrlFrom(location.search)`; if present, `loadTrip`, then on success save to `TRIP_KEY`, set `state.trip`, toast "Plan loaded: <title>"; on failure toast the first error and keep any stored trip.
- `paste-plan`: `planFromAiText(textarea value, places())`; on success save and render, on failure toast the first error.
- `clear-trip`: confirm, then remove from storage and state.
- Ask tab: checkbox `data-change="want-plan"` labelled "Ask for a plan I can paste back"; `askContext()` passes `trip` and `wantPlan`.
- `sw.js`: add `js/views/trip.js` to `SHELL`, bump `CACHE`.

Manual checks:
1. Ask AI, Plan a day, tick "Ask for a plan I can paste back", copy. Paste into any AI, copy its whole answer, paste into My trip, Save. The plan shows; guidebook stops are links.
2. Open `/?trip=<https URL of a trip JSON>` once online; then turn the network off and reload: the plan is still there.
3. With a plan for today loaded, Ask AI (Near me now) preview contains "My plan for <today>".
4. Clear the plan; reload; it stays cleared.

### T4a: i18n building blocks (`app/js/i18n.js`, `scripts/migrate_i18n.py`)

| Function | Input | Output |
|---|---|---|
| `t(value, lang?, fallback?)` | string or `{lang: text}` | string |
| `tList(value, lang?, fallback?)` | list or `{lang: list}` | string[] |
| `languagesOf(value)` | `{lang: ...}` | language codes, `en`, `zh_TW` first |
| `merge_lang_pairs(value)` (py) | any JSON value | copy with `X_zh`/`X_en` merged to `X: {zh_TW, en}` |
| `migrate_attraction(old)` (py) | attraction dict | schema v2 dict, idempotent |
| `main(argv)` (py) | CLI args | exit code; dry run unless `--write` |

Done when: `i18n.test.js` and `tests/py` green. **Do not run the migration on `data/` and do not switch the app to the new format.** That is T4b, which changes the schema, the build script, the Gemini generator prompt and most of the app at once, and will be planned separately.

## Not in scope yet

T4b (switch everything to per-language data), a `story` content type linking several places, an embedded map, more languages. Ask before starting any of these.
