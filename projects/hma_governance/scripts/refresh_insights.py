#!/usr/bin/env python3
"""Build and optionally AI-edit governed dashboard executive headlines."""

from __future__ import annotations

import argparse
import calendar
import hashlib
import json
import os
import re
import statistics
import urllib.error
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
REPORTS_ROOT = ROOT.parents[1]
DATA_PATH = ROOT / "data" / "processed" / "quadchart.json"
CONTEXT_PATH = ROOT / "data" / "processed" / "comp_context.json"
SUPERVISOR_CONTEXT_PATH = ROOT / "data" / "processed" / "supervisor_context.json"
OUTPUT_PATH = ROOT / "data" / "processed" / "insights.json"
PUBLIC_PATH = ROOT / "public" / "data" / "insights.json"
PROMPT_PATH = ROOT / "prompts" / "dashboard_headline_editor.md"
API_URL = "https://api.openai.com/v1/responses"
COMPARISON = "prior3ma"
MODE = "special"
VIEWS = ("momentum", "positions", "efficiency", "conversion")
BANNED = re.compile(
    r"\b(caused|drove|driving|led to|due to|resulted in|proves|will|should|guarantees)\b",
    re.IGNORECASE,
)

SUPERVISOR_AGENT_LABELS = {
    "agent_srs_sales-max02": "SRS Sales Agent",
    "agent_cloudtheory-max02": "Cloud Theory Agent",
    "agent_coxautomotive-max02": "Cox Automotive Agent",
    "agent_gcom-max02": "GCom Agent",
    "agent_marketview_2.0": "MarketView Agent",
    "agent_hcom": "HCom Agent",
    "agent_googleadops": "Google AdOps Agent",
}


def norm(value: str) -> str:
    return re.sub(r"^_|_$", "", re.sub(r"[^a-z0-9]+", "_", value.lower()))


def pct(value: float | None) -> str:
    return "n/a" if value is None else f"{value * 100:.1f}%"


def pp(value: float | None) -> str:
    if value is None:
        return "n/a"
    return f"{'+' if value > 0 else ''}{value:.1f} pp"


def ratio(value: float | None) -> str:
    return "n/a" if value is None else f"{value:.2f}×"


def decimal(value: float | None) -> str:
    return "n/a" if value is None else f"{value:.2f}"


def change_pct(current: float | None, prior: float | None) -> float | None:
    if current is None or prior in (None, 0):
        return None
    return 100 * (current - prior) / abs(prior)


def signed_pct(value: float | None) -> str:
    if value is None:
        return "n/a"
    return f"{'+' if value > 0 else ''}{value:.1f}%"


def parity_relation(value: float | None) -> str:
    """Describe parity at the same two-decimal precision shown to the user."""
    if value is None:
        return "unavailable"
    if round(value, 2) == 1:
        return "at"
    return "above" if value > 1 else "below"


def load_api_key() -> str | None:
    if value := os.getenv("OPENAI_API_KEY"):
        return value
    for path in (REPORTS_ROOT / "hma_weekly" / ".env", ROOT / ".env"):
        if not path.exists():
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            match = re.fullmatch(r"\s*OPENAI_API_KEY\s*=\s*(.+?)\s*", line)
            if match and (value := match.group(1).strip().strip('"').strip("'")):
                return value
    return None


def response_text(payload: dict[str, Any]) -> str:
    return "\n".join(
        content.get("text", "")
        for item in payload.get("output", [])
        for content in item.get("content", [])
        if content.get("type") == "output_text"
    ).strip()


def aggregate(rows: list[dict[str, Any]]) -> dict[str, Any] | None:
    if not rows:
        return None
    total = lambda key: sum(float(row.get(key) or 0) for row in rows)
    search_volume = total("search_volume")
    segment_search = total("segment_search_volume")
    retail_units = total("retail_units")
    segment_retail = total("segment_retail_units")
    inventory_rows = [row for row in rows if row.get("inventory_units") is not None and row.get("segment_inventory_units")]
    inventory_units = total("inventory_units") if inventory_rows else None
    segment_inventory = total("segment_inventory_units") if inventory_rows else None
    return {
        **rows[-1],
        "search_volume": search_volume,
        "segment_search_volume": segment_search,
        "search_share": search_volume / segment_search if segment_search else None,
        "retail_units": retail_units,
        "segment_retail_units": segment_retail,
        "retail_share": retail_units / segment_retail if segment_retail else None,
        "inventory_units": inventory_units,
        "segment_inventory_units": segment_inventory,
        "inventory_share": inventory_units / segment_inventory if inventory_units is not None and segment_inventory else None,
    }


def target_rows(data: dict[str, Any], model: str, mode: str) -> list[dict[str, Any]]:
    key = norm(model)
    rows = [
        row for row in data["competitor_monthly"]
        if row["target_model"] == model
        and row["segment_mode"] == mode
        and str(row["family_key"]).split("__", 1)[0] == key
    ]
    return sorted(rows, key=lambda row: row["month"])


