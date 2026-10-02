from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import urllib.error
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
REPORTS_ROOT = ROOT.parents[1]
DATA_PATH = ROOT / "data" / "processed" / "quadchart.json"
OUTPUT_PATH = ROOT / "data" / "processed" / "comp_context.json"
PUBLIC_PATH = ROOT / "public" / "data" / "comp_context.json"
API_URL = "https://api.openai.com/v1/responses"
WINDOW_DAYS = 180

DISPLAY_MODELS = (
    "Civic", "Corolla", "Elantra", "K4", "Sentra", "Outback", "Santa Fe",
    "Passport", "Sorento", "Cherokee", "Blazer", "Edge", "Corolla Cross",
    "Crosstrek", "Trax", "HR-V", "Seltos", "Kona", "Kicks", "Trailblazer",
    "CX-30", "Venue", "Model Y", "R2", "Ioniq 5", "Mach E", "Bz",
    "Prologue", "Leaf", "EV6", "Equinox EV", "ID4", "Ariya", "Model X",
    "R1S", "ID Buzz", "EV9", "Ioniq 9", "Vistiq", "Yukon EV", "Camry",
    "Accord", "K5", "Altima", "Sonata", "Pilot", "Telluride", "Highlander",
    "Explorer", "Palisade", "Grand Cherokee", "Traverse", "Grand Highlander",
    "Rav4", "CR-V", "Tucson", "Rogue", "Forester", "Sportage", "CX-50",
    "Santa Cruz",
)


def norm(value: str) -> str:
    return re.sub(r"^_|_$", "", re.sub(r"[^a-z0-9]+", "_", value.lower()))


DISPLAY_NORMALIZED = tuple(norm(value) for value in DISPLAY_MODELS)


def is_display_family(family_key: str) -> bool:
    base = family_key.split("__", 1)[0]
    return any(base == model or base.startswith(model + "_") or base.endswith("_" + model) for model in DISPLAY_NORMALIZED)


def pretty_family(value: str) -> str:
    special = {
        "rav4": "RAV4", "cr_v": "CR-V", "hr_v": "HR-V", "ev6": "EV6",
        "id_4": "ID.4", "id-4": "ID.4", "k4": "K4",
        "cx_30_cx_3": "CX-30 / CX-3", "cx-30_cx-3": "CX-30 / CX-3",
        "cx_50_cx_5": "CX-50 / CX-5", "cx-50_cx-5": "CX-50 / CX-5",
        "cx_90_cx_9": "CX-90 / CX-9", "cx-90_cx-9": "CX-90 / CX-9",
        "mach_e": "Mustang Mach-E", "ioniq_5": "Ioniq 5",
    }
    return special.get(value, value.replace("_", " ").title())


def load_api_key() -> str:
    if value := os.getenv("OPENAI_API_KEY"):
        return value
    for path in (REPORTS_ROOT / "hma_weekly" / ".env", ROOT / ".env"):
        if not path.exists():
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            match = re.fullmatch(r"\s*OPENAI_API_KEY\s*=\s*(.+?)\s*", line)
            if match and (value := match.group(1).strip().strip('"').strip("'")):
                return value
    raise RuntimeError("OPENAI_API_KEY is not configured in the environment or approved local dotenv files.")


def response_text(payload: dict[str, Any]) -> str:
    return "\n".join(
        content.get("text", "")
        for item in payload.get("output", [])
        for content in item.get("content", [])
        if content.get("type") == "output_text"
    ).strip()


def parse_json_text(text: str) -> dict[str, Any]:
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip(), flags=re.IGNORECASE)
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start < 0 or end <= start:
        raise RuntimeError("The LLM response did not contain a JSON object.")
    return json.loads(cleaned[start : end + 1])


def context_models(data: dict[str, Any], target: str) -> tuple[str, list[str]]:
    rows = [
        row for row in data.get("competitor_monthly", [])
        if row.get("target_model") == target
        and row.get("segment_mode") == "special"
        and row.get("month") == data.get("current_month")
    ]
    governed = [row for row in rows if is_display_family(str(row.get("family_key", "")))]
    selected = governed or rows
    names = sorted({pretty_family(str(row.get("family", ""))) for row in selected if row.get("family")})
    if target not in names:
        names.insert(0, target)
    segment = str(rows[0].get("segment", "")) if rows else ""
    return segment, names


def signature(target: str, segment: str, models: list[str]) -> str:
    return hashlib.sha256(json.dumps([target, segment, models], separators=(",", ":")).encode()).hexdigest()[:16]


