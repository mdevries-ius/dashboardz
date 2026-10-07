import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request("http://localhost/", { headers: { accept: "text/html" } }), { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });
}

test("renders the Tommy Dash governed skeleton", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>Tommy Dash \| HMA KPI Intelligence<\/title>/i);
  assert.match(html, /Daily performance overview/);
  assert.match(html, /Sales Volume/);
  assert.match(html, /Macroeconomic &amp; Other Major Influences/);
  assert.match(html, /Retail Sales \| Retail Share/);
  assert.match(html, /Retail Sales/);
  assert.match(html, /Retail Share/);
  assert.match(html, /Inventory/);
  assert.match(html, /Incentives/);
  assert.match(html, /Macro/);
  assert.match(html, />SUMMARY</);
  assert.match(html, /ILLUSTRATIVE EXECUTIVE SUMMARY/);
  assert.match(html, /September momentum is constructive/);
  assert.match(html, /September 2026/);
  assert.match(html, /Media Spend \| Google Ad Ops/);
  assert.match(html, /Brand Awareness \| Demand \(Consideration \/ Research\)/);
  assert.match(html, /Shopping — Purchase — Loyalty/);
  assert.match(html, /M\/M/);
  assert.match(html, /Y\/Y/);
  assert.match(html, /CYTD/);
  assert.doesNotMatch(html, /MEDIAN/);
  for (const month of ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP"]) assert.match(html, new RegExp(`>${month}<`));
  assert.doesNotMatch(html, /No 2026-09 record|Awaiting governed September feed/);
  assert.doesNotMatch(html, /WHY THIS MATTERS|National calculation rule/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("locks the NH and narrative governance rules into source", async () => {
  const [component, governance] = await Promise.all([
    readFile(new URL("../app/TommyDashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../instructions/data-governance.md", import.meta.url), "utf8"),
  ]);
  assert.match(component, /\["NTL", "National"\]/);
  assert.doesNotMatch(component, /\["NH",/);
  assert.match(governance, /National \(`NTL`\)/);
  assert.match(governance, /September 2026 \(`2026-09`\)/);
  assert.match(governance, /CE, EA, MA, MS, NH, SC, SO, WE/);
  assert.match(governance, /never expose NH/);
  assert.match(governance, /never from an average\s+of regional shares/);
});
