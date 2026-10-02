import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sqlPath = path.join(projectRoot, "sql/export_sales_month_allocation_weights.sql");
const outputPath = path.join(projectRoot, "data/sales_month_allocation_weights.csv");
const cliPath = "/Users/maximodevries/Desktop/codex_source/tools/databricks";
const profile = "hma-report";
const warehouseId = "4aaf576b2447fe80";

async function callCli(args) {
  const { stdout } = await execFileAsync(cliPath, args, { maxBuffer: 20 * 1024 * 1024 });
  return JSON.parse(stdout);
}

let response = await callCli([
  "api", "post", "/api/2.0/sql/statements", "--profile", profile, "--output", "json", "--json",
  JSON.stringify({
    warehouse_id: warehouseId,
    statement: (await fs.readFile(sqlPath, "utf8")).trim(),
    wait_timeout: "50s",
    disposition: "INLINE",
    format: "JSON_ARRAY",
  }),
]);
const deadline = Date.now() + 180_000;
while (["PENDING", "RUNNING"].includes(response.status?.state)) {
  if (Date.now() >= deadline) throw new Error(`Statement ${response.statement_id} timed out.`);
  await new Promise((resolve) => setTimeout(resolve, 1000));
  response = await callCli(["api", "get", `/api/2.0/sql/statements/${response.statement_id}`, "--profile", profile, "--output", "json"]);
}
if (response.status?.state !== "SUCCEEDED") throw new Error(response.status?.error?.message ?? "Sales-month weight extraction failed.");
const columns = response.manifest.schema.columns.map((column) => column.name);
const rows = response.result?.data_array ?? [];
const csv = `${[columns, ...rows].map((row) => row.join(",")).join("\n")}\n`;
await fs.writeFile(outputPath, csv, "utf8");
console.log(JSON.stringify({ output_path: outputPath, row_count: rows.length, statement_id: response.statement_id }, null, 2));
