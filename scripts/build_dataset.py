#!/usr/bin/env python3
"""
Taiwan Historical & Cultural Guidebook Dataset Builder

Validates the sources in data/ (attractions against schema/attraction.schema.json,
phrases, tips, food picks) and writes:
  - data/taiwan_attractions.json  public attractions dataset
  - app/data/guidebook.json       offline bundle read by the PWA in app/

compute_outputs() does the loading and validation and returns both payloads
without writing anything (tests/py/test_bundle_fresh.py uses it); main() writes.
"""

import sys
import json
import hashlib
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
FOOD_KINDS = {"taiwanese", "hotpot", "beef_noodles", "ramen", "japanese", "international", "sweets", "bar"}
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


def load_attractions(log=_quiet) -> list[dict]:
    """Load and validate every attraction file; raise BuildError if any is invalid."""
    files = attraction_files()
    log(f"Found {len(files)} attraction files in data/attractions/")

    schema = load_schema()
    validator = schema_validator(schema)
    categories = schema["properties"]["category"]["enum"] if schema else None
    if validator:
        log("Validation: full JSON Schema (jsonschema)\n")
    else:
        log("Validation: basic checks only (jsonschema not installed; `npm run build` adds it)\n")

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


def load_food() -> list[dict]:
    """Owner's food picks, one file per city: data/food/<city>.json."""
    cities = []
    paths = sorted(FOOD_DIR.glob("*.json"), key=lambda p: p.name) if FOOD_DIR.exists() else []
    for path in paths:
        with open(path, "r", encoding="utf-8") as f:
            city = json.load(f)
        for key in ("city_en", "city_zh", "picks"):
            if key not in city:
                raise BuildError(f"[INVALID] {path.name}: missing {key}")
        seen = set()
        for pick in city["picks"]:
            bad_dish = "dish" in pick and not (isinstance(pick["dish"], dict) and pick["dish"].get("en") and pick["dish"].get("zh_TW"))
            bad_local = not isinstance(pick.get("local", False), bool)
            if not pick.get("id") or not pick.get("name") or pick.get("kind") not in FOOD_KINDS or pick["id"] in seen or bad_local or bad_dish:
                raise BuildError(f"[INVALID] {path.name}: bad pick {pick}")
            seen.add(pick["id"])
        for dish in city.get("to_try", []):
            d = dish.get("dish") or {}
            if not dish.get("id") or not d.get("en") or not d.get("zh_TW") or dish["id"] in seen:
                raise BuildError(f"[INVALID] {path.name}: bad to_try entry {dish}")
            seen.add(dish["id"])
        cities.append(city)
    return cities


def content_version(content: dict) -> str:
    """Content hash, so the app can tell when the data actually changed."""
    return hashlib.sha256(
        json.dumps(content, ensure_ascii=False, sort_keys=True).encode("utf-8")
    ).hexdigest()[:12]


def build_public_dataset(attractions: list[dict], previous, today: str) -> dict:
    """data/taiwan_attractions.json payload.

    generated_at stays as in `previous` (the current file) when nothing else changed,
    so rebuilding unchanged data on another day gives an identical file.
    """
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
        "eras_index": [
            "Prehistoric & Indigenous",
            "Dutch & Spanish Era (1624–1662)",
            "Kingdom of Tungning (1661–1683)",
            "Qing Dynasty (1683–1895)",
            "Japanese Colonial Era (1895–1945)",
            "Post-WWII & Modern Era (1945–present)"
        ],
        "categories_index": [
            "historical_fortress",
            "temple_shrine",
            "colonial_architecture",
            "historic_street_district",
            "industrial_heritage",
            "indigenous_cultural_site",
            "memorial_museum",
            "traditional_residence",
            "natural_cultural_landscape"
        ],
        "attractions": attractions
    }
    if not dataset["metadata"]["generated_at"] or dataset != previous:
        dataset["metadata"]["generated_at"] = today
    return dataset


def build_app_bundle(attractions: list[dict], previous, today: str) -> dict:
    """app/data/guidebook.json payload: the single offline bundle consumed by the PWA.

    generated_at stays as in `previous` (the current bundle) when the version is unchanged.
    """
    phrases = load_list(PHRASES_FILE, ["id", "category", "en", "zh_TW", "zhuyin", "pinyin"])
    tips = load_list(TIPS_FILE, ["id", "scope", "category", "title_en", "body_en"])
    content = {"places": attractions, "phrases": phrases, "tips": tips, "food": load_food()}
    version = content_version(content)
    previous = previous or {}
    unchanged = previous.get("version") == version and previous.get("generated_at")
    generated_at = previous["generated_at"] if unchanged else today
    return {"version": version, "generated_at": generated_at, **content}


def compute_outputs(log=_quiet, today=None) -> tuple[dict, dict]:
    """Load and validate data/; return (public_dataset, app_bundle). Writes nothing.

    Reads the current output files only to keep their generated_at when content is unchanged.
    today: YYYY-MM-DD for changed outputs (default: today's date).
    Raises BuildError on invalid data.
    """
    today = today or date.today().isoformat()
    attractions = load_attractions(log)
    dataset = build_public_dataset(attractions, read_json(OUTPUT_FILE), today)
    bundle = build_app_bundle(attractions, read_json(APP_OUTPUT_FILE), today)
    return dataset, bundle


def write_json(path: Path, payload: dict, **dump_args) -> None:
    """Write UTF-8 JSON with LF line endings on every OS."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(payload, f, ensure_ascii=False, **dump_args)


def main() -> None:
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
        dataset, bundle = compute_outputs(log=print)
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
