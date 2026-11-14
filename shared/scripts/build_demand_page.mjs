// Package the existing Demand-only export for the collection's GitHub Pages site.
// Usage: node shared/scripts/build_demand_page.mjs /path/to/GMA_Demand_Dashboard.html
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

export function sanitizeDemandHtml(input) {
  if (!input.includes('<title>Genesis Sales Intelligence — Demand</title>')) {
    throw new Error('Expected the Demand-only dashboard, not the full Operations export.');
  }
  let html = input
    .replace(/\/Users\/[^"<>\\]*?\/Model Trend\.xlsx/g, 'Model Trend.xlsx')
    .replace(/\/Workspace\/Users\/[^/"<>\\]+\/Library\/Agents\/code\/agent_marketview/g, 'Library/Agents/code/agent_marketview');
  const forbidden = [
    /\/Users\//i, /\/private\/(?:tmp|var)\//i, /\bcodex\b/i,
    /chatgpt\.site/i, /[\w.+-]+@innoceanusa\.com/i,
    /Bearer\s+[a-zA-Z0-9._-]+/i, /DATABRICKS_TOKEN/i,
    /-----BEGIN (?:RSA |OPENSSH )?PRIVATE KEY/i,
    /__GMA_DASHBOARD_ASSETS__/,
    /data:application\/vnd\.openxmlformats-officedocument\.presentationml/
  ];
  for (const marker of forbidden) {
    if (marker.test(html)) throw new Error(`Private or out-of-scope content remains: ${marker}`);
  }
  return html;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv[2]) throw new Error('Pass the existing Demand-only HTML export.');
  const html = sanitizeDemandHtml(fs.readFileSync(process.argv[2], 'utf8'));
  const output = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/1047');
  fs.mkdirSync(output, {recursive: true});
  fs.writeFileSync(path.join(output, 'index.html'), html);
  console.log(JSON.stringify({page: 'docs/1047/index.html', bytes: Buffer.byteLength(html), sha256: createHash('sha256').update(html).digest('hex')}));
}