def humanize_family(value: str) -> str:
    exact = {
        "4_runner": "4Runner", "bz4x": "bZ4X", "cr_v": "CR-V", "cr_v_fcev": "CR-V FCEV",
        "cx_30": "CX-30", "cx_50": "CX-50", "cx_50_hev": "CX-50 HEV", "cx_60": "CX-60",
        "cx_70": "CX-70", "cx_70_phev": "CX-70 PHEV", "cx_9": "CX-9", "cx_90": "CX-90",
        "cx_90_phev": "CX-90 PHEV", "gr_corolla": "GR Corolla", "hr_v": "HR-V", "id_4": "ID.4",
        "ioniq_5": "Ioniq 5", "k4": "K4", "k4_hatchback": "K4 Hatchback", "k5": "K5",
        "k5_hybrid": "K5 Hybrid", "model_y": "Model Y", "mustang_mach_e": "Mustang Mach-E",
        "mx_30": "MX-30", "r2": "R2", "rav4": "RAV4", "rav4_hybrid": "RAV4 Hybrid",
        "rav4_prime": "RAV4 Prime", "wrangler_4xe": "Wrangler 4xe", "wrx": "WRX",
    }
    if value in exact:
        return exact[value]
    acronyms = {"ev": "EV", "fcev": "FCEV", "hev": "HEV", "phev": "PHEV"}
    return " ".join(acronyms.get(token, token.capitalize()) for token in value.split("_"))


def competitive_movers(
    data: dict[str, Any], model: str, mode: str, month: str, comparison: str
) -> list[dict[str, Any]]:
    grouped: dict[str, list[dict[str, Any]]] = {}
    for row in data["competitor_monthly"]:
        if row["target_model"] == model and row["segment_mode"] == mode:
            grouped.setdefault(row["family_key"], []).append(row)
    target_key = norm(model)
    candidates = []
    for family_key, family_rows in grouped.items():
        if str(family_key).split("__", 1)[0] == target_key:
            continue
        prior, current = comparison_pair(sorted(family_rows, key=lambda row: row["month"]), month, comparison)
        if not prior or not current:
            continue
        search_change = None
        retail_change = None
        if current.get("search_share") is not None and prior.get("search_share") is not None:
            search_change = (current["search_share"] - prior["search_share"]) * 100
        if (
            current.get("retail_share") is not None
            and prior.get("retail_share") is not None
            and current.get("retail_srs_segment")
            and prior.get("retail_srs_segment")
        ):
            retail_change = (current["retail_share"] - prior["retail_share"]) * 100
        candidates.append({
            "model_key": current["family"],
            "model_label": humanize_family(current["family"]),
            "search_change": search_change,
            "retail_change": retail_change,
        })
    search = [item for item in candidates if item["search_change"] is not None]
    retail = [item for item in candidates if item["retail_change"] is not None]
    selections = []
    for fact_id, metric, items, key, chooser, owner in (
        ("comp_search_gainer", "competitive_search_share_gainer", search, "search_change", max, "Google AdOps"),
        ("comp_search_decliner", "competitive_search_share_decliner", search, "search_change", min, "Google AdOps"),
        ("comp_retail_gainer", "competitive_retail_share_gainer", retail, "retail_change", max, "SRS Sales"),
        ("comp_retail_decliner", "competitive_retail_share_decliner", retail, "retail_change", min, "SRS Sales"),
    ):
        if not items:
            continue
        selected = chooser(items, key=lambda item: item[key])
        value = selected[key]
        selections.append({
            "fact_id": fact_id,
            "metric_key": metric,
            "raw_value": value,
            "display_value": f"{selected['model_label']} {pp(value)}",
            "headline_value": pp(value),
            "model_key": selected["model_key"],
            "model_label": selected["model_label"],
            "direction": "rose" if value > 0 else "fell" if value < 0 else "was unchanged",
            "formula_key": "competitive_model_share_current_minus_comparison",
            "source_assets": ["ius_unity_prod.google_datamart.ad_opportunity_regional_daily"] if owner == "Google AdOps" else ["ius_unity_prod.sandbox.agent_srs"],
            "source_owner": owner,
            "source_kind": "direct_table_export",
            "eligible_for_headline": True,
            "role": "competitive",
        })
    return selections


def comparison_pair(rows: list[dict[str, Any]], month: str, comparison: str) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    by_month = {row["month"]: row for row in rows}
    months = sorted(by_month)
    if month not in by_month:
        return None, None
    index = months.index(month)
    current = by_month[month]
    if comparison == "prior3ma":
        prior_months = months[max(0, index - 3):index]
        prior = aggregate([by_month[value] for value in prior_months]) if len(prior_months) == 3 else None
        if prior:
            for key in ("search_volume", "segment_search_volume", "retail_units", "segment_retail_units", "inventory_units", "segment_inventory_units"):
                if prior.get(key) is not None:
                    prior[key] /= 3
        return prior, current
    if comparison == "mom":
        return (by_month[months[index - 1]] if index >= 1 else None), current
    if comparison == "yoy":
        prior = f"{int(month[:4]) - 1}{month[4:]}"
        return by_month.get(prior), current
    year, through = int(month[:4]), int(month[5:7])
    current_rows = [row for row in rows if int(row["month"][:4]) == year and int(row["month"][5:7]) <= through]
    prior_rows = [row for row in rows if int(row["month"][:4]) == year - 1 and int(row["month"][5:7]) <= through]
    return aggregate(prior_rows), aggregate(current_rows)


