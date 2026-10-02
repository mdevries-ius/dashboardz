"use client";

import { type MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Row = {
  date_month: string;
  geo_level: "National" | "Region";
  region_code: string;
  region_name: string;
  entity_level: "Brand" | "Model";
  brand: string;
  model_series: string;
  display_name: string;
  segment: string;
  average_inventory: number;
  market_average_inventory: number;
  inventory_share: number;
  weighted_avg_msrp: number | null;
  market_weighted_avg_msrp: number | null;
  msrp_inventory_weighted_index: number | null;
  weighted_avg_price: number | null;
  market_weighted_avg_price: number | null;
  price_inventory_weighted_index: number | null;
  retail_sales: number | null;
  market_retail_sales: number | null;
  retail_share: number | null;
  inventory_retail_ratio: number | null;
  average_inventory_mom_pct: number | null;
  average_inventory_yoy_pct: number | null;
  inventory_share_mom_pp: number | null;
  inventory_share_yoy_pp: number | null;
  weighted_avg_msrp_mom_pct: number | null;
  weighted_avg_msrp_yoy_pct: number | null;
  msrp_inventory_weighted_index_mom_delta: number | null;
  msrp_inventory_weighted_index_yoy_delta: number | null;
  weighted_avg_price_mom_pct: number | null;
  weighted_avg_price_yoy_pct: number | null;
  price_inventory_weighted_index_mom_delta: number | null;
  price_inventory_weighted_index_yoy_delta: number | null;
  retail_sales_mom_pct: number | null;
  retail_sales_yoy_pct: number | null;
  retail_share_mom_pp: number | null;
  retail_share_yoy_pp: number | null;
  inventory_retail_ratio_mom_delta: number | null;
  inventory_retail_ratio_yoy_delta: number | null;
};

type CompetitorRow = {
  date_month: string;
  geo_level: "National" | "Region";
  region_code: string;
  region_name: string;
  brand: string;
  inventory_share: number | null;
  retail_share: number | null;
  inventory_retail_ratio: number | null;
};

type CoxRow = {
  date_month: string;
  geo_level: "National";
  region_code: "NTL";
  region_name: "National";
  entity_level: "Brand" | "Model";
  brand: string;
  model_series: string;
  display_name: string;
  segment: string;
  incentive_pnv: number | null;
  incentive_index: number | null;
  incentive_pnv_mom_pct: number | null;
  incentive_pnv_yoy_pct: number | null;
  incentive_index_mom_delta: number | null;
  incentive_index_yoy_delta: number | null;
};

type CoxSegmentRow = {
  date_month: string;
  segment: string;
  make: string;
  make_model: string;
  incentive_pnv: number | null;
  incentive_index: number | null;
  incentive_pnv_mom_pct: number | null;
  incentive_pnv_yoy_pct: number | null;
  incentive_index_mom_delta: number | null;
  incentive_index_yoy_delta: number | null;
};

type CloudTheorySegmentRow = {
  date_month: string;
  geo_level: "National" | "Region";
  region_code: string;
  region_name: string;
  segment: string;
  make: string;
  model_series: string;
  average_inventory: number | null;
  inventory_share: number | null;
  weighted_avg_msrp: number | null;
  msrp_index: number | null;
  weighted_avg_price: number | null;
  price_index: number | null;
  inventory_share_mom_pp: number | null;
  inventory_share_yoy_pp: number | null;
  msrp_index_mom_delta: number | null;
  msrp_index_yoy_delta: number | null;
  price_index_mom_delta: number | null;
  price_index_yoy_delta: number | null;
};

type PriceBandRow = {
  date_month: string;
  segment: string;
  make: string;
  model: string;
  trim: string;
  average_inventory: number;
  weighted_advertised_price: number;
};

type PriceBandRetailRow = {
  date_month: string;
  segment: string;
  make: string;
  model: string;
  average_inventory: number;
  weighted_advertised_price: number;
  retail_sales: number;
};

type CaliforniaDealerRow = {
  month: string;
  seller_id: string;
  dealer_name: string;
  city: string;
  state_province: string;
  postal_code: string;
  dma_code: string;
  dma_name: string;
  latitude: number;
  longitude: number;
  average_inventory: number;
};

type GeoPoint = { latitude: number; longitude: number };
type DmaGeography = {
  dma_id: string;
  dma_name: string;
  centroid_latitude: number;
  centroid_longitude: number;
  polygons: GeoPoint[][];
};

const REGION_ORDER = ["NTL", "CE", "EA", "MA", "MS", "SC", "SO", "WE"];
const BRAND_CONFIG = {
  genesis: { label: "Genesis", lockup: "GENESIS", short: "GMA" },
  hyundai: { label: "Hyundai", lockup: "HYUNDAI", short: "HMA" },
} as const;

type EmbeddedDashboardAssets = Record<string, unknown>;

function loadDashboardAsset<T>(assetName: string): Promise<T> {
  const embeddedAssets = (globalThis as typeof globalThis & { __GMA_DASHBOARD_ASSETS__?: EmbeddedDashboardAssets }).__GMA_DASHBOARD_ASSETS__;
  if (embeddedAssets?.[assetName] !== undefined) return Promise.resolve(embeddedAssets[assetName] as T);
  return fetch(`/${assetName}`).then((response) => response.json() as Promise<T>);
}
const COMPETITOR_ORDER = ["Genesis", "BMW", "Mercedes-Benz", "Lexus", "Audi", "Hyundai", "Honda", "Toyota", "Kia", "Nissan"];

const pct = (value: number | null | undefined, digits = 1) =>
  value == null ? "—" : new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);
const integer = (value: number | null | undefined) =>
  value == null ? "—" : new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
const currency = (value: number | null | undefined) =>
  value == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
const indexValue = (value: number | null | undefined) => value == null ? "—" : value.toFixed(1);
const wholeIndex = (value: number | null | undefined) => value == null ? "—" : Math.round(value).toLocaleString("en-US");
const ratio = (value: number | null | undefined) => value == null ? "—" : `${value.toFixed(2)}x`;
const signedPct = (value: number | null | undefined) => value == null ? "—" : `${value >= 0 ? "+" : ""}${pct(value, 1)}`;
const signedPp = (value: number | null | undefined) => value == null ? "—" : `${value >= 0 ? "+" : ""}${(value * 100).toFixed(2)} pp`;
const signedRatio = (value: number | null | undefined) => value == null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}x`;
const signedPoints = (value: number | null | undefined) => value == null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(1)} pts`;
const monthDate = (iso: string | null | undefined) => iso ? new Date(`${iso}T00:00:00Z`) : null;
const monthLabel = (iso: string | null | undefined, short = false) => {
  const date = monthDate(iso);
  return date && !Number.isNaN(date.valueOf()) ? new Intl.DateTimeFormat("en-US", { month: short ? "short" : "long", year: "numeric", timeZone: "UTC" }).format(date) : "Reporting month";
};
const chartMonthLabel = (iso: string | null | undefined) => {
  const date = monthDate(iso);
  return date && !Number.isNaN(date.valueOf()) ? new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(date) : "—";
};
const chartYearLabel = (iso: string | null | undefined) => {
  const date = monthDate(iso);
  return date && !Number.isNaN(date.valueOf()) ? new Intl.DateTimeFormat("en-US", { year: "2-digit", timeZone: "UTC" }).format(date) : "—";
};
const shiftMonth = (iso: string, offset: number) => {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 10);
};
const compactPp = (value: number | null | undefined) => value == null ? "—" : `${value >= 0 ? "+" : ""}${(value * 100).toFixed(Math.abs(value * 100) < 10 ? 1 : 0)}pp`;

type DownloadRow = Record<string, string | number | null | undefined>;

