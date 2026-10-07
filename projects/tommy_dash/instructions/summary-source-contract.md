# Summary page source contract

Audited and refreshed October 7, 2026. All Summary metrics are available for
September 2026.

| Summary metric | Reused asset | Upstream source | Display scope |
|---|---|---|---|
| Retail sales | Sales/Demand governed quadchart | `ius_unity_prod.sandbox.agent_srs` | National, region, model |
| Retail share | Sales/Demand governed SRS extract | `ius_unity_prod.sandbox.agent_srs` | National, region, model |
| Inventory | Sales/Demand / Ops CloudTheory extract | `ius_unity_prod.sandbox.agent_cloudtheory` | National, model |
| Incentive PNV | Hyundai Cox dashboard extract | `ius_unity_prod.sandbox.cox_alldataalltime` | National, model |
| Media spend | HMA Weekly / CMO validated media split | `ius_unity_prod.media_datamart.hma_t1_t2_bank_impressions_line_item` | National brand |
| Search opportunity | Sales/Demand governed quadchart | `ius_unity_prod.google_datamart.ad_opportunity_regional_daily` | National, region, model |
| Federal funds target | Existing macro context pull | Federal Reserve September 16, 2026 release | National |

## Calculation and refresh rules

- The shared governed quadchart refresh owns the SRS, Google Ad Ops, and
  CloudTheory transformations. Tommy Dash consumes its output and does not
  redefine its segment or nameplate logic.
- National uses CE + EA + MA + MS + NH + SC + SO + WE. NH is included in
  numerators and denominators but never appears in the selector.
- The All Hyundai sales numerator contains every Hyundai nameplate in SRS.
- Retail share is selected Hyundai brand or model retail units divided by total
  SRS industry retail units for the same month and geography. It does not use a
  native-segment or custom competitive-set denominator.
- Portfolio inventory and search opportunity remain sums of the governed
  seven-nameplate portfolio because those extracts do not contain a total-brand
  row.
- Incentive PNV uses the existing Cox inventory-weighted Hyundai extract.
- Media spend is the sum of the validated Tier 1/Tier 2 lifestyle and in-market
  components used by the HMA Weekly / CMO asset.
- `public/data/summary_metrics.json` is the served, provenance-rich package.
  It contains source table names, available-through periods, governance
  metadata, and dashboard records.
