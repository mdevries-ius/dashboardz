"use client";

import { useMemo, useState } from "react";
import macroContext from "../public/data/macro_context.json";
import competitiveContext from "../public/data/comp_context.json";
import summaryData from "../public/data/summary_metrics.json";

type StageId = "summary" | "sales" | "market-share" | "media" | "operations" | "macro" | "awareness-opinion" | "consideration-research" | "shopping" | "purchase" | "loyalty";

type Stage = {
  id: StageId;
  label: string;
  eyebrow: string;
  title: string;
  description: string;
  source: string;
  accent: string;
  bars: number[];
};

const stages: Stage[] = [
  { id: "summary", label: "Summary", eyebrow: "DAILY OVERVIEW", title: "Performance summary", description: "A governed view across retail, supply, incentives, and market context.", source: "Multiple governed sources", accent: "cyan", bars: [42, 58, 49, 65, 61, 74, 71, 82] },
  { id: "sales", label: "Sales Volume", eyebrow: "SALES PERFORMANCE", title: "Sales volume", description: "Retail sales performance across the selected geography, model, and period.", source: "Governed sales source · pending", accent: "navy", bars: [36, 48, 43, 61, 55, 68, 63, 77] },
  { id: "market-share", label: "Market Share", eyebrow: "MARKET POSITION", title: "Market share", description: "Brand and model position within the approved competitive denominator.", source: "Governed share source · pending", accent: "blue", bars: [64, 58, 62, 54, 60, 66, 63, 69] },
  { id: "media", label: "Media", eyebrow: "MEDIA PERFORMANCE", title: "Media", description: "Investment, delivery, and response signals across the selected period.", source: "Governed media source · pending", accent: "violet", bars: [32, 45, 41, 57, 52, 64, 69, 73] },
  { id: "operations", label: "Operations", eyebrow: "OPERATING CONTEXT", title: "Operations", description: "Inventory, pricing, dealer, and operational readiness indicators.", source: "Governed operations sources · pending", accent: "teal", bars: [29, 38, 45, 52, 61, 69, 65, 73] },
  { id: "macro", label: "Macroeconomic & Other Major Influences", eyebrow: "MARKET CONTEXT", title: "Macroeconomic & other major influences", description: "Economic signals and current automotive-industry events.", source: "Public primary sources", accent: "violet", bars: [48, 54, 51, 63, 59, 71, 67, 75] },
  { id: "awareness-opinion", label: "Awareness & Opinion", eyebrow: "BRAND HEALTH", title: "Awareness & opinion", description: "Awareness, familiarity, and brand-opinion signals across the audience journey.", source: "Governed brand-health source · pending", accent: "cyan", bars: [43, 49, 52, 55, 58, 62, 66, 69] },
  { id: "consideration-research", label: "Consideration & Research", eyebrow: "MID-FUNNEL", title: "Consideration & research", description: "Consideration and research behavior before active shopping begins.", source: "Governed journey source · pending", accent: "blue", bars: [28, 39, 46, 51, 60, 65, 71, 76] },
  { id: "shopping", label: "Shopping", eyebrow: "SHOPPING ACTIVITY", title: "Shopping", description: "Shopping engagement, configuration, and vehicle-detail activity.", source: "Governed shopping source · pending", accent: "amber", bars: [40, 47, 44, 58, 63, 61, 72, 78] },
  { id: "purchase", label: "Purchase", eyebrow: "PURCHASE", title: "Purchase", description: "Lead, showroom, credit, incentive, and purchase-conversion context.", source: "Governed purchase sources · pending", accent: "navy", bars: [35, 42, 49, 54, 57, 66, 70, 75] },
  { id: "loyalty", label: "Loyalty", eyebrow: "OWNER VALUE", title: "Loyalty", description: "Retention, repurchase, and owner-value indicators.", source: "Governed loyalty source · pending", accent: "teal", bars: [51, 54, 56, 61, 63, 67, 68, 72] },
];

type MetricKey = "retail_sales" | "retail_share" | "inventory" | "incentives" | "macro_rate" | "media_spend" | "google_adops";
type SummaryRecord = { metric: MetricKey; month: string; model: string; region: string; value: number; range?: string };

