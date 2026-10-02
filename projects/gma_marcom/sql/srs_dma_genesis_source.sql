SELECT
  CAST(date_month AS DATE) AS date_month,
  ius_dma_name,
  ius_adi_region_description,
  ius_adi_region,
  ius_make,
  ius_make_model,
  ius_make_model_group,
  ius_srs_segment,
  ius_srs_current_sales_flag,
  ius_make_only_flag,
  ius_srs_luxury_flag,
  ius_srs_cartruck_detail,
  ius_srs_cartruck,
  ius_competitive_set,
  ius_competitive_set_srs_sales,
  srs_sales_volume
FROM ius_unity_prod.srs_datamart.srs_sales_dma_model_monthly
WHERE LOWER(ius_make) = 'genesis'
  AND date_month >= DATE '2021-01-01'
  AND date_month < DATE '2027-01-01'
ORDER BY date_month, ius_adi_region, ius_dma_name, ius_make_model;
