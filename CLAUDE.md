# Taiwan Guidebook

Offline travel guide PWA (`app/`) built from JSON data (`data/`). Design and decisions: `docs/ARCHITECTURE.md`. Function contracts and delegation workflow: `docs/SPEC.md`. Open items: `docs/BACKLOG.md`.

Talk to the owner in Traditional Chinese (Taiwan). Code, commits and docs stay in English.

## Python on this machine (read this first)

`python` / `python3` in a Claude shell resolve to the **Microsoft Store stub** (`%LOCALAPPDATA%\Microsoft\WindowsApps\python.exe`), which does nothing. The owner's Anaconda Python (`D:\Program\python.exe`, 3.11) is only on PATH in their own terminal, because their PowerShell profile runs `conda init`; Claude's shells don't load that profile.

So **never call bare `python`**. Use, in this order:

```bash
npm run build      # = uv run --no-project --python 3.12 python scripts/build_dataset.py
npm run test:py    # = uv run --no-project --python 3.12 python -m unittest discover -s tests/py
uv run --no-project --python 3.12 python <script.py>   # anything else
```

`uv` is on PATH and has CPython 3.12 installed. Fallback if `uv` is missing: `D:/Program/python.exe`.

## Notes before data

When the owner mentions a new place, dish, tip or open question, **write it in `docs/notes/<city>.md` first** (Chinese, one file per city; create the file and add it to `docs/notes/README.md` for a new city). Don't edit `data/` unless the owner asks for it: they integrate notes into the data themselves. Ask what an unfamiliar word means rather than guessing (e.g. 魚冊 is a hot pot ingredient, not a source). App or cross-city items go in `docs/BACKLOG.md`.

## After any change to `data/`

Run `npm run build` (regenerates `app/data/guidebook.json` and validates: categories, food kinds, phrase zhuyin counts) and then `npm test`. Don't commit data changes without a successful build: the app reads the bundle, not the source files.

## Commands

- `npm test`: all JS tests (`tests/**`) and Python tests
- `npm run test:core`: JS contract tests only
- `npm run agy -- run|gate|queue`: delegate to Antigravity CLI (see `.claude/skills/delegate-and-gate`)
- Local preview: `.claude/launch.json` serves `app/` on port 8765

## Rules that bite

- New file under `app/` → add it to `SHELL` in `app/sw.js` and bump `CACHE` (a test enforces the list).
- Food pick `kind` must be in `FOOD_KINDS` in `scripts/build_dataset.py`, `app/js/views/food.js`, `app/js/prompt.js` and the `food.<kind>` strings in `app/js/lang.js`.
- Attraction `category` must be one of the schema enum (`schema/attraction.schema.json`).
- The repo is public: no personal notes, reviews, trip logs, hotel addresses or travel dates.
- Researched facts (by agy, Gemini or anyone) are checked against their sources before merging; mark unverified claims, don't publish them.
