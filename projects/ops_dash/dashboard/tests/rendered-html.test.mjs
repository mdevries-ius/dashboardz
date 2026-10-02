import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the operational context dashboard", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>GMA Monthly Performance — Operations<\/title>/i);
  assert.match(html, /Average inventory/);
  assert.match(html, /Incentive PNVs/);
  assert.match(html, /Incentive index/);
  assert.match(html, /Inventory share/);
  assert.match(html, /Weighted price/);
  assert.match(html, /Incentive index/);
  assert.match(html, /SOI, SOM and inventory efficiency/);
  assert.match(html, /SOI \/ SOM ratio/);
  assert.match(html, /Inventory &amp; MSRP/);
  assert.match(html, /MSRP index/);
  assert.match(html, /Incentive PNVs<small>National<\/small>/);
  assert.match(html, /Incentive index<small>National · Inventory weighted<\/small>/);
  assert.match(html, /All models/);
  assert.match(html, /Model dynamics/);
  assert.match(html, /Regional dynamics/);
  assert.match(html, /Dealer inventory concentration versus nationwide index 100/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
});

test("ships the approved monthly source data", async () => {
  const json = JSON.parse(await readFile(new URL("../public/operational_context_monthly.json", import.meta.url), "utf8"));
  assert.equal(json.length, 1328);
  assert.equal(json[0].date_month, "2025-01-01");
  assert.equal(json.at(-1).date_month, "2026-09-01");
  assert.ok(json.some((row) => row.region_code === "NTL" && row.entity_level === "Brand"));
  assert.ok(json.every((row) => "weighted_avg_msrp" in row && "msrp_inventory_weighted_index" in row));
  assert.ok(json.every((row) => !["NH", "Unassigned"].includes(row.region_code)));
});

test("ships the competitor efficiency comparison data", async () => {
  const json = JSON.parse(await readFile(new URL("../public/competitor_efficiency_monthly.json", import.meta.url), "utf8"));
  assert.equal(json.length, 800);
  assert.deepEqual([...new Set(json.map((row) => row.brand))].sort(), ["Audi", "BMW", "Genesis", "Lexus", "Mercedes-Benz"]);
  assert.ok(json.every((row) => row.inventory_retail_ratio != null));
  assert.ok(json.every((row) => !["NH", "Unassigned"].includes(row.region_code)));
});

test("ships the refreshed Cox incentive reference", async () => {
  const json = JSON.parse(await readFile(new URL("../public/cox_incentives_monthly.json", import.meta.url), "utf8"));
  assert.ok(json.length >= 130);
  assert.equal(json[0].date_month, "2025-01-01");
  assert.equal(json.at(-1).date_month, "2026-08-01");
  assert.ok(json.some((row) => row.entity_level === "Brand" && Math.round(row.incentive_index) === 115));
  assert.ok(json.every((row) => row.geo_level === "National"));
});

test("ships Cox model comparisons for Genesis segments", async () => {
  const json = JSON.parse(await readFile(new URL("../public/cox_segment_incentives_monthly.json", import.meta.url), "utf8"));
  const gv70Segment = json.filter((row) => row.date_month === "2026-08-01" && row.segment === "near luxury suv");
  assert.ok(json.length >= 1500);
  assert.ok(gv70Segment.length >= 10);
  assert.ok(gv70Segment.some((row) => row.make_model === "genesis_gv70" && Math.round(row.incentive_index) === 83));
  assert.ok(gv70Segment.some((row) => row.make_model === "bmw_x3"));
});

test("ships CloudTheory peer comparisons for SOI and MSRP index tooltips", async () => {
  const json = JSON.parse(await readFile(new URL("../public/cloudtheory_segment_model_metrics_monthly.json", import.meta.url), "utf8"));
  const gv70Segment = json.filter((row) => row.date_month === "2026-08-01" && row.region_code === "NTL" && row.segment === "Near Luxury SUV");
  assert.ok(json.length >= 12000);
  assert.ok(gv70Segment.some((row) => row.make === "genesis" && row.model_series === "gv70"));
  assert.ok(gv70Segment.some((row) => row.make === "bmw"));
  assert.ok(gv70Segment.every((row) => row.inventory_share != null && row.msrp_index != null));
});

test("ships trim-level advertised-price data for the price-band chart", async () => {
  const json = JSON.parse(await readFile(new URL("../public/price_band_trim_allocation_monthly.json", import.meta.url), "utf8"));
  const gv80 = json.filter((row) => row.date_month === "2026-08-01" && row.make === "genesis" && row.model === "gv80");
  assert.ok(json.length >= 11000);
  assert.ok(gv80.length >= 10);
  assert.ok(gv80.some((row) => row.trim === "3.5T Prestige Signature" && row.weighted_advertised_price > 80000));
  assert.ok(gv80.every((row) => row.segment === "Mid Luxury SUV" && row.average_inventory > 0));
});

test("ships the national dealer heatmap references", async () => {
  const inventory = JSON.parse(await readFile(new URL("../public/national_genesis_dealer_inventory_monthly.json", import.meta.url), "utf8"));
  const geography = JSON.parse(await readFile(new URL("../public/continental_dma_geography.json", import.meta.url), "utf8"));
  assert.ok(inventory.length >= 4900);
  assert.ok(geography.length >= 200);
  assert.ok(geography.every((dma) => dma.polygons.length && Number.isFinite(dma.centroid_latitude) && Number.isFinite(dma.centroid_longitude)));
  assert.ok(inventory.every((row) => Number.isFinite(row.latitude) && Number.isFinite(row.longitude)));
  assert.ok(inventory.some((row) => row.state_province === "CA"));
  assert.ok(inventory.some((row) => row.state_province === "NY"));
});
