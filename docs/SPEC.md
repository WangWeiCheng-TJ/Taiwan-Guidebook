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
| `types.js` | types only | Shared shapes (`Place`, `Phrase`, `Tip`, `Guidebook`, `Pos`, `LogEntry`, `AskContext`, `PhotoContext`, `PhotoShop`, `Trip`, ...). Changing one is a contract change |
| `util.js` | pure | `esc`, `clip`, `today`, `nowTime` (local HH:MM), `addDays`, `daysBetween`, `stars`, `titleCase` |
| `geo.js` | pure | `km`, `fmtKm`, `distanceTo`, `gpsDistance` (the distance shown: GPS only, never from a picked city), `sortByDistance`, `mapsLinks`, `osmEmbedUrl`, `osmLink` |
| `data.js` | pure + fetch | `loadGuidebook`, `placeById`, `cities`, `districtsOf`, `cityCenter`, `foodFor`, `foodMapsLink` |
| `storage.js` | side effect | `readJSON`, `writeJSON` (never throw) |
| `i18n.js` | pure | Per-language lookup: `t`, `tList`, `languagesOf`, `DEFAULT_LANG` |
| `lang.js` | pure | UI string tables and content accessors: `LANGS`, `LANG_KEY`, `initialLang`, `tr`, `trMsg`, `localized`, `localizedList`, `otherLang` |
| `zhuyin.js` | pure | Zhuyin per symbol: `ZHUYIN_ROMAN`, `parseSyllable`, `alignZhuyin`, `spokenTones` (tone sandhi) |
| `phrases.js` | pure | `PHRASE_GROUPS` (Phrases tab tiles), `phrasesIn`, `phrasesForPlace`, `mainGroupForPlace` |
| `party.js` | pure | Party size: `PARTY_KEY`, `PARTY_MIN`, `PARTY_MAX`, `clampParty`, `partyChosen` (stored = set by the traveler; the prompt names the party only then), `numberWord`, `withParty` |
| `triplog.js` | pure | Personal log: `LOG_KEY`, `EXPORT_TYPE`, `emptyDraft`, `draftDate` (a draft date of "" follows today), `validateDraft`, `newId`, `makeEntry`, `removeEntry`, `exportPayload`, `mergeImport`, `firstDate`, `dayNumber`, `entryName`, `groupByDate`, `notesFor` |
| `trip.js` | pure + fetch | Itineraries: `TRIP_KEY`, `parseTrip` (days sharing a date are merged), `resolveItem`, `tripDayFor`, `nextStop` (the stop after the last one whose time has passed), `defaultTripDate`, `tripUrlFrom`, `loadTrip`, `tripBlock` |
| `aiplan.js` | pure | Paste an AI answer back as a trip: `planRequestSuffix`, `extractJsonBlock` (skips the request's own example, so a paste that holds the request still works), `planFromAiText` |
| `prompt.js` | pure | Ask AI text: `areaOptions`, `areaLabel`, `areaPlaces`, `nearPlaces`, `defaultQuestion`, `placeBrief`, `logBlock`, `buildAskPrompt`, `buildPlacePrompt`, `buildExplainPrompt` (selected text), `foodBlock`, `PHOTO_KINDS`, `buildPhotoPrompt` ("Ask AI about a photo": menu, sign, board, machine, label; the traveler attaches the photo in their AI chat) |
| `state.js` | state | The single `state` object (`partySet`: a party size is stored; `draft.date` "" follows today; `pasteText`: the paste box, kept across re-renders; `ask.mode` `'photo'` with `ask.photo` (a `PHOTO_KINDS` id) and `ask.photoNote`, not stored), `places()` |
| `nav.js` | pure | Routing and history decisions: `ROUTES`, `PARENT_TAB`, `parseRoute` (malformed escapes kept as typed; unknown routes are Explore), `activeTab`, `entryKey`, `withKey`, `scrollFor` (Back restores the scroll position), `entryOverlays`, `withOverlays`, `overlayChange` (Back closes the top sheet or big card), `focusSelector` (refocus a control after a re-render) |
| `bigcard.js` | pure | The show card (`showBig`): `bigCardHtml` (white panel on a dimmed backdrop: 🔊, rotate-180° toggle and Close above the text), `SAY_RATE`, `SLOW_RATE`, `REPEAT_MS`, `sayRate` (a second 🔊 tap within a few seconds reads slowly), `wakeKeeper` (Screen Wake Lock, browser API passed in; a silent no-op where missing or refused) |
| `ui.js` | DOM | `toast` (#toast is a status live region that stays in the page), `copyText`, `showBig` (`{ say }`: what 🔊 reads; keeps the screen awake until `hideBig`), `hideBig`, `wakeAgain` (on visibilitychange), `flipBig`, `sayOnCard`, `speak` (optional rate), `openSheet`, `closeSheet` |
| `main.js` | wiring | Router, event dispatch, persistence (a failed write shows `storageFail` instead of the success message), language switch, history (scroll and focus per entry; each sheet or big card has its own entry, so Back closes it; the page under it is `inert`; the big card closes on Close, Escape, Back or its backdrop, never on a tap on its text), focus after re-renders, the select-text "Ask AI" bar, service worker registration |

Views (`app/js/views/`), all pure:

| Module | Exports |
|---|---|
| `common.js` | `langTag` (`lang=""` value for text in the other language), `placeName`, `cityName`, `locationPanel` (GPS or city picker), `aiLinks` (ChatGPT, Claude, Gemini), `sayButton` |
| `explore.js` | `renderExplore` |
| `place.js` | `renderPlace`, `driverCard`, `driverSay` (what the driver card's 🔊 reads: name and Chinese address) |
| `log.js` | `renderLog` |
| `trip.js` | `renderTripSection` (top of My trip), `renderTodayCard` (top of Explore) |
| `ask.js` | `askContext`, `photoContext` (a food sheet's shop leaves the tab's note out), `currentPrompt` (photo mode: `buildPhotoPrompt`, else `buildAskPrompt`), `questionText`, `renderAsk` (modes Near me now, Plan a day, About a photo) |
| `reference.js` | `zhuyinBlock`, `renderPhrases`, `phraseCardFull`, `phraseCard`, `phraseSay` (the `tts` respelling, else the Chinese), `renderTips` |
| `food.js` | `FOOD_KINDS`, `renderFoodSection`, `foodSheet`, `dishSheet` (both with "Ask AI about the menu", `data-action="ask-menu"`), `foodDriverCard`, `foodDriverSay` (shop name and city), `findPick`, `menuShop` (the pick or dish as a `PhotoShop`), `menuPromptSheet` (the sheet after copying) |

Python (`scripts/`): `build_dataset.py` (validate `data/`, write the bundle and the public dataset), `generate_spot.py` (Gemini draft of a place), `migrate_i18n.py` (schema v1 to per-language maps; for T4b, not run on `data/`).

Routes: `#/explore`, `#/place/<id>`, `#/log`, `#/log/<placeId>` (prefills the form), `#/ask` (its mode, including About a photo, is state, not route), `#/phrases`, `#/phrases/<group>` (a `PHRASE_GROUPS` id), `#/tips`, `#/apps`, `#/learn`, `#/learn/<topicId>`. An unknown route shows Explore and becomes `#/explore`. Query: `?trip=<https URL>` loads a plan once.

Accessibility rules for views: text in the language other than the UI's gets `lang="${langTag(...)}"`; labels (`aria-label`, `title`) come from `lang.js`; every control is reachable by keyboard (a hidden file input is opened by a `data-action` button).

Storage keys: `tg.log.v1` (`LogEntry[]`), `tg.trip.v1` (`Trip`), `tg.lang.v1` (`'en' | 'zh_TW'`), `tg.party.v1` (number 1..10, written on the first tap of − or +; absent means not set: phrases use 2 and the Ask AI prompt leaves the party out). Not stored: the Ask AI mode, its photo preset and note.

## Tasks

No active tasks; `tests/tasks/` exists only while one is open. Finished task contracts (T1 to T4a) now live as JSDoc in the modules and tests in `tests/core/` and `tests/py/`; git history keeps their spec text (e.g. commits `648cf52`, `4ce297f`). Sample plan for `?trip=`: `docs/sample-trip.json`.

## Not in scope yet

T4b (switch everything to per-language data): **do not run the migration on `data/` and do not switch the app to the per-language format.** T4b changes the schema, the build script, the Gemini generator prompt and most of the app at once, and will be planned separately. Also not yet: a `story` content type linking several places, an embedded map, more languages. Ask before starting any of these.
