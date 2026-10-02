# Shared Data Contract

All analysts receive the same frozen `data/` package for a single reporting
month. Treat it as read-only.

## Included files

- `operational_metrics.csv`: Genesis brand and model metrics at national and
  regional level.
- `competitor_efficiency.csv`: SOI, SOM, and SOI/SOM for Genesis, BMW,
  Mercedes-Benz, Lexus, and Audi.
- `cox_incentives.csv`: Genesis brand and model incentive dollars and
  inventory-weighted incentive index.
- `cox_segment_incentives.csv`: peer incentive comparison within each Cox
  segment.
- `cloudtheory_segment_metrics.csv`: peer inventory-share and MSRP-index
  comparisons within each CloudTheory segment.
- `price_band_trim_allocation.csv`: trim/nameplate inventory and
  inventory-weighted advertised price by segment.
- `dealer_inventory.csv`: dealer inventory location reference, when available
  for the reporting month.

## Metric definitions

- **Average inventory:** average CloudTheory inventory, aggregated across the
  seven included sales regions.
- **SOI / inventory share:** Genesis average inventory divided by all inventory
  in Genesis's represented competitive segments.
- **SOM / retail share:** Genesis retail sales divided by all retail sales in
  the same competitive-segment universe used for SOI.
- **SOI/SOM:** relative availability versus retail share. Above 1.00x means
  Genesis inventory share exceeds retail share within the aligned universe.
- **Weighted MSRP / advertised price:** price weighted by average inventory.
- **MSRP index:** Genesis weighted MSRP divided by the relevant competitive
  benchmark, multiplied by 100.
- **Incentive index:** Genesis incentive PNV divided by the inventory-weighted
  incentive benchmark in the Cox segment, multiplied by 100.

## Evidence convention

Use this form for every direct factual statement:

`[Evidence: <file> | <entity> | <geography> | <reporting month>]`

Example:

`[Evidence: operational_metrics.csv | GV70 | National | 2026-08-01]`

Do not infer causality solely from timing. Label statements as **Fact**,
**Hypothesis**, or **Investigation**.
