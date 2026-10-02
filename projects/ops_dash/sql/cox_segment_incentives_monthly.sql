-- Model-level Cox incentive comparison set for every segment containing a
-- Genesis model. The index denominator is the inventory-weighted incentive
-- PNV for all vehicles in the same segment and month.

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
  WHERE date_month >= DATE '2024-01-01'
    AND date_month <= (SELECT date_month FROM latest_complete)
),
genesis_segments AS (
  SELECT DISTINCT date_month, segment
  FROM base
  WHERE make = 'genesis'
),
segment_benchmark AS (
  SELECT
    b.date_month,
    b.segment,
    SUM(b.incentive_pnv * b.inventory_available) / NULLIF(SUM(b.inventory_available), 0) AS benchmark_pnv
  FROM base b
  INNER JOIN genesis_segments g
    ON b.date_month = g.date_month
   AND b.segment = g.segment
  GROUP BY b.date_month, b.segment
),
metrics AS (
  SELECT
    b.date_month,
    b.segment,
    b.make,
    b.make_model,
    b.incentive_pnv,
    100 * b.incentive_pnv / NULLIF(s.benchmark_pnv, 0) AS incentive_index
  FROM base b
  INNER JOIN segment_benchmark s
    ON b.date_month = s.date_month
   AND b.segment = s.segment
)
SELECT
  current.date_month,
  current.segment,
  current.make,
  current.make_model,
  current.incentive_pnv,
  current.incentive_index,
  CASE WHEN prior_month.incentive_pnv > 0 THEN current.incentive_pnv / prior_month.incentive_pnv - 1 END AS incentive_pnv_mom_pct,
  CASE WHEN prior_year.incentive_pnv > 0 THEN current.incentive_pnv / prior_year.incentive_pnv - 1 END AS incentive_pnv_yoy_pct,
  current.incentive_index - prior_month.incentive_index AS incentive_index_mom_delta,
  current.incentive_index - prior_year.incentive_index AS incentive_index_yoy_delta
FROM metrics current
LEFT JOIN metrics prior_month
  ON current.make_model = prior_month.make_model
 AND current.segment = prior_month.segment
 AND prior_month.date_month = ADD_MONTHS(current.date_month, -1)
LEFT JOIN metrics prior_year
  ON current.make_model = prior_year.make_model
 AND current.segment = prior_year.segment
 AND prior_year.date_month = ADD_MONTHS(current.date_month, -12)
WHERE current.date_month >= DATE '2025-01-01'
ORDER BY current.date_month, current.segment, current.incentive_index DESC, current.make_model;
