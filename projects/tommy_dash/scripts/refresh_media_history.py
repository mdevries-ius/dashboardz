from __future__ import annotations

import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SHARED = ROOT.parent / "shared" / "scripts"
sys.path.insert(0, str(SHARED))

from refresh_governed_data import execute_sql  # noqa: E402


SQL = """
SELECT
  TO_DATE(date_month, 'yyyy-MM-dd') AS date_month,
  SUM(spend) AS total_spend
FROM ius_unity_prod.media_datamart.hma_t1_t2_bank_impressions_line_item
WHERE LOWER(ius_make) = 'hyundai'
  AND strategy NOT IN ('Other', 'Unallocated')
  AND TO_DATE(date_month, 'yyyy-MM-dd') BETWEEN DATE'2025-01-01' AND DATE'2026-09-01'
GROUP BY TO_DATE(date_month, 'yyyy-MM-dd')
ORDER BY date_month
""".strip()


payload = execute_sql("search", SQL)
output = {
    "queried_at": payload["statement_id"],
    "source": "ius_unity_prod.media_datamart.hma_t1_t2_bank_impressions_line_item",
    "rows": [
        {"month": str(row["date_month"])[:7], "value": float(row["total_spend"])}
        for row in payload["rows"]
    ],
}
(ROOT / "public" / "data" / "media_history.json").write_text(
    json.dumps(output, indent=2) + "\n", encoding="utf-8"
)
print(json.dumps({"rows": len(output["rows"]), "through": output["rows"][-1]["month"]}, indent=2))
