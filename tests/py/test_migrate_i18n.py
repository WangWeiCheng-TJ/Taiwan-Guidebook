"""Contract for TASK T4a (scripts/migrate_i18n.py). Do not edit these tests to make them pass.

Run: uv run --no-project --python 3.12 python -m unittest discover -s tests/py
"""

import copy
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

from migrate_i18n import merge_lang_pairs, migrate_attraction, SCHEMA_VERSION  # noqa: E402

CHIHKAN = json.loads((ROOT / "data" / "attractions" / "chihkan-tower.json").read_text(encoding="utf-8"))


class MergeLangPairs(unittest.TestCase):
    def test_pairs_and_key_order(self):
        src = {"a": 1, "city_zh": "臺南市", "city_en": "Tainan City", "tip_en": "x", "tip_zh": "甲", "z": 2}
        out = merge_lang_pairs(src)
        self.assertEqual(list(out.keys()), ["a", "city", "tip", "z"])
        self.assertEqual(out["city"], {"zh_TW": "臺南市", "en": "Tainan City"})
        self.assertEqual(out["tip"], {"zh_TW": "甲", "en": "x"})
        self.assertEqual(out["a"], 1)
        self.assertEqual(out["z"], 2)

    def test_single_side_fields(self):
        out = merge_lang_pairs({"note_en": "hi", "label_zh": "嗨"})
        self.assertEqual(out, {"note": {"en": "hi"}, "label": {"zh_TW": "嗨"}})

    def test_nested_and_lists(self):
        src = {"timeline": [{"year": "1653", "event_zh": "建城", "event_en": "Built"}],
               "guide": {"spots_en": ["a", "b"], "spots_zh": ["甲", "乙"]}}
        out = merge_lang_pairs(src)
        self.assertEqual(out["timeline"][0], {"year": "1653", "event": {"zh_TW": "建城", "en": "Built"}})
        self.assertEqual(out["guide"]["spots"], {"zh_TW": ["甲", "乙"], "en": ["a", "b"]})

    def test_existing_maps_untouched_and_input_not_mutated(self):
        src = {"name": {"zh_TW": "赤崁樓", "en": "Chihkan Tower"}, "x_en": "1"}
        before = copy.deepcopy(src)
        out = merge_lang_pairs(src)
        self.assertEqual(out["name"], {"zh_TW": "赤崁樓", "en": "Chihkan Tower"})
        self.assertEqual(src, before)

    def test_scalars(self):
        self.assertEqual(merge_lang_pairs(5), 5)
        self.assertEqual(merge_lang_pairs("s"), "s")


class MigrateAttraction(unittest.TestCase):
    def test_real_file(self):
        out = migrate_attraction(CHIHKAN)
        self.assertEqual(out["schema_version"], SCHEMA_VERSION)
        self.assertEqual(list(out.keys())[-1], "schema_version")
        self.assertEqual(out["location"]["city"], {"zh_TW": "臺南市", "en": "Tainan City"})
        self.assertEqual(out["location"]["coordinates"], CHIHKAN["location"]["coordinates"])
        self.assertEqual(out["timeline"][0]["event"]["en"], CHIHKAN["timeline"][0]["event_en"])
        guide = out["foreign_visitor_guide"]
        self.assertEqual(guide["must_see_spots"]["en"], CHIHKAN["foreign_visitor_guide"]["must_see_spots_en"])
        self.assertEqual(guide["best_time_to_visit"], {"en": CHIHKAN["foreign_visitor_guide"]["best_time_to_visit"]})
        self.assertEqual(guide["recommended_duration_min"], 75)
        self.assertEqual(out["cultural_significance"]["why_it_matters"]["zh_TW"],
                         CHIHKAN["cultural_significance"]["why_it_matters_zh"])
        self.assertEqual(out["name"], CHIHKAN["name"])
        self.assertEqual(out["summary"], CHIHKAN["summary"])

    def test_idempotent(self):
        once = migrate_attraction(CHIHKAN)
        self.assertEqual(migrate_attraction(once), once)

    def test_no_language_suffix_left(self):
        def keys(v):
            if isinstance(v, dict):
                for k, x in v.items():
                    yield k
                    yield from keys(x)
            elif isinstance(v, list):
                for x in v:
                    yield from keys(x)
        leftovers = [k for k in keys(migrate_attraction(CHIHKAN)) if k.endswith(("_zh", "_en"))]
        self.assertEqual(leftovers, [])


if __name__ == "__main__":
    unittest.main()
