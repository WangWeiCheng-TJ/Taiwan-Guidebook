# Taiwan Guidebook

臺灣離線旅遊指南與歷史景點開放資料

An offline travel guide for visitors to Taiwan, built as a Progressive Web App, plus an open dataset of Taiwan's historic places in Traditional Chinese and English. It is written for a handful of friends and colleagues travelling from Europe; the data is open for anyone to reuse.

## Features

The app (`app/`) works offline once loaded and can be installed from the browser ("Add to Home Screen"). Tabs:

- **Explore**: a small set of historic places (Taipei, New Taipei, Tainan, Changhua), sorted by distance from your GPS position or a city you pick, filterable by city; today's stops if you loaded a plan; the owner's food picks for cities that have them.
- **Place page**: summary, must-see spots with a tap-to-read reason, etiquette, transport, best time to visit, history and timeline; navigation links (Google Maps, Apple Maps); a "show to driver" card with the Chinese address; suggested phrases for that kind of place; "Copy for AI" with the full entry.
- **My trip**: a personal log (place or free text, stars, a one-line note) kept on the device, with JSON export and import; a day-by-day plan, loaded from a `?trip=<https URL>` link or pasted back from an AI's answer.
- **Ask AI**: builds a prompt from nearby places (or an area you plan to visit), your log, your plan and the food picks, and copies it for the AI chat of your choice. No API key, no account.
- **Phrases**: by situation (most used, sightseeing, food, transport, shopping, emergency, basics), each in Chinese with zhuyin, per-symbol romanization and spoken tones, read aloud by the device voice or shown full screen.
- **Tips**: practical advice on transport, money, safety, daily life and culture.
- Select any text in the app to ask an AI what it means in context.
- English or Traditional Chinese UI, switchable at any time. Place content, phrases and tips are bilingual; food pick names are Chinese only (some picks have an English dish name).

## Run locally

Requirements: [Node.js](https://nodejs.org/) 22+ and [uv](https://docs.astral.sh/uv/) (it fetches Python 3.12 when needed). Don't call a bare `python`: every command goes through uv.

```bash
npm run build   # validate data/ and write app/data/guidebook.json and data/taiwan_attractions.json
npm test        # JS tests (node:test) and Python tests
```

Serve `app/` on localhost (the service worker needs localhost or https), then open http://localhost:8765:

```bash
uv run --no-project --python 3.12 python -m http.server 8765 --directory app
```

The same server is the `app` configuration in `.claude/launch.json`.

## Repository layout

```
app/       the PWA: index.html, app.css, sw.js, js/ (ES modules), data/guidebook.json (built)
data/      source data: attractions/<id>.json, phrases.json, tips.json, food/<city>.json,
           and the built public dataset taiwan_attractions.json
schema/    attraction.schema.json
scripts/   build_dataset.py (validate and build), generate_spot.py (Gemini draft of a place),
           migrate_i18n.py (converter to per-language data, for the T4b switch)
tests/     core/ (JS), py/ (Python); tasks/ appears only while a delegated task is open
docs/      ARCHITECTURE.md, SPEC.md, BACKLOG.md, notes/ (per-city notes, in Chinese)
```

## Open dataset

`data/taiwan_attractions.json` holds every place: name, location with coordinates, category, historical eras, year established, heritage status, summary, history, timeline, cultural significance and a visitor guide, each in Traditional Chinese and English (except the best time to visit, English only). The structure is defined in `schema/attraction.schema.json`.

JavaScript:

```javascript
const url = 'https://raw.githubusercontent.com/WangWeiCheng-TJ/Taiwan-Guidebook/main/data/taiwan_attractions.json';
const db = await fetch(url).then(r => r.json());
console.log(`${db.attractions.length} places`);
for (const spot of db.attractions) {
  console.log(`[${spot.eras.join(', ')}] ${spot.name.en} (${spot.location.city_en})`);
}
```

Python:

```python
import json
import urllib.request

url = "https://raw.githubusercontent.com/WangWeiCheng-TJ/Taiwan-Guidebook/main/data/taiwan_attractions.json"
with urllib.request.urlopen(url) as response:
    db = json.load(response)

for spot in db["attractions"]:
    print(f"{spot['name']['zh_TW']} ({spot['name']['en']}), established {spot.get('established_year', '?')}")
```

The `main` branch is the release branch; the URL above always serves the last release.

## Adding a place

`scripts/generate_spot.py` asks the Gemini API for a draft entry that follows the schema. It needs a Gemini API key ([Google AI Studio](https://aistudio.google.com/app/apikey)): copy `.env.example` to `.env` and set `GEMINI_API_KEY`.

```bash
uv run --no-project --python 3.12 python scripts/generate_spot.py "安平古堡"
uv run --no-project --python 3.12 python scripts/generate_spot.py --file scripts/sample_spots.txt
uv run --no-project --python 3.12 python scripts/generate_spot.py --interactive
```

It writes `data/attractions/<id>.json` (`--overwrite` to replace an existing one) and reruns the build. The draft is marked "pending owner review" in `metadata.generated_by`: language models invent dates and designations, so check every fact against its sources, leave out what you cannot verify, then run `npm run build` (full schema validation) and `npm test` before committing.

## Contributing and status

This is a small personal project. If something is wrong (closed, moved, a changed rule), let the owner know; corrections are made by hand. Design decisions: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). What is done and what is next: [docs/BACKLOG.md](docs/BACKLOG.md). Rules for implementers: [docs/SPEC.md](docs/SPEC.md).

## License

- Code: MIT, see [LICENSE](LICENSE).
- The sources of each place are listed in its `metadata` (`sources` URLs, or `source` in older entries).
- Data: `data/` (and the bundle built from it, `app/data/guidebook.json`) is licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
