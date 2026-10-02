import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("the application routes visitors to the governed dashboard asset", async () => {
  const page = await readFile(new URL("app/page.tsx", root), "utf8");
  assert.match(page, /redirect\("\/quadchart\.html"\)/);
});

test("the hostable dashboard contains the executive insight layer", async () => {
  const html = await readFile(new URL("public/quadchart.html", root), "utf8");
  assert.match(html, /EXECUTIVE READOUT/);
  assert.match(html, /id="insightHeading"/);
  assert.match(html, /class="insight-summary"/);
  assert.match(html, /const INSIGHT_CACHE=/);
  assert.match(html, /function renderInsight\(/);
  assert.match(html, /CALCULATED SUMMARY/);
  assert.match(html, /Demand × inventory/);
  assert.match(html, /Conversion efficiency/);
});

test("the public artifact is static and contains no private connection material", async () => {
  const html = await readFile(new URL("public/quadchart.html", root), "utf8");
  for (const marker of [
    "file://",
    "/Users/",
    "localhost",
    "ius_unity_prod.",
    "DATABRICKS_TOKEN",
    "Bearer ",
    "/serving-endpoints/",
    "mas-ed862019-endpoint",
  ]) {
    assert.doesNotMatch(html, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});
