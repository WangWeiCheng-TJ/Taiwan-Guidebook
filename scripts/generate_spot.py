#!/usr/bin/env python3
"""
Taiwan Historical & Cultural Attraction Data Generator via Gemini API
Automatically generates bilingual historical, cultural, architectural, and chronological
travel datasets for attractions in Taiwan conforming to schema/attraction.schema.json.

Usage:
  uv run --no-project --python 3.12 python scripts/generate_spot.py "安平古堡"
  uv run --no-project --python 3.12 python scripts/generate_spot.py "霧峰林家宅園" --model gemini-2.5-flash
  uv run --no-project --python 3.12 python scripts/generate_spot.py --file spots.txt
  uv run --no-project --python 3.12 python scripts/generate_spot.py --interactive
"""

import os
import sys
import json
import re
import argparse
import urllib.request
import urllib.error
from pathlib import Path

# Ensure UTF-8 stdout on Windows
if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
ATTRACTIONS_DIR = DATA_DIR / "attractions"
SCHEMA_FILE = BASE_DIR / "schema" / "attraction.schema.json"


def load_env():
    """Load key-value pairs from .env file if present."""
    env_file = BASE_DIR / ".env"
    if env_file.exists():
        with open(env_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    k, v = line.split("=", 1)
                    k = k.strip()
                    v = v.strip().strip("'\"")
                    if k and not os.environ.get(k):
                        os.environ[k] = v


def get_api_key(cli_key: str = None) -> str:
    """Retrieve Gemini API Key from CLI, env or .env file."""
    load_env()
    key = cli_key or os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    return key.strip() if key else ""


def build_system_prompt() -> str:
    return """You are a senior Taiwanese cultural historian, architectural scholar, and international travel curator.
Your task is to generate a comprehensive, highly accurate, and engaging bilingual (Traditional Chinese zh_TW and English en) dataset for a Taiwan historical/cultural attraction.

The output MUST BE PURE JSON complying strictly with the following schema:

{
  "id": "kebab-case-english-id",
  "name": {
    "zh_TW": "繁體中文名稱",
    "en": "English Name"
  },
  "location": {
    "city_zh": "如：臺南市",
    "city_en": "e.g. Tainan City",
    "district_zh": "如：安平區",
    "district_en": "e.g. Anping District",
    "address_zh": "完整中文地址",
    "address_en": "Full English Address",
    "coordinates": {
      "lat": 22.9999,
      "lng": 120.1600
    }
  },
  "category": "One of: ['historical_fortress', 'temple_shrine', 'colonial_architecture', 'historic_street_district', 'industrial_heritage', 'indigenous_cultural_site', 'memorial_museum', 'traditional_residence', 'natural_cultural_landscape']",
  "eras": [
    "Select all applicable from exact list:",
    "Prehistoric & Indigenous",
    "Dutch & Spanish Era (1624–1662)",
    "Kingdom of Tungning (1661–1683)",
    "Qing Dynasty (1683–1895)",
    "Japanese Colonial Era (1895–1945)",
    "Post-WWII & Modern Era (1945–present)"
  ],
  "established_year": 1624,
  "heritage_status": "Official heritage designation in Chinese and English, e.g. National Historic Monument (國定古蹟)",
  "summary": {
    "zh_TW": "2-3句話精煉摘要其核心歷史地位與特色",
    "en": "2-3 sentences concise summary highlighting its historic importance for international readers"
  },
  "historical_narrative": {
    "zh_TW": "深入且生動的歷史沿革脈絡解說（約250-400字），強調時代更迭與歷史故事",
    "en": "In-depth historical narrative contextualized for international audiences (approx 150-250 words), explaining the geopolitical and cultural background"
  },
  "timeline": [
    {
      "year_or_era": "年份或時期 (如 1624 或 1895)",
      "era_category": "Era name (e.g. Dutch Formosa, Qing Dynasty, Japanese Colonial, Modern)",
      "event_zh": "中文重大里程碑事件說明",
      "event_en": "English milestone description"
    }
  ],
  "cultural_significance": {
    "why_it_matters_zh": "為何此地在臺灣歷史文化中不可或缺",
    "why_it_matters_en": "Why this site matters in Taiwan and global history",
    "architectural_highlights_zh": "主要建築美學、木構、雕刻或空間特色",
    "architectural_highlights_en": "Key architectural, structural, and artistic details",
    "intangible_culture_zh": "無形文化資產、節慶或常民記憶",
    "intangible_culture_en": "Intangible traditions, folklore, or local lifestyles"
  },
  "foreign_visitor_guide": {
    "etiquette_tips_en": "Practical advice and cultural etiquette (e.g. temple manners, stepping over thresholds, dress code, photography rules)",
    "etiquette_tips_zh": "外國旅客參觀文化禮儀須知",
    "must_see_spots_en": ["Bullet 1", "Bullet 2", "Bullet 3", "Bullet 4"],
    "must_see_spots_zh": ["看點一", "看點二", "看點三", "看點四"],
    "must_see": [
      {
        "name": {"en": "Exactly the same text as must_see_spots_en[0]", "zh_TW": "與 must_see_spots_zh[0] 完全相同"},
        "why": {"en": "1-2 sentences: why a first-time visitor should look at it", "zh_TW": "1-2 句：為什麼第一次來的人值得看"}
      }
    ],
    "free_entry": "true only if you are certain visiting is free; otherwise omit this field",
    "recommended_duration_min": 60,
    "transportation_en": "Step-by-step public transit instructions from major stations/MRT",
    "transportation_zh": "大眾運輸交通指引",
    "best_time_to_visit": "Best time of day / season to visit and why"
  },
  "tags": ["3 to 8 lowercase_underscore_tags"],
  "metadata": {
    "sources": ["URLs of official or encyclopedic pages that support the facts, if you know them; otherwise []"],
    "generated_by": "Gemini (generate_spot.py), pending owner review",
    "last_updated": "YYYY-MM-DD"
  }
}

CRITICAL RULES:
1. Output ONLY a valid JSON object. Do not include markdown code block backticks (```json ... ```) or conversational commentary.
2. Coordinates must be realistic latitude and longitude numbers in Taiwan.
3. eras array must ONLY use items from the specified 6 exact era strings.
4. Provide genuine historical depth, avoiding superficial tourism marketing fluff.
5. Never invent facts. Dates, heritage designations, awards, owners, prices and opening hours must be ones you are sure of; if unsure, leave them out or keep the sentence general. Do not upgrade claims (e.g. "the only one in Tainan" must not become "the only one in Taiwan").
6. must_see has one item per must_see_spots_en entry, in the same order, and its why only uses facts stated elsewhere in this JSON.
7. Every entry is reviewed by the owner before publishing; accuracy matters more than completeness.
"""


def call_gemini_api(spot_name: str, api_key: str, model: str = "gemini-2.5-flash") -> dict:
    """Call Gemini API via REST endpoint using standard library urllib."""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

    prompt = f"""Generate the full historical and cultural dataset for the Taiwan attraction: "{spot_name}".
Ensure deep historical accuracy, covering all historical eras it has lived through, chronological milestones, architectural analysis, and visitor etiquette for foreign travelers."""

    payload = {
        "system_instruction": {
            "parts": [{"text": build_system_prompt()}]
        },
        "contents": [
            {
                "parts": [{"text": prompt}]
            }
        ],
        "generationConfig": {
            "temperature": 0.2,
            "responseMimeType": "application/json"
        }
    }

    req_data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=req_data,
        headers={"Content-Type": "application/json"}
    )

    try:
        with urllib.request.urlopen(req, timeout=45) as response:
            res_body = response.read().decode("utf-8")
            res_json = json.loads(res_body)

            candidates = res_json.get("candidates", [])
            if not candidates:
                raise ValueError("No candidate responses returned by Gemini API.")

            text_content = candidates[0]["content"]["parts"][0]["text"]
            # Clean possible markdown fence if any
            clean_text = re.sub(r"^```(?:json)?\s*", "", text_content.strip(), flags=re.MULTILINE)
            clean_text = re.sub(r"\s*```$", "", clean_text.strip(), flags=re.MULTILINE)
            
            parsed_data = json.loads(clean_text)
            return parsed_data

    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Gemini API HTTP Error {e.code}: {err_msg}")
    except urllib.error.URLError as e:
        raise RuntimeError(f"Network error connecting to Gemini API: {e.reason}")


