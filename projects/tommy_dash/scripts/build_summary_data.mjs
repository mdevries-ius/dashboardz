import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const quadPath = join(root, "data", "quadchart.json");
const coxPath = join(root, "data", "hyundai_cox_incentives_monthly.json");
const mediaPath = join(root, "public", "data", "media_history.json");
const fedPath = join(root, "public", "data", "fed_funds_history.json");

const [quad, cox, media, fed] = await Promise.all([
  readFile(quadPath, "utf8").then(JSON.parse),
  readFile(coxPath, "utf8").then(JSON.parse),
  readFile(mediaPath, "utf8").then(JSON.parse),
  readFile(fedPath, "utf8").then(JSON.parse),
]);

const models = quad.models;
const months = [...new Set(quad.monthly.map((row) => row.month.slice(0, 7)))].sort();
const displayMonths = months;
const records = [];
const normalize = (value) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
const add = (metric, month, model, region, value, extra = {}) => {
  if (Number.isFinite(Number(value))) records.push({ metric, month, model, region, value: Number(value), ...extra });
};

for (const row of quad.monthly) {
  const month = row.month.slice(0, 7);
  if (!displayMonths.includes(month)) continue;
  add("retail_sales", month, row.model, "NTL", row.retail_units);
  add("retail_share", month, row.model, "NTL", row.industry_retail_share);
  add("google_adops", month, row.model, "NTL", row.search_volume);
}

for (const row of quad.regional_monthly) {
  const month = row.month.slice(0, 7);
  if (!displayMonths.includes(month) || row.segment_mode !== "special" || row.region_cd === "NTL") continue;
  add("retail_sales", month, row.model, row.region_cd, row.retail_units);
  add("retail_share", month, row.model, row.region_cd, row.industry_retail_share);
  add("google_adops", month, row.model, row.region_cd, row.search_volume);
}

for (const row of quad.industry_retail_monthly) {
  const month = row.month.slice(0, 7);
  if (!displayMonths.includes(month)) continue;
  add("retail_sales", month, "All Hyundai", row.region_cd, row.hyundai_retail_units, { brand_total: true });
  add("retail_share", month, "All Hyundai", row.region_cd, row.hyundai_retail_share, {
    brand_total: true,
    industry_retail_units: row.industry_retail_units,
  });
}

for (const month of displayMonths) {
  for (const region of ["NTL", "CE", "EA", "MA", "MS", "SC", "SO", "WE"]) {
    const rows = records.filter((row) => row.month === month && row.region === region && models.includes(row.model));
    for (const metric of ["google_adops"]) {
      const selected = rows.filter((row) => row.metric === metric);
      if (selected.length === models.length) add(metric, month, "All Hyundai", region, selected.reduce((sum, row) => sum + row.value, 0), { portfolio: true });
    }
  }
}

for (const month of displayMonths) {
  for (const model of models) {
    const row = quad.competitor_monthly.find((item) => item.month.startsWith(month) && item.segment_mode === "special" && item.target_model === model && normalize(item.family) === normalize(model));
    if (row) add("inventory", month, model, "NTL", row.inventory_units);
  }
  const modelRows = records.filter((row) => row.metric === "inventory" && row.month === month && row.model !== "All Hyundai");
  if (modelRows.length === models.length) add("inventory", month, "All Hyundai", "NTL", modelRows.reduce((sum, row) => sum + row.value, 0), { portfolio: true });
}

for (const row of cox) {
  const month = row.date_month.slice(0, 7);
  if (!displayMonths.includes(month) && month !== "2026-09") continue;
  const displayModel = row.display_name.replaceAll("_", " ");
  const model = row.entity_level === "Brand" ? "All Hyundai" : models.find((item) => normalize(item) === normalize(displayModel));
  if (model !== "All Hyundai" && !models.includes(model)) continue;
  if (row.incentive_pnv > 0) add("incentives", month, model, "NTL", row.incentive_pnv, { index: row.incentive_index });
}

for (const row of media.rows) {
  add("media_spend", row.month, "All Hyundai", "NTL", row.value);
}

for (const row of fed.values) {
  add("macro_rate", row.month, "All Hyundai", "NTL", (row.lower + row.upper) / 2, {
    range: `${row.lower.toFixed(2)}–${row.upper.toFixed(2)}%`,
  });
}

const output = {
  generated_at: new Date().toISOString(),
  default_period: "2026-09",
  periods: ["2026-09", "2026-08", "2026-07"],
  models: ["All Hyundai", ...models],
  regions: ["NTL", "CE", "EA", "MA", "MS", "SC", "SO", "WE"],
  governance: {
    national_regions: ["CE", "EA", "MA", "MS", "NH", "SC", "SO", "WE"],
    selectable_regions: ["CE", "EA", "MA", "MS", "SC", "SO", "WE"],
    portfolio_scope: models,
    share_method: "selected Hyundai or model SRS retail units divided by total SRS industry retail units for the same month and geography",
  },
  sources: {
    retail_sales: { label: "SRS", table: "ius_unity_prod.sandbox.agent_srs", asset: quadPath, through: quad.current_month.slice(0, 7) },
    retail_share: { label: "SRS", table: "ius_unity_prod.sandbox.agent_srs", asset: quadPath, through: quad.current_month.slice(0, 7) },
    inventory: { label: "CloudTheory", table: "ius_unity_prod.sandbox.agent_cloudtheory", asset: quadPath, through: quad.current_month.slice(0, 7), scope: "National" },
    incentives: { label: "Cox Automotive", table: "ius_unity_prod.sandbox.cox_alldataalltime", asset: coxPath, through: "2026-09", scope: "National" },
    media_spend: { label: "HMA Weekly / CMO media bank", table: "ius_unity_prod.media_datamart.hma_t1_t2_bank_impressions_line_item", asset: mediaPath, through: "2026-09", scope: "National brand" },
    google_adops: { label: "Google Ad Ops", table: "ius_unity_prod.google_datamart.ad_opportunity_regional_daily", asset: quadPath, through: quad.current_month.slice(0, 7) },
    macro_rate: { label: "Federal Reserve / FRED", table: null, asset: fedPath, through: "2026-09", scope: "National" },
  },
  records,
};

await writeFile(join(root, "public", "data", "summary_metrics.json"), `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(`Wrote ${records.length} governed metric records.`);
