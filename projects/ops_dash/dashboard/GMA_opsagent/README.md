# Genesis Monthly Insights Workflow

This workflow turns the dashboard reference data into one reproducible monthly
analysis package. Every package uses a frozen, common data extract so the two
analysts can disagree productively without relying on different facts.

## Roles

1. **Analyst 1 — Performance Diagnostician:** internal, data-first diagnosis.
   This analyst does not use web research.
2. **Analyst 2 — Market Strategist:** independently challenges the diagnosis and
   may use tightly bounded external research for only the highest-value anomalies.
3. **Supervisor:** scores the candidate insights, resolves conflicts, and writes
   the single executive-ready recommendation.

## Start a run

From `GMA Monthly Performance/dashboard`:

```bash
../../hma_weekly/.venv/bin/python GMA_opsagent/prepare_insight_run.py
```

The script automatically selects the latest month shared by the operational,
competitor-efficiency, and Cox incentive data. Pass `--month YYYY-MM-DD` to
prepare a specific supported month, or `--run-id` to give a re-run a distinct
folder name.

## Run sequence

1. Run the preparation script. It writes `data/` and copies the three role
   prompts into a new folder under `runs/`.
2. Give `01_analyst_1_prompt.md` and the read-only `data/` folder to Analyst 1.
   Save its response as `02_analyst_1_performance.md`.
3. Give `01_analyst_2_prompt.md` and the same read-only `data/` folder to
   Analyst 2. Save its response as `03_analyst_2_market.md` and any sources in
   `05_sources.md`.
4. Give the supervisor the data folder and both analyst responses. Save the
   result as `04_supervisor_final.md`.

The initial Markdown files contain the exact output structure for each role.
Agent outputs should replace the placeholder text, never overwrite the frozen
data extracts or manifest.

## Data and research rules

- SOI and SOM use the aligned Genesis competitive-segment universe specified in
  `data/data_dictionary.md`.
- Insights require at least two connected internal signals. Cite each fact with
  the filename, entity, geography, and reporting period.
- Analyst 2 may use at most five searches, only for the top three data-derived
  anomalies, generally within the reporting month plus prior 90 days.
- External sources corroborate or challenge a hypothesis; they do not prove
  causality. Record every source in `05_sources.md`.
- Exact dollar, unit, or elasticity recommendations require a supplied model;
  otherwise the output should identify the decision area and needed evidence.

## Simple API run

`analysis_profiles.json` specifies API-key locations and three explicit
profiles: `cost_controlled` (default), `quality_review`, and
`frontier_review`. Each profile defines the analyst and supervisor model,
reasoning effort, output-token ceilings, and hard input limits. The runner
sends the frozen package directly to both analysts, then sends their written
responses plus the package to the supervisor. It writes three local Markdown
files and does not create an evaluation log.

Run an existing prepared package through the API with:

```bash
../../hma_weekly/.venv/bin/python GMA_opsagent/run_agents_api.py --run-id 2026-08
```

The runner resolves `OPENAI_API_KEY` from its local `.env`, then from the
approved local `hma_weekly/.env` fallback, without displaying the key. Pass
`--role analyst_1`, `--role analyst_2`, or `--role supervisor` to rerun one
stage independently.

Use `--profile quality_review` or `--profile frontier_review` only when you
intend to spend more for a comparison. Refresh the account-specific model list
with:

```bash
../../hma_weekly/.venv/bin/python GMA_opsagent/refresh_model_catalog.py
```

## Run-folder contract

```text
runs/<run-id>/
  00_run_manifest.md               Scope, source freshness, status, versions
  01_analyst_1_prompt.md           Frozen Analyst 1 assignment
  01_analyst_2_prompt.md           Frozen Analyst 2 assignment
  01_supervisor_prompt.md          Frozen supervisor assignment
  02_analyst_1_performance.md      Analyst 1 response
  03_analyst_2_market.md           Analyst 2 response
  04_supervisor_final.md           Final leadership readout
  05_sources.md                    External-evidence ledger
  data/                            Read-only filtered reference extracts
```
