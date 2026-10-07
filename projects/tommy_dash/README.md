# Tommy Dash

Tommy Dash is the workspace for a new online KPI dashboard that combines
governed metrics, reusable dashboard assets, and agent-generated intelligence.

## Project shape

```text
assets/             Images, fonts, and other reusable presentation assets
config/             Dashboard and metric configuration
data/raw/           Source-specific extracts; never served directly
data/processed/     Validated, dashboard-ready data and intelligence
instructions/       Canonical agent prompts, contracts, and evaluation rules
public/             Static files safe to include in a published build
src/                HTML, styles, scripts, components, and adapters
tests/              Data-contract and dashboard behavior checks
output/             Generated local and hosting-ready deliverables
```

## Initial architecture contract

- Treat `../shared/data/governed/quadchart.json` as the existing governed KPI
  source wherever it contains the required metric.
- Add source adapters for new metrics; do not silently redefine an existing
  governed metric, denominator, segment, or rollup.
- Keep raw source data separate from validated dashboard-ready data.
- Keep agent intelligence additive and traceable. It may explain or prioritize
  metrics, but it must never overwrite observed values.
- Publish only sanitized, credential-free assets from `public/` or `output/`.
- Record source timestamps and provenance in every generated data package.

## Current prototype

The Summary page now connects September 2026 values and trends to the existing
governed extracts used by Sales/Demand, Ops, and HMA Weekly. It includes retail
sales, retail share, inventory, incentive PNV, media spend, Google Ad Ops search
opportunity, and a Federal Reserve macro context metric. The sourced industry
event rail remains active; Genie-generated interpretation is still deferred.

Run `node scripts/build_summary_data.mjs` before either web build to recreate
the dashboard data package from those existing extracts. The complete source,
scope, and transformation audit is in
`instructions/summary-source-contract.md`.

National is defined as CE + EA + MA + MS + NH + SC + SO + WE; NH contributes
to both the numerator and denominator of National shares but is excluded from
selectable regions. See `instructions/data-governance.md`.

Run locally with:

```bash
pnpm install
pnpm run dev
```

## Standalone local dashboard

`pnpm run build:local` generates a single, self-contained HTML file at
`output/local_hosting/index.html`. It embeds the dashboard styling, fonts, and
interactions and needs no web dependencies.

Double-click `Open Tommy Dash.command` to serve that file at a clean localhost
address. The launcher binds only to `127.0.0.1`, so the dashboard remains on
this Mac and is not exposed to the local network or internet.
