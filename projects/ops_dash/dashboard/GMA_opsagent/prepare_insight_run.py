"""Prepare one frozen dashboard-data package for the dual-agent insights workflow."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path


WORKFLOW_ROOT = Path(__file__).resolve().parent
PROJECT_ROOT = WORKFLOW_ROOT.parent
SOURCE_ROOT = PROJECT_ROOT / "source"
TEMPLATES_ROOT = WORKFLOW_ROOT / "templates"
RUNS_ROOT = WORKFLOW_ROOT / "runs"

DATASETS = {
    "operational_metrics.csv": "operational_context_monthly.csv",
    "competitor_efficiency.csv": "competitor_efficiency_monthly.csv",
    "cox_incentives.csv": "cox_incentives_monthly.csv",
    "cox_segment_incentives.csv": "cox_segment_incentives_monthly.csv",
    "cloudtheory_segment_metrics.csv": "cloudtheory_segment_model_metrics_monthly.csv",
    "price_band_trim_allocation.csv": "price_band_trim_allocation_monthly.csv",
}


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def write_csv(path: Path, rows: list[dict[str, str]]) -> None:
    if not rows:
        path.write_text("", encoding="utf-8")
        return
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()[:12]


def aligned_months(datasets: dict[str, list[dict[str, str]]]) -> set[str]:
    required = ("operational_metrics.csv", "competitor_efficiency.csv", "cox_incentives.csv")
    common: set[str] | None = None
    for name in required:
        available = {row["date_month"] for row in datasets[name]}
        common = available if common is None else common & available
    if not common:
        raise ValueError("No reporting month is shared by operational, competitor, and Cox incentive data.")
    return common


def default_month(datasets: dict[str, list[dict[str, str]]]) -> str:
    return max(aligned_months(datasets))


def render(template_name: str, run_id: str, reporting_month: str) -> str:
    text = (TEMPLATES_ROOT / template_name).read_text(encoding="utf-8")
    return text.replace("{{RUN_ID}}", run_id).replace("{{REPORTING_MONTH}}", reporting_month)


def placeholder(title: str, body: str) -> str:
    return f"# {title}\n\n> Status: prepared. Replace this placeholder with the assigned agent's response.\n\n{body}\n"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--month", help="Reporting month in YYYY-MM-DD; defaults to latest fully aligned month.")
    parser.add_argument("--run-id", help="Folder name under GMA_opsagent/runs; defaults to YYYY-MM.")
    args = parser.parse_args()

    raw_paths = {output: SOURCE_ROOT / source for output, source in DATASETS.items()}
    datasets = {output: read_csv(path) for output, path in raw_paths.items()}
    reporting_month = args.month or default_month(datasets)
    if reporting_month not in aligned_months(datasets):
        raise ValueError(
            f"{reporting_month} is not fully aligned across operational, competitor, and Cox incentive data. "
            f"Choose one of: {', '.join(sorted(aligned_months(datasets)))}"
        )

    run_id = args.run_id or reporting_month[:7]
    run_root = RUNS_ROOT / run_id
    if run_root.exists():
        raise FileExistsError(f"Run folder already exists: {run_root}. Choose --run-id for a rerun.")
    data_root = run_root / "data"
    data_root.mkdir(parents=True)

    included: dict[str, int] = {}
    for output_name, rows in datasets.items():
        scoped_rows = [row for row in rows if row["date_month"] == reporting_month]
        write_csv(data_root / output_name, scoped_rows)
        included[output_name] = len(scoped_rows)

    dealer_path = SOURCE_ROOT / "national_genesis_dealer_inventory_monthly.csv"
    dealer_rows = [row for row in read_csv(dealer_path) if row["month"] == reporting_month]
    write_csv(data_root / "dealer_inventory.csv", dealer_rows)
    included["dealer_inventory.csv"] = len(dealer_rows)

    (data_root / "data_dictionary.md").write_text(render("00_data_contract.md", run_id, reporting_month), encoding="utf-8")
    for source_name, output_name in {
        "01_analyst_1_prompt.md": "01_analyst_1_prompt.md",
        "01_analyst_2_prompt.md": "01_analyst_2_prompt.md",
        "01_supervisor_prompt.md": "01_supervisor_prompt.md",
    }.items():
        (run_root / output_name).write_text(render(source_name, run_id, reporting_month), encoding="utf-8")

    (run_root / "02_analyst_1_performance.md").write_text(
        placeholder("Analyst 1 — Performance Diagnosis", "Use `01_analyst_1_prompt.md` and the frozen `data/` package."),
        encoding="utf-8",
    )
    (run_root / "03_analyst_2_market.md").write_text(
        placeholder("Analyst 2 — Strategic / External Context Analysis", "Use `01_analyst_2_prompt.md` and the frozen `data/` package."),
        encoding="utf-8",
    )
    (run_root / "04_supervisor_final.md").write_text(
        placeholder("Genesis Monthly Executive Insights", "Use `01_supervisor_prompt.md`, both analyst responses, and `05_sources.md`."),
        encoding="utf-8",
    )
    (run_root / "05_sources.md").write_text(
        "# External Evidence Ledger\n\n> Status: prepared. Analyst 2 records only permitted external research here.\n\n"
        "| Title | Publisher | Publication date | URL | Claim supported | Context only? |\n"
        "| --- | --- | --- | --- | --- | --- |\n",
        encoding="utf-8",
    )

    manifest = {
        "run_id": run_id,
        "status": "prepared",
        "reporting_month": reporting_month,
        "created_at_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "competitive_universe": "Genesis competitive segments; aligned SOI and SOM denominators",
        "source_files": {path.name: {"sha256_12": digest(path)} for path in raw_paths.values()},
        "included_rows": included,
        "prompt_versions": {name: digest(TEMPLATES_ROOT / name) for name in (
            "00_data_contract.md",
            "01_analyst_1_prompt.md",
            "01_analyst_2_prompt.md",
            "01_supervisor_prompt.md",
        )},
    }
    (run_root / "00_run_manifest.md").write_text(
        "# Insight Run Manifest\n\n```json\n" + json.dumps(manifest, indent=2) + "\n```\n",
        encoding="utf-8",
    )
    print(json.dumps({"run_folder": str(run_root), "reporting_month": reporting_month, "included_rows": included}, indent=2))


if __name__ == "__main__":
    main()
