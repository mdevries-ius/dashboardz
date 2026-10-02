-- Continental U.S. DMA polygon reference used to clip the national heat surface.

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
  FROM ius_unity_prod.cloudtheory_datawarehouse.dim_dma
  WHERE primary_state IN (
    'AL','AZ','AR','CA','CO','CT','DE','FL','GA','ID','IL','IN','IA','KS','KY','LA',
    'ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND',
    'OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC'
  )
)
  AND g.latitude BETWEEN 24 AND 50
  AND g.longitude BETWEEN -125 AND -66
ORDER BY g.dma_id, g.sub_polygon_id, g.point_of_order;