function downloadCsv(filename: string, rows: DownloadRow[]) {
  if (!rows.length) return;
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const escape = (value: DownloadRow[string]) => {
    const text = value == null ? "" : String(value);
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  const csv = [headers.join(","), ...rows.map((row) => headers.map((header) => escape(row[header])).join(","))].join("\n");
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(anchor.href);
}

function DataDownloadButton({ filename, rows }: { filename: string; rows: DownloadRow[] }) {
  return <button className="data-download-button" type="button" onClick={() => downloadCsv(filename, rows)} disabled={!rows.length}>Download data</button>;
}

function Change({ value, unit }: { value: number | null | undefined; unit: "pct" | "pp" | "ratio" | "points" }) {
  const text = unit === "pct" ? signedPct(value) : unit === "pp" ? signedPp(value) : unit === "points" ? signedPoints(value) : signedRatio(value);
  const tone = value == null ? "neutral" : value > 0 ? "positive" : value < 0 ? "negative" : "neutral";
  return <span className={`change ${tone}`}>{text}</span>;
}

type MetricKey = keyof Pick<Row,
  | "average_inventory"
  | "inventory_share"
  | "weighted_avg_msrp"
  | "weighted_avg_price"
  | "msrp_inventory_weighted_index"
  | "price_inventory_weighted_index"
  | "average_inventory_mom_pct"
  | "average_inventory_yoy_pct"
  | "inventory_share_mom_pp"
  | "inventory_share_yoy_pp"
  | "weighted_avg_msrp_mom_pct"
  | "weighted_avg_msrp_yoy_pct"
  | "weighted_avg_price_mom_pct"
  | "weighted_avg_price_yoy_pct"
  | "msrp_inventory_weighted_index_mom_delta"
  | "msrp_inventory_weighted_index_yoy_delta"
  | "price_inventory_weighted_index_mom_delta"
  | "price_inventory_weighted_index_yoy_delta"
>;

function RegionalMetricCard({
  title,
  source,
  national,
  regions,
  valueKey,
  momKey,
  yoyKey,
  valueFormatter,
  changeUnit,
  regionsVisible,
}: {
  title: string;
  source: string;
  national: Row | undefined;
  regions: Row[];
  valueKey: MetricKey;
  momKey: MetricKey;
  yoyKey: MetricKey;
  valueFormatter: (value: number | null | undefined) => string;
  changeUnit: "pct" | "pp" | "points";
  regionsVisible: boolean;
}) {
  const get = (row: Row | undefined, key: MetricKey) => row?.[key];
  const metric = (row: Row, locationClass = "") => <div className={`metric-location-row ${locationClass}`} key={`${title}-${row.region_code}`}>
    <b className="location-name">{row.region_name}</b>
    <div className="location-metric">
      <strong>{valueFormatter(get(row, valueKey))}</strong>
      <div className="location-comps"><span><small>M/M</small><Change value={get(row, momKey)} unit={changeUnit} /></span><span><small>Y/Y</small><Change value={get(row, yoyKey)} unit={changeUnit} /></span></div>
    </div>
  </div>;
  return <section className="share-scorecard">
    <div className="share-scorecard-heading">
      <span>{title}</span>
      <div className="scorecard-heading-actions">
        <small>{source}</small>
      </div>
    </div>
    {national ? metric(national, "national-share") : null}
    {regionsVisible ? <div className="region-share-list">{regions.map((row) => metric(row))}</div> : null}
  </section>;
}

function NationalMetricCard({
  title,
  source,
  value,
  mom,
  yoy,
  valueFormatter,
  changeUnit,
}: {
  title: string;
  source: string;
  value: number | null | undefined;
  mom: number | null | undefined;
  yoy: number | null | undefined;
  valueFormatter: (value: number | null | undefined) => string;
  changeUnit: "pct" | "points";
}) {
  return <section className="share-scorecard national-only-card">
    <div className="share-scorecard-heading"><span>{title}</span><small>{source}</small></div>
    <div className="metric-location-row national-share">
      <b className="location-name">National</b>
      <div className="location-metric">
        <strong>{valueFormatter(value)}</strong>
        <div className="location-comps"><span><small>M/M</small><Change value={mom} unit={changeUnit} /></span><span><small>Y/Y</small><Change value={yoy} unit={changeUnit} /></span></div>
      </div>
    </div>
  </section>;
}

function InsightsPanel({ national, cox, models, regions, coxModels, brandKey, brandLabel }: { national: Row | undefined; cox: CoxRow | undefined; models: Row[]; regions: Row[]; coxModels: CoxRow[]; brandKey: string; brandLabel: string }) {
  if (!national) return <section className="insights-card" aria-label="National brand insights">
    <div className="insights-heading"><div><span>Insights</span><small>National</small></div><b>Data-generated summary</b></div>
    <p className="brand-insight">Loading the national brand summary.</p>
    <div className="insight-columns"><div><h3>Model dynamics</h3></div><div><h3>Regional dynamics</h3></div></div>
  </section>;
  const movePct = (value: number | null | undefined) => value == null ? "was unchanged" : `${value >= 0 ? "rose" : "fell"} ${pct(Math.abs(value), 1)}`;
  const movePoints = (value: number | null | undefined) => value == null ? "was unchanged" : `${value >= 0 ? "increased" : "declined"} ${Math.abs(value).toFixed(1)} points`;
  const coxByModel = new Map(coxModels.map((row) => [row.model_series.replace(new RegExp(`^${brandKey}_`), ""), row]));
  const incentiveDrag = models
    .map((row) => ({ row, incentive: coxByModel.get(row.model_series) }))
    .filter((item) => item.incentive?.incentive_index_mom_delta != null)
    .sort((a, b) => ((a.incentive?.incentive_index_mom_delta ?? 0) * a.row.average_inventory) - ((b.incentive?.incentive_index_mom_delta ?? 0) * b.row.average_inventory))[0];
  const secondModel = [...models].filter((row) => row.model_series !== incentiveDrag?.row.model_series).sort((a, b) => b.average_inventory - a.average_inventory)[0];
  const largestRegion = [...regions].sort((a, b) => b.average_inventory - a.average_inventory)[0];
  const softestRegion = [...regions].filter((row) => row.region_code !== largestRegion?.region_code).sort((a, b) => (a.average_inventory_yoy_pct ?? Infinity) - (b.average_inventory_yoy_pct ?? Infinity))[0];

  const brandSummary = `National ${brandLabel} inventory ${movePct(national.average_inventory_mom_pct)} M/M to ${integer(national.average_inventory)} units, with SOI at ${pct(national.inventory_share, 1)} versus ${pct(national.retail_share, 1)} SOM and inventory efficiency at ${ratio(national.inventory_retail_ratio)}.${cox?.incentive_index != null ? ` Incentive PNV ${movePct(cox.incentive_pnv_mom_pct)} to ${currency(cox.incentive_pnv)}, while the inventory-weighted incentive index ${movePoints(cox.incentive_index_mom_delta)} to ${wholeIndex(cox.incentive_index)}.` : ""}`;
  const modelInsights = [
    incentiveDrag ? `${incentiveDrag.row.display_name} exerted the greatest inventory-weighted incentive drag: its index ${movePoints(incentiveDrag.incentive?.incentive_index_mom_delta)} to ${wholeIndex(incentiveDrag.incentive?.incentive_index)} as incentive PNV ${movePct(incentiveDrag.incentive?.incentive_pnv_mom_pct)} to ${currency(incentiveDrag.incentive?.incentive_pnv)}.` : `${models[0]?.display_name ?? "The leading model"} carries the largest inventory position at ${integer(models[0]?.average_inventory)} units.`,
    secondModel ? `${secondModel.display_name} holds ${integer(secondModel.average_inventory)} units; inventory ${movePct(secondModel.average_inventory_mom_pct)} M/M and its SOI/SOM position is ${ratio(secondModel.inventory_retail_ratio)}.` : "Model-level history is not available for this month.",
  ];
  const regionalInsights = [
    largestRegion ? `${largestRegion.region_name} is the largest regional inventory pool at ${integer(largestRegion.average_inventory)} units, ${movePct(largestRegion.average_inventory_mom_pct)} M/M, with ${pct(largestRegion.inventory_share, 1)} SOI.` : "Regional inventory is not available for this month.",
    softestRegion ? `${softestRegion.region_name} has the softest Y/Y inventory trend at ${signedPct(softestRegion.average_inventory_yoy_pct)}, ending the month at ${integer(softestRegion.average_inventory)} units.` : "Regional year-over-year comparisons are not available.",
  ];

  return <section className="insights-card" aria-label="National brand insights">
    <div className="insights-heading"><div><span>Insights</span><small>National · {monthLabel(national.date_month)}</small></div><b>Data-generated summary</b></div>
    <p className="brand-insight">{brandSummary}</p>
    <div className="insight-columns">
      <div><h3>Model dynamics</h3><ul>{modelInsights.map((insight) => <li key={insight}>{insight}</li>)}</ul></div>
      <div><h3>Regional dynamics</h3><ul>{regionalInsights.map((insight) => <li key={insight}>{insight}</li>)}</ul></div>
    </div>
  </section>;
}

const BRAND_LABELS: Record<string, string> = {
  acura: "Acura", audi: "Audi", bmw: "BMW", cadillac: "Cadillac", genesis: "Genesis",
  land_rover: "Land Rover", lexus: "Lexus", mercedes_benz: "Mercedes-Benz", porsche: "Porsche", volvo: "Volvo",
};

function vehicleLabel(row: CoxSegmentRow) {
  const model = row.make_model.replace(new RegExp(`^${row.make}_`), "").split("_")
    .map((part) => (/\d/.test(part) || part.length <= 3 ? part.toUpperCase() : `${part[0].toUpperCase()}${part.slice(1)}`))
    .join(" ");
  return `${BRAND_LABELS[row.make] ?? row.make} ${model}`;
}

function cloudTheoryVehicleLabel(row: CloudTheorySegmentRow) {
  const model = row.model_series.split("_")
    .map((part) => (/\d/.test(part) || part.length <= 3 ? part.toUpperCase() : `${part[0].toUpperCase()}${part.slice(1)}`))
    .join(" ");
  return `${BRAND_LABELS[row.make] ?? row.make.replace(/_/g, " ")} ${model}`;
}

type TooltipTrendPoint = { date_month: string; line: number | null; bar: number | null };

function TooltipMiniTrend({ modelName, points, lineLabel, barLabel }: { modelName: string; points: TooltipTrendPoint[]; lineLabel: string; barLabel: string }) {
  const series = points.filter((point) => point.line != null || point.bar != null).sort((a, b) => a.date_month.localeCompare(b.date_month)).slice(-12);
  if (series.length < 2) return null;
  const width = 576;
  const height = 104;
  const pad = { l: 38, r: 38, t: 18, b: 18 };
  const plotW = width - pad.l - pad.r;
  const plotH = height - pad.t - pad.b;
  const lineValues = series.map((point) => point.line).filter((value): value is number => value != null);
  const barValues = series.map((point) => point.bar).filter((value): value is number => value != null);
  const ceiling = (value: number) => {
    const magnitude = 10 ** Math.floor(Math.log10(Math.max(value, 1)));
    return Math.ceil(value / magnitude) * magnitude;
  };
  const lineMin = Math.min(...lineValues);
  const lineMax = Math.max(...lineValues);
  const lineRange = Math.max(Math.abs(lineMax - lineMin), Math.abs(lineMax) * .08, lineLabel === "SOI" ? .002 : 1);
  const lineFloor = lineLabel === "SOI" ? Math.max(0, lineMin - lineRange * .35) : lineMin - lineRange * .16;
  const lineCeiling = lineMax + lineRange * .35;
  const barMax = Math.max(...barValues, 1);
  const barCeiling = ceiling(barMax * 1.1);
  const barTicks = [barCeiling, barCeiling / 2, 0];
  const lineTicks = [lineCeiling, (lineFloor + lineCeiling) / 2, lineFloor];
  const lineTickLabel = (value: number) => lineLabel === "SOI" ? pct(value, 0) : Math.round(value).toLocaleString("en-US");
  const barTickLabel = (value: number) => barLabel === "inventory"
    ? (value >= 1000 ? `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k` : Math.round(value).toLocaleString("en-US"))
    : `$${Math.round(value / 1000)}k`;
  const x = (index: number) => pad.l + ((index + .5) / series.length) * plotW;
  const lineY = (value: number) => pad.t + plotH - ((value - lineFloor) / Math.max(lineCeiling - lineFloor, lineLabel === "SOI" ? .002 : 1)) * plotH;
  const barY = (value: number) => pad.t + plotH - (value / barCeiling) * plotH;
  const linePoints = series.flatMap((point, index) => point.line == null ? [] : [`${x(index)},${lineY(point.line)}`]).join(" ");
  const barWidth = Math.max(5, Math.min(24, plotW / series.length * .5));
  return <div className="tooltip-mini-trend" aria-label={`${modelName} twelve-month ${lineLabel} and ${barLabel} trend`}>
    <div className="tooltip-mini-trend-heading"><span>{modelName} · last 12 months</span><small><i className="line-key" />{lineLabel}<i className="bar-key" />{barLabel}</small></div>
    <svg viewBox={`0 0 ${width} ${height}`} role="img">
      {barTicks.map((value) => <g key={`bar-axis-${value}`}><line x1={pad.l} x2={width - pad.r} y1={barY(value)} y2={barY(value)} stroke="#E7EAED" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" /><text x={pad.l - 4} y={barY(value)} fill="#737C86" fontSize="8.5" textAnchor="end" dominantBaseline="middle">{barTickLabel(value)}</text></g>)}
      {lineTicks.map((value) => <text key={`line-axis-${value}`} x={width - pad.r + 4} y={lineY(value)} fill="#D8795D" fontSize="8.5" textAnchor="start" dominantBaseline="middle">{lineTickLabel(value)}</text>)}
      {series.map((point, index) => point.bar == null ? null : <rect key={`bar-${point.date_month}`} x={x(index) - barWidth / 2} y={barY(point.bar)} width={barWidth} height={pad.t + plotH - barY(point.bar)} fill="rgba(91,105,118,.34)" rx="1" />)}
      <polyline points={linePoints} fill="none" stroke="#D8795D" strokeWidth="2.25" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {series.map((point, index) => point.line == null ? null : <circle key={`line-${point.date_month}`} cx={x(index)} cy={lineY(point.line)} r="2.2" fill="#FFFFFF" stroke="#D8795D" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />)}
      {series.map((point, index) => <text key={`month-${point.date_month}`} x={x(index)} y={height - 3} fill="#737C86" fontSize="9" textAnchor="middle">{chartMonthLabel(point.date_month).slice(0, 1)}</text>)}
    </svg>
  </div>;
}

function SegmentMetricCell({ metric, comparisons, history, kind }: { metric: Row; comparisons: CloudTheorySegmentRow[]; history: Row[]; kind: "share" | "msrp" | "price" }) {
  const [tooltip, setTooltip] = useState<{ left: number; top: number; above: boolean } | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isShare = kind === "share";
  const isPrice = kind === "price";
  const value = isShare ? metric.inventory_share : isPrice ? metric.price_inventory_weighted_index : metric.msrp_inventory_weighted_index;
  if (value == null) return <td>—</td>;
  const cancelHide = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  };
  const scheduleHide = () => {
    cancelHide();
    hideTimer.current = setTimeout(() => setTooltip(null), 140);
  };
  const show = (target: HTMLElement) => {
    cancelHide();
    const rect = target.getBoundingClientRect();
    const width = Math.min(620, window.innerWidth - 24);
    setTooltip({
      left: Math.max(12 + width / 2, Math.min(window.innerWidth - 12 - width / 2, rect.left + rect.width / 2)),
      top: rect.top,
      above: rect.top > 430,
    });
  };
  const sortedComparisons = [...comparisons].sort((a, b) => isShare ? (b.inventory_share ?? -Infinity) - (a.inventory_share ?? -Infinity) : isPrice ? (b.price_index ?? -Infinity) - (a.price_index ?? -Infinity) : (b.msrp_index ?? -Infinity) - (a.msrp_index ?? -Infinity));
  const tone = !isShare && value != null ? value > 102 ? "over" : value < 98 ? "under" : "balanced" : "";
  const label = isShare ? "share of inventory" : isPrice ? "price index" : "MSRP index";
  return <td className="segment-metric-cell">
    <button className={isShare ? "metric-tooltip-trigger share-tooltip-trigger" : `index-pill index-tooltip-trigger ${tone}`} type="button" aria-label={`Compare ${metric.display_name} ${label} with its segment`} onMouseEnter={(event) => show(event.currentTarget)} onMouseLeave={scheduleHide} onFocus={(event) => show(event.currentTarget)} onBlur={scheduleHide}>{isShare ? pct(value, 1) : indexValue(value)}</button>
    {tooltip ? createPortal(<div className={`segment-tooltip ${tooltip.above ? "above" : "below"}`} style={{ left: tooltip.left, top: tooltip.top }} role="tooltip" onMouseEnter={cancelHide} onMouseLeave={scheduleHide}>
      <div className="segment-tooltip-heading"><div><b>{metric.segment}</b><span>{monthLabel(metric.date_month)} · {metric.region_name}</span></div><small>{isShare ? "SOI comparison" : isPrice ? "Price comparison" : "MSRP comparison"}</small></div>
      {isShare ? <div className="segment-tooltip-grid segment-tooltip-labels"><span>Vehicle</span><span>SOI</span><span>Inventory</span><span>M/M</span><span>Y/Y</span></div> : <div className="segment-tooltip-grid segment-tooltip-labels"><span>Vehicle</span><span>{isPrice ? "Weighted price" : "Weighted MSRP"}</span><span>Index</span><span>M/M</span><span>Y/Y</span></div>}
      <div className="segment-tooltip-body">{sortedComparisons.map((row) => <div className={`segment-tooltip-grid ${row.make === "genesis" && row.model_series === metric.model_series ? "genesis-row" : ""}`} key={`${row.make}-${row.model_series}`}>
        <b>{cloudTheoryVehicleLabel(row)}</b>
        {isShare ? <><strong>{pct(row.inventory_share, 1)}</strong><span>{integer(row.average_inventory)}</span><Change value={row.inventory_share_mom_pp} unit="pp" /><Change value={row.inventory_share_yoy_pp} unit="pp" /></> : isPrice ? <><span>{currency(row.weighted_avg_price)}</span><strong>{indexValue(row.price_index)}</strong><Change value={row.price_index_mom_delta} unit="points" /><Change value={row.price_index_yoy_delta} unit="points" /></> : <><span>{currency(row.weighted_avg_msrp)}</span><strong>{indexValue(row.msrp_index)}</strong><Change value={row.msrp_index_mom_delta} unit="points" /><Change value={row.msrp_index_yoy_delta} unit="points" /></>}
      </div>)}</div>
      <TooltipMiniTrend modelName={metric.display_name} points={history.map((row) => ({ date_month: row.date_month, line: isShare ? row.inventory_share : isPrice ? row.price_inventory_weighted_index : row.msrp_inventory_weighted_index, bar: isShare ? row.average_inventory : isPrice ? row.weighted_avg_price : row.weighted_avg_msrp }))} lineLabel={isShare ? "SOI" : isPrice ? "price index" : "MSRP index"} barLabel={isShare ? "inventory" : isPrice ? "price" : "MSRP"} />
      <p>{isShare ? "SOI is each model’s share of average inventory within this CloudTheory segment." : `Index 100 equals the inventory-weighted ${isPrice ? "advertised price" : "MSRP"} for this CloudTheory segment.`}</p>
    </div>, document.body) : null}
  </td>;
}

function IncentiveIndexCell({ metric, comparisons, history }: { metric: CoxRow | undefined; comparisons: CoxSegmentRow[]; history: CoxRow[] }) {
  const [tooltip, setTooltip] = useState<{ left: number; top: number; above: boolean } | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  if (!metric?.incentive_index) return <td>—</td>;
  const cancelHide = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  };
  const scheduleHide = () => {
    cancelHide();
    hideTimer.current = setTimeout(() => setTooltip(null), 140);
  };
  const show = (target: HTMLElement) => {
    cancelHide();
    const rect = target.getBoundingClientRect();
    const width = Math.min(620, window.innerWidth - 24);
    setTooltip({
      left: Math.max(12 + width / 2, Math.min(window.innerWidth - 12 - width / 2, rect.left + rect.width / 2)),
      top: rect.top,
      above: rect.top > 430,
    });
  };
  const tone = metric.incentive_index > 102 ? "over" : metric.incentive_index < 98 ? "under" : "balanced";
  return <td className="incentive-index-cell">
    <button className={`index-pill index-tooltip-trigger ${tone}`} type="button" aria-label={`Compare ${metric.display_name} incentive index with its segment`} onMouseEnter={(event) => show(event.currentTarget)} onMouseLeave={scheduleHide} onFocus={(event) => show(event.currentTarget)} onBlur={scheduleHide}>{wholeIndex(metric.incentive_index)}</button>
    {tooltip ? createPortal(<div className={`segment-tooltip ${tooltip.above ? "above" : "below"}`} style={{ left: tooltip.left, top: tooltip.top }} role="tooltip" onMouseEnter={cancelHide} onMouseLeave={scheduleHide}>
      <div className="segment-tooltip-heading"><div><b>{metric.segment}</b><span>{monthLabel(metric.date_month)}</span></div><small>Index change</small></div>
      <div className="segment-tooltip-grid segment-tooltip-labels"><span>Vehicle</span><span>Incentive</span><span>Index</span><span>M/M</span><span>Y/Y</span></div>
      <div className="segment-tooltip-body">{comparisons.map((row) => <div className={`segment-tooltip-grid ${row.make === "genesis" ? "genesis-row" : ""}`} key={row.make_model}>
        <b>{vehicleLabel(row)}</b><span>{currency(row.incentive_pnv)}</span><strong>{wholeIndex(row.incentive_index)}</strong><Change value={row.incentive_index_mom_delta} unit="points" /><Change value={row.incentive_index_yoy_delta} unit="points" />
      </div>)}</div>
      <TooltipMiniTrend modelName={metric.display_name} points={history.map((row) => ({ date_month: row.date_month, line: row.incentive_index, bar: row.incentive_pnv }))} lineLabel="incentive index" barLabel="incentive" />
      <p>Index 100 equals the inventory-weighted incentive PNV for this Cox segment.</p>
    </div>, document.body) : null}
  </td>;
}

function TrendCanvas({ rows, competitorRows, coxRows }: { rows: Row[]; competitorRows: CompetitorRow[]; coxRows: CoxRow[] }) {
  const ref = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 900, height: 335 });
  const [hover, setHover] = useState<{ index: number; left: number; top: number; above: boolean; kind: "ratio" | "share"; shareMetric?: "SOI" | "SOM" } | null>(null);

  useEffect(() => {
    const chart = ref.current;
    if (!chart) return;
    const updateDimensions = () => {
      const rect = chart.getBoundingClientRect();
      const next = { width: Math.max(1, Math.round(rect.width)), height: Math.max(1, Math.round(rect.height)) };
      setDimensions((current) => current.width === next.width && current.height === next.height ? current : next);
    };
    updateDimensions();
    const observer = new ResizeObserver(updateDimensions);
    observer.observe(chart);
    return () => observer.disconnect();
  }, []);

  const { width, height } = dimensions;
  const pad = { l: 48, r: 58, t: 24, b: 54 };
  const plotW = Math.max(1, width - pad.l - pad.r);
  const plotH = Math.max(1, height - pad.t - pad.b);
  const shares = rows.flatMap((row) => [row.inventory_share, row.retail_share ?? 0]);
  const maxSharePct = Math.max(...shares, 0) * 100 * 1.25;
  const shareStepPct = Math.max(1, Math.ceil(maxSharePct / 4));
  const maxShare = (shareStepPct * 4) / 100;
  const incentiveByMonth = new Map(coxRows.map((row) => [row.date_month, row.incentive_index]));
  const incentiveValues = rows.map((row) => incentiveByMonth.get(row.date_month)).filter((value): value is number => value != null);
  const incentiveStep = Math.max(25, Math.ceil(Math.max(...incentiveValues, 100) / 4 / 25) * 25);
  const maxIncentive = incentiveStep * 4;
  const x = (i: number) => pad.l + (i + 0.5) * plotW / Math.max(1, rows.length);
  const shareY = (value: number) => pad.t + plotH - (value / maxShare) * plotH;
  const incentiveY = (value: number) => pad.t + plotH - (value / maxIncentive) * plotH;
  const compact = width < 650;
  const seriesPoints = (getter: (row: Row) => number | null) => rows.flatMap((row, i) => {
    const value = getter(row);
    return value == null ? [] : [`${x(i)},${shareY(value)}`];
  }).join(" ");

  const handleMove = (event: MouseEvent<SVGSVGElement>) => {
    const chart = ref.current;
    if (!chart || !rows.length) return;
    const rect = chart.getBoundingClientRect();
    const plotW = rect.width - pad.l - pad.r;
    const step = plotW / rows.length;
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const index = Math.round((mouseX - pad.l) / step - 0.5);
    if (index < 0 || index >= rows.length) return setHover(null);
    const row = rows[index];
    if (row.retail_share == null || row.retail_share === 0) return setHover(null);
    const hoverShares = rows.flatMap((item) => [item.inventory_share, item.retail_share ?? 0]);
    const shareStepPct = Math.max(1, Math.ceil(Math.max(...hoverShares, 0) * 100 * 1.25 / 4));
    const maxShare = (shareStepPct * 4) / 100;
    const shareY = (value: number) => pad.t + (rect.height - pad.t - pad.b) - (value / maxShare) * (rect.height - pad.t - pad.b);
    const markerX = pad.l + (index + 0.5) * step;
    const shareMarkers = [
      { metric: "SOI" as const, y: shareY(row.inventory_share) },
      { metric: "SOM" as const, y: shareY(row.retail_share) },
    ];
    const nearestShareMarker = shareMarkers.reduce((nearest, marker) => Math.abs(mouseY - marker.y) < Math.abs(mouseY - nearest.y) ? marker : nearest);
    if (Math.abs(mouseX - markerX) <= 12 && Math.abs(mouseY - nearestShareMarker.y) <= 12) {
      setHover({ index, left: Math.min(rect.width - 78, Math.max(78, markerX)), top: nearestShareMarker.y, above: nearestShareMarker.y > 96, kind: "share", shareMetric: nearestShareMarker.metric });
      return;
    }
    const markerY = (shareY(row.inventory_share) + shareY(row.retail_share)) / 2;
    if (Math.abs(mouseX - markerX) > 25 || Math.abs(mouseY - markerY) > 15) return setHover(null);
    setHover({ index, left: Math.min(rect.width - 105, Math.max(105, markerX)), top: markerY, above: markerY > 145, kind: "ratio" });
  };

  const hoveredComparisons = hover
    ? COMPETITOR_ORDER.map((brand) => competitorRows.find((row) => row.date_month === rows[hover.index]?.date_month && row.brand === brand)).filter((row): row is CompetitorRow => Boolean(row))
    : [];
  const hoveredRow = hover ? rows[hover.index] : undefined;
  const hoveredEfficiencyRows = hover ? (() => {
    const date = rows[hover.index]?.date_month;
    if (!date) return [];
    const delta = (current: number | null, previous: number | null) => current == null || previous == null ? null : current - previous;
    if (hoveredComparisons.length) return hoveredComparisons.map((current) => {
      const priorMonth = competitorRows.find((row) => row.brand === current.brand && row.date_month === shiftMonth(date, -1));
      const priorYear = competitorRows.find((row) => row.brand === current.brand && row.date_month === shiftMonth(date, -12));
      return {
        brand: current.brand === "Genesis" ? "GMA" : current.brand === "Hyundai" ? "HMA" : current.brand === "Mercedes-Benz" ? "MB" : current.brand,
        ratio: current.inventory_retail_ratio,
        mom: delta(current.inventory_retail_ratio, priorMonth?.inventory_retail_ratio ?? null),
        yoy: delta(current.inventory_retail_ratio, priorYear?.inventory_retail_ratio ?? null),
      };
    });
    return hoveredRow ? [{
      brand: hoveredRow.display_name,
      ratio: hoveredRow.inventory_retail_ratio,
      mom: hoveredRow.inventory_retail_ratio_mom_delta,
      yoy: hoveredRow.inventory_retail_ratio_yoy_delta,
    }] : [];
  })() : [];

  return <div className="trend-wrap">
    <svg ref={ref} className="trend-svg" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" onMouseMove={handleMove} onMouseLeave={() => setHover(null)} role="img" aria-label="Inventory share and retail share trends with SOI and SOM marker tooltips plus SOI divided by SOM efficiency ratios">
      {Array.from({ length: 5 }, (_, i) => {
        const y = pad.t + (plotH * i) / 4;
        return <g key={i}>
          <line x1={pad.l} x2={width - pad.r} y1={y} y2={y} stroke="#E5E7EB" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <text x={width - pad.r + 9} y={y} fill="#6B7280" fontSize="11" dominantBaseline="middle">{shareStepPct * (4 - i)}%</text>
          <text x={pad.l - 9} y={y} fill="#6B7280" fontSize="11" textAnchor="end" dominantBaseline="middle">{incentiveStep * (4 - i)}</text>
        </g>;
      })}
      {rows.map((row, i) => {
        const value = incentiveByMonth.get(row.date_month);
        if (value == null) return null;
        const top = incentiveY(value);
        const barWidth = Math.max(8, Math.min(34, plotW / rows.length * 0.48));
        return <g key={`bar-${row.date_month}`}>
          <rect x={x(i) - barWidth / 2} y={top} width={barWidth} height={pad.t + plotH - top} fill="rgba(129,135,142,.28)" />
          <text x={x(i)} y={top - 3} fill="#68717C" fontSize="9" fontWeight="700" textAnchor="middle">{Math.round(value)}</text>
        </g>;
      })}
      {rows.map((row, i) => row.retail_share == null ? null : <line key={`bridge-${row.date_month}`} x1={x(i)} x2={x(i)} y1={shareY(row.inventory_share)} y2={shareY(row.retail_share)} stroke="#9AA2AC" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />)}
      <polyline points={seriesPoints((row) => row.inventory_share)} fill="none" stroke="#D8795D" strokeWidth="3" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <polyline points={seriesPoints((row) => row.retail_share)} fill="none" stroke="#005B96" strokeWidth="3" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {rows.flatMap((row, i) => [
        <circle key={`soi-${row.date_month}`} cx={x(i)} cy={shareY(row.inventory_share)} r="3.5" fill="#FFFFFF" stroke="#D8795D" strokeWidth="2" vectorEffect="non-scaling-stroke" />,
        row.retail_share == null ? null : <circle key={`som-${row.date_month}`} cx={x(i)} cy={shareY(row.retail_share)} r="3.5" fill="#FFFFFF" stroke="#005B96" strokeWidth="2" vectorEffect="non-scaling-stroke" />,
      ])}
      {rows.map((row, i) => {
        if (row.retail_share == null || row.retail_share === 0) return null;
        const label = `${(row.inventory_share / row.retail_share).toFixed(2)}x`;
        const y = (shareY(row.inventory_share) + shareY(row.retail_share)) / 2;
        const labelWidth = (compact ? 23 : 29) + label.length * (compact ? 3.5 : 4.5);
        return <g key={`ratio-${row.date_month}`}>
          <rect x={x(i) - labelWidth / 2} y={y - 7} width={labelWidth} height="14" rx="4" fill="rgba(255,255,255,.94)" stroke="#C7CDD4" vectorEffect="non-scaling-stroke" />
          <text x={x(i)} y={y} fill="#4B5563" fontSize={compact ? "7" : "9"} fontWeight="700" textAnchor="middle" dominantBaseline="middle">{label}</text>
        </g>;
      })}
      {rows.map((row, i) => {
        const labelY = height - pad.b + 10;
        return <g key={`period-${row.date_month}`} fill="#6B7280" fontSize={compact ? "8" : "10"} textAnchor="middle">
          <text x={x(i)} y={labelY}>{chartMonthLabel(row.date_month)}</text>
          <text x={x(i)} y={labelY + (compact ? 10 : 12)}>{chartYearLabel(row.date_month)}</text>
        </g>;
      })}
    </svg>
    {hover?.kind === "share" ? <div className={`share-tooltip ${hover.above ? "above" : "below"}`} style={{ left: hover.left, top: hover.top }} role="tooltip">
      <div className="ratio-tooltip-head"><b>{monthLabel(rows[hover.index].date_month, true)}</b><span>{hover.shareMetric} marker</span></div>
      <div className="share-tooltip-value"><span className={hover.shareMetric === "SOI" ? "soi-dot" : "som-dot"}>{hover.shareMetric}</span><strong>{pct(hover.shareMetric === "SOI" ? rows[hover.index].inventory_share : rows[hover.index].retail_share, 1)}</strong></div>
    </div> : null}
    {hover?.kind === "ratio" ? <div className={`ratio-tooltip ${hover.above ? "above" : "below"}`} style={{ left: hover.left, top: hover.top }} role="tooltip">
      <div className="ratio-tooltip-head"><b>{monthLabel(rows[hover.index].date_month, true)}</b><span>SOI / SOM</span></div>
      <div className="ratio-tooltip-list">
        <div className="ratio-tooltip-grid ratio-tooltip-labels"><span>Brand</span><span>Ratio</span><span>M/M</span><span>Y/Y</span></div>
        {hoveredEfficiencyRows.map((row) => <div className="ratio-tooltip-grid" key={row.brand}><b>{row.brand}</b><strong>{ratio(row.ratio)}</strong><Change value={row.mom} unit="ratio" /><Change value={row.yoy} unit="ratio" /></div>)}
      </div>
    </div> : null}
  </div>;
}

