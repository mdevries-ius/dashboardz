#!/usr/bin/env python3
"""Build the one-off National Brand media + local SRS monthly dataset."""

from __future__ import annotations

import csv
from pathlib import Path


PROJECT_ROOT = Path("/Users/maximodevries/Desktop/codex_source/dashboards/projects/gma_marcom")
DOWNLOADED_EXTRACT = Path("/Users/maximodevries/Downloads/gma_forecastinputs.csv")
MEDIA_SOURCE = PROJECT_ROOT / "source" / "media_brand_national_monthly.csv"
SRS_BRAND_SOURCE = PROJECT_ROOT / "source" / "srs_brand_national_monthly.csv"
OUTPUT = PROJECT_ROOT / "data" / "media_brand_srs_sales_monthly.csv"

MEDIA_COLUMNS = [
    "date_month",
    "geo_type",
    "region_code",
    "brand",
    "model",
    "t1t2_spend",
    "t1_spend",
    "t1_lifestyle_spend",
    "t1_in_market_spend",
    "t2_spend",
    "t1t2_impressions",
    "t1_impressions",
    "t2_impressions",
]


def write_csv(path: Path, columns: list[str], rows: list[dict[str, object]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns)
        writer.writeheader()
        writer.writerows(rows)


with DOWNLOADED_EXTRACT.open(newline="") as handle:
    downloaded_rows = list(csv.DictReader(handle))

media_rows = [{column: row[column] for column in MEDIA_COLUMNS} for row in downloaded_rows]
write_csv(MEDIA_SOURCE, MEDIA_COLUMNS, media_rows)

srs_rows = [
    {
        "date_month": row["date_month"],
        "geo_type": "National",
        "region_code": "NTL",
        "brand": "Genesis",
        "model": "Brand",
        "srs_sales_volume": row["srs_sales_volume"],
    }
    for row in downloaded_rows
]
write_csv(
    SRS_BRAND_SOURCE,
    ["date_month", "geo_type", "region_code", "brand", "model", "srs_sales_volume"],
    srs_rows,
)

srs_monthly = {row["date_month"]: float(row["srs_sales_volume"]) for row in srs_rows}

output_rows = []
for media_row in media_rows:
    date_month = media_row["date_month"]
    if date_month not in srs_monthly:
        continue
    output_rows.append({**media_row, "srs_sales_volume": srs_monthly[date_month]})

output_columns = [*MEDIA_COLUMNS, "srs_sales_volume"]
write_csv(OUTPUT, output_columns, output_rows)

print(
    {
        "media_rows": len(media_rows),
        "output_rows": len(output_rows),
        "min_month": output_rows[0]["date_month"] if output_rows else None,
        "max_month": output_rows[-1]["date_month"] if output_rows else None,
        "media_source": str(MEDIA_SOURCE),
        "srs_brand_source": str(SRS_BRAND_SOURCE),
        "output": str(OUTPUT),
    }
)