def fact(
    fact_id: str,
    metric: str,
    raw: float | None,
    display: str,
    formula: str,
    sources: list[str],
    source_owner: str | list[str],
    **annotations: Any,
) -> dict[str, Any]:
    return {
        "fact_id": fact_id,
        "metric_key": metric,
        "raw_value": raw,
        "display_value": display,
        "formula_key": formula,
        "source_assets": sources,
        "source_owner": source_owner,
        "source_kind": "direct_table_export",
        "eligible_for_headline": raw is not None,
        **annotations,
    }


def full_universe_medians(data: dict[str, Any], model: str, mode: str, month: str) -> tuple[float | None, float | None]:
    rows = [
        row for row in data["competitor_monthly"]
        if row["target_model"] == model and row["segment_mode"] == mode and row["month"] == month
    ]
    velocity = [row["retail_units"] / row["inventory_units"] for row in rows if row.get("inventory_units") and row.get("retail_units") is not None]
    conversion = [row["retail_units"] / row["search_volume"] for row in rows if row.get("search_volume") and row.get("retail_units") is not None]
    return (statistics.median(velocity) if velocity else None, statistics.median(conversion) if conversion else None)


def release_events(context: dict[str, Any], model: str, month: str, mover_labels: list[str]) -> list[dict[str, Any]]:
    year, month_number = int(month[:4]), int(month[5:7])
    period_end = date(year, month_number, calendar.monthrange(year, month_number)[1])
    period_start = period_end - timedelta(days=150)
    events = []
    for bullet in context.get("contexts", {}).get(model, {}).get("bullets", []):
        try:
            event_date = date.fromisoformat(str(bullet.get("date", "")))
        except ValueError:
            continue
        if not period_start <= event_date <= period_end:
            continue
        literal = {
            "event_id": "event_" + hashlib.sha256(f"{bullet.get('date')}|{bullet.get('headline')}".encode()).hexdigest()[:12],
            "event_date": event_date.isoformat(),
            "headline": str(bullet.get("headline", "")),
            "outlet": str(bullet.get("outlet", "")),
            "models": list(bullet.get("models", [])),
            "url": str(bullet.get("url", "")),
            "context_hypothesis": str(bullet.get("context", "")),
            "source_owner": "Product & Release Context",
            "approved_for_context": True,
        }
        event_models = [norm(value) for value in literal["models"]]
        literal["matches_target_model"] = any(
            norm(model) in event_model or event_model in norm(model) for event_model in event_models
        )
        literal["matched_competitive_models"] = [
            label for label in mover_labels
            if any(norm(label) in event_model or event_model in norm(label) for event_model in event_models)
        ]
        if literal["headline"] and literal["url"].startswith(("https://", "http://")):
            events.append(literal)
    return sorted(events, key=lambda item: item["event_date"], reverse=True)[:5]


