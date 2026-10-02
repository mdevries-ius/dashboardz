import fs from "node:fs/promises";

const projectRoot = "/Users/maximodevries/Desktop/codex_source/dashboards/projects/gma_marcom";
const sourcePath = `${projectRoot}/source/gmd_base_metrics_regional_national.csv`;
const targetPath = `${projectRoot}/data/governance_gmd_srs_regional_national.csv`;
const tempPath = `${targetPath}.tmp`;

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
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell.replace(/\r$/, ""));
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  if (cell !== "" || row.length) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows;
}

function toObjects(matrix) {
  const [header, ...data] = matrix;
  return { header, rows: data.map((values) => Object.fromEntries(header.map((name, i) => [name, values[i] ?? ""]))) };
}

function csvCell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function key(row) {
  return [
    row.date_month,
    row.segment,
    row.make,
    row.model,
    row.make_model,
    row.model_family,
    row.region_name,
  ].join("|");
}

const source = toObjects(parseCsv(await fs.readFile(sourcePath, "utf8")));
const target = toObjects(parseCsv(await fs.readFile(targetPath, "utf8")));
const byKey = new Map(source.rows.map((row) => [key(row), row]));
const metrics = ["visits", "hvas", "mvas", "vdp_t1", "shift_t3_vdp_views"];
const populated = Object.fromEntries(metrics.map((metric) => [metric, 0]));

for (const row of target.rows) {
  const match = byKey.get(key(row));
  if (!match) throw new Error(`Missing GMD grain row for ${key(row)}`);
  for (const metric of metrics) {
    row[metric] = match[metric] ?? "";
    if (row[metric] !== "") populated[metric] += 1;
  }
}

const outputHeader = target.header
  .filter((name) => !["region_code", "parent_region_code", ...metrics].includes(name))
  .concat(metrics);
const outputLines = [
  outputHeader.map(csvCell).join(","),
  ...target.rows.map((row) => outputHeader.map((name) => csvCell(row[name])).join(",")),
];
await fs.writeFile(tempPath, `${outputLines.join("\n")}\n`, "utf8");
await fs.rename(tempPath, targetPath);

console.log(JSON.stringify({
  output_rows: target.rows.length,
  output_columns: outputHeader,
  populated_values: populated,
  output_path: targetPath,
}, null, 2));
