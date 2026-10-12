#!/usr/bin/env python3
"""
Source-quote checker: does each researched claim still appear in its source?

Reads claims files (docs/claims/<subject>.json):

    {"subject": "chihkan-tower", "checked": "YYYY-MM-DD",
     "claims": [{"claim": "what the data says", "source": "https://...",
                 "quote": "exact short text copied from the source"}]}

fetches every source once, turns it into text (HTML, PDF via pypdf when
installed, JSON as raw text) and looks for each quote after normalizing both
sides (NFKC, one form of quotes, dashes and full-width punctuation, collapsed
whitespace, case-folded). Prints one line per claim and a summary.

Exit status: 0 when every quote is found (or skipped), 1 when any quote is
MISSING or a source could not be fetched, 2 for unreadable claims files.

Usage:
    npm run check:sources                         # docs/claims, live fetch
    uv run --no-project --with pypdf --python 3.12 python scripts/check_sources.py FILE_OR_DIR ...
        --save DIR      also write each fetched page to DIR/<sha1 of the URL>
        --offline DIR   read pages from DIR/<sha1 of the URL> instead of the network

Standard library only; pypdf is optional (PDF sources are skipped without it).
"""

import argparse
import functools
import gzip
import hashlib
import html
import http.client
import io
import json
import logging
import re
import ssl
import sys
import time
import unicodedata
import urllib.error
import urllib.request
import zlib
from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser
from http.cookiejar import CookieJar
from pathlib import Path
from urllib.parse import urldefrag

TIMEOUT = 20
MAX_BYTES = 30 * 1024 * 1024
MAX_QUOTE = 200
WORKERS = 6
USER_AGENT = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
              "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
PDF_SKIPPED = "skipped: pdf (install pypdf)"

# Characters folded to one ASCII form before comparing (applied after NFKC,
# which already maps full-width ASCII such as ，：（ to , : ( ).
_FOLD = str.maketrans({
    **dict.fromkeys("“”„‟«»「」『』〝〞〟", '"'),
    **dict.fromkeys("‘’‚‛′", "'"),
    **dict.fromkeys("‐‑‒–—―−⁃⸺⸻﹘", "-"),
    **dict.fromkeys("‧・∙⋅", "·"),
    **dict.fromkeys("〜", "~"),
    "。": ".", "、": ",",
    **dict.fromkeys("​‌‍⁠﻿­"),  # invisible: dropped
})
# CJK text has no word spaces, so spaces next to ideographs, kana, bopomofo, hangul,
# CJK punctuation or full-width punctuation (not full-width letters and digits) are
# dropped; PDF extraction and HTML line breaks put them anywhere.
_CJK = ("⺀-⿿　-〿぀-ㇿ㐀-䶿一-鿿가-힯"
        "豈-﫿︰-﹏！-／：-＠［-｀｛-･"
        "\U00020000-\U0003134f")
_SPACE_BY_CJK = re.compile(rf" (?=[{_CJK}])|(?<=[{_CJK}]) ")

_BLOCK_TAGS = {
    "address", "article", "aside", "blockquote", "br", "caption", "dd", "div", "dl", "dt",
    "figcaption", "figure", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "header",
    "hr", "li", "main", "nav", "ol", "option", "p", "pre", "section", "summary", "table",
    "tbody", "td", "tfoot", "th", "thead", "title", "tr", "ul",
}
_SKIP_TAGS = {"script", "style"}
_META_NAMES = {"description", "og:description", "og:title", "twitter:description", "twitter:title"}


class ClaimsError(Exception):
    """A claims file is missing, not JSON, or breaks the claims contract."""


class FetchError(Exception):
    """A source could not be fetched; the message is shown as 'fetch failed (<message>)'."""


# ---------------------------------------------------------------- pure helpers

def normalize_text(text: str) -> str:
    """Comparable form of text: NFKC, one form of quotes/dashes/CJK punctuation,
    invisible characters dropped, whitespace collapsed to single spaces (none
    next to CJK characters), case-folded. Idempotent."""
    text = _SPACE_BY_CJK.sub("", " ".join(text.split()))  # before NFKC turns ，into ,
    text = unicodedata.normalize("NFKC", text).translate(_FOLD)
    text = unicodedata.normalize("NFKC", text.casefold())
    text = re.sub(r"-{2,}", "-", text)
    return _SPACE_BY_CJK.sub("", " ".join(text.split()))