def build_pack(
    data: dict[str, Any],
    context: dict[str, Any],
    model: str,
    month: str,
    view: str,
    comparison: str = COMPARISON,
    mode: str = MODE,
) -> dict[str, Any]:
    rows = target_rows(data, model, mode)
    prior, current = comparison_pair(rows, month, comparison)
    if not current:
        raise RuntimeError(f"No current row for {model} in {month} ({mode}).")
    sources = {
        "search": ["ius_unity_prod.google_datamart.ad_opportunity_regional_daily"],
        "retail": ["ius_unity_prod.sandbox.agent_srs"],
        "inventory": ["ius_unity_prod.sandbox.agent_cloudtheory"],
    }
    search_share = current.get("search_share")
    retail_share = current.get("retail_share")
    inventory_share = current.get("inventory_share")
    prior_search_share = prior.get("search_share") if prior else None
    prior_retail_share = prior.get("retail_share") if prior else None
    prior_inventory_share = prior.get("inventory_share") if prior else None
    search_change = (search_share - prior_search_share) * 100 if search_share is not None and prior_search_share is not None else None
    retail_change = (retail_share - prior_retail_share) * 100 if retail_share is not None and prior_retail_share is not None else None
    inventory_change = (inventory_share - prior_inventory_share) * 100 if inventory_share is not None and prior_inventory_share is not None else None
    search_volume_change = change_pct(current.get("search_volume"), prior.get("search_volume") if prior else None)
    retail_units_change = change_pct(current.get("retail_units"), prior.get("retail_units") if prior else None)
    inventory_units_change = change_pct(current.get("inventory_units"), prior.get("inventory_units") if prior else None)
    facts: list[dict[str, Any]]
    if view == "momentum":
        facts = [
            fact("search_change", "search_share_change", search_change, pp(search_change), "search_share_current_minus_comparison", sources["search"], "Google AdOps", headline_value=pp(search_change), direction="rose" if search_change and search_change > 0 else "fell" if search_change and search_change < 0 else "was unchanged", role="primary"),
            fact("retail_change", "retail_share_change", retail_change, pp(retail_change), "retail_share_current_minus_comparison", sources["retail"], "SRS Sales", headline_value=pp(retail_change), direction="rose" if retail_change and retail_change > 0 else "fell" if retail_change and retail_change < 0 else "was unchanged", role="primary"),
        ]
    elif view == "positions":
        facts = [
            fact("search_share", "search_share", search_share, pct(search_share), "search_share", sources["search"], "Google AdOps", role="primary"),
            fact("retail_share", "retail_share", retail_share, pct(retail_share), "retail_share", sources["retail"], "SRS Sales", role="primary"),
        ]
    elif view == "efficiency":
        search_retail = search_share / retail_share if search_share is not None and retail_share else None
        inventory_retail = inventory_share / retail_share if inventory_share is not None and retail_share else None
        facts = [
            fact("search_retail_ratio", "search_share_to_retail_share", search_retail, ratio(search_retail), "demand_inventory_y", sources["search"] + sources["retail"], ["Google AdOps", "SRS Sales"], parity_relation=parity_relation(search_retail), role="primary"),
            fact("inventory_retail_ratio", "inventory_share_to_retail_share", inventory_retail, ratio(inventory_retail), "demand_inventory_x", sources["inventory"] + sources["retail"], ["CloudTheory Inventory", "SRS Sales"], parity_relation=parity_relation(inventory_retail), role="primary"),
        ]
    else:
        velocity = current["retail_units"] / current["inventory_units"] if current.get("inventory_units") else None
        conversion = current["retail_units"] / current["search_volume"] if current.get("search_volume") else None
        median_velocity, median_conversion = full_universe_medians(data, model, mode, month)
        facts = [
            fact("sales_velocity", "sales_velocity", velocity, decimal(velocity), "retail_units_divided_by_average_inventory", sources["retail"] + sources["inventory"], ["SRS Sales", "CloudTheory Inventory"], benchmark_relation="above" if velocity is not None and median_velocity is not None and velocity > median_velocity else "below" if velocity is not None and median_velocity is not None and velocity < median_velocity else "at", role="primary"),
            fact("conversion", "conversion", conversion, decimal(conversion), "retail_units_divided_by_indexed_search_opportunity", sources["retail"] + sources["search"], ["SRS Sales", "Google AdOps"], benchmark_relation="above" if conversion is not None and median_conversion is not None and conversion > median_conversion else "below" if conversion is not None and median_conversion is not None and conversion < median_conversion else "at", role="primary"),
            fact("median_sales_velocity", "full_universe_median_sales_velocity", median_velocity, decimal(median_velocity), "full_competitive_universe_median", sources["retail"] + sources["inventory"], ["SRS Sales", "CloudTheory Inventory"], role="benchmark"),
            fact("median_conversion", "full_universe_median_conversion", median_conversion, decimal(median_conversion), "full_competitive_universe_median", sources["retail"] + sources["search"], ["SRS Sales", "Google AdOps"], role="benchmark"),
        ]
    supplemental = [
        fact("search_change", "search_share_change", search_change, pp(search_change), "search_share_current_minus_comparison", sources["search"], "Google AdOps", headline_value=pp(search_change), direction="rose" if search_change and search_change > 0 else "fell" if search_change and search_change < 0 else "was unchanged", role="explanatory"),
        fact("retail_change", "retail_share_change", retail_change, pp(retail_change), "retail_share_current_minus_comparison", sources["retail"], "SRS Sales", headline_value=pp(retail_change), direction="rose" if retail_change and retail_change > 0 else "fell" if retail_change and retail_change < 0 else "was unchanged", role="explanatory"),
        fact("inventory_change", "inventory_share_change", inventory_change, pp(inventory_change), "inventory_share_current_minus_comparison", sources["inventory"], "CloudTheory Inventory", headline_value=pp(inventory_change), direction="rose" if inventory_change and inventory_change > 0 else "fell" if inventory_change and inventory_change < 0 else "was unchanged", role="explanatory"),
        fact("search_volume_change", "indexed_search_opportunity_change", search_volume_change, signed_pct(search_volume_change), "indexed_search_opportunity_current_vs_comparison", sources["search"], "Google AdOps", headline_value=signed_pct(search_volume_change), role="explanatory"),
        fact("retail_units_change", "retail_units_change", retail_units_change, signed_pct(retail_units_change), "retail_units_current_vs_comparison", sources["retail"], "SRS Sales", headline_value=signed_pct(retail_units_change), role="explanatory"),
        fact("inventory_units_change", "average_inventory_change", inventory_units_change, signed_pct(inventory_units_change), "average_inventory_current_vs_comparison", sources["inventory"], "CloudTheory Inventory", headline_value=signed_pct(inventory_units_change), role="explanatory"),
    ]
    existing_fact_ids = {item["fact_id"] for item in facts}
    facts.extend(item for item in supplemental if item["fact_id"] not in existing_fact_ids)
    mover_facts = competitive_movers(data, model, mode, month, comparison)
    facts.extend(mover_facts)
    mover_labels = list(dict.fromkeys(item["model_label"] for item in mover_facts))
    selection_key = "|".join((model, month, comparison, view, mode))
    return {
        "schema_version": "hma_quadchart_fact_pack_v1",
        "task_type": "hma_quadchart_headline_v1",
        "selection_key": selection_key,
        "snapshot": {
            "generated_at": data.get("generated_at"),
            "selected_month": month,
            "month_label": datetime.strptime(month, "%Y-%m-%d").strftime("%B %Y"),
            "comparison_type": comparison,
            "chart_view": view,
            "segment_mode": mode,
            "target_model": model,
            "native_segment": current.get("segment"),
        },
        "facts": facts,
        "release_events": release_events(context, model, month, mover_labels),
        "governance": {
            "direct_source_only": True,
            "genie_results_present": False,
            "full_set_row_count": 149,
            "validated": True,
        },
    }


