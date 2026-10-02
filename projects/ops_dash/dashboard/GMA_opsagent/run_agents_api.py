"""Run two Genesis insight analysts, then have a supervisor judge their work."""

from __future__ import annotations

import argparse
import csv
import io
import json
import os
import re
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any


WORKFLOW_ROOT = Path(__file__).resolve().parent
RUNS_ROOT = WORKFLOW_ROOT / "runs"
CONFIG_PATH = WORKFLOW_ROOT / "analysis_profiles.json"
API_URL = "https://api.openai.com/v1/responses"
ROLE_FILES = {
    "analyst_1": ("01_analyst_1_prompt.md", "02_analyst_1_performance_api.md"),
    "analyst_2": ("01_analyst_2_prompt.md", "03_analyst_2_market_api.md"),
    "supervisor": ("01_supervisor_prompt.md", "04_supervisor_final_api.md"),
}


def load_dotenv(path: Path) -> str | None:
    if not path.exists():
        return None
    for line in path.read_text(encoding="utf-8").splitlines():
        match = re.fullmatch(r"\s*OPENAI_API_KEY\s*=\s*(.+?)\s*", line)
        if match:
            return match.group(1).strip().strip('"').strip("'")
    return None


def api_key(config: dict[str, Any]) -> str:
    if value := os.environ.get("OPENAI_API_KEY"):
        return value
    for relative_path in config["api_key_sources"]:
        if value := load_dotenv(WORKFLOW_ROOT / relative_path):
            return value
    raise RuntimeError("No OPENAI_API_KEY was found in the configured local dotenv files.")


def frozen_data(run_root: Path) -> str:
    data_root = run_root / "data"
    parts = ["# Frozen Data Package", (data_root / "data_dictionary.md").read_text(encoding="utf-8")]

    def csv_text(path: Path, include: Any = None) -> str:
        rows = list(csv.DictReader(path.read_text(encoding="utf-8").splitlines()))
        if include:
            rows = [row for row in rows if include(row)]
        stream = io.StringIO()
        writer = csv.DictWriter(stream, fieldnames=rows[0].keys() if rows else [])
        if rows:
            writer.writeheader()
            writer.writerows(rows)
        return stream.getvalue().strip()

    selections = (
        ("operational_metrics.csv", "Operational brand, model, and regional metrics", None),
        ("competitor_efficiency.csv", "Brand efficiency comparison", None),
        ("cox_incentives.csv", "Brand and model incentive metrics", None),
        ("cox_segment_incentives.csv", "Segment incentive comparison", None),
        ("cloudtheory_segment_metrics.csv", "National competitive availability and MSRP context", lambda row: row["geo_level"] == "National"),
        ("price_band_trim_allocation.csv", "Genesis trim / advertised-price context", lambda row: row["make"].lower() == "genesis"),
    )
    for filename, title, include in selections:
        parts.extend((f"\n## {title} ({filename})", "```csv", csv_text(data_root / filename, include), "```"))
    return "\n".join(parts)


def output_text(payload: dict[str, Any]) -> str:
    return "\n".join(
        content.get("text", "")
        for item in payload.get("output", [])
        for content in item.get("content", [])
        if content.get("type") == "output_text"
    ).strip()


def ask(key: str, settings: dict[str, Any], instructions: str, input_text: str) -> str:
    body = json.dumps({
        "model": settings["model"],
        "instructions": instructions,
        "input": input_text,
        "reasoning": {"effort": settings["reasoning_effort"]},
        "max_output_tokens": settings["max_output_tokens"],
    }).encode("utf-8")
    request = urllib.request.Request(
        API_URL,
        data=body,
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=600) as response:
            payload = json.loads(response.read())
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"OpenAI API request failed: HTTP {error.code}. {detail}") from error
    text = output_text(payload)
    if not text:
        raise RuntimeError("OpenAI API returned no text.")
    return text


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--profile", help="Profile name in analysis_profiles.json; defaults to default_profile.")
    parser.add_argument("--role", choices=("all", "analyst_1", "analyst_2", "supervisor"), default="all")
    args = parser.parse_args()

    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    profile_name = args.profile or config["default_profile"]
    profile = config["profiles"].get(profile_name)
    if not profile:
        raise RuntimeError(f"Unknown profile: {profile_name}")
    if profile["web_research"]:
        raise RuntimeError("Web research is not implemented in this runner; keep web_research false until a bounded tool policy is added.")
    configured_output_limit = sum(profile[role]["max_output_tokens"] for role in ROLE_FILES)
    if configured_output_limit > profile["limits"]["max_combined_output_tokens"]:
        raise RuntimeError("Profile output-token settings exceed its configured combined limit.")
    run_root = RUNS_ROOT / args.run_id
    if not run_root.is_dir():
        raise RuntimeError(f"Run folder not found: {run_root}")
    key, data = api_key(config), frozen_data(run_root)
    if len(data) > profile["limits"]["max_input_characters_per_role"]:
        raise RuntimeError("Frozen data package exceeds this profile's hard input limit; reduce the package or use an intentionally larger profile.")

    for role in ("analyst_1", "analyst_2"):
        if args.role not in ("all", role):
            continue
        prompt_file, output_file = ROLE_FILES[role]
        result = ask(key, profile[role], (run_root / prompt_file).read_text(encoding="utf-8"), data)
        (run_root / output_file).write_text(result + "\n", encoding="utf-8")
        print(f"Saved {output_file}")

    if args.role in ("all", "supervisor"):
        analyst_1 = (run_root / ROLE_FILES["analyst_1"][1]).read_text(encoding="utf-8")
        analyst_2 = (run_root / ROLE_FILES["analyst_2"][1]).read_text(encoding="utf-8")
        supervisor_input = "\n\n".join((
            data,
            "# Analyst 1 Response\n" + analyst_1,
            "# Analyst 2 Response\n" + analyst_2,
        ))
        if len(supervisor_input) > profile["limits"]["max_input_characters_per_role"]:
            raise RuntimeError("Supervisor input exceeds this profile's hard input limit; reduce the analyst outputs or use an intentionally larger profile.")
        result = ask(key, profile["supervisor"], (run_root / ROLE_FILES["supervisor"][0]).read_text(encoding="utf-8"), supervisor_input)
        output_file = ROLE_FILES["supervisor"][1]
        (run_root / output_file).write_text(result + "\n", encoding="utf-8")
        print(f"Saved {output_file}")


if __name__ == "__main__":
    main()