def save_attraction(data: dict, overwrite: bool = False) -> Path:
    """Save attraction JSON to data/attractions/<id>.json."""
    ATTRACTIONS_DIR.mkdir(parents=True, exist_ok=True)
    spot_id = data.get("id", "").strip().lower()
    if not spot_id:
        # Fallback slugify
        en_name = data.get("name", {}).get("en", "spot")
        spot_id = re.sub(r"[^a-z0-9]+", "-", en_name.lower()).strip("-")
        data["id"] = spot_id

    file_path = ATTRACTIONS_DIR / f"{spot_id}.json"
    if file_path.exists() and not overwrite:
        print(f"⚠️ File {file_path.name} already exists. Use --overwrite to replace it.")
        return file_path

    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"💾 Saved attraction to: {file_path}")
    return file_path


def update_compiled_dataset():
    """Trigger build_dataset.py to update compiled taiwan_attractions.json."""
    build_script = BASE_DIR / "scripts" / "build_dataset.py"
    if build_script.exists():
        import subprocess
        subprocess.run([sys.executable, str(build_script)], check=False)


def process_single_spot(spot_name: str, api_key: str, model: str, overwrite: bool = False):
    print(f"\n🔍 Querying Gemini API ({model}) for: '{spot_name}'...")
    try:
        data = call_gemini_api(spot_name, api_key, model=model)
        zh_name = data.get("name", {}).get("zh_TW", spot_name)
        en_name = data.get("name", {}).get("en", "")
        eras = data.get("eras", [])
        timeline_len = len(data.get("timeline", []))

        print(f"✨ Successfully retrieved: {zh_name} ({en_name})")
        print(f"   - Eras covered: {', '.join(eras)}")
        print(f"   - Timeline milestones: {timeline_len}")
        print(f"   - Category: {data.get('category')}")

        save_attraction(data, overwrite=overwrite)
        return True
    except Exception as e:
        print(f"❌ Failed to generate '{spot_name}': {e}")
        return False


