# Implementation spec

For any agent (human or AI) implementing tasks in this repo: the rules, the module map and the active task contracts. Read `docs/ARCHITECTURE.md` first for the why. Status and open items: `docs/BACKLOG.md`.

## Ground rules

1. **Contracts are fixed.** Exported function names, parameters and return shapes in `app/js/` and `scripts/` are defined in JSDoc / docstrings. Do not change them. If one seems wrong, stop and ask the owner.
2. **Tests are the contract.** Never edit existing tests in `tests/core/`, `tests/tasks/` or `tests/py/` to make them pass. You may add new tests.
3. **No dependencies, no bundler.** `app/` is vanilla ES modules served as is; JS tests use Node's built-in `node:test`; Python scripts use the standard library (the one exception: `npm run build` adds `jsonschema` through uv for full schema validation).
4. **Views are pure**: `(state) => HTML string`, no side effects, no listeners. Interactive elements declare `data-action` / `data-change` / `data-input`; `app/js/main.js` dispatches them. Only `main.js` mutates `state` or writes storage.
5. **Escape everything.** Any data inserted into HTML goes through `esc()` from `app/js/util.js`.
6. **Offline.** Every new file under `app/` must be added to `SHELL` in `app/sw.js`, and `CACHE` bumped (`tg-v<N>` to `tg-v<N+1>`; the current value is in `app/sw.js`). `tests/core/sw-shell.test.js` fails if you forget the list.
7. **No private trip data in the repo.** No travel dates, accommodation, companions, real itineraries or trip logs. The owner's shop and place recommendations are content and are fine.
8. **Bilingual UI.** UI strings live in `app/js/lang.js` (`en` and `zh_TW` tables, read with `tr(lang, key)`; messages from pure modules with `trMsg`); `tests/core/lang.test.js` fails if an English string has no Chinese one. Content is read through `localized(obj, key, lang)` / `localizedList(...)` from `lang.js`, which handle both data formats and fall back to English.

### Definition of done

```bash
npm run build   # only after a change to data/: validates it, rewrites app/data/guidebook.json and data/taiwan_attractions.json
npm test        # all JS tests (tests/**) and the Python tests (tests/py)
```

All green, plus the manual checks listed under the task. To run the app locally, serve `app/` on localhost (a service worker needs localhost or https): the `app` configuration in `.claude/launch.json` (port 8765), or

```bash
uv run --no-project --python 3.12 python -m http.server 8765 --directory app
```

Never call bare `python` (see `CLAUDE.md`).

## Delegating a task

