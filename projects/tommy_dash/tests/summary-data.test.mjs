import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const data = JSON.parse(await readFile(new URL("../public/data/summary_metrics.json", import.meta.url), "utf8"));

test("publishes September records for every Summary metric", () => {
  const metrics = ["retail_sales", "retail_share", "inventory", "incentives", "media_spend", "google_adops", "macro_rate"];
  assert.equal(data.default_period, "2026-09");
  for (const metric of metrics) {
    assert.equal(data.sources[metric].through, "2026-09", `${metric} source freshness`);
    assert.ok(data.records.some((row) => row.metric === metric && row.month === "2026-09"), `${metric} September record`);
  }
});

test("keeps NH in National governance but out of selectors", () => {
  assert.ok(data.governance.national_regions.includes("NH"));
  assert.ok(!data.regions.includes("NH"));
  assert.ok(!data.governance.selectable_regions.includes("NH"));
  assert.match(data.governance.share_method, /total SRS industry retail units/);
});

test("calculates September National retail share against the full industry", () => {
  const share = data.records.find((row) => row.metric === "retail_share" && row.month === "2026-09" && row.model === "All Hyundai" && row.region === "NTL");
  const sales = data.records.find((row) => row.metric === "retail_sales" && row.month === "2026-09" && row.model === "All Hyundai" && row.region === "NTL");
  assert.equal(sales.value, 60022);
  assert.equal(share.industry_retail_units, 1115704);
  assert.ok(Math.abs(share.value - (60022 / 1115704)) < 1e-12);
});

test("uses the approved upstream source contracts", () => {
  assert.equal(data.sources.retail_sales.table, "ius_unity_prod.sandbox.agent_srs");
  assert.equal(data.sources.inventory.table, "ius_unity_prod.sandbox.agent_cloudtheory");
  assert.equal(data.sources.incentives.table, "ius_unity_prod.sandbox.cox_alldataalltime");
  assert.equal(data.sources.google_adops.table, "ius_unity_prod.google_datamart.ad_opportunity_regional_daily");
  assert.equal(data.sources.media_spend.table, "ius_unity_prod.media_datamart.hma_t1_t2_bank_impressions_line_item");
});

test("provides January through September chart history", () => {
  for (const metric of ["retail_sales", "retail_share", "inventory", "incentives", "media_spend", "google_adops", "macro_rate"]) {
    const months = data.records
      .filter((row) => row.metric === metric && row.model === "All Hyundai" && row.region === "NTL" && row.month.startsWith("2026-"))
      .map((row) => row.month)
      .sort();
    assert.deepEqual(months, ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"], metric);
  }
});
