-- National in-stock trim inventory and inventory-weighted advertised price.
-- Retains all nameplates in segments where Genesis has inventory so the UI can
-- compare a selected Genesis nameplate's price-band allocation with its peers.

WITH priced_trim_inventory AS (
  SELECT
    CAST(month AS DATE) AS date_month,
    TRIM(ius_segment) AS segment,
    LOWER(TRIM(ius_make)) AS make,
    LOWER(TRIM(ius_model)) AS model,
    COALESCE(NULLIF(TRIM(trim), ''), 'Unspecified trim') AS trim,
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
)
SELECT
  p.date_month,
  p.segment,
  p.make,
  p.model,
  p.trim,
  p.average_inventory,
  p.advertised_price_inventory_value / NULLIF(p.priced_inventory, 0) AS weighted_advertised_price
FROM priced_trim_inventory p
INNER JOIN genesis_segments g
  ON p.date_month = g.date_month
 AND p.segment = g.segment
WHERE p.average_inventory > 0
  AND p.priced_inventory > 0
ORDER BY p.date_month, p.segment, p.make, p.model, p.trim;
