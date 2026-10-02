-- Retail allocation by advertised-price band.
-- Each nameplate is assigned to a band using its inventory-weighted advertised
-- price.  This is intentionally a nameplate-price proxy until trim-level
-- retail sales are available.

WITH priced_trim_inventory AS (
  SELECT
    CAST(month AS DATE) AS date_month,
    TRIM(ius_segment) AS segment,
    LOWER(TRIM(ius_make)) AS make,
    LOWER(TRIM(ius_model)) AS model,
    SUM(COALESCE(avg_inventory, 0)) AS average_inventory,
    SUM(CASE WHEN avg_price > 0 THEN avg_price * COALESCE(avg_inventory, 0) ELSE 0 END) AS advertised_price_inventory_value,
    SUM(CASE WHEN avg_price > 0 THEN COALESCE(avg_inventory, 0) ELSE 0 END) AS priced_inventory
  FROM ius_unity_prod.cloudtheory_datamart.inv_by_dma_monthly
  WHERE month >= DATE '2025-01-01'
    AND location_status = 'In Stock'
    AND ius_segment IS NOT NULL
    AND ius_make IS NOT NULL
    AND ius_model IS NOT NULL
  GROUP BY ALL
),
genesis_segments AS (
  SELECT DISTINCT date_month, segment
  FROM priced_trim_inventory
  WHERE make = 'genesis'
    AND average_inventory > 0
),
priced_nameplates AS (
  SELECT
    p.date_month,
    p.segment,
    p.make,
    p.model,
    p.average_inventory,
    p.advertised_price_inventory_value / NULLIF(p.priced_inventory, 0) AS weighted_advertised_price
  FROM priced_trim_inventory p
  INNER JOIN genesis_segments g
    ON p.date_month = g.date_month
   AND p.segment = g.segment
  WHERE p.average_inventory > 0
    AND p.priced_inventory > 0
),
srs_sales AS (
  SELECT
    CAST(date_month AS DATE) AS date_month,
    TRIM(ius_srs_segment) AS segment,
    LOWER(TRIM(ius_make)) AS make,
    LOWER(TRIM(ius_model_series)) AS model,
    SUM(COALESCE(srs_sales_volume, 0)) AS retail_sales
  FROM ius_unity_prod.sandbox.agent_srs
  WHERE date_month >= DATE '2025-01-01'
    AND sales_region_cd IN ('CE', 'EA', 'MA', 'MS', 'SC', 'SO', 'WE')
    AND ius_srs_segment IS NOT NULL
    AND ius_make IS NOT NULL
    AND ius_model_series IS NOT NULL
  GROUP BY ALL
)
SELECT
  p.date_month,
  p.segment,
  p.make,
  p.model,
  p.average_inventory,
  p.weighted_advertised_price,
  COALESCE(s.retail_sales, 0) AS retail_sales
FROM priced_nameplates p
LEFT JOIN srs_sales s
  ON p.date_month = s.date_month
 AND p.segment = s.segment
 AND p.make = s.make
 AND p.model = s.model
ORDER BY p.date_month, p.segment, p.make, p.model;
