#!/usr/bin/env python3
"""
Taiwan Historical & Cultural Guidebook Dataset Builder

Validates the sources in data/ (attractions against schema/attraction.schema.json,
phrases, tips, food picks, and the optional data/apps.json and data/topics/*.json) and writes:
  - data/taiwan_attractions.json  public attractions dataset
  - app/data/guidebook.json       offline bundle read by the PWA in app/

compute_outputs() does the loading and validation and returns both payloads
without writing anything (tests/py/test_bundle_fresh.py uses it); main() writes.
"""

import sys
import json
import hashlib
import re
from datetime import date
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
ATTRACTIONS_DIR = DATA_DIR / "attractions"
OUTPUT_FILE = DATA_DIR / "taiwan_attractions.json"
SCHEMA_FILE = BASE_DIR / "schema" / "attraction.schema.json"
PHRASES_FILE = DATA_DIR / "phrases.json"
TIPS_FILE = DATA_DIR / "tips.json"
FOOD_DIR = DATA_DIR / "food"
APPS_FILE = DATA_DIR / "apps.json"
TOPICS_DIR = DATA_DIR / "topics"
FOOD_KINDS = {"taiwanese", "hotpot", "beef_noodles", "ramen", "japanese", "international", "sweets", "bar"}
# Phrase tiles of the Phrases tab except "top" (PHRASE_GROUPS in app/js/phrases.js) and the tips headings
# (cat.<category> in app/js/lang.js); tests/core/build-sync.test.js keeps the copies in sync.
PHRASE_CATEGORIES = ["sightseeing", "food", "transport", "shopping", "emergency", "basics"]
TIP_CATEGORIES = ["safety", "transport", "daily-life", "money", "culture"]
# Sections of the recommended-apps page (APP_CATEGORIES in app/js/views/apps.js); tests/core/app-categories.test.js
# keeps the copies in sync.
APP_CATEGORIES = ["getting-around", "taxi", "trains", "messaging", "language", "weather", "food"]
APP_PLATFORMS = ["ios", "android"]
# #/learn/<id> shows a topic, except these ids, which are app pages (TIMELINE_ID in app/js/timeline.js);
# tests/core/build-sync.test.js keeps the copies in sync.
RESERVED_TOPIC_IDS = ["timeline"]
KEBAB_ID = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
HTTPS_URL = re.compile(r"""^https://[^\s"'<>]+$""")  # the same test as isHttps() in app/js/views/apps.js
APP_OUTPUT_FILE = BASE_DIR / "app" / "data" / "guidebook.json"


class BuildError(Exception):
    """Invalid or missing source data. main() prints it and exits with status 1."""


def _quiet(*_args, **_kwargs) -> None:
    """Default logger: compute_outputs() prints nothing unless given one."""


