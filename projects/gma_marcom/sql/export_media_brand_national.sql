-- One-off National Genesis Brand media correlation input.
--
-- Media Brand is the sum of all model-family and unassigned media rows.
-- SRS sales is joined locally from the existing monthly Genesis extract.

WITH media_brand AS (
  SELECT
    CAST(date_month AS DATE) AS date_month,
    SUM(tier1_tier2_combined_spend) AS t1t2_spend,
    SUM(tier1_combined_spend) AS t1_spend,
    SUM(tier1_brand_spend) AS t1_lifestyle_spend,
    SUM(tier1_in_market_spend) AS t1_in_market_spend,
    SUM(tier2_spend) AS t2_spend,
    SUM(tier1_tier2_combined_impressions) AS t1t2_impressions,
    SUM(tier1_combined_impressions) AS t1_impressions,
    SUM(tier2_impressions) AS t2_impressions
  FROM ius_unity_prod.media_datamart.gma_national_t1_t2_media_spend_impressions_combined
  GROUP BY CAST(date_month AS DATE)
)

SELECT
  m.date_month,
  'National' AS geo_type,
  'NTL' AS region_code,
  'Genesis' AS brand,
  'Brand' AS model,
  m.t1t2_spend,
  m.t1_spend,
  m.t1_lifestyle_spend,
  m.t1_in_market_spend,
  m.t2_spend,
  m.t1t2_impressions,
  m.t1_impressions,
  m.t2_impressions
FROM media_brand AS m
ORDER BY m.date_month;
