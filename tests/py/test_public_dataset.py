"""data/taiwan_attractions.json lists the eras and categories the schema allows (it is read from the schema, not copied).

Run: uv run --no-project --python 3.12 python -m unittest discover -s tests/py
"""

import copy
import sys
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

import build_dataset  # noqa: E402


class PublicIndexes(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.schema = build_dataset.load_schema()
        cls.dataset, _ = build_dataset.compute_outputs()

    def test_indexes_are_the_schema_enums_in_order(self):
        self.assertEqual(self.dataset["categories_index"], self.schema["properties"]["category"]["enum"])
        self.assertEqual(self.dataset["eras_index"], self.schema["properties"]["eras"]["items"]["enum"])

    def test_every_place_uses_listed_values(self):
        for place in self.dataset["attractions"]:
            self.assertIn(place["category"], self.dataset["categories_index"], place["id"])
            for era in place["eras"]:
                self.assertIn(era, self.dataset["eras_index"], place["id"])

    def test_a_new_schema_value_reaches_the_dataset(self):
        changed = copy.deepcopy(self.schema)
        changed["properties"]["category"]["enum"].append("brand_new_category")
        changed["properties"]["eras"]["items"]["enum"].append("Brand New Era")
        with mock.patch.object(build_dataset, "load_schema", return_value=changed):
            dataset = build_dataset.build_public_dataset(self.dataset["attractions"], None, "2000-01-01")
        self.assertEqual(dataset["categories_index"][-1], "brand_new_category")
        self.assertEqual(dataset["eras_index"][-1], "Brand New Era")

    def test_a_missing_schema_stops_the_build(self):
        with mock.patch.object(build_dataset, "load_schema", return_value=None):
            with self.assertRaises(build_dataset.BuildError):
                build_dataset.build_public_dataset(self.dataset["attractions"], None, "2000-01-01")


if __name__ == "__main__":
    unittest.main()
