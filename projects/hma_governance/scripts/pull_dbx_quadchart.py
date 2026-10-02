from __future__ import annotations

import csv
import json
import os
import subprocess
import re
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
CONFIG = json.loads((ROOT / "config" / "databricks_sources.json").read_text())


def load_governed_segments() -> dict[str, Any]:
    config_path = ROOT / "config" / "custom_segment_mapping.json"
    config = json.loads(config_path.read_text())
    source_path = (ROOT / config["source"]).resolve()
    if not source_path.is_file():
        raise FileNotFoundError(f"Governed Full Set mapping not found: {source_path}")

    with source_path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        required_columns = {"ius_make_model_key", "ius_make_model", "custom_segment"}
        if not reader.fieldnames or not required_columns.issubset(reader.fieldnames):
            raise ValueError(
                f"Governed Full Set columns must include {sorted(required_columns)}; "
                f"found {reader.fieldnames}"
            )
        rows = list(reader)
    if len(rows) != 149:
        raise ValueError(f"Expected 149 governed Full Set rows, found {len(rows)}")

    seen_model_keys: set[str] = set()
    for row_number, row in enumerate(rows, start=2):
        model_key = str(row["ius_make_model_key"] or "").strip().casefold()
        model = str(row["ius_make_model"] or "").strip()
        segment = str(row["custom_segment"] or "").strip()
        if not model_key or not model or not segment:
            raise ValueError(f"Blank governed Full Set value on CSV row {row_number}: {row}")
        if model_key in seen_model_keys:
            raise ValueError(f"Duplicate governed model key on CSV row {row_number}: {model_key}")
        seen_model_keys.add(model_key)

    def segment_key(value: str) -> str:
        return re.sub(r"[^a-z0-9]+", "", value.casefold())

    for model, model_config in config["model_segments"].items():
        matches = [
            row for row in rows
            if segment_key(row["custom_segment"]) == segment_key(model_config["segment"])
        ]
        if not matches:
            raise ValueError(f"No governed Full Set rows found for {model}: {model_config['segment']}")
        governed_segments = {row["custom_segment"] for row in matches}
        if len(governed_segments) != 1:
            raise ValueError(f"Ambiguous governed segment for {model}: {sorted(governed_segments)}")
        model_config["segment"] = matches[0]["custom_segment"]
        model_config["members"] = [row["ius_make_model"] for row in matches]
    return config


SEGMENTS = load_governed_segments()
CLI = "/Users/maximodevries/Desktop/codex_source/tools/databricks"
PROFILE = os.getenv("DATABRICKS_CONFIG_PROFILE", CONFIG["profile"])
MODELS = list(SEGMENTS["model_segments"])
EXPECTED_MONTHS = [f"2025-{m:02d}-01" for m in range(1, 13)] + [f"2026-{m:02d}-01" for m in range(1, 9)]


def cli_json(*args: str) -> dict[str, Any]:
    try:
        result = subprocess.run(
            [CLI, *args, "--profile", PROFILE, "--output", "json"],
            check=True,
            capture_output=True,
            text=True,
        )
    except subprocess.CalledProcessError as exc:
        raise RuntimeError(exc.stderr.strip() or exc.stdout.strip()) from exc
    return json.loads(result.stdout)


def execute_sql(source_key: str, statement: str) -> dict[str, Any]:
    source = CONFIG["sources"][source_key]
    response = cli_json(
        "api", "post", "/api/2.0/sql/statements", "--json",
        json.dumps({
            "warehouse_id": source["warehouse_id"],
            "statement": statement,
            "wait_timeout": "50s",
            "disposition": "INLINE",
            "format": "JSON_ARRAY",
        }),
    )
    deadline = time.monotonic() + 180
    while response.get("status", {}).get("state") in {"PENDING", "RUNNING"}:
        if time.monotonic() >= deadline:
            raise TimeoutError(f"Databricks statement {response['statement_id']} timed out")
        time.sleep(1)
        response = cli_json("api", "get", f"/api/2.0/sql/statements/{response['statement_id']}")
    if response.get("status", {}).get("state") != "SUCCEEDED":
        raise RuntimeError(json.dumps(response.get("status", {}), indent=2))
    columns = [item["name"] for item in response["manifest"]["schema"]["columns"]]
    rows = [dict(zip(columns, values)) for values in response.get("result", {}).get("data_array", [])]
    return {"source": source, "statement_id": response["statement_id"], "columns": columns, "rows": rows}


def series_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", value.casefold()).strip("_")


def member_label(value: str) -> str:
    return value.split("_", 1)[1] if "_" in value else value


def is_target_member(model: str, member: str) -> bool:
    return series_key(member) == f"hyundai_{series_key(model)}"


# Governance rule used by the SQL below:
# - competitor records stay on their exact source ius_make_model;
# - Hyundai alone may roll to its source family/model-series;
# - segment remains part of every identity so same-nameplate vehicles in different
#   segments (notably Kona and Kona EV) never combine.
def search_sql() -> str:
    member_values = []
    for model, config in SEGMENTS["model_segments"].items():
        for member in config["members"]:
            compact = re.sub(r"[^a-z0-9]+", "", member.casefold())
            member_values.append(
                f"('{model.replace("'", "''")}', '{config['segment'].replace("'", "''")}', "
                f"'{member_label(member).replace("'", "''")}', '{compact}', {str(is_target_member(model, member)).upper()})"
            )
    return f"""
WITH requested_members AS (
  SELECT * FROM VALUES {','.join(member_values)}
  AS t(model, segment, member_label, compact_label, is_target)
),
dimensions AS (
  SELECT DISTINCT ius_make_model, ius_make_model_family, ius_srs_segment
  FROM ius_unity_prod.google_datamart.ad_opportunity_regional_daily
  WHERE date_month BETWEEN DATE'2025-01-01' AND DATE'2026-08-01'
),
candidate_members AS (
  SELECT
    r.*,
    d.ius_make_model,
    d.ius_make_model_family,
    d.ius_srs_segment,
    ROW_NUMBER() OVER (
      PARTITION BY r.model, r.member_label
      ORDER BY LENGTH(d.ius_make_model), d.ius_make_model
    ) AS match_rank
  FROM requested_members r
  JOIN dimensions d
    ON REGEXP_REPLACE(LOWER(d.ius_make_model), '[^a-z0-9]', '') = r.compact_label
),
resolved_members AS (
  SELECT * FROM candidate_members WHERE match_rank = 1
),
resolved_display AS (
  SELECT *,
    CASE
      WHEN LOWER(ius_make_model) RLIKE '^hyundai_'
        THEN COALESCE(NULLIF(ius_make_model_family, ''), ius_make_model)
      ELSE ius_make_model
    END AS display_model
  FROM resolved_members
),
member_models AS (
  SELECT DISTINCT model, segment, display_model, ius_srs_segment
  FROM resolved_display
),
monthly_make_model AS (
  SELECT
    date_month,
    ius_make_model,
    MAX(ius_make_model_family) AS ius_make_model_family,
    MAX(ius_srs_segment) AS ius_srs_segment,
    SUM(CAST(indexed_ad_opportunities AS DOUBLE)) AS search_volume
  FROM ius_unity_prod.google_datamart.ad_opportunity_regional_daily
  WHERE date_month BETWEEN DATE'2025-01-01' AND DATE'2026-08-01'
  GROUP BY date_month, ius_make_model
),
monthly_display AS (
  SELECT date_month,
    CASE
      WHEN LOWER(ius_make_model) RLIKE '^hyundai_'
        THEN COALESCE(NULLIF(ius_make_model_family, ''), ius_make_model)
      ELSE ius_make_model
    END AS display_model,
    ius_srs_segment,
    SUM(search_volume) AS search_volume
  FROM monthly_make_model
  GROUP BY date_month,
    CASE
      WHEN LOWER(ius_make_model) RLIKE '^hyundai_'
        THEN COALESCE(NULLIF(ius_make_model_family, ''), ius_make_model)
      ELSE ius_make_model
    END,
    ius_srs_segment
),
months AS (
  SELECT DISTINCT date_month FROM monthly_make_model
),
segment_totals AS (
  SELECT
    mo.date_month,
    r.model,
    r.segment,
    SUM(COALESCE(m.search_volume, 0)) AS segment_search_volume
  FROM member_models r
  CROSS JOIN months mo
  LEFT JOIN monthly_display m
    ON m.date_month = mo.date_month
    AND m.display_model = r.display_model
    AND m.ius_srs_segment = r.ius_srs_segment
  GROUP BY mo.date_month, r.model, r.segment
),
target_models AS (
  SELECT model, segment, display_model, ius_srs_segment AS canonical_segment
  FROM resolved_display
  WHERE is_target
),
canonical_totals AS (
  SELECT
    m.date_month,
    t.model,
    SUM(m.search_volume) AS standard_segment_search_volume
  FROM monthly_display m
  JOIN target_models t ON m.ius_srs_segment = t.canonical_segment
  GROUP BY m.date_month, t.model
)
SELECT
  s.date_month,
  s.model,
  s.segment,
  f.search_volume AS model_search_volume,
  s.segment_search_volume,
  f.search_volume / NULLIF(s.segment_search_volume, 0) AS search_share,
  c.standard_segment_search_volume,
  f.search_volume / NULLIF(c.standard_segment_search_volume, 0) AS standard_search_share
FROM segment_totals s
JOIN target_models t USING (model, segment)
JOIN monthly_display f
  ON f.date_month = s.date_month
  AND f.display_model = t.display_model
  AND f.ius_srs_segment = t.canonical_segment
JOIN canonical_totals c
  ON c.date_month = s.date_month AND c.model = s.model
ORDER BY s.date_month, s.model
""".strip()


