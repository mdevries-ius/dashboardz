-- California proof-of-concept: monthly Genesis average inventory by DMA.
-- Includes cross-state DMA labels that contain a California component.

SELECT
  month,
  ius_dma_cd,
  ius_dma_name_state,
  SUM(COALESCE(avg_inventory, 0)) AS average_inventory
FROM ius_unity_prod.cloudtheory_datamart.inv_by_dma_monthly
WHERE month >= DATE '2025-01-01'
  AND LOWER(TRIM(ius_make)) = 'genesis'
  AND ius_dma_name_state LIKE '%, CA%'
GROUP BY ALL
ORDER BY month, average_inventory DESC, ius_dma_name_state;
