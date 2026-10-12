"""scripts/check_sources.py: normalization, HTML text, claims loading and an offline run. No network.

Run: uv run --no-project --python 3.12 python -m unittest discover -s tests/py
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

import check_sources as cs  # noqa: E402


class Normalize(unittest.TestCase):
    def test_full_width_punctuation_and_quotes(self):
        self.assertEqual(cs.normalize_text("「赤崁樓」，建於１６５３年。"),
                         cs.normalize_text('"赤崁樓",建於1653年.'))
        self.assertEqual(cs.normalize_text("Fort “Provintia” – built"),
                         cs.normalize_text('fort "provintia" - BUILT'))

    def test_whitespace_and_cjk_spacing(self):
        self.assertEqual(cs.normalize_text("  Open  daily\n\t9:00 "), "open daily 9:00")
        self.assertEqual(cs.normalize_text("臺 南\n市"), "臺南市")
        # PDF extraction spacing around CJK punctuation; full-width letters keep word spaces
        self.assertEqual(cs.normalize_text("殘蹟」 、 「東門 段殘\n蹟」共 6 處"),
                         cs.normalize_text("殘蹟」、「東門段殘蹟」共6處"))
        self.assertEqual(cs.normalize_text("ＴＥＬ 06"), "tel 06")

    def test_idempotent(self):
        once = cs.normalize_text("A ‧ 「b」 — Ｃ​")
        self.assertEqual(cs.normalize_text(once), once)


class HtmlToText(unittest.TestCase):
    def test_drops_script_style_and_unescapes(self):
        page = ("<html><head><style>p{color:red}</style><script>var q = 'hidden';</script></head>"
                "<body><p>Tom &amp; Jerry&nbsp;&#x81FA;</p><div>next</div></body></html>")
        text = cs.html_to_text(page)
        self.assertNotIn("hidden", text)
        self.assertNotIn("color", text)
        self.assertIn("Tom & Jerry 臺", text)
        self.assertTrue(cs.quote_found("jerry 臺 next", text))


class QuoteFound(unittest.TestCase):
    def test_positive_and_negative(self):
        text = "<p>The tower was built in 1653 by the Dutch.</p>"
        self.assertTrue(cs.quote_found("built in  1653", cs.html_to_text(text)))
        self.assertFalse(cs.quote_found("built in 1654", cs.html_to_text(text)))
        self.assertFalse(cs.quote_found("   ", text))


def write_claims(folder: Path, name: str, claims, subject="chihkan-tower"):
    doc = {"subject": subject, "checked": "2026-10-13", "claims": claims}
    (folder / name).write_text(json.dumps(doc, ensure_ascii=False), encoding="utf-8")


class LoadClaims(unittest.TestCase):
    def test_directory_sorted_and_invalid(self):
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            write_claims(d, "b.json", [{"claim": "x", "source": "https://b.test/", "quote": "b"}], "b")
            write_claims(d, "a.json", [{"claim": "y", "source": "https://a.test/", "quote": "a"}], "a")
            claims = cs.load_claims([d])
            self.assertEqual([c["subject"] for c in claims], ["a", "b"])
            self.assertEqual(claims[0]["source"], "https://a.test/")
            write_claims(d, "c.json", [{"claim": "z", "source": "file:///etc/passwd", "quote": "c"}])
            with self.assertRaises(cs.ClaimsError):
                cs.load_claims([d])


class OfflineRun(unittest.TestCase):
    def run_main(self, *argv):
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            code = cs.main(list(argv))
        return code, out.getvalue()

    def test_found_missing_and_not_cached(self):
        with tempfile.TemporaryDirectory() as tmp:
            d, cache = Path(tmp) / "claims", Path(tmp) / "cache"
            d.mkdir()
            cache.mkdir()
            page = "https://example.test/tower"
            (cache / cs.cache_name(page)).write_text(
                "<p>赤崁樓，<b>建於</b>1653年。</p><p>Open daily.</p>", encoding="utf-8")
            write_claims(d, "tower.json", [
                {"claim": "built 1653", "source": page + "#history", "quote": "赤崁樓,建於 1653 年"},
                {"claim": "open", "source": page, "quote": "OPEN DAILY"},
            ])
            code, out = self.run_main(str(d), "--offline", str(cache))
            self.assertEqual(code, 0, out)
            self.assertEqual(out.count("found"), 3)  # two lines and the summary

            write_claims(d, "tower.json", [
                {"claim": "closed", "source": page, "quote": "Closed on Mondays"},
                {"claim": "gone", "source": "https://example.test/gone", "quote": "x"},
            ])
            code, out = self.run_main(str(d), "--offline", str(cache))
            self.assertEqual(code, 1)
            self.assertIn("MISSING", out)
            self.assertIn("fetch failed (not in offline cache)", out)

    def test_pdf_without_pypdf_is_skipped(self):
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            url = "https://example.test/report.pdf"
            (d / cs.cache_name(url)).write_bytes(b"%PDF-1.4\n...")
            write_claims(d, "claims.json", [{"claim": "c", "source": url, "quote": "q"}])
            with mock.patch.object(cs, "pdf_to_text", return_value=None):
                code, out = self.run_main(str(d / "claims.json"), "--offline", str(d))
            self.assertEqual(code, 0)
            self.assertIn(cs.PDF_SKIPPED, out)


if __name__ == "__main__":
    unittest.main()
