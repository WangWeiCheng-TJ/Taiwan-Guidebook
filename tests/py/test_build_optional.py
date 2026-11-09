"""Build: data/apps.json and data/topics/*.json are validated when present; jsonschema is required unless
--basic; generate_spot.py names files safely; check_sources.py --allow-missing.

Run: uv run --no-project --with "jsonschema>=4.20,<5" --python 3.12 python -m unittest discover -s tests/py
"""

import contextlib
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

import build_dataset  # noqa: E402
import check_sources  # noqa: E402
import generate_spot  # noqa: E402

BuildError = build_dataset.BuildError


def bi(text):
    return {"en": text, "zh_TW": text + " zh"}


def good_app(**over):
    return {"id": "line-taxi", "category": "taxi", "name": bi("Taxi"), "why": bi("Why"),
            "url": "https://example.test/app", "platforms": ["ios", "android"], **over}


def good_topic(**over):
    return {"id": "temple-layout", "title": bi("Temple layout"), "summary": bi("One sentence"),
            "body": {"en": ["Paragraph."], "zh_TW": ["段落。"]}, "tags": ["temple"], "places": [],
            "metadata": {"sources": ["https://example.test/"], "generated_by": "x, pending owner review",
                         "last_updated": "2026-10-20"}, **over}


class LoadApps(unittest.TestCase):
    def load(self, payload, raw=None):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "apps.json"
            path.write_text(raw if raw is not None else json.dumps(payload, ensure_ascii=False), encoding="utf-8")
            with mock.patch.object(build_dataset, "APPS_FILE", path):
                return build_dataset.load_apps()

    def test_missing_file_is_empty(self):
        with mock.patch.object(build_dataset, "APPS_FILE", ROOT / "no" / "apps.json"):
            self.assertEqual(build_dataset.load_apps(), [])

    def test_valid_apps_keep_data_order(self):
        apps = [good_app(id="b-app"), good_app(id="a-app", category="food")]
        self.assertEqual([a["id"] for a in self.load(apps)], ["b-app", "a-app"])

    def test_each_defect_is_rejected(self):
        for label, bad in {
            "category": good_app(category="games"),
            "http url": good_app(url="http://example.test/"),
            "javascript url": good_app(url="javascript:alert(1)"),
            "url with a space": good_app(url="https://example.test/a b"),
            "name not bilingual": good_app(name={"en": "Taxi"}),
            "empty why": good_app(why={"en": "x", "zh_TW": " "}),
            "platform": good_app(platforms=["windows"]),
            "no platforms": good_app(platforms=[]),
            "id": good_app(id="Line Taxi"),
            "missing key": {k: v for k, v in good_app().items() if k != "why"},
        }.items():
            with self.subTest(label), self.assertRaises(BuildError):
                self.load([bad])

    def test_duplicate_id_and_shape_are_rejected(self):
        with self.assertRaisesRegex(BuildError, "duplicate"):
            self.load([good_app(), good_app()])
        with self.assertRaises(BuildError):
            self.load({"id": "x"})
        with self.assertRaises(BuildError):
            self.load(None, raw="[not json")


class LoadTopics(unittest.TestCase):
    def load(self, files, place_ids=frozenset()):
        with tempfile.TemporaryDirectory() as tmp:
            for name, payload in files.items():
                (Path(tmp) / name).write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
            with mock.patch.object(build_dataset, "TOPICS_DIR", Path(tmp)):
                return build_dataset.load_topics(set(place_ids))

    def test_missing_folder_is_empty(self):
        with mock.patch.object(build_dataset, "TOPICS_DIR", ROOT / "no" / "topics"):
            self.assertEqual(build_dataset.load_topics(set()), [])

    def test_valid_topics_are_sorted_by_id(self):
        topics = self.load({"b-topic.json": good_topic(id="b-topic"), "a-topic.json": good_topic(id="a-topic")})
        self.assertEqual([t["id"] for t in topics], ["a-topic", "b-topic"])

    def test_known_place_ids_pass_unknown_fail(self):
        self.assertTrue(self.load({"temple-layout.json": good_topic(places=["chihkan-tower"])}, {"chihkan-tower"}))
        with self.assertRaisesRegex(BuildError, "not attractions"):
            self.load({"temple-layout.json": good_topic(places=["nowhere"])}, {"chihkan-tower"})

    def test_each_defect_is_rejected(self):
        for label, bad in {
            "id differs from the file name": good_topic(id="other"),
            "title": good_topic(title={"en": "T"}),
            "body": good_topic(body={"en": ["x"], "zh_TW": []}),
            "body as string": good_topic(body="text"),
            "tags": good_topic(tags="temple"),
            "metadata": good_topic(metadata={"sources": []}),
        }.items():
            with self.subTest(label), self.assertRaises(BuildError):
                self.load({"temple-layout.json": bad})


