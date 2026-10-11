#!/usr/bin/env python3
"""
Taiwan Historical & Cultural Guidebook Dataset Builder
Compiles individual attraction JSON files in data/attractions/ into a consolidated data/taiwan_attractions.json
and validates each entry against schema/attraction.schema.json.
"""

import os
import sys
import json
import glob
import hashlib
from datetime import date
from pathlib import Path

# Ensure UTF-8 stdout on Windows
if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
ATTRACTIONS_DIR = DATA_DIR / "attractions"
OUTPUT_FILE = DATA_DIR / "taiwan_attractions.json"
WEB_OUTPUT_FILE = BASE_DIR / "web" / "taiwan_attractions.json"
SCHEMA_FILE = BASE_DIR / "schema" / "attraction.schema.json"
PHRASES_FILE = DATA_DIR / "phrases.json"
TIPS_FILE = DATA_DIR / "tips.json"
FOOD_DIR = DATA_DIR / "food"
FOOD_KINDS = {"taiwanese", "hotpot", "beef_noodles", "ramen", "japanese", "international", "sweets", "bar"}
APP_OUTPUT_FILE = BASE_DIR / "app" / "data" / "guidebook.json"


def validate_basic(data: dict, filename: str) -> list[str]:
    """Basic validation checks without external dependencies."""
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
    if "category" in data and SCHEMA_FILE.exists():
        with open(SCHEMA_FILE, "r", encoding="utf-8") as sf:
            allowed = json.load(sf)["properties"]["category"]["enum"]
        if data["category"] not in allowed:
            errors.append(f"'category' {data['category']!r} is not one of {allowed}")

    # Timeline checks
    if "timeline" in data:
        if not isinstance(data["timeline"], list) or len(data["timeline"]) == 0:
            errors.append("'timeline' must be a non-empty list of milestones")

    return errors