const summaryMetrics = [
  { label: "Retail Sales", key: "retail_sales" as MetricKey, eyebrow: "SRS", title: "Retail sales", accent: "navy", target: "sales" as StageId },
  { label: "Retail Share", key: "retail_share" as MetricKey, eyebrow: "SRS · INDUSTRY DENOMINATOR", title: "Retail share of industry", accent: "blue", target: "market-share" as StageId },
  { label: "Inventory", key: "inventory" as MetricKey, eyebrow: "CLOUDTHEORY", title: "Inventory", accent: "teal", target: "operations" as StageId },
  { label: "Incentives", key: "incentives" as MetricKey, eyebrow: "COX AUTOMOTIVE", title: "Incentive PNVS", accent: "amber", target: "purchase" as StageId },
  { label: "Macro/Competitive", key: "macro_rate" as MetricKey, eyebrow: "FEDERAL RESERVE", title: "Federal funds target", accent: "violet", target: "macro" as StageId },
  { label: "Media Spend", key: "media_spend" as MetricKey, eyebrow: "HMA WEEKLY / CMO", title: "Media spend", accent: "violet", target: "media" as StageId },
  { label: "Google Ad Ops", key: "google_adops" as MetricKey, eyebrow: "GOOGLE AD OPS", title: "Search opportunity", accent: "cyan", target: "media" as StageId },
  { label: "Brand Awareness", key: null, eyebrow: "BRAND HEALTH", title: "Brand awareness", accent: "cyan", bars: [43, 49, 52, 55, 58, 62, 66, 69], target: "awareness-opinion" as StageId },
  { label: "Demand", key: null, eyebrow: "CONSIDERATION / RESEARCH", title: "Demand", accent: "blue", bars: [28, 39, 46, 51, 60, 65, 71, 76], target: "consideration-research" as StageId },
  { label: "Shopping", key: null, eyebrow: "SHOPPING ACTIVITY", title: "Shopping", accent: "amber", bars: [40, 47, 44, 58, 63, 61, 72, 78], target: "shopping" as StageId },
  { label: "Purchase", key: null, eyebrow: "PURCHASE", title: "Purchase", accent: "navy", bars: [35, 42, 49, 54, 57, 66, 70, 75], target: "purchase" as StageId },
  { label: "Loyalty", key: null, eyebrow: "OWNER VALUE", title: "Loyalty", accent: "teal", bars: [51, 54, 56, 61, 63, 67, 68, 72], target: "loyalty" as StageId },
];

const summaryBands = [
  { id: "sales-share", label: "Retail Sales | Retail Share", metrics: ["Retail Sales", "Retail Share"] },
  { id: "supply-context", label: "Inventory | Incentives | Macro/Competitive", metrics: ["Inventory", "Incentives", "Macro/Competitive"] },
  { id: "media", label: "Media Spend | Google Ad Ops", metrics: ["Media Spend", "Google Ad Ops"] },
  { id: "brand-demand", label: "Brand Awareness | Demand (Consideration / Research)", metrics: ["Brand Awareness", "Demand"] },
  { id: "journey", label: "Shopping — Purchase — Loyalty", metrics: ["Shopping", "Purchase", "Loyalty"] },
] as const;

const summaryInsights = [
  { section: "Retail Sales | Retail Share", headline: "September retail volume improved while Hyundai held roughly stable industry share.", subhead: "The result suggests demand kept pace with the broader market rather than materially outgrowing it; maintaining conversion support into October will be important if Hyundai is to turn volume momentum into share expansion." },
  { section: "Inventory | Incentives | Macro/Competitive", headline: "Available inventory supported September conversion without a broad-based increase in PNVS.", subhead: "That balance protects margin while keeping dealers supplied, but replenishment should remain targeted toward the models showing the strongest velocity as financing pressure continues to constrain payment-sensitive shoppers." },
  { section: "Media Spend | Google Ad Ops", headline: "September media weight aligned with the strongest pockets of search opportunity.", subhead: "Concentrating investment where shopper intent is already forming should improve near-term efficiency; the next allocation should favor models and markets where search growth is not yet limited by inventory." },
  { section: "Brand Awareness | Demand", headline: "Illustrative upper-funnel signals point to improving awareness and consideration momentum.", subhead: "If governed brand-health feeds confirm that lift, October messaging should reinforce the attributes driving consideration before competitors absorb the incremental demand." },
  { section: "Shopping | Purchase | Loyalty", headline: "Illustrative journey signals suggest a stable path from active shopping through purchase and ownership.", subhead: "Sustaining that progression will depend on removing late-funnel friction and following new owners with retention communications that can protect future loyalty and repurchase intent." },
];

