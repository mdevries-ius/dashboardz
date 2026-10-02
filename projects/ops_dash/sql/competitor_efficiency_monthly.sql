-- Monthly brand SOI / SOM efficiency comparison, January 2025 onward.
-- All five brands use the same Genesis competitive-segment denominator.

WITH cloud_region AS (
  SELECT
    CAST(date_month AS DATE) AS date_month,
    'Region' AS geo_level,
    sales_region_cd AS region_code,
    LOWER(TRIM(ius_make)) AS make,
    ius_srs_segment AS segment,
    SUM(COALESCE(avginventory, 0)) AS average_inventory
  FROM ius_unity_prod.sandbox.agent_cloudtheory
  WHERE date_month >= DATE '2025-01-01'
    AND sales_region_cd IN ('CE', 'EA', 'MA', 'MS', 'SC', 'SO', 'WE')
    AND ius_srs_luxury_flag = 'Y'
  GROUP BY ALL
),
cloud AS (
  SELECT * FROM cloud_region
  UNION ALL
  SELECT date_month, 'National', 'NTL', make, segment, SUM(average_inventory)
  FROM cloud_region
  GROUP BY ALL
),
competitive_segments AS (
  SELECT DISTINCT date_month, geo_level, region_code, segment
  FROM cloud
  WHERE make = 'genesis'
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
    make,
    SUM(average_inventory) AS average_inventory,
    SUM(SUM(average_inventory)) OVER (PARTITION BY date_month, geo_level, region_code)
      AS market_average_inventory
  FROM cloud_competitive
  GROUP BY ALL
),
srs_region AS (
  SELECT
    CAST(date_month AS DATE) AS date_month,
    'Region' AS geo_level,
    sales_region_cd AS region_code,
    LOWER(TRIM(ius_make)) AS make,
    ius_srs_segment AS segment,
    SUM(COALESCE(srs_sales_volume, 0)) AS retail_sales
  FROM ius_unity_prod.sandbox.agent_srs
  WHERE date_month >= DATE '2025-01-01'
    AND sales_region_cd IN ('CE', 'EA', 'MA', 'MS', 'SC', 'SO', 'WE')
    AND ius_srs_luxury_flag = 'Y'
  GROUP BY ALL
),
srs AS (
  SELECT * FROM srs_region
  UNION ALL
  SELECT date_month, 'National', 'NTL', make, segment, SUM(retail_sales)
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
    make,
    SUM(retail_sales) AS retail_sales,
    SUM(SUM(retail_sales)) OVER (PARTITION BY date_month, geo_level, region_code)
      AS market_retail_sales
  FROM srs_competitive
  GROUP BY ALL
)
SELECT
  c.date_month,
  c.geo_level,
  c.region_code,
  CASE c.region_code
    WHEN 'NTL' THEN 'National'
    WHEN 'CE' THEN 'Central'
    WHEN 'EA' THEN 'Eastern'
    WHEN 'MA' THEN 'Mid-Atlantic'
    WHEN 'MS' THEN 'Mountain States'
    WHEN 'SC' THEN 'South Central'
    WHEN 'SO' THEN 'Southern'
    WHEN 'WE' THEN 'Western'
  END AS region_name,
  CASE c.make
    WHEN 'genesis' THEN 'Genesis'
    WHEN 'bmw' THEN 'BMW'
    WHEN 'mercedes_benz' THEN 'Mercedes-Benz'
    WHEN 'lexus' THEN 'Lexus'
    WHEN 'audi' THEN 'Audi'
  END AS brand,
  c.average_inventory / NULLIF(c.market_average_inventory, 0) AS inventory_share,
  s.retail_sales / NULLIF(s.market_retail_sales, 0) AS retail_share,
  (c.average_inventory / NULLIF(c.market_average_inventory, 0))
    / NULLIF(s.retail_sales / NULLIF(s.market_retail_sales, 0), 0) AS inventory_retail_ratio
FROM cloud_brand c
INNER JOIN srs_brand s
  ON c.date_month = s.date_month
 AND c.geo_level = s.geo_level
 AND c.region_code = s.region_code
 AND c.make = s.make
WHERE c.make IN ('genesis', 'bmw', 'mercedes_benz', 'lexus', 'audi')
ORDER BY c.date_month, c.geo_level DESC, c.region_code, brand;
