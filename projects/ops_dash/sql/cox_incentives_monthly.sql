-- Cox incentive metrics for Genesis, January 2025 onward.
-- Incentive PNV is inventory-weighted across models. Incentive index compares
-- each Genesis model with the inventory-weighted incentive in its segment,
-- then rolls those model indices to the brand using Genesis inventory.

WITH latest_complete AS (
  SELECT MAX(date_month) AS date_month
  FROM ius_unity_prod.sandbox.agent_coxautomotive
  WHERE LOWER(ius_make) = 'genesis'
    AND inventory_available > 0
),
base AS (
  SELECT
    CAST(date_month AS DATE) AS date_month,
    LOWER(TRIM(ius_make)) AS make,
    LOWER(TRIM(ius_make_model)) AS make_model,
    TRIM(ius_srs_segment) AS segment,
    COALESCE(incentives_blended, 0) AS incentive_pnv,
    COALESCE(inventory_available, 0) AS inventory_available
  FROM ius_unity_prod.sandbox.agent_coxautomotive
  WHERE date_month >= DATE '2025-01-01'
    AND date_month <= (SELECT date_month FROM latest_complete)
),
segment_benchmark AS (
  SELECT
    date_month,
    segment,
    SUM(incentive_pnv * inventory_available) / NULLIF(SUM(inventory_available), 0) AS benchmark_pnv
  FROM base
  GROUP BY date_month, segment
),
genesis_model AS (
  SELECT
    b.date_month,
    b.make_model,
    b.segment,
    b.incentive_pnv,
    b.inventory_available,
    100 * b.incentive_pnv / NULLIF(s.benchmark_pnv, 0) AS incentive_index
  FROM base b
  INNER JOIN segment_benchmark s
    ON b.date_month = s.date_month
   AND b.segment = s.segment
  WHERE b.make = 'genesis'
),
metrics AS (
  SELECT
    date_month,
    'Brand' AS entity_level,
    'Genesis' AS brand,
    'genesis' AS model_series,
    'Genesis' AS display_name,
    'All Genesis models' AS segment,
    SUM(incentive_pnv * inventory_available) / NULLIF(SUM(inventory_available), 0) AS incentive_pnv,
    SUM(incentive_index * inventory_available) / NULLIF(SUM(inventory_available), 0) AS incentive_index
  FROM genesis_model
  GROUP BY date_month

  UNION ALL

  SELECT
    date_month,
    'Model' AS entity_level,
    'Genesis' AS brand,
    make_model AS model_series,
    UPPER(REGEXP_REPLACE(make_model, '^genesis_', '')) AS display_name,
    segment,
    incentive_pnv,
    incentive_index
  FROM genesis_model
),
with_comparisons AS (
  SELECT
    *,
    LAG(incentive_pnv, 1) OVER (PARTITION BY entity_level, model_series ORDER BY date_month) AS prior_month_pnv,
    LAG(incentive_pnv, 12) OVER (PARTITION BY entity_level, model_series ORDER BY date_month) AS prior_year_pnv,
    LAG(incentive_index, 1) OVER (PARTITION BY entity_level, model_series ORDER BY date_month) AS prior_month_index,
    LAG(incentive_index, 12) OVER (PARTITION BY entity_level, model_series ORDER BY date_month) AS prior_year_index
  FROM metrics
)
SELECT
  date_month,
  'National' AS geo_level,
  'NTL' AS region_code,
  'National' AS region_name,
  entity_level,
  brand,
  model_series,
  display_name,
  segment,
  incentive_pnv,
  incentive_index,
  CASE WHEN prior_month_pnv > 0 THEN incentive_pnv / prior_month_pnv - 1 END AS incentive_pnv_mom_pct,
  CASE WHEN prior_year_pnv > 0 THEN incentive_pnv / prior_year_pnv - 1 END AS incentive_pnv_yoy_pct,
  CASE WHEN prior_month_index IS NOT NULL THEN incentive_index - prior_month_index END AS incentive_index_mom_delta,
  CASE WHEN prior_year_index IS NOT NULL THEN incentive_index - prior_year_index END AS incentive_index_yoy_delta
FROM with_comparisons
ORDER BY date_month, entity_level, display_name;
