from __future__ import annotations

import base64
import hashlib
import shutil
from pathlib import Path


COLLECTION_ROOT = Path(__file__).resolve().parents[2]
PROJECTS = COLLECTION_ROOT / "projects"
OUTPUTS = COLLECTION_ROOT / "outputs"

HTML_SOURCES = {
    "marcomdash_1.html": PROJECTS
    / "gma_marcom"
    / "dashboards"
    / "marcom-funnel-sales-correlations.html",
    "marcomdash_2.html": PROJECTS / "gma_marcom" / "dashboards" / "phase-chain-correlations.html",
    "ops_dash.html": PROJECTS
    / "ops_dash"
    / "dashboard"
    / "artifacts"
    / "GMA_HMA_Operations_Dashboard.html",
}

HMA_PROJECT = PROJECTS / "hma_governance"
HMA_SOURCE = HMA_PROJECT / "quadchart.html"
HMA_FONTS = (
    "HyundaiSansHead-Medium.woff2",
    "HyundaiSansHead-Bold.woff2",
    "HyundaiSansText-Regular.woff2",
    "HyundaiSansText-Medium.woff2",
)


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_self_contained_hma() -> Path:
    html = HMA_SOURCE.read_text(encoding="utf-8")
    for filename in HMA_FONTS:
        token = f'url("public/fonts/{filename}")'
        if token not in html:
            raise ValueError(f"Expected font reference is missing: {token}")
        encoded = base64.b64encode(
            (HMA_PROJECT / "public" / "fonts" / filename).read_bytes()
        ).decode("ascii")
        html = html.replace(token, f'url("data:font/woff2;base64,{encoded}")')

    destination = OUTPUTS / "hma_governance.html"
    destination.write_text(html, encoding="utf-8")
    return destination


def main() -> None:
    OUTPUTS.mkdir(parents=True, exist_ok=True)
    allowed = {"hma_governance.html", *HTML_SOURCES}
    for existing in OUTPUTS.iterdir():
        if existing.is_file() and existing.name not in allowed:
            raise ValueError(f"Unexpected file in outputs: {existing.name}")

    written = [write_self_contained_hma()]
    for filename, source in HTML_SOURCES.items():
        if not source.is_file():
            raise FileNotFoundError(source)
        destination = OUTPUTS / filename
        shutil.copy2(source, destination)
        written.append(destination)

    for path in written:
        print(f"{path.name}\t{path.stat().st_size}\t{digest(path)}")


if __name__ == "__main__":
    main()