def search_competitor_sql() -> str:
    member_values = []
    for model, config in SEGMENTS["model_segments"].items():
        for member in config["members"]:
            compact = re.sub(r"[^a-z0-9]+", "", member.casefold())
            member_values.append(
                f"('{model.replace("'", "''")}', '{config['segment'].replace("'", "''")}', "
                f"'{member_label(member).replace("'", "''")}', '{compact}', {str(is_target_member(model, member)).upper()})"
            )
    return f"""
WITH requested_members AS (
  SELECT * FROM VALUES {','.join(member_values)}
  AS t(target_model, special_segment, member_label, compact_label, is_target)
),
dimensions AS (
  SELECT DISTINCT ius_make_model, ius_make_model_family, ius_srs_segment
  FROM ius_unity_prod.google_datamart.ad_opportunity_regional_daily
  WHERE date_month BETWEEN DATE'2025-01-01' AND DATE'2026-08-01'
),
candidates AS (
  SELECT r.*, d.*,
    ROW_NUMBER() OVER (PARTITION BY r.target_model, r.member_label ORDER BY LENGTH(d.ius_make_model), d.ius_make_model) AS match_rank
  FROM requested_members r
  JOIN dimensions d
    ON REGEXP_REPLACE(LOWER(d.ius_make_model), '[^a-z0-9]', '') = r.compact_label
),
resolved AS (
  SELECT * FROM candidates WHERE match_rank = 1
),
resolved_display AS (
  SELECT *,
    CASE
      WHEN LOWER(ius_make_model) RLIKE '^hyundai_'
        THEN COALESCE(NULLIF(ius_make_model_family, ''), ius_make_model)
      ELSE ius_make_model
    END AS display_model
  FROM resolved
),
member_models AS (
  SELECT target_model, special_segment,
    MAX(CASE WHEN LOWER(ius_make_model) RLIKE '^hyundai_' THEN display_model ELSE member_label END) AS family,
    display_model, ius_srs_segment AS source_segment,
    CONCAT(
      REGEXP_REPLACE(LOWER(display_model), '[^a-z0-9]+', '_'), '__',
      REGEXP_REPLACE(LOWER(special_segment), '[^a-z0-9]+', '_')
    ) AS family_key
  FROM resolved_display
  GROUP BY target_model, special_segment, display_model, ius_srs_segment
),
target_def AS (
  SELECT DISTINCT target_model, special_segment, display_model AS target_model_key,
    ius_srs_segment AS standard_segment
  FROM resolved_display WHERE is_target
),
monthly_display AS (
  SELECT date_month,
    CASE
      WHEN LOWER(ius_make_model) RLIKE '^hyundai_'
        THEN COALESCE(NULLIF(ius_make_model_family, ''), ius_make_model)
      ELSE ius_make_model
    END AS display_model,
    ius_srs_segment AS source_segment,
    CONCAT(
      REGEXP_REPLACE(LOWER(CASE
        WHEN LOWER(ius_make_model) RLIKE '^hyundai_'
          THEN COALESCE(NULLIF(ius_make_model_family, ''), ius_make_model)
        ELSE ius_make_model
      END), '[^a-z0-9]+', '_'), '__',
      REGEXP_REPLACE(LOWER(ius_srs_segment), '[^a-z0-9]+', '_')
    ) AS family_key,
    SUM(CAST(indexed_ad_opportunities AS DOUBLE)) AS search_volume
  FROM ius_unity_prod.google_datamart.ad_opportunity_regional_daily
  WHERE date_month BETWEEN DATE'2025-01-01' AND DATE'2026-08-01'
  GROUP BY date_month,
    CASE
      WHEN LOWER(ius_make_model) RLIKE '^hyundai_'
        THEN COALESCE(NULLIF(ius_make_model_family, ''), ius_make_model)
      ELSE ius_make_model
    END,
    ius_srs_segment
),
special_rows AS (
  SELECT m.target_model, 'special' AS segment_mode, m.special_segment AS segment,
    f.date_month, m.family_key, m.family, f.search_volume
  FROM member_models m JOIN monthly_display f
    ON f.display_model = m.display_model AND f.source_segment = m.source_segment
),
standard_rows AS (
  SELECT t.target_model, 'standard' AS segment_mode, t.standard_segment AS segment,
    f.date_month, f.family_key, f.display_model AS family, f.search_volume
  FROM target_def t JOIN monthly_display f ON f.source_segment = t.standard_segment
),
combined AS (
  SELECT * FROM special_rows UNION ALL SELECT * FROM standard_rows
)
SELECT *,
  SUM(search_volume) OVER (PARTITION BY target_model, segment_mode, date_month) AS segment_search_volume,
  search_volume / NULLIF(SUM(search_volume) OVER (PARTITION BY target_model, segment_mode, date_month), 0) AS search_share
FROM combined
ORDER BY target_model, segment_mode, date_month, family_key
""".strip()


def sales_sql() -> str:
    model_values = []
    member_values = []
    for model, config in SEGMENTS["model_segments"].items():
        model_values.append(f"('{model.replace("'", "''")}', '{config['segment'].replace("'", "''")}', '{series_key(model)}')")
        for member in config["members"]:
            member_values.append(f"('{model.replace("'", "''")}', '{config['segment'].replace("'", "''")}', '{series_key(member_label(member))}')")
    return f"""
WITH model_map AS (
  SELECT * FROM VALUES {','.join(model_values)} AS t(model, segment, model_series)
),
segment_members AS (
  SELECT * FROM VALUES {','.join(member_values)} AS t(model, segment, model_series)
),
monthly_sales AS (
  SELECT
    date_month,
    LOWER(TRIM(ius_model_series)) AS model_series,
    ius_srs_segment,
    SUM(COALESCE(srs_sales_volume, 0)) AS retail_units
  FROM ius_unity_prod.sandbox.agent_srs
  WHERE date_month BETWEEN DATE'2025-01-01' AND DATE'2026-08-01'
    AND sales_region_cd IN ('CE', 'EA', 'MA', 'MS', 'NH', 'SC', 'SO', 'WE')
  GROUP BY date_month, LOWER(TRIM(ius_model_series)), ius_srs_segment
),
model_sales AS (
  SELECT s.date_month, m.model, m.segment, SUM(s.retail_units) AS model_retail_units
  FROM monthly_sales s JOIN model_map m ON s.model_series = m.model_series
  GROUP BY s.date_month, m.model, m.segment
),
segment_sales AS (
  SELECT s.date_month, m.model, m.segment, SUM(s.retail_units) AS segment_retail_units
  FROM monthly_sales s JOIN segment_members m ON s.model_series = m.model_series
  GROUP BY s.date_month, m.model, m.segment
),
target_segments AS (
  SELECT m.model, MAX(s.ius_srs_segment) AS canonical_segment
  FROM model_map m JOIN monthly_sales s ON s.model_series = m.model_series
  GROUP BY m.model
),
standard_segment_sales AS (
  SELECT s.date_month, t.model, SUM(s.retail_units) AS standard_segment_retail_units
  FROM monthly_sales s JOIN target_segments t ON s.ius_srs_segment = t.canonical_segment
  GROUP BY s.date_month, t.model
)
SELECT
  a.date_month,
  a.model,
  a.segment,
  a.model_retail_units,
  b.segment_retail_units,
  a.model_retail_units / NULLIF(b.segment_retail_units, 0) AS retail_share,
  c.standard_segment_retail_units,
  a.model_retail_units / NULLIF(c.standard_segment_retail_units, 0) AS standard_retail_share
FROM model_sales a
JOIN segment_sales b USING (date_month, model, segment)
JOIN standard_segment_sales c USING (date_month, model)
ORDER BY a.date_month, a.model
""".strip()