Claude writes the contract (JSDoc stub + tests in `tests/tasks/`), a worker agent (Antigravity CLI) writes the code, a gate script checks it. How, when, and what not to delegate: `.claude/skills/delegate-and-gate/SKILL.md`. Commands: `npm run agy -- run | gate | queue | finish` (`finish --task X` cleans up a merged task's worktree, branch and report).

## Module map (`app/js/`)

| Module | Kind | Exports |
|---|---|---|
| `types.js` | types only | Shared shapes (`Place`, `Phrase`, `Tip`, `Guidebook`, `Pos`, `LogEntry`, `AskContext`, `Trip`, ...). Changing one is a contract change |
| `util.js` | pure | `esc`, `clip`, `today`, `addDays`, `daysBetween`, `stars`, `titleCase` |
| `geo.js` | pure | `km`, `fmtKm`, `distanceTo`, `sortByDistance`, `mapsLinks` |
| `data.js` | pure + fetch | `loadGuidebook`, `placeById`, `cities`, `districtsOf`, `cityCenter`, `foodFor`, `foodMapsLink` |
| `storage.js` | side effect | `readJSON`, `writeJSON` (never throw) |
| `i18n.js` | pure | Per-language lookup: `t`, `tList`, `languagesOf`, `DEFAULT_LANG` |
| `lang.js` | pure | UI string tables and content accessors: `LANGS`, `LANG_KEY`, `initialLang`, `tr`, `trMsg`, `localized`, `localizedList`, `otherLang` |
| `zhuyin.js` | pure | Zhuyin per symbol: `ZHUYIN_ROMAN`, `parseSyllable`, `alignZhuyin`, `spokenTones` (tone sandhi) |
| `phrases.js` | pure | `PHRASE_GROUPS` (Phrases tab tiles), `phrasesIn`, `phrasesForPlace`, `mainGroupForPlace` |
| `triplog.js` | pure | Personal log: `LOG_KEY`, `EXPORT_TYPE`, `emptyDraft`, `validateDraft`, `newId`, `makeEntry`, `removeEntry`, `exportPayload`, `mergeImport`, `firstDate`, `dayNumber`, `entryName`, `groupByDate`, `notesFor` |
| `trip.js` | pure + fetch | Itineraries: `TRIP_KEY`, `parseTrip`, `resolveItem`, `tripDayFor`, `defaultTripDate`, `tripUrlFrom`, `loadTrip`, `tripBlock` |
| `aiplan.js` | pure | Paste an AI answer back as a trip: `planRequestSuffix`, `extractJsonBlock`, `planFromAiText` |
| `prompt.js` | pure | Ask AI text: `areaOptions`, `areaLabel`, `areaPlaces`, `nearPlaces`, `defaultQuestion`, `placeBrief`, `logBlock`, `buildAskPrompt`, `buildPlacePrompt`, `buildExplainPrompt` (selected text), `foodBlock` |
| `state.js` | state | The single `state` object, `places()` |
| `ui.js` | DOM | `toast`, `copyText`, `showBig`, `hideBig`, `speak`, `openSheet`, `closeSheet` |
| `main.js` | wiring | Router, event dispatch, persistence, language switch, the select-text "Ask AI" bar, service worker registration |

Views (`app/js/views/`), all pure:

| Module | Exports |
|---|---|
| `common.js` | `placeName`, `cityName`, `locationPanel` (GPS or city picker) |
| `explore.js` | `renderExplore` |
| `place.js` | `renderPlace`, `driverCard` |
| `log.js` | `renderLog` |
| `trip.js` | `renderTripSection` (top of My trip), `renderTodayCard` (top of Explore) |
| `ask.js` | `askContext`, `questionText`, `renderAsk` |
| `reference.js` | `zhuyinBlock`, `renderPhrases`, `phraseCardFull`, `phraseCard`, `renderTips` |
| `food.js` | `FOOD_KINDS`, `renderFoodSection`, `foodSheet`, `dishSheet`, `findPick` |

Python (`scripts/`): `build_dataset.py` (validate `data/`, write the bundle and the public dataset), `generate_spot.py` (Gemini draft of a place), `migrate_i18n.py` (schema v1 to per-language maps; for T4b, not run on `data/`).

Routes: `#/explore`, `#/place/<id>`, `#/log`, `#/log/<placeId>` (prefills the form), `#/ask`, `#/phrases`, `#/phrases/<group>` (a `PHRASE_GROUPS` id), `#/tips`. Query: `?trip=<https URL>` loads a plan once.

Storage keys: `tg.log.v1` (`LogEntry[]`), `tg.trip.v1` (`Trip`), `tg.lang.v1` (`'en' | 'zh_TW'`).

## Tasks

No active tasks; `tests/tasks/` exists only while one is open. Finished task contracts (T1 to T4a) now live as JSDoc in the modules and tests in `tests/core/` and `tests/py/`; git history keeps their spec text (e.g. commits `648cf52`, `4ce297f`). Sample plan for `?trip=`: `docs/sample-trip.json`.

## Not in scope yet

T4b (switch everything to per-language data): **do not run the migration on `data/` and do not switch the app to the per-language format.** T4b changes the schema, the build script, the Gemini generator prompt and most of the app at once, and will be planned separately. Also not yet: a `story` content type linking several places, an embedded map, more languages. Ask before starting any of these.
