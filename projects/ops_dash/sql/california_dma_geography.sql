-- Static DMA polygon reference for California and cross-state California DMAs.

SELECT
  g.dma_id,
  g.dma_name,
  g.latitude,
  g.longitude,
  g.sub_polygon_id,
  g.point_of_order
FROM ius_unity_prod.ius_datawarehouse.dimension_dmaregions_tableau_geocode g
WHERE g.dma_id IN (
  SELECT DISTINCT CAST(ius_dma_cd AS BIGINT)
  FROM ius_unity_prod.cloudtheory_datamart.inv_by_dma_monthly
  WHERE ius_dma_name_state LIKE '%, CA%'
)
  AND g.latitude IS NOT NULL
  AND g.longitude IS NOT NULL
ORDER BY g.dma_id, g.sub_polygon_id, g.point_of_order;
