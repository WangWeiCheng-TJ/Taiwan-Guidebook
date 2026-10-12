"""The committed build outputs match data/: catches data edits committed without `npm run build`.

Computes the outputs in memory with scripts/build_dataset.py (writes nothing).
Needs no jsonschema: the build module imports it lazily.

Run: uv run --no-project --python 3.12 python -m unittest discover -s tests/py
"""

import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

import build_dataset  # noqa: E402

STALE = "is stale: run `npm run build` and commit the result"


def committed(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


class BundleFresh(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.dataset, cls.bundle = build_dataset.compute_outputs()

    def test_app_bundle_version_matches_data(self):
        current = committed(build_dataset.APP_OUTPUT_FILE)
        self.assertEqual(current.get("version"), self.bundle["version"],
                         f"app/data/guidebook.json {STALE}")

    def test_app_bundle_content_matches_data(self):
        # Same version but different content means the bundle was edited by hand
        current = committed(build_dataset.APP_OUTPUT_FILE)
        self.assertTrue(current == self.bundle, f"app/data/guidebook.json {STALE}")

    def test_public_dataset_matches_data(self):
        current = committed(build_dataset.OUTPUT_FILE)
        self.assertTrue(current == self.dataset, f"data/taiwan_attractions.json {STALE}")


class GeneratedAt(unittest.TestCase):
    """A rebuild of unchanged data on another day keeps generated_at."""

    def test_bundle_keeps_date_when_version_unchanged(self):
        _, first = build_dataset.compute_outputs(today="2000-01-01")
        previous = {"version": first["version"], "generated_at": "1999-12-31"}
        again = build_dataset.build_app_bundle(first["places"], previous, "2000-01-02")
        self.assertEqual(again["generated_at"], "1999-12-31")

    def test_bundle_dates_new_version_today(self):
        _, first = build_dataset.compute_outputs()
        previous = {"version": "000000000000", "generated_at": "1999-12-31"}
        again = build_dataset.build_app_bundle(first["places"], previous, "2000-01-02")
        self.assertEqual(again["generated_at"], "2000-01-02")

    def test_public_dataset_keeps_date_only_when_unchanged(self):
        dataset, _ = build_dataset.compute_outputs()
        previous = json.loads(json.dumps(dataset))
        previous["metadata"]["generated_at"] = "1999-12-31"
        same = build_dataset.build_public_dataset(dataset["attractions"], previous, "2000-01-02")
        self.assertEqual(same["metadata"]["generated_at"], "1999-12-31")
        fewer = build_dataset.build_public_dataset(dataset["attractions"][1:], previous, "2000-01-02")
        self.assertEqual(fewer["metadata"]["generated_at"], "2000-01-02")


if __name__ == "__main__":
    unittest.main()