const regions = [
  ["NTL", "National"], ["CE", "Central"], ["EA", "Eastern"], ["MA", "Mid-Atlantic"],
  ["MS", "Mountain States"], ["SC", "South Central"], ["SO", "Southern"], ["WE", "Western"],
];

const models = summaryData.models;
const periods = [["2026-09", "September 2026"], ["2026-08", "August 2026"], ["2026-07", "July 2026"]];

type ContextBullet = {
  date: string;
  headline: string;
  outlet: string;
  url: string;
  context: string;
  category?: string;
  direction?: string;
  affected_segments?: string[];
  models?: string[];
};

const competitiveContexts = competitiveContext.contexts as Record<string, { window_end: string; bullets: ContextBullet[] }>;

function getCompetitiveBullets(model: string) {
  if (competitiveContexts[model]) return competitiveContexts[model].bullets.slice(0, 5);
  const seen = new Set<string>();
  return Object.values(competitiveContexts).flatMap((context) => context.bullets).sort((a, b) => b.date.localeCompare(a.date)).filter((bullet) => {
    if (seen.has(bullet.url)) return false;
    seen.add(bullet.url);
    return true;
  }).slice(0, 5);
}

function PlaceholderChart({ bars, accent, labels = ["FEB", "APR", "JUN", "SEP"], values = [], expanded = false, label = "Metric trend" }: { bars: number[]; accent: string; labels?: string[]; values?: string[]; expanded?: boolean; label?: string }) {
  return (
    <div className={`placeholder-chart ${expanded ? "expanded" : ""}`} aria-label={label}>
      <div className="chart-grid" aria-hidden="true">
        {bars.map((height, index) => <span className={`bar ${accent}`} style={{ height: `${height}%` }} key={`${height}-${index}`}>{values[index] && <em className="bar-value">{values[index]}</em>}</span>)}
      </div>
      <div className="chart-axis">{labels.map((item) => <span key={item}>{item}</span>)}</div>
    </div>
  );
}

function chartHeights(metric: MetricKey, rows: SummaryRecord[]) {
  const values = rows.map((row) => row.value);
  if (!values.length) return [];
  if (metric === "retail_share") {
    const minimum = Math.min(...values);
    const maximum = Math.max(...values);
    const spread = Math.max(maximum - minimum, maximum * 0.01, 0.0001);
    const floor = Math.max(0, minimum - spread * 0.35);
    const ceiling = maximum + spread * 0.35;
    return values.map((value) => Math.round(12 + ((value - floor) / (ceiling - floor)) * 80));
  }
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[middle] : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
  return values.map((value) => Math.max(8, Math.min(96, Math.round((value / Math.max(median * 2, 1)) * 100))));
}

const metricRecords = summaryData.records as SummaryRecord[];
const sourceContracts = summaryData.sources as Record<MetricKey, { label: string; through: string; scope?: string }>;

function resolveScope(metric: MetricKey, model: string, region: string) {
  if (metric === "media_spend" || metric === "macro_rate") return { model: "All Hyundai", region: "NTL", note: "National brand" };
  if (metric === "inventory" || metric === "incentives") return { model, region: "NTL", note: region === "NTL" ? "National" : "National only" };
  return { model, region, note: region === "NTL" ? "National" : regions.find(([code]) => code === region)?.[1] ?? region };
}

function formatValue(metric: MetricKey, value: number, range?: string) {
  if (metric === "retail_share") return `${(value * 100).toFixed(1)}%`;
  if (metric === "incentives") return `$${Math.round(value).toLocaleString()}`;
  if (metric === "media_spend") return `$${(value / 1_000_000).toFixed(1)}M`;
  if (metric === "macro_rate") return range ?? `${value.toFixed(2)}%`;
  if (metric === "google_adops") return value.toFixed(1);
  return Math.round(value).toLocaleString();
}

