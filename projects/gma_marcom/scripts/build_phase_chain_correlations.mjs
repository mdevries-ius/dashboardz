import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { addSalesMonthAllocations } from "./sales_month_alignment.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const csvPath = path.join(projectRoot, "data/marcom_funnel_correlations_national_total.csv");
const mediaPath = path.join(projectRoot, "data/media_brand_srs_sales_monthly.csv");
const creditAppsPath = path.join(projectRoot, "data/credit_apps_national_monthly.json");
const coxPath = "/Users/maximodevries/Desktop/codex_source/dbx_ingestion/cox_automotive/cleaned_outputs/Full CoX Data Set_September 09_cleaned.csv";
const salesMonthWeightsPath = path.join(projectRoot, "data/sales_month_allocation_weights.csv");
const templatePath = path.join(projectRoot, "templates", "phase-chain-correlations.template.html");
const outputPath = path.join(projectRoot, "dashboards", "phase-chain-correlations.html");
const studioTemplatePath = path.join(projectRoot, "templates", "phase-chart-studio.template.html");
const studioOutputPath = path.join(projectRoot, "dashboards", "phase-chart-studio.html");

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(cell);
      cell = "";
    } else if (character === "\n") {
      row.push(cell.replace(/\r$/, ""));
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }
  if (cell !== "" || row.length) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows;
}

function numberOrNull(value) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

const matrix = parseCsv(await fs.readFile(csvPath, "utf8"));
const mediaMatrix = parseCsv(await fs.readFile(mediaPath, "utf8"));
const [mediaHeaders, ...mediaData] = mediaMatrix;
const mediaByMonth = new Map(mediaData.map((row) => {
  const record = Object.fromEntries(mediaHeaders.map((header, index) => [header, row[index] ?? ""]));
  return [record.date_month, record];
}));
const creditAppsByMonth = new Map(JSON.parse(await fs.readFile(creditAppsPath, "utf8")));
const coxMatrix = parseCsv(await fs.readFile(coxPath, "utf8"));
const [coxHeaders, ...coxData] = coxMatrix;
const usedCpoByMonth = new Map();
coxData.forEach((row) => {
  const record = Object.fromEntries(coxHeaders.map((header, index) => [header, row[index] ?? ""]));
  if (record.make !== "genesis" || record.dma !== "national") return;
  const value = numberOrNull(record.used_cpo_sales_volume_by_model);
  if (!record.date_month || !Number.isFinite(value)) return;
  usedCpoByMonth.set(record.date_month, (usedCpoByMonth.get(record.date_month) ?? 0) + value);
});
const [headers, ...data] = matrix;
const records = data.map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
const calendarRows = records
  .filter((row) => row.date_month >= "2023-01-01")
  .sort((left, right) => left.date_month.localeCompare(right.date_month))
  .map((row) => {
    const media = mediaByMonth.get(row.date_month) ?? {};
    const retailSales = numberOrNull(row.rdr_sales_volume);
    const usedCpoSales = usedCpoByMonth.get(row.date_month) ?? null;
    return {
      date: row.date_month,
      media_t1t2_spend: numberOrNull(media.t1t2_spend),
      media_t1_spend: numberOrNull(media.t1_spend),
      media_t1_lifestyle_spend: numberOrNull(media.t1_lifestyle_spend),
      media_t1_in_market_spend: numberOrNull(media.t1_in_market_spend),
      media_t2_spend: numberOrNull(media.t2_spend),
      media_t1t2_impressions: numberOrNull(media.t1t2_impressions),
      media_t1_impressions: numberOrNull(media.t1_impressions),
      media_t2_impressions: numberOrNull(media.t2_impressions),
      adops_index_including_make_only: numberOrNull(row.google_adops_index_volume),
      adops_index_excluding_make_only: Number.isFinite(numberOrNull(row.google_adops_index_volume))
        ? numberOrNull(row.google_adops_index_volume) - (numberOrNull(row.google_adops_make_only_index_volume) ?? 0)
        : null,
      research_actions: numberOrNull(row.research_actions),
      shop_actions: numberOrNull(row.shop_actions),
      credit_apps: numberOrNull(row.credit_apps) ?? creditAppsByMonth.get(row.date_month) ?? null,
      retail_sales: retailSales,
      used_cpo_sales: usedCpoSales,
      retail_plus_used_cpo_sales: Number.isFinite(retailSales) && Number.isFinite(usedCpoSales)
        ? retailSales + usedCpoSales
        : null,
      pure_retail: numberOrNull(row.pure_retail_volume),
      non_pure_retail: numberOrNull(row.non_pure_retail_volume),
    };
  });
const salesMonthWeightMatrix = parseCsv(await fs.readFile(salesMonthWeightsPath, "utf8"));
const [salesMonthWeightHeaders, ...salesMonthWeightData] = salesMonthWeightMatrix;
const salesMonthWeights = salesMonthWeightData.map((row) => Object.fromEntries(salesMonthWeightHeaders.map((header, index) => [header, row[index] ?? ""])));
const allocatableFields = [
  "media_t1t2_spend", "media_t1_spend", "media_t1_lifestyle_spend", "media_t1_in_market_spend",
  "media_t2_spend", "media_t1t2_impressions", "media_t1_impressions", "media_t2_impressions",
  "adops_index_including_make_only", "adops_index_excluding_make_only", "research_actions", "shop_actions",
];
const rows = addSalesMonthAllocations(calendarRows, salesMonthWeights, allocatableFields);

if (!rows.length || rows.some((row) => !/^\d{4}-\d{2}-\d{2}$/.test(row.date))) {
  throw new Error("Phase-chain source data is empty or contains invalid dates.");
}

const template = await fs.readFile(templatePath, "utf8");
if (!template.includes("__PHASE_CHAIN_DATA__")) throw new Error("Template data placeholder is missing.");
const studioTemplate = await fs.readFile(studioTemplatePath, "utf8");
if (!studioTemplate.includes("__PHASE_CHAIN_DATA__")) throw new Error("Studio template data placeholder is missing.");
await Promise.all([
  fs.writeFile(outputPath, template.replace("__PHASE_CHAIN_DATA__", JSON.stringify(rows)), "utf8"),
  fs.writeFile(studioOutputPath, studioTemplate.replace("__PHASE_CHAIN_DATA__", JSON.stringify(rows)), "utf8"),
]);

console.log(JSON.stringify({
  output_path: outputPath,
  studio_output_path: studioOutputPath,
  row_count: rows.length,
  earliest_month: rows[0].date,
  latest_month: rows.at(-1).date,
  adops_row_count: rows.filter((row) => Number.isFinite(row.adops_index_including_make_only)).length,
  media_row_count: rows.filter((row) => Number.isFinite(row.media_t1t2_spend)).length,
  used_cpo_sales_row_count: rows.filter((row) => Number.isFinite(row.used_cpo_sales)).length,
  credit_apps_row_count: rows.filter((row) => Number.isFinite(row.credit_apps)).length,
}, null, 2));
