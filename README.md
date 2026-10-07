# Dashboard Collection

This is the clean working home for the HMA Governance, Tommy Dash, GMA Marcom,
and GMA Operations dashboards.

## Folder structure

```text
dashboards/
├── README.md
├── outputs/                  # Final distributable HTML files only
├── projects/
│   ├── hma_governance/      # HMA source, governed data, refresh scripts
│   ├── tommy_dash/          # HMA KPI summary dashboard and local HTML builder
│   ├── gma_marcom/          # Shared source for both Marcom dashboards
│   └── ops_dash/            # Data pipeline plus dashboard application
└── shared/
    └── scripts/             # Collection-level output synchronization
```

## Final dashboards

GitHub Pages publishes the browser-ready dashboards from `docs/`. Tommy Dash is
available at `/tommy-dash/` on the repository's Pages site.

The only files in `outputs/` are:

- `hma_governance.html`
- `marcomdash_1.html` — Marcom funnel-to-sales correlations
- `marcomdash_2.html` — Marketing phase-chain correlations
- `ops_dash.html`

Treat `outputs/` as generated and read-only. Make edits in `projects/`, rebuild
the relevant project, then run:

```bash
python3 shared/scripts/sync_dashboard_outputs.py
```

The synchronization script embeds the Hyundai fonts in the HMA HTML so that
the final file can be opened by itself. The Ops export already embeds its
fonts and application assets. The two Marcom dashboards retain their existing
D3 CDN dependency and therefore need an internet connection when opened.

## Where to edit

### HMA Governance

- Dashboard UI: `projects/hma_governance/app/DemandSalesDashboard.tsx`
- Site styling: `projects/hma_governance/app/globals.css`
- Standalone dashboard and embedded data: `projects/hma_governance/quadchart.html`
- Data and insight refresh: `projects/hma_governance/scripts/refresh_dashboard.py`
- Segmentation contract: `projects/hma_governance/AGENTS.md`
- Generated workbooks, presentations, and public-hosting packages:
  `projects/hma_governance/artifacts/`

Run the full governed refresh from the HMA project folder with:

```bash
python3 scripts/refresh_dashboard.py --full
```

### Tommy Dash

- Dashboard UI: `projects/tommy_dash/app/TommyDashboard.tsx`
- Site styling: `projects/tommy_dash/app/globals.css`
- Governed Summary package: `projects/tommy_dash/public/data/summary_metrics.json`
- Standalone builder: `projects/tommy_dash/scripts/build_local_html.mjs`
- Published page: `docs/tommy-dash/index.html`

From the Tommy Dash project folder, rebuild the governed package and standalone
HTML with:

```bash
pnpm run build:local
```

### GMA Marcom

Both dashboards deliberately share one project and one governed data layer.

- Marcom dashboard 1 template:
  `projects/gma_marcom/templates/marcom-funnel-sales-correlations.template.html`
- Marcom dashboard 2 template:
  `projects/gma_marcom/templates/phase-chain-correlations.template.html`
- Extracted inputs: `projects/gma_marcom/data/`
- Refresh/build logic: `projects/gma_marcom/scripts/`
- SQL lineage: `projects/gma_marcom/sql/`

Rebuild the dashboards from the GMA Marcom project folder with:

```bash
node scripts/build_marcom_correlation_charts.mjs
node scripts/build_phase_chain_correlations.mjs
```

### GMA Operations

- Dashboard UI: `projects/ops_dash/dashboard/app/page.tsx`
- Site styling: `projects/ops_dash/dashboard/app/globals.css`
- Data extraction: `projects/ops_dash/scripts/`
- SQL: `projects/ops_dash/sql/`
- Local source snapshots: `projects/ops_dash/source/`
- Standalone build script:
  `projects/ops_dash/dashboard/scripts/build_standalone_dashboard.mjs`
- Generated standalone dashboard: `projects/ops_dash/dashboard/artifacts/`

Run a data extractor from the Ops project folder, then rebuild the standalone
HTML from the dashboard folder:

```bash
python3 scripts/extract_operational_context.py
node dashboard/scripts/build_standalone_dashboard.mjs
```

## Editing recommendations

1. Edit only inside the relevant project; never hand-edit the four files in
   `outputs/`.
2. Keep governed data, SQL, prompts, and refresh scripts beside the dashboard
   that owns them.
3. Keep the two Marcom dashboards together. Duplicating the entire Marcom
   project causes data and definition drift.
4. Preserve each hosted application's `.openai/hosting.json` and package
   lockfiles.
5. Do not store dependency folders or build caches in this collection.
   Recreate `node_modules`, `dist`, and related caches when needed.
6. Run `shared/scripts/sync_dashboard_outputs.py` after every successful
   refresh or visual change so `outputs/` remains authoritative.

The older source folders under `codex_source/reports/` were not modified and
remain a recovery reference while this collection is adopted as the canonical
editing location.
