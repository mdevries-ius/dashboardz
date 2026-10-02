-- National Total monthly correlation inputs. Each dashboard metric uses its
-- own maximum available history and all correlations end in August 2026.

WITH sales AS (
  SELECT
    CAST(date_month AS DATE) AS date_month,
    SUM(rdr_sales_volume) AS rdr_sales_volume
  FROM ius_unity_prod.governance_datamart.gmd_cmo_map_market_model_daily_rollup
  WHERE LOWER(make) = 'genesis'
    AND LOWER(model) = 'total'
    AND LOWER(region_type) = 'dma'
  GROUP BY CAST(date_month AS DATE)
),

google_adops_make_only AS (
  SELECT
    CAST(date_month AS DATE) AS date_month,
    SUM(CAST(indexed_ad_opportunities_monthly_sum AS DOUBLE)) AS google_adops_make_only_index_volume
  FROM ius_unity_prod.sandbox.agent_googleadops_monthly
  WHERE date_month >= DATE '2024-09-01'
    AND LOWER(TRIM(geo_level)) = 'national'
    AND LOWER(TRIM(ius_make)) = 'genesis'
    AND LOWER(TRIM(ius_model)) = 'make_only'
    AND last_observed_day = LAST_DAY(date_month)
  GROUP BY CAST(date_month AS DATE)
),

credit_apps AS (
  SELECT
    CAST(date_month AS DATE) AS date_month,
    SUM(CAST(credit_app_cnt AS DOUBLE)) AS credit_apps
  FROM ius_unity_prod.sandbox.agent_gcom_t1_t3_shift_leads_region_national_monthly
  WHERE geo_type = 'National'
    AND region_code = 'NTL'
    AND LOWER(TRIM(model)) = 'total'
  GROUP BY CAST(date_month AS DATE)
),

joined AS (
  SELECT
    f.date_month,
    s.rdr_sales_volume,
    f.google_adops_index_volume,
    a.google_adops_make_only_index_volume,
    f.visits AS t1_visits,
    f.shift_t3_vdp_views AS t3_vdps,
    f.total_research_actions AS research_actions,
    f.total_shop_actions AS shop_actions,
    c.credit_apps
  FROM ius_unity_prod.sandbox.gma_funnel_enriched AS f
  LEFT JOIN sales AS s
    ON f.date_month = s.date_month
  LEFT JOIN google_adops_make_only AS a
    ON f.date_month = a.date_month
  LEFT JOIN credit_apps AS c
    ON f.date_month = c.date_month
  WHERE f.geo_type = 'National'
    AND f.region_code = 'NTL'
    AND LOWER(TRIM(f.model)) = 'total'
    AND f.date_month BETWEEN DATE '2022-01-01' AND DATE '2026-08-01'
)

SELECT *
FROM joined
ORDER BY date_month;