def main():
    parser = argparse.ArgumentParser(
        description="Generate Taiwan historical & cultural attraction datasets using Gemini API"
    )
    parser.add_argument("spot_name", nargs="?", help="Name of the attraction in Chinese or English (e.g. '安平古堡')")
    parser.add_argument("--file", "-f", help="Path to text file containing a list of spot names (one per line)")
    parser.add_argument("--api-key", "-k", help="Gemini API Key (optional if GEMINI_API_KEY is set in environment or .env)")
    parser.add_argument("--model", "-m", default="gemini-2.5-flash", help="Gemini model name (default: gemini-2.5-flash)")
    parser.add_argument("--overwrite", action="store_true", help="Overwrite existing JSON file if present")
    parser.add_argument("--interactive", "-i", action="store_true", help="Interactive terminal mode")

    args = parser.parse_args()

    api_key = get_api_key(args.api_key)
    if not api_key:
        print("=" * 60)
        print("❌ [ERROR] Gemini API Key is missing!")
        print("=" * 60)
        print("Please provide an API key in one of the following ways:")
        print("  1. Create a '.env' file in the project root with: GEMINI_API_KEY=your_key_here")
        print("  2. Set the environment variable: export GEMINI_API_KEY=your_key_here (or $env:GEMINI_API_KEY in PowerShell)")
        print("  3. Pass via CLI argument: uv run --no-project --python 3.12 python scripts/generate_spot.py '景點名稱' --api-key your_key_here")
        print("\nGet a free Gemini API key at: https://aistudio.google.com/app/apikey")
        sys.exit(1)

    targets = []
    if args.file:
        file_path = Path(args.file)
        if not file_path.exists():
            print(f"❌ File not found: {file_path}")
            sys.exit(1)
        with open(file_path, "r", encoding="utf-8") as f:
            targets = [line.strip() for line in f if line.strip() and not line.strip().startswith("#")]
        print(f"📋 Loaded {len(targets)} spots from {file_path.name}")
    elif args.spot_name:
        targets = [args.spot_name.strip()]
    elif args.interactive or len(sys.argv) == 1:
        print("🇹🇼 Taiwan Historical Attraction Auto-Generator (Interactive Mode)")
        print("Enter attraction names to generate (or type 'exit' / 'q' to quit):")
        while True:
            try:
                user_input = input("\n👉 Enter Taiwan attraction name (e.g. 安平古堡 / 林百貨): ").strip()
                if user_input.lower() in ["exit", "quit", "q", ""]:
                    break
                success = process_single_spot(user_input, api_key, args.model, overwrite=args.overwrite)
                if success:
                    update_compiled_dataset()
            except (KeyboardInterrupt, EOFError):
                break
        print("\n👋 Goodbye!")
        sys.exit(0)

    success_count = 0
    for target in targets:
        if process_single_spot(target, api_key, args.model, overwrite=args.overwrite):
            success_count += 1

    if success_count > 0:
        print("\n🔄 Recompiling aggregated dataset...")
        update_compiled_dataset()

    print(f"\n🎉 Done! Processed {success_count}/{len(targets)} attractions successfully.")


if __name__ == "__main__":
    main()