def research_context(key: str, target: str, segment: str, models: list[str], today: date) -> dict[str, Any]:
    window_start = today - timedelta(days=WINDOW_DAYS)
    prompt = f"""Selected Hyundai model: {target}
Segment: {segment}
Models in the current competitive display: {json.dumps(models)}
Research window: {window_start.isoformat()} through {today.isoformat()}

Find product-related or release-related news clippings from the previous few months that might explain, support, or foreshadow a change in consumer search interest or retail-sales ranking for the selected model and its displayed competitors.

Return exactly 4 or 5 of the most impactful competitive-context bullets. Prioritize launches, reveals, refreshes, new trims or powertrains, pricing announcements, production or availability changes, discontinuations, and significant product actions. Prefer automaker pressrooms and reputable automotive or business publications. Do not treat the clipping as proof of causation. Exclude generic reviews, shopping lists, rumors without credible sourcing, and numerical sales/search claims not supplied here.

Return only valid JSON with this shape:
{{"bullets":[{{"date":"YYYY-MM-DD","headline":"short factual headline","outlet":"publisher","url":"https://...","models":["model names from the supplied list"],"context":"one concise sentence explaining the possible search or retail-ranking implication"}}]}}
Each URL must be a direct source page used for that bullet. Sort newest first."""
    body = json.dumps({
        "model": os.getenv("COMP_CONTEXT_MODEL", "gpt-5.6-luna"),
        "instructions": "You are a careful US automotive competitive-intelligence editor. Use web search for every bullet, distinguish fact from inference, and return only the requested JSON.",
        "input": prompt,
        "tools": [{"type": "web_search"}],
        "text": {
            "format": {
                "type": "json_schema",
                "name": "competitive_context",
                "schema": {
                    "type": "object",
                    "properties": {
                        "bullets": {
                            "type": "array",
                            "minItems": 4,
                            "maxItems": 5,
                            "items": {
                                "type": "object",
                                "properties": {
                                    "date": {"type": "string"},
                                    "headline": {"type": "string"},
                                    "outlet": {"type": "string"},
                                    "url": {"type": "string"},
                                    "models": {"type": "array", "items": {"type": "string"}},
                                    "context": {"type": "string"},
                                },
                                "required": ["date", "headline", "outlet", "url", "models", "context"],
                                "additionalProperties": False,
                            },
                        }
                    },
                    "required": ["bullets"],
                    "additionalProperties": False,
                },
                "strict": True,
            }
        },
        "reasoning": {"effort": "low"},
        "max_output_tokens": 3000,
        "store": False,
    }).encode("utf-8")
    request = urllib.request.Request(
        API_URL,
        data=body,
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=600) as response:
            api_payload = json.loads(response.read())
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"OpenAI API request failed for {target}: HTTP {error.code}. {detail}") from error
    result = parse_json_text(response_text(api_payload))
    bullets = result.get("bullets")
    if not isinstance(bullets, list) or not 4 <= len(bullets) <= 5:
        raise RuntimeError(f"Expected 4–5 context bullets for {target}; received {len(bullets) if isinstance(bullets, list) else 0}.")
    cleaned = []
    for bullet in bullets:
        if not isinstance(bullet, dict) or not str(bullet.get("url", "")).startswith(("https://", "http://")):
            raise RuntimeError(f"A context bullet for {target} is missing a direct source URL.")
        try:
            published = date.fromisoformat(str(bullet.get("date", "")))
        except ValueError:
            continue
        if not window_start <= published <= today:
            continue
        cleaned.append({field: bullet.get(field) for field in ("date", "headline", "outlet", "url", "models", "context")})
    cleaned.sort(key=lambda bullet: str(bullet.get("date", "")), reverse=True)
    if not 4 <= len(cleaned) <= 5:
        raise RuntimeError(f"Expected 4–5 in-window context bullets for {target}; received {len(cleaned)}.")
    return {
        "target_model": target,
        "segment": segment,
        "models_considered": models,
        "signature": signature(target, segment, models),
        "window_start": window_start.isoformat(),
        "window_end": today.isoformat(),
        "refreshed_at": datetime.now(timezone.utc).isoformat(),
        "bullets": cleaned,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Refresh daily competitive product/release context for the demand-sales dashboard.")
    parser.add_argument("--force", action="store_true", help="Refresh even when today's compatible cache exists.")
    parser.add_argument("--model", action="append", help="Refresh only the named Hyundai model; may be repeated.")
    args = parser.parse_args()
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    targets = args.model or list(data.get("models", []))
    today = datetime.now().astimezone().date()
    cached = json.loads(OUTPUT_PATH.read_text(encoding="utf-8")) if OUTPUT_PATH.exists() else {"contexts": {}}
    contexts = dict(cached.get("contexts", {}))
    pending: list[tuple[str, str, list[str]]] = []
    for target in targets:
        segment, model_list = context_models(data, target)
        existing = contexts.get(target, {})
        current_signature = signature(target, segment, model_list)
        if args.force or existing.get("window_end") != today.isoformat() or existing.get("signature") != current_signature:
            pending.append((target, segment, model_list))
    if pending:
        key = load_api_key()
        failures: dict[str, str] = {}
        for target, segment, model_list in pending:
            print(f"Refreshing competitive context: {target}")
            try:
                contexts[target] = research_context(key, target, segment, model_list, today)
            except Exception as error:
                failures[target] = str(error)
                print(f"Competitive context refresh failed for {target}: {error}")
                continue
            partial = {
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "refresh_cadence": "daily",
                "window_days": WINDOW_DAYS,
                "contexts": contexts,
            }
            partial_rendered = json.dumps(partial, ensure_ascii=False, indent=2)
            OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
            PUBLIC_PATH.parent.mkdir(parents=True, exist_ok=True)
            OUTPUT_PATH.write_text(partial_rendered, encoding="utf-8")
            PUBLIC_PATH.write_text(partial_rendered, encoding="utf-8")
    output = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "refresh_cadence": "daily",
        "window_days": WINDOW_DAYS,
        "contexts": contexts,
    }
    rendered = json.dumps(output, ensure_ascii=False, indent=2)
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    PUBLIC_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(rendered, encoding="utf-8")
    PUBLIC_PATH.write_text(rendered, encoding="utf-8")
    print(json.dumps({
        "requested": [target for target, _, _ in pending],
        "failures": failures if pending else {},
        "output": str(OUTPUT_PATH),
    }, indent=2))


if __name__ == "__main__":
    main()
