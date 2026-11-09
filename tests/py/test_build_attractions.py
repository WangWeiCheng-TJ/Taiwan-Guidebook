"""load_attractions: every place's id is its file name, so ids are unique and #/place/<id> opens the right place.

Run: uv run --no-project --python 3.12 python -m unittest discover -s tests/py
"""

import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

import build_dataset  # noqa: E402

REAL = ROOT / "data" / "attractions" / "chihkan-tower.json"


class AttractionIds(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.dir = Path(self._tmp.name)
        patcher = mock.patch.object(build_dataset, "ATTRACTIONS_DIR", self.dir)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.place = json.loads(REAL.read_text(encoding="utf-8"))

    def add(self, name: str, **over) -> None:
        (self.dir / name).write_text(json.dumps({**self.place, **over}, ensure_ascii=False), encoding="utf-8")

    def load(self, **kw):
        lines = []
        try:
            return build_dataset.load_attractions(log=lines.append, **kw), lines
        except build_dataset.BuildError:
            self.failed = lines
            raise

    def test_real_data_loads(self):
        # setUp pointed ATTRACTIONS_DIR at a temp folder: re-point it at the real one.
        with mock.patch.object(build_dataset, "ATTRACTIONS_DIR", ROOT / "data" / "attractions"):
            places = build_dataset.load_attractions()
        self.assertTrue(places)
        ids = [p["id"] for p in places]
        self.assertEqual(len(ids), len(set(ids)))

    def test_a_place_whose_id_is_its_file_name_loads(self):
        self.add("chihkan-tower.json")
        places, _ = self.load()
        self.assertEqual([p["id"] for p in places], ["chihkan-tower"])

    def test_a_renamed_copy_with_the_same_id_is_rejected(self):
        self.add("chihkan-tower.json")
        self.add("copy.json")  # still says id: chihkan-tower
        with self.assertRaises(build_dataset.BuildError):
            self.load()
        self.assertTrue(any("copy.json" in line for line in self.failed))
        self.assertTrue(any("must equal the file name 'copy'" in line for line in self.failed))

    def test_an_id_that_differs_from_the_file_name_is_rejected(self):
        self.add("x.json")
        with self.assertRaises(build_dataset.BuildError):
            self.load()

    def test_an_uppercase_id_is_rejected_even_without_the_schema(self):
        # generate_spot.py lowercased the id for the file name only; validate_basic has no id pattern
        self.add("fort-zeelandia.json", id="Fort-Zeelandia")
        with mock.patch.object(build_dataset, "schema_validator", return_value=None):
            with self.assertRaises(build_dataset.BuildError):
                self.load(allow_basic=True)

    def test_a_place_without_an_id_is_rejected(self):
        place = dict(self.place)
        del place["id"]
        (self.dir / "no-id.json").write_text(json.dumps(place, ensure_ascii=False), encoding="utf-8")
        with self.assertRaises(build_dataset.BuildError):
            self.load()


if __name__ == "__main__":
    unittest.main()
