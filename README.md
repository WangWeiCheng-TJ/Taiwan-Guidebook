# Taiwan Guidebook

臺灣離線旅遊指南與歷史景點開放資料

An offline travel guide for visitors to Taiwan, built as a Progressive Web App, plus an open dataset of Taiwan's historic places in Traditional Chinese and English. It is written for a handful of friends and colleagues travelling from Europe; the data is open for anyone to reuse.

## Features

The app (`app/`) works offline once loaded and can be installed from the browser ("Add to Home Screen"). Tabs:

- **Explore**: a small set of historic places (Taipei, New Taipei, Tainan, Changhua), sorted by distance from your GPS position, or with a city's places first when you pick a city instead (no distances then: a city is not a point), filterable by city; today's stops if you loaded a plan; the owner's food picks for cities that have them.
- **Place page**: summary, must-see spots with a tap-to-read reason, etiquette, transport, best time to visit, history and timeline; navigation links (Google Maps, Apple Maps); a "show to driver" card with the Chinese address; suggested phrases for that kind of place; "Copy for AI" with the full entry.
- **My trip**: a personal log (place or free text, stars, a one-line note) kept on the device; a note keeps its place's name when a guide update drops the place, and the update says which of your logged or planned places it dropped; a day-by-day plan, loaded from a `?trip=<https URL>` link or pasted back from an AI's answer.
- **Backup** (on My trip): one JSON file with your notes, your plan and your party size (never My stay). Export opens the phone's share sheet where the browser can share the file, so it goes to your own chat or mail, and downloads it elsewhere; Import adds the notes on another phone, loads the plan (asking before it replaces a different one) and still reads older notes-only files. "Last backup 3 days ago · 5 notes since" says when you last made one; the app also asks the browser to keep its storage after your first saved note or plan.
- **My stay** (on My trip): paste your hotel's Chinese name and address (and its phone, optionally), one per city. "Take me back", on My trip and on Explore for the stay in your city or nearest to you, shows it on the show card for a taxi driver with 請帶我到這裡 and the phone as a link to call. Kept on the device only: never in an Ask AI question or in the export.
- **Ask AI**: builds a prompt from nearby places (or the places of the city you picked, or an area you plan to visit, typed in English or Chinese), your log, your plan, the food picks and, once you set it, how many of you there are, and copies it for the AI chat of your choice. No API key, no account.
- **Ask AI about a photo** (in Ask AI, and "Ask AI about the menu" on a food pick): pick what the photo shows (a menu, a sign or notice, a departure board or timetable, a ticket machine or form, a food label) and copy a question that asks for exactly what helps there, such as every dish in Chinese and English with pork, beef, seafood, offal, blood and peanuts flagged, an order for your party with a cost estimate and the Chinese to point at, or which train to take to your next planned stop. You attach the photo in your AI chat; the app never sees it and makes no claims about food itself.
- **Ask later** (at the top of Ask AI): every question the app copies (Ask AI, Copy for AI on a place or the timeline, Ask AI about the menu, the select-text explain) is also kept in a short list on the phone, newest first, at most 10, each with a short label such as "About 魁星 · Chihkan Tower" and the time, with Copy and Delete, and Clear all. A question copied with no connection is marked "copied offline"; when the phone is back online the app says how many are waiting and puts a dot on the Ask AI tab. The questions can hold your trip notes, so the list never leaves the phone (not in the backup) and one tap clears it.
- **Phrases**: by situation (most used, sightseeing, food, transport, shopping, emergency, basics), each in Chinese with zhuyin, per-symbol romanization and spoken tones, read aloud by the device voice or shown full screen.
- **Tips**: practical advice on transport, money, safety, daily life and culture.
- **Taiwan through the places** (Tips → Learn about Taiwan, and at the end of each place's timeline): every place's timeline events on one timeline, grouped under the eras of Taiwan's history (Dutch & Spanish, Tungning, Qing, Japanese, post-war), in year order, each linking to its place; events from entries the owner has not checked yet are marked as drafts. "Copy for AI" copies the whole timeline with a request to tell the story that connects these places.
- **Show card** ("show to driver", a food pick's driver card, a phrase's Show): large black-on-white text with a 🔊 button that reads the Chinese aloud (tap again within a few seconds to hear it slower), a rotate-180° toggle for the person opposite, and the screen kept awake while it is open. It closes with its Close button or a tap outside it, not when someone taps the text.
- Select any text in the app to ask an AI what it means in context.
- Back works like a phone app expects: it closes an open card or sheet first, and returns to where you were in a list. Usable with a keyboard and a screen reader (focus follows the page, messages are announced, Chinese and English text carry their language).
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
