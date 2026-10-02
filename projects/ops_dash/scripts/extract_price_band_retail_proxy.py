from __future__ import annotations

import csv
import json
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
REPORTS_ROOT = Path(__file__).resolve().parents[4] / "reports"
sys.path.insert(0, str(REPORTS_ROOT / "hma_weekly" / "src"))

from hma_weekly_report.queries import DatabricksQueryRunner  # noqa: E402


SQL_PATH = PROJECT_ROOT / "sql" / "price_band_retail_proxy_monthly.sql"
CSV_PATH = PROJECT_ROOT / "source" / "price_band_retail_proxy_monthly.csv"
JSON_PATH = PROJECT_ROOT / "dashboard" / "public" / "price_band_retail_proxy_monthly.json"


def main() -> None:
    runner = DatabricksQueryRunner()
    try:
        rows = runner.fetch_all(SQL_PATH.read_text(encoding="utf-8"))
    finally:
        runner.close()

    if not rows:
        raise RuntimeError("The price-band retail proxy query returned no rows.")

    CSV_PATH.parent.mkdir(parents=True, exist_ok=True)
    with CSV_PATH.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)

    JSON_PATH.parent.mkdir(parents=True, exist_ok=True)
    JSON_PATH.write_text(json.dumps(rows, default=str, separators=(",", ":")), encoding="utf-8")
    print(json.dumps({"row_count": len(rows), "csv": str(CSV_PATH), "json": str(JSON_PATH)}, indent=2))


if __name__ == "__main__":
    main()
