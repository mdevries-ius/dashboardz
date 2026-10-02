# GMA Monthly Performance — Operations

Local interactive dashboard for Genesis average inventory, share of inventory (SOI), retail share (SOM), inventory-weighted MSRP, MSRP index, and model-level supply-to-demand context.

## Data flow

1. `../scripts/extract_operational_context.py` executes `../sql/operational_context_monthly.sql` against Databricks.
2. The extractor updates `../source/operational_context_monthly.csv` and `public/operational_context_monthly.json`.
3. The dashboard reads the JSON at runtime and provides month and geography filters.

## Scope

- January 2025 onward
- National plus CE, EA, MA, MS, SC, SO, and WE
- NH and Unassigned excluded from both region and National results
- Average inventory only (`SUM(avginventory)` across all location statuses)
- Brand share uses the luxury market; model share uses each model series' SRS segment
- MSRP is weighted by average inventory; the MSRP index compares Genesis with the corresponding luxury-market or model-segment benchmark
- GV80 includes GV80 Coupe through `ius_model_series`

## Local build

Run the extractor from the reports root, then run the dashboard's `dev` or `build` package script.
