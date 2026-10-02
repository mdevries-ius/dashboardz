#!/usr/bin/env python3
"""Ask the configured Databricks supervisor for governed explanatory context."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
GOVERNANCE_ROOT = ROOT.parent
DATA_PATH = ROOT / "data" / "processed" / "quadchart.json"
COMP_CONTEXT_PATH = ROOT / "data" / "processed" / "comp_context.json"
OUTPUT_PATH = ROOT / "data" / "processed" / "supervisor_context.json"
AUDIT_PATH = ROOT / "data" / "processed" / "supervisor_audit.json"
PROMPT_PATH = ROOT / "prompts" / "supervisor_investigation.md"
CONFIG_PATH = GOVERNANCE_ROOT / "config" / "databricks_agents.json"
COMPARISON = "prior3ma"
MODE = "special"

# Import the canonical fact-pack builder rather than reproducing any dashboard
# calculation in the supervisor adapter.
sys.path.insert(0, str(ROOT / "scripts"))
from refresh_insights import build_pack  # noqa: E402


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def canonical_hash(value: Any) -> str:
    rendered = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(rendered.encode("utf-8")).hexdigest()


def databricks_cli() -> str:
    value = "/Users/maximodevries/Desktop/codex_source/tools/databricks"
    if Path(value).is_file():
        return value
    raise RuntimeError("Authenticated Databricks CLI proxy was not found.")


def compact_pack(pack: dict[str, Any], allowed_agents: list[str]) -> dict[str, Any]:
    """Remove internal table identifiers before sending the governed observations."""
    facts = []
    for item in pack["facts"]:
        if not item.get("eligible_for_headline"):
            continue
        facts.append({
            "fact_id": item["fact_id"],
            "metric_key": item["metric_key"],
            "display_value": item["display_value"],
            "direction": item.get("direction"),
            "parity_relation": item.get("parity_relation"),
            "benchmark_relation": item.get("benchmark_relation"),
            "source_owner": item.get("source_owner"),
            "role": item.get("role"),
        })
    events = [{
        "event_id": item["event_id"],
        "event_date": item["event_date"],
        "headline": item["headline"],
        "outlet": item["outlet"],
        "models": item["models"],
        "context_hypothesis": item["context_hypothesis"],
        "url": item["url"],
    } for item in pack.get("release_events", [])]
    snapshot = dict(pack["snapshot"])
    selection_key = "|".join((
        snapshot["target_model"], snapshot["selected_month"], COMPARISON, MODE,
    ))
    return {
        "schema_version": "hma_supervisor_observation_v1",
        "selection_key": selection_key,
        "snapshot": snapshot,
        "facts": facts,
        "release_events": events,
        "allowed_agents": allowed_agents,
        "metric_authority": "Supplied dashboard facts are authoritative; agent outputs are explanatory context only.",
    }


def make_prompt(instructions: str, observation: dict[str, Any]) -> str:
    return instructions.rstrip() + "\n\nOBSERVATION PACK\n" + json.dumps(
        observation, ensure_ascii=False, separators=(",", ":")
    )


def oauth_token(profile: str) -> str:
    try:
        result = subprocess.run(
            [databricks_cli(), "auth", "token", profile, "--output", "json"],
            check=True,
            capture_output=True,
            text=True,
            timeout=120,
        )
    except subprocess.CalledProcessError as error:
        detail = (error.stderr or error.stdout or "Databricks authentication failed").strip()
        raise RuntimeError(detail) from error
    payload = json.loads(result.stdout)
    token = payload.get("access_token") or payload.get("token_value")
    if not token:
        raise RuntimeError("Databricks authentication returned no access token.")
    return str(token)


def invoke(workspace_host: str, endpoint: str, profile: str, prompt: str) -> dict[str, Any]:
    payload = {
        "input": [{"role": "user", "content": prompt}],
        "stream": True,
    }
    token = oauth_token(profile)
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "text/event-stream",
        "Content-Type": "application/json",
    }
    request = urllib.request.Request(
        f"{workspace_host.rstrip('/')}/serving-endpoints/{endpoint}/invocations",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers=headers,
        method="POST",
    )
    deadline = time.monotonic() + int(os.getenv("HMA_SUPERVISOR_TIMEOUT_SECONDS", "600"))
    deltas: list[str] = []
    completed_text = ""
    response_id = None
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            for raw_line in response:
                if time.monotonic() >= deadline:
                    raise RuntimeError("Supervisor request exceeded the configured refresh timeout.")
                line = raw_line.decode("utf-8", errors="replace").strip()
                if not line.startswith("data:"):
                    continue
                event_text = line[5:].strip()
                if event_text == "[DONE]":
                    break
                event = json.loads(event_text)
                response_id = event.get("id") or response_id
                if event.get("type") == "response.output_text.delta":
                    deltas.append(str(event.get("delta") or ""))
                elif event.get("type") == "response.output_item.done":
                    parts = event.get("item", {}).get("content", [])
                    completed_text = "".join(
                        str(part.get("text") or "") for part in parts
                        if isinstance(part, dict) and part.get("type") == "output_text"
                    ) or completed_text
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Supervisor endpoint returned HTTP {error.code}: {detail}") from error
    except urllib.error.URLError as error:
        raise RuntimeError(f"Supervisor endpoint connection failed: {error.reason}") from error
    except (TimeoutError, socket.timeout) as error:
        raise RuntimeError("Supervisor response stream timed out while waiting for the next event.") from error
    text = "".join(deltas).strip() or completed_text.strip()
    if not text:
        raise RuntimeError("Supervisor stream completed without response text.")
    return {"output_text": text, "metadata": {"response_id": response_id}}


def response_text(payload: dict[str, Any]) -> str:
    if isinstance(payload.get("output_text"), str):
        return payload["output_text"].strip()
    text = []
    for item in payload.get("output", []):
        for content in item.get("content", []):
            if isinstance(content, dict) and isinstance(content.get("text"), str):
                text.append(content["text"])
    if text:
        return "\n".join(text).strip()
    choices = payload.get("choices") or []
    if choices:
        content = choices[0].get("message", {}).get("content")
        if isinstance(content, str):
            return content.strip()
    predictions = payload.get("predictions") or []
    if predictions and isinstance(predictions[0], dict):
        candidate = predictions[0].get("content") or predictions[0].get("text")
        if isinstance(candidate, str):
            return candidate.strip()
    raise RuntimeError("Supervisor returned no readable response text.")


def parse_json_text(text: str) -> dict[str, Any]:
    text = re.sub(r"^\s*```(?:json)?\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*```\s*$", "", text)
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end < start:
        raise ValueError("Supervisor response did not contain a JSON object.")
    parsed = json.loads(text[start:end + 1])
    if not isinstance(parsed, dict):
        raise ValueError("Supervisor response must be a JSON object.")
    return parsed


def numeric_tokens(value: str) -> set[str]:
    return set(re.findall(r"(?<![A-Za-z])[-+]?\d+(?:\.\d+)?", value or ""))


def numeric_value_supported(value: str, supported: set[str]) -> bool:
    if value in supported:
        return True
    try:
        target = float(value)
    except ValueError:
        return False
    decimals = len(value.lstrip("+-").split(".", 1)[1]) if "." in value else 0
    tolerance = 0.5 * (10 ** -decimals) + 1e-9
    return any(abs(target - float(candidate)) <= tolerance for candidate in supported)


def normalize_agent_source(value: str, allowed_agents: list[str]) -> str | None:
    key = re.sub(r"[^a-z0-9]+", "", value.lower())
    aliases = {
        "srssales": "agent_srs_sales-max02",
        "cloudtheory": "agent_cloudtheory-max02",
        "coxautomotive": "agent_coxautomotive-max02",
        "gcom": "agent_gcom-max02",
        "marketview": "agent_marketview_2.0",
        "hcom": "agent_hcom",
        "googleadops": "agent_googleadops",
    }
    for alias, canonical in aliases.items():
        if alias in key and canonical in allowed_agents:
            return canonical
    for canonical in allowed_agents:
        canonical_key = re.sub(r"[^a-z0-9]+", "", canonical.lower().replace("agent", "").replace("max02", ""))
        if canonical_key and (canonical_key in key or key in canonical_key):
            return canonical
    return None


def normalize_response(
    candidate: dict[str, Any], observation: dict[str, Any], allowed_agents: list[str]
) -> tuple[dict[str, Any], list[str]]:
    warnings: list[str] = []
    selection_key = observation["selection_key"]
    if candidate.get("selection_key") != selection_key:
        raise ValueError("Supervisor selection_key did not match the request.")
    allowed_ids = {item["fact_id"] for item in observation["facts"]} | {
        item["event_id"] for item in observation["release_events"]
    }
    allowed_numbers: set[str] = set()
    for item in observation["facts"]:
        allowed_numbers |= numeric_tokens(item.get("display_value", ""))
    for item in observation["release_events"]:
        allowed_numbers |= numeric_tokens(item.get("headline", ""))
        allowed_numbers |= numeric_tokens(item.get("context_hypothesis", ""))
    hypotheses = []
    seen_claim_ids: set[str] = set()
    for index, item in enumerate(candidate.get("hypotheses") or []):
        if not isinstance(item, dict):
            warnings.append(f"hypothesis {index + 1}: not an object")
            continue
        summary = " ".join(str(item.get("summary") or "").split())
        words = re.findall(r"\b[\w×-]+\b", summary)
        evidence_ids = list(dict.fromkeys(str(value) for value in item.get("evidence_ids") or []))
        agent_sources = list(dict.fromkeys(
            normalized for value in item.get("agent_sources") or []
            if (normalized := normalize_agent_source(str(value), allowed_agents))
        ))
        records = item.get("source_records") or []
        contextual_numbers = {
            token
            for record in records if isinstance(record, dict)
            for token in numeric_tokens(
                f"{record.get('title', '')} {record.get('evidence_detail', '')}"
            )
        }
        reason = None
        if not 18 <= len(words) <= 60:
            reason = "summary length outside 18–60 words"
        elif observation["snapshot"]["target_model"].lower() not in summary.lower():
            reason = "target model is missing"
        elif not re.search(r"may reflect|may help explain|may have benefited from|may have supported|may have diverted|may have created|is consistent with|coincided with|potentially", summary, re.IGNORECASE):
            reason = "summary lacks cautious explanatory language"
        elif len(evidence_ids) < 2 or any(value not in allowed_ids for value in evidence_ids):
            reason = "invalid evidence IDs"
        elif not agent_sources:
            reason = "invalid agent source"
        elif not records or not all(isinstance(value, dict) and value.get("title") and value.get("locator") for value in records):
            reason = "missing source records"
        elif any(not numeric_value_supported(value, allowed_numbers | contextual_numbers) for value in numeric_tokens(summary)):
            reason = "numeric context is not repeated in a cited source record"
        if reason:
            warnings.append(f"hypothesis {index + 1}: {reason}")
            continue
        claim_id = re.sub(r"[^a-z0-9]+", "_", str(item.get("claim_id") or f"claim_{index + 1}").lower()).strip("_")
        if not claim_id or claim_id in seen_claim_ids:
            claim_id = f"claim_{index + 1}"
        seen_claim_ids.add(claim_id)
        hypotheses.append({
            "claim_id": claim_id,
            "summary": summary,
            "support_level": item.get("support_level") if item.get("support_level") in {"possible_contributor", "corroborating", "contradictory"} else "possible_contributor",
            "confidence": item.get("confidence") if item.get("confidence") in {"low", "medium", "high"} else "low",
            "evidence_ids": evidence_ids,
            "agent_sources": agent_sources,
            "source_records": [{
                "title": str(record.get("title") or "").strip(),
                "date": str(record.get("date") or "").strip(),
                "locator": str(record.get("locator") or "").strip(),
                "evidence_detail": str(record.get("evidence_detail") or "").strip(),
            } for record in records[:5]],
            "numeric_policy": "context_only; governed dashboard metrics remain authoritative",
        })
        if len(hypotheses) == 3:
            break
    return {
        "selection_key": selection_key,
        "status": "ok" if hypotheses else "insufficient_data",
        "hypotheses": hypotheses,
        "warnings": warnings + [str(value) for value in candidate.get("warnings") or []],
    }, warnings


def public_safe_context(entry: dict[str, Any]) -> dict[str, Any]:
    """Retain only normalized, cited claims; raw endpoint output stays audit-only."""
    return {
        "selection_key": entry["selection_key"],
        "status": entry["status"],
        "hypotheses": entry["hypotheses"],
        "warnings": entry.get("warnings", []),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true", help="Ignore an unchanged input hash and query again.")
    parser.add_argument("--offline", action="store_true", help="Write observation/audit metadata without calling Databricks.")
    parser.add_argument("--strict", action="store_true", help="Fail instead of preserving prior context when the endpoint is unavailable.")
    parser.add_argument("--model", help="Refresh one Hyundai model only (useful for smoke tests).")
    parser.add_argument("--workers", type=int, default=2, help="Number of concurrent supervisor requests (default: 2).")
    parser.add_argument("--revalidate-audit", action="store_true", help="Revalidate the latest audited responses without calling Databricks again.")
    args = parser.parse_args()

    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    supervisor = config.get("supervisor") or {}
    endpoint = os.getenv("HMA_SUPERVISOR_ENDPOINT", supervisor.get("serving_endpoint", ""))
    workspace_host = str(config.get("workspace_host") or "")
    profile = os.getenv("DATABRICKS_CONFIG_PROFILE", config.get("profile", "hma-report"))
    allowed_agents = list(supervisor.get("connected_agents") or [])
    if not workspace_host or not endpoint or not allowed_agents:
        raise RuntimeError("Databricks supervisor endpoint or connected-agent allowlist is missing.")

    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    comp_context = json.loads(COMP_CONTEXT_PATH.read_text(encoding="utf-8")) if COMP_CONTEXT_PATH.exists() else {"contexts": {}}
    instructions = PROMPT_PATH.read_text(encoding="utf-8")
    month = data["current_month"]
    selected_models = [args.model] if args.model else list(data["models"])
    unknown_models = [model for model in selected_models if model not in data["models"]]
    if unknown_models:
        raise ValueError(f"Unknown model: {', '.join(unknown_models)}")
    observations = [
        compact_pack(build_pack(data, comp_context, model, month, "momentum", COMPARISON, MODE), allowed_agents)
        for model in selected_models
    ]
    signature = canonical_hash({"observations": observations, "instructions": instructions, "endpoint": endpoint})
    existing = json.loads(OUTPUT_PATH.read_text(encoding="utf-8")) if OUTPUT_PATH.exists() else {}
    previous_audit = json.loads(AUDIT_PATH.read_text(encoding="utf-8")) if AUDIT_PATH.exists() else {"requests": []}
    audited_candidates = {
        item["selection_key"]: item["candidate"]
        for item in previous_audit.get("requests", [])
        if isinstance(item.get("candidate"), dict)
    }
    existing_contexts = existing.get("contexts") or {}
    has_validated_context = all(
        existing_contexts.get(observation["selection_key"], {}).get("status") in {"ok", "stale"}
        and existing_contexts.get(observation["selection_key"], {}).get("hypotheses")
        for observation in observations
    )
    if not args.force and existing.get("input_hash") == signature and has_validated_context:
        print(json.dumps({"status": "cached", "contexts": len(existing["contexts"]), "output": str(OUTPUT_PATH)}, indent=2))
        return 0

    audit: dict[str, Any] = {
        "schema_version": "hma_supervisor_audit_v1",
        "generated_at": utc_now(),
        "endpoint": endpoint,
        "configuration_id": supervisor.get("configuration_id"),
        "profile": profile,
        "input_hash": signature,
        "requests": [],
    }
    contexts: dict[str, Any] = dict(existing.get("contexts") or {})
    errors: list[str] = []

    def process_observation(observation: dict[str, Any]) -> tuple[str, dict[str, Any], dict[str, Any], str | None]:
        key = observation["selection_key"]
        request_record = {"selection_key": key, "request_hash": canonical_hash(observation), "status": "pending"}
        if args.offline:
            request_record["status"] = "offline"
            entry = {"selection_key": key, "status": "offline", "hypotheses": [], "warnings": ["Supervisor invocation skipped in offline mode."]}
            return key, entry, request_record, None
        try:
            if args.revalidate_audit:
                candidate = audited_candidates.get(key)
                if not candidate:
                    raise RuntimeError("No audited supervisor response is available for revalidation.")
                request_record["response_hash"] = canonical_hash(candidate)
                request_record["revalidated_from_audit"] = True
            else:
                raw = invoke(workspace_host, endpoint, profile, make_prompt(instructions, observation))
                request_record["response_hash"] = canonical_hash(raw)
                request_record["trace_id"] = (raw.get("metadata") or {}).get("trace_id")
                candidate = parse_json_text(response_text(raw))
            request_record["candidate"] = candidate
            normalized, validation_warnings = normalize_response(candidate, observation, allowed_agents)
            request_record["status"] = normalized["status"]
            request_record["accepted_claim_ids"] = [item["claim_id"] for item in normalized["hypotheses"]]
            request_record["validation_warnings"] = validation_warnings
            return key, public_safe_context(normalized), request_record, None
        except Exception as error:
            message = str(error)
            request_record["status"] = "error"
            request_record["error"] = message
            previous = (existing.get("contexts") or {}).get(key)
            if previous and previous.get("hypotheses"):
                entry = {**previous, "status": "stale", "warnings": [*previous.get("warnings", []), "Latest supervisor refresh failed; retained prior validated context."]}
            else:
                entry = {"selection_key": key, "status": "unavailable", "hypotheses": [], "warnings": ["Supervisor context unavailable; dashboard metrics and fallback insight remain active."]}
            return key, entry, request_record, f"{key}: {message}"

    workers = max(1, min(args.workers, len(observations)))
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = [pool.submit(process_observation, observation) for observation in observations]
        for future in as_completed(futures):
            key, entry, request_record, error = future.result()
            contexts[key] = entry
            audit["requests"].append(request_record)
            if error:
                errors.append(error)
    audit["requests"].sort(key=lambda item: item["selection_key"])

    output = {
        "schema_version": "hma_supervisor_context_v1",
        "generated_at": utc_now(),
        "data_generated_at": data.get("generated_at"),
        "input_hash": signature,
        "endpoint_role": "explanatory_context_only",
        "metric_authority": "direct_notebook_table_exports",
        "invocation_mode": "offline" if args.offline else "audit_revalidation" if args.revalidate_audit else "live",
        "contexts": contexts,
    }
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    AUDIT_PATH.write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "status": "generated" if not errors else "generated_with_fallbacks",
        "contexts": len(contexts),
        "validated_claims": sum(len(value.get("hypotheses", [])) for value in contexts.values()),
        "errors": errors,
        "output": str(OUTPUT_PATH),
        "audit": str(AUDIT_PATH),
    }, indent=2))
    return 1 if args.strict and errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
