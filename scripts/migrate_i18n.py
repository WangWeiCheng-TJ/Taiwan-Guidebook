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
    raise NotImplementedError("TODO(T4a): merge_lang_pairs")


def migrate_attraction(old: dict) -> dict:
    """Convert one attraction to schema version 2.

    - Applies merge_lang_pairs to the whole object.
    - Wraps ENGLISH_ONLY_FIELDS that are plain strings (anywhere in the object) as {"en": value}.
    - Sets "schema_version": SCHEMA_VERSION as the last key.
    - Idempotent: an object that already has schema_version == 2 is returned as an equal copy.
    """
    raise NotImplementedError("TODO(T4a): migrate_attraction")


def main(argv: list[str]) -> int:
    """CLI: python scripts/migrate_i18n.py [--write] [files...]

    - files default to data/attractions/*.json
    - without --write: print, per file, "would migrate <name>" or "already v2 <name>"; change nothing
    - with --write: rewrite each file in place (UTF-8, ensure_ascii=False, indent=2, trailing newline)
    - returns 0 on success, 1 if any file could not be read or parsed (and prints which)
    """
    raise NotImplementedError("TODO(T4a): main")


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
