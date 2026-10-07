import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const htmlPath = new URL("../output/local_hosting/index.html", import.meta.url);

test("builds one self-contained local dashboard HTML file", async () => {
  const html = await readFile(htmlPath, "utf8");
  assert.match(html, /data-tommy-local-dashboard/);
  assert.match(html, /Tommy Dash \| Local HMA KPI Intelligence/);
  for (const label of ["Summary", "Sales Volume", "Market Share", "Media", "Operations", "Macroeconomic & Other Major Influences", "Awareness & Opinion", "Consideration & Research", "Shopping", "Purchase", "Loyalty"]) {
    assert.match(html, new RegExp(`label":"${label}`));
  }
  assert.match(html, /data:font\/woff2;base64,/);
  assert.match(html, /PRODUCT & RELEASE CONTEXT/);
  assert.match(html, /MACRO & INDUSTRY CONTEXT/);
  assert.match(html, /ILLUSTRATIVE EXECUTIVE SUMMARY/);
  assert.match(html, /September momentum is constructive/);
  assert.match(html, /Illustrative headlines/);
  assert.match(html, /Retail Sales \| Retail Share/);
  assert.match(html, /Inventory \| Incentives \| Macro\/Competitive/);
  assert.match(html, /Media Spend \| Google Ad Ops/);
  assert.match(html, /Brand Awareness \| Demand \(Consideration \/ Research\)/);
  assert.match(html, /Shopping — Purchase — Loyalty/);
  assert.match(html, /Data connection deferred/);
  assert.match(html, /Incentive PNVS/);
  assert.match(html, /metric-comparisons/);
  assert.doesNotMatch(html, /MEDIAN/);
  assert.match(html, /<small>M\/M<\/small>/);
  assert.match(html, /ius_unity_prod\.sandbox\.agent_srs/);
  assert.match(html, /ius_unity_prod\.sandbox\.cox_alldataalltime/);
  assert.match(html, /ius_unity_prod\.sandbox\.agent_cloudtheory/);
  assert.match(html, /ius_unity_prod\.google_datamart\.ad_opportunity_regional_daily/);
  assert.doesNotMatch(html, /Awaiting governed September feed/);
  assert.doesNotMatch(html, /INDUSTRY PULSE/);
  assert.doesNotMatch(html, /WHY THIS MATTERS/);
  assert.doesNotMatch(html, /National calculation rule/);
  assert.doesNotMatch(html, /src=["']https?:\/\//i);
  assert.doesNotMatch(html, /<option value="NH">/);
});
