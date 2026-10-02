from __future__ import annotations

import csv
import json
import sys
from datetime import date
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
REPORTS_ROOT = Path(__file__).resolve().parents[4] / "reports"
sys.path.insert(0, str(REPORTS_ROOT / "hma_weekly" / "src"))

from hma_weekly_report.queries import DatabricksQueryRunner  # noqa: E402
from extract_operational_context import difference, month_shift, ratio_change  # noqa: E402


ASSETS = (
    "competitor_efficiency_monthly",
    "cox_incentives_monthly",
    "cox_segment_incentives_monthly",
    "cloudtheory_segment_model_metrics_monthly",
    "price_band_trim_allocation_monthly",
    "price_band_retail_proxy_monthly",
    "national_dealer_inventory_monthly",
)


def hyundai_sql(name: str) -> str:
    sql = (PROJECT_ROOT / "sql" / f"{name}.sql").read_text(encoding="utf-8")
    sql = sql.replace("genesis", "hyundai").replace("Genesis", "Hyundai")
    if name == "operational_context_monthly":
        # Hyundai's benchmark universe is its explicit SRS segment set.  The
        # source query's luxury flag is Genesis-specific and must not filter HMA.
        sql = sql.replace("make = 'hyundai' AND luxury_flag = 'Y'", "make = 'hyundai'")
        sql = sql.replace("make = 'hyundai'\n    AND luxury_flag = 'Y'", "make = 'hyundai'")
        sql = sql.replace("CASE WHEN luxury_flag = 'Y' THEN", "CASE WHEN TRUE THEN")
    if name == "competitor_efficiency_monthly":
        sql = sql.replace("AND ius_srs_luxury_flag = 'Y'", "")
        sql = sql.replace(
            "WHEN 'hyundai' THEN 'Hyundai'\n    WHEN 'bmw' THEN 'BMW'\n    WHEN 'mercedes_benz' THEN 'Mercedes-Benz'\n    WHEN 'lexus' THEN 'Lexus'\n    WHEN 'audi' THEN 'Audi'",
            "WHEN 'hyundai' THEN 'Hyundai'\n    WHEN 'honda' THEN 'Honda'\n    WHEN 'toyota' THEN 'Toyota'\n    WHEN 'kia' THEN 'Kia'\n    WHEN 'nissan' THEN 'Nissan'",
        )
        sql = sql.replace("('hyundai', 'bmw', 'mercedes_benz', 'lexus', 'audi')", "('hyundai', 'honda', 'toyota', 'kia', 'nissan')")
    return sql


def add_period_changes(rows: list[dict]) -> None:
    index = {
        (row["date_month"], row["geo_level"], row["region_code"], row["entity_level"], row["model_series"], row["segment"]): row
        for row in rows
    }
    for row in rows:
        tail = (row["geo_level"], row["region_code"], row["entity_level"], row["model_series"], row["segment"])
        prior_month = index.get((month_shift(row["date_month"], -1), *tail))
        prior_year = index.get((month_shift(row["date_month"], -12), *tail))
        for measure in ("average_inventory", "weighted_avg_msrp", "weighted_avg_price", "retail_sales"):
            row[f"{measure}_mom_pct"] = ratio_change(row[measure], prior_month and prior_month[measure])
            row[f"{measure}_yoy_pct"] = ratio_change(row[measure], prior_year and prior_year[measure])
        for measure in ("inventory_share", "msrp_inventory_weighted_index", "price_inventory_weighted_index", "retail_share", "inventory_retail_ratio"):
            suffix = "pp" if measure in {"inventory_share", "retail_share"} else "delta"
            row[f"{measure}_mom_{suffix}"] = difference(row[measure], prior_month and prior_month[measure])
            row[f"{measure}_yoy_{suffix}"] = difference(row[measure], prior_year and prior_year[measure])


def write(name: str, rows: list[dict]) -> None:
    source = PROJECT_ROOT / "source" / f"hyundai_{name}.csv"
    public = PROJECT_ROOT / "dashboard" / "public" / f"hyundai_{name}.json"
    source.parent.mkdir(parents=True, exist_ok=True)
    public.parent.mkdir(parents=True, exist_ok=True)
    with source.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    public.write_text(json.dumps(rows, default=str, separators=(",", ":")), encoding="utf-8")


def main() -> None:
    runner = DatabricksQueryRunner()
    try:
        operational = runner.fetch_all(hyundai_sql("operational_context_monthly"))
        for row in operational:
            if isinstance(row["date_month"], str):
                row["date_month"] = date.fromisoformat(row["date_month"])
        add_period_changes(operational)
        write("operational_context_monthly", operational)
        for name in ASSETS:
            write(name, runner.fetch_all(hyundai_sql(name)))
    finally:
        runner.close()
    print("Hyundai dashboard data extracted")


if __name__ == "__main__":
    main()
