-- CloudTheory peer-model metrics for segments containing a Genesis model.
-- Includes the seven dashboard regions and their combined national view.

WITH cloud_region AS (
  SELECT
    CAST(date_month AS DATE) AS date_month,
    'Region' AS geo_level,
    sales_region_cd AS region_code,
    LOWER(TRIM(ius_make)) AS make,
    ius_model_series AS model_series,
    ius_srs_segment AS segment,
    SUM(COALESCE(avginventory, 0)) AS average_inventory,
    SUM(CASE WHEN avg_msrp > 0 THEN avg_msrp * COALESCE(avginventory, 0) ELSE 0 END) AS msrp_inventory_value,
    SUM(CASE WHEN avg_msrp > 0 THEN COALESCE(avginventory, 0) ELSE 0 END) AS msrp_inventory_units,
    SUM(CASE WHEN avg_price > 0 THEN avg_price * COALESCE(avginventory, 0) ELSE 0 END) AS price_inventory_value,
    SUM(CASE WHEN avg_price > 0 THEN COALESCE(avginventory, 0) ELSE 0 END) AS price_inventory_units
  FROM ius_unity_prod.sandbox.agent_cloudtheory
  WHERE date_month >= DATE '2024-01-01'
    AND sales_region_cd IN ('CE', 'EA', 'MA', 'MS', 'SC', 'SO', 'WE')
    AND ius_model_series IS NOT NULL
    AND ius_srs_segment IS NOT NULL
  GROUP BY ALL
),
cloud AS (
  SELECT * FROM cloud_region
  UNION ALL
  SELECT
    date_month,
    'National' AS geo_level,
    'NTL' AS region_code,
    make,
    model_series,
    segment,
    SUM(average_inventory) AS average_inventory,
    SUM(msrp_inventory_value) AS msrp_inventory_value,
    SUM(msrp_inventory_units) AS msrp_inventory_units,
    SUM(price_inventory_value) AS price_inventory_value,
    SUM(price_inventory_units) AS price_inventory_units
  FROM cloud_region
  GROUP BY ALL
),
genesis_segments AS (
  SELECT DISTINCT date_month, geo_level, region_code, segment
  FROM cloud
  WHERE make = 'genesis'
),
segment_benchmark AS (
  SELECT
    c.date_month,
    c.geo_level,
    c.region_code,
    c.segment,
    SUM(c.average_inventory) AS segment_average_inventory,
    SUM(c.msrp_inventory_value) / NULLIF(SUM(c.msrp_inventory_units), 0) AS segment_weighted_msrp,
    SUM(c.price_inventory_value) / NULLIF(SUM(c.price_inventory_units), 0) AS segment_weighted_price
  FROM cloud c
  INNER JOIN genesis_segments g
    ON c.date_month = g.date_month
   AND c.geo_level = g.geo_level
   AND c.region_code = g.region_code
   AND c.segment = g.segment
  GROUP BY ALL
),
metrics AS (
  SELECT
    c.date_month,
    c.geo_level,
    c.region_code,
    c.segment,
    c.make,
    c.model_series,
    c.average_inventory,
    c.msrp_inventory_value / NULLIF(c.msrp_inventory_units, 0) AS weighted_avg_msrp,
    c.price_inventory_value / NULLIF(c.price_inventory_units, 0) AS weighted_avg_price,
    c.average_inventory / NULLIF(b.segment_average_inventory, 0) AS inventory_share,
    (c.msrp_inventory_value / NULLIF(c.msrp_inventory_units, 0)) / NULLIF(b.segment_weighted_msrp, 0) * 100 AS msrp_index,
    (c.price_inventory_value / NULLIF(c.price_inventory_units, 0)) / NULLIF(b.segment_weighted_price, 0) * 100 AS price_index
  FROM cloud c
  INNER JOIN segment_benchmark b
    ON c.date_month = b.date_month
   AND c.geo_level = b.geo_level
   AND c.region_code = b.region_code
   AND c.segment = b.segment
  WHERE c.average_inventory > 0
)
SELECT
  current.date_month,
  current.geo_level,
  current.region_code,
  CASE current.region_code
    WHEN 'NTL' THEN 'National'
    WHEN 'CE' THEN 'Central'
    WHEN 'EA' THEN 'Eastern'
    WHEN 'MA' THEN 'Mid-Atlantic'
    WHEN 'MS' THEN 'Mountain States'
    WHEN 'SC' THEN 'South Central'
    WHEN 'SO' THEN 'Southern'
    WHEN 'WE' THEN 'Western'
  END AS region_name,
  current.segment,
  current.make,
  current.model_series,
  current.average_inventory,
  current.inventory_share,
  current.weighted_avg_msrp,
  current.msrp_index,
  current.weighted_avg_price,
  current.price_index,
  current.inventory_share - prior_month.inventory_share AS inventory_share_mom_pp,
  current.inventory_share - prior_year.inventory_share AS inventory_share_yoy_pp,
  current.msrp_index - prior_month.msrp_index AS msrp_index_mom_delta,
  current.msrp_index - prior_year.msrp_index AS msrp_index_yoy_delta
  , current.price_index - prior_month.price_index AS price_index_mom_delta
  , current.price_index - prior_year.price_index AS price_index_yoy_delta
FROM metrics current
LEFT JOIN metrics prior_month
  ON current.geo_level = prior_month.geo_level
 AND current.region_code = prior_month.region_code
 AND current.model_series = prior_month.model_series
 AND current.segment = prior_month.segment
 AND prior_month.date_month = ADD_MONTHS(current.date_month, -1)
LEFT JOIN metrics prior_year
  ON current.geo_level = prior_year.geo_level
 AND current.region_code = prior_year.region_code
 AND current.model_series = prior_year.model_series
 AND current.segment = prior_year.segment
 AND prior_year.date_month = ADD_MONTHS(current.date_month, -12)
WHERE current.date_month >= DATE '2025-01-01'
ORDER BY current.date_month, current.geo_level DESC, current.region_code, current.segment, current.inventory_share DESC;
