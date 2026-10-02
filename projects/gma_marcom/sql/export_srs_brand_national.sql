-- National Genesis Brand SRS sales for the one-off media correlation dataset.
-- Includes every Genesis DMA/model row, including unassigned DMA and
-- VIN-undecoded Genesis sales.

SELECT
  CAST(date_month AS DATE) AS date_month,
  'National' AS geo_type,
  'NTL' AS region_code,
  'Genesis' AS brand,
  'Brand' AS model,
  SUM(srs_sales_volume) AS srs_sales_volume
FROM ius_unity_prod.srs_datamart.srs_sales_dma_model_monthly
WHERE LOWER(TRIM(ius_make)) = 'genesis'
GROUP BY CAST(date_month AS DATE)
ORDER BY date_month;
