"""The build's rejection paths: bad input to load_food, load_list and validate_basic must fail loudly.

Each case feeds one defect to the loader (temp files, patched paths) and expects BuildError or a
non-empty error list, so deleting a check from scripts/build_dataset.py turns a test red.

Run: uv run --no-project --python 3.12 python -m unittest discover -s tests/py
"""

import copy
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

import build_dataset  # noqa: E402

BuildError = build_dataset.BuildError


def write_json(path: Path, payload) -> Path:
    path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    return path


def good_city(**over) -> dict:
    """A valid data/food/<city>.json payload."""
    city = {
        "city_en": "Tainan City",
        "city_zh": "臺南市",
        "local_label": {"en": "Tainan specialties", "zh_TW": "台南特色"},
        "picks": [
            {"id": "shop-a", "name": "店A", "kind": "taiwanese", "local": True,
             "dish": {"en": "Oyster fritters", "zh_TW": "蚵嗲"}},
            {"id": "shop-b", "name": "店B", "kind": "ramen",
             "hint": {"en": "Closes early.", "zh_TW": "提早打烊。"}},
        ],
        "to_try": [{"id": "dish-c", "dish": {"en": "Danzai noodles", "zh_TW": "擔仔麵"}}],
    }
    city.update(over)
    return city


class FoodCase(unittest.TestCase):
    """Runs load_food on one city file in a temp data/food/."""

    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.dir = Path(self._tmp.name)
        patcher = mock.patch.object(build_dataset, "FOOD_DIR", self.dir)
        patcher.start()
        self.addCleanup(patcher.stop)

    def load(self, city):
        write_json(self.dir / "city.json", city)
        return build_dataset.load_food()

    def pick(self, **over) -> dict:
        pick = {"id": "shop-x", "name": "店X", "kind": "taiwanese"}
        pick.update(over)
        return pick


class LoadFood(FoodCase):
    def test_valid_file_loads_unchanged(self):
        city = good_city()
        self.assertEqual(self.load(city), [city])

    def test_missing_folder_is_no_food(self):
        with mock.patch.object(build_dataset, "FOOD_DIR", self.dir / "nope"):
            self.assertEqual(build_dataset.load_food(), [])

    def test_missing_city_keys(self):
        for key in ("city_en", "city_zh", "picks"):
            city = good_city()
            del city[key]
            with self.subTest(key=key), self.assertRaises(BuildError):
                self.load(city)

    def test_bad_picks(self):
        cases = {
            "duplicate id": [self.pick(), self.pick()],
            "unknown kind": [self.pick(kind="pizza")],
            "missing kind": [{"id": "x", "name": "店"}],
            "missing id": [{"name": "店", "kind": "ramen"}],
            "missing name": [{"id": "x", "kind": "ramen"}],
            "non-bool local": [self.pick(local="yes")],
            "dish without zh_TW": [self.pick(dish={"en": "x"})],
            "dish is a string": [self.pick(dish="Oyster fritters")],
        }
        for label, picks in cases.items():
            with self.subTest(label), self.assertRaises(BuildError):
                self.load(good_city(picks=picks, to_try=[]))

    def test_bad_to_try(self):
        cases = {
            "repeats a pick id": [{"id": "shop-a", "dish": {"en": "x", "zh_TW": "y"}}],
            "duplicate id": [{"id": "d", "dish": {"en": "x", "zh_TW": "y"}}] * 2,
            "missing zh_TW": [{"id": "d", "dish": {"en": "x"}}],
            "missing dish": [{"id": "d"}],
            "missing id": [{"dish": {"en": "x", "zh_TW": "y"}}],
        }
        for label, to_try in cases.items():
            with self.subTest(label), self.assertRaises(BuildError):
                self.load(good_city(to_try=to_try))


class LoadList(unittest.TestCase):
    def test_missing_file_is_empty(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.assertEqual(build_dataset.load_list(Path(tmp) / "nope.json", ["id"]), [])

    def test_valid_list_comes_back_in_order(self):
        with tempfile.TemporaryDirectory() as tmp:
            entries = [{"id": "b", "en": "B"}, {"id": "a", "en": "A"}]
            path = write_json(Path(tmp) / "list.json", entries)
            self.assertEqual(build_dataset.load_list(path, ["id", "en"]), entries)

    def test_missing_key_and_duplicate_id(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "list.json"
            write_json(path, [{"id": "a", "en": "A"}, {"id": "b"}])
            with self.assertRaises(BuildError):
                build_dataset.load_list(path, ["id", "en"])
            write_json(path, [{"id": "a", "en": "A"}, {"id": "a", "en": "again"}])
            with self.assertRaises(BuildError):
                build_dataset.load_list(path, ["id", "en"])


class ValidateBasic(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        path = ROOT / "data" / "attractions" / "chihkan-tower.json"
        cls.place = json.loads(path.read_text(encoding="utf-8"))
        cls.categories = build_dataset.load_schema()["properties"]["category"]["enum"]

    def check(self, mutate):
        data = copy.deepcopy(self.place)
        mutate(data)
        return build_dataset.validate_basic(data, self.categories)

    def test_real_place_passes(self):
        self.assertEqual(build_dataset.validate_basic(self.place, self.categories), [])

    def test_each_required_key(self):
        for key in ("id", "name", "location", "category", "eras", "summary", "historical_narrative",
                    "timeline", "cultural_significance", "foreign_visitor_guide", "tags"):
            with self.subTest(key=key):
                self.assertTrue(self.check(lambda d, k=key: d.pop(k)))

    def test_rejects_bad_values(self):
        cases = {
            "unknown category": lambda d: d.update(category="nope"),
            "eras is a string": lambda d: d.update(eras="Qing Dynasty (1683–1895)"),
            "tags is a string": lambda d: d.update(tags="a,b"),
            "empty timeline": lambda d: d.update(timeline=[]),
            "name without en": lambda d: d.update(name={"zh_TW": "赤崁樓"}),
            "location without coordinates": lambda d: d.update(location={"city_en": "x"}),
            "coordinates without lng": lambda d: d["location"].update(coordinates={"lat": 23.0}),
        }
        for label, mutate in cases.items():
            with self.subTest(label):
                self.assertTrue(self.check(mutate))

    def test_a_category_is_not_checked_when_no_list_is_given(self):
        data = copy.deepcopy(self.place)
        data["category"] = "nope"
        self.assertEqual(build_dataset.validate_basic(data), [])

    def test_not_an_object(self):
        for bad in ([], "x", None, 3):
            with self.subTest(bad=bad):
                self.assertTrue(build_dataset.validate_basic(bad, self.categories))


if __name__ == "__main__":
    unittest.main()