def sales_competitor_sql() -> str:
    member_values = []
    for model, config in SEGMENTS["model_segments"].items():
        for member in config["members"]:
            compact = re.sub(r"[^a-z0-9]+", "", member.casefold())
            member_values.append(
                f"('{model.replace("'", "''")}', '{config['segment'].replace("'", "''")}', "
                f"'{member_label(member).replace("'", "''")}', '{compact}', {str(is_target_member(model, member)).upper()})"
            )
    return f"""
WITH requested_members AS (
  SELECT * FROM VALUES {','.join(member_values)}
  AS t(target_model, special_segment, member_label, compact_label, is_target)
),
dimensions AS (
  SELECT DISTINCT ius_make_model, ius_model_series, ius_srs_segment
  FROM ius_unity_prod.sandbox.agent_srs
  WHERE date_month BETWEEN DATE'2025-01-01' AND DATE'2026-08-01'
    AND sales_region_cd IN ('CE', 'EA', 'MA', 'MS', 'NH', 'SC', 'SO', 'WE')
),
candidates AS (
  SELECT r.*, d.*,
    ROW_NUMBER() OVER (PARTITION BY r.target_model, r.member_label ORDER BY LENGTH(d.ius_make_model), d.ius_make_model) AS match_rank
  FROM requested_members r
  JOIN dimensions d
    ON REGEXP_REPLACE(LOWER(d.ius_make_model), '[^a-z0-9]', '') = r.compact_label
),
resolved AS (
  SELECT *,
    CASE
      WHEN LOWER(ius_make_model) RLIKE '^hyundai_'
        THEN LOWER(TRIM(ius_model_series))
      ELSE ius_make_model
    END AS display_model,
    LOWER(ius_make_model) RLIKE '^hyundai_' AS is_hyundai
  FROM candidates WHERE match_rank = 1
),
member_models AS (
  SELECT DISTINCT target_model, special_segment,
    display_model, is_hyundai,
    CASE WHEN is_hyundai THEN NULL ELSE ius_srs_segment END AS source_segment,
    CONCAT(
      REGEXP_REPLACE(LOWER(display_model), '[^a-z0-9]+', '_'), '__',
      REGEXP_REPLACE(LOWER(special_segment), '[^a-z0-9]+', '_')
    ) AS family_key
  FROM resolved
),
monthly_exact AS (
  SELECT date_month,
    ius_make_model,
    LOWER(ius_make_model) RLIKE '^hyundai_' AS is_hyundai,
    CASE
      WHEN LOWER(ius_make_model) RLIKE '^hyundai_'
        THEN LOWER(TRIM(ius_model_series))
      ELSE ius_make_model
    END AS display_model,
    CONCAT(
      REGEXP_REPLACE(LOWER(CASE
        WHEN LOWER(ius_make_model) RLIKE '^hyundai_'
          THEN LOWER(TRIM(ius_model_series))
        ELSE ius_make_model
      END), '[^a-z0-9]+', '_'), '__',
      REGEXP_REPLACE(LOWER(ius_srs_segment), '[^a-z0-9]+', '_')
    ) AS family_key,
    ius_srs_segment AS source_segment,
    SUM(COALESCE(srs_sales_volume, 0)) AS retail_units
  FROM ius_unity_prod.sandbox.agent_srs
  WHERE date_month BETWEEN DATE'2025-01-01' AND DATE'2026-08-01'
    AND sales_region_cd IN ('CE', 'EA', 'MA', 'MS', 'NH', 'SC', 'SO', 'WE')
  GROUP BY date_month,
    ius_make_model,
    LOWER(ius_make_model) RLIKE '^hyundai_',
    CASE
      WHEN LOWER(ius_make_model) RLIKE '^hyundai_'
        THEN LOWER(TRIM(ius_model_series))
      ELSE ius_make_model
    END,
    ius_srs_segment
),
native_segment_totals AS (
  SELECT date_month, source_segment, SUM(retail_units) AS segment_retail_units
  FROM monthly_exact
  GROUP BY date_month, source_segment
),
monthly_display AS (
  SELECT date_month, display_model,
    CONCAT(
      REGEXP_REPLACE(LOWER(display_model), '[^a-z0-9]+', '_'), '__',
      REGEXP_REPLACE(LOWER(source_segment), '[^a-z0-9]+', '_')
    ) AS family_key,
    source_segment,
    SUM(retail_units) AS retail_units
  FROM monthly_exact
  GROUP BY date_month, display_model, source_segment
),
hyundai_segments AS (
  SELECT display_model, MAX(source_segment) AS canonical_segment
  FROM monthly_exact
  WHERE is_hyundai
  GROUP BY display_model
),
canonical_retail AS (
  SELECT f.date_month, f.display_model, f.source_segment,
    f.retail_units, n.segment_retail_units
  FROM monthly_exact f
  JOIN native_segment_totals n
    ON n.date_month = f.date_month AND n.source_segment = f.source_segment
  WHERE NOT f.is_hyundai
  UNION ALL
  SELECT f.date_month, f.display_model, h.canonical_segment AS source_segment,
    SUM(f.retail_units) AS retail_units, MAX(n.segment_retail_units) AS segment_retail_units
  FROM monthly_display f
  JOIN hyundai_segments h ON h.display_model = f.display_model
  JOIN native_segment_totals n
    ON n.date_month = f.date_month AND n.source_segment = h.canonical_segment
  GROUP BY f.date_month, f.display_model, h.canonical_segment
),
target_def AS (
  SELECT DISTINCT r.target_model, r.special_segment,
    r.display_model AS target_display_model, h.canonical_segment AS standard_segment
  FROM resolved r
  JOIN hyundai_segments h ON h.display_model = r.display_model
  WHERE r.is_target
),
special_rows AS (
  SELECT m.target_model, 'special' AS segment_mode, m.special_segment AS segment,
    f.date_month, m.family_key, m.display_model,
    f.source_segment AS srs_segment, t.standard_segment AS target_srs_segment,
    f.retail_units, f.segment_retail_units
  FROM member_models m
  JOIN target_def t ON t.target_model = m.target_model
  JOIN canonical_retail f
    ON f.display_model = m.display_model
    AND (m.is_hyundai OR f.source_segment = m.source_segment)
),
standard_rows AS (
  SELECT t.target_model, 'standard' AS segment_mode, t.standard_segment AS segment,
    f.date_month,
    CONCAT(
      REGEXP_REPLACE(LOWER(f.display_model), '[^a-z0-9]+', '_'), '__',
      REGEXP_REPLACE(LOWER(t.standard_segment), '[^a-z0-9]+', '_')
    ) AS family_key,
    f.display_model,
    f.source_segment AS srs_segment, t.standard_segment AS target_srs_segment,
    f.retail_units, f.segment_retail_units
  FROM target_def t
  JOIN canonical_retail f ON f.source_segment = t.standard_segment
),
combined AS (
  SELECT * FROM special_rows UNION ALL SELECT * FROM standard_rows
)
SELECT *,
  retail_units / NULLIF(segment_retail_units, 0) AS retail_share,
  srs_segment <> target_srs_segment AS retail_segment_mismatch
FROM combined
ORDER BY target_model, segment_mode, date_month, family_key
""".strip()


def inventory_competitor_sql() -> str:
    member_values = []
    for model, config in SEGMENTS["model_segments"].items():
        for member in config["members"]:
            compact = re.sub(r"[^a-z0-9]+", "", member.casefold())
            member_values.append(
                f"('{model.replace("'", "''")}', '{config['segment'].replace("'", "''")}', "
                f"'{member_label(member).replace("'", "''")}', '{compact}', {str(is_target_member(model, member)).upper()})"
            )
    return f"""
WITH requested_members AS (
  SELECT * FROM VALUES {','.join(member_values)}
  AS t(target_model, special_segment, member_label, compact_label, is_target)
),
dimensions AS (
  SELECT DISTINCT ius_make_model, ius_model_series, ius_srs_segment
  FROM ius_unity_prod.sandbox.agent_cloudtheory
  WHERE date_month BETWEEN DATE'2025-01-01' AND DATE'2026-08-01'
    AND sales_region_cd IN ('CE', 'EA', 'MA', 'MS', 'NH', 'SC', 'SO', 'WE')
),
candidates AS (
  SELECT r.*, d.*,
    ROW_NUMBER() OVER (PARTITION BY r.target_model, r.member_label ORDER BY LENGTH(d.ius_make_model), d.ius_make_model) AS match_rank
  FROM requested_members r
  JOIN dimensions d
    ON REGEXP_REPLACE(LOWER(d.ius_make_model), '[^a-z0-9]', '') = r.compact_label
),
resolved AS (
  SELECT *,
    CASE
      WHEN LOWER(ius_make_model) RLIKE '^hyundai_'
        THEN LOWER(TRIM(ius_model_series))
      ELSE ius_make_model
    END AS display_model,
    LOWER(ius_make_model) RLIKE '^hyundai_' AS is_hyundai
  FROM candidates WHERE match_rank = 1
),
member_models AS (
  SELECT DISTINCT target_model, special_segment, display_model, is_hyundai,
    CASE WHEN is_hyundai THEN NULL ELSE ius_srs_segment END AS source_segment,
    CONCAT(
      REGEXP_REPLACE(LOWER(display_model), '[^a-z0-9]+', '_'), '__',
      REGEXP_REPLACE(LOWER(special_segment), '[^a-z0-9]+', '_')
    ) AS family_key
  FROM resolved
),
monthly_exact AS (
  SELECT date_month, ius_make_model,
    LOWER(ius_make_model) RLIKE '^hyundai_' AS is_hyundai,
    CASE
      WHEN LOWER(ius_make_model) RLIKE '^hyundai_'
        THEN LOWER(TRIM(ius_model_series))
      ELSE ius_make_model
    END AS display_model,
    ius_srs_segment AS source_segment,
    SUM(COALESCE(avginventory, 0)) AS inventory_units
  FROM ius_unity_prod.sandbox.agent_cloudtheory
  WHERE date_month BETWEEN DATE'2025-01-01' AND DATE'2026-08-01'
    AND sales_region_cd IN ('CE', 'EA', 'MA', 'MS', 'NH', 'SC', 'SO', 'WE')
  GROUP BY date_month, ius_make_model,
    LOWER(ius_make_model) RLIKE '^hyundai_',
    CASE
      WHEN LOWER(ius_make_model) RLIKE '^hyundai_'
        THEN LOWER(TRIM(ius_model_series))
      ELSE ius_make_model
    END,
    ius_srs_segment
),
native_segment_totals AS (
  SELECT date_month, source_segment, SUM(inventory_units) AS segment_inventory_units
  FROM monthly_exact
  GROUP BY date_month, source_segment
),
monthly_display AS (
  SELECT date_month, display_model,
    CONCAT(
      REGEXP_REPLACE(LOWER(display_model), '[^a-z0-9]+', '_'), '__',
      REGEXP_REPLACE(LOWER(source_segment), '[^a-z0-9]+', '_')
    ) AS family_key,
    source_segment,
    SUM(inventory_units) AS inventory_units
  FROM monthly_exact
  GROUP BY date_month, display_model, source_segment
),
hyundai_segments AS (
  SELECT display_model, MAX(source_segment) AS canonical_segment
  FROM monthly_exact
  WHERE is_hyundai
  GROUP BY display_model
),
canonical_inventory AS (
  SELECT f.date_month, f.display_model, f.source_segment,
    f.inventory_units, n.segment_inventory_units
  FROM monthly_exact f
  JOIN native_segment_totals n
    ON n.date_month = f.date_month AND n.source_segment = f.source_segment
  WHERE NOT f.is_hyundai
  UNION ALL
  SELECT f.date_month, f.display_model, h.canonical_segment AS source_segment,
    SUM(f.inventory_units) AS inventory_units,
    MAX(n.segment_inventory_units) AS segment_inventory_units
  FROM monthly_display f
  JOIN hyundai_segments h ON h.display_model = f.display_model
  JOIN native_segment_totals n
    ON n.date_month = f.date_month AND n.source_segment = h.canonical_segment
  GROUP BY f.date_month, f.display_model, h.canonical_segment
),
target_def AS (
  SELECT DISTINCT r.target_model, r.special_segment,
    r.display_model AS target_display_model, h.canonical_segment AS standard_segment
  FROM resolved r
  JOIN hyundai_segments h ON h.display_model = r.display_model
  WHERE r.is_target
),
special_rows AS (
  SELECT m.target_model, 'special' AS segment_mode, m.special_segment AS segment,
    f.date_month, m.family_key, m.display_model,
    f.source_segment AS inventory_segment, t.standard_segment AS target_inventory_segment,
    f.inventory_units, f.segment_inventory_units
  FROM member_models m
  JOIN target_def t ON t.target_model = m.target_model
  JOIN canonical_inventory f
    ON f.display_model = m.display_model
    AND (m.is_hyundai OR f.source_segment = m.source_segment)
),
standard_rows AS (
  SELECT t.target_model, 'standard' AS segment_mode, t.standard_segment AS segment,
    f.date_month,
    CONCAT(
      REGEXP_REPLACE(LOWER(f.display_model), '[^a-z0-9]+', '_'), '__',
      REGEXP_REPLACE(LOWER(t.standard_segment), '[^a-z0-9]+', '_')
    ) AS family_key,
    f.display_model,
    f.source_segment AS inventory_segment, t.standard_segment AS target_inventory_segment,
    f.inventory_units, f.segment_inventory_units
  FROM target_def t
  JOIN canonical_inventory f ON f.source_segment = t.standard_segment
),
combined AS (
  SELECT * FROM special_rows UNION ALL SELECT * FROM standard_rows
)
SELECT *,
  inventory_units / NULLIF(segment_inventory_units, 0) AS inventory_share,
  inventory_segment <> target_inventory_segment AS inventory_segment_mismatch
FROM combined
ORDER BY target_model, segment_mode, date_month, family_key
""".strip()


