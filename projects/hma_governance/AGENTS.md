# HMA Demand × Sales Governance — Canonical Data Rules

These rules are mandatory for every agent or developer working in this project.

## Custom-segmentation canon

- The sole authoritative custom-segmentation membership is **Governance List Revised.xlsx → `Full Set`**.
- The local validated extract is:
  `/Users/maximodevries/Desktop/codex_source/dbx_ingestion/search_customsegmentation/cleaned_outputs/governance_list_revised_full_set.csv`
- The Databricks mapping table is `ius_unity_prod.sandbox.search_customsegmentation`.
- The validated Full Set contains 149 unique `ius_make_model` rows. A refresh must fail if the extract is missing, has a different row count, contains duplicate normalized model keys, or has blank segment assignments.
- Never substitute `Model List by Segment.xlsx`, a dashboard-local member array, Google `ius_make_model_family`, or the `Display Models` sheet for Full Set membership.
- `Display Models` is a presentation filter only. It does not define a segment denominator.

## Matching and rollups

- Every non-Hyundai member must use its exact governed `ius_make_model` match. Never expand a competitor through `ius_make_model_family` or `ius_model_series`.
- Hyundai variants may roll up to one Hyundai nameplate only when those exact variants are governed in the same Full Set custom segment.
- Do not roll identically named Hyundai vehicles across segments. In particular, Kona and Kona EV remain separate because their governed custom segments differ.
- The Tucson custom segment has 27 governed source rows. Its three governed Tucson rows (`hyundai_tucson`, `hyundai_tucson_hev`, and `hyundai_tucson_phev`) produce one displayed Tucson point, so the expected displayed count is 25.
- Special segmentation applies to Google search share only. SRS retail share never changes with the special-segmentation toggle.
- Every vehicle's retail share must use its own native SRS segment denominator, without custom-universe adjustments. Never divide a model from one SRS segment by another segment's denominator. For example, Tesla Model Y (`Near Luxury EV SUV`) must not be divided by the Ioniq 5 `Mainstream EV SUV` total.
- A governed Google-search competitor from a different native SRS segment remains visible in the retail ranking, but must be clearly annotated as belonging to that different SRS segment. The displayed retail shares are intentionally non-additive in this case and are not expected to total 100%.
- In standard search mode, Google uses its complete native standard-segment universe. Preserve source-only models at the merge rather than silently changing a denominator.
- National SRS and Cloud Theory calculations must include `sales_region_cd` values `CE`, `EA`, `MA`, `MS`, `NH`, `SC`, `SO`, and `WE`. `NH` must be included whenever regional rows are rolled into a national or multi-region calculation, but it must never appear as a selectable region or plotted regional point. User-facing regional displays remain the seven geographic HMA regions plus the calculated national benchmark.
- Inventory comes from `ius_unity_prod.sandbox.agent_cloudtheory`. Each vehicle's inventory share must use its own unchanged native Cloud Theory `ius_srs_segment` denominator, summed nationally across all eight source region codes including `NH`. Custom search segmentation and display filters never change the inventory denominator.
- The conversion-efficiency view uses raw model volumes: Sales Velocity is SRS retail units divided by Cloud Theory average inventory on X, and Conversion is SRS retail units divided by Google indexed search-opportunity volume on Y. Its median benchmark must use the full competitive universe and remain independent of the display filter.

## Required validation after data changes

1. Resolve every governed Full Set row to exactly one Google `ius_make_model`.
2. Confirm each custom search denominator equals the sum of its governed source rows.
3. Confirm non-Hyundai output keys remain exact and no ungoverned family siblings appear.
4. Confirm Hyundai rollups contain only governed variants from the same custom segment.
5. For Tucson, verify 27 governed source rows, 25 displayed points, and no `mazda_cx_5` row.
6. Verify each special Google-search universe reconciles to 100% before any display filter. Verify no available retail share exceeds 100% and every row uses its native SRS segment denominator. Preserve any small negative SRS registration corrections rather than altering source data; do not require displayed retail shares to sum to 100%.
7. Verify every available inventory share is between 0% and 100% and uses its native Cloud Theory segment denominator.
8. Rebuild `data/processed/quadchart.json`, `public/data/quadchart.json`, and `quadchart.html` after a successful pull.

Use direct notebook/table sources through the `hma-report` Databricks profile. Do not use Genie-generated results for this dashboard.
