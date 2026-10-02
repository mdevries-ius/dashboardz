# GMA Correlations

## Current dashboard

`marcom-funnel-sales-correlations.html` compares National Total monthly Retail Sales or Genesis luxury share with:

- T1 visits
- Google AdOps indexed opportunities
- Media Spend / Impressions (selectable measure)
- T3 VDPs
- Total Research Actions
- Total Shop Actions
- Credit applications

Funnel inputs come from the `total` model row in `ius_unity_prod.sandbox.gma_funnel_enriched`, with `geo_type='National'` and `region_code='NTL'`. Credit applications come from the National Total row of `ius_unity_prod.sandbox.agent_gcom_t1_t3_shift_leads_region_national_monthly`. Retail Sales is summed from Genesis DMA rows where the governance source model is also `total`.

Each metric pair uses its own longest valid history. Retail Sales correlations
currently end in August 2026; the separate SRS luxury-share universe currently
ends in July 2026, so Luxury share selections stop there:

- T1 visits: January 2023–August 2026
- Google AdOps: September 2024–August 2026
- Media: January 2024–August 2026, using the National Genesis Brand media extract joined to the dashboard's Retail Sales series by month
- T3 VDPs: January 2023–August 2026; T3 VDP data begins in January 2022, but Retail Sales begins in January 2023
- Total Research Actions: January 2025–August 2026
- Total Shop Actions: April 2024–August 2026
- Credit applications: January 2023–August 2026

Each metric pair has an outcome selector for either Retail Sales or Genesis luxury share. Luxury share is Retail Sales divided by the agreed seven-segment national SRS luxury retail universe. The dashboard uses Pearson correlation and displays the full-period r, yearly r, a scatter plot with an all-period regression line, and a dual-axis monthly line chart for each metric. Global controls apply a 0–2 month metric-to-sales lag and geometric adstock decay from 0.00–0.90.

Both correlation dashboards include a month-alignment sensitivity control. Gregorian month is the default. Sales-month mode uses the HCA `sales_date_month` boundaries and allocates upstream monthly totals by the share of calendar days assigned to each sales period. Retail Sales and Credit Apps are left unchanged because their source values are already sales-month measures. This is a proportional allocation for monthly-only inputs, not a reconstruction of their unknown daily distribution.

The separate `dashboards/phase-chart-studio.html` view supports the same month alignment, metric-pair selection, chart-type selection, resizable SVG canvas, editable labels, font and margin controls, and SVG export without changing the dashboard layout.

For Shop Actions, the monthly trend view includes a Jan–Aug 2026 same-month-prior-year readout of Shop Action growth, selected-outcome growth, and selected outcome per action growth. It respects that section's date range, exclusion state, lag, and adstock settings.

Adstock is calculated as:

`adstock_t = metric_t + decay * adstock_(t-1)`

A one-month lag compares the transformed metric in month `t` with sales in month `t+1`. Adstock initializes at each metric pair's first available month. Both line-chart y-axes begin at zero.

## Refresh

1. Run `scripts/extract_marcom_funnel_correlations.mjs` to refresh the Databricks extract.
2. Run `scripts/extract_sales_month_weights.mjs` to refresh the HCA sales-period allocation weights.
3. Run `scripts/build_marcom_correlation_charts.mjs` and `scripts/build_phase_chain_correlations.mjs` to rebuild the dashboards and Chart Studio with the refreshed data embedded locally.

## One-off Brand media and SRS dataset

`notebooks/media_brand_srs_sales_monthly.ipynb` joins the National Genesis Brand
media extract to the current monthly National Genesis Brand SRS sales extract.
The output is `data/media_brand_srs_sales_monthly.csv`, with 32 complete monthly
observations from January 2024 through August 2026.