def exact_search_competitor_sql() -> str:
    member_values = []
    for model, config in SEGMENTS["model_segments"].items():
        for member in config["members"]:
            compact = re.sub(r"[^a-z0-9]+", "", member.casefold())
            member_values.append(
                f"('{model.replace("'", "''")}', '{config['segment'].replace("'", "''")}', "
                f"'{compact}', {str(is_target_member(model, member)).upper()})"
            )
    return f"""
WITH requested_members AS (
  SELECT * FROM VALUES {','.join(member_values)}
  AS t(target_model, special_segment, compact_label, is_target)
),
dimensions AS (
  SELECT DISTINCT ius_make_model, ius_make_model_family, ius_srs_segment
  FROM ius_unity_prod.google_datamart.ad_opportunity_regional_daily
  WHERE date_month BETWEEN DATE'2025-01-01' AND DATE'2026-08-01'
),
resolved AS (
  SELECT DISTINCT r.target_model, r.special_segment, r.is_target,
    d.ius_make_model, d.ius_make_model_family, d.ius_srs_segment
  FROM requested_members r
  JOIN dimensions d
    ON REGEXP_REPLACE(LOWER(d.ius_make_model), '[^a-z0-9]', '') = r.compact_label
),
monthly_exact AS (
  SELECT date_month, ius_make_model,
    MAX(ius_make_model_family) AS ius_make_model_family,
    ius_srs_segment AS source_segment,
    SUM(CAST(indexed_ad_opportunities AS DOUBLE)) AS search_volume
  FROM ius_unity_prod.google_datamart.ad_opportunity_regional_daily
  WHERE date_month BETWEEN DATE'2025-01-01' AND DATE'2026-08-01'
  GROUP BY date_month, ius_make_model, ius_srs_segment
),
special_exact AS (
  SELECT DISTINCT r.target_model, r.special_segment AS segment, e.*
  FROM resolved r
  JOIN monthly_exact e ON e.ius_make_model = r.ius_make_model
),
special_totals AS (
  SELECT target_model, date_month, SUM(search_volume) AS segment_search_volume
  FROM special_exact
  GROUP BY target_model, date_month
),
special_rows AS (
  SELECT e.target_model, 'special' AS segment_mode, e.segment, e.date_month,
    e.ius_make_model,
    CASE WHEN LOWER(e.ius_make_model) RLIKE '^hyundai_'
      THEN COALESCE(NULLIF(e.ius_make_model_family, ''), e.ius_make_model)
      ELSE e.ius_make_model END AS display_family,
    e.source_segment,
    LOWER(e.ius_make_model) RLIKE '^hyundai_' AS is_hyundai,
    e.search_volume, t.segment_search_volume,
    e.search_volume / NULLIF(t.segment_search_volume, 0) AS search_share
  FROM special_exact e
  JOIN special_totals t USING (target_model, date_month)
),
target_month_candidates AS (
  SELECT r.target_model, e.date_month, e.source_segment,
    ROW_NUMBER() OVER (
      PARTITION BY r.target_model, e.date_month
      ORDER BY e.search_volume DESC, e.source_segment
    ) AS segment_rank
  FROM resolved r
  JOIN monthly_exact e ON e.ius_make_model = r.ius_make_model
  WHERE r.is_target
),
target_month_segments AS (
  SELECT target_model, date_month, source_segment
  FROM target_month_candidates WHERE segment_rank = 1
),
standard_exact AS (
  SELECT t.target_model, t.source_segment AS segment, e.*
  FROM target_month_segments t
  JOIN monthly_exact e
    ON e.date_month = t.date_month AND e.source_segment = t.source_segment
),
standard_totals AS (
  SELECT target_model, date_month, SUM(search_volume) AS segment_search_volume
  FROM standard_exact
  GROUP BY target_model, date_month
)
SELECT e.target_model, 'standard' AS segment_mode, e.segment, e.date_month,
  e.ius_make_model,
  CASE WHEN LOWER(e.ius_make_model) RLIKE '^hyundai_'
    THEN COALESCE(NULLIF(e.ius_make_model_family, ''), e.ius_make_model)
    ELSE e.ius_make_model END AS display_family,
  e.source_segment,
  LOWER(e.ius_make_model) RLIKE '^hyundai_' AS is_hyundai,
  e.search_volume, t.segment_search_volume,
  e.search_volume / NULLIF(t.segment_search_volume, 0) AS search_share
FROM standard_exact e
JOIN standard_totals t USING (target_model, date_month)
UNION ALL
SELECT * FROM special_rows
ORDER BY target_model, segment_mode, date_month, ius_make_model, source_segment
""".strip()


def exact_sales_competitor_sql() -> str:
    member_values = []
    for model, config in SEGMENTS["model_segments"].items():
        for member in config["members"]:
            compact = re.sub(r"[^a-z0-9]+", "", member.casefold())
            member_values.append(
                f"('{model.replace("'", "''")}', '{config['segment'].replace("'", "''")}', "
                f"'{compact}', {str(is_target_member(model, member)).upper()})"
            )
    return f"""
WITH requested_members AS (
  SELECT * FROM VALUES {','.join(member_values)}
  AS t(target_model, special_segment, compact_label, is_target)
),
dimensions AS (
  SELECT DISTINCT ius_make_model, ius_model_series, ius_srs_segment
  FROM ius_unity_prod.sandbox.agent_srs
  WHERE date_month BETWEEN DATE'2025-01-01' AND DATE'2026-08-01'
    AND sales_region_cd IN ('CE', 'EA', 'MA', 'MS', 'NH', 'SC', 'SO', 'WE')
),
resolved AS (
  SELECT DISTINCT r.target_model, r.special_segment, r.is_target,
    d.ius_make_model, LOWER(TRIM(d.ius_model_series)) AS display_family,
    d.ius_srs_segment AS source_segment,
    LOWER(d.ius_make_model) RLIKE '^hyundai_' AS is_hyundai
  FROM requested_members r
  JOIN dimensions d
    ON REGEXP_REPLACE(LOWER(d.ius_make_model), '[^a-z0-9]', '') = r.compact_label
),
monthly_exact AS (
  SELECT date_month, ius_make_model,
    LOWER(TRIM(ius_model_series)) AS display_family,
    ius_srs_segment AS source_segment,
    LOWER(ius_make_model) RLIKE '^hyundai_' AS is_hyundai,
    SUM(COALESCE(srs_sales_volume, 0)) AS retail_units
  FROM ius_unity_prod.sandbox.agent_srs
  WHERE date_month BETWEEN DATE'2025-01-01' AND DATE'2026-08-01'
    AND sales_region_cd IN ('CE', 'EA', 'MA', 'MS', 'NH', 'SC', 'SO', 'WE')
  GROUP BY date_month, ius_make_model, LOWER(TRIM(ius_model_series)),
    ius_srs_segment, LOWER(ius_make_model) RLIKE '^hyundai_'
),
native_totals AS (
  SELECT date_month, source_segment, SUM(retail_units) AS segment_retail_units
  FROM monthly_exact
  GROUP BY date_month, source_segment
),
exact_shares AS (
  SELECT e.*, n.segment_retail_units,
    e.retail_units / NULLIF(n.segment_retail_units, 0) AS retail_share
  FROM monthly_exact e
  JOIN native_totals n USING (date_month, source_segment)
),
special_exact AS (
  SELECT DISTINCT r.target_model, r.special_segment AS segment, e.*
  FROM resolved r
  JOIN exact_shares e
    ON (
      r.is_hyundai AND e.is_hyundai
      AND e.display_family = r.display_family
      AND e.source_segment = r.source_segment
    ) OR (
      NOT r.is_hyundai AND e.ius_make_model = r.ius_make_model
      AND e.source_segment = r.source_segment
    )
),
target_month_candidates AS (
  SELECT r.target_model, e.date_month, e.source_segment, e.retail_units,
    ROW_NUMBER() OVER (
      PARTITION BY r.target_model, e.date_month
      ORDER BY e.retail_units DESC, e.source_segment
    ) AS segment_rank
  FROM resolved r
  JOIN exact_shares e
    ON e.ius_make_model = r.ius_make_model AND e.source_segment = r.source_segment
  WHERE r.is_target
),
target_month_segments AS (
  SELECT target_model, date_month, source_segment
  FROM target_month_candidates WHERE segment_rank = 1
),
standard_exact AS (
  SELECT t.target_model, t.source_segment AS segment, e.*
  FROM target_month_segments t
  JOIN exact_shares e
    ON e.date_month = t.date_month AND e.source_segment = t.source_segment
)
SELECT target_model, 'special' AS segment_mode, segment, date_month,
  ius_make_model, display_family, source_segment, is_hyundai,
  retail_units, segment_retail_units, retail_share
FROM special_exact
UNION ALL
SELECT target_model, 'standard' AS segment_mode, segment, date_month,
  ius_make_model, display_family, source_segment, is_hyundai,
  retail_units, segment_retail_units, retail_share
FROM standard_exact
ORDER BY target_model, segment_mode, date_month, ius_make_model, source_segment
""".strip()


