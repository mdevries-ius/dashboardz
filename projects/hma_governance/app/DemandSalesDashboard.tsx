"use client";

import { useEffect, useMemo, useState } from "react";

type Snapshot = {
  month: string;
  prior_month: string;
  model: string;
  segment: string;
  search_volume: number;
  segment_search_volume: number;
  search_share: number;
  prior_search_share: number;
  search_share_mom_pp: number;
  retail_units: number;
  segment_retail_units: number;
  retail_share: number;
  prior_retail_share: number;
  retail_share_mom_pp: number;
};

type Monthly = Pick<Snapshot, "month" | "model" | "segment" | "search_share" | "retail_share">;

type QuadData = {
  generated_at: string;
  current_month: string;
  prior_month: string;
  scope: string;
  models: string[];
  snapshots: Snapshot[];
  monthly: Monthly[];
};

const COLORS = ["#00aad2", "#002c5f", "#ef4d37", "#5d6b78", "#7c5cff", "#00a878", "#d69500"];

const pct = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 });
const units = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const monthLabel = (value: string) => new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value.slice(0, 7)}-02T00:00:00Z`));
const pp = (value: number) => `${value > 0 ? "+" : ""}${value.toFixed(1)} pp`;

function TinyTrend({ rows, field, color }: { rows: Monthly[]; field: "search_share" | "retail_share"; color: string }) {
  const values = rows.map((row) => row[field]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const points = values.map((value, index) => {
    const x = values.length === 1 ? 0 : (index / (values.length - 1)) * 240;
    const y = 54 - ((value - min) / (max - min || 1)) * 42;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg className="sparkline" viewBox="0 0 240 64" role="img" aria-label={`${field === "search_share" ? "Search" : "Retail"} share trend`}>
      <line x1="0" y1="55" x2="240" y2="55" stroke="#d7dde3" />
      <polyline points={points} fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      {points && <circle cx={points.split(" ").at(-1)?.split(",")[0]} cy={points.split(" ").at(-1)?.split(",")[1]} r="4.5" fill={color} stroke="white" strokeWidth="2" />}
    </svg>
  );
}

function Quadrant({ rows, selected, onSelect }: { rows: Snapshot[]; selected: string; onSelect: (model: string) => void }) {
  const extent = Math.max(0.5, ...rows.flatMap((row) => [Math.abs(row.search_share_mom_pp), Math.abs(row.retail_share_mom_pp)])) * 1.25;
  const left = 68, top = 42, width = 620, height = 420;
  const x = (value: number) => left + ((value + extent) / (extent * 2)) * width;
  const y = (value: number) => top + height - ((value + extent) / (extent * 2)) * height;
  const zeroX = x(0), zeroY = y(0);
  return (
    <svg className="quadrant" viewBox="0 0 760 520" role="img" aria-label="Demand and retail sales share momentum quadrant">
      <rect x={left} y={top} width={width} height={height} rx="12" fill="#f7f9fb" />
      <rect x={zeroX} y={top} width={left + width - zeroX} height={zeroY - top} fill="#e8f7f4" />
      <rect x={left} y={top} width={zeroX - left} height={zeroY - top} fill="#f5f1ff" />
      <rect x={zeroX} y={zeroY} width={left + width - zeroX} height={top + height - zeroY} fill="#fff7e5" />
      <rect x={left} y={zeroY} width={zeroX - left} height={top + height - zeroY} fill="#fff0ee" />
      <line x1={zeroX} y1={top} x2={zeroX} y2={top + height} stroke="#8d99a5" strokeWidth="1.5" />
      <line x1={left} y1={zeroY} x2={left + width} y2={zeroY} stroke="#8d99a5" strokeWidth="1.5" />
      <text x={left + 16} y={top + 24} className="quad-label">SALES LEAD</text>
      <text x={left + width - 16} y={top + 24} textAnchor="end" className="quad-label positive">DUAL MOMENTUM</text>
      <text x={left + 16} y={top + height - 14} className="quad-label negative">PRESSURE</text>
      <text x={left + width - 16} y={top + height - 14} textAnchor="end" className="quad-label warm">DEMAND LEAD</text>
      {[-1, -0.5, 0, 0.5, 1].map((ratio) => (
        <g key={ratio}>
          <text x={left + ((ratio + 1) / 2) * width} y={top + height + 25} textAnchor="middle" className="tick">{pp(ratio * extent)}</text>
          <text x={left - 12} y={top + height - ((ratio + 1) / 2) * height + 4} textAnchor="end" className="tick">{pp(ratio * extent)}</text>
        </g>
      ))}
      {rows.map((row, index) => {
        const active = row.model === selected;
        return (
          <g key={row.model} className={`plot-point ${active ? "active" : ""}`} onClick={() => onSelect(row.model)} role="button" tabIndex={0} onKeyDown={(event) => (event.key === "Enter" || event.key === " ") && onSelect(row.model)} aria-label={`${row.model}: search ${pp(row.search_share_mom_pp)}, retail ${pp(row.retail_share_mom_pp)}`}>
            {active && <circle cx={x(row.search_share_mom_pp)} cy={y(row.retail_share_mom_pp)} r="18" fill="none" stroke="#002c5f" strokeWidth="2" opacity=".22" />}
            <circle cx={x(row.search_share_mom_pp)} cy={y(row.retail_share_mom_pp)} r={active ? 10 : 7} fill={COLORS[index % COLORS.length]} stroke="white" strokeWidth="3" />
            <text x={x(row.search_share_mom_pp) + 12} y={y(row.retail_share_mom_pp) - 10} className="point-label">{row.model}</text>
          </g>
        );
      })}
      <text x={left + width / 2} y="510" textAnchor="middle" className="axis-title">SEARCH SHARE — MoM percentage-point change</text>
      <text transform={`translate(17 ${top + height / 2}) rotate(-90)`} textAnchor="middle" className="axis-title">RETAIL SHARE — MoM percentage-point change</text>
    </svg>
  );
}

export function DemandSalesDashboard() {
  const [data, setData] = useState<QuadData | null>(null);
  const [selected, setSelected] = useState("Tucson");
  const [methodology, setMethodology] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/data/quadchart.json")
      .then((response) => { if (!response.ok) throw new Error(); return response.json(); })
      .then((payload: QuadData) => { setData(payload); if (!payload.models.includes(selected)) setSelected(payload.models[0]); })
      .catch(() => setError(true));
  }, []);

  const active = data?.snapshots.find((row) => row.model === selected);
  const trend = useMemo(() => data?.monthly.filter((row) => row.model === selected).slice(-13) ?? [], [data, selected]);

  if (error) return <main className="state"><span>HMA GOVERNANCE</span><h1>Data feed unavailable</h1><p>Refresh the governed local extract, then reload this view.</p></main>;
  if (!data || !active) return <main className="state loading"><span>HMA GOVERNANCE</span><h1>Loading governed data</h1><div className="loader" /></main>;

  return (
    <main className="app-shell">
      <header>
        <div className="brand"><div className="brand-mark">H</div><div><strong>HMA GOVERNANCE</strong><span>Demand × Sales Intelligence</span></div></div>
        <div className="header-actions"><span className="period">{monthLabel(data.current_month)} vs {monthLabel(data.prior_month)}</span><button className="text-button" onClick={() => setMethodology(true)}>Methodology</button></div>
      </header>

      <section className="control-bar">
        <div><label htmlFor="model">Hyundai model</label><select id="model" value={selected} onChange={(event) => setSelected(event.target.value)}>{data.models.map((model) => <option key={model}>{model}</option>)}</select></div>
        <div className="segment"><span>Custom segment</span><strong>{active.segment}</strong></div>
        <div className="freshness"><span className="status-dot" />Validated local extract <time>{new Date(data.generated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</time></div>
      </section>

      <section className="dashboard-grid">
        <article className="hero-card">
          <div className="card-heading"><div><span className="eyebrow">PORTFOLIO MOMENTUM</span><h1>Demand × retail quadchart</h1></div><div className="legend"><span><i className="search" />Search share</span><span><i className="sales" />Retail share</span></div></div>
          <Quadrant rows={data.snapshots} selected={selected} onSelect={setSelected} />
        </article>

        <aside className="detail-column">
          <article className="model-card navy">
            <span className="eyebrow">SELECTED MODEL</span><h2>{active.model}</h2><p>{active.segment}</p>
            <div className={`signal ${active.search_share_mom_pp >= 0 && active.retail_share_mom_pp >= 0 ? "up" : "mixed"}`}><span>{active.search_share_mom_pp >= 0 && active.retail_share_mom_pp >= 0 ? "DUAL MOMENTUM" : "MIXED SIGNAL"}</span></div>
          </article>
          <article className="metric-card">
            <div className="metric-title"><span>Share of segment search</span><strong className={active.search_share_mom_pp >= 0 ? "gain" : "loss"}>{pp(active.search_share_mom_pp)}</strong></div>
            <div className="metric-value">{pct.format(active.search_share)}</div>
            <TinyTrend rows={trend} field="search_share" color="#00aad2" />
            <footer>{units.format(active.search_volume)} index volume <span>of {units.format(active.segment_search_volume)}</span></footer>
          </article>
          <article className="metric-card">
            <div className="metric-title"><span>Share of retail sales</span><strong className={active.retail_share_mom_pp >= 0 ? "gain" : "loss"}>{pp(active.retail_share_mom_pp)}</strong></div>
            <div className="metric-value">{pct.format(active.retail_share)}</div>
            <TinyTrend rows={trend} field="retail_share" color="#002c5f" />
            <footer>{units.format(active.retail_units)} retail units <span>of {units.format(active.segment_retail_units)}</span></footer>
          </article>
        </aside>
      </section>

      <section className="audit-strip">
        <div><span>GOVERNED SOURCES</span><strong>Google AdOps</strong><small>Demand / search proxy</small></div>
        <div><span>×</span></div>
        <div><strong>SRS · MarketView MAX02</strong><small>National retail sales</small></div>
        <div className="audit-rule"><strong>One denominator</strong><small>Approved custom segment membership applied to both measures</small></div>
      </section>

      {methodology && <div className="modal-backdrop" onMouseDown={() => setMethodology(false)}><section className="modal" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="method-title"><button className="close" onClick={() => setMethodology(false)} aria-label="Close methodology">×</button><span className="eyebrow">GOVERNANCE NOTE</span><h2 id="method-title">How this quadchart works</h2><dl><div><dt>X axis</dt><dd>Current month search share minus prior month search share, expressed in percentage points.</dd></div><div><dt>Y axis</dt><dd>Current month retail share minus prior month retail share, expressed in percentage points.</dd></div><div><dt>Denominators</dt><dd>Special segmentation applies only to Google search and uses Governance List Revised → Full Set. SRS retail share always uses each vehicle’s native SRS segment without adjustment. Display filters never change either denominator.</dd></div><div><dt>Source flow</dt><dd>Read-only Databricks pulls are stored locally as raw evidence, normalized into one JSON/CSV dataset, and published to this view.</dd></div></dl><button className="primary" onClick={() => setMethodology(false)}>Understood</button></section></div>}
    </main>
  );
}
