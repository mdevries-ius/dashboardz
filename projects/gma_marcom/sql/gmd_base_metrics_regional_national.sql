-- Genesis governance base metrics at Regional and National model grain.
-- Regional rows use the DMA's existing parent_region_code.

WITH date_spine AS (
  SELECT EXPLODE(
    SEQUENCE(DATE '2021-01-01', DATE '2026-12-01', INTERVAL 1 MONTH)
  ) AS date_month
),

native_dma AS (
  SELECT
    CAST(date_month AS DATE) AS date_month,
    segment,
    make,
    model,
    make_model,
    model_family,
    parent_region_code,
    visits,
    hvas,
    mvas,
    vdp_t1,
    shift_t3_vdp_views
  FROM ius_unity_prod.governance_datamart.gmd_cmo_map_market_model_daily_rollup
  WHERE LOWER(make) = 'genesis'
    AND LOWER(region_type) = 'dma'
),

model_dimensions AS (
  SELECT DISTINCT segment, make, model, make_model, model_family
  FROM native_dma
),

valid_regions AS (
  SELECT DISTINCT CAST(parent_region_code AS STRING) AS region_code
  FROM native_dma
  WHERE parent_region_code IS NOT NULL
    AND LOWER(CAST(parent_region_code AS STRING)) <> 'unassigned'
),

target_grain AS (
  SELECT
    m.*,
    'National' AS region_name,
    'US' AS region_code
  FROM model_dimensions AS m

  UNION ALL

  SELECT
    m.*,
    r.region_code AS region_name,
    r.region_code
  FROM model_dimensions AS m
  CROSS JOIN valid_regions AS r
),

regional_rollup AS (
  SELECT
    date_month,
    segment,
    make,
    model,
    make_model,
    model_family,
    CAST(parent_region_code AS STRING) AS region_name,
    CAST(parent_region_code AS STRING) AS region_code,
    SUM(visits) AS visits,
    SUM(hvas) AS hvas,
    SUM(mvas) AS mvas,
    SUM(vdp_t1) AS vdp_t1,
    SUM(shift_t3_vdp_views) AS shift_t3_vdp_views
  FROM native_dma
  WHERE parent_region_code IS NOT NULL
    AND LOWER(CAST(parent_region_code AS STRING)) <> 'unassigned'
  GROUP BY
    date_month,
    segment,
    make,
    model,
    make_model,
    model_family,
    parent_region_code
),

national_rollup AS (
  SELECT
    date_month,
    segment,
    make,
    model,
    make_model,
    model_family,
    'National' AS region_name,
    'US' AS region_code,
    SUM(visits) AS visits,
    SUM(hvas) AS hvas,
    SUM(mvas) AS mvas,
    SUM(vdp_t1) AS vdp_t1,
    SUM(shift_t3_vdp_views) AS shift_t3_vdp_views
  FROM native_dma
  GROUP BY date_month, segment, make, model, make_model, model_family
),

rollups AS (
  SELECT * FROM regional_rollup
  UNION ALL
  SELECT * FROM national_rollup
)

SELECT
  d.date_month,
  t.segment,
  t.make,
  t.model,
  t.make_model,
  t.model_family,
  t.region_name,
  t.region_code,
  r.visits,
  r.hvas,
  r.mvas,
  r.vdp_t1,
  r.shift_t3_vdp_views
FROM date_spine AS d
CROSS JOIN target_grain AS t
LEFT JOIN rollups AS r
  ON r.date_month = d.date_month
 AND r.segment <=> t.segment
 AND r.make <=> t.make
 AND r.model <=> t.model
 AND r.make_model <=> t.make_model
 AND r.model_family <=> t.model_family
 AND r.region_code = t.region_code
ORDER BY d.date_month, t.region_code, t.model;