def exact_inventory_competitor_sql() -> str:
    member_values = []
    for model, config in SEGMENTS["model_segments"].items():
        for member in config["members"]:
            compact = re.sub(r"[^a-z0-9]+", "", member.casefold())
            member_values.append(
                f"('{model.replace("'", "''")}', '{config['segment'].replace("'", "''")}', "
                f"'{compact}', {str(is_target_member(model, member)).upper()})"
            )
    return f"""
WITH requested_members AS (
  SELECT * FROM VALUES {','.join(member_values)}
  AS t(target_model, special_segment, compact_label, is_target)
),
dimensions AS (
  SELECT DISTINCT ius_make_model, ius_model_series, ius_srs_segment
  FROM ius_unity_prod.sandbox.agent_cloudtheory
  WHERE date_month BETWEEN DATE'2025-01-01' AND DATE'2026-08-01'
    AND sales_region_cd IN ('CE', 'EA', 'MA', 'MS', 'NH', 'SC', 'SO', 'WE')
),
resolved AS (
  SELECT DISTINCT r.target_model, r.special_segment, r.is_target,
    d.ius_make_model, LOWER(TRIM(d.ius_model_series)) AS display_family,
    d.ius_srs_segment AS source_segment,
    LOWER(d.ius_make_model) RLIKE '^hyundai_' AS is_hyundai
  FROM requested_members r
  JOIN dimensions d
    ON REGEXP_REPLACE(LOWER(d.ius_make_model), '[^a-z0-9]', '') = r.compact_label
),
monthly_exact AS (
  SELECT date_month, ius_make_model,
    LOWER(TRIM(ius_model_series)) AS display_family,
    ius_srs_segment AS source_segment,
    LOWER(ius_make_model) RLIKE '^hyundai_' AS is_hyundai,
    SUM(COALESCE(avginventory, 0)) AS inventory_units
  FROM ius_unity_prod.sandbox.agent_cloudtheory
  WHERE date_month BETWEEN DATE'2025-01-01' AND DATE'2026-08-01'
    AND sales_region_cd IN ('CE', 'EA', 'MA', 'MS', 'NH', 'SC', 'SO', 'WE')
  GROUP BY date_month, ius_make_model, LOWER(TRIM(ius_model_series)),
    ius_srs_segment, LOWER(ius_make_model) RLIKE '^hyundai_'
),
native_totals AS (
  SELECT date_month, source_segment, SUM(inventory_units) AS segment_inventory_units
  FROM monthly_exact
  GROUP BY date_month, source_segment
),
exact_shares AS (
  SELECT e.*, n.segment_inventory_units,
    e.inventory_units / NULLIF(n.segment_inventory_units, 0) AS inventory_share
  FROM monthly_exact e
  JOIN native_totals n USING (date_month, source_segment)
),
special_exact AS (
  SELECT DISTINCT r.target_model, r.special_segment AS segment, e.*
  FROM resolved r
  JOIN exact_shares e
    ON (
      r.is_hyundai AND e.is_hyundai
      AND e.display_family = r.display_family
      AND e.source_segment = r.source_segment
    ) OR (
      NOT r.is_hyundai AND e.ius_make_model = r.ius_make_model
      AND e.source_segment = r.source_segment
    )
),
target_month_candidates AS (
  SELECT r.target_model, e.date_month, e.source_segment, e.inventory_units,
    ROW_NUMBER() OVER (
      PARTITION BY r.target_model, e.date_month
      ORDER BY e.inventory_units DESC, e.source_segment
    ) AS segment_rank
  FROM resolved r
  JOIN exact_shares e
    ON e.ius_make_model = r.ius_make_model AND e.source_segment = r.source_segment
  WHERE r.is_target
),
target_month_segments AS (
  SELECT target_model, date_month, source_segment
  FROM target_month_candidates WHERE segment_rank = 1
),
standard_exact AS (
  SELECT t.target_model, t.source_segment AS segment, e.*
  FROM target_month_segments t
  JOIN exact_shares e
    ON e.date_month = t.date_month AND e.source_segment = t.source_segment
)
SELECT target_model, 'special' AS segment_mode, segment, date_month,
  ius_make_model, display_family, source_segment, is_hyundai,
  inventory_units, segment_inventory_units, inventory_share
FROM special_exact
UNION ALL
SELECT target_model, 'standard' AS segment_mode, segment, date_month,
  ius_make_model, display_family, source_segment, is_hyundai,
  inventory_units, segment_inventory_units, inventory_share
FROM standard_exact
ORDER BY target_model, segment_mode, date_month, ius_make_model, source_segment
""".strip()


def rollup_exact_competitors(
    payload: dict[str, Any], volume_key: str, denominator_key: str, share_key: str
) -> dict[str, Any]:
    grouped: dict[tuple[str, str, str, str, str], list[dict[str, Any]]] = {}
    for row in payload["rows"]:
        is_hyundai = str(row["is_hyundai"]).casefold() == "true"
        display_family = str(row["display_family"])
        identity = (
            display_family.split("_", 1)[1]
            if is_hyundai and display_family.casefold().startswith("hyundai_")
            else display_family if is_hyundai else str(row["ius_make_model"])
        )
        key = (
            str(row["target_model"]),
            str(row["segment_mode"]),
            str(row["date_month"])[:10],
            identity,
            str(row["source_segment"]),
        )
        grouped.setdefault(key, []).append(row)

    rolled_rows: list[dict[str, Any]] = []
    for (target_model, segment_mode, month, identity, source_segment), rows in sorted(grouped.items()):
        denominators = {float(row[denominator_key]) for row in rows}
        if len(denominators) != 1:
            raise ValueError(
                f"Cannot roll variants with different denominators: {target_model} / {segment_mode} / "
                f"{month} / {identity} / {source_segment} / {sorted(denominators)}"
            )
        denominator = denominators.pop()
        volume = sum(float(row[volume_key]) for row in rows)
        share = sum(float(row[share_key]) for row in rows)
        expected_share = volume / denominator if denominator else 0.0
        if abs(share - expected_share) > 1e-8:
            raise ValueError(
                f"Post-calculation rollup failed: {target_model} / {segment_mode} / {month} / "
                f"{identity} / {source_segment}: summed_share={share} volume_share={expected_share}"
            )
        is_hyundai = str(rows[0]["is_hyundai"]).casefold() == "true"
        family = identity if is_hyundai else member_label(identity)
        rolled_rows.append({
            "target_model": target_model,
            "segment_mode": segment_mode,
            "segment": str(rows[0]["segment"]),
            "date_month": month,
            "family_key": f"{series_key(identity)}__{series_key(source_segment)}",
            "family": family,
            "display_model": family,
            "source_segment": source_segment,
            "is_hyundai": is_hyundai,
            "source_models": sorted({str(row["ius_make_model"]) for row in rows}),
            volume_key: volume,
            denominator_key: denominator,
            share_key: share,
        })
    return {**payload, "rows": rolled_rows}


def add_native_segment_metadata(
    payload: dict[str, Any], volume_key: str, segment_field: str,
    target_segment_field: str, mismatch_field: str,
) -> None:
    grouped: dict[tuple[str, str, str], list[dict[str, Any]]] = {}
    for row in payload["rows"]:
        grouped.setdefault(
            (str(row["target_model"]), str(row["segment_mode"]), str(row["date_month"])[:10]), []
        ).append(row)
    for (target_model, _mode, _month), rows in grouped.items():
        candidates = [
            row for row in rows
            if any(is_target_member(target_model, source_model) for source_model in row["source_models"])
        ]
        if not candidates:
            candidates = [row for row in rows if series_key(str(row["family"])) == series_key(target_model)]
        if not candidates:
            raise ValueError(f"Missing target exact model after native-segment rollup: {target_model}")
        target_row = max(candidates, key=lambda row: float(row[volume_key]))
        target_segment = str(target_row["source_segment"])
        for row in rows:
            row[segment_field] = str(row["source_segment"])
            row[target_segment_field] = target_segment
            row[mismatch_field] = str(row["source_segment"]) != target_segment


