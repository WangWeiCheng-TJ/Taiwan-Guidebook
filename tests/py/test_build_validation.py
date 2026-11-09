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

    def test_to_try_must_be_a_list(self):
        for label, to_try in {"object": {}, "string": "x", "null": None}.items():
            with self.subTest(label), self.assertRaises(BuildError):
                self.load(good_city(to_try=to_try))


class FoodTextFields(FoodCase):
    """hint, local_label and dish are read as {en, zh_TW} by the food sheet and the Ask AI prompt."""

    def test_hint_must_be_a_bilingual_object(self):
        cases = {
            "plain string": "Closes early when sold out.",
            "only zh_TW": {"zh_TW": "售完提早打烊。"},
            "only en": {"en": "Closes early."},
            "empty en": {"en": " ", "zh_TW": "售完提早打烊。"},
            "non-string value": {"en": ["Closes early."], "zh_TW": "售完提早打烊。"},
            "null": None,
        }
        for label, hint in cases.items():
            with self.subTest(label), self.assertRaises(BuildError):
                self.load(good_city(picks=[self.pick(hint=hint)], to_try=[]))

    def test_local_label_must_be_a_bilingual_object(self):
        for label, value in {"plain string": "Tainan specialties", "only en": {"en": "Tainan specialties"}}.items():
            with self.subTest(label), self.assertRaises(BuildError):
                self.load(good_city(local_label=value))

    def test_dish_values_must_be_strings(self):
        with self.assertRaises(BuildError):
            self.load(good_city(picks=[self.pick(dish={"en": 5, "zh_TW": "蚵嗲"})], to_try=[]))

    def test_names_and_ids_must_be_strings(self):
        for label, pick in {"numeric name": self.pick(name=7), "numeric id": self.pick(id=7),
                            "blank name": self.pick(name="  "), "not an object": "店X"}.items():
            with self.subTest(label), self.assertRaises(BuildError):
                self.load(good_city(picks=[pick], to_try=[]))

    def test_city_names_must_be_text(self):
        for key in ("city_en", "city_zh"):
            with self.subTest(key=key), self.assertRaises(BuildError):
                self.load(good_city(**{key: ""}))

    def test_a_city_is_defined_in_one_file_only(self):
        write_json(self.dir / "a.json", good_city())
        write_json(self.dir / "b.json", good_city(picks=[self.pick()], to_try=[]))
        with self.assertRaisesRegex(BuildError, "already used"):
            build_dataset.load_food()


def place_in(city_en: str, city_zh: str) -> dict:
    return {"id": "x", "location": {"city_en": city_en, "city_zh": city_zh}}


class FoodCities(unittest.TestCase):
    """The app matches food.city_en to place.location.city_en as exact strings."""

    places = [place_in("Tainan City", "臺南市"), place_in("Taipei City", "臺北市"), place_in("Tainan City", "臺南市")]

    def test_matching_cities_pass(self):
        build_dataset.check_food_cities([good_city(), good_city(city_en="Taipei City", city_zh="臺北市")], self.places)
        build_dataset.check_food_cities([], self.places)

    def test_city_en_must_be_a_places_city(self):
        with self.assertRaisesRegex(BuildError, "Taipei"):
            build_dataset.check_food_cities([good_city(city_en="Taipei", city_zh="臺北市")], self.places)

    def test_city_zh_must_be_the_places_spelling(self):
        with self.assertRaisesRegex(BuildError, "city_zh"):
            build_dataset.check_food_cities([good_city(city_zh="台南市")], self.places)

    def test_the_real_data_passes(self):
        dataset, bundle = build_dataset.compute_outputs()
        build_dataset.check_food_cities(bundle["food"], dataset["attractions"])

    def test_the_bundle_build_rejects_a_mismatch(self):
        with tempfile.TemporaryDirectory() as tmp:
            write_json(Path(tmp) / "taipei.json", good_city(city_en="Taipei", city_zh="臺北市"))
            with mock.patch.object(build_dataset, "FOOD_DIR", Path(tmp)), self.assertRaises(BuildError):
                build_dataset.build_app_bundle(self.places, None, "2000-01-01")


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


