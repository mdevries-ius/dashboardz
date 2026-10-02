import crypto from "node:crypto";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = "/Users/maximodevries/Desktop/codex_source/tools/databricks";
const profile = process.env.DATABRICKS_CONFIG_PROFILE ?? "hma-report";
const warehouseId = process.env.DATABRICKS_WAREHOUSE_ID ?? "4aaf576b2447fe80";
const sqlPath = path.join(projectRoot, "sql/export_marcom_funnel_correlations.sql");
const outputPath = path.join(projectRoot, "data/marcom_funnel_correlations_national_total.csv");
const manifestPath = `${outputPath}.manifest.json`;

async function callCli(args) {
  const { stdout } = await execFileAsync(cliPath, args, { maxBuffer: 75 * 1024 * 1024 });
  return JSON.parse(stdout);
}

async function executeSql(statement) {
  let response = await callCli([
    "api", "post", "/api/2.0/sql/statements",
    "--profile", profile,
    "--output", "json",
    "--json", JSON.stringify({
      warehouse_id: warehouseId,
      statement,
      wait_timeout: "50s",
      disposition: "INLINE",
      format: "JSON_ARRAY",
    }),
  ]);
  const deadline = Date.now() + 300_000;
  while (["PENDING", "RUNNING"].includes(response.status?.state)) {
    if (Date.now() >= deadline) throw new Error(`Statement ${response.statement_id} timed out.`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    response = await callCli([
      "api", "get", `/api/2.0/sql/statements/${response.statement_id}`,
      "--profile", profile,
      "--output", "json",
    ]);
  }
  if (response.status?.state !== "SUCCEEDED") {
    throw new Error(response.status?.error?.message ?? "Databricks SQL statement failed.");
  }
  const columns = response.manifest.schema.columns.map((column) => column.name);
  const rows = [...(response.result?.data_array ?? [])];
  for (let chunkIndex = 1; chunkIndex < (response.manifest.total_chunk_count ?? 1); chunkIndex += 1) {
    const chunk = await callCli([
      "api", "get", `/api/2.0/sql/statements/${response.statement_id}/result/chunks/${chunkIndex}`,
      "--profile", profile,
      "--output", "json",
    ]);
    rows.push(...(chunk.result?.data_array ?? chunk.data_array ?? []));
  }
  return { columns, rows, statementId: response.statement_id };
}

function csvCell(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

const sql = (await fs.readFile(sqlPath, "utf8")).trim();
const response = await executeSql(sql);
if (!response.rows.length) throw new Error("Correlation extract returned no rows.");
await fs.mkdir(path.dirname(outputPath), { recursive: true });
const csv = `${[
  response.columns.map(csvCell).join(","),
  ...response.rows.map((row) => row.map(csvCell).join(",")),
].join("\n")}\n`;
await fs.writeFile(outputPath, csv, "utf8");

const manifest = {
  extracted_at_utc: new Date().toISOString(),
  source_sql: path.relative(projectRoot, sqlPath),
  source_sql_sha256: crypto.createHash("sha256").update(sql).digest("hex"),
  statement_id: response.statementId,
  row_count: response.rows.length,
  columns: response.columns,
  extract_earliest_month: response.rows[0][0],
  extract_latest_month: response.rows.at(-1)[0],
  output_csv: path.relative(projectRoot, outputPath),
  output_csv_sha256: crypto.createHash("sha256").update(csv).digest("hex"),
};
await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ...manifest, manifest_path: path.relative(projectRoot, manifestPath) }, null, 2));