def read_json(path: Path):
    """Parsed JSON at path, or None when the file is missing or unreadable."""
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def load_schema():
    """The attraction schema, or None when schema/attraction.schema.json is missing."""
    if not SCHEMA_FILE.exists():
        return None
    with open(SCHEMA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def schema_validator(schema):
    """Full JSON Schema validator when jsonschema is importable, else None (basic checks).

    Imported lazily: tests and plain `uv run` work without jsonschema installed.
    """
    if schema is None:
        return None
    try:
        from jsonschema.validators import validator_for
    except ImportError:
        return None
    from jsonschema.exceptions import SchemaError
    cls = validator_for(schema)
    try:
        cls.check_schema(schema)
    except SchemaError as ex:
        raise BuildError(f"{SCHEMA_FILE.name} is not a valid JSON Schema: {ex.message}") from ex
    return cls(schema)


def validate_basic(data: dict, categories=None) -> list[str]:
    """Basic validation checks without external dependencies.

    categories: allowed 'category' values (the schema enum); None skips that check.
    """
    if not isinstance(data, dict):
        return ["The file must contain one JSON object"]
    errors = []
    required_keys = [
        "id", "name", "location", "category", "eras",
        "summary", "historical_narrative", "timeline",
        "cultural_significance", "foreign_visitor_guide", "tags"
    ]
    for key in required_keys:
        if key not in data:
            errors.append(f"Missing required key '{key}'")

    # Name checks
    if "name" in data:
        if not isinstance(data["name"], dict) or "zh_TW" not in data["name"] or "en" not in data["name"]:
            errors.append("'name' must be an object containing 'zh_TW' and 'en'")

    # Location checks
    if "location" in data:
        loc = data["location"]
        if not isinstance(loc, dict) or "coordinates" not in loc:
            errors.append("'location' must contain 'coordinates'")
        elif not isinstance(loc["coordinates"], dict) or "lat" not in loc["coordinates"] or "lng" not in loc["coordinates"]:
            errors.append("'coordinates' must have 'lat' and 'lng'")

    # Category must be one of the schema's values (jsonschema isn't always installed)
    if "category" in data and categories is not None and data["category"] not in categories:
        errors.append(f"'category' {data['category']!r} is not one of {categories}")

    for key in ("eras", "tags"):
        if key in data and not isinstance(data[key], list):
            errors.append(f"'{key}' must be a list")

    # Timeline checks
    if "timeline" in data:
        if not isinstance(data["timeline"], list) or len(data["timeline"]) == 0:
            errors.append("'timeline' must be a non-empty list of milestones")

    return errors


def attraction_files() -> list[Path]:
    """data/attractions/*.json in name order (the order feeds the content hash)."""
    if not ATTRACTIONS_DIR.exists():
        raise BuildError(f"Directory {ATTRACTIONS_DIR} does not exist.")
    return sorted(ATTRACTIONS_DIR.glob("*.json"), key=lambda p: p.name)


def load_attractions(log=_quiet, allow_basic=False) -> list[dict]:
    """Load and validate every attraction file; raise BuildError if any is invalid.

    Without jsonschema installed the schema cannot run: that is an error (a place with a string latitude
    or a wrong era would be bundled), unless allow_basic is True (`--basic`), which falls back to
    validate_basic()'s key checks.
    """
    files = attraction_files()
    log(f"Found {len(files)} attraction files in data/attractions/")

    schema = load_schema()
    validator = schema_validator(schema)
    categories = schema["properties"]["category"]["enum"] if schema else None
    if validator:
        log("Validation: full JSON Schema (jsonschema)\n")
    elif schema is not None and not allow_basic:
        raise BuildError("jsonschema is not installed, so places cannot be validated against "
                         f"{SCHEMA_FILE.name}. Run `npm run build` (it adds jsonschema), "
                         "or pass --basic for the weaker key checks.")
    else:
        log("Validation: basic checks only (jsonschema not installed or --basic)\n")

    attractions = []
    has_errors = False
    for path in files:
        fname = path.name
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception as ex:
            log(f"❌ [ERROR] Could not parse {fname}: {ex}")
            has_errors = True
            continue

        try:
            if validator:
                errors = [f"Schema error at {e.json_path}: {e.message}" for e in validator.iter_errors(data)]
            else:
                errors = validate_basic(data, categories)
        except Exception as ex:  # a malformed file must be reported, not crash the build
            errors = [f"Could not validate: {ex}"]
        # The id is the URL (#/place/<id>) and what log and trip entries point to. Tying it to the unique
        # file name keeps ids unique, so a renamed copy cannot shadow the original place.
        if isinstance(data, dict) and data.get("id") != path.stem:
            errors.append(f"'id' {data.get('id')!r} must equal the file name {path.stem!r}")

        if errors:
            log(f"❌ [INVALID] {fname}")
            for err in errors:
                log(f"   - {err}")
            has_errors = True
        else:
            zh_name = data.get("name", {}).get("zh_TW", "Unknown")
            en_name = data.get("name", {}).get("en", "Unknown")
            eras_count = len(data.get("eras", []))
            timeline_count = len(data.get("timeline", []))
            log(f"✅ [VALID] {fname.ljust(30)} -> {zh_name} ({en_name}) | {eras_count} Eras | {timeline_count} Events")
            attractions.append(data)

    if has_errors:
        raise BuildError("Dataset compilation aborted due to validation errors.")
    return attractions


def load_list(path: Path, required: list[str]) -> list[dict]:
    """Load a JSON array of entries and check required keys and unique ids."""
    if not path.exists():
        return []
    with open(path, "r", encoding="utf-8") as f:
        entries = json.load(f)
    seen = set()
    for entry in entries:
        missing = [k for k in required if k not in entry]
        if missing:
            raise BuildError(f"[INVALID] {path.name}: entry {entry.get('id', '?')} missing {missing}")
        if entry["id"] in seen:
            raise BuildError(f"[INVALID] {path.name}: duplicate id {entry['id']}")
        seen.add(entry["id"])
    return entries


def is_text(value) -> bool:
    """A string with something in it."""
    return isinstance(value, str) and bool(value.strip())


def is_bilingual(value) -> bool:
    """An {en, zh_TW} object whose two values are non-empty strings (the app calls string methods on them)."""
    return isinstance(value, dict) and is_text(value.get("en")) and is_text(value.get("zh_TW"))


def food_pick_problems(pick, seen: set) -> list[str]:
    """What is wrong with one food pick (empty when it is fine). seen: ids already used in the city."""
    if not isinstance(pick, dict):
        return ["must be an object"]
    problems = []
    if not is_text(pick.get("id")):
        problems.append("'id' must be a non-empty string")
    elif pick["id"] in seen:
        problems.append(f"duplicate id {pick['id']!r}")
    if not is_text(pick.get("name")):
        problems.append("'name' must be a non-empty string (the shop name as on Google Maps)")
    if not (isinstance(pick.get("kind"), str) and pick["kind"] in FOOD_KINDS):
        problems.append(f"'kind' {pick.get('kind')!r} is not one of {sorted(FOOD_KINDS)}")
    if not isinstance(pick.get("local", False), bool):
        problems.append("'local' must be true or false")
    for key in ("dish", "hint"):  # the Ask AI prompt and the food sheet read .en and .zh_TW of both
        if key in pick and not is_bilingual(pick[key]):
            problems.append(f"'{key}' must be an object with non-empty 'en' and 'zh_TW' strings")
    return problems


def party_problems(phrase: dict) -> list[str]:
    """What is wrong with a phrase's `party` field (see withParty in app/js/party.js); [] when fine.

    withParty() swaps party.zh_TW / party.zhuyin / party.pinyin for the number, so each must occur in
    the phrase, or the English changes with the party size and the Chinese the clerk reads does not.
    """
    party = phrase["party"]
    if not isinstance(party, dict):
        return ["'party' must be an object"]
    problems = [f"party.{key} must be a non-empty string"
                for key in ("zh_TW", "zhuyin", "pinyin", "en_one", "en_other") if not is_text(party.get(key))]
    if not all(is_text(phrase.get(key)) for key in ("zh_TW", "zhuyin", "pinyin")):
        problems.append("the phrase's zh_TW, zhuyin and pinyin must be strings")
    if problems:
        return problems
    if party["zh_TW"] not in phrase["zh_TW"]:
        problems.append(f"party.zh_TW {party['zh_TW']!r} does not occur in zh_TW {phrase['zh_TW']!r}")
    if party["zhuyin"] not in phrase["zhuyin"].split():
        problems.append(f"party.zhuyin {party['zhuyin']!r} is not one of the phrase's zhuyin syllables")
    if party["pinyin"] not in phrase["pinyin"]:
        problems.append(f"party.pinyin {party['pinyin']!r} does not occur in pinyin {phrase['pinyin']!r}")
    if "{n}" not in party["en_other"] and "{N}" not in party["en_other"]:
        problems.append("party.en_other needs {n} or {N} where the number goes")
    return problems


def load_phrases() -> list[dict]:
    """data/phrases.json: required keys and unique ids, a known category, and a usable `party` when present."""
    phrases = load_list(PHRASES_FILE, ["id", "category", "en", "zh_TW", "zhuyin", "pinyin"])
    for phrase in phrases:
        problems = []
        if phrase["category"] not in PHRASE_CATEGORIES:
            problems.append(f"category {phrase['category']!r} is not one of {PHRASE_CATEGORIES}")
        if "party" in phrase:
            problems += party_problems(phrase)
        if problems:
            raise BuildError(f"[INVALID] {PHRASES_FILE.name}: phrase {phrase['id']}: " + "; ".join(problems))
    return phrases


def load_tips() -> list[dict]:
    """data/tips.json: required keys and unique ids, and a category that has a heading in the app."""
    tips = load_list(TIPS_FILE, ["id", "scope", "category", "title_en", "body_en"])
    for tip in tips:
        if tip["category"] not in TIP_CATEGORIES:
            raise BuildError(f"[INVALID] {TIPS_FILE.name}: tip {tip['id']}: category {tip['category']!r} "
                             f"is not one of {TIP_CATEGORIES}")
    return tips


def load_food() -> list[dict]:
    """Owner's food picks, one file per city: data/food/<city>.json.

    Checks the shape of each file; check_food_cities() checks the city names against the places.
    """
    cities = []
    seen_cities = {}
    paths = sorted(FOOD_DIR.glob("*.json"), key=lambda p: p.name) if FOOD_DIR.exists() else []
    for path in paths:
        with open(path, "r", encoding="utf-8") as f:
            city = json.load(f)
        if not isinstance(city, dict):
            raise BuildError(f"[INVALID] {path.name}: must contain one JSON object")
        for key in ("city_en", "city_zh", "picks"):
            if key not in city:
                raise BuildError(f"[INVALID] {path.name}: missing {key}")
        for key in ("city_en", "city_zh"):
            if not is_text(city[key]):
                raise BuildError(f"[INVALID] {path.name}: {key} must be a non-empty string")
        if city["city_en"] in seen_cities:
            raise BuildError(f"[INVALID] {path.name}: city_en {city['city_en']!r} is already used by {seen_cities[city['city_en']]}")
        seen_cities[city["city_en"]] = path.name
        if "local_label" in city and not is_bilingual(city["local_label"]):
            raise BuildError(f"[INVALID] {path.name}: local_label must be an object with non-empty 'en' and 'zh_TW' strings")
        if not isinstance(city["picks"], list):
            raise BuildError(f"[INVALID] {path.name}: picks must be a list")
        seen = set()
        for pick in city["picks"]:
            problems = food_pick_problems(pick, seen)
            if problems:
                raise BuildError(f"[INVALID] {path.name}: bad pick {pick}: " + "; ".join(problems))
            seen.add(pick["id"])
        to_try = city.get("to_try", [])
        if not isinstance(to_try, list):
            raise BuildError(f"[INVALID] {path.name}: to_try must be a list")
        for dish in to_try:
            dish_id = dish.get("id") if isinstance(dish, dict) else None
            if not is_text(dish_id) or not is_bilingual(dish.get("dish")) or dish_id in seen:
                raise BuildError(f"[INVALID] {path.name}: bad to_try entry {dish}")
            seen.add(dish_id)
        cities.append(city)
    return cities


def load_apps() -> list[dict]:
    """data/apps.json (recommended phone apps, in display order); [] when the file does not exist.

    Checks what app/js/views/apps.js relies on: bilingual name and why, a known category, an https
    link, known platforms and unique kebab-case ids.
    """
    if not APPS_FILE.exists():
        return []
    with open(APPS_FILE, "r", encoding="utf-8") as f:
        try:
            apps = json.load(f)
        except ValueError as ex:
            raise BuildError(f"[INVALID] {APPS_FILE.name}: not valid JSON ({ex})") from ex
    if not isinstance(apps, list):
        raise BuildError(f"[INVALID] {APPS_FILE.name}: must contain a JSON array")
    seen = set()
    for app in apps:
        if not isinstance(app, dict):
            raise BuildError(f"[INVALID] {APPS_FILE.name}: every entry must be an object, got {app!r}")
        problems = []
        app_id = app.get("id")
        if not (is_text(app_id) and KEBAB_ID.fullmatch(app_id)):
            problems.append("'id' must be kebab-case")
        elif app_id in seen:
            problems.append(f"duplicate id {app_id!r}")
        else:
            seen.add(app_id)
        if app.get("category") not in APP_CATEGORIES:
            problems.append(f"'category' {app.get('category')!r} is not one of {APP_CATEGORIES}")
        for key in ("name", "why"):
            if not is_bilingual(app.get(key)):
                problems.append(f"'{key}' must be an object with non-empty 'en' and 'zh_TW' strings")
        if not (isinstance(app.get("url"), str) and HTTPS_URL.fullmatch(app["url"])):
            problems.append(f"'url' {app.get('url')!r} must be an https link")
        platforms = app.get("platforms")
        if not (isinstance(platforms, list) and platforms and all(p in APP_PLATFORMS for p in platforms)):
            problems.append(f"'platforms' must be a non-empty list of {APP_PLATFORMS}")
        if problems:
            raise BuildError(f"[INVALID] {APPS_FILE.name}: app {app_id!r}: " + "; ".join(problems))
    return apps


def topic_problems(topic, stem: str, place_ids: set) -> list[str]:
    """What is wrong with one knowledge topic (empty when it is fine). stem: its file name without .json."""
    if not isinstance(topic, dict):
        return ["must be a JSON object"]
    problems = []
    if topic.get("id") != stem or not KEBAB_ID.fullmatch(str(topic.get("id"))):
        problems.append(f"'id' {topic.get('id')!r} must be kebab-case and equal the file name {stem!r}")
    if topic.get("id") in RESERVED_TOPIC_IDS:
        problems.append(f"'id' {topic.get('id')!r} is taken by an app page (#/learn/{topic.get('id')})")
    for key in ("title", "summary"):
        if not is_bilingual(topic.get(key)):
            problems.append(f"'{key}' must be an object with non-empty 'en' and 'zh_TW' strings")
    body = topic.get("body")
    if not (isinstance(body, dict) and all(
            isinstance(body.get(lang), list) and body[lang] and all(is_text(x) for x in body[lang])
            for lang in ("en", "zh_TW"))):
        problems.append("'body' must have non-empty lists of paragraph strings under 'en' and 'zh_TW'")
    for key in ("tags", "places"):
        if not (isinstance(topic.get(key), list) and all(is_text(x) for x in topic[key])):
            problems.append(f"'{key}' must be a list of strings")
    if isinstance(topic.get("places"), list):
        unknown = [x for x in topic["places"] if x not in place_ids]
        if unknown:
            problems.append(f"'places' names ids that are not attractions: {unknown}")
    meta = topic.get("metadata")
    if not (isinstance(meta, dict) and is_text(meta.get("generated_by")) and is_text(meta.get("last_updated"))
            and isinstance(meta.get("sources"), list) and all(is_text(x) for x in meta["sources"])):
        problems.append("'metadata' needs 'sources' (list), 'generated_by' and 'last_updated'")
    return problems


def load_topics(place_ids: set) -> list[dict]:
    """data/topics/<id>.json (knowledge topics) sorted by id; [] when the folder does not exist.

    place_ids: ids of the attractions, which a topic's 'places' may name.
    """
    if not TOPICS_DIR.exists():
        return []
    topics = []
    for path in sorted(TOPICS_DIR.glob("*.json"), key=lambda p: p.name):
        with open(path, "r", encoding="utf-8") as f:
            try:
                topic = json.load(f)
            except ValueError as ex:
                raise BuildError(f"[INVALID] topics/{path.name}: not valid JSON ({ex})") from ex
        problems = topic_problems(topic, path.stem, place_ids)
        if problems:
            raise BuildError(f"[INVALID] topics/{path.name}: " + "; ".join(problems))
        topics.append(topic)
    return sorted(topics, key=lambda t: t["id"])  # code-point order, as byId in app/js/topics.js


def check_food_cities(food: list[dict], attractions: list[dict]) -> None:
    """Each food file names a city the places use, spelled the same way.

    The app matches city_en as an exact string (Explore filter, Ask AI) and shows city_zh next to the
    places' own, so "Taipei" in food next to "Taipei City" in the places would drop the picks silently.
    Raises BuildError.
    """
    zh_by_en = {}
    for place in attractions:
        loc = place.get("location") or {}
        if loc.get("city_en"):
            zh_by_en.setdefault(loc["city_en"], set()).add(loc.get("city_zh"))
    for city in food:
        en, zh = city["city_en"], city["city_zh"]
        if en not in zh_by_en:
            raise BuildError(f"[INVALID] food {en!r}: no attraction has location.city_en {en!r} "
                             f"(cities in data/attractions: {sorted(zh_by_en)})")
        if zh not in zh_by_en[en]:
            raise BuildError(f"[INVALID] food {en!r}: city_zh {zh!r} differs from the places' "
                             f"{sorted(z for z in zh_by_en[en] if z)}")


def content_version(content: dict) -> str:
    """Content hash, so the app can tell when the data actually changed."""
    return hashlib.sha256(
        json.dumps(content, ensure_ascii=False, sort_keys=True).encode("utf-8")
    ).hexdigest()[:12]


def build_public_dataset(attractions: list[dict], previous, today: str) -> dict:
    """data/taiwan_attractions.json payload.

    generated_at stays as in `previous` (the current file) when nothing else changed,
    so rebuilding unchanged data on another day gives an identical file.
    eras_index and categories_index are the schema's enums, so the open dataset lists what the places can use.
    Raises BuildError when the schema file is missing.
    """
    schema = load_schema()
    if schema is None:
        raise BuildError(f"{SCHEMA_FILE} is missing: the dataset's eras and categories come from it")
    dataset = {
        "metadata": {
            "title": "Taiwan Historical & Cultural Attractions Open Database",
            "title_zh": "臺灣景點歷史沿革與文化旅遊資料庫",
            "version": "1.0.0",
            "total_count": len(attractions),
            "generated_at": ((previous or {}).get("metadata") or {}).get("generated_at"),
            "license": "CC-BY-4.0",
            "repository": "https://github.com/WangWeiCheng-TJ/Taiwan-Guidebook"
        },
        "eras_index": list(schema["properties"]["eras"]["items"]["enum"]),
        "categories_index": list(schema["properties"]["category"]["enum"]),
        "attractions": attractions
    }
    if not dataset["metadata"]["generated_at"] or dataset != previous:
        dataset["metadata"]["generated_at"] = today
    return dataset


def build_app_bundle(attractions: list[dict], previous, today: str) -> dict:
    """app/data/guidebook.json payload: the single offline bundle consumed by the PWA.

    generated_at stays as in `previous` (the current bundle) when the version is unchanged.
    """
    phrases = load_phrases()
    tips = load_tips()
    food = load_food()
    check_food_cities(food, attractions)
    content = {"places": attractions, "phrases": phrases, "tips": tips, "food": food}
    # Optional sources: left out when absent, so the bundle stays as it was before they existed
    apps = load_apps()
    topics = load_topics({a["id"] for a in attractions})
    if apps:
        content["apps"] = apps
    if topics:
        content["topics"] = topics
    version = content_version(content)
    previous = previous or {}
    unchanged = previous.get("version") == version and previous.get("generated_at")
    generated_at = previous["generated_at"] if unchanged else today
    return {"version": version, "generated_at": generated_at, **content}


def compute_outputs(log=_quiet, today=None, allow_basic=False) -> tuple[dict, dict]:
    """Load and validate data/; return (public_dataset, app_bundle). Writes nothing.

    Reads the current output files only to keep their generated_at when content is unchanged.
    today: YYYY-MM-DD for changed outputs (default: today's date).
    allow_basic: validate places with validate_basic() when jsonschema is missing (default: that is an error).
    Raises BuildError on invalid data.
    """
    today = today or date.today().isoformat()
    attractions = load_attractions(log, allow_basic=allow_basic)
    dataset = build_public_dataset(attractions, read_json(OUTPUT_FILE), today)
    bundle = build_app_bundle(attractions, read_json(APP_OUTPUT_FILE), today)
    return dataset, bundle


def write_json(path: Path, payload: dict, **dump_args) -> None:
    """Write UTF-8 JSON with LF line endings on every OS."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(payload, f, ensure_ascii=False, **dump_args)


def main(argv=None) -> None:
    args = sys.argv[1:] if argv is None else argv
    if any(a != "--basic" for a in args):
        print("usage: build_dataset.py [--basic]   (--basic: key checks only when jsonschema is missing)")
        sys.exit(2)
    # Ensure UTF-8 stdout on Windows
    if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    print("=" * 60)
    print("🇹🇼 Taiwan Historical Guidebook - Dataset Compiler")
    print("=" * 60)

    try:
        if not attraction_files():
            print("[WARNING] No JSON attraction files found in data/attractions/")
            sys.exit(0)
        previous_version = (read_json(APP_OUTPUT_FILE) or {}).get("version")
        dataset, bundle = compute_outputs(log=print, allow_basic="--basic" in args)
    except BuildError as e:
        print(f"\n❌ [ERROR] {e}")
        sys.exit(1)

    write_json(OUTPUT_FILE, dataset, indent=2)
    write_json(APP_OUTPUT_FILE, bundle, separators=(",", ":"))

    status = "unchanged" if bundle["version"] == previous_version else f"was {previous_version}"
    print(f"\n🎉 Successfully compiled {len(dataset['attractions'])} attractions into:")
    print(f"   -> {OUTPUT_FILE} ({OUTPUT_FILE.stat().st_size / 1024:.2f} KB)")
    print(f"   -> {APP_OUTPUT_FILE} ({APP_OUTPUT_FILE.stat().st_size / 1024:.2f} KB, "
          f"{len(bundle['phrases'])} phrases, {len(bundle['tips'])} tips, "
          f"version {bundle['version']} ({status}), generated_at {bundle['generated_at']})")


if __name__ == "__main__":
    main()