class _TextExtractor(HTMLParser):
    """Collects visible text; block tags become spaces, script/style are dropped."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self.skip = 0

    def handle_starttag(self, tag, attrs):
        if tag in _SKIP_TAGS:
            self.skip += 1
        elif tag == "meta":
            a = {k: (v or "") for k, v in attrs}
            if (a.get("name") or a.get("property") or "").lower() in _META_NAMES:
                self.parts.append(f" {a.get('content', '')} ")  # already unescaped
        elif tag in _BLOCK_TAGS:
            self.parts.append(" ")

    def handle_endtag(self, tag):
        if tag in _SKIP_TAGS:
            self.skip = max(0, self.skip - 1)
        elif tag in _BLOCK_TAGS:
            self.parts.append(" ")

    def handle_data(self, data):
        if not self.skip:
            self.parts.append(data)


def html_to_text(markup: str) -> str:
    """Visible text of an HTML page: tags stripped (block tags become spaces),
    script and style dropped, entities unescaped, meta descriptions kept."""
    parser = _TextExtractor()
    parser.feed(markup)
    parser.close()
    return "".join(parser.parts)


def json_to_text(raw: str) -> str:
    """Raw JSON text plus its decoded string values (so \\uXXXX escapes and
    HTML inside values, e.g. Commons API metadata, can match too)."""
    try:
        data = json.loads(raw)
    except ValueError:
        return raw
    strings = []

    def walk(node):
        if isinstance(node, str):
            strings.append(html_to_text(node))
        elif isinstance(node, dict):
            for value in node.values():
                walk(value)
        elif isinstance(node, list):
            for value in node:
                walk(value)

    walk(data)
    return raw + "\n" + "\n".join(strings)


def quote_found(quote: str, text: str) -> bool:
    """True when the normalized quote occurs in the normalized text."""
    needle = normalize_text(quote)
    return bool(needle) and needle in normalize_text(text)


def load_claims(paths) -> list:
    """Claims from claims files and directories of them (*.json, sorted), as dicts
    {file, subject, claim, source, quote} in file order. Raises ClaimsError."""
    files = []
    for p in map(Path, paths):
        if p.is_dir():
            files.extend(sorted(p.glob("*.json")))
        elif p.is_file():
            files.append(p)
        else:
            raise ClaimsError(f"{p}: no such file or directory")
    claims = []
    for f in files:
        try:
            doc = json.loads(f.read_text(encoding="utf-8"))
        except (OSError, ValueError) as e:
            raise ClaimsError(f"{f}: unreadable JSON ({e})") from None
        if not isinstance(doc, dict) or not isinstance(doc.get("claims"), list):
            raise ClaimsError(f"{f}: expected an object with a 'claims' list")
        subject = str(doc.get("subject") or f.stem)
        for i, c in enumerate(doc["claims"]):
            where = f"{f}: claims[{i}]"
            if not isinstance(c, dict):
                raise ClaimsError(f"{where}: expected an object")
            source, quote = c.get("source"), c.get("quote")
            if not isinstance(source, str) or not re.match(r"https?://", source):
                raise ClaimsError(f"{where}: 'source' must be an http(s) URL")
            if not isinstance(quote, str) or not normalize_text(quote):
                raise ClaimsError(f"{where}: 'quote' must be non-empty text")
            if len(quote) > MAX_QUOTE:
                raise ClaimsError(f"{where}: 'quote' is longer than {MAX_QUOTE} characters")
            claims.append({"file": str(f), "subject": subject, "claim": str(c.get("claim", "")),
                           "source": source, "quote": quote})
    return claims


def cache_name(url: str) -> str:
    """Cache file name of a source: sha1 hex of the URL without its #fragment."""
    return hashlib.sha1(urldefrag(url)[0].encode("utf-8")).hexdigest()