const PRICE_BANDS = [
  { label: "Under $50k", lower: -Infinity, upper: 50000 },
  { label: "$50k – $65k", lower: 50000, upper: 65000 },
  { label: "$65k – $80k", lower: 65000, upper: 80000 },
  { label: "$80k – $95k", lower: 80000, upper: 95000 },
  { label: "$95k+", lower: 95000, upper: Infinity },
];
const TRIM_BALANCE_BANDS = [
  { label: "Under $65k", lower: -Infinity, upper: 65000 },
  { label: "$65k – $80k", lower: 65000, upper: 80000 },
  { label: "$80k – $95k", lower: 80000, upper: 95000 },
  { label: "$95k+", lower: 95000, upper: Infinity },
];
const HYUNDAI_TRIM_BALANCE_BANDS = [
  { label: "Under $30k", lower: -Infinity, upper: 30000 },
  { label: "$30k – $40k", lower: 30000, upper: 40000 },
  { label: "$40k – $50k", lower: 40000, upper: 50000 },
  { label: "$50k+", lower: 50000, upper: Infinity },
];

const titleToken = (value: string) => value.split("_").map((part) => /\d/.test(part) || part.length <= 3 ? part.toUpperCase() : `${part[0].toUpperCase()}${part.slice(1)}`).join(" ");
const nameplateLabel = (make: string, model: string) => `${BRAND_LABELS[make] ?? titleToken(make)} ${titleToken(model)}`;
const priceBandFor = (price: number) => PRICE_BANDS.find((band) => price >= band.lower && price < band.upper);
const NAMEPLATE_COLORS = ["#005B96", "#D8795D", "#5F7F6F", "#8064A2", "#B07D2A", "#4D8E8A", "#A45A75", "#657A9B", "#8B754A", "#4E8DB8"];
const nameplateColor = (model: string) => NAMEPLATE_COLORS[[...model].reduce((hash, character) => hash + character.charCodeAt(0), 0) % NAMEPLATE_COLORS.length];
const COMPETITIVE_MAKES = ["bmw", "mercedes_benz", "lexus"];
const COMPETITIVE_COLORS: Record<string, string> = { bmw: "#4E80AF", mercedes_benz: "#667A8C", lexus: "#8E7164" };
const competitorLabel = (make: string) => make === "mercedes_benz" ? "MB" : BRAND_LABELS[make] ?? titleToken(make);
type PriceBandScope = "model" | "brand";

