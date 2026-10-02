-- Calendar-month proportions assigned to each HCA sales month.
-- Used only for dashboard sensitivity analysis; no upstream table is changed.

WITH periods AS (
  SELECT
    CAST(sales_date_month AS DATE) AS sales_date_month,
    MIN(date_day) AS start_day,
    MAX(date_day) AS end_day
  FROM ius_unity_prod.hca_datamart.hca_creditapps_model_dealer_scd1_daily
  WHERE sales_date_month BETWEEN DATE '2023-01-01' AND DATE '2026-08-01'
  GROUP BY CAST(sales_date_month AS DATE)
),

assigned_days AS (
  SELECT
    sales_date_month,
    EXPLODE(SEQUENCE(start_day, end_day, INTERVAL 1 DAY)) AS date_day
  FROM periods
)

SELECT
  sales_date_month,
  CAST(DATE_TRUNC('month', date_day) AS DATE) AS calendar_month,
  COUNT(*) AS assigned_days,
  DAY(LAST_DAY(date_day)) AS calendar_days,
  COUNT(*) / DAY(LAST_DAY(date_day)) AS allocation_weight
FROM assigned_days
GROUP BY
  sales_date_month,
  CAST(DATE_TRUNC('month', date_day) AS DATE),
  DAY(LAST_DAY(date_day))
ORDER BY sales_date_month, calendar_month;
