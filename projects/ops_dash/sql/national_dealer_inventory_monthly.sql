-- Continental U.S. monthly Genesis average inventory by geocoded dealer.

SELECT
  i.month,
  i.seller_id,
  d.name AS dealer_name,
  d.city,
  d.state_province,
  d.postal_code,
  d.dma_code,
  d.dma AS dma_name,
  d.latitude,
  d.longitude,
  SUM(COALESCE(i.avg_inventory, 0)) AS average_inventory
FROM ius_unity_prod.cloudtheory_datalake.raw_cloudtheory_seller_inv_daily i
INNER JOIN ius_unity_prod.cloudtheory_datawarehouse.dim_seller d
  ON i.seller_id = d.seller_id
WHERE i.month >= DATE '2025-01-01'
  AND LOWER(TRIM(i.make)) = 'genesis'
  AND d.state_province IN (
    'AL','AZ','AR','CA','CO','CT','DE','FL','GA','ID','IL','IN','IA','KS','KY','LA',
    'ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND',
    'OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC'
  )
  AND d.latitude IS NOT NULL
  AND d.longitude IS NOT NULL
GROUP BY ALL
ORDER BY i.month, average_inventory DESC, dealer_name;