def page_kind(body: bytes, content_type: str = "") -> str:
    """'pdf', 'json' or 'html' (anything else is read as HTML), from the
    Content-Type when known, else from the bytes."""
    ct = content_type.lower()
    if "pdf" in ct or body[:1024].lstrip().startswith(b"%PDF-"):
        return "pdf"
    if "json" in ct:
        return "json"
    if not ct and body.lstrip()[:1] in (b"{", b"["):
        try:
            json.loads(body)
            return "json"
        except ValueError:
            pass
    return "html"


def decode_body(body: bytes, content_type: str = "") -> str:
    """Bytes to str: charset from the Content-Type or a <meta> tag, else UTF-8,
    else Big5 (cp950, older Taiwanese sites), else UTF-8 with replacement."""
    m = re.search(r"charset=[\"']?([\w-]+)", content_type, re.I) or \
        re.search(rb"<meta[^>]+charset=[\"']?([\w-]+)", body[:4096], re.I)
    declared = m.group(1) if m else None
    if isinstance(declared, bytes):
        declared = declared.decode("ascii", "ignore")
    for enc in filter(None, [declared, "utf-8", "cp950"]):
        try:
            return body.decode(enc)
        except (LookupError, UnicodeDecodeError):
            continue
    return body.decode("utf-8", "replace")


def pdf_to_text(body: bytes):
    """Text of a PDF via pypdf, or None when pypdf is not installed."""
    try:
        from pypdf import PdfReader
    except ImportError:
        return None
    logging.getLogger("pypdf").setLevel(logging.ERROR)
    reader = PdfReader(io.BytesIO(body))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def page_texts(body: bytes, content_type: str = ""):
    """Searchable texts of a fetched page as [(status suffix, text)], best first,
    or None for a PDF when pypdf is missing. For HTML the second entry is the raw
    page source with entities unescaped, which catches text that only scripts
    render (e.g. JSON embedded in the page)."""
    kind = page_kind(body, content_type)
    if kind == "pdf":
        text = pdf_to_text(body)
        return None if text is None else [("", text)]
    raw = decode_body(body, content_type)
    if kind == "json":
        return [("", json_to_text(raw))]
    return [("", html_to_text(raw)), (" (page source)", html.unescape(raw))]


def check_claim(quote: str, texts) -> str:
    """Status of one quote against page_texts() output whose texts are already
    normalized (load_page does that once per URL): 'found...', 'MISSING' or skipped."""
    if texts is None:
        return PDF_SKIPPED
    needle = normalize_text(quote)
    for label, text in texts:
        if needle in text:
            return "found" + label
    return "MISSING"


def outcome(status: str) -> str:
    """Summary bucket of a status: found, missing, failed or skipped."""
    if status.startswith("found"):
        return "found"
    if status.startswith("skipped"):
        return "skipped"
    return "missing" if status == "MISSING" else "failed"


# ---------------------------------------------------------------- I/O

@functools.lru_cache(maxsize=1)
def ssl_context() -> ssl.SSLContext:
    """Verifying TLS context. On Windows it trusts the system ROOT and CA stores
    minus expired certificates: an expired ISRG Root X2 cross-sign left in the
    CA store makes the default context reject Let's Encrypt sites (Wikipedia)."""
    if not hasattr(ssl, "enum_certificates"):
        return ssl.create_default_context()
    probe = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    for store in ("ROOT", "CA"):
        for cert, encoding, trust in ssl.enum_certificates(store):
            if encoding == "x509_asn" and (trust is True or ssl.Purpose.SERVER_AUTH.oid in trust):
                try:
                    probe.load_verify_locations(cadata=cert)
                except ssl.SSLError:
                    pass
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    now = time.time()
    for info, der in zip(probe.get_ca_certs(), probe.get_ca_certs(binary_form=True)):
        if ssl.cert_time_to_seconds(info["notAfter"]) > now:
            ctx.load_verify_locations(cadata=der)
    return ctx


