import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { addSalesMonthAllocations } from "./sales_month_alignment.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const csvPath = path.join(projectRoot, "data/marcom_funnel_correlations_national_total.csv");
const creditAppsPath = path.join(projectRoot, "data/credit_apps_national_monthly.json");
const luxuryRetailPath = path.join(projectRoot, "data/srs_market_volume_per_share_point.json");
const mediaPath = path.join(projectRoot, "data/media_brand_srs_sales_monthly.csv");
const salesMonthWeightsPath = path.join(projectRoot, "data/sales_month_allocation_weights.csv");
const templatePath = path.join(projectRoot, "templates", "marcom-funnel-sales-correlations.template.html");
const outputPath = path.join(projectRoot, "dashboards", "marcom-funnel-sales-correlations.html");

function parseCsv(text) {
  const [headerLine, ...lines] = text.trim().split(/\r?\n/);
  const headers = headerLine.split(",");
  return lines.map((line) => Object.fromEntries(headers.map((header, index) => [header, line.split(",")[index]])));
}

function numberOrNull(value) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

const creditAppsByMonth = new Map(JSON.parse(await fs.readFile(creditAppsPath, "utf8")));
const mediaRows = parseCsv(await fs.readFile(mediaPath, "utf8"));
const mediaByMonth = new Map(mediaRows.map((row) => [row.date_month, row]));
// The first volume field is the agreed seven-segment luxury retail universe.
const luxuryRetailByMonth = new Map(JSON.parse(await fs.readFile(luxuryRetailPath, "utf8"))
  .map(([date, luxuryRetailUnits]) => [date, luxuryRetailUnits]));
const calendarRows = parseCsv(await fs.readFile(csvPath, "utf8")).map((row) => {
  const sales = numberOrNull(row.rdr_sales_volume);
  const luxuryRetailUnits = luxuryRetailByMonth.get(row.date_month);
  return {
    date: row.date_month,
    sales,
    luxury_share: Number.isFinite(sales) && Number.isFinite(luxuryRetailUnits) ? sales / luxuryRetailUnits : null,
    ad_ops_including_make_only: numberOrNull(row.google_adops_index_volume),
    ad_ops_excluding_make_only: Number.isFinite(numberOrNull(row.google_adops_index_volume))
      ? numberOrNull(row.google_adops_index_volume) - (numberOrNull(row.google_adops_make_only_index_volume) ?? 0)
      : null,
    t1_visits: numberOrNull(row.t1_visits),
    t3_vdps: numberOrNull(row.t3_vdps),
    research_actions: numberOrNull(row.research_actions),
    shop_actions: numberOrNull(row.shop_actions),
    credit_apps: numberOrNull(row.credit_apps) ?? creditAppsByMonth.get(row.date_month) ?? null,
    media_t1t2_spend: numberOrNull(mediaByMonth.get(row.date_month)?.t1t2_spend),
    media_t1_spend: numberOrNull(mediaByMonth.get(row.date_month)?.t1_spend),
    media_t1_lifestyle_spend: numberOrNull(mediaByMonth.get(row.date_month)?.t1_lifestyle_spend),
    media_t1_in_market_spend: numberOrNull(mediaByMonth.get(row.date_month)?.t1_in_market_spend),
    media_t2_spend: numberOrNull(mediaByMonth.get(row.date_month)?.t2_spend),
    media_t1t2_impressions: numberOrNull(mediaByMonth.get(row.date_month)?.t1t2_impressions),
    media_t1_impressions: numberOrNull(mediaByMonth.get(row.date_month)?.t1_impressions),
    media_t2_impressions: numberOrNull(mediaByMonth.get(row.date_month)?.t2_impressions),
  };
});
const salesMonthWeights = parseCsv(await fs.readFile(salesMonthWeightsPath, "utf8"));
const allocatableFields = [
  "media_t1t2_spend", "media_t1_spend", "media_t1_lifestyle_spend", "media_t1_in_market_spend",
  "media_t2_spend", "media_t1t2_impressions", "media_t1_impressions", "media_t2_impressions",
  "ad_ops_including_make_only", "ad_ops_excluding_make_only", "t1_visits", "t3_vdps",
  "research_actions", "shop_actions",
];
const rows = addSalesMonthAllocations(calendarRows, salesMonthWeights, allocatableFields);
// Outcome availability is metric-specific. In particular, Retail Sales may be
// refreshed before the separate luxury-universe extract, so a missing luxury
// share must not prevent a valid Retail Sales dashboard refresh.
if (!rows.length || rows.some((row) => !/^\d{4}-\d{2}-\d{2}$/.test(row.date))) {
  throw new Error("Correlation CSV contains missing or invalid values.");
}

const template = await fs.readFile(templatePath, "utf8");
const output = template
  .replace("__CORRELATION_DATA__", JSON.stringify(rows));
await fs.writeFile(outputPath, output, "utf8");
console.log(JSON.stringify({
  output_path: outputPath,
  row_count: rows.length,
  extract_earliest_month: rows[0].date,
  extract_latest_month: rows.at(-1).date,
  credit_apps_row_count: rows.filter((row) => Number.isFinite(row.credit_apps)).length,
  media_row_count: rows.filter((row) => Number.isFinite(row.media_t1t2_spend)).length,
}, null, 2));
