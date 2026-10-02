# GMA Operations Dashboard Project

This package keeps the full refresh flow together:

- `dashboard/` — hosted application and standalone HTML builder
- `scripts/` — Databricks extraction and validation scripts
- `sql/` — governed source queries
- `source/` — local source snapshots and manifests

The hosted application configuration remains at
`dashboard/.openai/hosting.json`. Generated standalone HTML belongs in
`dashboard/artifacts/`; the collection-level final copy is synchronized to
`../../outputs/ops_dash.html` by `../../shared/scripts/sync_dashboard_outputs.py`.

Edit the application in `dashboard/app/`. Refresh data from this project root,
then rebuild the standalone dashboard:

```bash
python3 scripts/extract_operational_context.py
node dashboard/scripts/build_standalone_dashboard.mjs
```
