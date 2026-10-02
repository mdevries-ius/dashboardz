from __future__ import annotations

import csv
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
REPORTS_ROOT = Path(__file__).resolve().parents[4] / "reports"
sys.path.insert(0, str(REPORTS_ROOT / "hma_weekly" / "src"))

from hma_weekly_report.queries import DatabricksQueryRunner  # noqa: E402


SQL = """
WITH cloud AS (
  SELECT
    ius_model_series AS model_family,
    TRIM(ius_srs_segment) AS srs_segment,
    SUM(COALESCE(avginventory, 0)) AS average_inventory
  FROM ius_unity_prod.sandbox.agent_cloudtheory
  WHERE LOWER(TRIM(ius_make)) = 'hyundai'
    AND date_month >= DATE '2025-01-01'
    AND sales_region_cd IN ('CE', 'EA', 'MA', 'MS', 'SC', 'SO', 'WE')
  GROUP BY ALL
),
srs AS (
  SELECT
    ius_model_series AS model_family,
    TRIM(ius_srs_segment) AS srs_segment,
    SUM(COALESCE(srs_sales_volume, 0)) AS retail_sales
  FROM ius_unity_prod.sandbox.agent_srs
  WHERE LOWER(TRIM(ius_make)) = 'hyundai'
    AND date_month >= DATE '2025-01-01'
    AND sales_region_cd IN ('CE', 'EA', 'MA', 'MS', 'SC', 'SO', 'WE')
  GROUP BY ALL
)
SELECT
  COALESCE(cloud.model_family, srs.model_family) AS model_family,
  COALESCE(cloud.srs_segment, srs.srs_segment) AS srs_segment,
  COALESCE(cloud.average_inventory, 0) AS average_inventory,
  COALESCE(srs.retail_sales, 0) AS retail_sales
FROM cloud
FULL OUTER JOIN srs
  ON cloud.model_family <=> srs.model_family
 AND cloud.srs_segment <=> srs.srs_segment
ORDER BY average_inventory DESC, retail_sales DESC, model_family
"""


def main() -> None:
    runner = DatabricksQueryRunner()
    try:
        rows = runner.fetch_all(SQL)
    finally:
        runner.close()

    output = PROJECT_ROOT / "source" / "hyundai_model_family_segment_audit.csv"
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    print(output)


if __name__ == "__main__":
    main()