function TrimBalanceInventoryCell({ metric, rows, brandKey, bands }: { metric: Row; rows: PriceBandRow[]; brandKey: string; bands: typeof TRIM_BALANCE_BANDS }) {
  const [tooltip, setTooltip] = useState<{ left: number; top: number; above: boolean } | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentRows = rows.filter((row) => row.date_month === metric.date_month && row.make === brandKey && row.model === metric.model_series);
  const currentTotal = currentRows.reduce((sum, row) => sum + row.average_inventory, 0);
  const allocation = (date: string, band: typeof TRIM_BALANCE_BANDS[number]) => {
    const nameplateRows = rows.filter((row) => row.date_month === date && row.make === brandKey && row.model === metric.model_series);
    const total = nameplateRows.reduce((sum, row) => sum + row.average_inventory, 0);
    const inBand = nameplateRows.filter((row) => row.weighted_advertised_price >= band.lower && row.weighted_advertised_price < band.upper).reduce((sum, row) => sum + row.average_inventory, 0);
    return total > 0 ? inBand / total : null;
  };
  const cancelHide = () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  const scheduleHide = () => { cancelHide(); hideTimer.current = setTimeout(() => setTooltip(null), 140); };
  const show = (target: HTMLElement) => {
    cancelHide();
    const rect = target.getBoundingClientRect();
    const width = Math.min(370, window.innerWidth - 24);
    setTooltip({ left: Math.max(12 + width / 2, Math.min(window.innerWidth - 12 - width / 2, rect.left + rect.width / 2)), top: rect.top, above: rect.top > 420 });
  };
  return <td className="inventory-trim-trigger">
    <button className="metric-tooltip-trigger share-tooltip-trigger" type="button" aria-label={`Show ${metric.display_name} trim balance`} onMouseEnter={(event) => show(event.currentTarget)} onMouseLeave={scheduleHide} onFocus={(event) => show(event.currentTarget)} onBlur={scheduleHide}>{integer(metric.average_inventory)}</button>
    {tooltip ? createPortal(<div className={`trim-balance-tooltip ${tooltip.above ? "above" : "below"}`} style={{ left: tooltip.left, top: tooltip.top }} role="tooltip" onMouseEnter={cancelHide} onMouseLeave={scheduleHide}>
      <div className="trim-balance-tooltip-heading"><b>{metric.display_name} trim balance</b><span>{monthLabel(metric.date_month)} · National inventory allocation</span></div>
      <div className="trim-balance-tooltip-grid trim-balance-tooltip-labels"><span>Price band</span><span>Allocation</span><span>M/M</span><span>Y/Y</span></div>
      {bands.map((band) => {
        const current = allocation(metric.date_month, band);
        const priorMonth = allocation(shiftMonth(metric.date_month, -1), band);
        const priorYear = allocation(shiftMonth(metric.date_month, -12), band);
        return <div className="trim-balance-tooltip-grid" key={band.label}><b>{band.label}</b><strong>{pct(current, 1)}</strong><Change value={current != null && priorMonth != null ? current - priorMonth : null} unit="pp" /><Change value={current != null && priorYear != null ? current - priorYear : null} unit="pp" /></div>;
      })}
      <div className="trim-balance-trim-groups"><b>Trims by price band</b>{bands.map((band) => {
        const bandRows = currentRows.filter((row) => row.weighted_advertised_price >= band.lower && row.weighted_advertised_price < band.upper).sort((a, b) => b.average_inventory - a.average_inventory);
        const major = bandRows.filter((row) => row.average_inventory / Math.max(currentTotal, 1) >= .05);
        const minorShare = bandRows.filter((row) => row.average_inventory / Math.max(currentTotal, 1) < .05).reduce((sum, row) => sum + row.average_inventory, 0) / Math.max(currentTotal, 1);
        const labels = [...major.map((row) => `${row.trim} ${pct(row.average_inventory / Math.max(currentTotal, 1), 0)}`), ...(minorShare > 0 ? [`Other (<5%) ${pct(minorShare, 0)}`] : [])];
        return <div key={band.label}><span>{band.label}</span><small>{labels.join(" · ") || "—"}</small></div>;
      })}</div>
      <p>All four bands are mutually exclusive and exhaustive, so their allocation changes sum to zero, subject only to rounding.</p>
    </div>, document.body) : null}
  </td>;
}

function competitiveTrimMix(rows: PriceBandRow[]) {
  const brandInventory = rows.reduce((sum, row) => sum + row.average_inventory, 0);
  const byNameplate = new Map<string, PriceBandRow[]>();
  rows.forEach((row) => {
    const key = `${row.make}|${row.model}`;
    const nameplateRows = byNameplate.get(key) ?? [];
    nameplateRows.push(row);
    byNameplate.set(key, nameplateRows);
  });
  return [...byNameplate.values()].flatMap((nameplateRows) => {
    const majorTrims = nameplateRows.filter((row) => row.average_inventory / Math.max(brandInventory, 1) >= .02);
    const minorTrims = nameplateRows.filter((row) => row.average_inventory / Math.max(brandInventory, 1) < .02);
    const otherInventory = minorTrims.reduce((sum, row) => sum + row.average_inventory, 0);
    const otherAdvertisedPrice = minorTrims.reduce((sum, row) => sum + row.weighted_advertised_price * row.average_inventory, 0) / Math.max(otherInventory, 1);
    return [
      ...majorTrims,
      ...(otherInventory > 0 ? [{ ...minorTrims[0], trim: "Other (<2%)", average_inventory: otherInventory, weighted_advertised_price: otherAdvertisedPrice }] : []),
    ].map((row) => ({ ...row, nameplateShare: row.average_inventory / Math.max(brandInventory, 1) }));
  });
}