class BundleKeys(unittest.TestCase):
    def test_the_bundle_leaves_the_keys_out_when_there_is_no_data(self):
        with mock.patch.object(build_dataset, "APPS_FILE", ROOT / "no" / "apps.json"), \
                mock.patch.object(build_dataset, "TOPICS_DIR", ROOT / "no" / "topics"):
            _, bundle = build_dataset.compute_outputs(allow_basic=True)
        self.assertNotIn("apps", bundle)
        self.assertNotIn("topics", bundle)

    def test_the_bundle_carries_apps_and_topics_when_present(self):
        with tempfile.TemporaryDirectory() as tmp:
            apps = Path(tmp) / "apps.json"
            apps.write_text(json.dumps([good_app()]), encoding="utf-8")
            topics = Path(tmp) / "topics"
            topics.mkdir()
            (topics / "temple-layout.json").write_text(json.dumps(good_topic()), encoding="utf-8")
            with mock.patch.object(build_dataset, "APPS_FILE", apps), mock.patch.object(build_dataset, "TOPICS_DIR", topics):
                _, bundle = build_dataset.compute_outputs(allow_basic=True)
        self.assertEqual([a["id"] for a in bundle["apps"]], ["line-taxi"])
        self.assertEqual([t["id"] for t in bundle["topics"]], ["temple-layout"])


class SchemaRequired(unittest.TestCase):
    def test_without_jsonschema_the_build_fails_unless_basic(self):
        with mock.patch.object(build_dataset, "schema_validator", return_value=None):
            with self.assertRaisesRegex(BuildError, "jsonschema is not installed"):
                build_dataset.load_attractions()
            self.assertTrue(build_dataset.load_attractions(allow_basic=True))

    def test_the_real_build_ran_the_full_schema(self):
        lines = []
        build_dataset.load_attractions(log=lines.append)
        self.assertTrue(any("full JSON Schema" in line for line in lines))

    def test_the_schema_rejects_what_the_basic_checks_pass(self):
        place = json.loads((ROOT / "data" / "attractions" / "chihkan-tower.json").read_text(encoding="utf-8"))
        place["location"]["coordinates"]["lat"] = "22.99"
        validator = build_dataset.schema_validator(build_dataset.load_schema())
        self.assertEqual(build_dataset.validate_basic(place), [])
        self.assertTrue(list(validator.iter_errors(place)))

    def test_an_unknown_argument_is_a_usage_error(self):
        with contextlib.redirect_stdout(io.StringIO()), self.assertRaises(SystemExit) as cm:
            build_dataset.main(["--nope"])
        self.assertEqual(cm.exception.code, 2)


class GenerateSpot(unittest.TestCase):
    def test_slugify_id(self):
        slug = generate_spot.slugify_id
        self.assertEqual(slug({"id": "Fort-Zeelandia"}), "fort-zeelandia")
        self.assertEqual(slug({"id": "  ../../etc/passwd "}), "etc-passwd")
        self.assertEqual(slug({"id": "", "name": {"en": "Anping Old Fort"}}), "anping-old-fort")
        self.assertEqual(slug({"name": {"en": "Chihkan Tower!"}}), "chihkan-tower")
        with self.assertRaises(ValueError):
            slug({"id": "安平", "name": {"en": "安平"}})

    def test_save_writes_the_slug_as_id_with_lf(self):
        with tempfile.TemporaryDirectory() as tmp, mock.patch.object(generate_spot, "ATTRACTIONS_DIR", Path(tmp)), \
                contextlib.redirect_stdout(io.StringIO()):
            data = {"id": "Fort Zeelandia", "name": {"en": "x"}}
            path = generate_spot.save_attraction(data)
            self.assertEqual(path, Path(tmp) / "fort-zeelandia.json")
            self.assertEqual(data["id"], "fort-zeelandia")
            raw = path.read_bytes()
            self.assertNotIn(b"\r", raw)
            self.assertEqual(json.loads(raw)["id"], "fort-zeelandia")

    def test_save_skips_an_existing_file_and_says_so(self):
        with tempfile.TemporaryDirectory() as tmp, mock.patch.object(generate_spot, "ATTRACTIONS_DIR", Path(tmp)), \
                contextlib.redirect_stdout(io.StringIO()):
            (Path(tmp) / "a.json").write_text("{}", encoding="utf-8")
            self.assertIsNone(generate_spot.save_attraction({"id": "a"}))
            self.assertEqual((Path(tmp) / "a.json").read_text(encoding="utf-8"), "{}")
            self.assertIsNotNone(generate_spot.save_attraction({"id": "a"}, overwrite=True))

    def test_a_skipped_save_is_not_a_success(self):
        with mock.patch.object(generate_spot, "call_gemini_api", return_value={"id": "a", "name": {"en": "A"}}), \
                mock.patch.object(generate_spot, "save_attraction", return_value=None), \
                contextlib.redirect_stdout(io.StringIO()):
            self.assertFalse(generate_spot.process_single_spot("A", "key", "model"))

    def test_a_failed_build_is_reported(self):
        out = io.StringIO()
        with mock.patch("subprocess.run", return_value=mock.Mock(returncode=1)), contextlib.redirect_stdout(out):
            self.assertFalse(generate_spot.update_compiled_dataset())
        self.assertIn("build failed", out.getvalue())
        with mock.patch("subprocess.run", return_value=mock.Mock(returncode=0)):
            self.assertTrue(generate_spot.update_compiled_dataset())


class CheckSourcesAllowMissing(unittest.TestCase):
    def run_main(self, *argv):
        out = io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(io.StringIO()):
            return check_sources.main(list(argv)), out.getvalue()

    def test_a_missing_folder_is_an_error_without_the_flag_and_a_note_with_it(self):
        missing = str(ROOT / "docs" / "no-claims-here")
        self.assertEqual(self.run_main(missing)[0], 2)
        code, out = self.run_main("--allow-missing", missing)
        self.assertEqual(code, 0)
        self.assertIn("does not exist yet", out)
        self.assertIn("No claims to check", out)


if __name__ == "__main__":
    unittest.main()
