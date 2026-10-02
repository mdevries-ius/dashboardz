from __future__ import annotations

import csv
import json
import sys
from datetime import date
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
REPORTS_ROOT = Path(__file__).resolve().parents[4] / "reports"
HMA_WEEKLY_SRC = REPORTS_ROOT / "hma_weekly" / "src"
sys.path.insert(0, str(HMA_WEEKLY_SRC))

from hma_weekly_report.queries import DatabricksQueryRunner  # noqa: E402


SQL_PATH = PROJECT_ROOT / "sql" / "operational_context_monthly.sql"
CSV_PATH = PROJECT_ROOT / "source" / "operational_context_monthly.csv"
JSON_PATH = PROJECT_ROOT / "dashboard" / "public" / "operational_context_monthly.json"
MANIFEST_PATH = PROJECT_ROOT / "source" / "operational_context_monthly.manifest.json"


def month_shift(value: date, months: int) -> date:
    index = value.year * 12 + value.month - 1 + months
    return date(index // 12, index % 12 + 1, 1)


def ratio_change(current: float | None, previous: float | None) -> float | None:
    if current is None or previous in (None, 0):
        return None
    return current / previous - 1


def difference(current: float | None, previous: float | None) -> float | None:
    if current is None or previous is None:
        return None
    return current - previous


def main() -> None:
    runner = DatabricksQueryRunner()
    try:
        rows = runner.fetch_all(SQL_PATH.read_text(encoding="utf-8"))
    finally:
        runner.close()

    for row in rows:
        if isinstance(row["date_month"], str):
            row["date_month"] = date.fromisoformat(row["date_month"])

    index = {
        (
            row["date_month"],
            row["geo_level"],
            row["region_code"],
            row["entity_level"],
            row["model_series"],
            row["segment"],
        ): row
        for row in rows
    }

    for row in rows:
        key_tail = (
            row["geo_level"],
            row["region_code"],
            row["entity_level"],
            row["model_series"],
            row["segment"],
        )
        prior_month = index.get((month_shift(row["date_month"], -1), *key_tail))
        prior_year = index.get((month_shift(row["date_month"], -12), *key_tail))

        row["average_inventory_mom_pct"] = ratio_change(
            row["average_inventory"], prior_month and prior_month["average_inventory"]
        )
        row["average_inventory_yoy_pct"] = ratio_change(
            row["average_inventory"], prior_year and prior_year["average_inventory"]
        )
        row["inventory_share_mom_pp"] = difference(
            row["inventory_share"], prior_month and prior_month["inventory_share"]
        )
        row["inventory_share_yoy_pp"] = difference(
            row["inventory_share"], prior_year and prior_year["inventory_share"]
        )
        row["weighted_avg_msrp_mom_pct"] = ratio_change(
            row["weighted_avg_msrp"], prior_month and prior_month["weighted_avg_msrp"]
        )
        row["weighted_avg_msrp_yoy_pct"] = ratio_change(
            row["weighted_avg_msrp"], prior_year and prior_year["weighted_avg_msrp"]
        )
        row["msrp_inventory_weighted_index_mom_delta"] = difference(
            row["msrp_inventory_weighted_index"],
            prior_month and prior_month["msrp_inventory_weighted_index"],
        )
        row["msrp_inventory_weighted_index_yoy_delta"] = difference(
            row["msrp_inventory_weighted_index"],
            prior_year and prior_year["msrp_inventory_weighted_index"],
        )
        row["weighted_avg_price_mom_pct"] = ratio_change(
            row["weighted_avg_price"], prior_month and prior_month["weighted_avg_price"]
        )
        row["weighted_avg_price_yoy_pct"] = ratio_change(
            row["weighted_avg_price"], prior_year and prior_year["weighted_avg_price"]
        )
        row["price_inventory_weighted_index_mom_delta"] = difference(
            row["price_inventory_weighted_index"],
            prior_month and prior_month["price_inventory_weighted_index"],
        )
        row["price_inventory_weighted_index_yoy_delta"] = difference(
            row["price_inventory_weighted_index"],
            prior_year and prior_year["price_inventory_weighted_index"],
        )
        row["retail_sales_mom_pct"] = ratio_change(
            row["retail_sales"], prior_month and prior_month["retail_sales"]
        )
        row["retail_sales_yoy_pct"] = ratio_change(
            row["retail_sales"], prior_year and prior_year["retail_sales"]
        )
        row["retail_share_mom_pp"] = difference(
            row["retail_share"], prior_month and prior_month["retail_share"]
        )
        row["retail_share_yoy_pp"] = difference(
            row["retail_share"], prior_year and prior_year["retail_share"]
        )
        row["inventory_retail_ratio_mom_delta"] = difference(
            row["inventory_retail_ratio"],
            prior_month and prior_month["inventory_retail_ratio"],
        )
        row["inventory_retail_ratio_yoy_delta"] = difference(
            row["inventory_retail_ratio"],
            prior_year and prior_year["inventory_retail_ratio"],
        )

    columns = list(rows[0].keys())
    CSV_PATH.parent.mkdir(parents=True, exist_ok=True)
    with CSV_PATH.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)

    JSON_PATH.parent.mkdir(parents=True, exist_ok=True)
    JSON_PATH.write_text(
        json.dumps(rows, default=str, separators=(",", ":")),
        encoding="utf-8",
    )

    months = sorted({row["date_month"] for row in rows})
    manifest = {
        "created_at": date.today().isoformat(),
        "source_tables": [
            "ius_unity_prod.sandbox.agent_cloudtheory",
            "ius_unity_prod.sandbox.agent_srs",
        ],
        "date_range": {"min": str(months[0]), "max": str(months[-1])},
        "row_count": len(rows),
        "columns": columns,
        "definitions": {
            "average_inventory": "SUM(avginventory) across all CloudTheory location statuses",
            "brand_share_denominator": "All rows in the Genesis competitive-segment universe for the month and geography; the same segment universe is applied to SOI and SOM",
            "model_share_denominator": "All rows in the model series' ius_srs_segment",
            "weighted_avg_msrp": "CloudTheory avg_msrp weighted by avginventory with positive MSRP",
            "msrp_inventory_weighted_index": "Genesis weighted-average MSRP divided by the relevant luxury-market or segment benchmark, multiplied by 100",
            "national_scope": "Sum of CE, EA, MA, MS, SC, SO, and WE; NH and Unassigned excluded",
        },
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(json.dumps({"csv": str(CSV_PATH), "json": str(JSON_PATH), **manifest}, indent=2))


if __name__ == "__main__":
    main()