function PriceBandCanvas({ rows, scope, overlayRows = [], brandLabel, bands }: { rows: PriceBandRow[]; scope: PriceBandScope; overlayRows?: PriceBandRow[]; brandLabel: string; bands: typeof TRIM_BALANCE_BANDS }) {
  const ref = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 900, height: 330 });
  const chartRows = useMemo(() => {
    const nameplateInventory = rows.reduce((sum, row) => sum + row.average_inventory, 0);
    if (scope === "brand") {
      const byNameplate = new Map<string, PriceBandRow[]>();
      rows.forEach((row) => {
        const nameplateRows = byNameplate.get(row.model) ?? [];
        nameplateRows.push(row);
        byNameplate.set(row.model, nameplateRows);
      });
      return [...byNameplate.values()].flatMap((nameplateRows) => bands.flatMap((band) => {
        const bandRows = nameplateRows.filter((row) => row.weighted_advertised_price >= band.lower && row.weighted_advertised_price < band.upper);
        const majorTrims = bandRows.filter((row) => row.average_inventory / Math.max(nameplateInventory, 1) >= .02);
        const minorTrims = bandRows.filter((row) => row.average_inventory / Math.max(nameplateInventory, 1) < .02);
        const otherInventory = minorTrims.reduce((sum, row) => sum + row.average_inventory, 0);
        const otherAdvertisedPrice = minorTrims.reduce((sum, row) => sum + row.weighted_advertised_price * row.average_inventory, 0) / Math.max(otherInventory, 1);
        return [
          ...majorTrims,
          ...(otherInventory > 0 ? [{ ...minorTrims[0], trim: `Other (<2%) · ${band.label}`, average_inventory: otherInventory, weighted_advertised_price: otherAdvertisedPrice }] : []),
        ];
      })).map((row) => ({ ...row, nameplateShare: row.average_inventory / Math.max(nameplateInventory, 1) }));
    }
    return bands.flatMap((band) => {
      const bandRows = rows.filter((row) => row.weighted_advertised_price >= band.lower && row.weighted_advertised_price < band.upper);
      const majorTrims = bandRows.filter((row) => row.average_inventory / Math.max(nameplateInventory, 1) >= .05);
      const minorTrims = bandRows.filter((row) => row.average_inventory / Math.max(nameplateInventory, 1) < .05);
      const otherInventory = minorTrims.reduce((sum, row) => sum + row.average_inventory, 0);
      const otherAdvertisedPrice = minorTrims.reduce((sum, row) => sum + row.weighted_advertised_price * row.average_inventory, 0) / Math.max(otherInventory, 1);
      return [
        ...majorTrims,
        ...(otherInventory > 0 ? [{ ...minorTrims[0], trim: `Other (<5%) · ${band.label}`, average_inventory: otherInventory, weighted_advertised_price: otherAdvertisedPrice }] : []),
      ].map((row) => ({ ...row, nameplateShare: row.average_inventory / Math.max(nameplateInventory, 1) }));
    });
  }, [rows, scope]);
  const competitiveRows = useMemo(() => competitiveTrimMix(overlayRows), [overlayRows]);

  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    const update = () => {
      const rect = svg.getBoundingClientRect();
      setDimensions({ width: Math.max(1, rect.width), height: Math.max(1, rect.height) });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);

  const { width, height } = dimensions;
  const pad = { l: 76, r: 26, t: 12, b: 34 };
  const plotW = width - pad.l - pad.r;
  const plotH = height - pad.t - pad.b;
  const priced = chartRows.filter((row) => row.weighted_advertised_price > 0);
  const competitivePriced = competitiveRows.filter((row) => row.weighted_advertised_price > 0);
  if (!priced.length) return null;
  // Keep every selected model on the same fixed four-band frame.
  const maxShare = Math.max(.05, Math.ceil(Math.max(...[...priced, ...competitivePriced].map((row) => row.nameplateShare)) * 20) / 20);
  const maxInventory = Math.max(...[...priced, ...competitivePriced].map((row) => row.average_inventory));
  const x = (value: number) => {
    const bandIndex = bands.findIndex((band) => value >= band.lower && value < band.upper);
    const index = bandIndex < 0 ? (value < bands[0].upper ? 0 : bands.length - 1) : bandIndex;
    const band = bands[index];
    const lower = Number.isFinite(band.lower) ? band.lower : Math.max(0, bands[0].upper - 15000);
    const upper = Number.isFinite(band.upper) ? band.upper : Math.max(lower + 15000, lower * 1.25);
    const withinBand = Math.max(.06, Math.min(.94, (value - lower) / Math.max(upper - lower, 1)));
    return pad.l + (index + withinBand) / bands.length * plotW;
  };
  const y = (value: number) => pad.t + plotH - (value / maxShare) * plotH;

  return <svg ref={ref} className="price-band-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${scope === "brand" ? `Trim share of ${brandLabel} inventory, grouped by nameplate` : "Trim share of nameplate inventory"} by inventory-weighted advertised price; bubble size represents average inventory volume`}>
    {Array.from({ length: 5 }, (_, tick) => {
      const value = maxShare * (4 - tick) / 4;
      const tickY = y(value);
      return <g key={`y-${tick}`}><line x1={pad.l} x2={width - pad.r} y1={tickY} y2={tickY} stroke="#E4E8EC" strokeDasharray="3 3" /><text x={pad.l - 8} y={tickY} fill="#66707A" fontSize="10" textAnchor="end" dominantBaseline="middle">{pct(value, 0)}</text></g>;
    })}
    {bands.map((band, index) => <g key={`band-${band.label}`}><line x1={pad.l + index / bands.length * plotW} x2={pad.l + index / bands.length * plotW} y1={pad.t} y2={pad.t + plotH} stroke="#EEF0F2" /><text x={pad.l + (index + .5) / bands.length * plotW} y={pad.t + plotH + 8} fill="#66707A" fontSize="10" textAnchor="middle" dominantBaseline="hanging">{band.label}</text></g>)}
    <line x1={pad.l + plotW} x2={pad.l + plotW} y1={pad.t} y2={pad.t + plotH} stroke="#EEF0F2" />
    <rect x={pad.l} y={pad.t} width={plotW} height={plotH} fill="none" stroke="#C7CDD4" />
    {[...competitivePriced, ...priced].map((row, index) => {
      const isCompetitive = index < competitivePriced.length;
      const radius = 4 + Math.sqrt(row.average_inventory / Math.max(maxInventory, 1)) * 10;
      const pointX = Math.max(pad.l + radius, Math.min(pad.l + plotW - radius, x(row.weighted_advertised_price)));
      const pointY = Math.max(pad.t + radius, Math.min(pad.t + plotH - radius, y(row.nameplateShare)));
      const offset = index % 2 === 0 ? -11 : 14;
      const alignRight = pointX > width - 155;
      const label = isCompetitive ? `${competitorLabel(row.make)} ${titleToken(row.model)} ${row.trim}` : row.trim;
      const fill = isCompetitive ? COMPETITIVE_COLORS[row.make] : scope === "brand" ? nameplateColor(row.model) : "#5797B5";
      const showLabel = isCompetitive || scope === "model";
      return <g key={`${isCompetitive ? "peer" : "genesis"}-${row.make}-${row.model}-${row.trim}-${row.weighted_advertised_price}`} opacity={isCompetitive ? .38 : 1}><title>{`${nameplateLabel(row.make, row.model)} · ${row.trim}: ${integer(row.average_inventory)} average inventory at ${currency(row.weighted_advertised_price)}`}</title>{showLabel ? <><line x1={pointX} x2={pointX + (alignRight ? -14 : 14)} y1={pointY} y2={pointY + offset} stroke={isCompetitive ? fill : "#9CA6B0"} /><text x={pointX + (alignRight ? -17 : 17)} y={pointY + offset} fill={isCompetitive ? fill : "#26323E"} fontSize="10" textAnchor={alignRight ? "end" : "start"} dominantBaseline="middle">{label}</text></> : null}<circle cx={pointX} cy={pointY} r={radius} fill={fill} stroke="#FFFFFF" strokeWidth="1.5" /></g>;
    })}
    <text x="28" y={pad.t + plotH / 2} fill="#3B4650" fontSize="10" fontWeight="600" textAnchor="middle" dominantBaseline="middle" transform={`rotate(-90 28 ${pad.t + plotH / 2})`}>{scope === "brand" ? `Trim share of ${brandLabel} inventory` : "Trim share of nameplate inventory"}</text>
    <text x={pad.l + plotW / 2} y={height - 2} fill="#3B4650" fontSize="10" fontWeight="600" textAnchor="middle">Inventory-weighted advertised price</text>
  </svg>;
}

function PriceBandPanel({ rows, retailRows, metric, brandMetric, model, options, month, months, scope, competitiveMake, onModelChange, onMonthChange, onScopeChange, onCompetitiveMakeChange, brandKey, brandLabel, brandShort, bands }: { rows: PriceBandRow[]; retailRows: PriceBandRetailRow[]; metric: Row | undefined; brandMetric: Row | undefined; model: string; options: Row[]; month: string; months: string[]; scope: PriceBandScope; competitiveMake: string; onModelChange: (model: string) => void; onMonthChange: (month: string) => void; onScopeChange: (scope: PriceBandScope) => void; onCompetitiveMakeChange: (make: string) => void; brandKey: string; brandLabel: string; brandShort: string; bands: typeof TRIM_BALANCE_BANDS }) {
  const currentMonth = month;
  const selectedSegment = metric?.segment ?? rows.find((row) => row.date_month === currentMonth && row.make === brandKey && row.model === model)?.segment;
  const brandSegments = new Set(rows.filter((row) => row.date_month === currentMonth && row.make === brandKey).map((row) => row.segment));
  const inScope = (row: PriceBandRow, date: string) => row.date_month === date && (scope === "brand" ? brandSegments.has(row.segment) : row.segment === selectedSegment);
  const currentScopeRows = rows.filter((row) => inScope(row, currentMonth));
  const genesisRows = currentScopeRows.filter((row) => row.make === brandKey && (scope === "brand" || row.model === model));
  const overlayRows = scope === "model" && competitiveMake ? currentScopeRows.filter((row) => row.make === competitiveMake) : [];
  const selectedKey = scope === "brand" ? brandKey : `${brandKey}|${model}`;
  const selectedLabel = metric?.display_name ?? titleToken(model);
  const brandInventory = genesisRows.reduce((sum, row) => sum + row.average_inventory, 0);
  const allocationBands = bands;
  const downloadRows = scope === "brand" ? (() => {
    const byNameplate = new Map<string, PriceBandRow[]>();
    genesisRows.forEach((row) => {
      const nameplateRows = byNameplate.get(row.model) ?? [];
      nameplateRows.push(row);
      byNameplate.set(row.model, nameplateRows);
    });
    return [...byNameplate.values()].flatMap((nameplateRows) => bands.flatMap((band) => {
      const bandRows = nameplateRows.filter((row) => row.weighted_advertised_price >= band.lower && row.weighted_advertised_price < band.upper);
      const major = bandRows.filter((row) => row.average_inventory / Math.max(brandInventory, 1) >= .02);
      const minor = bandRows.filter((row) => row.average_inventory / Math.max(brandInventory, 1) < .02);
      const otherInventory = minor.reduce((sum, row) => sum + row.average_inventory, 0);
      const otherPrice = minor.reduce((sum, row) => sum + row.weighted_advertised_price * row.average_inventory, 0) / Math.max(otherInventory, 1);
      const displayed = [
        ...major.map((row) => ({ row, componentTrims: row.trim, aggregationRule: `Individual trim (at least 2% of total ${brandLabel} inventory)` })),
        ...(otherInventory > 0 ? [{ row: { ...minor[0], trim: `Other (<2%) · ${band.label}`, average_inventory: otherInventory, weighted_advertised_price: otherPrice }, componentTrims: minor.map((row) => row.trim).join(" · "), aggregationRule: "Combined trims below 2% of total Genesis inventory within price band" }] : []),
      ];
      return displayed.map(({ row, componentTrims, aggregationRule }) => ({ date_month: row.date_month, view: scope, segment: row.segment, make: row.make, model: row.model, color_group: titleToken(row.model), color_hex: nameplateColor(row.model), plot_label: row.trim, associated_trims: componentTrims, plot_x_weighted_advertised_price: row.weighted_advertised_price, plot_y_trim_share_of_brand_inventory: row.average_inventory / Math.max(brandInventory, 1), bubble_size_average_inventory: row.average_inventory, trim: row.trim, average_inventory: row.average_inventory, weighted_advertised_price: row.weighted_advertised_price, price_band: band.label, selected_brand_view: "Yes", aggregation_rule: aggregationRule }));
    })).sort((a, b) => a.color_group.localeCompare(b.color_group) || a.plot_x_weighted_advertised_price - b.plot_x_weighted_advertised_price);
  })() : currentScopeRows.map((row) => ({
    date_month: row.date_month,
    view: scope,
    segment: row.segment,
    make: row.make,
    model: row.model,
    trim: row.trim,
    average_inventory: row.average_inventory,
    weighted_advertised_price: row.weighted_advertised_price,
    price_band: priceBandFor(row.weighted_advertised_price)?.label ?? "Outside displayed range",
    selected_brand_view: row.make === brandKey && row.model === model ? "Yes" : "No",
    competitor_overlay: competitiveMake && row.make === competitiveMake ? "Yes" : "No",
    aggregation_rule: "Raw trim-level data",
  }));

  const bandMetrics = (date: string, band: { lower: number; upper: number }) => {
    const periodRows = rows.filter((row) => inScope(row, date));
    const scopedGenesisRows = periodRows.filter((row) => row.make === brandKey && (scope === "brand" || row.model === model));
    const peerRows = periodRows.filter((row) => row.make !== brandKey);
    const inBand = (source: PriceBandRow[]) => source.filter((row) => row.weighted_advertised_price >= band.lower && row.weighted_advertised_price < band.upper).reduce((sum, row) => sum + row.average_inventory, 0);
    const total = (source: PriceBandRow[]) => source.reduce((sum, row) => sum + row.average_inventory, 0);
    return { genesis: inBand(scopedGenesisRows) / Math.max(total(scopedGenesisRows), 1), peers: inBand(peerRows) / Math.max(total(peerRows), 1) };
  };
  const retailBandAllocation = (date: string, band: { lower: number; upper: number }) => {
    const scoped = retailRows.filter((row) => row.date_month === date && (scope === "brand" ? brandSegments.has(row.segment) : row.segment === selectedSegment));
    const totalSales = scoped.reduce((sum, row) => sum + row.retail_sales, 0);
    const bandSales = scoped.filter((row) => row.weighted_advertised_price >= band.lower && row.weighted_advertised_price < band.upper).reduce((sum, row) => sum + row.retail_sales, 0);
    return totalSales > 0 ? bandSales / totalSales : null;
  };

  if (!genesisRows.length || !selectedSegment) return <section className="panel price-band-panel"><p className="empty-panel">No priced trim inventory is available for this view and month.</p></section>;
  return <section className="panel price-band-panel">
    <div className="panel-heading">
      <div><p className="eyebrow">Price-band allocation</p><h2>{scope === "brand" ? `${brandLabel} Brand Allocation` : `${selectedLabel} Trim Allocation`}</h2><p className="price-band-subtitle">{scope === "brand" ? `All ${brandLabel}-represented segments · ${integer(brandInventory)} average inventory · ${chartMonthLabel(currentMonth)} retail share ${pct(brandMetric?.retail_share, 1)}` : `${selectedSegment} · ${integer(metric?.retail_sales)} units · ${chartMonthLabel(currentMonth)} retail share ${pct(metric?.retail_share, 1)}`}</p></div>
      <div className="price-band-controls">
        <label className="model-filter price-band-filter">View<select value={scope} onChange={(event) => onScopeChange(event.target.value as PriceBandScope)} aria-label="Price-band view"><option value="model">Model</option><option value="brand">Brand</option></select></label>
        {scope === "model" ? <label className="model-filter price-band-filter">Model<select value={model} onChange={(event) => onModelChange(event.target.value)} aria-label="Price-band nameplate">{options.map((option) => <option value={option.model_series} key={option.model_series}>{option.display_name}</option>)}</select></label> : null}
        {scope === "model" ? <label className="model-filter price-band-filter">Competitor<select value={competitiveMake} onChange={(event) => onCompetitiveMakeChange(event.target.value)} aria-label="Price-band competitor overlay"><option value="">Off</option>{COMPETITIVE_MAKES.map((make) => <option value={make} key={make}>{BRAND_LABELS[make] ?? titleToken(make)}</option>)}</select></label> : null}
        <label className="model-filter price-band-filter">Month<select value={month} onChange={(event) => onMonthChange(event.target.value)} aria-label="Price-band reporting month">{months.map((item) => <option value={item} key={item}>{monthLabel(item)}</option>)}</select></label>
        <DataDownloadButton filename={`gma_price_band_${scope}_${model}_${month}.csv`} rows={downloadRows} />
      </div>
    </div>
    {scope === "brand" ? <div className="price-band-legend" aria-label={`${brandLabel} nameplate color key`}>{[...new Set(genesisRows.map((row) => row.model))].sort().map((nameplate) => <span key={nameplate}><i style={{ background: nameplateColor(nameplate) }} />{titleToken(nameplate)}</span>)}</div> : null}
    <div className="price-band-detail-row">
      <div className="price-band-top-label">% of {scope === "brand" ? `${brandLabel} brand` : "nameplate"} inventory by price band</div>
      <div className="price-band-headlines">{allocationBands.map((band) => {
        const current = bandMetrics(currentMonth, band);
        const priorMonth = bandMetrics(shiftMonth(currentMonth, -1), band);
        const priorYear = bandMetrics(shiftMonth(currentMonth, -12), band);
        const marketRetail = retailBandAllocation(currentMonth, band);
        const retailGap = marketRetail == null ? null : current.genesis - marketRetail;
        return <div className="price-band-headline" key={band.label}><b>{band.label}</b><span>{brandShort} i.a. {pct(current.genesis, 0)} · Segment i.a. {pct(marketRetail, 0)}</span><strong className={retailGap != null && retailGap > 0 ? "positive" : retailGap != null && retailGap < 0 ? "negative" : "neutral"}>{brandShort} v Segment allocation: {compactPp(retailGap)}</strong><small>{brandLabel} inventory allocation · M/M {compactPp(current.genesis - priorMonth.genesis)} · Y/Y {compactPp(current.genesis - priorYear.genesis)}</small></div>;
      })}</div>
    </div>
    <PriceBandCanvas rows={genesisRows} scope={scope} overlayRows={overlayRows} brandLabel={brandLabel} bands={bands} />
    <div className="price-band-summary price-band-detail-row">
      <div className="price-band-summary-heading"><b>% of segment inventory by price band</b></div>
      <div className="price-band-cards">{allocationBands.map((band) => {
        const inBand = currentScopeRows.filter((row) => row.weighted_advertised_price >= band.lower && row.weighted_advertised_price < band.upper);
        const totalBandInventory = inBand.reduce((sum, row) => sum + row.average_inventory, 0);
        const nameplates = new Map<string, { make: string; model: string; inventory: number }>();
        inBand.forEach((row) => {
          const key = scope === "brand" ? row.make : `${row.make}|${row.model}`;
          const entry = nameplates.get(key) ?? { make: row.make, model: row.model, inventory: 0 };
          entry.inventory += row.average_inventory;
          nameplates.set(key, entry);
        });
        const ranked = [...nameplates.entries()].map(([key, entry]) => ({ key, label: scope === "brand" ? BRAND_LABELS[entry.make] ?? titleToken(entry.make) : nameplateLabel(entry.make, entry.model), share: entry.inventory / Math.max(totalBandInventory, 1) })).sort((a, b) => b.share - a.share || a.label.localeCompare(b.label));
        const visible = ranked.slice(0, 3);
        const genesis = ranked.find((entry) => entry.key === selectedKey);
        if (genesis && !visible.some((entry) => entry.key === selectedKey)) visible.push(genesis);
        return <div className="price-band-card" key={band.label}><h3>{band.label}</h3>{visible.length ? <ul>{visible.map((entry) => <li className={entry.key === selectedKey ? "genesis-allocation" : ""} key={entry.key}><span>{entry.label} <strong>{pct(entry.share, 0)}</strong></span></li>)}</ul> : <p>—</p>}</div>;
      })}</div>
    </div>
    <p className="price-band-note">Advertised price is inventory weighted across in-stock listings. Market retail is SRS segment sales among nameplates with an in-stock price mapping, assigned to each nameplate&apos;s average advertised-price band—a model-price proxy, not trim-level sales. {scope === "brand" ? `The chart combines each nameplate’s trims below 2% of total ${brandLabel} inventory into Other within their respective price band.` : "The chart combines trims below 5% of nameplate inventory into Other within their respective price band."} Bubble size represents average inventory volume.</p>
  </section>;
}

