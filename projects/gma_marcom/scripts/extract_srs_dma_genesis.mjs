import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const projectRoot = "/Users/maximodevries/Desktop/codex_source/dashboards/projects/gma_marcom";
const sqlPath = path.join(projectRoot, "sql", "srs_dma_genesis_source.sql");
const outputPath = path.join(projectRoot, "source", "srs_sales_dma_model_monthly_genesis.csv");
const cliPath = "/Users/maximodevries/Desktop/codex_source/tools/databricks";
const profile = "hma-report";
const warehouseId = "4aaf576b2447fe80";

async function callCli(args) {
  const { stdout } = await execFileAsync(cliPath, args, { maxBuffer: 60 * 1024 * 1024 });
  return JSON.parse(stdout);
}

async function executeSql(statement) {
  const request = {
    warehouse_id: warehouseId,
    statement,
    wait_timeout: "50s",
    disposition: "INLINE",
    format: "JSON_ARRAY",
  };
  let response = await callCli([
    "api", "post", "/api/2.0/sql/statements",
    "--profile", profile,
    "--output", "json",
    "--json", JSON.stringify(request),
  ]);
  const deadline = Date.now() + 180_000;
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
    throw new Error(response.status?.error?.message ?? "SRS extraction failed.");
  }
  if (response.manifest?.truncated) throw new Error("SRS extraction was truncated.");
  return response;
}

function csvCell(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

const sql = (await fs.readFile(sqlPath, "utf8")).trim();
const response = await executeSql(sql);
const columns = response.manifest.schema.columns.map((column) => column.name);
const rows = [...(response.result?.data_array ?? [])];
for (let chunkIndex = 1; chunkIndex < (response.manifest.total_chunk_count ?? 1); chunkIndex += 1) {
  const chunkResponse = await callCli([
    "api", "get", `/api/2.0/sql/statements/${response.statement_id}/result/chunks/${chunkIndex}`,
    "--profile", profile,
    "--output", "json",
  ]);
  const chunkRows = chunkResponse.result?.data_array ?? chunkResponse.data_array ?? [];
  rows.push(...chunkRows);
}
if (rows.length !== response.manifest.total_row_count) {
  throw new Error(`Expected ${response.manifest.total_row_count} rows but received ${rows.length}.`);
}
const lines = [columns.map(csvCell).join(","), ...rows.map((row) => row.map(csvCell).join(","))];
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${lines.join("\n")}\n`, "utf8");
console.log(JSON.stringify({
  statement_id: response.statement_id,
  row_count: rows.length,
  column_count: columns.length,
  output_path: outputPath,
}, null, 2));