function formatChartValue(metric: MetricKey, value: number) {
  if (metric === "retail_share") return `${(value * 100).toFixed(1)}%`;
  if (metric === "macro_rate") return `${value.toFixed(2)}%`;
  if (metric === "media_spend") return `$${Math.round(value / 1_000_000)}M`;
  if (metric === "incentives") return `$${(value / 1_000).toFixed(1)}K`;
  if (value >= 100_000) return `${Math.round(value / 1_000)}K`;
  if (value >= 10_000) return `${(value / 1_000).toFixed(1)}K`;
  return Math.round(value).toLocaleString();
}

function shiftMonth(month: string, amount: number) {
  const [year, index] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, index - 1 + amount, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function comparisonText(metric: MetricKey, current: number, comparison?: number) {
  if (comparison === undefined || !Number.isFinite(comparison)) return "—";
  if (metric === "retail_share" || metric === "macro_rate") {
    const delta = metric === "retail_share" ? (current - comparison) * 100 : current - comparison;
    return `${delta >= 0 ? "+" : ""}${delta.toFixed(1)} pp`;
  }
  if (comparison === 0) return "—";
  const delta = (current / comparison - 1) * 100;
  return `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%`;
}

function ytdComparison(metric: MetricKey, rows: SummaryRecord[], period: string) {
  const year = Number(period.slice(0, 4));
  const monthNumber = Number(period.slice(5, 7));
  const current = rows.filter((row) => Number(row.month.slice(0, 4)) === year && Number(row.month.slice(5, 7)) <= monthNumber);
  const prior = rows.filter((row) => Number(row.month.slice(0, 4)) === year - 1 && Number(row.month.slice(5, 7)) <= monthNumber);
  if (current.length !== monthNumber || prior.length !== monthNumber) return "—";
  const additive = ["retail_sales", "media_spend", "google_adops"].includes(metric);
  const aggregate = (items: SummaryRecord[]) => items.reduce((sum, row) => sum + row.value, 0) / (additive ? 1 : items.length);
  return comparisonText(metric, aggregate(current), aggregate(prior));
}

function MetricCard({ stage, model, region, period, onOpen }: { stage: (typeof summaryMetrics)[number]; model: string; region: string; period: string; onOpen: () => void }) {
  if (!stage.key) {
    return (
      <button className="metric-card" type="button" onClick={onOpen} aria-label={`Open ${stage.label} stage`}>
        <div className="metric-card-head">
          <div><span className="eyebrow">{stage.eyebrow}</span><h3>{stage.title}</h3></div>
          <span className="card-arrow" aria-hidden="true">↗</span>
        </div>
        <PlaceholderChart bars={stage.bars} accent={stage.accent} label={`${stage.title} placeholder`} />
        <div className="metric-footer"><span>Data connection deferred</span><strong>—</strong></div>
      </button>
    );
  }
  const scope = resolveScope(stage.key, model, region);
  const allRecords = metricRecords.filter((row) => row.metric === stage.key && row.model === scope.model && row.region === scope.region).sort((a, b) => a.month.localeCompare(b.month));
  const all = allRecords.filter((row) => row.month <= period);
  const current = all.find((row) => row.month === period);
  const selectedYear = period.slice(0, 4);
  const trend = all.filter((row) => row.month.startsWith(selectedYear));
  const bars = chartHeights(stage.key, trend);
  const labels = trend.map((row) => new Date(`${row.month}-01T00:00:00Z`).toLocaleString("en-US", { month: "short", timeZone: "UTC" }).toUpperCase());
  const chartValues = trend.map((row) => formatChartValue(stage.key, row.value));
  const priorMonth = allRecords.find((row) => row.month === shiftMonth(period, -1));
  const priorYear = allRecords.find((row) => row.month === shiftMonth(period, -12));
  const source = sourceContracts[stage.key];
  return (
    <button className="metric-card" type="button" onClick={onOpen} aria-label={`Open ${stage.label} stage`}>
      <div className="metric-card-head">
        <div><span className="eyebrow">{stage.eyebrow}</span><h3>{stage.title}</h3></div>
        <span className="card-arrow" aria-hidden="true">↗</span>
      </div>
      <PlaceholderChart bars={bars.length ? bars : [8]} accent={stage.accent} labels={labels.length ? labels : ["—"]} values={chartValues} label={`${stage.title} governed trend`} />
      <div className="metric-footer">
        <div className="metric-current"><small>{periods.find(([value]) => value === period)?.[1]}</small><strong>{current ? formatValue(stage.key, current.value, current.range) : "—"}</strong></div>
        <div className="metric-comparisons"><span><small>M/M</small>{current ? comparisonText(stage.key, current.value, priorMonth?.value) : "—"}</span><span><small>Y/Y</small>{current ? comparisonText(stage.key, current.value, priorYear?.value) : "—"}</span><span><small>CYTD</small>{current ? ytdComparison(stage.key, allRecords, period) : "—"}</span></div>
      </div>
      <span className="metric-source">{current ? `${scope.note} · through ${source.through}` : `No ${period} record · through ${source.through}`}</span>
    </button>
  );
}

export function TommyDashboard() {
  const [activeStage, setActiveStage] = useState<StageId>("summary");
  const [region, setRegion] = useState("NTL");
  const [model, setModel] = useState("All Hyundai");
  const [period, setPeriod] = useState(summaryData.default_period);
  const [contextView, setContextView] = useState<"summary" | "competitive" | "macro">("summary");
  const [openBands, setOpenBands] = useState<string[]>(["sales-share"]);
  const [activeBand, setActiveBand] = useState("sales-share");

  const active = useMemo(() => stages.find((stage) => stage.id === activeStage) ?? stages[0], [activeStage]);
  const contextBullets = contextView === "macro" ? (macroContext.context.bullets as ContextBullet[]).slice(0, 5) : getCompetitiveBullets(model);
  const contextWindow = contextView === "macro" ? macroContext.context.window_end : competitiveContexts[model]?.window_end ?? competitiveContext.generated_at.slice(0, 10);
  const rotateContext = (direction: -1 | 1) => {
    const views = ["summary", "competitive", "macro"] as const;
    const next = (views.indexOf(contextView) + direction + views.length) % views.length;
    setContextView(views[next]);
  };
  const toggleBand = (id: string) => {
    setActiveBand(id);
    setOpenBands((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  return (
    <main>
      <header className="topbar">
        <div className="view-title"><h1>{activeStage === "summary" ? "Daily performance overview" : active.title}</h1></div>
        <div className="topbar-meta"><span className="status-dot" />Governed extracts <strong>{periods.find(([value]) => value === period)?.[1]}</strong></div>
      </header>

      <nav className="stage-nav" aria-label="Dashboard stages">
        <div className="stage-track" role="tablist" aria-label="Select dashboard stage">
          {stages.map((stage) => (
            <button key={stage.id} type="button" role="tab" aria-selected={activeStage === stage.id} className={activeStage === stage.id ? "selected" : ""} onClick={() => setActiveStage(stage.id)}>
              {stage.label}
            </button>
          ))}
        </div>
      </nav>

      <section className="control-shell" aria-label="Dashboard filters">
        <div className="selectors">
          <label>Region<select value={region} onChange={(event) => setRegion(event.target.value)}>{regions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
          <label>Model<select value={model} onChange={(event) => setModel(event.target.value)}>{models.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>Time period<select value={period} onChange={(event) => setPeriod(event.target.value)}>{periods.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        </div>
      </section>

      <div className="dashboard-layout">
        <section className="workspace" aria-live="polite">
          {activeStage === "summary" ? (
            <>
              <section className="executive-placeholder" aria-label="Executive Summary Placeholder">
                <div className="executive-heading"><span className="eyebrow">ILLUSTRATIVE EXECUTIVE SUMMARY</span><h2>Tucson search share rose +2.0 pp in August 2026 as Hyundai&apos;s mid-month design preview drove +18.3% search interest against a declining segment (-4.1%), converting to +0.4 pp retail share gain (+6.4% units) despite -11.7% inventory contraction that left the model supply-constrained at 0.80× inventory parity.</h2></div>
                <p>Tucson sustained above-average sales velocity and conversion efficiency while RAV4 captured retail share through an availability advantage. Elevated search interest may translate to further retail growth if inventory replenishment arrives before design-preview momentum dissipates, though sustained competitive hybrid supply could compress the opportunity.</p>
                <span className="executive-source">Data-connected summary shell · {model} · {regions.find(([value]) => value === region)?.[1]} · Source freshness varies by card</span>
              </section>
              <div className="summary-bands">
                {summaryBands.map((band) => {
                  const isOpen = openBands.includes(band.id);
                  const bandMetrics = band.metrics.map((label) => summaryMetrics.find((metric) => metric.label === label)!);
                  return (
                    <section className={`summary-band ${activeBand === band.id ? "active" : ""}`} key={band.id}>
                      <button className="band-toggle" type="button" aria-expanded={isOpen} onClick={() => toggleBand(band.id)}>
                        <span>{band.label}</span><span className="band-caret" aria-hidden="true">{isOpen ? "▾" : "▸"}</span>
                      </button>
                      {isOpen && <div className={`band-grid columns-${bandMetrics.length}`}>{bandMetrics.map((stage) => <MetricCard stage={stage} model={model} region={region} period={period} onOpen={() => { setActiveBand(band.id); setActiveStage(stage.target); }} key={stage.label} />)}</div>}
                    </section>
                  );
                })}
              </div>
            </>
          ) : (
            <section className="stage-detail-card">
              <div className="detail-heading">
                <div><span className="eyebrow">{active.source}</span><h2>{model} · {regions.find(([value]) => value === region)?.[1]}</h2><p>{periods.find(([value]) => value === period)?.[1]}</p></div>
                <span className="data-state">DATA CONNECTION PENDING</span>
              </div>
              <PlaceholderChart bars={active.bars} accent={active.accent} expanded />
              <div className="detail-metrics"><div><span>Current</span><strong>—</strong></div><div><span>Month over month</span><strong>—</strong></div><div><span>Year over year</span><strong>—</strong></div><div><span>Source refreshed</span><strong>Pending</strong></div></div>
            </section>
          )}
        </section>

        <aside className="intelligence-rail" aria-label="Industry intelligence">
          <section className="context-card">
            <div className="context-head">
              <button className="context-nav" type="button" onClick={() => rotateContext(-1)} aria-label="Previous context view">‹</button>
              <div><span className="rail-label">{contextView === "summary" ? "SUMMARY" : contextView === "macro" ? "MACRO & INDUSTRY CONTEXT" : "PRODUCT & RELEASE CONTEXT"}</span><small>{contextView === "summary" ? "Illustrative headlines" : `Updated ${contextWindow}`}</small></div>
              <button className="context-nav" type="button" onClick={() => rotateContext(1)} aria-label="Next context view">›</button>
            </div>
            {contextView === "summary" ? <ul className="context-list summary-insights">
              {summaryInsights.map((insight) => <li className="context-item" key={insight.section}><span className="context-section">{insight.section}</span><h3>{insight.headline}</h3><p>{insight.subhead}</p></li>)}
            </ul> : <ul className="context-list">
              {contextBullets.map((bullet) => (
                <li className="context-item" key={`${contextView}-${bullet.url}`}>
                  <a href={bullet.url} target="_blank" rel="noreferrer">{bullet.headline}<span aria-hidden="true">↗</span></a>
                  <span className="context-meta">{[bullet.date, bullet.outlet, bullet.category, bullet.direction].filter(Boolean).join(" · ")}</span>
                  <p>{bullet.context}{bullet.affected_segments?.length ? ` Affected: ${bullet.affected_segments.join(", ")}.` : ""}</p>
                </li>
              ))}
            </ul>}
          </section>
        </aside>
      </div>

      <footer><div><strong>DATA CONTRACT</strong><span>Shared governed extracts from Sales/Demand, Ops, and HMA Weekly.</span></div><div><strong>NATIONAL SCOPE</strong><span>NH remains in National calculations and is not selectable.</span></div><div><strong>FRESHNESS</strong><span>All Summary sources are current through September 2026.</span></div></footer>
    </main>
  );
}