def build():
    print("=" * 60)
    print("🇹🇼 Taiwan Historical Guidebook - Dataset Compiler")
    print("=" * 60)

    if not ATTRACTIONS_DIR.exists():
        print(f"[ERROR] Directory {ATTRACTIONS_DIR} does not exist.")
        sys.exit(1)

    json_files = sorted(glob.glob(str(ATTRACTIONS_DIR / "*.json")))
    if not json_files:
        print("[WARNING] No JSON attraction files found in data/attractions/")
        sys.exit(0)

    print(f"Found {len(json_files)} attraction files in data/attractions/\n")

    attractions = []
    has_errors = False

    # Try importing jsonschema if available, fallback to basic validator
    schema = None
    jsonschema_module = None
    if SCHEMA_FILE.exists():
        try:
            import jsonschema
            with open(SCHEMA_FILE, "r", encoding="utf-8") as sf:
                schema = json.load(sf)
            jsonschema_module = jsonschema
        except ImportError:
            pass

    for fpath in json_files:
        fname = Path(fpath).name
        try:
            with open(fpath, "r", encoding="utf-8") as f:
                data = json.load(f)

            # Validation
            errors = []
            if jsonschema_module and schema:
                try:
                    jsonschema_module.validate(instance=data, schema=schema)
                except jsonschema_module.ValidationError as e:
                    errors.append(f"Schema error: {e.message}")
            else:
                errors = validate_basic(data, fname)

            if errors:
                print(f"❌ [INVALID] {fname}")
                for err in errors:
                    print(f"   - {err}")
                has_errors = True
            else:
                zh_name = data.get("name", {}).get("zh_TW", "Unknown")
                en_name = data.get("name", {}).get("en", "Unknown")
                eras_count = len(data.get("eras", []))
                timeline_count = len(data.get("timeline", []))
                print(f"✅ [VALID] {fname.ljust(30)} -> {zh_name} ({en_name}) | {eras_count} Eras | {timeline_count} Events")
                attractions.append(data)

        except Exception as ex:
            print(f"❌ [ERROR] Could not parse {fname}: {ex}")
            has_errors = True

    if has_errors:
        print("\n[ERROR] Dataset compilation aborted due to validation errors.")
        sys.exit(1)

    # Build compiled payload
    compiled_dataset = {
        "metadata": {
            "title": "Taiwan Historical & Cultural Attractions Open Database",
            "title_zh": "臺灣景點歷史沿革與文化旅遊資料庫",
            "version": "1.0.0",
            "total_count": len(attractions),
            "generated_at": "2026-08-31",
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

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as out_f:
        json.dump(compiled_dataset, out_f, ensure_ascii=False, indent=2)

    # Also save in web directory for static server / GitHub Pages
    WEB_OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(WEB_OUTPUT_FILE, "w", encoding="utf-8") as web_out_f:
        json.dump(compiled_dataset, web_out_f, ensure_ascii=False, indent=2)

    app_bundle = build_app_bundle(attractions)

    print(f"\n🎉 Successfully compiled {len(attractions)} attractions into:")
    print(f"   -> {OUTPUT_FILE} ({os.path.getsize(OUTPUT_FILE) / 1024:.2f} KB)")
    print(f"   -> {WEB_OUTPUT_FILE} ({os.path.getsize(WEB_OUTPUT_FILE) / 1024:.2f} KB)")
    print(f"   -> {APP_OUTPUT_FILE} ({os.path.getsize(APP_OUTPUT_FILE) / 1024:.2f} KB, "
          f"{len(app_bundle['phrases'])} phrases, {len(app_bundle['tips'])} tips, version {app_bundle['version']})")


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
            print(f"❌ [INVALID] {path.name}: entry {entry.get('id', '?')} missing {missing}")
            sys.exit(1)
        if entry["id"] in seen:
            print(f"❌ [INVALID] {path.name}: duplicate id {entry['id']}")
            sys.exit(1)
        seen.add(entry["id"])
    return entries


def load_food() -> list[dict]:
    """Owner's food picks, one file per city: data/food/<city>.json."""
    cities = []
    for path in sorted(FOOD_DIR.glob("*.json")) if FOOD_DIR.exists() else []:
        with open(path, "r", encoding="utf-8") as f:
            city = json.load(f)
        for key in ("city_en", "city_zh", "picks"):
            if key not in city:
                print(f"❌ [INVALID] {path.name}: missing {key}")
                sys.exit(1)
        seen = set()
        for pick in city["picks"]:
            bad_dish = "dish" in pick and not (isinstance(pick["dish"], dict) and pick["dish"].get("en") and pick["dish"].get("zh_TW"))
            bad_local = not isinstance(pick.get("local", False), bool)
            if not pick.get("id") or not pick.get("name") or pick.get("kind") not in FOOD_KINDS or pick["id"] in seen or bad_local or bad_dish:
                print(f"❌ [INVALID] {path.name}: bad pick {pick}")
                sys.exit(1)
            seen.add(pick["id"])
        for dish in city.get("to_try", []):
            d = dish.get("dish") or {}
            if not dish.get("id") or not d.get("en") or not d.get("zh_TW") or dish["id"] in seen:
                print(f"❌ [INVALID] {path.name}: bad to_try entry {dish}")
                sys.exit(1)
            seen.add(dish["id"])
        cities.append(city)
    return cities


def build_app_bundle(attractions: list[dict]) -> dict:
    """Write the single offline bundle consumed by the PWA in app/."""
    phrases = load_list(PHRASES_FILE, ["id", "category", "en", "zh_TW", "zhuyin", "pinyin"])
    tips = load_list(TIPS_FILE, ["id", "scope", "category", "title_en", "body_en"])
    content = {"places": attractions, "phrases": phrases, "tips": tips, "food": load_food()}
    # Content hash, so the app can tell when the data actually changed
    version = hashlib.sha256(
        json.dumps(content, ensure_ascii=False, sort_keys=True).encode("utf-8")
    ).hexdigest()[:12]
    bundle = {"version": version, "generated_at": date.today().isoformat(), **content}
    APP_OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(APP_OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(bundle, f, ensure_ascii=False, separators=(",", ":"))
    return bundle


if __name__ == "__main__":
    build()
