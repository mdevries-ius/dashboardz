import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {sanitizeDemandHtml} from './build_demand_page.mjs';
const title = '<title>Genesis Sales Intelligence — Demand</title>';
test('public export removes user paths but preserves source identity', () => {
  const input = title + ' /Users/example/Desktop/project/Model Trend.xlsx /Workspace/Users/example@example.com/Library/Agents/code/agent_marketview';
  const html = sanitizeDemandHtml(input);
  assert.ok(html.includes('Model Trend.xlsx'));
  assert.ok(html.includes('Library/Agents/code/agent_marketview'));
  assert.ok(!html.includes('/Users/'));
  assert.ok(!html.includes('example@example.com'));
});
test('unexpected paths, secrets and full Operations exports fail closed', () => {
  for (const detail of ['/Users/unexpected/data.csv', 'Bearer secret-value', '__GMA_DASHBOARD_ASSETS__']) {
    assert.throws(() => sanitizeDemandHtml(title + detail));
  }
  assert.throws(() => sanitizeDemandHtml('<title>Operations</title>'));
});
test('published Demand HTML is standalone and its JavaScript still parses', () => {
  const html = fs.readFileSync(new URL('../../docs/1047/index.html', import.meta.url), 'utf8');
  assert.equal(sanitizeDemandHtml(html), html);
  assert.ok(Buffer.byteLength(html) < 25 * 1024 * 1024);
  const js = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
  assert.doesNotThrow(() => new vm.Script(js));
});