function NationalHeatmap({ inventory, geography, month, brandLabel }: { inventory: CaliforniaDealerRow[]; geography: DmaGeography[]; month: string; brandLabel: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const currentInventory = useMemo(() => inventory.filter((row) => row.month === month), [inventory, month]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !geography.length) return;
    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(dpr, dpr);

      const points = geography.flatMap((dma) => dma.polygons.flat());
      const minLon = Math.min(...points.map((point) => point.longitude));
      const maxLon = Math.max(...points.map((point) => point.longitude));
      const minLat = Math.min(...points.map((point) => point.latitude));
      const maxLat = Math.max(...points.map((point) => point.latitude));
      // Longitude degrees are physically shorter than latitude degrees across the U.S.
      // Apply an equirectangular correction before fitting the continental map.
      const referenceLatitude = (minLat + maxLat) / 2;
      const longitudeScale = Math.cos(referenceLatitude * Math.PI / 180);
      const minProjectedLon = minLon * longitudeScale;
      const maxProjectedLon = maxLon * longitudeScale;
      const pad = 28;
      const scale = Math.min((rect.width - pad * 2) / (maxProjectedLon - minProjectedLon), (rect.height - pad * 2) / (maxLat - minLat));
      const mapWidth = (maxProjectedLon - minProjectedLon) * scale;
      const mapHeight = (maxLat - minLat) * scale;
      const offsetX = (rect.width - mapWidth) / 2;
      const offsetY = (rect.height - mapHeight) / 2;
      const project = (latitude: number, longitude: number) => ({
        x: offsetX + (longitude * longitudeScale - minProjectedLon) * scale,
        y: offsetY + (maxLat - latitude) * scale,
      });

      ctx.clearRect(0, 0, rect.width, rect.height);
      ctx.fillStyle = "#DDECF1";
      ctx.fillRect(0, 0, rect.width, rect.height);

      geography.forEach((dma) => dma.polygons.forEach((polygon) => {
        if (!polygon.length) return;
        ctx.beginPath();
        polygon.forEach((point, index) => {
          const projected = project(point.latitude, point.longitude);
          if (index === 0) ctx.moveTo(projected.x, projected.y); else ctx.lineTo(projected.x, projected.y);
        });
        ctx.closePath();
        ctx.fillStyle = "#F4F1E9";
        ctx.fill();
      }));

      const samples = currentInventory.map((dealer) => ({
        ...project(dealer.latitude, dealer.longitude),
        value: dealer.average_inventory,
      }));
      const sampleAverage = samples.reduce((sum, sample) => sum + sample.value, 0) / Math.max(samples.length, 1);
      const resolution = rect.width > 900 ? 4 : 3;
      const fieldCanvas = document.createElement("canvas");
      fieldCanvas.width = Math.max(1, Math.ceil(rect.width / resolution));
      fieldCanvas.height = Math.max(1, Math.ceil(rect.height / resolution));
      const fieldContext = fieldCanvas.getContext("2d");
      if (fieldContext) {
        const image = fieldContext.createImageData(fieldCanvas.width, fieldCanvas.height);
        const smoothing = Math.max(10, Math.min(rect.width, rect.height) * 0.025);
        const cloudRadius = Math.min(rect.width, rect.height) * 0.06;
        const interpolatedField = new Float32Array(fieldCanvas.width * fieldCanvas.height);
        const proximityField = new Float32Array(fieldCanvas.width * fieldCanvas.height);
        let maxInterpolated = sampleAverage;
        const colorStops: Array<[number, [number, number, number]]> = [
          [0, [35, 93, 181]],
          [.45, [45, 202, 77]],
          [.68, [255, 230, 30]],
          [.86, [255, 99, 18]],
          [1, [222, 21, 28]],
        ];
        const colorAt = (position: number) => {
          const upperIndex = colorStops.findIndex(([stop]) => stop >= position);
          if (upperIndex <= 0) return colorStops[0][1];
          const [lowStop, lowColor] = colorStops[upperIndex - 1];
          const [highStop, highColor] = colorStops[upperIndex];
          const mix = (position - lowStop) / (highStop - lowStop);
          return lowColor.map((channel, index) => Math.round(channel + (highColor[index] - channel) * mix));
        };

        for (let row = 0; row < fieldCanvas.height; row += 1) {
          for (let column = 0; column < fieldCanvas.width; column += 1) {
            const pixelX = (column + .5) * resolution;
            const pixelY = (row + .5) * resolution;
            let weightedInventory = 0;
            let totalWeight = 0;
            let nearestDistanceSquared = Number.POSITIVE_INFINITY;
            samples.forEach((sample) => {
              const distanceSquared = (pixelX - sample.x) ** 2 + (pixelY - sample.y) ** 2;
              const weight = 1 / ((distanceSquared + smoothing ** 2) ** 1.3);
              weightedInventory += sample.value * weight;
              totalWeight += weight;
              nearestDistanceSquared = Math.min(nearestDistanceSquared, distanceSquared);
            });
            const interpolated = totalWeight ? weightedInventory / totalWeight : 0;
            const fieldIndex = row * fieldCanvas.width + column;
            interpolatedField[fieldIndex] = interpolated;
            proximityField[fieldIndex] = Math.exp(-nearestDistanceSquared / (2 * cloudRadius ** 2));
            maxInterpolated = Math.max(maxInterpolated, interpolated);
          }
        }

        for (let row = 0; row < fieldCanvas.height; row += 1) {
          for (let column = 0; column < fieldCanvas.width; column += 1) {
            const fieldIndex = row * fieldCanvas.width + column;
            const interpolated = interpolatedField[fieldIndex];
            const colorPosition = interpolated <= sampleAverage
              ? .45 * (sampleAverage ? interpolated / sampleAverage : 0)
              : .45 + .55 * Math.min(1, Math.pow((interpolated - sampleAverage) / Math.max(maxInterpolated - sampleAverage, 1), .62) * 1.06);
            const color = colorAt(Math.max(0, Math.min(1, colorPosition)));
            const offset = fieldIndex * 4;
            image.data[offset] = color[0];
            image.data[offset + 1] = color[1];
            image.data[offset + 2] = color[2];
            const localizedProximity = Math.max(0, (proximityField[fieldIndex] - .04) / .96);
            image.data[offset + 3] = Math.round(245 * Math.min(1, localizedProximity * 1.5));
          }
        }
        fieldContext.putImageData(image, 0, 0);

        ctx.save();
        ctx.beginPath();
        geography.forEach((dma) => dma.polygons.forEach((polygon) => {
          polygon.forEach((point, index) => {
            const projected = project(point.latitude, point.longitude);
            if (index === 0) ctx.moveTo(projected.x, projected.y); else ctx.lineTo(projected.x, projected.y);
          });
          ctx.closePath();
        }));
        ctx.clip();
        ctx.drawImage(fieldCanvas, 0, 0, rect.width, rect.height);
        ctx.restore();
      }

      if (samples.length && sampleAverage > 0) {
        const highestInventory = Math.max(...samples.map((sample) => sample.value));
        ctx.save();
        ctx.beginPath();
        geography.forEach((dma) => dma.polygons.forEach((polygon) => {
          polygon.forEach((point, index) => {
            const projected = project(point.latitude, point.longitude);
            if (index === 0) ctx.moveTo(projected.x, projected.y); else ctx.lineTo(projected.x, projected.y);
          });
          ctx.closePath();
        }));
        ctx.clip();
        samples.filter((sample) => sample.value > sampleAverage).forEach((sample) => {
          const aboveAverageStrength = Math.min(1, (sample.value - sampleAverage) / Math.max(highestInventory - sampleAverage, 1));
          const radius = 9 + aboveAverageStrength * 17;
          const red = Math.round(255 - aboveAverageStrength * 33);
          const green = Math.round(184 - aboveAverageStrength * 163);
          const blue = Math.round(24 - aboveAverageStrength * 4);
          const core = ctx.createRadialGradient(sample.x, sample.y, 0, sample.x, sample.y, radius);
          core.addColorStop(0, `rgba(${red},${green},${blue},1)`);
          core.addColorStop(.28, `rgba(${red},${green},${blue},.94)`);
          core.addColorStop(1, `rgba(${red},${green},${blue},0)`);
          ctx.fillStyle = core;
          ctx.fillRect(sample.x - radius, sample.y - radius, radius * 2, radius * 2);
        });
        ctx.restore();
      }

      geography.forEach((dma) => dma.polygons.forEach((polygon) => {
        if (!polygon.length) return;
        ctx.beginPath();
        polygon.forEach((point, index) => {
          const projected = project(point.latitude, point.longitude);
          if (index === 0) ctx.moveTo(projected.x, projected.y); else ctx.lineTo(projected.x, projected.y);
        });
        ctx.closePath();
        ctx.strokeStyle = "rgba(61,78,88,.48)";
        ctx.lineWidth = 0.75;
        ctx.stroke();
      }));

    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [currentInventory, geography]);

  return <div className="heatmap-wrap">
    <canvas ref={ref} className="heatmap-canvas" aria-label={`Continental U.S. ${brandLabel} dealer inventory concentration indexed to the nationwide dealer average for ${month ? monthLabel(month) : "the selected month"}`} />
    <div className="heatmap-scale"><span>Below index 100</span><i /><span>Above index 100</span></div>
  </div>;
}