def regional_search_sql() -> str:
    member_values = []
    for model, config in SEGMENTS["model_segments"].items():
        for member in config["members"]:
            compact = re.sub(r"[^a-z0-9]+", "", member.casefold())
            member_values.append(
                f"('{model.replace("'", "''")}', '{config['segment'].replace("'", "''")}', "
                f"'{member_label(member).replace("'", "''")}', '{compact}', {str(is_target_member(model, member)).upper()})"
            )
    return f"""
WITH requested_members AS (
  SELECT * FROM VALUES {','.join(member_values)}
  AS t(target_model, special_segment, member_label, compact_label, is_target)
),
dimensions AS (
  SELECT DISTINCT ius_make_model, ius_make_model_family, ius_srs_segment
  FROM ius_unity_prod.sandbox.agent_googleadops_monthly
  WHERE date_month BETWEEN DATE'2025-01-01' AND DATE'2026-08-01'
),
candidates AS (
  SELECT r.*, d.*,
    ROW_NUMBER() OVER (PARTITION BY r.target_model, r.member_label ORDER BY LENGTH(d.ius_make_model), d.ius_make_model) AS match_rank
  FROM requested_members r
  JOIN dimensions d
    ON REGEXP_REPLACE(LOWER(d.ius_make_model), '[^a-z0-9]', '') = r.compact_label
),
resolved AS (
  SELECT * FROM candidates WHERE match_rank = 1
),
resolved_display AS (
  SELECT *,
    CASE
      WHEN LOWER(ius_make_model) RLIKE '^hyundai_'
        THEN COALESCE(NULLIF(ius_make_model_family, ''), ius_make_model)
      ELSE ius_make_model
    END AS display_model
  FROM resolved
),
member_models AS (
  SELECT DISTINCT target_model, special_segment, display_model,
    ius_srs_segment AS source_segment
  FROM resolved_display
),
target_def AS (
  SELECT DISTINCT target_model, special_segment,
    display_model AS target_model_key,
    ius_srs_segment AS standard_segment
  FROM resolved_display WHERE is_target
),
monthly_display_region AS (
  SELECT f.date_month,
    CASE
      WHEN LOWER(TRIM(f.geo_level)) = 'national' THEN 'NTL'
      ELSE CASE LOWER(TRIM(f.geo_name))
      WHEN 'central' THEN 'CE' WHEN 'eastern' THEN 'EA'
      WHEN 'mid atlantic' THEN 'MA' WHEN 'mountain' THEN 'MS'
      WHEN 'south central' THEN 'SC' WHEN 'southern' THEN 'SO'
      WHEN 'western' THEN 'WE'
      END
    END AS sales_region_cd,
    MAX(CASE WHEN LOWER(TRIM(f.geo_level)) = 'national' THEN 'National' ELSE INITCAP(TRIM(f.geo_name)) END) AS region,
    CASE
      WHEN LOWER(f.ius_make_model) RLIKE '^hyundai_'
        THEN COALESCE(NULLIF(f.ius_make_model_family, ''), f.ius_make_model)
      ELSE f.ius_make_model
    END AS display_model,
    f.ius_srs_segment AS source_segment,
    SUM(CAST(f.indexed_ad_opportunities_monthly_sum AS DOUBLE)) AS search_volume
  FROM ius_unity_prod.sandbox.agent_googleadops_monthly f
  WHERE f.date_month BETWEEN DATE'2025-01-01' AND DATE'2026-08-01'
    AND (
      LOWER(TRIM(f.geo_level)) = 'national'
      OR (LOWER(TRIM(f.geo_level)) = 'regional'
        AND LOWER(TRIM(f.geo_name)) IN ('central', 'eastern', 'mid atlantic', 'mountain', 'south central', 'southern', 'western'))
    )
  GROUP BY f.date_month,
    CASE
      WHEN LOWER(TRIM(f.geo_level)) = 'national' THEN 'NTL'
      ELSE CASE LOWER(TRIM(f.geo_name))
      WHEN 'central' THEN 'CE' WHEN 'eastern' THEN 'EA'
      WHEN 'mid atlantic' THEN 'MA' WHEN 'mountain' THEN 'MS'
      WHEN 'south central' THEN 'SC' WHEN 'southern' THEN 'SO'
      WHEN 'western' THEN 'WE'
      END
    END,
    CASE
      WHEN LOWER(f.ius_make_model) RLIKE '^hyundai_'
        THEN COALESCE(NULLIF(f.ius_make_model_family, ''), f.ius_make_model)
      ELSE f.ius_make_model
    END,
    f.ius_srs_segment
),
special_rows AS (
  SELECT m.target_model, 'special' AS segment_mode, m.special_segment AS segment,
    f.date_month, f.sales_region_cd AS region_cd, MAX(f.region) AS region,
    SUM(CASE WHEN f.display_model = t.target_model_key THEN f.search_volume ELSE 0 END) AS model_search_volume,
    SUM(f.search_volume) AS segment_search_volume
  FROM member_models m
  JOIN target_def t ON t.target_model = m.target_model
  JOIN monthly_display_region f
    ON f.display_model = m.display_model AND f.source_segment = m.source_segment
  GROUP BY m.target_model, m.special_segment, f.date_month, f.sales_region_cd
),
standard_rows AS (
  SELECT t.target_model, 'standard' AS segment_mode, t.standard_segment AS segment,
    f.date_month, f.sales_region_cd AS region_cd, MAX(f.region) AS region,
    SUM(CASE WHEN f.display_model = t.target_model_key THEN f.search_volume ELSE 0 END) AS model_search_volume,
    SUM(f.search_volume) AS segment_search_volume
  FROM target_def t
  JOIN monthly_display_region f ON f.source_segment = t.standard_segment
  GROUP BY t.target_model, t.standard_segment, f.date_month, f.sales_region_cd
),
combined AS (
  SELECT * FROM special_rows UNION ALL SELECT * FROM standard_rows
)
SELECT *, model_search_volume / NULLIF(segment_search_volume, 0) AS search_share
FROM combined
ORDER BY target_model, segment_mode, date_month, region_cd
""".strip()


def regional_sales_sql() -> str:
    member_values = []
    for model, config in SEGMENTS["model_segments"].items():
        for member in config["members"]:
            compact = re.sub(r"[^a-z0-9]+", "", member.casefold())
            member_values.append(
                f"('{model.replace("'", "''")}', '{config['segment'].replace("'", "''")}', "
                f"'{member_label(member).replace("'", "''")}', '{compact}', {str(is_target_member(model, member)).upper()})"
            )
    return f"""
WITH requested_members AS (
  SELECT * FROM VALUES {','.join(member_values)}
  AS t(target_model, special_segment, member_label, compact_label, is_target)
),
dimensions AS (
  SELECT DISTINCT ius_make_model, LOWER(TRIM(ius_model_series)) AS model_series, ius_srs_segment
  FROM ius_unity_prod.sandbox.agent_srs
  WHERE date_month BETWEEN DATE'2025-01-01' AND DATE'2026-08-01'
    AND sales_region_cd IN ('CE', 'EA', 'MA', 'MS', 'NH', 'SC', 'SO', 'WE')
),
candidates AS (
  SELECT r.*, d.*,
    ROW_NUMBER() OVER (PARTITION BY r.target_model, r.member_label ORDER BY LENGTH(d.ius_make_model), d.ius_make_model) AS match_rank
  FROM requested_members r
  JOIN dimensions d
    ON REGEXP_REPLACE(LOWER(d.ius_make_model), '[^a-z0-9]', '') = r.compact_label
),
resolved AS (
  SELECT *,
    CASE
      WHEN LOWER(ius_make_model) RLIKE '^hyundai_' THEN model_series
      ELSE ius_make_model
    END AS display_model
  FROM candidates WHERE match_rank = 1
),
member_models AS (
  SELECT DISTINCT target_model, special_segment, display_model,
    ius_srs_segment AS source_segment
  FROM resolved
),
target_def AS (
  SELECT DISTINCT target_model, special_segment, display_model AS target_model_key,
    ius_srs_segment AS standard_segment
  FROM resolved WHERE is_target
),
regional_sales AS (
  SELECT date_month, sales_region_cd,
    CASE
      WHEN LOWER(ius_make_model) RLIKE '^hyundai_' THEN LOWER(TRIM(ius_model_series))
      ELSE ius_make_model
    END AS display_model,
    ius_srs_segment, SUM(COALESCE(srs_sales_volume, 0)) AS retail_units
  FROM ius_unity_prod.sandbox.agent_srs
  WHERE date_month BETWEEN DATE'2025-01-01' AND DATE'2026-08-01'
    AND sales_region_cd IN ('CE', 'EA', 'MA', 'MS', 'NH', 'SC', 'SO', 'WE')
  GROUP BY date_month, sales_region_cd,
    CASE
      WHEN LOWER(ius_make_model) RLIKE '^hyundai_' THEN LOWER(TRIM(ius_model_series))
      ELSE ius_make_model
    END,
    ius_srs_segment
),
monthly_sales AS (
  SELECT * FROM regional_sales
  UNION ALL
  SELECT date_month, 'NTL' AS sales_region_cd, display_model, ius_srs_segment,
    SUM(retail_units) AS retail_units
  FROM regional_sales
  GROUP BY date_month, display_model, ius_srs_segment
),
special_rows AS (
  SELECT m.target_model, 'special' AS segment_mode, m.special_segment AS segment,
    s.date_month, s.sales_region_cd AS region_cd,
    SUM(CASE WHEN s.display_model = t.target_model_key AND s.ius_srs_segment = t.standard_segment THEN s.retail_units ELSE 0 END) AS model_retail_units,
    SUM(s.retail_units) AS segment_retail_units
  FROM member_models m
  JOIN target_def t ON t.target_model = m.target_model
  JOIN monthly_sales s ON s.display_model = m.display_model AND s.ius_srs_segment = m.source_segment
  GROUP BY m.target_model, m.special_segment, s.date_month, s.sales_region_cd
),
standard_rows AS (
  SELECT t.target_model, 'standard' AS segment_mode, t.standard_segment AS segment,
    s.date_month, s.sales_region_cd AS region_cd,
    SUM(CASE WHEN s.display_model = t.target_model_key THEN s.retail_units ELSE 0 END) AS model_retail_units,
    SUM(s.retail_units) AS segment_retail_units
  FROM target_def t
  JOIN monthly_sales s ON s.ius_srs_segment = t.standard_segment
  GROUP BY t.target_model, t.standard_segment, s.date_month, s.sales_region_cd
),
combined AS (
  SELECT * FROM special_rows UNION ALL SELECT * FROM standard_rows
)
SELECT *, model_retail_units / NULLIF(segment_retail_units, 0) AS retail_share
FROM combined
ORDER BY target_model, segment_mode, date_month, region_cd
""".strip()
def validate(payload: dict[str, Any], share_column: str) -> None:
    rows = payload["rows"]
    expected_keys = {(month, model.casefold()) for month in EXPECTED_MONTHS for model in MODELS}
    actual_keys = {(str(row["date_month"])[:10], str(row["model"]).casefold()) for row in rows}
    if actual_keys != expected_keys or len(rows) != len(expected_keys):
        missing = sorted(expected_keys - actual_keys)
        extra = sorted(actual_keys - expected_keys)
        raise ValueError(f"Unexpected month/model coverage. missing={missing[:12]} extra={extra[:12]} rows={len(rows)}")
    for row in rows:
        share = float(row[share_column])
        if not 0 <= share <= 1:
            raise ValueError(f"Invalid {share_column}: {row}")