def fetch(url: str, timeout: float = TIMEOUT):
    """(body bytes, content type) of url; follows redirects. Raises FetchError."""
    opener = urllib.request.build_opener(urllib.request.HTTPSHandler(context=ssl_context()),
                                         urllib.request.HTTPCookieProcessor(CookieJar()))
    req = urllib.request.Request(urldefrag(url)[0], headers={
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,application/pdf,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,zh-TW;q=0.8",
    })
    try:
        with opener.open(req, timeout=timeout) as resp:
            body = resp.read(MAX_BYTES + 1)
            encoding = (resp.headers.get("Content-Encoding") or "").lower()
            content_type = resp.headers.get("Content-Type") or ""
    except urllib.error.HTTPError as e:
        raise FetchError(f"HTTP {e.code}") from None
    except urllib.error.URLError as e:
        raise FetchError(str(getattr(e, "reason", e))) from None
    except (OSError, ValueError, http.client.HTTPException) as e:
        raise FetchError(str(e) or type(e).__name__) from None
    if len(body) > MAX_BYTES:
        raise FetchError(f"larger than {MAX_BYTES // (1024 * 1024)} MB")
    try:
        if encoding == "gzip":
            body = gzip.decompress(body)
        elif encoding == "deflate":
            body = zlib.decompress(body)
    except (OSError, zlib.error) as e:
        raise FetchError(f"bad {encoding} body ({e})") from None
    return body, content_type


def load_page(url: str, offline=None, save=None):
    """Normalized searchable texts of url (see page_texts) or an error string
    starting with 'fetch failed'. Reads offline/<cache_name> when offline is set."""
    try:
        if offline:
            path = Path(offline) / cache_name(url)
            if not path.is_file():
                raise FetchError("not in offline cache")
            body, content_type = path.read_bytes(), ""
        else:
            body, content_type = fetch(url)
            if save:
                Path(save).mkdir(parents=True, exist_ok=True)
                (Path(save) / cache_name(url)).write_bytes(body)
        texts = page_texts(body, content_type)
    except FetchError as e:
        return f"fetch failed ({e})"
    except Exception as e:  # noqa: BLE001  unreadable PDF or page: report, keep going
        return f"fetch failed (unreadable page: {type(e).__name__}: {e})"
    return None if texts is None else [(label, normalize_text(t)) for label, t in texts]


def preview(text: str, width: int = 60) -> str:
    """One-line excerpt of text, at most width characters."""
    text = " ".join(text.split())
    return text if len(text) <= width else text[:width - 1] + "…"


def main(argv=None) -> int:
    """CLI entry point; returns the exit status."""
    ap = argparse.ArgumentParser(description="Check that each claim's quote appears in its source.")
    ap.add_argument("paths", nargs="+", help="claims JSON files or directories of them")
    mode = ap.add_mutually_exclusive_group()
    mode.add_argument("--offline", metavar="DIR", help="read pages from DIR/<sha1(url)>, no network")
    mode.add_argument("--save", metavar="DIR", help="write fetched pages to DIR/<sha1(url)>")
    args = ap.parse_args(argv)
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass

    try:
        claims = load_claims(args.paths)
    except ClaimsError as e:
        print(f"error: {e}", file=sys.stderr)
        return 2

    urls = list(dict.fromkeys(urldefrag(c["source"])[0] for c in claims))
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        pages = dict(zip(urls, pool.map(lambda u: load_page(u, args.offline, args.save), urls)))

    counts = {"found": 0, "missing": 0, "failed": 0, "skipped": 0}
    for c in claims:
        page = pages[urldefrag(c["source"])[0]]
        status = page if isinstance(page, str) else check_claim(c["quote"], page)
        counts[outcome(status)] += 1
        print(f"{status:<7}  {c['subject']}  \"{preview(c['quote'])}\"  {c['source']}")

    files = len({c["file"] for c in claims})
    print(f"\n{len(claims)} claims, {len(urls)} sources, {files} files: "
          f"{counts['found']} found, {counts['missing']} MISSING, "
          f"{counts['failed']} fetch failed, {counts['skipped']} skipped")
    return 1 if counts["missing"] or counts["failed"] else 0


if __name__ == "__main__":
    sys.exit(main())
