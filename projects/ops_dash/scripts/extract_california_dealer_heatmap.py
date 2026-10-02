from __future__ import annotations

import csv
import json
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
REPORTS_ROOT = Path(__file__).resolve().parents[4] / "reports"
sys.path.insert(0, str(REPORTS_ROOT / "hma_weekly" / "src"))

from hma_weekly_report.queries import DatabricksQueryRunner  # noqa: E402


SQL_PATH = PROJECT_ROOT / "sql" / "california_dealer_inventory_monthly.sql"
CSV_PATH = PROJECT_ROOT / "source" / "california_genesis_dealer_inventory_monthly.csv"
JSON_PATH = PROJECT_ROOT / "dashboard" / "public" / "california_genesis_dealer_inventory_monthly.json"


def main() -> None:
    runner = DatabricksQueryRunner()
    try:
        rows = runner.fetch_all(SQL_PATH.read_text(encoding="utf-8"))
    finally:
        runner.close()

    clean_rows = [{
        **row,
        "month": str(row["month"]),
        "latitude": float(row["latitude"]),
        "longitude": float(row["longitude"]),
        "average_inventory": float(row["average_inventory"]),
    } for row in rows]

    CSV_PATH.parent.mkdir(parents=True, exist_ok=True)
    with CSV_PATH.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(clean_rows[0]))
        writer.writeheader()
        writer.writerows(clean_rows)

    JSON_PATH.parent.mkdir(parents=True, exist_ok=True)
    JSON_PATH.write_text(json.dumps(clean_rows, separators=(",", ":")), encoding="utf-8")
    print(json.dumps({
        "row_count": len(clean_rows),
        "seller_count": len({row["seller_id"] for row in clean_rows}),
        "date_range": [min(row["month"] for row in clean_rows), max(row["month"] for row in clean_rows)],
        "csv": str(CSV_PATH),
        "json": str(JSON_PATH),
    }, indent=2))


if __name__ == "__main__":
    main()
