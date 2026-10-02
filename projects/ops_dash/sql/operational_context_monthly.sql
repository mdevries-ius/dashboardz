-- GMA operational-context source, January 2025 onward.
-- Geography is limited to the seven region codes shared by CloudTheory and SRS.
-- Brand SOI/SOM use the Genesis competitive-segment universe as the denominator.
-- Model SOI/SOM use each model series' SRS segment as the denominator.

WITH cloud_region AS (
  SELECT
    CAST(date_month AS DATE) AS date_month,
    'Region' AS geo_level,
    sales_region_cd AS region_code,
    LOWER(TRIM(ius_make)) AS make,
    ius_model_series AS model_series,
    ius_srs_segment AS segment,
    ius_srs_luxury_flag AS luxury_flag,
    SUM(COALESCE(avginventory, 0)) AS average_inventory,
    SUM(CASE WHEN avg_msrp > 0 THEN avg_msrp * COALESCE(avginventory, 0) ELSE 0 END)
      AS msrp_inventory_value,
    SUM(CASE WHEN avg_msrp > 0 THEN COALESCE(avginventory, 0) ELSE 0 END)
      AS msrp_inventory_units,
    SUM(CASE WHEN avg_price > 0 THEN avg_price * COALESCE(avginventory, 0) ELSE 0 END)
      AS price_inventory_value,
    SUM(CASE WHEN avg_price > 0 THEN COALESCE(avginventory, 0) ELSE 0 END)
      AS price_inventory_units
  FROM ius_unity_prod.sandbox.agent_cloudtheory
  WHERE date_month >= DATE '2025-01-01'
    AND sales_region_cd IN ('CE', 'EA', 'MA', 'MS', 'SC', 'SO', 'WE')
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
    luxury_flag,
    SUM(average_inventory) AS average_inventory,
    SUM(msrp_inventory_value) AS msrp_inventory_value,
    SUM(msrp_inventory_units) AS msrp_inventory_units,
    SUM(price_inventory_value) AS price_inventory_value,
    SUM(price_inventory_units) AS price_inventory_units
  FROM cloud_region
  GROUP BY ALL
),
competitive_segments AS (
  -- Use the exact segment universe in which Genesis has available inventory,
  -- then apply that same universe to both the SOI and SOM denominators.
  SELECT DISTINCT
    date_month,
    geo_level,
    region_code,
    segment
  FROM cloud
  WHERE make = 'genesis'
    AND luxury_flag = 'Y'
    AND segment IS NOT NULL
),
cloud_competitive AS (
  SELECT c.*
  FROM cloud c
  INNER JOIN competitive_segments scope
    ON c.date_month = scope.date_month
   AND c.geo_level = scope.geo_level
   AND c.region_code = scope.region_code
   AND c.segment = scope.segment
),
cloud_brand AS (
  SELECT
    date_month,
    geo_level,
    region_code,
    SUM(CASE WHEN make = 'genesis' AND luxury_flag = 'Y' THEN average_inventory ELSE 0 END)
      AS average_inventory,
    SUM(CASE WHEN luxury_flag = 'Y' THEN average_inventory ELSE 0 END)
      AS market_average_inventory,
    SUM(CASE WHEN make = 'genesis' AND luxury_flag = 'Y' THEN msrp_inventory_value ELSE 0 END)
      / NULLIF(SUM(CASE WHEN make = 'genesis' AND luxury_flag = 'Y' THEN msrp_inventory_units ELSE 0 END), 0)
      AS weighted_avg_msrp,
    SUM(CASE WHEN luxury_flag = 'Y' THEN msrp_inventory_value ELSE 0 END)
      / NULLIF(SUM(CASE WHEN luxury_flag = 'Y' THEN msrp_inventory_units ELSE 0 END), 0)
      AS market_weighted_avg_msrp,
    SUM(CASE WHEN make = 'genesis' AND luxury_flag = 'Y' THEN price_inventory_value ELSE 0 END)
      / NULLIF(SUM(CASE WHEN make = 'genesis' AND luxury_flag = 'Y' THEN price_inventory_units ELSE 0 END), 0)
      AS weighted_avg_price,
    SUM(CASE WHEN luxury_flag = 'Y' THEN price_inventory_value ELSE 0 END)
      / NULLIF(SUM(CASE WHEN luxury_flag = 'Y' THEN price_inventory_units ELSE 0 END), 0)
      AS market_weighted_avg_price
  FROM cloud_competitive
  GROUP BY ALL
),
cloud_model_num AS (
  SELECT
    date_month,
    geo_level,
    region_code,
    model_series,
    segment,
    SUM(average_inventory) AS average_inventory,
    SUM(msrp_inventory_value) / NULLIF(SUM(msrp_inventory_units), 0) AS weighted_avg_msrp,
    SUM(price_inventory_value) / NULLIF(SUM(price_inventory_units), 0) AS weighted_avg_price
  FROM cloud
  WHERE make = 'genesis'
    AND model_series IS NOT NULL
    AND segment IS NOT NULL
  GROUP BY ALL
),
cloud_model_den AS (
  SELECT
    date_month,
    geo_level,
    region_code,
    segment,
    SUM(average_inventory) AS market_average_inventory,
    SUM(msrp_inventory_value) / NULLIF(SUM(msrp_inventory_units), 0) AS market_weighted_avg_msrp,
    SUM(price_inventory_value) / NULLIF(SUM(price_inventory_units), 0) AS market_weighted_avg_price
  FROM cloud
  WHERE segment IS NOT NULL
  GROUP BY ALL
),
cloud_model AS (
  SELECT
    n.date_month,
    n.geo_level,
    n.region_code,
    n.model_series,
    n.segment,
    n.average_inventory,
    d.market_average_inventory,
    n.weighted_avg_msrp,
    d.market_weighted_avg_msrp,
    n.weighted_avg_price,
    d.market_weighted_avg_price
  FROM cloud_model_num n
  INNER JOIN cloud_model_den d
    ON n.date_month = d.date_month
   AND n.geo_level = d.geo_level
   AND n.region_code = d.region_code
   AND n.segment = d.segment
),
srs_region AS (
  SELECT
    CAST(date_month AS DATE) AS date_month,
    'Region' AS geo_level,
    sales_region_cd AS region_code,
    LOWER(TRIM(ius_make)) AS make,
    ius_model_series AS model_series,
    ius_srs_segment AS segment,
    ius_srs_luxury_flag AS luxury_flag,
    SUM(COALESCE(srs_sales_volume, 0)) AS retail_sales
  FROM ius_unity_prod.sandbox.agent_srs
  WHERE date_month >= DATE '2025-01-01'
    AND sales_region_cd IN ('CE', 'EA', 'MA', 'MS', 'SC', 'SO', 'WE')
  GROUP BY ALL
),
srs AS (
  SELECT * FROM srs_region
  UNION ALL
  SELECT
    date_month,
    'National' AS geo_level,
    'NTL' AS region_code,
    make,
    model_series,
    segment,
    luxury_flag,
    SUM(retail_sales) AS retail_sales
  FROM srs_region
  GROUP BY ALL
),
srs_competitive AS (
  SELECT s.*
  FROM srs s
  INNER JOIN competitive_segments scope
    ON s.date_month = scope.date_month
   AND s.geo_level = scope.geo_level
   AND s.region_code = scope.region_code
   AND s.segment = scope.segment
),
srs_brand AS (
  SELECT
    date_month,
    geo_level,
    region_code,
    SUM(CASE WHEN make = 'genesis' AND luxury_flag = 'Y' THEN retail_sales ELSE 0 END)
      AS retail_sales,
    SUM(CASE WHEN luxury_flag = 'Y' THEN retail_sales ELSE 0 END)
      AS market_retail_sales
  FROM srs_competitive
  GROUP BY ALL
),
srs_model_num AS (
  SELECT
    date_month,
    geo_level,
    region_code,
    model_series,
    segment,
    SUM(retail_sales) AS retail_sales
  FROM srs
  WHERE make = 'genesis'
    AND model_series IS NOT NULL
    AND segment IS NOT NULL
  GROUP BY ALL
),
srs_model_den AS (
  SELECT
    date_month,
    geo_level,
    region_code,
    segment,
    SUM(retail_sales) AS market_retail_sales
  FROM srs
  WHERE segment IS NOT NULL
  GROUP BY ALL
),
srs_model AS (
  SELECT
    n.date_month,
    n.geo_level,
    n.region_code,
    n.model_series,
    n.segment,
    n.retail_sales,
    d.market_retail_sales
  FROM srs_model_num n
  INNER JOIN srs_model_den d
    ON n.date_month = d.date_month
   AND n.geo_level = d.geo_level
   AND n.region_code = d.region_code
   AND n.segment = d.segment
),
combined AS (
  SELECT
    c.date_month,
    c.geo_level,
    c.region_code,
    'Brand' AS entity_level,
    'Genesis' AS brand,
    'brand' AS model_series,
    'Genesis' AS display_name,
    'Luxury Market' AS segment,
    c.average_inventory,
    c.market_average_inventory,
    c.weighted_avg_msrp,
    c.market_weighted_avg_msrp,
    c.weighted_avg_price,
    c.market_weighted_avg_price,
    s.retail_sales,
    s.market_retail_sales
  FROM cloud_brand c
  INNER JOIN srs_brand s
    ON c.date_month = s.date_month
   AND c.geo_level = s.geo_level
   AND c.region_code = s.region_code

  UNION ALL

  SELECT
    c.date_month,
    c.geo_level,
    c.region_code,
    'Model' AS entity_level,
    'Genesis' AS brand,
    c.model_series,
    UPPER(REPLACE(c.model_series, '_', ' ')) AS display_name,
    c.segment,
    c.average_inventory,
    c.market_average_inventory,
    c.weighted_avg_msrp,
    c.market_weighted_avg_msrp,
    c.weighted_avg_price,
    c.market_weighted_avg_price,
    s.retail_sales,
    s.market_retail_sales
  FROM cloud_model c
  LEFT JOIN srs_model s
    ON c.date_month = s.date_month
   AND c.geo_level = s.geo_level
   AND c.region_code = s.region_code
   AND c.model_series = s.model_series
   AND c.segment = s.segment
)
SELECT
  date_month,
  geo_level,
  region_code,
  CASE region_code
    WHEN 'NTL' THEN 'National'
    WHEN 'CE' THEN 'Central'
    WHEN 'EA' THEN 'Eastern'
    WHEN 'MA' THEN 'Mid-Atlantic'
    WHEN 'MS' THEN 'Mountain States'
    WHEN 'SC' THEN 'South Central'
    WHEN 'SO' THEN 'Southern'
    WHEN 'WE' THEN 'Western'
  END AS region_name,
  entity_level,
  brand,
  model_series,
  display_name,
  segment,
  average_inventory,
  market_average_inventory,
  average_inventory / NULLIF(market_average_inventory, 0) AS inventory_share,
  weighted_avg_msrp,
  market_weighted_avg_msrp,
  weighted_avg_msrp / NULLIF(market_weighted_avg_msrp, 0) * 100 AS msrp_inventory_weighted_index,
  weighted_avg_price,
  market_weighted_avg_price,
  weighted_avg_price / NULLIF(market_weighted_avg_price, 0) * 100 AS price_inventory_weighted_index,
  retail_sales,
  market_retail_sales,
  retail_sales / NULLIF(market_retail_sales, 0) AS retail_share,
  (average_inventory / NULLIF(market_average_inventory, 0))
    / NULLIF(retail_sales / NULLIF(market_retail_sales, 0), 0) AS inventory_retail_ratio
FROM combined
WHERE average_inventory > 0
ORDER BY date_month, geo_level DESC, region_code, entity_level, display_name;
