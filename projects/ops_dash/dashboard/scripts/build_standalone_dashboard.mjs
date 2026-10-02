import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(project, "public");
const standaloneDir = path.join(project, "standalone");
const outputDir = path.join(project, "artifacts");
const generatedAssets = path.join(standaloneDir, "dashboard-assets.generated.js");
const bundlePath = path.join(standaloneDir, "dashboard.bundle.js");
const outputPath = path.join(outputDir, "GMA_HMA_Operations_Dashboard.html");

const dataAssets = [
  "operational_context_monthly.json",
  "competitor_efficiency_monthly.json",
  "cox_incentives_monthly.json",
  "cox_segment_incentives_monthly.json",
  "cloudtheory_segment_model_metrics_monthly.json",
  "price_band_trim_allocation_monthly.json",
  "price_band_retail_proxy_monthly.json",
  "national_genesis_dealer_inventory_monthly.json",
  "hyundai_operational_context_monthly.json",
  "hyundai_competitor_efficiency_monthly.json",
  "hyundai_cox_incentives_monthly.json",
  "hyundai_cox_segment_incentives_monthly.json",
  "hyundai_cloudtheory_segment_model_metrics_monthly.json",
  "hyundai_price_band_trim_allocation_monthly.json",
  "hyundai_price_band_retail_proxy_monthly.json",
  "hyundai_national_dealer_inventory_monthly.json",
  "continental_dma_geography.json",
];

function inlineFontUrls(css) {
  return css.replace(/url\(["']?(\/fonts\/[^)"']+)["']?\)/g, (_match, browserPath) => {
    const fontPath = path.join(publicDir, browserPath);
    if (!existsSync(fontPath)) return _match;
    const extension = path.extname(fontPath).slice(1) || "woff2";
    const base64 = readFileSync(fontPath).toString("base64");
    return `url("data:font/${extension};base64,${base64}")`;
  });
}

mkdirSync(standaloneDir, { recursive: true });
mkdirSync(outputDir, { recursive: true });

const embeddedAssets = Object.fromEntries(
  dataAssets.map((asset) => [asset, JSON.parse(readFileSync(path.join(publicDir, asset), "utf8"))]),
);
writeFileSync(generatedAssets, `globalThis.__GMA_DASHBOARD_ASSETS__ = ${JSON.stringify(embeddedAssets)};\n`);

execFileSync(path.join(project, "node_modules", ".bin", "esbuild"), [
  path.join(standaloneDir, "entry.tsx"),
  "--bundle",
  "--format=iife",
  "--platform=browser",
  "--target=es2020",
  `--outfile=${bundlePath}`,
], { stdio: "inherit", cwd: project });

const css = inlineFontUrls(readFileSync(path.join(project, "app", "globals.css"), "utf8"));
const bundle = readFileSync(bundlePath, "utf8").replace(/<\/script/gi, "<\\/script");
const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>GMA & HMA Operations Dashboard</title>
    <style>${css}</style>
  </head>
  <body>
    <div id="root"></div>
    <script>${bundle}</script>
  </body>
</html>`;
writeFileSync(outputPath, html);
rmSync(generatedAssets, { force: true });
rmSync(bundlePath, { force: true });
console.log(outputPath);
