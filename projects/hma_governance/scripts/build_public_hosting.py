from __future__ import annotations

import hashlib
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE_HTML = ROOT / "quadchart.html"
SOURCE_FONTS = ROOT / "public" / "fonts"
OUTPUT = ROOT / "artifacts" / "public_hosting"

FONT_FILES = (
    "HyundaiSansHead-Bold.woff2",
    "HyundaiSansHead-Medium.woff2",
    "HyundaiSansText-Medium.woff2",
    "HyundaiSansText-Regular.woff2",
)

# A public static build needs the metric data, but not internal infrastructure
# identifiers. These replacements preserve the dashboard's visible source labels
# while removing warehouse IDs and private catalog paths from the shipped HTML.
PUBLIC_REPLACEMENTS = {
    'public/fonts/': 'fonts/',
    '4aaf576b2447fe80': 'public-static',
    '77a3fcdd7c267804': 'public-static',
    'ius_unity_prod.google_datamart.ad_opportunity_regional_daily': 'Google AdOps daily',
    'ius_unity_prod.sandbox.agent_googleadops_monthly': 'Google AdOps monthly',
    'ius_unity_prod.sandbox.agent_srs': 'SRS monthly retail',
    'ius_unity_prod.sandbox.agent_cloudtheory': 'Cloud Theory monthly inventory',
}

FORBIDDEN_MARKERS = (
    "file://",
    "/Users/",
    "localhost",
    "public/fonts/",
    "4aaf576b2447fe80",
    "77a3fcdd7c267804",
    "ius_unity_prod.",
    "Bearer ",
    "DATABRICKS_TOKEN",
    "/serving-endpoints/",
    "mas-ed862019-endpoint",
)


def main() -> None:
    if not SOURCE_HTML.is_file():
        raise FileNotFoundError(f"Missing dashboard source: {SOURCE_HTML}")

    html = SOURCE_HTML.read_text(encoding="utf-8")
    for old, new in PUBLIC_REPLACEMENTS.items():
        html = html.replace(old, new)

    remaining = [marker for marker in FORBIDDEN_MARKERS if marker in html]
    if remaining:
        raise ValueError(f"Public HTML still contains local/private markers: {remaining}")

    OUTPUT.mkdir(parents=True, exist_ok=True)
    fonts_output = OUTPUT / "fonts"
    fonts_output.mkdir(parents=True, exist_ok=True)

    (OUTPUT / "index.html").write_text(html, encoding="utf-8")
    (OUTPUT / ".nojekyll").write_text("", encoding="utf-8")

    for filename in FONT_FILES:
        source = SOURCE_FONTS / filename
        if not source.is_file():
            raise FileNotFoundError(f"Missing required font: {source}")
        shutil.copy2(source, fonts_output / filename)

    readme = """# HMA Demand × Sales — static hosting package

This folder is a self-contained static site. Upload the contents of this folder
to the root of GitHub Pages, Cloudflare Pages, Netlify, an internal static web
server, or any equivalent host.

- Entry point: `index.html`
- Runtime database access: none
- Refresh behavior: the data is embedded at build time
- Fonts: bundled in `fonts/`

To update the hosted dashboard, refresh the source dashboard normally and run
`scripts/build_public_hosting.py` again before publishing this folder.

This package contains business performance data. Confirm the intended audience
and data-sharing approval before publishing it to an unrestricted public URL.
"""
    (OUTPUT / "README.md").write_text(readme, encoding="utf-8")

    manifest = {
        "built_at": datetime.now(timezone.utc).isoformat(),
        "entrypoint": "index.html",
        "sha256": hashlib.sha256(html.encode("utf-8")).hexdigest(),
        "files": [
            "index.html",
            ".nojekyll",
            "README.md",
            *[f"fonts/{filename}" for filename in FONT_FILES],
        ],
        "runtime_data_access": False,
        "internal_source_identifiers_removed": True,
        "embedded_insights": "EXECUTIVE READOUT" in html,
    }
    (OUTPUT / "build-manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )

    print(json.dumps({"output": str(OUTPUT), **manifest}, indent=2))


if __name__ == "__main__":
    main()
