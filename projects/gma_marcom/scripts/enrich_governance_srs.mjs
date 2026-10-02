import fs from "node:fs/promises";

const projectRoot = "/Users/maximodevries/Desktop/codex_source/dashboards/projects/gma_marcom";
const sourcePath = `${projectRoot}/source/srs_sales_dma_model_monthly_genesis.csv`;
const targetPath = `${projectRoot}/data/governance_gmd_srs_regional_national.csv`;
const tempPath = `${targetPath}.tmp`;
const removeColumns = new Set(["powertrain", "company", "month", "date_month_key", "region_type"]);

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell.replace(/\r$/, ""));
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (cell !== "" || row.length) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows;
}

function csvCell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toObjects(matrix) {
  const [header, ...data] = matrix;
  return { header, rows: data.map((values) => Object.fromEntries(header.map((name, i) => [name, values[i] ?? ""]))) };
}

function governanceModel(iusMakeModel) {
  const explicit = {
    genesis_electrified_g80: "g80_ev",
    genesis_electrified_gv70: "gv70_ev",
  };
  if (explicit[iusMakeModel]) return explicit[iusMakeModel];
  if (iusMakeModel === "genesis_vinundecodedgenesis") return null;
  return iusMakeModel.startsWith("genesis_") ? iusMakeModel.slice("genesis_".length) : null;
}

function add(map, key, value) {
  map.set(key, (map.get(key) ?? 0) + value);
}

const source = toObjects(parseCsv(await fs.readFile(sourcePath, "utf8")));
const target = toObjects(parseCsv(await fs.readFile(targetPath, "utf8")));
const sales = new Map();

for (const row of source.rows) {
  const model = governanceModel(row.ius_make_model);
  if (!model || row.srs_sales_volume === "") continue;
  const value = Number(row.srs_sales_volume);
  if (!Number.isFinite(value)) throw new Error(`Invalid SRS value: ${row.srs_sales_volume}`);
  add(sales, `${row.date_month}|US|${model}`, value);
  if (row.ius_adi_region && row.ius_adi_region.toLowerCase() !== "unassigned") {
    add(sales, `${row.date_month}|${row.ius_adi_region}|${model}`, value);
  }
}

let filled = 0;
let retained = 0;
let unmappedMissing = 0;
let overlapCompared = 0;
let overlapExact = 0;
let overlapAbsoluteDifference = 0;
const fillsByModel = new Map();
const fillsByYear = new Map();

for (const row of target.rows) {
  const key = `${row.date_month}|${row.region_code}|${row.model}`;
  const sourceValue = sales.get(key);
  if (row.srs_sales_volume !== "") {
    retained += 1;
    if (sourceValue !== undefined && Number.isFinite(Number(row.srs_sales_volume))) {
      const difference = Math.abs(Number(row.srs_sales_volume) - sourceValue);
      overlapCompared += 1;
      overlapAbsoluteDifference += difference;
      if (difference < 0.000001) overlapExact += 1;
    }
  } else if (sourceValue !== undefined) {
    row.srs_sales_volume = String(sourceValue);
    filled += 1;
    fillsByModel.set(row.model, (fillsByModel.get(row.model) ?? 0) + 1);
    const year = row.date_month.slice(0, 4);
    fillsByYear.set(year, (fillsByYear.get(year) ?? 0) + 1);
  } else {
    unmappedMissing += 1;
  }
}

const outputHeader = target.header.filter((name) => !removeColumns.has(name));
const outputLines = [
  outputHeader.map(csvCell).join(","),
  ...target.rows.map((row) => outputHeader.map((name) => csvCell(row[name])).join(",")),
];
await fs.writeFile(tempPath, `${outputLines.join("\n")}\n`, "utf8");
await fs.rename(tempPath, targetPath);

console.log(JSON.stringify({
  source_rows: source.rows.length,
  output_rows: target.rows.length,
  output_columns: outputHeader,
  retained_existing_values: retained,
  filled_missing_values: filled,
  remaining_blank_values: unmappedMissing,
  fills_by_model: Object.fromEntries([...fillsByModel].sort()),
  fills_by_year: Object.fromEntries([...fillsByYear].sort()),
  overlap_compared: overlapCompared,
  overlap_exact: overlapExact,
  overlap_average_absolute_difference: overlapCompared ? overlapAbsoluteDifference / overlapCompared : null,
  output_path: targetPath,
}, null, 2));