def tickets(**over) -> dict:
    """The two-tickets phrase with a party field, as the data would carry it."""
    phrase = {
        "id": "two-tickets", "category": "sightseeing", "en": "Two tickets, please", "zh_TW": "請給我兩張票",
        "zhuyin": "ㄑㄧㄥˇ ㄍㄟˇ ㄨㄛˇ ㄌㄧㄤˇ ㄓㄤ ㄆㄧㄠˋ", "pinyin": "qǐng gěi wǒ liǎng zhāng piào",
        "party": {"zh_TW": "兩", "zhuyin": "ㄌㄧㄤˇ", "pinyin": "liǎng", "en_one": "One ticket, please",
                  "en_other": "{N} tickets, please"},
    }
    phrase.update(over)
    return phrase


class DataFileCase(unittest.TestCase):
    """Runs a loader on a temp copy of data/phrases.json or data/tips.json."""

    def run_loader(self, attr, loader, entries):
        with tempfile.TemporaryDirectory() as tmp:
            path = write_json(Path(tmp) / "list.json", entries)
            with mock.patch.object(build_dataset, attr, path):
                return loader()


class LoadPhrases(DataFileCase):
    def load(self, *phrases):
        return self.run_loader("PHRASES_FILE", build_dataset.load_phrases, list(phrases))

    def test_real_phrases_pass(self):
        self.assertTrue(build_dataset.load_phrases())

    def test_every_category_of_the_app_is_accepted(self):
        phrases = [{**tickets(), "id": cat, "category": cat} for cat in build_dataset.PHRASE_CATEGORIES]
        self.assertEqual(len(self.load(*phrases)), len(phrases))

    def test_unknown_category_is_rejected(self):
        for cat in ("sightseeing ", "transportation", "top", "", "Food"):
            with self.subTest(cat=repr(cat)), self.assertRaisesRegex(BuildError, "category"):
                self.load(tickets(category=cat))

    def test_a_valid_party_field_passes(self):
        self.assertEqual(len(self.load(tickets())), 1)

    def test_party_must_occur_in_the_phrase(self):
        bad = {
            "zh_TW not in the phrase": {"zh_TW": "二"},
            "zhuyin is not a syllable": {"zhuyin": "ㄌㄧㄤ"},
            "pinyin not in the phrase": {"pinyin": "èr"},
            "en_other has no number slot": {"en_other": "Tickets, please"},
            "missing en_one": {"en_one": ""},
        }
        for label, change in bad.items():
            party = {**tickets()["party"], **change}
            with self.subTest(label), self.assertRaisesRegex(BuildError, "party"):
                self.load(tickets(party=party))

    def test_party_must_be_an_object(self):
        for party in ("兩", None, ["兩"]):
            with self.subTest(party=party), self.assertRaisesRegex(BuildError, "party"):
                self.load(tickets(party=party))


class LoadTips(DataFileCase):
    def tip(self, **over):
        return {"id": "t", "scope": "global", "category": "safety", "title_en": "T", "body_en": "B", **over}

    def load(self, *tips):
        return self.run_loader("TIPS_FILE", build_dataset.load_tips, list(tips))

    def test_real_tips_pass(self):
        self.assertTrue(build_dataset.load_tips())

    def test_known_categories_pass(self):
        tips = [self.tip(id=cat, category=cat) for cat in build_dataset.TIP_CATEGORIES]
        self.assertEqual(len(self.load(*tips)), len(tips))

    def test_unknown_category_is_rejected(self):
        for cat in ("etiquette", "daily_life", "Safety", ""):
            with self.subTest(cat=cat), self.assertRaisesRegex(BuildError, "category"):
                self.load(self.tip(category=cat))


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
