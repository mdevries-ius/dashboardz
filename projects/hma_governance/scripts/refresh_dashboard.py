#!/usr/bin/env python3
"""Run the dashboard's supported refresh workflows from one entry point."""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"


def run_step(label: str, script: str, *arguments: str, env: dict[str, str] | None = None) -> None:
    print(f"\n=== {label} ===", flush=True)
    subprocess.run(
        [sys.executable, str(SCRIPTS / script), *arguments],
        cwd=ROOT,
        env=env,
        check=True,
    )


def databricks_environment() -> dict[str, str]:
    env = os.environ.copy()
    cli = "/Users/maximodevries/Desktop/codex_source/tools/databricks"
    if not Path(cli).is_file():
        raise RuntimeError("Authenticated Databricks CLI proxy was not found.")
    env["DATABRICKS_CLI_PATH"] = cli
    return env


def main() -> int:
    parser = argparse.ArgumentParser(description="Refresh the HMA demand-sales dashboard.")
    workflow = parser.add_mutually_exclusive_group(required=True)
    workflow.add_argument(
        "--news-only",
        action="store_true",
        help="Refresh daily competitive news context and rebuild the standalone HTML.",
    )
    workflow.add_argument(
        "--full",
        action="store_true",
        help="Pull Databricks data, refresh news context, and rebuild the standalone HTML.",
    )
    parser.add_argument(
        "--force-news",
        action="store_true",
        help="Ignore today's news cache and request fresh context again.",
    )
    parser.add_argument(
        "--force-supervisor",
        action="store_true",
        help="Ignore the supervisor-context cache and run a fresh investigation.",
    )
    parser.add_argument(
        "--skip-supervisor",
        action="store_true",
        help="Skip the optional Databricks supervisor investigation layer.",
    )
    args = parser.parse_args()

    try:
        if args.full:
            run_step(
                "Pulling Google AdOps, SRS, and Cloud Theory data from Databricks",
                "pull_dbx_quadchart.py",
                env=databricks_environment(),
            )

        news_arguments = ("--force",) if args.force_news else ()
        run_step("Refreshing competitive news context", "refresh_comp_context.py", *news_arguments)
        if not args.skip_supervisor:
            supervisor_arguments = ("--force",) if args.force_supervisor else ()
            run_step(
                "Requesting explanatory context from the Databricks supervisor",
                "refresh_supervisor_context.py",
                *supervisor_arguments,
            )
        run_step("Generating governed executive insights", "refresh_insights.py", "--force")
        run_step("Rebuilding the standalone dashboard", "build_standalone_html.py")
        run_step("Rebuilding the hostable dashboard package", "build_public_hosting.py")
        public_dashboard = ROOT / "public" / "quadchart.html"
        public_dashboard.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT / "artifacts" / "public_hosting" / "index.html", public_dashboard)
    except (OSError, RuntimeError, subprocess.CalledProcessError) as error:
        print(f"\nREFRESH FAILED: {error}", file=sys.stderr, flush=True)
        return 1

    print(f"\nREFRESH COMPLETE\n{ROOT / 'quadchart.html'}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
