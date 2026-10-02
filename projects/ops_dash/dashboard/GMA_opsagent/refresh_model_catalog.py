"""Write a local list of account-available reasoning-model candidates."""

from __future__ import annotations

import json
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from run_agents_api import API_URL, CONFIG_PATH, WORKFLOW_ROOT, api_key


MODEL_GUIDANCE = {
    "gpt-6-astra": ("Frontier supervisor or complex diagnosis", "medium, high"),
    "gpt-5.6-sol": ("Higher-quality supervisor", "medium, high"),
    "gpt-5.6-terra": ("Default analyst and iterative supervisor", "low, medium"),
    "gpt-5.6-luna": ("Low-cost experiment or narrow extraction", "low, medium"),
}


def main() -> None:
    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    key = api_key(config)
    request = urllib.request.Request(
        API_URL.rsplit("/", 1)[0] + "/models",
        headers={"Authorization": f"Bearer {key}"},
        method="GET",
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        model_ids = {item["id"] for item in json.loads(response.read())["data"]}

    rows = []
    for model_id, (recommended_role, starting_efforts) in MODEL_GUIDANCE.items():
        if model_id in model_ids:
            rows.append(f"| `{model_id}` | {recommended_role} | {starting_efforts} |")

    path = WORKFLOW_ROOT / "available_reasoning_models.md"
    path.write_text("\n".join((
        "# Available Reasoning Models",
        "",
        f"Last checked: {datetime.now(timezone.utc).isoformat(timespec='seconds')}",
        "",
        "This reflects the model IDs returned by this API project’s `/v1/models` catalog. Suggested efforts are starting points, not guaranteed capability declarations; the API remains authoritative for any model-specific validation.",
        "",
        "| Model | Suggested use | Starting reasoning effort |",
        "| --- | --- | --- |",
        *(rows or ["| No recognized reasoning-model candidates were returned | — | — |"]),
        "",
        "## Current workflow profiles",
        "",
        "See `analysis_profiles.json` for the approved analyst and supervisor combinations, output caps, and hard input limits.",
        "",
    )), encoding="utf-8")
    print(f"Saved {path}")


if __name__ == "__main__":
    main()
