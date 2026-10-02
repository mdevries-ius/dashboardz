from __future__ import annotations

import csv
import json
import sys
from collections import defaultdict
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
REPORTS_ROOT = Path(__file__).resolve().parents[4] / "reports"
sys.path.insert(0, str(REPORTS_ROOT / "hma_weekly" / "src"))

from hma_weekly_report.queries import DatabricksQueryRunner  # noqa: E402


INVENTORY_SQL = PROJECT_ROOT / "sql" / "california_dma_inventory_monthly.sql"
GEOGRAPHY_SQL = PROJECT_ROOT / "sql" / "california_dma_geography.sql"
SOURCE_DIR = PROJECT_ROOT / "source"
PUBLIC_DIR = PROJECT_ROOT / "dashboard" / "public"


def polygon_centroid(points: list[dict[str, float]]) -> tuple[float, float, float]:
    if len(points) < 3:
        latitude = sum(point["latitude"] for point in points) / max(len(points), 1)
        longitude = sum(point["longitude"] for point in points) / max(len(points), 1)
        return latitude, longitude, 0.0

    twice_area = 0.0
    centroid_x = 0.0
    centroid_y = 0.0
    for index, point in enumerate(points):
        next_point = points[(index + 1) % len(points)]
        cross = point["longitude"] * next_point["latitude"] - next_point["longitude"] * point["latitude"]
        twice_area += cross
        centroid_x += (point["longitude"] + next_point["longitude"]) * cross
        centroid_y += (point["latitude"] + next_point["latitude"]) * cross

    if abs(twice_area) < 1e-9:
        latitude = sum(point["latitude"] for point in points) / len(points)
        longitude = sum(point["longitude"] for point in points) / len(points)
        return latitude, longitude, 0.0

    return centroid_y / (3 * twice_area), centroid_x / (3 * twice_area), abs(twice_area / 2)


def write_csv(path: Path, rows: list[dict]) -> None:
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    runner = DatabricksQueryRunner()
    try:
        inventory_rows = runner.fetch_all(INVENTORY_SQL.read_text(encoding="utf-8"))
        geography_rows = runner.fetch_all(GEOGRAPHY_SQL.read_text(encoding="utf-8"))
    finally:
        runner.close()

    grouped: dict[tuple[int, str], dict[int, list[dict[str, float]]]] = defaultdict(lambda: defaultdict(list))
    for row in geography_rows:
        grouped[(int(row["dma_id"]), row["dma_name"])][int(row["sub_polygon_id"])].append({
            "latitude": float(row["latitude"]),
            "longitude": float(row["longitude"]),
        })

    geography = []
    for (dma_id, dma_name), polygon_map in grouped.items():
        polygons = list(polygon_map.values())
        centers = [polygon_centroid(points) for points in polygons]
        total_area = sum(center[2] for center in centers)
        if total_area:
            latitude = sum(center[0] * center[2] for center in centers) / total_area
            longitude = sum(center[1] * center[2] for center in centers) / total_area
        else:
            latitude = sum(center[0] for center in centers) / len(centers)
            longitude = sum(center[1] for center in centers) / len(centers)
        geography.append({
            "dma_id": str(dma_id),
            "dma_name": dma_name,
            "centroid_latitude": latitude,
            "centroid_longitude": longitude,
            "polygons": polygons,
        })

    inventory = [{
        "month": str(row["month"]),
        "ius_dma_cd": str(row["ius_dma_cd"]),
        "ius_dma_name_state": row["ius_dma_name_state"],
        "average_inventory": float(row["average_inventory"]),
    } for row in inventory_rows]

    SOURCE_DIR.mkdir(parents=True, exist_ok=True)
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    write_csv(SOURCE_DIR / "california_genesis_inventory_monthly.csv", inventory)
    write_csv(SOURCE_DIR / "california_dma_geography.csv", geography_rows)
    (PUBLIC_DIR / "california_genesis_inventory_monthly.json").write_text(json.dumps(inventory, separators=(",", ":")), encoding="utf-8")
    (PUBLIC_DIR / "california_dma_geography.json").write_text(json.dumps(geography, separators=(",", ":")), encoding="utf-8")

    print(json.dumps({
        "inventory_rows": len(inventory),
        "dma_count": len(geography),
        "date_range": [min(row["month"] for row in inventory), max(row["month"] for row in inventory)],
        "source_files": [
            str(SOURCE_DIR / "california_genesis_inventory_monthly.csv"),
            str(SOURCE_DIR / "california_dma_geography.csv"),
        ],
    }, indent=2))


if __name__ == "__main__":
    main()