def attach_supervisor_evidence(pack: dict[str, Any], supervisor_context: dict[str, Any]) -> None:
    snapshot = pack["snapshot"]
    key = "|".join((
        snapshot["target_model"],
        snapshot["selected_month"],
        snapshot["comparison_type"],
        snapshot["segment_mode"],
    ))
    entry = (supervisor_context.get("contexts") or {}).get(key, {})
    pack["supervisor_context_key"] = key
    pack["supervisor_evidence"] = (
        entry.get("hypotheses", []) if entry.get("status") in {"ok", "stale"} else []
    )


def supervisor_sources(pack: dict[str, Any], claim_ids: list[str]) -> list[str]:
    claim_map = {item["claim_id"]: item for item in pack.get("supervisor_evidence", [])}
    sources: list[str] = []
    for claim_id in claim_ids:
        for agent in claim_map.get(claim_id, {}).get("agent_sources", []):
            label = SUPERVISOR_AGENT_LABELS.get(agent, agent)
            if label not in sources:
                sources.append(label)
    return sources


def deterministic_headline(pack: dict[str, Any]) -> str:
    model = pack["snapshot"]["target_model"]
    month_label = pack["snapshot"]["month_label"]
    view = pack["snapshot"]["chart_view"]
    values = {item["fact_id"]: item for item in pack["facts"]}
    inventory = values.get("inventory_change", {})
    retail_units = values.get("retail_units_change", {})
    inventory_clause = f"inventory share {inventory.get('direction')} {inventory.get('display_value')}" if inventory.get("eligible_for_headline") else "inventory movement was unavailable"
    retail_direction = "rose" if (retail_units.get("raw_value") or 0) > 0 else "fell" if (retail_units.get("raw_value") or 0) < 0 else "was unchanged"
    retail_clause = f"retail units {retail_direction} {retail_units.get('display_value')}" if retail_units.get("eligible_for_headline") else "retail-unit movement was unavailable"
    if view == "momentum":
        search, retail = values["search_change"], values["retail_change"]
        base = f"{model} search share {search['direction']} {search['display_value']} and retail share {retail['direction']} {retail['display_value']}, as {inventory_clause} while {retail_clause}"
    elif view == "positions":
        base = f"In {month_label}, {model} held {values['search_share']['display_value']} search share and {values['retail_share']['display_value']} retail share, while {inventory_clause} and {retail_clause}"
    elif view == "efficiency":
        base = f"{model} search share was {values['search_retail_ratio']['parity_relation']} retail-share parity at {values['search_retail_ratio']['display_value']}, while inventory share was {values['inventory_retail_ratio']['parity_relation']} parity at {values['inventory_retail_ratio']['display_value']} as {retail_clause}"
    else:
        base = f"In {month_label}, {model} sales velocity reached {values['sales_velocity']['display_value']} and conversion reached {values['conversion']['display_value']}, as {inventory_clause} and {retail_clause}"
    supervisor_claims = pack.get("supervisor_evidence", [])
    if supervisor_claims:
        return supervisor_claims[0]["summary"]
    events = pack.get("release_events", [])
    event = next((item for item in events if item.get("matches_target_model")), None)
    event = event or next((item for item in events if item.get("matched_competitive_models")), events[0] if events else None)
    if not event:
        return base + "."
    hypothesis = event.get("context_hypothesis", "").strip().rstrip(".")
    if hypothesis:
        return f"{base}; product context may help explain the pattern: {hypothesis}."
    return f"{base}; this pattern coincided with “{event['headline']}”."


