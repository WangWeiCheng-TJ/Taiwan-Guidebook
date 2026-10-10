#!/usr/bin/env python3
"""
TASK T4a (see docs/SPEC.md): convert attraction JSON from paired *_zh / *_en fields
to per-language maps, so more languages can be added without schema changes.

    "city_zh": "臺南市", "city_en": "Tainan City"   ->   "city": {"zh_TW": "臺南市", "en": "Tainan City"}

Implement the bodies; do not change names, parameters or return types.
Contract tests: tests/py/test_migrate_i18n.py

This task only provides the converter. Running it on data/ and switching the schema,
build script, generator prompt and app to the new shape is T4b (not part of this task).
"""

import copy
import glob
import json
from pathlib import Path
import sys
from typing import Any

SCHEMA_VERSION = 2

# Fields that exist only in English in the old format and must become {"en": ...}
ENGLISH_ONLY_FIELDS = {"best_time_to_visit"}


def merge_lang_pairs(value: Any) -> Any:
    """Recursively rewrite language-suffixed keys into maps. Returns a new object; input is not modified.

    Within every dict (at any depth, including dicts inside lists):
      - "X_zh" and "X_en" both present  -> "X": {"zh_TW": <X_zh>, "en": <X_en>}
      - only "X_en"                      -> "X": {"en": <X_en>}
      - only "X_zh"                      -> "X": {"zh_TW": <X_zh>}
      - every other key is copied unchanged (after recursing into its value)
    The new key takes the position of the first of the pair in key order.
    Values may be strings or lists (e.g. must_see_spots_en is a list of strings).
    Keys that already hold a map such as "name": {"zh_TW", "en"} are left as they are.
    Non-dict, non-list values are returned unchanged.
    """
    if isinstance(value, list):
        return [merge_lang_pairs(item) for item in value]
    if not isinstance(value, dict):
        return value

    result = {}
    processed_bases = set()

    for k, v in value.items():
        if len(k) > 3 and k.endswith(("_zh", "_en")):
            base = k[:-3]
            if base in processed_bases:
                continue
            zh_key = f"{base}_zh"
            en_key = f"{base}_en"
            has_zh = zh_key in value
            has_en = en_key in value

            if has_zh and has_en:
                result[base] = {
                    "zh_TW": merge_lang_pairs(value[zh_key]),
                    "en": merge_lang_pairs(value[en_key]),
                }
                processed_bases.add(base)
            elif has_zh:
                result[base] = {
                    "zh_TW": merge_lang_pairs(value[zh_key]),
                }
                processed_bases.add(base)
            elif has_en:
                result[base] = {
                    "en": merge_lang_pairs(value[en_key]),
                }
                processed_bases.add(base)
        else:
            result[k] = merge_lang_pairs(v)

    return result


def migrate_attraction(old: dict) -> dict:
    """Convert one attraction to schema version 2.

    - Applies merge_lang_pairs to the whole object.
    - Wraps ENGLISH_ONLY_FIELDS that are plain strings (anywhere in the object) as {"en": value}.
    - Sets "schema_version": SCHEMA_VERSION as the last key.
    - Idempotent: an object that already has schema_version == 2 is returned as an equal copy.
    """
    if old.get("schema_version") == SCHEMA_VERSION:
        return copy.deepcopy(old)

    merged = merge_lang_pairs(old)

    def wrap_english(val: Any) -> Any:
        if isinstance(val, list):
            return [wrap_english(x) for x in val]
        if not isinstance(val, dict):
            return val
        out = {}
        for k, v in val.items():
            if k in ENGLISH_ONLY_FIELDS and isinstance(v, str):
                out[k] = {"en": v}
            else:
                out[k] = wrap_english(v)
        return out

    result = wrap_english(merged)
    result.pop("schema_version", None)
    result["schema_version"] = SCHEMA_VERSION
    return result


def main(argv: list[str]) -> int:
    """CLI: python scripts/migrate_i18n.py [--write] [files...]

    - files default to data/attractions/*.json
    - without --write: print, per file, "would migrate <name>" or "already v2 <name>"; change nothing
    - with --write: rewrite each file in place (UTF-8, ensure_ascii=False, indent=2, trailing newline)
    - returns 0 on success, 1 if any file could not be read or parsed (and prints which)
    """
    write = "--write" in argv
    file_args = [a for a in argv if a != "--write"]

    if not file_args:
        data_dir = Path("data/attractions")
        if not data_dir.is_dir():
            data_dir = Path(__file__).resolve().parent.parent / "data" / "attractions"
        paths = sorted(data_dir.glob("*.json"))
    else:
        paths = []
        for arg in file_args:
            matches = sorted(glob.glob(arg))
            if matches:
                paths.extend(Path(m) for m in matches)
            else:
                paths.append(Path(arg))

    had_error = False
    for path in paths:
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception as e:
            print(f"Error reading or parsing {path}: {e}", file=sys.stderr)
            had_error = True
            continue

        if not write:
            if data.get("schema_version") == SCHEMA_VERSION:
                print(f"already v2 {path.name}")
            else:
                print(f"would migrate {path.name}")
        else:
            migrated = migrate_attraction(data)
            try:
                with open(path, "w", encoding="utf-8") as f:
                    f.write(json.dumps(migrated, ensure_ascii=False, indent=2) + "\n")
            except Exception as e:
                print(f"Error writing {path}: {e}", file=sys.stderr)
                had_error = True

    return 1 if had_error else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