export default function Home() {
  const [brand, setBrand] = useState<keyof typeof BRAND_CONFIG>("genesis");
  const [rows, setRows] = useState<Row[]>([]);
  const [competitorRows, setCompetitorRows] = useState<CompetitorRow[]>([]);
  const [coxRows, setCoxRows] = useState<CoxRow[]>([]);
  const [coxSegmentRows, setCoxSegmentRows] = useState<CoxSegmentRow[]>([]);
  const [cloudSegmentRows, setCloudSegmentRows] = useState<CloudTheorySegmentRow[]>([]);
  const [priceBandRows, setPriceBandRows] = useState<PriceBandRow[]>([]);
  const [priceBandRetailRows, setPriceBandRetailRows] = useState<PriceBandRetailRow[]>([]);
  const [nationalDealerInventory, setNationalDealerInventory] = useState<CaliforniaDealerRow[]>([]);
  const [continentalGeography, setContinentalGeography] = useState<DmaGeography[]>([]);
  const [region, setRegion] = useState("NTL");
  const [month, setMonth] = useState("");
  const [modelFilter, setModelFilter] = useState("ALL");
  const [priceBandModel, setPriceBandModel] = useState("");
  const [priceBandScope, setPriceBandScope] = useState<PriceBandScope>("model");
  const [priceBandCompetitiveMake, setPriceBandCompetitiveMake] = useState("");
  const [regionalMetricsVisible, setRegionalMetricsVisible] = useState(true);
  const [supportingMetricsVisible, setSupportingMetricsVisible] = useState(false);
  const [loading, setLoading] = useState(true);

  const brandConfig = BRAND_CONFIG[brand];
  const assetPrefix = brand === "hyundai" ? "hyundai_" : "";
  const dealerInventoryAsset = brand === "hyundai" ? "hyundai_national_dealer_inventory_monthly" : "national_genesis_dealer_inventory_monthly";

  useEffect(() => {
    setLoading(true);
    setModelFilter("ALL");
    setPriceBandModel("");
    Promise.all([
      loadDashboardAsset<Row[]>(`${assetPrefix}operational_context_monthly.json`),
      loadDashboardAsset<CompetitorRow[]>(`${assetPrefix}competitor_efficiency_monthly.json`),
      loadDashboardAsset<CoxRow[]>(`${assetPrefix}cox_incentives_monthly.json`),
      loadDashboardAsset<CoxSegmentRow[]>(`${assetPrefix}cox_segment_incentives_monthly.json`),
      loadDashboardAsset<CloudTheorySegmentRow[]>(`${assetPrefix}cloudtheory_segment_model_metrics_monthly.json`),
      loadDashboardAsset<PriceBandRow[]>(`${assetPrefix}price_band_trim_allocation_monthly.json`),
      loadDashboardAsset<PriceBandRetailRow[]>(`${assetPrefix}price_band_retail_proxy_monthly.json`),
      loadDashboardAsset<CaliforniaDealerRow[]>(`${dealerInventoryAsset}.json`),
      loadDashboardAsset<DmaGeography[]>("continental_dma_geography.json"),
    ]).then(([data, comparisons, incentives, segmentIncentives, cloudSegments, priceBands, priceBandRetail, dealerInventory, nationalGeography]) => {
        setRows(data);
        setCompetitorRows(comparisons);
        setCoxRows(incentives);
        setCoxSegmentRows(segmentIncentives);
        setCloudSegmentRows(cloudSegments);
        setPriceBandRows(priceBands);
        setPriceBandRetailRows(priceBandRetail);
        setNationalDealerInventory(dealerInventory);
        setContinentalGeography(nationalGeography);
        const incentiveMonths = new Set(incentives.map((row) => row.date_month));
        const competitorMonths = new Set(comparisons.map((row) => row.date_month));
        setMonth([...new Set(data.map((row) => row.date_month))]
          .filter((dateMonth) => incentiveMonths.has(dateMonth) && competitorMonths.has(dateMonth))
          .sort()
          .at(-1) ?? "");
        setLoading(false);
      });
  }, [assetPrefix, dealerInventoryAsset]);

  const regions = useMemo(() => {
    const map = new Map(rows.map((row) => [row.region_code, row.region_name]));
    return REGION_ORDER.filter((code) => map.has(code)).map((code) => ({ code, name: map.get(code)! }));
  }, [rows]);
  const months = useMemo(() => {
    const incentiveMonths = new Set(coxRows.map((row) => row.date_month));
    const competitorMonths = new Set(competitorRows.map((row) => row.date_month));
    return [...new Set(rows.map((row) => row.date_month))]
      .filter((dateMonth) => incentiveMonths.has(dateMonth) && competitorMonths.has(dateMonth))
      .sort();
  }, [rows, coxRows, competitorRows]);
  useEffect(() => {
    if (!months.length || months.includes(month)) return;
    setMonth(months.at(-1) ?? "");
  }, [month, months]);
  const brandTrend = useMemo(() => rows
    .filter((row) => row.region_code === region && row.entity_level === "Brand")
    .sort((a, b) => a.date_month.localeCompare(b.date_month)), [rows, region]);
  const competitorTrend = useMemo(() => competitorRows.filter((row) => row.region_code === region), [competitorRows, region]);
  const current = useMemo(() => brandTrend.find((row) => row.date_month === month), [brandTrend, month]);
  const nationalMetric = useMemo(() => rows.find((row) => row.region_code === "NTL" && row.date_month === month && row.entity_level === "Brand"), [rows, month]);
  const nationalCoxMetric = useMemo(() => coxRows.find((row) => row.region_code === "NTL" && row.date_month === month && row.entity_level === "Brand"), [coxRows, month]);
  const nationalModelMetrics = useMemo(() => rows.filter((row) => row.region_code === "NTL" && row.date_month === month && row.entity_level === "Model"), [rows, month]);
  const priceBandMetric = useMemo(() => nationalModelMetrics.find((row) => row.model_series === priceBandModel), [nationalModelMetrics, priceBandModel]);
  useEffect(() => {
    if (!nationalModelMetrics.length) return;
    if (!nationalModelMetrics.some((row) => row.model_series === priceBandModel)) setPriceBandModel(nationalModelMetrics[0].model_series);
  }, [nationalModelMetrics, priceBandModel]);
  const nationalCoxModelMetrics = useMemo(() => coxRows.filter((row) => row.date_month === month && row.entity_level === "Model"), [coxRows, month]);
  const regionalMetrics = useMemo(() => REGION_ORDER.slice(1)
    .map((code) => rows.find((row) => row.region_code === code && row.date_month === month && row.entity_level === "Brand"))
    .filter((row): row is Row => Boolean(row))
    .sort((a, b) => b.average_inventory - a.average_inventory || a.region_name.localeCompare(b.region_name)), [rows, month]);
  const modelRows = useMemo(() => rows
    .filter((row) => row.region_code === region && row.date_month === month && row.entity_level === "Model")
    .sort((a, b) => b.average_inventory - a.average_inventory || a.display_name.localeCompare(b.display_name)), [rows, region, month]);
  useEffect(() => {
    if (modelFilter !== "ALL" && !modelRows.some((row) => row.model_series === modelFilter)) setModelFilter("ALL");
  }, [modelFilter, modelRows]);
  const selectedModelLabel = modelFilter === "ALL" ? "" : modelRows.find((row) => row.model_series === modelFilter)?.display_name ?? modelFilter.toUpperCase();
  const trendRows = useMemo(() => {
    const source = modelFilter === "ALL" ? brandTrend : rows
      .filter((row) => row.region_code === region && row.entity_level === "Model" && row.model_series === modelFilter)
      .sort((a, b) => a.date_month.localeCompare(b.date_month));
    return source.filter((row) => !month || row.date_month <= month);
  }, [brandTrend, modelFilter, month, region, rows]);
  const trendCoxRows = useMemo(() => coxRows.filter((row) => modelFilter === "ALL"
    ? row.entity_level === "Brand"
    : row.entity_level === "Model" && row.model_series === `${brand}_${modelFilter}`), [brand, coxRows, modelFilter]);
  const trendDownloadRows = useMemo(() => trendRows.map((row) => {
    const incentive = trendCoxRows.find((item) => item.date_month === row.date_month);
    return {
      date_month: row.date_month,
      geography: row.region_name,
      model: modelFilter === "ALL" ? brandConfig.label : row.display_name,
      average_inventory: row.average_inventory,
      inventory_share: row.inventory_share,
      retail_sales: row.retail_sales,
      retail_share: row.retail_share,
      soi_som_ratio: row.inventory_retail_ratio,
      incentive_index: incentive?.incentive_index,
    };
  }), [modelFilter, trendCoxRows, trendRows]);
  const coxModelMetrics = useMemo(() => new Map(coxRows
    .filter((row) => row.date_month === month && row.entity_level === "Model")
    .map((row) => [row.model_series.replace(new RegExp(`^${brand}_`), ""), row])), [brand, coxRows, month]);
  const modelDownloadRows = useMemo(() => modelRows.map((row) => {
    const incentive = coxModelMetrics.get(row.model_series);
    return {
      date_month: row.date_month,
      geography: row.region_name,
      model: row.display_name,
      segment: row.segment,
      average_inventory: row.average_inventory,
      average_inventory_mom_pct: row.average_inventory_mom_pct,
      average_inventory_yoy_pct: row.average_inventory_yoy_pct,
      inventory_share: row.inventory_share,
      inventory_share_mom_pp: row.inventory_share_mom_pp,
      inventory_share_yoy_pp: row.inventory_share_yoy_pp,
      weighted_msrp: row.weighted_avg_msrp,
      weighted_msrp_mom_pct: row.weighted_avg_msrp_mom_pct,
      weighted_msrp_yoy_pct: row.weighted_avg_msrp_yoy_pct,
      msrp_index: row.msrp_inventory_weighted_index,
      msrp_index_mom_delta: row.msrp_inventory_weighted_index_mom_delta,
      msrp_index_yoy_delta: row.msrp_inventory_weighted_index_yoy_delta,
      weighted_price: row.weighted_avg_price,
      weighted_price_mom_pct: row.weighted_avg_price_mom_pct,
      weighted_price_yoy_pct: row.weighted_avg_price_yoy_pct,
      price_index: row.price_inventory_weighted_index,
      price_index_mom_delta: row.price_inventory_weighted_index_mom_delta,
      price_index_yoy_delta: row.price_inventory_weighted_index_yoy_delta,
      incentive_amount: incentive?.incentive_pnv,
      incentive_amount_mom_pct: incentive?.incentive_pnv_mom_pct,
      incentive_amount_yoy_pct: incentive?.incentive_pnv_yoy_pct,
      incentive_index: incentive?.incentive_index,
      incentive_index_mom_delta: incentive?.incentive_index_mom_delta,
      incentive_index_yoy_delta: incentive?.incentive_index_yoy_delta,
    };
  }), [coxModelMetrics, modelRows]);
  const heatmapDownloadRows = useMemo(() => nationalDealerInventory.filter((row) => row.month === month).map((row) => ({
    date_month: row.month,
    seller_id: row.seller_id,
    dealer_name: row.dealer_name,
    city: row.city,
    state: row.state_province,
    dma_code: row.dma_code,
    dma_name: row.dma_name,
    latitude: row.latitude,
    longitude: row.longitude,
    average_inventory: row.average_inventory,
  })), [month, nationalDealerInventory]);
  const coxSegmentComparisons = useMemo(() => {
    const grouped = new Map<string, CoxSegmentRow[]>();
    coxSegmentRows.filter((row) => row.date_month === month).forEach((row) => {
      const segmentRows = grouped.get(row.segment) ?? [];
      segmentRows.push(row);
      grouped.set(row.segment, segmentRows);
    });
    grouped.forEach((segmentRows) => segmentRows.sort((a, b) => (b.incentive_index ?? -Infinity) - (a.incentive_index ?? -Infinity)));
    return grouped;
  }, [coxSegmentRows, month]);
  const cloudSegmentComparisons = useMemo(() => {
    const grouped = new Map<string, CloudTheorySegmentRow[]>();
    cloudSegmentRows.filter((row) => row.date_month === month && row.region_code === region).forEach((row) => {
      const segmentRows = grouped.get(row.segment) ?? [];
      segmentRows.push(row);
      grouped.set(row.segment, segmentRows);
    });
    return grouped;
  }, [cloudSegmentRows, month, region]);

  const narrative = current
    ? `${current.region_name} average ${brandConfig.label} inventory ${current.average_inventory_mom_pct == null ? "is available" : `${current.average_inventory_mom_pct >= 0 ? "rose" : "fell"} ${pct(Math.abs(current.average_inventory_mom_pct), 1)} month over month`} to ${integer(current.average_inventory)} units. Inventory share is ${pct(current.inventory_share, 1)} versus ${pct(current.retail_share, 1)} retail share, a ${ratio(current.inventory_retail_ratio)} supply-to-demand position.`
    : "Loading the latest operational context.";

  return (
    <main className={`brand-${brand}`}>
      <header className="topbar">
        <div className="brand-lockup"><span className="brand-mark">{brand === "genesis" ? "G" : "H"}</span><div><b>{brandConfig.lockup}</b><small>MONTHLY PERFORMANCE</small></div></div>
        <div className="topbar-actions"><div className="page-title">OPERATIONS</div></div>
      </header>

      <section className="intro">
        <div>
          <p className="eyebrow">Supply and demand health</p>
          <h1>{loading ? "Operations" : `${monthLabel(month)} operations`}</h1>
          <p>{narrative}</p>
        </div>
        <div className="filters" aria-label="Dashboard filters">
          <label>Brand<select value={brand} onChange={(event) => setBrand(event.target.value as keyof typeof BRAND_CONFIG)}><option value="genesis">Genesis</option><option value="hyundai">Hyundai</option></select></label>
          <label>Geography<select value={region} onChange={(event) => setRegion(event.target.value)}>{regions.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label>
          <label>Reporting month<select value={month} onChange={(event) => setMonth(event.target.value)}>{months.map((item) => <option key={item} value={item}>{monthLabel(item)}</option>)}</select></label>
        </div>
      </section>

      <section className="dashboard-grid">
        <aside className="kpi-column" aria-label="Key operational metrics">
          <button className={`metric-regions-toggle ${regionalMetricsVisible ? "open" : ""}`} type="button" aria-expanded={regionalMetricsVisible} aria-label={`${regionalMetricsVisible ? "Hide" : "Show"} all regional metric detail`} title={`${regionalMetricsVisible ? "Hide" : "Show"} regional detail`} onClick={() => setRegionalMetricsVisible((visible) => !visible)}><span aria-hidden="true">⌄</span></button>
          <RegionalMetricCard title="Average inventory" source="CloudTheory" national={nationalMetric} regions={regionalMetrics} valueKey="average_inventory" momKey="average_inventory_mom_pct" yoyKey="average_inventory_yoy_pct" valueFormatter={integer} changeUnit="pct" regionsVisible={regionalMetricsVisible} />
          <RegionalMetricCard title="Inventory share" source="CloudTheory" national={nationalMetric} regions={regionalMetrics} valueKey="inventory_share" momKey="inventory_share_mom_pp" yoyKey="inventory_share_yoy_pp" valueFormatter={(value) => pct(value, 1)} changeUnit="pp" regionsVisible={regionalMetricsVisible} />
          <RegionalMetricCard title="Weighted price" source="CloudTheory" national={nationalMetric} regions={regionalMetrics} valueKey="weighted_avg_price" momKey="weighted_avg_price_mom_pct" yoyKey="weighted_avg_price_yoy_pct" valueFormatter={currency} changeUnit="pct" regionsVisible={regionalMetricsVisible} />
          <RegionalMetricCard title="Price index" source="CloudTheory" national={nationalMetric} regions={regionalMetrics} valueKey="price_inventory_weighted_index" momKey="price_inventory_weighted_index_mom_delta" yoyKey="price_inventory_weighted_index_yoy_delta" valueFormatter={indexValue} changeUnit="points" regionsVisible={regionalMetricsVisible} />
          <NationalMetricCard title="Incentive PNVs" source="Cox Automotive" value={nationalCoxMetric?.incentive_pnv} mom={nationalCoxMetric?.incentive_pnv_mom_pct} yoy={nationalCoxMetric?.incentive_pnv_yoy_pct} valueFormatter={currency} changeUnit="pct" />
          <NationalMetricCard title="Incentive index" source="Cox Automotive" value={nationalCoxMetric?.incentive_index} mom={nationalCoxMetric?.incentive_index_mom_delta} yoy={nationalCoxMetric?.incentive_index_yoy_delta} valueFormatter={wholeIndex} changeUnit="points" />
          <section className="panel heatmap-panel kpi-heatmap">
            <div className="panel-heading">
              <div><p className="eyebrow">Continental U.S.</p><h2>Dealer inventory concentration versus nationwide index 100</h2></div>
              <div className="panel-heading-actions"><p className="panel-note">Nationwide dealer-level interpolation · concentration, not dealer coverage · {month ? monthLabel(month) : "Reporting month"}</p><DataDownloadButton filename={`${brand}_dealer_inventory_${month}.csv`} rows={heatmapDownloadRows} /></div>
            </div>
            <NationalHeatmap inventory={nationalDealerInventory} geography={continentalGeography} month={month} brandLabel={brandConfig.label} />
          </section>
          <InsightsPanel national={nationalMetric} cox={nationalCoxMetric} models={nationalModelMetrics} regions={regionalMetrics} coxModels={nationalCoxModelMetrics} brandKey={brand} brandLabel={brandConfig.label} />
          <div className="coverage-note"><b>Reading the indices</b><span>Incentive index compares {brandConfig.label} PNVs with the inventory-weighted incentive in each model&apos;s Cox segment. MSRP index compares weighted MSRP with its market benchmark. For both, 100 indicates parity.</span></div>
        </aside>

        <div className="content-column">
          <section className="panel trend-panel">
            <div className="panel-heading">
              <div><p className="eyebrow">Monthly history</p><h2>{selectedModelLabel ? `${selectedModelLabel} ` : ""}SOI, SOM and inventory efficiency</h2></div>
              <div className="trend-panel-controls">
                <div className="legend"><span className="incentive-key">National inventory-weighted incentive index</span><span className="soi-key">SOI</span><span className="som-key">SOM</span><span className="ratio-key">SOI / SOM ratio</span></div>
                <label className="model-filter">Model<select value={modelFilter} onChange={(event) => setModelFilter(event.target.value)}><option value="ALL">All models</option>{modelRows.map((row) => <option value={row.model_series} key={row.model_series}>{row.display_name}</option>)}</select></label>
                <DataDownloadButton filename={`${brand}_monthly_history_${modelFilter.toLowerCase()}_${region}.csv`} rows={trendDownloadRows} />
              </div>
            </div>
            <TrendCanvas rows={trendRows} competitorRows={modelFilter === "ALL" ? competitorTrend : []} coxRows={trendCoxRows} />
          </section>

          <section className="panel model-panel">
            <div className="panel-heading">
              <div><p className="eyebrow">Inventory &amp; MSRP</p><h2>{current?.region_name ?? "National"} model performance</h2></div>
              <div className="panel-heading-actions"><p className="panel-note">Hover average inventory for national trim-balance allocation. CloudTheory measures follow the selected geography; Cox incentive metrics are national.</p><button className={`model-metrics-toggle ${supportingMetricsVisible ? "open" : ""}`} type="button" aria-expanded={supportingMetricsVisible} onClick={() => setSupportingMetricsVisible((visible) => !visible)}><span>More metrics</span><i aria-hidden="true">⌄</i></button><DataDownloadButton filename={`gma_model_performance_${region}_${month}.csv`} rows={modelDownloadRows} /></div>
            </div>
            <div className="table-wrap">
              <table className={`metric-table ${supportingMetricsVisible ? "details-visible" : ""}`}>
                <thead>
                  <tr className="group-head"><th rowSpan={2}>Model</th><th colSpan={3}>Average inventory<small>{current?.region_name ?? "National"}</small></th><th colSpan={3}>Share of inventory<small>{current?.region_name ?? "National"}</small></th><th colSpan={3}>Weighted price<small>{current?.region_name ?? "National"}</small></th><th colSpan={3}>Price index<small>{current?.region_name ?? "National"}</small></th><th colSpan={3}>Incentive PNVs<small>National</small></th><th colSpan={3}>Incentive index<small>National · Inventory weighted</small></th>{supportingMetricsVisible ? <><th colSpan={3}>Weighted MSRP<small>{current?.region_name ?? "National"}</small></th><th colSpan={3}>MSRP index<small>{current?.region_name ?? "National"}</small></th></> : null}</tr>
                  <tr>{Array.from({ length: supportingMetricsVisible ? 24 : 18 }, (_, index) => <th key={index}>{index % 3 === 0 ? "Current" : index % 3 === 1 ? "M/M" : "Y/Y"}</th>)}</tr>
                </thead>
                <tbody>{modelRows.map((row) => {
                  const incentive = coxModelMetrics.get(row.model_series);
                  return <tr key={`${row.model_series}-${row.segment}`}>
                  <th><span>{row.display_name}</span><small>{row.segment}</small></th>
                  <TrimBalanceInventoryCell metric={row} rows={priceBandRows} brandKey={brand} bands={brand === "hyundai" ? HYUNDAI_TRIM_BALANCE_BANDS : TRIM_BALANCE_BANDS} />
                  <td><Change value={row.average_inventory_mom_pct} unit="pct" /></td>
                  <td><Change value={row.average_inventory_yoy_pct} unit="pct" /></td>
                  <SegmentMetricCell metric={row} comparisons={cloudSegmentComparisons.get(row.segment) ?? []} history={rows.filter((item) => item.region_code === region && item.entity_level === "Model" && item.model_series === row.model_series).sort((a, b) => a.date_month.localeCompare(b.date_month))} kind="share" />
                  <td><Change value={row.inventory_share_mom_pp} unit="pp" /></td>
                  <td><Change value={row.inventory_share_yoy_pp} unit="pp" /></td>
                  <td>{currency(row.weighted_avg_price)}</td>
                  <td><Change value={row.weighted_avg_price_mom_pct} unit="pct" /></td>
                  <td><Change value={row.weighted_avg_price_yoy_pct} unit="pct" /></td>
                  <SegmentMetricCell metric={row} comparisons={cloudSegmentComparisons.get(row.segment) ?? []} history={rows.filter((item) => item.region_code === region && item.entity_level === "Model" && item.model_series === row.model_series).sort((a, b) => a.date_month.localeCompare(b.date_month))} kind="price" />
                  <td><Change value={row.price_inventory_weighted_index_mom_delta} unit="points" /></td>
                  <td><Change value={row.price_inventory_weighted_index_yoy_delta} unit="points" /></td>
                  <td>{currency(incentive?.incentive_pnv)}</td>
                  <td><Change value={incentive?.incentive_pnv_mom_pct} unit="pct" /></td>
                  <td><Change value={incentive?.incentive_pnv_yoy_pct} unit="pct" /></td>
                  <IncentiveIndexCell metric={incentive} comparisons={incentive ? coxSegmentComparisons.get(incentive.segment) ?? [] : []} history={coxRows.filter((item) => item.entity_level === "Model" && item.model_series === incentive?.model_series).sort((a, b) => a.date_month.localeCompare(b.date_month))} />
                  <td><Change value={incentive?.incentive_index_mom_delta} unit="points" /></td>
                  <td><Change value={incentive?.incentive_index_yoy_delta} unit="points" /></td>
                  {supportingMetricsVisible ? <><td>{currency(row.weighted_avg_msrp)}</td><td><Change value={row.weighted_avg_msrp_mom_pct} unit="pct" /></td><td><Change value={row.weighted_avg_msrp_yoy_pct} unit="pct" /></td><SegmentMetricCell metric={row} comparisons={cloudSegmentComparisons.get(row.segment) ?? []} history={rows.filter((item) => item.region_code === region && item.entity_level === "Model" && item.model_series === row.model_series).sort((a, b) => a.date_month.localeCompare(b.date_month))} kind="msrp" /><td><Change value={row.msrp_inventory_weighted_index_mom_delta} unit="points" /></td><td><Change value={row.msrp_inventory_weighted_index_yoy_delta} unit="points" /></td></> : null}
                </tr>;
                })}</tbody>
              </table>
            </div>
          </section>

          <PriceBandPanel rows={priceBandRows} retailRows={priceBandRetailRows} metric={priceBandMetric} brandMetric={nationalMetric} model={priceBandModel} options={nationalModelMetrics} month={month} months={months} scope={priceBandScope} competitiveMake={priceBandCompetitiveMake} onModelChange={setPriceBandModel} onMonthChange={setMonth} onScopeChange={setPriceBandScope} onCompetitiveMakeChange={setPriceBandCompetitiveMake} brandKey={brand} brandLabel={brandConfig.label} brandShort={brandConfig.short} bands={brand === "hyundai" ? HYUNDAI_TRIM_BALANCE_BANDS : TRIM_BALANCE_BANDS} />

        </div>
      </section>

      <footer><span>Sources: Cox Automotive incentives · CloudTheory average inventory and share · SRS completed-month retail sales and share · DMA geography reference</span><span>Cox incentive metrics are national-only · National excludes NH and Unassigned · Data from Jan 2025</span></footer>
    </main>
  );
}
