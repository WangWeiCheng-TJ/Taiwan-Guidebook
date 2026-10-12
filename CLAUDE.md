# Taiwan Guidebook

Offline travel guide PWA (`app/`) built from JSON data (`data/`). Design and decisions: `docs/ARCHITECTURE.md`. Rules and module map for implementers: `docs/SPEC.md`. Delegation workflow: `.claude/skills/delegate-and-gate/SKILL.md`. Status and open items: `docs/BACKLOG.md`.

Talk to the owner in Traditional Chinese (Taiwan). Code, commits and docs stay in English.

## Python on this machine (read this first)

`python` / `python3` in a Claude shell resolve to the **Microsoft Store stub** (`%LOCALAPPDATA%\Microsoft\WindowsApps\python.exe`), which does nothing. The owner's Anaconda Python (`D:\Program\python.exe`, 3.11) is only on PATH in their own terminal, because their PowerShell profile runs `conda init`; Claude's shells don't load that profile.

So **never call bare `python`**. Use, in this order:

```bash
npm run build      # = uv run --no-project --with "jsonschema>=4.20,<5" --python 3.12 python scripts/build_dataset.py
npm run test:py    # = uv run --no-project --python 3.12 python -m unittest discover -s tests/py
uv run --no-project --python 3.12 python <script.py>   # anything else
```

`uv` is on PATH and has CPython 3.12 installed. Fallback if `uv` is missing: `D:/Program/python.exe`.

## Notes before data

When the owner mentions a new place, dish, tip or open question, **write it in `docs/notes/<city>.md` first** (Chinese, one file per city; create the file and add it to `docs/notes/README.md` for a new city). Don't edit `data/` unless the owner asks for it: they integrate notes into the data themselves. Ask what an unfamiliar word means rather than guessing (e.g. 魚冊 is a hot pot ingredient, not a source). App or cross-city items go in `docs/BACKLOG.md`.

## After any change to `data/`

Run `npm run build` (validates the schema, categories and food kinds; regenerates `app/data/guidebook.json` and `data/taiwan_attractions.json`) and then `npm test` (also checks phrase zhuyin alignment, and that the committed bundle matches `data/`: `tests/py/test_bundle_fresh.py`). Don't commit data changes without a successful build: the app reads the bundle, not the source files.

## Commands

- `npm test`: all JS tests (`tests/**`) and Python tests
- `npm run test:core`: JS contract tests only
- `npm run agy -- run|gate|queue|finish`: delegate to Antigravity CLI (see `.claude/skills/delegate-and-gate/SKILL.md`)
- Local preview: `.claude/launch.json` serves `app/` on port 8765

## Branches

- Work on `feat/pwa-poc`. `main` is the release branch: the README's raw-data URL points at it.
- Release only after `npm test` passes and `npm run agy -- queue` says the review queue is empty: `git push origin feat/pwa-poc:main` (fast-forward). Never `git branch -f main`.
- After merging a delegated task, run `npm run agy -- finish --task X` (removes its worktree, branch and report).

## Rules that bite

- New file under `app/` → add it to `SHELL` in `app/sw.js` and bump `CACHE` (a test enforces the list).
- Food pick `kind` must be in `FOOD_KINDS` in `scripts/build_dataset.py` and `app/js/views/food.js`, `FOOD_KIND_EN` in `app/js/prompt.js`, and the `food.<kind>` strings in `app/js/lang.js`; `tests/core/food-kinds.test.js` checks the four agree.
- Attraction `category` must be one of the schema enum (`schema/attraction.schema.json`).
- The repo is public. The owner's shop and place recommendations are fine (in notes and in `data/`). Private trip data never goes in: travel dates, accommodation, companions, day-by-day logs (those stay in each traveler's on-device trip log).
- Researched facts (by agy, Gemini or anyone) are checked against their sources before merging; mark unverified claims, don't publish them.