def deterministic_detail(pack: dict[str, Any]) -> str:
    supervisor_claims = pack.get("supervisor_evidence", [])
    if len(supervisor_claims) > 1:
        return supervisor_claims[1]["summary"]
    values = {item["fact_id"]: item for item in pack["facts"]}
    parts = []
    search_gainer = values.get("comp_search_gainer", {})
    search_decliner = values.get("comp_search_decliner", {})
    retail_decliner = values.get("comp_retail_decliner", {})
    if search_gainer:
        parts.append(f"{search_gainer['model_label']} led competitive search gains at {search_gainer['headline_value']}")
    if search_decliner:
        parts.append(f"{search_decliner['model_label']} led search declines at {search_decliner['headline_value']}")
    if retail_decliner:
        parts.append(f"{retail_decliner['model_label']} had the largest retail-share decline at {retail_decliner['headline_value']}")
    metric_sentence = "; ".join(parts) + "." if parts else "No additional cross-source movement was available."
    events = pack.get("release_events", [])
    matched_event = next((item for item in events if item.get("matched_competitive_models")), None)
    if not matched_event:
        return metric_sentence
    matched_models = ", ".join(matched_event.get("matched_competitive_models", []))
    return f"{metric_sentence[:-1]}; {matched_models or 'the competitive mover'} also had a dated product event during the period: “{matched_event['headline']}”."


def evidence_sources(pack: dict[str, Any], evidence_ids: list[str]) -> list[str]:
    fact_map = {item["fact_id"]: item for item in pack["facts"]}
    owners: list[str] = []
    for fact_id in evidence_ids:
        owner = fact_map.get(fact_id, {}).get("source_owner", [])
        for value in owner if isinstance(owner, list) else [owner]:
            if value and value not in owners:
                owners.append(value)
    return owners


def input_hash(packs: list[dict[str, Any]], prompt: str) -> str:
    canonical = json.dumps({"packs": packs, "prompt": prompt}, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode()).hexdigest()


def response_schema() -> dict[str, Any]:
    item = {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "selection_key": {"type": "string"},
            "status": {"type": "string", "enum": ["ok", "insufficient_data"]},
            "headline": {"type": ["string", "null"]},
            "detail": {"type": ["string", "null"]},
            "evidence_ids": {"type": "array", "items": {"type": "string"}},
            "context_event_ids": {"type": "array", "items": {"type": "string"}},
            "supervisor_claim_ids": {"type": "array", "items": {"type": "string"}},
            "confidence": {"type": "string", "enum": ["high", "medium", "not_applicable"]},
        },
        "required": ["selection_key", "status", "headline", "detail", "evidence_ids", "context_event_ids", "supervisor_claim_ids", "confidence"],
    }
    return {
        "type": "object",
        "additionalProperties": False,
        "properties": {"insights": {"type": "array", "items": item}},
        "required": ["insights"],
    }


def call_editor(key: str, prompt: str, packs: list[dict[str, Any]]) -> dict[str, Any]:
    body = json.dumps({
        "model": os.getenv("HMA_INSIGHT_MODEL", "gpt-5.6-terra"),
        "instructions": prompt,
        "input": json.dumps({"fact_packs": packs}, ensure_ascii=False, separators=(",", ":")),
        "reasoning": {"effort": os.getenv("HMA_INSIGHT_REASONING", "low")},
        "max_output_tokens": 9000,
        "text": {"format": {"type": "json_schema", "name": "hma_quadchart_headlines", "schema": response_schema(), "strict": True}},
        "store": False,
    }).encode("utf-8")
    request = urllib.request.Request(API_URL, data=body, headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=600) as response:
            payload = json.loads(response.read())
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Headline editor failed: HTTP {error.code}. {detail}") from error
    text = response_text(payload)
    if not text:
        raise RuntimeError("Headline editor returned no text.")
    return json.loads(text)


