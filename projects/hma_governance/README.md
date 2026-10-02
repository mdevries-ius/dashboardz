# HMA Demand × Sales Governance

## Canonical segmentation source

Custom search segments must come exclusively from **Governance List Revised.xlsx → `Full Set`**, represented locally by the validated 149-row extract at:

```text
../../../dbx_ingestion/search_customsegmentation/cleaned_outputs/governance_list_revised_full_set.csv
```

The dashboard pull fails if that governed extract is unavailable or does not contain exactly 149 rows. `Display Models` controls the default visual filter only; it never changes a denominator. Non-Hyundai competitors remain exact `ius_make_model` matches. Only governed Hyundai variants within the same custom segment may roll up to a nameplate. Special segmentation applies to Google search only. SRS retail share always uses each vehicle's unchanged native SRS segment denominator. A competitor from another SRS segment can therefore appear in the retail ranking, with a segment note, and the visible retail shares are not expected to total 100%.

Cloud Theory inventory share likewise always uses each vehicle's native `ius_srs_segment` inventory denominator. The demand × inventory view plots `inventory share ÷ retail share` against `search share ÷ retail share`, with `1.0×` on each axis representing exact parity with retail share.

National SRS and Cloud Theory rollups include `CE`, `EA`, `MA`, `MS`, `NH`, `SC`, `SO`, and `WE`. `NH` contributes to national and other multi-region totals, but is intentionally excluded from region selectors and regional display charts.

The conversion-efficiency view avoids share denominators. It plots Sales Velocity (monthly retail sales divided by average Cloud Theory inventory) on X and Conversion (retail sales divided by Google indexed search-opportunity volume) on Y. Its benchmark lines use the full competitive universe and do not move when the display filter changes.

## Export Studio

The standalone dashboard includes an Export Studio for Model Quadrant, Model Trends, Regional Strength, and Model Performance. It exports white-background PNGs with selectable resolution and preserves per-visual settings in local browser storage. Controls include exact pixel dimensions, draggable resizing, aspect-ratio presets and locking, editable/draggable titles, draggable axis titles and legends, visibility and font-size controls, adjustable legend density, per-series data-label visibility, label anti-collision, and separate Model Performance typography for column headers, descriptions, and metrics.

See `AGENTS.md` for the mandatory validation contract.

## Executive insight strip

The dashboard includes a compact executive readout between the parameter card
and the visual grid. `scripts/refresh_insights.py` builds a frozen fact pack
from the already validated `quadchart.json`, then applies the dedicated HMA
headline-editor prompt in `prompts/dashboard_headline_editor.md`. The editor is
allowed to verbalize supplied facts only: it cannot query Genie, calculate a
metric, change a denominator, or introduce outside context.

The latest month, Prior 3MA, special-segmentation states are cached for every
Hyundai model and all four chart views. Other interactive states receive a
deterministic calculated summary from the exact plotted values. Both paths are
credential-free in the browser and remain fully static after publication.

### Databricks supervisor context

`scripts/refresh_supervisor_context.py` sends one frozen observation pack per
Hyundai model to the configured `offplanet-max02` Supervisor Agent during a
refresh. The supervisor coordinates its specialist agents to identify
explanatory context, but the adapter rejects unsupported IDs, unapproved agent
sources, uncited claims, and numeric values that are absent from the governed
observation pack. It never changes a dashboard metric or denominator.

Only normalized, validated claims can reach `insights.json`; raw endpoint
responses and request audit metadata remain local in
`data/processed/supervisor_audit.json`. If the endpoint or Databricks login is
unavailable, the last validated context is retained when possible and the
dashboard continues with its governed product/release fallback.

Use `scripts/refresh_dashboard.py --full` for the daily flow: direct data pull,
news refresh, supervisor investigation, insight generation, and static rebuild.
Use `--skip-supervisor` for a fully local rebuild or `--force-supervisor` to
ignore the supervisor cache. The `hma-report` Databricks profile must be logged
in for a live supervisor refresh.

## Public static package

Run `scripts/build_public_hosting.py` after the normal dashboard refresh to
create `artifacts/public_hosting/`. That folder contains a self-contained
`index.html`, bundled Hyundai fonts, no runtime database dependency, and no
internal Databricks identifiers. Its contents can be uploaded directly to a
static host. The corresponding upload-ready ZIP is
`artifacts/HMA_Demand_Sales_Public_Hosting.zip`.

Because the package embeds current business-performance data, confirm the
intended audience and data-sharing approval before publishing it to an
unrestricted public URL.

## Clean local presentation URL

Double-click `Open Dashboard.command` to open the latest static dashboard in
Google Chrome at `http://localhost:8765/HMA26A7/`. The local server exposes only
the dashboard and its bundled fonts, does not show a filesystem path, and is
bound to this Mac rather than the local network. The Update Dash and Update
News launchers use the same clean URL after rebuilding.

## Application framework

A clean full-stack starter running on
[vinext](https://github.com/cloudflare/vinext), with optional Cloudflare D1 and
Drizzle support.

## Prerequisites

- Node.js `>=22.13.0`

## Quick Start

```bash
npm install
npm run dev
npm run build
```

This starter does not use `wrangler.jsonc`.

## Included Shape

- edit site code under `app/`
- `.openai/hosting.json` declares optional Sites D1 and R2 bindings
- `vite.config.ts` simulates declared bindings for local development
- `db/schema.ts` starts intentionally empty
- `examples/d1/` contains an optional D1 example surface
- `drizzle.config.ts` supports local migration generation when needed

## Workspace Auth Headers

Signed-in visitors receive both `oai-authenticated-user-id` and `oai-authenticated-user-email`. Private Sites require every visitor to sign in; public Sites may also have anonymous visitors, for whom neither header is present.

The user ID is stable for the same user on the same Site and different across Sites. Email and name are intended for display or contact purposes.

SIWC-authenticated workspace sites may also receive
`oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty
`name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by
`oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const userId = requestHeaders.get("oai-authenticated-user-id");
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs
optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send
  anonymous visitors through Sign in with ChatGPT.
- Use `chatGPTSignInPath(returnTo)` and `chatGPTSignOutPath(returnTo)` for
  browser links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in
  or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because
  they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the
OAuth cookies, and identity header injection. Do not implement app routes for
those reserved paths. Routes that do not import and call the helper remain
anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the
Sites hosting platform's access policy controls for workspace-wide restrictions,
or enforce explicit server-side membership or allowlist checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write
actions tied to the current ChatGPT user. Leave public content anonymous.

## Useful Commands

- `npm run dev`: start local development
- `npm run build`: verify the vinext build output
- `npm test`: build the starter and verify its rendered loading skeleton
- `npm run db:generate`: generate Drizzle migrations after schema changes

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)