def main() -> None:
    raw_dir = ROOT / "data" / "raw"
    processed_dir = ROOT / "data" / "processed"
    public_dir = ROOT / "public" / "data"
    for folder in (raw_dir, processed_dir, public_dir):
        folder.mkdir(parents=True, exist_ok=True)

    search_path = raw_dir / "google_adops_monthly.json"
    search = execute_sql("search", search_sql())
    search_path.write_text(json.dumps(search, indent=2), encoding="utf-8")
    sales = execute_sql("retail_sales", sales_sql())
    (raw_dir / "srs_retail_monthly.json").write_text(json.dumps(sales, indent=2), encoding="utf-8")
    validate(search, "search_share")
    validate(sales, "retail_share")

    search_competitors_exact = execute_sql("search", exact_search_competitor_sql())
    sales_competitors_exact = execute_sql("retail_sales", exact_sales_competitor_sql())
    inventory_competitors_exact = execute_sql("inventory", exact_inventory_competitor_sql())
    (raw_dir / "google_adops_competitor_exact.json").write_text(
        json.dumps(search_competitors_exact, indent=2), encoding="utf-8"
    )
    (raw_dir / "srs_retail_competitor_exact.json").write_text(
        json.dumps(sales_competitors_exact, indent=2), encoding="utf-8"
    )
    (raw_dir / "cloudtheory_inventory_competitor_exact.json").write_text(
        json.dumps(inventory_competitors_exact, indent=2), encoding="utf-8"
    )
    search_competitors = rollup_exact_competitors(
        search_competitors_exact, "search_volume", "segment_search_volume", "search_share"
    )
    sales_competitors = rollup_exact_competitors(
        sales_competitors_exact, "retail_units", "segment_retail_units", "retail_share"
    )
    inventory_competitors = rollup_exact_competitors(
        inventory_competitors_exact, "inventory_units", "segment_inventory_units", "inventory_share"
    )
    add_native_segment_metadata(
        sales_competitors, "retail_units", "srs_segment", "target_srs_segment", "retail_segment_mismatch"
    )
    add_native_segment_metadata(
        inventory_competitors, "inventory_units", "inventory_segment",
        "target_inventory_segment", "inventory_segment_mismatch"
    )
    (raw_dir / "google_adops_competitor_families.json").write_text(json.dumps(search_competitors, indent=2), encoding="utf-8")
    (raw_dir / "srs_retail_competitor_families.json").write_text(json.dumps(sales_competitors, indent=2), encoding="utf-8")
    (raw_dir / "cloudtheory_inventory_competitor_families.json").write_text(json.dumps(inventory_competitors, indent=2), encoding="utf-8")
    regional_search = execute_sql("regional_search", regional_search_sql())
    regional_sales = execute_sql("retail_sales", regional_sales_sql())
    (raw_dir / "google_adops_regional_monthly.json").write_text(json.dumps(regional_search, indent=2), encoding="utf-8")
    (raw_dir / "srs_retail_regional_monthly.json").write_text(json.dumps(regional_sales, indent=2), encoding="utf-8")

    search_by_key = {(str(r["date_month"])[:10], str(r["model"]).casefold()): r for r in search["rows"]}
    sales_by_key = {(str(r["date_month"])[:10], str(r["model"]).casefold()): r for r in sales["rows"]}
    monthly: list[dict[str, Any]] = []
    for month in EXPECTED_MONTHS:
        for model in MODELS:
            key = (month, model.casefold())
            a, s = search_by_key[key], sales_by_key[key]
            monthly.append({
                "month": month,
                "model": model,
                "segment": SEGMENTS["model_segments"][model]["segment"],
                "search_volume": float(a["model_search_volume"]),
                "segment_search_volume": float(a["segment_search_volume"]),
                "search_share": float(a["search_share"]),
                "standard_segment_search_volume": float(a["standard_segment_search_volume"]),
                "standard_search_share": float(a["standard_search_share"]),
                "retail_units": float(s["model_retail_units"]),
                "segment_retail_units": float(s["segment_retail_units"]),
                "retail_share": float(s["retail_share"]),
                "standard_segment_retail_units": float(s["standard_segment_retail_units"]),
                "standard_retail_share": float(s["standard_retail_share"]),
            })

    snapshots = []
    current_month, prior_month = EXPECTED_MONTHS[-1], EXPECTED_MONTHS[-2]
    for model in MODELS:
        current = next(r for r in monthly if r["month"] == current_month and r["model"] == model)
        prior = next(r for r in monthly if r["month"] == prior_month and r["model"] == model)
        snapshots.append({
            **current,
            "prior_month": prior_month,
            "prior_search_share": prior["search_share"],
            "prior_retail_share": prior["retail_share"],
            "search_share_mom_pp": (current["search_share"] - prior["search_share"]) * 100,
            "retail_share_mom_pp": (current["retail_share"] - prior["retail_share"]) * 100,
        })

    output = {
        "generated_at": datetime.now(UTC).isoformat(),
        "current_month": current_month,
        "prior_month": prior_month,
        "scope": "United States / national / completed calendar months",
        "models": MODELS,
        "definitions": {
            "x": "MoM percentage-point change in model share of the selected Google AdOps demand/search segment",
            "y": "MoM percentage-point change in model share of its native SRS retail segment",
            "search_share": "model Google AdOps indexed opportunity volume / selected-segment Google AdOps volume",
            "retail_share": "model SRS retail units / that model's unchanged native SRS segment retail units; special segmentation never changes retail share",
            "inventory_share": "model Cloud Theory average inventory / that model's unchanged native Cloud Theory segment inventory; special segmentation never changes inventory share",
            "demand_inventory_x": "inventory share / retail share; 1.0 is parity",
            "demand_inventory_y": "search share / retail share; 1.0 is parity",
            "conversion_x": "monthly SRS retail units / average Cloud Theory inventory; Sales Velocity",
            "conversion_y": "monthly SRS retail units / Google indexed search-opportunity volume; Conversion",
            "model_matching": "exact ius_make_model for competitors; Hyundai-only nameplate rollup within the same segment",
            "governance_source": "Governance List Revised.xlsx / Full Set (149 governed model rows)"
        },
        "sources": CONFIG["sources"],
        "snapshots": snapshots,
        "monthly": monthly,
    }

    search_family_by_key = {
        (str(r["target_model"]), str(r["segment_mode"]), str(r["date_month"])[:10], str(r["family_key"])): r
        for r in search_competitors["rows"]
    }
    sales_family_by_key = {
        (str(r["target_model"]), str(r["segment_mode"]), str(r["date_month"])[:10], str(r["family_key"])): r
        for r in sales_competitors["rows"]
    }
    inventory_family_by_key = {
        (str(r["target_model"]), str(r["segment_mode"]), str(r["date_month"])[:10], str(r["family_key"])): r
        for r in inventory_competitors["rows"]
    }
    search_denominator = {
        (key[0], key[1], key[2]): float(row["segment_search_volume"])
        for key, row in search_family_by_key.items()
    }
    # The governed Google list is authoritative in special-segmentation mode.
    # Keep a Google-matched model even when SRS has no row yet (for example, a
    # pre-sale vehicle); its retail volume is correctly represented as zero.
    search_keys = set(search_family_by_key)
    sales_keys = set(sales_family_by_key)
    special_keys = {key for key in search_keys if key[1] == "special"}
    standard_keys = {key for key in search_keys | sales_keys if key[1] == "standard"}
    competitor_keys = sorted(special_keys | standard_keys)
    competitor_monthly = []
    for key in competitor_keys:
        a = search_family_by_key.get(key)
        s = sales_family_by_key.get(key)
        i = inventory_family_by_key.get(key)
        search_volume = float(a["search_volume"]) if a is not None else 0.0
        search_segment_total = search_denominator.get((key[0], key[1], key[2]))
        if not search_segment_total:
            raise ValueError(f"Missing search denominator: {key[0]} / {key[1]} / {key[2]}")
        retail_units = float(s["retail_units"]) if s is not None else 0.0
        retail_denominator = float(s["segment_retail_units"]) if s is not None else None
        retail_share = float(s["retail_share"]) if s is not None else 0.0
        source_row = a or s
        if source_row is None:
            raise ValueError(f"Missing competitor source row: {key}")
        competitor_monthly.append({
            "target_model": key[0],
            "segment_mode": key[1],
            "month": key[2],
            "family_key": key[3],
            "family": str(a["family"]) if a is not None else key[3].split("__", 1)[0],
            "segment": str(source_row["segment"]),
            "search_volume": search_volume,
            "segment_search_volume": search_segment_total,
            "search_share": search_volume / search_segment_total,
            "retail_units": retail_units,
            "segment_retail_units": retail_denominator,
            "retail_share": retail_share,
            "retail_srs_segment": str(s["srs_segment"]) if s is not None else None,
            "target_srs_segment": str(s["target_srs_segment"]) if s is not None else None,
            "retail_segment_mismatch": str(s["retail_segment_mismatch"]).casefold() == "true" if s is not None else False,
            "inventory_units": float(i["inventory_units"]) if i is not None else None,
            "segment_inventory_units": float(i["segment_inventory_units"]) if i is not None else None,
            "inventory_share": float(i["inventory_share"]) if i is not None else None,
            "inventory_srs_segment": str(i["inventory_segment"]) if i is not None else None,
            "target_inventory_segment": str(i["target_inventory_segment"]) if i is not None else None,
            "inventory_segment_mismatch": str(i["inventory_segment_mismatch"]).casefold() == "true" if i is not None else False,
        })
    for model in MODELS:
        for mode in ("special", "standard"):
            keys = {(r["month"], r["family_key"]) for r in competitor_monthly if r["target_model"] == model and r["segment_mode"] == mode}
            if not any(month == EXPECTED_MONTHS[-1] and family.startswith(series_key(model) + "__") for month, family in keys):
                raise ValueError(f"Missing target family in competitor data: {model} / {mode}")
    share_groups: dict[tuple[str, str, str], list[dict[str, Any]]] = {}
    for row in competitor_monthly:
        share_groups.setdefault((row["target_model"], row["segment_mode"], row["month"]), []).append(row)
    for group_key, rows in share_groups.items():
        search_sum = sum(float(row["search_share"]) for row in rows)
        if abs(search_sum - 1.0) > 1e-8:
            raise ValueError(
                f"Share reconciliation failed for {group_key}: "
                f"search={search_sum:.12f}"
            )
        if any(float(row["search_share"]) > 1.0 + 1e-8 or float(row["retail_share"]) > 1.0 + 1e-8 for row in rows):
            raise ValueError(f"Individual share exceeds 100% for {group_key}")
        if any(row["inventory_share"] is not None and not 0 <= float(row["inventory_share"]) <= 1.0 + 1e-8 for row in rows):
            raise ValueError(f"Invalid native-segment inventory share for {group_key}")

    # Target-family rows are allowed to remain separate when their native
    # segments differ. Within a native segment, however, special and standard
    # modes must carry identical SRS and Cloud Theory values because the search
    # segmentation toggle never changes either denominator.
    target_competitor_rows: dict[tuple[str, str, str], list[dict[str, Any]]] = {}
    for row in competitor_monthly:
        if series_key(str(row["family"])) == series_key(str(row["target_model"])):
            target_competitor_rows.setdefault(
                (str(row["target_model"]), str(row["segment_mode"]), str(row["month"])), []
            ).append(row)

    for model in MODELS:
        for month in EXPECTED_MONTHS:
            for mode in ("special", "standard"):
                matches = target_competitor_rows.get((model, mode, month), [])
                if not matches:
                    raise ValueError(
                        f"Missing target family after exact-model calculation: {model} / {mode} / {month}"
                    )
            special_by_key = {
                row["family_key"]: row for row in target_competitor_rows[(model, "special", month)]
            }
            standard_by_key = {
                row["family_key"]: row for row in target_competitor_rows[(model, "standard", month)]
            }
            for family_key in sorted(set(special_by_key) & set(standard_by_key)):
                special_target = special_by_key[family_key]
                standard_target = standard_by_key[family_key]
                for label in (
                    "retail_units", "segment_retail_units", "retail_share",
                    "inventory_units", "segment_inventory_units", "inventory_share",
                ):
                    special_value = special_target[label]
                    standard_value = standard_target[label]
                    if special_value is None or standard_value is None:
                        continue
                    if abs(float(special_value) - float(standard_value)) > 1e-8:
                        raise ValueError(
                            f"Mode changed native-segment value for {model} / {month} / {family_key} / {label}: "
                            f"special={special_value} standard={standard_value}"
                        )

    # Use the exact-first target rows as the dashboard's national target series.
    # If a nameplate appears in more than one native segment in a month, keep the
    # groups separate in competitor_monthly and use the largest current-volume
    # group for the single selected-model trend/snapshot.
    monthly_targets = {(row["model"], row["month"]): row for row in monthly}
    for model in MODELS:
        for month in EXPECTED_MONTHS:
            current = monthly_targets[(model, month)]
            special_targets = target_competitor_rows[(model, "special", month)]
            standard_targets = target_competitor_rows[(model, "standard", month)]
            special_search = max(special_targets, key=lambda row: float(row["search_volume"]))
            standard_search = max(standard_targets, key=lambda row: float(row["search_volume"]))
            retail_target = max(special_targets, key=lambda row: float(row["retail_units"]))
            current.update({
                "search_volume": special_search["search_volume"],
                "segment_search_volume": special_search["segment_search_volume"],
                "search_share": special_search["search_share"],
                "standard_segment_search_volume": standard_search["segment_search_volume"],
                "standard_search_share": standard_search["search_share"],
                "retail_units": retail_target["retail_units"],
                "segment_retail_units": retail_target["segment_retail_units"],
                "retail_share": retail_target["retail_share"],
                "standard_segment_retail_units": retail_target["segment_retail_units"],
                "standard_retail_share": retail_target["retail_share"],
            })
    current_month, prior_month = EXPECTED_MONTHS[-1], EXPECTED_MONTHS[-2]
    output["snapshots"] = []
    for model in MODELS:
        current = monthly_targets[(model, current_month)]
        prior = monthly_targets[(model, prior_month)]
        output["snapshots"].append({
            **current,
            "prior_month": prior_month,
            "prior_search_share": prior["search_share"],
            "prior_retail_share": prior["retail_share"],
            "search_share_mom_pp": (current["search_share"] - prior["search_share"]) * 100,
            "retail_share_mom_pp": (current["retail_share"] - prior["retail_share"]) * 100,
        })
    output["competitor_monthly"] = competitor_monthly

    regional_search_by_key = {
        (str(r["target_model"]), str(r["segment_mode"]), str(r["date_month"])[:10], str(r["region_cd"])): r
        for r in regional_search["rows"]
    }
    regional_sales_by_key = {
        (str(r["target_model"]), str(r["segment_mode"]), str(r["date_month"])[:10], str(r["region_cd"])): r
        for r in regional_sales["rows"]
    }
    standard_regional_sales = {
        (key[0], key[2], key[3]): row
        for key, row in regional_sales_by_key.items()
        if key[1] == "standard"
    }
    regional_monthly = []
    for key in sorted(set(regional_search_by_key) & set(regional_sales_by_key)):
        a, s = regional_search_by_key[key], regional_sales_by_key[key]
        standard_s = standard_regional_sales.get((key[0], key[2], key[3]))
        if standard_s is None:
            raise ValueError(f"Missing standard regional SRS row: {key[0]} / {key[2]} / {key[3]}")
        regional_monthly.append({
            "model": key[0],
            "segment_mode": key[1],
            "month": key[2],
            "region_cd": key[3],
            "region": str(a["region"]),
            "search_volume": float(a["model_search_volume"]),
            "segment_search_volume": float(a["segment_search_volume"]),
            "search_share": float(a["search_share"]),
            "retail_units": float(standard_s["model_retail_units"]),
            "segment_retail_units": float(standard_s["segment_retail_units"]),
            "retail_share": float(standard_s["retail_share"]),
        })
    expected_regional = len(MODELS) * 2 * len(EXPECTED_MONTHS) * 8
    if len(regional_monthly) != expected_regional:
        raise ValueError(f"Unexpected regional coverage: rows={len(regional_monthly)} expected={expected_regional}")
    displayed_region_codes = {str(row["region_cd"]) for row in regional_monthly}
    expected_displayed_region_codes = {"NTL", "CE", "EA", "MA", "MS", "SC", "SO", "WE"}
    if displayed_region_codes != expected_displayed_region_codes:
        raise ValueError(
            "Unexpected displayed regional codes: "
            f"actual={sorted(displayed_region_codes)} expected={sorted(expected_displayed_region_codes)}"
        )
    if any(str(row["region_cd"]) == "NH" for row in regional_monthly):
        raise ValueError("NH must contribute to rollups but must not appear in regional display data")
    output["regional_monthly"] = regional_monthly
    rendered = json.dumps(output, indent=2)
    (processed_dir / "quadchart.json").write_text(rendered, encoding="utf-8")
    (public_dir / "quadchart.json").write_text(rendered, encoding="utf-8")

    with (processed_dir / "quadchart_monthly.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(monthly[0]))
        writer.writeheader()
        writer.writerows(monthly)
    print(json.dumps({"models": len(MODELS), "monthly_rows": len(monthly), "regional_rows": len(regional_monthly), "current_month": current_month, "output": str(processed_dir / "quadchart.json")}, indent=2))


if __name__ == "__main__":
    main()
