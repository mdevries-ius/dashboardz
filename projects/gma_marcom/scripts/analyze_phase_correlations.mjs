import fs from "node:fs/promises";

const sourcePath = "/Users/maximodevries/Desktop/codex_source/dashboards/projects/gma_marcom/data/governance_gmd_srs_regional_national.csv";

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(cell);
      cell = "";
    } else if (character === "\n") {
      row.push(cell.replace(/\r$/, ""));
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }
  if (cell !== "" || row.length) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows;
}

function pearson(points) {
  const meanX = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const meanY = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  let numerator = 0;
  let denominatorX = 0;
  let denominatorY = 0;
  for (const point of points) {
    const dx = point.x - meanX;
    const dy = point.y - meanY;
    numerator += dx * dy;
    denominatorX += dx ** 2;
    denominatorY += dy ** 2;
  }
  return numerator / Math.sqrt(denominatorX * denominatorY);
}

const matrix = parseCsv(await fs.readFile(sourcePath, "utf8"));
const [header, ...values] = matrix;
const rows = values.map((row) => Object.fromEntries(header.map((name, index) => [name, row[index] ?? ""])));
const nationalTotal = rows
  .filter((row) =>
    row.region_name === "National"
    && row.segment === "Brand"
    && row.model.toLowerCase() === "total"
    && row.date_month <= "2026-07-01"
  )
  .sort((left, right) => left.date_month.localeCompare(right.date_month));

const pairs = [
  { key: "visits_mvas", xField: "visits", xLabel: "T1 Visits", yField: "mvas", yLabel: "MVAs" },
  { key: "mvas_hvas", xField: "mvas", xLabel: "MVAs", yField: "hvas", yLabel: "HVAs" },
  { key: "hvas_t3", xField: "hvas", xLabel: "HVAs", yField: "shift_t3_vdp_views", yLabel: "T3 VDPs" },
  { key: "t3_sales", xField: "shift_t3_vdp_views", xLabel: "T3 VDPs", yField: "srs_sales_volume", yLabel: "Retail Sales" },
];

const result = {};
for (const pair of pairs) {
  const points = nationalTotal.flatMap((row) => {
    const x = Number(row[pair.xField]);
    const y = Number(row[pair.yField]);
    if (!Number.isFinite(x) || !Number.isFinite(y) || x <= 0 || y <= 0) return [];
    return [{ date: row.date_month.slice(0, 7), x, y }];
  });
  result[pair.key] = {
    xLabel: pair.xLabel,
    yLabel: pair.yLabel,
    start: points[0]?.date ?? null,
    end: points.at(-1)?.date ?? null,
    n: points.length,
    r: points.length > 1 ? pearson(points) : null,
    points,
  };
}

const comparison = {};
for (const [key, pair] of Object.entries(result)) {
  const monthly = pair.points.filter((point) => point.date >= "2023-08" && point.date <= "2026-07");
  const quarterGroups = new Map();
  for (const point of monthly) {
    const [year, month] = point.date.split("-").map(Number);
    const quarter = Math.floor((month - 1) / 3) + 1;
    const quarterKey = `${year}-Q${quarter}`;
    const group = quarterGroups.get(quarterKey) ?? [];
    group.push(point);
    quarterGroups.set(quarterKey, group);
  }
  const quarterly = [...quarterGroups.entries()]
    .filter(([, points]) => points.length === 3)
    .map(([quarter, points]) => ({
      quarter,
      x: points.reduce((sum, point) => sum + point.x, 0),
      y: points.reduce((sum, point) => sum + point.y, 0),
    }));
  const monthlyR = pearson(monthly);
  const quarterlyR = pearson(quarterly);
  comparison[key] = {
    monthly_n: monthly.length,
    monthly_r2: monthlyR ** 2,
    complete_quarter_n: quarterly.length,
    quarterly_r2: quarterlyR ** 2,
    first_complete_quarter: quarterly.at(0)?.quarter ?? null,
    last_complete_quarter: quarterly.at(-1)?.quarter ?? null,
  };
}

console.log(JSON.stringify({result, comparison}));