def validate(candidate: dict[str, Any], pack: dict[str, Any]) -> tuple[bool, str]:
    if candidate.get("selection_key") != pack["selection_key"]:
        return False, "selection_key mismatch"
    if candidate.get("status") != "ok" or not isinstance(candidate.get("headline"), str) or not isinstance(candidate.get("detail"), str):
        return False, "no usable headline or detail"
    headline = candidate["headline"].strip()
    detail = candidate["detail"].strip()
    model = pack["snapshot"]["target_model"]
    headline_words = re.findall(r"\b[\w×-]+\b", headline)
    detail_words = re.findall(r"\b[\w×-]+\b", detail)
    if not 30 <= len(headline_words) <= 72 or not 20 <= len(detail_words) <= 55 or model.lower() not in headline.lower():
        return False, "headline length or model name"
    combined = f"{headline} {detail}"
    if BANNED.search(combined):
        return False, "banned causal or predictive language"
    if re.search(r"relevant context rather than proof|proof of causation|correlation is not causation", combined, re.IGNORECASE):
        return False, "unwanted causality disclaimer"
    fact_map = {item["fact_id"]: item for item in pack["facts"] if item["eligible_for_headline"]}
    evidence = candidate.get("evidence_ids") or []
    if not 4 <= len(evidence) <= 7 or len(set(evidence)) != len(evidence) or any(item not in fact_map for item in evidence):
        return False, "invalid evidence IDs"
    owners = set(evidence_sources(pack, evidence))
    if len(owners) < 2:
        return False, "evidence does not span two sources"
    if "CloudTheory Inventory" in owners:
        if re.search(r"CloudTheory\s+inventory|\(.*source:\s*CloudTheory.*\)", combined, re.IGNORECASE):
            return False, "inventory source attribution format"
    event_map = {item["event_id"]: item for item in pack.get("release_events", [])}
    event_ids = candidate.get("context_event_ids") or []
    if len(event_ids) > 2 or len(set(event_ids)) != len(event_ids) or any(item not in event_map for item in event_ids):
        return False, "invalid context event IDs"
    claim_map = {item["claim_id"]: item for item in pack.get("supervisor_evidence", [])}
    claim_ids = candidate.get("supervisor_claim_ids") or []
    if len(claim_ids) > 2 or len(set(claim_ids)) != len(claim_ids) or any(item not in claim_map for item in claim_ids):
        return False, "invalid supervisor claim IDs"
    if not (event_ids or claim_ids) or not re.search(r"may reflect|may have benefited from|may help explain|is consistent with|supported by|coincided with", headline, re.IGNORECASE):
        return False, "headline lacks a cited contextual hypothesis"
    scrubbed = re.sub(re.escape(model), "", combined, flags=re.IGNORECASE)
    scrubbed = re.sub(re.escape(pack["snapshot"]["month_label"]), "", scrubbed, flags=re.IGNORECASE)
    for event_id in event_ids:
        event = event_map[event_id]
        for literal in [event.get("headline", ""), event.get("event_date", ""), *event.get("models", [])]:
            scrubbed = re.sub(re.escape(str(literal)), "", scrubbed, flags=re.IGNORECASE)
    for claim_id in claim_ids:
        scrubbed = re.sub(re.escape(claim_map[claim_id].get("summary", "")), "", scrubbed, flags=re.IGNORECASE)
    numbers = re.findall(r"(?<![A-Za-z])\d+(?:\.\d+)?", scrubbed)
    event_numbers = {
        token
        for event_id in event_ids
        for token in re.findall(
            r"\d+(?:\.\d+)?",
            event_map[event_id].get("headline", "") + " " + event_map[event_id].get("context_hypothesis", ""),
        )
    }
    allowed = {
        token
        for fact_id in evidence
        for item in [fact_map[fact_id]]
        for token in re.findall(r"\d+(?:\.\d+)?", item.get("headline_value", item["display_value"]))
    } | {
        token
        for fact_id in evidence
        for item in [fact_map[fact_id]]
        for token in re.findall(r"\d+(?:\.\d+)?", item["display_value"])
    }
    metric_numbers = [value for value in numbers if value not in event_numbers]
    if len(metric_numbers) > 7 or any(value not in allowed | event_numbers for value in numbers):
        return False, "unsupported numeric value"
    for fact_id in evidence:
        item = fact_map[fact_id]
        if item["display_value"].endswith(" pp"):
            numeric = re.findall(r"\d+(?:\.\d+)?", item["display_value"])
            if numeric and numeric[0] in metric_numbers and item["display_value"] not in combined:
                return False, "share movement lost sign or pp unit"
    return True, ""


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true", help="Regenerate even when the input hash is unchanged.")
    parser.add_argument("--offline", action="store_true", help="Build deterministic governed headlines without an API call.")
    args = parser.parse_args()

    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    context = json.loads(CONTEXT_PATH.read_text(encoding="utf-8")) if CONTEXT_PATH.exists() else {"contexts": {}}
    supervisor_context = json.loads(SUPERVISOR_CONTEXT_PATH.read_text(encoding="utf-8")) if SUPERVISOR_CONTEXT_PATH.exists() else {"contexts": {}}
    prompt = PROMPT_PATH.read_text(encoding="utf-8")
    month = data["current_month"]
    packs = [build_pack(data, context, model, month, view) for model in data["models"] for view in VIEWS]
    for pack in packs:
        attach_supervisor_evidence(pack, supervisor_context)
    signature = input_hash(packs, prompt)
    existing = json.loads(OUTPUT_PATH.read_text(encoding="utf-8")) if OUTPUT_PATH.exists() else {}
    if not args.force and existing.get("input_hash") == signature and existing.get("insights"):
        public_existing = {
            key: existing[key]
            for key in ("schema_version", "generated_at", "data_generated_at", "input_hash", "coverage", "insights")
            if key in existing
        }
        rendered = json.dumps(public_existing, ensure_ascii=False, indent=2) + "\n"
        PUBLIC_PATH.parent.mkdir(parents=True, exist_ok=True)
        PUBLIC_PATH.write_text(rendered, encoding="utf-8")
        print(json.dumps({"status": "cached", "insights": len(existing["insights"]), "output": str(OUTPUT_PATH)}, indent=2))
        return

    insights = {}
    for pack in packs:
        eligible = [item["fact_id"] for item in pack["facts"] if item["eligible_for_headline"]]
        primary = [item["fact_id"] for item in pack["facts"] if item.get("role") == "primary" and item["eligible_for_headline"]]
        support_order = [
            "inventory_change", "comp_search_gainer", "comp_search_decliner",
            "comp_retail_decliner", "retail_units_change", "search_change",
            "retail_change", "inventory_units_change", "search_volume_change",
        ]
        evidence_ids = primary[:]
        evidence_ids.extend(fact_id for fact_id in support_order if fact_id in eligible and fact_id not in evidence_ids and len(evidence_ids) < 7)
        if len(evidence_ids) < 4:
            evidence_ids.extend(fact_id for fact_id in eligible if fact_id not in evidence_ids and len(evidence_ids) < 4)
        events = pack.get("release_events", [])
        target_event = next((item for item in events if item.get("matches_target_model")), None)
        matched_event = next((item for item in events if item.get("matched_competitive_models")), None)
        selected_events = []
        for event in (target_event, matched_event):
            if event and event["event_id"] not in {item["event_id"] for item in selected_events}:
                selected_events.append(event)
        if not selected_events and events:
            selected_events.append(events[0])
        context_event_ids = [item["event_id"] for item in selected_events[:2]]
        supervisor_claim_ids = [item["claim_id"] for item in pack.get("supervisor_evidence", [])[:2]]
        supervisor_claims = pack.get("supervisor_evidence", [])
        insights[pack["selection_key"]] = {
            "selection_key": pack["selection_key"],
            "headline": deterministic_headline(pack),
            "detail": deterministic_detail(pack),
            "evidence_ids": evidence_ids,
            "context_event_ids": context_event_ids,
            "supervisor_claim_ids": supervisor_claim_ids,
            "sources": list(dict.fromkeys(
                evidence_sources(pack, evidence_ids)
                + (["Product & Release Context"] if context_event_ids else [])
                + supervisor_sources(pack, supervisor_claim_ids)
            )),
            "confidence": supervisor_claims[0].get("confidence", "not_applicable") if supervisor_claims else "not_applicable",
            "source": "supervisor_context_cache" if supervisor_claims else "governed_fallback",
        }
    key = None if args.offline else load_api_key()
    editor_error = None
    if key:
        try:
            candidates = call_editor(key, prompt, packs).get("insights", [])
            pack_map = {pack["selection_key"]: pack for pack in packs}
            for candidate in candidates:
                pack = pack_map.get(candidate.get("selection_key"))
                if not pack:
                    continue
                valid, reason = validate(candidate, pack)
                if valid:
                    insights[pack["selection_key"]] = {
                        "selection_key": pack["selection_key"],
                        "headline": candidate["headline"].strip(),
                        "detail": candidate["detail"].strip(),
                        "evidence_ids": candidate["evidence_ids"],
                        "context_event_ids": candidate["context_event_ids"],
                        "supervisor_claim_ids": candidate["supervisor_claim_ids"],
                        "sources": list(dict.fromkeys(
                            evidence_sources(pack, candidate["evidence_ids"])
                            + (["Product & Release Context"] if candidate["context_event_ids"] else [])
                            + supervisor_sources(pack, candidate["supervisor_claim_ids"])
                        )),
                        "confidence": candidate["confidence"],
                        "source": "executive_headline_editor",
                    }
                else:
                    insights[pack["selection_key"]]["validation_warning"] = reason
        except Exception as error:
            editor_error = str(error)

    output = {
        "schema_version": "hma_quadchart_headline_cache_v2",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "data_generated_at": data.get("generated_at"),
        "input_hash": signature,
        "coverage": {"month": month, "comparison": COMPARISON, "segment_mode": MODE, "views": list(VIEWS)},
        "editor": {"model": os.getenv("HMA_INSIGHT_MODEL", "gpt-5.6-terra"), "error": editor_error},
        "insights": insights,
    }
    rendered = json.dumps(output, ensure_ascii=False, indent=2) + "\n"
    public_output = {
        key: output[key]
        for key in ("schema_version", "generated_at", "data_generated_at", "input_hash", "coverage", "insights")
    }
    public_rendered = json.dumps(public_output, ensure_ascii=False, indent=2) + "\n"
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    PUBLIC_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(rendered, encoding="utf-8")
    PUBLIC_PATH.write_text(public_rendered, encoding="utf-8")
    print(json.dumps({
        "status": "generated",
        "editor_generated": sum(item["source"] == "executive_headline_editor" for item in insights.values()),
        "supervisor_generated": sum(item["source"] == "supervisor_context_cache" for item in insights.values()),
        "fallback_generated": sum(item["source"] == "governed_fallback" for item in insights.values()),
        "editor_error": editor_error,
        "output": str(OUTPUT_PATH),
    }, indent=2))


if __name__ == "__main__":
    main()
