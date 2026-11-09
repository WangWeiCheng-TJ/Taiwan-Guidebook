"""schema: foreign_visitor_guide.always_open must be a boolean (the app reads it with === true)."""

import copy
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

try:
    import jsonschema
except ImportError:  # npm run test:py runs without it; npm run build has it
    jsonschema = None


@unittest.skipIf(jsonschema is None, "jsonschema is not installed")
class AlwaysOpenSchema(unittest.TestCase):
    def setUp(self):
        self.schema = json.loads((ROOT / "schema" / "attraction.schema.json").read_text(encoding="utf-8"))
        self.place = json.loads((ROOT / "data" / "attractions" / "duiyue-gate.json").read_text(encoding="utf-8"))

    def errors(self, place):
        return list(jsonschema.Draft202012Validator(self.schema).iter_errors(place))

    def test_the_real_record_passes(self):
        self.assertIs(self.place["foreign_visitor_guide"]["always_open"], True)
        self.assertEqual(self.errors(self.place), [])

    def test_a_string_is_rejected(self):
        place = copy.deepcopy(self.place)
        place["foreign_visitor_guide"]["always_open"] = "true"
        self.assertTrue(self.errors(place))


if __name__ == "__main__":
    unittest.main()
